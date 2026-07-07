package com.magno.service;

import com.magno.dto.cobros.AbonoCorrienteDTO;
import com.magno.dto.cobros.AbonoCorrienteRequest;
import com.magno.model.*;
import com.magno.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AbonoCorrienteServiceTest {

    private AbonoCorrienteRepository abonoCorrienteRepo;
    private AbonoCoberturaDetalleRepository abonoCoberturaRepo;
    private CreditoRepository creditoRepo;
    private UsuarioRepository usuarioRepo;
    private CalendarioPagoRepository calendarioPagoRepo;
    private MultaRepository multaRepo;
    private CobrosService cobrosService;

    private AbonoCorrienteService service;

    private Sucursal sucursal;
    private Cliente cliente;
    private Rol rolAsesor;
    private Usuario asesor;
    private Credito credito;

    @BeforeEach
    void setUp() {
        abonoCorrienteRepo = mock(AbonoCorrienteRepository.class);
        abonoCoberturaRepo = mock(AbonoCoberturaDetalleRepository.class);
        creditoRepo        = mock(CreditoRepository.class);
        usuarioRepo        = mock(UsuarioRepository.class);
        calendarioPagoRepo = mock(CalendarioPagoRepository.class);
        multaRepo          = mock(MultaRepository.class);
        cobrosService      = mock(CobrosService.class);

        service = new AbonoCorrienteService(
                abonoCorrienteRepo,
                abonoCoberturaRepo,
                creditoRepo,
                usuarioRepo,
                calendarioPagoRepo,
                multaRepo,
                cobrosService);

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
        cliente.setSucursal(sucursal);

        credito = new Credito();
        credito.setId(42L);
        credito.setEstado(EstadoCredito.ACTIVO);
        credito.setAsesor(asesor);
        credito.setCliente(cliente);
        credito.setSucursal(sucursal);
    }

    private CalendarioPago slot(long id, int numeroPago, LocalDate fecha, BigDecimal monto, EstadoCalendarioPago estado) {
        CalendarioPago cp = new CalendarioPago();
        cp.setId(id);
        cp.setNumeroPago(numeroPago);
        cp.setFechaProgramada(fecha);
        cp.setMontoEsperado(monto);
        cp.setEstado(estado);
        cp.setCredito(credito);
        return cp;
    }

    private Multa multaNoPago(long id, LocalDate fecha, BigDecimal monto) {
        Multa m = new Multa();
        m.setId(id);
        m.setTipo("NO_PAGO");
        m.setMonto(monto);
        m.setFecha(fecha);
        m.setCobrada(false);
        m.setCondonada(false);
        m.setCredito(credito);
        m.setCliente(cliente);
        return m;
    }

    @Test
    void distribuyeCorrectamente_cubriendo7DiasCompletos_y1Parcial() {
        LocalDate base = LocalDate.of(2026, 6, 25);
        BigDecimal cuota = new BigDecimal("156.00");
        BigDecimal multa = new BigDecimal("50.00");

        List<CalendarioPago> slots = new java.util.ArrayList<>();
        for (int i = 0; i < 8; i++) {
            slots.add(slot(100L + i, i + 1, base.plusDays(i), cuota, EstadoCalendarioPago.NO_PAGADO));
        }

        when(usuarioRepo.findById(10L)).thenReturn(Optional.of(asesor));
        when(creditoRepo.findById(42L)).thenReturn(Optional.of(credito));
        when(calendarioPagoRepo.findSlotsCubrir(eq(42L), any())).thenReturn(slots);
        for (int i = 0; i < 8; i++) {
            when(multaRepo.findPendientesByCreditoIdAndFecha(eq(42L), eq(base.plusDays(i))))
                .thenReturn(List.of(multaNoPago(200L + i, base.plusDays(i), multa)));
        }
        when(abonoCoberturaRepo.sumTotalAplicadoByCalendarioPagoId(anyLong())).thenReturn(BigDecimal.ZERO);
        when(abonoCoberturaRepo.sumMontoMultaByCalendarioPagoId(anyLong())).thenReturn(BigDecimal.ZERO);
        when(abonoCoberturaRepo.sumMontoCuotaByCalendarioPagoId(anyLong())).thenReturn(BigDecimal.ZERO);

        AbonoCorriente savedAbono = new AbonoCorriente();
        savedAbono.setId(7L);
        savedAbono.setCredito(credito);
        savedAbono.setFecha(LocalDate.now(ZoneId.of("America/Mexico_City")));
        savedAbono.setMontoTotal(new BigDecimal("1500.00"));
        savedAbono.setMontoDistribuido(new BigDecimal("1500.00"));
        savedAbono.setMontoSobrante(BigDecimal.ZERO);
        savedAbono.setRegistradoPor(asesor);
        when(abonoCorrienteRepo.save(any())).thenReturn(savedAbono);
        when(abonoCoberturaRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(multaRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AbonoCorrienteRequest req = new AbonoCorrienteRequest(42L, new BigDecimal("1500.00"), null);
        AbonoCorrienteDTO result = service.registrarAbono(req, 10L);

        assertThat(result.diasCubiertos()).isEqualTo(7);
        assertThat(result.diasParciales()).isEqualTo(1);
        assertThat(result.montoSobrante()).isEqualByComparingTo(BigDecimal.ZERO);

        AbonoCorrienteDTO.CoberturaDetalleDTO dia8 = result.coberturas().get(7);
        assertThat(dia8.esParcial()).isTrue();
        assertThat(dia8.totalAplicado()).isEqualByComparingTo(new BigDecimal("58.00"));

        assertThat(slots.get(7).getEstado()).isEqualTo(EstadoCalendarioPago.RECUPERADO_PARCIAL);
        for (int i = 0; i < 7; i++) {
            assertThat(slots.get(i).getEstado()).isEqualTo(EstadoCalendarioPago.RECUPERADO);
        }
    }

    @Test
    void cubreExactamente_cuandoMontoEsExacto() {
        LocalDate base = LocalDate.of(2026, 6, 25);
        BigDecimal cuota = new BigDecimal("156.00");
        BigDecimal multa = new BigDecimal("50.00");
        BigDecimal montoExacto = new BigDecimal("1648.00");

        List<CalendarioPago> slots = new java.util.ArrayList<>();
        for (int i = 0; i < 8; i++) {
            slots.add(slot(100L + i, i + 1, base.plusDays(i), cuota, EstadoCalendarioPago.NO_PAGADO));
        }

        when(usuarioRepo.findById(10L)).thenReturn(Optional.of(asesor));
        when(creditoRepo.findById(42L)).thenReturn(Optional.of(credito));
        when(calendarioPagoRepo.findSlotsCubrir(eq(42L), any())).thenReturn(slots);
        for (int i = 0; i < 8; i++) {
            when(multaRepo.findPendientesByCreditoIdAndFecha(eq(42L), eq(base.plusDays(i))))
                .thenReturn(List.of(multaNoPago(200L + i, base.plusDays(i), multa)));
        }
        when(abonoCoberturaRepo.sumTotalAplicadoByCalendarioPagoId(anyLong())).thenReturn(BigDecimal.ZERO);
        when(abonoCoberturaRepo.sumMontoMultaByCalendarioPagoId(anyLong())).thenReturn(BigDecimal.ZERO);
        when(abonoCoberturaRepo.sumMontoCuotaByCalendarioPagoId(anyLong())).thenReturn(BigDecimal.ZERO);

        AbonoCorriente savedAbono = new AbonoCorriente();
        savedAbono.setId(8L);
        savedAbono.setCredito(credito);
        savedAbono.setFecha(LocalDate.now(ZoneId.of("America/Mexico_City")));
        savedAbono.setMontoTotal(montoExacto);
        savedAbono.setMontoDistribuido(montoExacto);
        savedAbono.setMontoSobrante(BigDecimal.ZERO);
        savedAbono.setRegistradoPor(asesor);
        when(abonoCorrienteRepo.save(any())).thenReturn(savedAbono);
        when(abonoCoberturaRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(multaRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AbonoCorrienteRequest req = new AbonoCorrienteRequest(42L, montoExacto, null);
        AbonoCorrienteDTO result = service.registrarAbono(req, 10L);

        assertThat(result.diasCubiertos()).isEqualTo(8);
        assertThat(result.diasParciales()).isEqualTo(0);
        assertThat(result.montoSobrante()).isEqualByComparingTo(BigDecimal.ZERO);
        for (CalendarioPago cp : slots) {
            assertThat(cp.getEstado()).isEqualTo(EstadoCalendarioPago.RECUPERADO);
        }
    }

    @Test
    void segundoAbono_completa_slotRecuperadoParcial() {
        LocalDate dia8 = LocalDate.of(2026, 7, 4);
        LocalDate dia9 = LocalDate.of(2026, 7, 7);
        BigDecimal cuota = new BigDecimal("156.00");
        BigDecimal multa = new BigDecimal("50.00");

        CalendarioPago slotParcial = slot(108L, 8, dia8, cuota, EstadoCalendarioPago.RECUPERADO_PARCIAL);
        CalendarioPago slotPendiente = slot(109L, 9, dia9, cuota, EstadoCalendarioPago.NO_PAGADO);

        when(usuarioRepo.findById(10L)).thenReturn(Optional.of(asesor));
        when(creditoRepo.findById(42L)).thenReturn(Optional.of(credito));
        when(calendarioPagoRepo.findSlotsCubrir(eq(42L), any())).thenReturn(List.of(slotParcial, slotPendiente));

        when(abonoCoberturaRepo.sumTotalAplicadoByCalendarioPagoId(108L)).thenReturn(new BigDecimal("58.00"));
        when(abonoCoberturaRepo.sumMontoMultaByCalendarioPagoId(108L)).thenReturn(new BigDecimal("50.00"));
        when(abonoCoberturaRepo.sumMontoCuotaByCalendarioPagoId(108L)).thenReturn(new BigDecimal("8.00"));
        when(abonoCoberturaRepo.sumTotalAplicadoByCalendarioPagoId(109L)).thenReturn(BigDecimal.ZERO);
        when(abonoCoberturaRepo.sumMontoMultaByCalendarioPagoId(109L)).thenReturn(BigDecimal.ZERO);
        when(abonoCoberturaRepo.sumMontoCuotaByCalendarioPagoId(109L)).thenReturn(BigDecimal.ZERO);

        when(multaRepo.findPendientesByCreditoIdAndFecha(eq(42L), eq(dia8))).thenReturn(List.of());
        when(multaRepo.findPendientesByCreditoIdAndFecha(eq(42L), eq(dia9)))
            .thenReturn(List.of(multaNoPago(209L, dia9, multa)));

        AbonoCorriente savedAbono = new AbonoCorriente();
        savedAbono.setId(9L);
        savedAbono.setCredito(credito);
        savedAbono.setFecha(LocalDate.now(ZoneId.of("America/Mexico_City")));
        savedAbono.setMontoTotal(new BigDecimal("354.00"));
        savedAbono.setMontoDistribuido(new BigDecimal("354.00"));
        savedAbono.setMontoSobrante(BigDecimal.ZERO);
        savedAbono.setRegistradoPor(asesor);
        when(abonoCorrienteRepo.save(any())).thenReturn(savedAbono);
        when(abonoCoberturaRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(multaRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AbonoCorrienteRequest req = new AbonoCorrienteRequest(42L, new BigDecimal("354.00"), null);
        AbonoCorrienteDTO result = service.registrarAbono(req, 10L);

        assertThat(result.diasCubiertos()).isEqualTo(2);
        assertThat(result.diasParciales()).isEqualTo(0);
        assertThat(slotParcial.getEstado()).isEqualTo(EstadoCalendarioPago.RECUPERADO);
        assertThat(slotPendiente.getEstado()).isEqualTo(EstadoCalendarioPago.RECUPERADO);
    }

    @Test
    void lanzaError400_cuandoNoHayDiasAtrasados() {
        when(usuarioRepo.findById(10L)).thenReturn(Optional.of(asesor));
        when(creditoRepo.findById(42L)).thenReturn(Optional.of(credito));
        when(calendarioPagoRepo.findSlotsCubrir(eq(42L), any())).thenReturn(List.of());

        AbonoCorrienteRequest req = new AbonoCorrienteRequest(42L, new BigDecimal("500.00"), null);

        assertThatThrownBy(() -> service.registrarAbono(req, 10L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("No hay días atrasados");
    }

    @Test
    void lanzaError400_cuandoCreditoNoActivo() {
        credito.setEstado(EstadoCredito.PAGADO);
        when(usuarioRepo.findById(10L)).thenReturn(Optional.of(asesor));
        when(creditoRepo.findById(42L)).thenReturn(Optional.of(credito));

        AbonoCorrienteRequest req = new AbonoCorrienteRequest(42L, new BigDecimal("500.00"), null);

        assertThatThrownBy(() -> service.registrarAbono(req, 10L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("activo");
    }

    @Test
    void lanzaError403_cuandoAsesorNoTieneAcceso() {
        Usuario otroAsesor = new Usuario();
        otroAsesor.setId(99L);
        otroAsesor.setRol(rolAsesor);
        otroAsesor.setSucursal(sucursal);

        when(usuarioRepo.findById(99L)).thenReturn(Optional.of(otroAsesor));
        when(creditoRepo.findById(42L)).thenReturn(Optional.of(credito));

        AbonoCorrienteRequest req = new AbonoCorrienteRequest(42L, new BigDecimal("500.00"), null);

        assertThatThrownBy(() -> service.registrarAbono(req, 99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("acceso");
    }
}
