package com.magno.service;

import com.magno.model.*;
import com.magno.repository.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Un día PARCIAL ya no cuenta como "pago restante" a cobrar (ver
 * RenovacionCalculoPendientesTest), pero eso no debe esconder que ese día
 * quedó con un abono incompleto. Estos tests cubren el indicador informativo
 * "pagosConAbonoParcial", calculado en vivo, tanto en el cálculo previo
 * (pantalla de nueva renovación) como en el listado de pendientes por
 * aprobar.
 */
class RenovacionAbonoParcialIndicadorTest {

    private RenovacionRepository renovacionRepo;
    private CreditoRepository creditoRepo;
    private CalendarioPagoRepository calendarioPagoRepo;
    private MultaRepository multaRepo;
    private UsuarioRepository usuarioRepo;
    private CreditoCalculoService calculoService;
    private ConfigUmbralRenovacionRepository configUmbralRepo;

    private RenovacionService service;
    private Sucursal sucursal;
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
                new RenovacionElegibilidadService(configUmbralRepo),
                mock(SaldoCuotaService.class));

        sucursal = new Sucursal();
        sucursal.setId(1L);
        sucursal.setNombre("Sucursal Central");

        credito = new Credito();
        credito.setId(100L);
        credito.setEstado(EstadoCredito.ACTIVO);
        credito.setSucursal(sucursal);
        credito.setMontoCapital(new BigDecimal("15000.00"));
        credito.setPagoPeriodico(new BigDecimal("700.00"));
        credito.setPlazoDias(25);
        credito.setTipoPago(TipoPago.DIARIO);
    }

    @Test
    void calcularPreview_reportaConteoDePagosConAbonoParcial() {
        when(creditoRepo.findById(100L)).thenReturn(Optional.of(credito));
        when(configUmbralRepo.findBySucursalIdAndTipoPagoAndPlazo(1L, "DIARIO", 25))
                .thenReturn(Optional.empty());
        when(calendarioPagoRepo.countByCreditoIdAndEstadoIn(
                eq(100L), eq(RenovacionElegibilidadService.ESTADOS_REALIZADOS)))
                .thenReturn(16L);
        when(calendarioPagoRepo.countByCreditoIdAndEstadoIn(
                eq(100L), eq(List.of(
                        EstadoCalendarioPago.PARCIAL,
                        EstadoCalendarioPago.RECUPERADO_PARCIAL))))
                .thenReturn(1L);
        when(calendarioPagoRepo.findByCreditoIdAndEstadoIn(eq(100L), org.mockito.ArgumentMatchers.anyList()))
                .thenReturn(List.of());
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

        var calculo = service.calcularPreview(100L, new BigDecimal("20000.00"), null);

        assertThat(calculo.pagosConAbonoParcial()).isEqualTo(1);
    }

    @Test
    void getPendientes_reportaConteoDePagosConAbonoParcialPorRenovacion() {
        Cliente cliente = new Cliente();
        cliente.setId(10L);
        cliente.setNombre("Ana");
        cliente.setApellidoPaterno("García");

        Usuario asesor = new Usuario();
        asesor.setId(20L);
        asesor.setNombreCompleto("Carlos Asesor");
        asesor.setSucursal(sucursal);

        Renovacion renovacion = new Renovacion();
        renovacion.setId(200L);
        renovacion.setCreditoAnterior(credito);
        renovacion.setCliente(cliente);
        renovacion.setAsesor(asesor);
        renovacion.setEstado(EstadoRenovacion.SOLICITADO);
        renovacion.setMontoNuevo(new BigDecimal("20000.00"));
        renovacion.setTipoPago(TipoPago.DIARIO);
        renovacion.setFecha(LocalDate.now());
        renovacion.setPagosRestantes(8);
        renovacion.setMontoPagosRestantes(new BigDecimal("5600.00"));
        renovacion.setMultasPendientes(BigDecimal.ZERO);
        renovacion.setMultasCondonadas(BigDecimal.ZERO);
        renovacion.setPagoAdelantado(new BigDecimal("700.00"));
        renovacion.setMontoDesembolso(new BigDecimal("13700.00"));

        when(renovacionRepo.findPendientes(null, null)).thenReturn(List.of(renovacion));
        when(calendarioPagoRepo.countByCreditoIdAndEstadoIn(
                eq(100L), eq(List.of(
                        EstadoCalendarioPago.PARCIAL,
                        EstadoCalendarioPago.RECUPERADO_PARCIAL))))
                .thenReturn(2L);

        var pendientes = service.getPendientes(null, null);

        assertThat(pendientes).hasSize(1);
        assertThat(pendientes.get(0).pagosConAbonoParcial()).isEqualTo(2);
    }
}
