package com.magno.service;

import com.magno.dto.cobros.ClienteNoPagoAutomaticoDTO;
import com.magno.dto.cobros.ClienteRutaDTO;
import com.magno.dto.cobros.RutaDiaDTO;
import com.magno.model.*;
import com.magno.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

class CobrosServiceTest {

    private PagoRepository pagoRepo;
    private MultaRepository multaRepo;
    private CreditoRepository creditoRepo;
    private UsuarioRepository usuarioRepo;
    private CalendarioPagoRepository calendarioPagoRepo;
    private ConfigMultaRepository configMultaRepo;
    private DiaFestivoRepository diaFestivoRepo;

    private CobrosService service;

    private Sucursal sucursal;
    private Cliente cliente;
    private Rol rolAsesor;
    private Usuario asesor;
    private Credito credito;

    private static final LocalDate HOY = LocalDate.of(2026, 7, 8); // miércoles

    @BeforeEach
    void setUp() {
        pagoRepo = mock(PagoRepository.class);
        multaRepo = mock(MultaRepository.class);
        creditoRepo = mock(CreditoRepository.class);
        usuarioRepo = mock(UsuarioRepository.class);
        calendarioPagoRepo = mock(CalendarioPagoRepository.class);
        configMultaRepo = mock(ConfigMultaRepository.class);
        diaFestivoRepo = mock(DiaFestivoRepository.class);

        service = new CobrosService(
                pagoRepo, multaRepo, creditoRepo, usuarioRepo,
                calendarioPagoRepo, configMultaRepo, diaFestivoRepo);

        sucursal = new Sucursal();
        sucursal.setId(1L);

        rolAsesor = new Rol();
        rolAsesor.setNombre("ASESOR_COBRADOR");

        asesor = new Usuario();
        asesor.setId(10L);
        asesor.setRol(rolAsesor);
        asesor.setSucursal(sucursal);

        cliente = new Cliente();
        cliente.setId(5L);
        cliente.setNombre("Juana");
        cliente.setApellidoPaterno("Pérez");
        cliente.setCelular("5512345678");
        cliente.setSucursal(sucursal);

        credito = new Credito();
        credito.setId(42L);
        credito.setEstado(EstadoCredito.ACTIVO);
        credito.setAsesor(asesor);
        credito.setCliente(cliente);
        credito.setSucursal(sucursal);
        credito.setMontoCapital(new BigDecimal("3000.00"));
        credito.setPagoPeriodico(new BigDecimal("156.00"));
        credito.setTipoPago(TipoPago.DIARIO);
        credito.setPlazoDias(25);
        credito.setFechaVencimiento(LocalDate.of(2026, 6, 25)); // vencido respecto a HOY
    }

