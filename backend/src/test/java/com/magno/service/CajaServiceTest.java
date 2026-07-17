package com.magno.service;

import com.magno.dto.caja.CajaCierrePreviewDTO;
import com.magno.dto.caja.CajaDiaDetalleDTO;
import com.magno.dto.caja.CerrarCajaRequest;
import com.magno.dto.caja.SaldoAnteriorCajaDTO;
import com.magno.dto.cobros.ClienteNoPagoAutomaticoDTO;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.security.JwtPrincipal;
import com.magno.util.DateTimeUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class CajaServiceTest {

    private CajaDiaRepository cajaDiaRepo;
    private CajaMovimientoInversionRepository movimientoRepo;
    private ConfigSucursalRepository configSucursalRepo;
    private PagoRepository pagoRepo;
    private AbonoCorrienteRepository abonoCorrienteRepo;
    private CreditoRepository creditoRepo;
    private RenovacionRepository renovacionRepo;
    private UsuarioRepository usuarioRepo;
    private SucursalRepository sucursalRepo;
    private GastoRepository gastoRepo;
    private NominaPagoRepository nominaPagoRepo;
    private MultaRepository multaRepo;
    private CobrosService cobrosService;

    private CajaService service;

    private Sucursal sucursal;
    private Usuario admin;
    private CajaDia caja;
    private ConfigSucursal config;
    private JwtPrincipal principal;
    private LocalDate hoy;

    @BeforeEach
    void setUp() {
        cajaDiaRepo = mock(CajaDiaRepository.class);
        movimientoRepo = mock(CajaMovimientoInversionRepository.class);
        configSucursalRepo = mock(ConfigSucursalRepository.class);
        pagoRepo = mock(PagoRepository.class);
        abonoCorrienteRepo = mock(AbonoCorrienteRepository.class);
        creditoRepo = mock(CreditoRepository.class);
        renovacionRepo = mock(RenovacionRepository.class);
        usuarioRepo = mock(UsuarioRepository.class);
        sucursalRepo = mock(SucursalRepository.class);
        gastoRepo = mock(GastoRepository.class);
        nominaPagoRepo = mock(NominaPagoRepository.class);
        multaRepo = mock(MultaRepository.class);
        cobrosService = mock(CobrosService.class);

        service = new CajaService(cajaDiaRepo, movimientoRepo, configSucursalRepo, pagoRepo, abonoCorrienteRepo,
                creditoRepo, renovacionRepo, usuarioRepo, sucursalRepo, gastoRepo, nominaPagoRepo,
                multaRepo, cobrosService);

        hoy = DateTimeUtils.hoyEnMagno();

        sucursal = new Sucursal();
        sucursal.setId(1L);
        sucursal.setNombre("Sucursal Centro");

        admin = new Usuario();
        admin.setId(99L);
        admin.setNombreCompleto("Laura Gerente");

        principal = new JwtPrincipal(99L, "laura@magno.mx", "SUPERVISOR", 1L);

        caja = CajaDia.builder()
                .id(500L)
                .sucursal(sucursal)
                .fecha(hoy)
                .estado(EstadoCaja.ABIERTA)
                .montoApertura(new BigDecimal("1000.00"))
                .abiertaPor(admin)
                .fechaHoraApertura(DateTimeUtils.ahoraEnMagno())
                .build();

        config = new ConfigSucursal();
        config.setSucursalId(1L);
        config.setPorcentajeAhorro(new BigDecimal("0.10"));
        config.setMontoAhorroFijo(new BigDecimal("0"));
    }

    @Test
    void cerrar_marcaNoPagoAutomaticoAntesDeCalcularElResumen() {
        when(cajaDiaRepo.findById(500L)).thenReturn(Optional.of(caja));
        when(cajaDiaRepo.save(any(CajaDia.class))).thenAnswer(inv -> inv.getArgument(0));
        when(cobrosService.marcarNoPagoAutomatico(1L, hoy, 99L)).thenReturn(List.of());
        when(pagoRepo.sumIngresoBySucursalAndFecha(1L, hoy)).thenReturn(BigDecimal.ZERO);
        when(creditoRepo.sumDesembolsosBySucursalAndFecha(eq(1L), any(), any())).thenReturn(BigDecimal.ZERO);
        when(renovacionRepo.sumDesembolsosByScopeAndFecha(1L, null, hoy, hoy)).thenReturn(BigDecimal.ZERO);
        when(movimientoRepo.sumMontoByCajaDiaId(500L)).thenReturn(BigDecimal.ZERO);
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));
        when(gastoRepo.sumMontoByCajaDiaId(500L)).thenReturn(BigDecimal.ZERO);
        when(nominaPagoRepo.findByCajaDiaIdAndDeletedAtIsNull(500L)).thenReturn(Optional.empty());
        when(usuarioRepo.getReferenceById(99L)).thenReturn(admin);
        when(movimientoRepo.findByCajaDiaIdOrderByCreatedAtAsc(500L)).thenReturn(List.of());

        CajaDiaDetalleDTO result = service.cerrar(new CerrarCajaRequest(null, 500L), principal);

        assertThat(result.estado()).isEqualTo("CERRADA");

        InOrder inOrder = inOrder(cobrosService, pagoRepo);
        inOrder.verify(cobrosService).marcarNoPagoAutomatico(1L, hoy, 99L);
        inOrder.verify(pagoRepo).sumIngresoBySucursalAndFecha(1L, hoy);
    }

    @Test
    void getPreviewCierre_incluyeClientesSinRegistro() {
        when(cajaDiaRepo.findBySucursalIdAndFechaAndEstado(1L, hoy, EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(caja));
        when(movimientoRepo.sumMontoByCajaDiaId(500L)).thenReturn(BigDecimal.ZERO);
        when(pagoRepo.sumIngresoBySucursalAndFecha(1L, hoy)).thenReturn(new BigDecimal("100.00"));
        when(abonoCorrienteRepo.sumMontoTotalBySucursalAndFecha(1L, hoy))
                .thenReturn(new BigDecimal("75.00"));
        when(pagoRepo.findCobrosPorAsesorBySucursalAndFecha(1L, hoy))
                .thenReturn(java.util.Collections.singletonList(
                        new Object[] { "Ana Asesora", 2L, new BigDecimal("100.00") }));
        when(abonoCorrienteRepo.findCobrosPorAsesorBySucursalAndFecha(1L, hoy))
                .thenReturn(java.util.Collections.singletonList(
                        new Object[] { "Ana Asesora", 1L, new BigDecimal("75.00") }));
        when(creditoRepo.sumDesembolsosByTipoAndSucursalAndFecha(eq(1L), eq(TipoCredito.NUEVO), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(renovacionRepo.sumDesembolsosByScopeAndFecha(1L, null, hoy, hoy)).thenReturn(BigDecimal.ZERO);
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));
        when(gastoRepo.sumMontoByCajaDiaId(500L)).thenReturn(BigDecimal.ZERO);
        when(nominaPagoRepo.findByCajaDiaIdAndDeletedAtIsNull(500L)).thenReturn(Optional.empty());
        when(pagoRepo.findMultasPorAsesorBySucursalAndFecha(1L, hoy)).thenReturn(List.of());
        when(multaRepo.sumMultasCobrasViaRenovacionBySucursalAndFecha(1L, hoy)).thenReturn(BigDecimal.ZERO);
        when(multaRepo.sumMultasCondonadasBySucursalAndFecha(1L, hoy)).thenReturn(BigDecimal.ZERO);

        List<ClienteNoPagoAutomaticoDTO> esperado = List.of(
                new ClienteNoPagoAutomaticoDTO(5L, "Juana Pérez", 42L, 5, new BigDecimal("50.00")));
        when(cobrosService.previsualizarNoPagoAutomatico(1L, hoy)).thenReturn(esperado);

        CajaCierrePreviewDTO preview = service.getPreviewCierre(1L, principal);

        assertThat(preview.clientesSinRegistro()).isEqualTo(esperado);
        assertThat(preview.totalIngresoCarteras()).isEqualByComparingTo("175.00");
        assertThat(preview.cobrosPorAsesor()).singleElement().satisfies(cobro -> {
            assertThat(cobro.cantidadCobros()).isEqualTo(3);
            assertThat(cobro.montoCobrado()).isEqualByComparingTo("175.00");
        });
    }

    @Test
    void getSaldoAnterior_usaElRemanenteDelUltimoCorteCerrado() {
        CajaDia anterior = CajaDia.builder()
                .sucursal(sucursal)
                .fecha(hoy.minusDays(1))
                .estado(EstadoCaja.CERRADA)
                .subtotalCaja(new BigDecimal("2500.00"))
                .montoLibres(new BigDecimal("400.00"))
                .build();
        when(cajaDiaRepo.findFirstBySucursalIdAndEstadoAndFechaBeforeOrderByFechaDesc(
                1L, EstadoCaja.CERRADA, hoy)).thenReturn(Optional.of(anterior));

        SaldoAnteriorCajaDTO result = service.getSaldoAnterior(null, principal);

        assertThat(result.disponible()).isTrue();
        assertThat(result.monto()).isEqualByComparingTo("2100.00");
        assertThat(result.fecha()).isEqualTo(hoy.minusDays(1));
    }

    @Test
    void getSaldoAnterior_noOfreceSaldosNegativos() {
        CajaDia anterior = CajaDia.builder()
                .sucursal(sucursal)
                .fecha(hoy.minusDays(1))
                .estado(EstadoCaja.CERRADA)
                .subtotalCaja(new BigDecimal("100.00"))
                .montoLibres(new BigDecimal("150.00"))
                .build();
        when(cajaDiaRepo.findFirstBySucursalIdAndEstadoAndFechaBeforeOrderByFechaDesc(
                1L, EstadoCaja.CERRADA, hoy)).thenReturn(Optional.of(anterior));

        SaldoAnteriorCajaDTO result = service.getSaldoAnterior(null, principal);

        assertThat(result.disponible()).isFalse();
        assertThat(result.monto()).isEqualByComparingTo(BigDecimal.ZERO);
    }
}
