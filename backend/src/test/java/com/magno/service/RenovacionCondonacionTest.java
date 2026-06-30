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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RenovacionCondonacionTest {

    private RenovacionRepository renovacionRepo;
    private CreditoRepository creditoRepo;
    private CalendarioPagoRepository calendarioPagoRepo;
    private MultaRepository multaRepo;
    private UsuarioRepository usuarioRepo;
    private CreditoCalculoService calculoService;
    private ConfigUmbralRenovacionRepository configUmbralRepo;

    private RenovacionService service;

    // ── Entidades de prueba ──────────────────────────────────────────
    private Sucursal sucursal;
    private Cliente cliente;
    private Usuario asesor;
    private Usuario gerente;
    private Credito creditoAnterior;
    private Renovacion renovacion;
    private Multa multa1;
    private Multa multa2;

    @BeforeEach
    void setUp() {
        renovacionRepo    = mock(RenovacionRepository.class);
        creditoRepo       = mock(CreditoRepository.class);
        calendarioPagoRepo = mock(CalendarioPagoRepository.class);
        multaRepo         = mock(MultaRepository.class);
        usuarioRepo       = mock(UsuarioRepository.class);
        calculoService    = mock(CreditoCalculoService.class);
        configUmbralRepo  = mock(ConfigUmbralRenovacionRepository.class);

        service = new RenovacionService(
                renovacionRepo,
                creditoRepo,
                calendarioPagoRepo,
                multaRepo,
                usuarioRepo,
                calculoService,
                configUmbralRepo);

        // Sucursal
        sucursal = new Sucursal();
        sucursal.setId(1L);
        sucursal.setNombre("Sucursal Central");

        // Cliente
        cliente = new Cliente();
        cliente.setId(10L);
        cliente.setNombre("Ana");
        cliente.setApellidoPaterno("García");
        cliente.setApellidoMaterno("López");
        cliente.setCelular("5551234567");

        // Asesor
        asesor = new Usuario();
        asesor.setId(20L);
        asesor.setNombreCompleto("Carlos Asesor");
        asesor.setSucursal(sucursal);

        // Gerente (aprobador)
        gerente = new Usuario();
        gerente.setId(21L);
        gerente.setNombreCompleto("Laura Gerente");
        gerente.setSucursal(sucursal);

        // Crédito anterior
        creditoAnterior = new Credito();
        creditoAnterior.setId(100L);
        creditoAnterior.setCliente(cliente);
        creditoAnterior.setAsesor(asesor);
        creditoAnterior.setSucursal(sucursal);
        creditoAnterior.setEstado(EstadoCredito.ACTIVO);
        creditoAnterior.setMontoCapital(new BigDecimal("15000.00"));
        creditoAnterior.setPagoPeriodico(new BigDecimal("700.00"));
        creditoAnterior.setPlazoDias(25);
        creditoAnterior.setTipoPago(TipoPago.DIARIO);

        // Renovación en estado SOLICITADO
        renovacion = new Renovacion();
        renovacion.setId(200L);
        renovacion.setCreditoAnterior(creditoAnterior);
        renovacion.setCliente(cliente);
        renovacion.setAsesor(asesor);
        renovacion.setEstado(EstadoRenovacion.SOLICITADO);
        renovacion.setMontoNuevo(new BigDecimal("20000.00"));
        renovacion.setTipoPago(TipoPago.DIARIO);
        renovacion.setFecha(LocalDate.now());
        renovacion.setPagosRestantes(5);
        renovacion.setMontoPagosRestantes(new BigDecimal("3500.00"));
        renovacion.setMultasPendientes(new BigDecimal("200.00"));
        renovacion.setMultasCondonadas(BigDecimal.ZERO);
        renovacion.setPagoAdelantado(new BigDecimal("700.00"));
        renovacion.setMontoDesembolso(new BigDecimal("15600.00"));

        // Multa 1 — pertenece al crédito anterior, no cobrada, no condonada
        multa1 = new Multa();
        multa1.setId(301L);
        multa1.setCredito(creditoAnterior);
        multa1.setCliente(cliente);
        multa1.setTipo("NO_PAGO");
        multa1.setMonto(new BigDecimal("100.00"));
        multa1.setFecha(LocalDate.now().minusDays(2));
        multa1.setCobrada(false);
        multa1.setCondonada(false);

        // Multa 2 — pertenece al crédito anterior, no cobrada, no condonada
        multa2 = new Multa();
        multa2.setId(302L);
        multa2.setCredito(creditoAnterior);
        multa2.setCliente(cliente);
        multa2.setTipo("NO_PAGO");
        multa2.setMonto(new BigDecimal("100.00"));
        multa2.setFecha(LocalDate.now().minusDays(1));
        multa2.setCobrada(false);
        multa2.setCondonada(false);
    }

    // ────────────────────────────────────────────────────────────────
    // Test 1 — aprobar sin condonaciones
    // ────────────────────────────────────────────────────────────────

    @Test
    void aprobar_sinCondonaciones_funciona() {
        when(renovacionRepo.findById(200L)).thenReturn(Optional.of(renovacion));
        when(usuarioRepo.findById(21L)).thenReturn(Optional.of(gerente));
        when(renovacionRepo.save(any())).thenReturn(renovacion);

        var resultado = service.aprobarRenovacion(200L, null, null, null, 21L);

        assertThat(resultado.estado()).isEqualTo("APROBADO");
        assertThat(resultado.multasCondonadas()).isEqualByComparingTo(BigDecimal.ZERO);
        verify(multaRepo, never()).save(any());
    }

    // ────────────────────────────────────────────────────────────────
    // Test 2 — condonación parcial (una multa)
    // ────────────────────────────────────────────────────────────────

    @Test
    void aprobar_conCondonacionParcial_marcaMultasYRecalculaDesembolso() {
        when(renovacionRepo.findById(200L)).thenReturn(Optional.of(renovacion));
        when(usuarioRepo.findById(21L)).thenReturn(Optional.of(gerente));
        when(multaRepo.findById(301L)).thenReturn(Optional.of(multa1));
        when(multaRepo.save(multa1)).thenReturn(multa1);
        when(renovacionRepo.save(any())).thenReturn(renovacion);

        var resultado = service.aprobarRenovacion(200L, null, List.of(301L), "Buen cliente", 21L);

        assertThat(multa1.getCondonada()).isTrue();
        assertThat(multa1.getCondonadaPor()).isEqualTo(gerente);
        assertThat(multa1.getMotivoCondonacion()).isEqualTo("Buen cliente");
        assertThat(resultado.multasCondonadas()).isEqualByComparingTo(new BigDecimal("100.00"));
    }

    // ────────────────────────────────────────────────────────────────
    // Test 3 — condonación sin motivo lanza excepción
    // ────────────────────────────────────────────────────────────────

    @Test
    void aprobar_conCondonacionSinMotivo_lanzaExcepcion() {
        when(renovacionRepo.findById(200L)).thenReturn(Optional.of(renovacion));
        when(usuarioRepo.findById(21L)).thenReturn(Optional.of(gerente));

        assertThatThrownBy(() -> service.aprobarRenovacion(200L, null, List.of(301L), null, 21L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("motivo");

        assertThatThrownBy(() -> service.aprobarRenovacion(200L, null, List.of(301L), "   ", 21L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("motivo");
    }

    // ────────────────────────────────────────────────────────────────
    // Test 4 — multa de otro crédito lanza excepción
    // ────────────────────────────────────────────────────────────────

    @Test
    void aprobar_multaDeOtroCredito_lanzaExcepcion() {
        Credito otroCreditoId = new Credito();
        otroCreditoId.setId(999L);

        Multa multaAjena = new Multa();
        multaAjena.setId(399L);
        multaAjena.setCredito(otroCreditoId);
        multaAjena.setCobrada(false);
        multaAjena.setCondonada(false);

        when(renovacionRepo.findById(200L)).thenReturn(Optional.of(renovacion));
        when(usuarioRepo.findById(21L)).thenReturn(Optional.of(gerente));
        when(multaRepo.findById(399L)).thenReturn(Optional.of(multaAjena));

        assertThatThrownBy(
                () -> service.aprobarRenovacion(200L, null, List.of(399L), "Motivo válido", 21L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no pertenece");
    }

    // ────────────────────────────────────────────────────────────────
    // Test 5 — multa ya cobrada lanza excepción
    // ────────────────────────────────────────────────────────────────

    @Test
    void aprobar_multaYaCobrada_lanzaExcepcion() {
        multa1.setCobrada(true);

        when(renovacionRepo.findById(200L)).thenReturn(Optional.of(renovacion));
        when(usuarioRepo.findById(21L)).thenReturn(Optional.of(gerente));
        when(multaRepo.findById(301L)).thenReturn(Optional.of(multa1));

        assertThatThrownBy(
                () -> service.aprobarRenovacion(200L, null, List.of(301L), "Motivo válido", 21L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ya fue cobrada");
    }
}
