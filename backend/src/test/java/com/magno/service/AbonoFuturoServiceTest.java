package com.magno.service;

import com.magno.model.CalendarioPago;
import com.magno.model.Credito;
import com.magno.model.EstadoCalendarioPago;
import com.magno.repository.CalendarioPagoRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AbonoFuturoServiceTest {

    private CalendarioPagoRepository calendarioPagoRepo;
    private AbonoFuturoService service;
    private Credito credito;

    @BeforeEach
    void setUp() {
        calendarioPagoRepo = mock(CalendarioPagoRepository.class);
        service = new AbonoFuturoService(calendarioPagoRepo);

        credito = new Credito();
        credito.setId(100L);
    }

    private CalendarioPago futuro(long id, int numeroPago, LocalDate fecha, String monto) {
        CalendarioPago cp = new CalendarioPago();
        cp.setId(id);
        cp.setNumeroPago(numeroPago);
        cp.setFechaProgramada(fecha);
        cp.setMontoEsperado(new BigDecimal(monto));
        cp.setEstado(EstadoCalendarioPago.PENDIENTE);
        return cp;
    }

    @Test
    void cubreVariosDiasFuturosCompletosEnOrdenYDejaElRestoSinTocar() {
        LocalDate hoy = LocalDate.of(2026, 8, 6);
        List<CalendarioPago> futuros = List.of(
                futuro(1L, 9, hoy.plusDays(1), "700.00"),
                futuro(2L, 10, hoy.plusDays(2), "700.00"),
                futuro(3L, 11, hoy.plusDays(3), "700.00"));
        when(calendarioPagoRepo.findByCreditoIdAndEstadoOrderByNumeroPagoAsc(100L, EstadoCalendarioPago.PENDIENTE))
                .thenReturn(futuros);

        var resultado = service.adelantarDiasFuturos(credito, new BigDecimal("1500.00"), hoy);

        assertThat(resultado.coberturas()).hasSize(2);
        assertThat(resultado.saldoRestante()).isEqualByComparingTo("100.00");
        assertThat(futuros.get(0).getEstado()).isEqualTo(EstadoCalendarioPago.ADELANTADO);
        assertThat(futuros.get(1).getEstado()).isEqualTo(EstadoCalendarioPago.ADELANTADO);
        assertThat(futuros.get(2).getEstado()).isEqualTo(EstadoCalendarioPago.PENDIENTE);
        verify(calendarioPagoRepo, times(2)).save(any());
    }

    @Test
    void noCubreParcialmenteUnDiaFuturo() {
        LocalDate hoy = LocalDate.of(2026, 8, 6);
        CalendarioPago dia = futuro(1L, 9, hoy.plusDays(1), "700.00");
        when(calendarioPagoRepo.findByCreditoIdAndEstadoOrderByNumeroPagoAsc(100L, EstadoCalendarioPago.PENDIENTE))
                .thenReturn(List.of(dia));

        var resultado = service.adelantarDiasFuturos(credito, new BigDecimal("500.00"), hoy);

        assertThat(resultado.coberturas()).isEmpty();
        assertThat(resultado.saldoRestante()).isEqualByComparingTo("500.00");
        assertThat(dia.getEstado()).isEqualTo(EstadoCalendarioPago.PENDIENTE);
        verify(calendarioPagoRepo, never()).save(any());
    }

    @Test
    void ignoraDiasQueNoSonEstrictamenteFuturosRespectoAFechaOperacion() {
        LocalDate hoy = LocalDate.of(2026, 8, 6);
        CalendarioPago diaHoy = futuro(1L, 9, hoy, "700.00");
        when(calendarioPagoRepo.findByCreditoIdAndEstadoOrderByNumeroPagoAsc(100L, EstadoCalendarioPago.PENDIENTE))
                .thenReturn(List.of(diaHoy));

        var resultado = service.adelantarDiasFuturos(credito, new BigDecimal("1000.00"), hoy);

        assertThat(resultado.coberturas()).isEmpty();
        assertThat(resultado.saldoRestante()).isEqualByComparingTo("1000.00");
    }

    @Test
    void saldoCeroNoConsultaElRepositorio() {
        var resultado = service.adelantarDiasFuturos(credito, BigDecimal.ZERO, LocalDate.of(2026, 8, 6));

        assertThat(resultado.coberturas()).isEmpty();
        assertThat(resultado.saldoRestante()).isEqualByComparingTo(BigDecimal.ZERO);
        verifyNoInteractions(calendarioPagoRepo);
    }
}
