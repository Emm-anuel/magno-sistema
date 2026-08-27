package com.magno.service;

import com.magno.model.*;
import com.magno.repository.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Una cuota parcial conserva capital pendiente. La renovación debe descontar
 * únicamente ese saldo, nunca volver a cobrar la cuota completa.
 */
class RenovacionCalculoPendientesTest {

    private RenovacionRepository renovacionRepo;
    private CreditoRepository creditoRepo;
    private CalendarioPagoRepository calendarioPagoRepo;
    private MultaRepository multaRepo;
    private UsuarioRepository usuarioRepo;
    private CreditoCalculoService calculoService;
    private ConfigUmbralRenovacionRepository configUmbralRepo;
    private SaldoCuotaService saldoCuotaService;

    private RenovacionService service;
    private Credito credito;

    @BeforeEach
    void setUp() {
        renovacionRepo = mock(RenovacionRepository.class);
        creditoRepo = mock(CreditoRepository.class);
        calendarioPagoRepo = mock(CalendarioPagoRepository.class);
        multaRepo = mock(MultaRepository.class);
        usuarioRepo = mock(UsuarioRepository.class);
        calculoService = mock(CreditoCalculoService.class);
        configUmbralRepo = mock(ConfigUmbralRenovacionRepository.class);
        saldoCuotaService = mock(SaldoCuotaService.class);

        service = new RenovacionService(
                renovacionRepo,
                creditoRepo,
                calendarioPagoRepo,
                multaRepo,
                usuarioRepo,
                calculoService,
                new RenovacionElegibilidadService(configUmbralRepo),
                saldoCuotaService);

        Sucursal sucursal = new Sucursal();
        sucursal.setId(1L);

        credito = new Credito();
        credito.setId(100L);
        credito.setEstado(EstadoCredito.ACTIVO);
        credito.setSucursal(sucursal);
        credito.setMontoCapital(new BigDecimal("15000.00"));
        credito.setPagoPeriodico(new BigDecimal("700.00"));
        credito.setPlazoDias(25);
        credito.setTipoPago(TipoPago.DIARIO);

        when(creditoRepo.findById(100L)).thenReturn(Optional.of(credito));
        // Umbral por defecto para DIARIO/plazo!=30 es 16 (ver RenovacionElegibilidadService.umbralDefault)
        when(configUmbralRepo.findBySucursalIdAndTipoPagoAndPlazo(1L, "DIARIO", 25))
                .thenReturn(Optional.empty());
        when(calendarioPagoRepo.countByCreditoIdAndEstadoIn(eq(100L), org.mockito.ArgumentMatchers.anyList()))
                .thenReturn(16L);
        when(multaRepo.sumMontosPendientesByCreditoId(100L)).thenReturn(BigDecimal.ZERO);
        when(calculoService.calcularCredito(org.mockito.ArgumentMatchers.any(), eq(1L)))
                .thenReturn(new CreditoCalculoService.ResumenCalculo(
                        new BigDecimal("20000.00"),
                        30,
                        new BigDecimal("0.24"),
                        new BigDecimal("4800.00"),
                        new BigDecimal("24800.00"),
                        new BigDecimal("826.6666666667"),
                        new BigDecimal("827.00"),
                        new BigDecimal("817.00")));
    }

    @Test
    void calcularPreview_descuentaSoloElSaldoDeUnaCuotaParcial() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<EstadoCalendarioPago>> estadosCapturados = ArgumentCaptor.forClass(List.class);
        CalendarioPago parcial = new CalendarioPago();
        parcial.setId(501L);
        parcial.setEstado(EstadoCalendarioPago.PARCIAL);
        parcial.setMontoEsperado(new BigDecimal("700.00"));
        when(calendarioPagoRepo.findByCreditoIdAndEstadoIn(eq(100L), estadosCapturados.capture()))
                .thenReturn(List.of(parcial));
        when(calendarioPagoRepo.countByCreditoIdAndEstadoIn(
                100L, List.of(EstadoCalendarioPago.PARCIAL, EstadoCalendarioPago.RECUPERADO_PARCIAL)))
                .thenReturn(1L);
        when(saldoCuotaService.saldoCuota(parcial)).thenReturn(new BigDecimal("250.00"));

        var calculo = service.calcularPreview(100L, new BigDecimal("20000.00"), null);

        assertThat(estadosCapturados.getValue())
                .as("las cuotas parciales conservan un saldo recuperable")
                .contains(
                        EstadoCalendarioPago.PENDIENTE,
                        EstadoCalendarioPago.NO_PAGADO,
                        EstadoCalendarioPago.PARCIAL,
                        EstadoCalendarioPago.RECUPERADO_PARCIAL);
        assertThat(calculo.montoPagosRestantes()).isEqualByComparingTo("250.00");
        assertThat(calculo.saldoAbonosParciales()).isEqualByComparingTo("250.00");
    }
}