    private void mockRutaDiaComun(List<Credito> creditosActivos) {
        when(creditoRepo.findRutaDiaCreditosActivos(eq(1L), isNull(), eq(EstadoCredito.ACTIVO)))
                .thenReturn(creditosActivos);
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of());
        when(pagoRepo.findBySucursalAndAsesorIdAndFecha(eq(1L), isNull(), eq(HOY)))
                .thenReturn(List.of());
        when(calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(42L)).thenReturn(List.of());
    }

    @Test
    void creditoVencidoConAdeudo_apareceEnRutaDiaComoVencido() {
        mockRutaDiaComun(List.of(credito));
        when(multaRepo.sumMontosPendientesByCreditoId(42L)).thenReturn(new BigDecimal("100.00"));

        RutaDiaDTO result = service.getRutaDia(null, 1L, HOY, "ADMINISTRADOR", 10L, 1L);

        assertThat(result.clientes()).hasSize(1);
        ClienteRutaDTO c = result.clientes().get(0);
        assertThat(c.estadoHoy()).isEqualTo("VENCIDO");
        assertThat(c.multasPendientes()).isEqualByComparingTo(new BigDecimal("100.00"));
        assertThat(c.numeroPagoHoy()).isNull();
        assertThat(c.pagoIdHoy()).isNull();

        RutaDiaDTO.Resumen resumen = result.resumen();
        assertThat(resumen.noPagaron()).isEqualTo(1);
        assertThat(resumen.cobrados() + resumen.noPagaron() + resumen.sinRegistrar() + resumen.inhabiles())
                .isEqualTo(resumen.totalClientes());
    }

    @Test
    void creditoVencidoSinAdeudo_noApareceEnRutaDia() {
        mockRutaDiaComun(List.of(credito));
        when(multaRepo.sumMontosPendientesByCreditoId(42L)).thenReturn(BigDecimal.ZERO);

        RutaDiaDTO result = service.getRutaDia(null, 1L, HOY, "ADMINISTRADOR", 10L, 1L);

        assertThat(result.clientes()).isEmpty();
    }

    @Test
    void creditoVencidoSinMultaPeroConPagoPendienteAtrasado_apareceEnRutaDiaComoVencido() {
        // Nadie registró "no pago" para el día atrasado, así que no hay multa,
        // pero el pago sigue PENDIENTE con fecha ya pasada — sí hay adeudo real.
        CalendarioPago pendienteAtrasado = CalendarioPago.builder()
                .id(1L)
                .numeroPago(25)
                .fechaProgramada(LocalDate.of(2026, 6, 24))
                .montoEsperado(new BigDecimal("156.00"))
                .estado(EstadoCalendarioPago.PENDIENTE)
                .build();

        when(creditoRepo.findRutaDiaCreditosActivos(eq(1L), isNull(), eq(EstadoCredito.ACTIVO)))
                .thenReturn(List.of(credito));
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of());
        when(pagoRepo.findBySucursalAndAsesorIdAndFecha(eq(1L), isNull(), eq(HOY)))
                .thenReturn(List.of());
        when(calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(42L)).thenReturn(List.of(pendienteAtrasado));
        when(multaRepo.sumMontosPendientesByCreditoId(42L)).thenReturn(BigDecimal.ZERO);

        RutaDiaDTO result = service.getRutaDia(null, 1L, HOY, "ADMINISTRADOR", 10L, 1L);

        assertThat(result.clientes()).hasSize(1);
        ClienteRutaDTO c = result.clientes().get(0);
        assertThat(c.estadoHoy()).isEqualTo("VENCIDO");
        assertThat(c.multasPendientes()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(c.tieneAdeudoPendiente()).isTrue();
    }

    @Test
    void marcarNoPagoAutomatico_marcaPendienteComoNoPagoYGeneraMulta() {
        CalendarioPago pendienteHoy = CalendarioPago.builder()
                .id(7L)
                .numeroPago(5)
                .fechaProgramada(HOY)
                .montoEsperado(new BigDecimal("156.00"))
                .estado(EstadoCalendarioPago.PENDIENTE)
                .build();

        when(creditoRepo.findRutaDiaCreditosActivos(eq(1L), isNull(), eq(EstadoCredito.ACTIVO)))
                .thenReturn(List.of(credito));
        when(calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(42L)).thenReturn(List.of(pendienteHoy));
        when(configMultaRepo.findBySucursalAndMonto(1L, new BigDecimal("3000.00"))).thenReturn(Optional.empty());
        when(usuarioRepo.findById(10L)).thenReturn(Optional.of(asesor));

        List<ClienteNoPagoAutomaticoDTO> resultado = service.marcarNoPagoAutomatico(1L, HOY, 10L);

        assertThat(resultado).hasSize(1);
        ClienteNoPagoAutomaticoDTO dto = resultado.get(0);
        assertThat(dto.clienteId()).isEqualTo(5L);
        assertThat(dto.creditoId()).isEqualTo(42L);
        assertThat(dto.numeroPago()).isEqualTo(5);
        assertThat(dto.montoMulta()).isEqualByComparingTo(new BigDecimal("50.00"));

        ArgumentCaptor<Pago> pagoCaptor = ArgumentCaptor.forClass(Pago.class);
        verify(pagoRepo).save(pagoCaptor.capture());
        Pago pagoGuardado = pagoCaptor.getValue();
        assertThat(pagoGuardado.getMontoRecibido()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(pagoGuardado.getEsCompleto()).isFalse();
        assertThat(pagoGuardado.getRazonNoPago()).isEqualTo("Cierre de caja — sin registro de pago");
        assertThat(pagoGuardado.getMultaAplicada()).isEqualByComparingTo(new BigDecimal("50.00"));
        assertThat(pagoGuardado.getAsesor()).isEqualTo(asesor);
        assertThat(pagoGuardado.getRegistradoPor()).isEqualTo(asesor);

        ArgumentCaptor<CalendarioPago> cpCaptor = ArgumentCaptor.forClass(CalendarioPago.class);
        verify(calendarioPagoRepo).save(cpCaptor.capture());
        assertThat(cpCaptor.getValue().getEstado()).isEqualTo(EstadoCalendarioPago.NO_PAGADO);

        ArgumentCaptor<Multa> multaCaptor = ArgumentCaptor.forClass(Multa.class);
        verify(multaRepo).save(multaCaptor.capture());
        Multa multaGuardada = multaCaptor.getValue();
        assertThat(multaGuardada.getTipo()).isEqualTo("NO_PAGO");
        assertThat(multaGuardada.getMonto()).isEqualByComparingTo(new BigDecimal("50.00"));
        assertThat(multaGuardada.getCobrada()).isFalse();
    }

    @Test
    void marcarNoPagoAutomatico_sinSlotPendienteEseDia_noGeneraNada() {
        CalendarioPago yaPagado = CalendarioPago.builder()
                .id(7L)
                .numeroPago(5)
                .fechaProgramada(HOY)
                .montoEsperado(new BigDecimal("156.00"))
                .estado(EstadoCalendarioPago.PAGADO)
                .build();

        when(creditoRepo.findRutaDiaCreditosActivos(eq(1L), isNull(), eq(EstadoCredito.ACTIVO)))
                .thenReturn(List.of(credito));
        when(calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(42L)).thenReturn(List.of(yaPagado));

        List<ClienteNoPagoAutomaticoDTO> resultado = service.marcarNoPagoAutomatico(1L, HOY, 10L);

        assertThat(resultado).isEmpty();
        verify(pagoRepo, never()).save(any());
        verify(multaRepo, never()).save(any());
        verify(calendarioPagoRepo, never()).save(any());
        verify(usuarioRepo, never()).findById(any());
    }

    @Test
    void previsualizarNoPagoAutomatico_calculaSinPersistirNada() {
        CalendarioPago pendienteHoy = CalendarioPago.builder()
                .id(7L)
                .numeroPago(5)
                .fechaProgramada(HOY)
                .montoEsperado(new BigDecimal("156.00"))
                .estado(EstadoCalendarioPago.PENDIENTE)
                .build();

        when(creditoRepo.findRutaDiaCreditosActivos(eq(1L), isNull(), eq(EstadoCredito.ACTIVO)))
                .thenReturn(List.of(credito));
        when(calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(42L)).thenReturn(List.of(pendienteHoy));
        when(configMultaRepo.findBySucursalAndMonto(1L, new BigDecimal("3000.00"))).thenReturn(Optional.empty());

        List<ClienteNoPagoAutomaticoDTO> resultado = service.previsualizarNoPagoAutomatico(1L, HOY);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).montoMulta()).isEqualByComparingTo(new BigDecimal("50.00"));
        verify(pagoRepo, never()).save(any());
        verify(multaRepo, never()).save(any());
        verify(calendarioPagoRepo, never()).save(any());
        verify(usuarioRepo, never()).findById(any());
    }
}
