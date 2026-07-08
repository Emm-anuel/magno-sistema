package com.magno.service;

import com.magno.dto.cobros.ClienteRutaDTO;
import com.magno.dto.cobros.RutaDiaDTO;
import com.magno.model.*;
import com.magno.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
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
    void resumenIncluyeTotalCobradoParaCardsDeHistorial() {
        credito.setFechaVencimiento(LocalDate.of(2026, 7, 31));

        CalendarioPago calendarioHoy = CalendarioPago.builder()
                .id(2L)
                .numeroPago(7)
                .fechaProgramada(HOY)
                .montoEsperado(new BigDecimal("156.00"))
                .estado(EstadoCalendarioPago.PENDIENTE)
                .build();

        Pago pagoHoy = Pago.builder()
                .id(77L)
                .credito(credito)
                .cliente(cliente)
                .asesor(asesor)
                .calendarioPago(calendarioHoy)
                .numeroPago(7)
                .fechaPago(HOY)
                .montoRecibido(new BigDecimal("200.00"))
                .montoEsperado(new BigDecimal("156.00"))
                .esCompleto(true)
                .multaAplicada(new BigDecimal("50.00"))
                .build();

        when(creditoRepo.findRutaDiaCreditosActivos(eq(1L), isNull(), eq(EstadoCredito.ACTIVO)))
                .thenReturn(List.of(credito));
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of());
        when(pagoRepo.findBySucursalAndAsesorIdAndFecha(eq(1L), isNull(), eq(HOY)))
                .thenReturn(List.of(pagoHoy));
        when(calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(42L)).thenReturn(List.of(calendarioHoy));
        when(multaRepo.sumMontosPendientesByCreditoId(42L)).thenReturn(BigDecimal.ZERO);

        RutaDiaDTO result = service.getRutaDia(null, 1L, HOY, "ADMINISTRADOR", 10L, 1L);

        assertThat(result.resumen().totalCaja()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.resumen().totalRuta()).isEqualByComparingTo(new BigDecimal("200.00"));
        assertThat(result.resumen().totalMultasCobradas()).isEqualByComparingTo(new BigDecimal("50.00"));
    }
}
