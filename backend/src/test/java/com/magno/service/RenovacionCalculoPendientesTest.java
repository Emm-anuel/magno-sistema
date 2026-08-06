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
 * Un día pagado de forma PARCIAL (el cliente abonó pero no alcanzó el monto
 * esperado del día) ya se trata como resuelto/terminal en el flujo de cobros
 * (ver CobrosService.verificarCreditoCompletado, que lo agrupa junto con
 * PAGADO/ADELANTADO/RECUPERADO). El cálculo de renovación anticipada debe
 * ser consistente con eso: un día PARCIAL no debe volver a contarse como
 * "pago restante" a cobrar en su totalidad.
 */
class RenovacionCalculoPendientesTest {

    private RenovacionRepository renovacionRepo;
    private CreditoRepository creditoRepo;
    private CalendarioPagoRepository calendarioPagoRepo;
    private MultaRepository multaRepo;
    private UsuarioRepository usuarioRepo;
    private CreditoCalculoService calculoService;
    private ConfigUmbralRenovacionRepository configUmbralRepo;

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

        service = new RenovacionService(
                renovacionRepo,
                creditoRepo,
                calendarioPagoRepo,
                multaRepo,
                usuarioRepo,
                calculoService,
                new RenovacionElegibilidadService(configUmbralRepo));

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
    void calcularPreview_unDiaPARCIALNoCuentaComoPagoRestante() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<EstadoCalendarioPago>> estadosCapturados = ArgumentCaptor.forClass(List.class);
        when(calendarioPagoRepo.findByCreditoIdAndEstadoIn(eq(100L), estadosCapturados.capture()))
                .thenReturn(List.of());

        service.calcularPreview(100L, new BigDecimal("20000.00"), null);

        assertThat(estadosCapturados.getValue())
                .as("PARCIAL ya se considera resuelto (igual que en verificarCreditoCompletado) y no debe tratarse como pago pendiente")
                .doesNotContain(EstadoCalendarioPago.PARCIAL)
                .contains(
                        EstadoCalendarioPago.PENDIENTE,
                        EstadoCalendarioPago.NO_PAGADO,
                        EstadoCalendarioPago.RECUPERADO_PARCIAL);
    }
}
