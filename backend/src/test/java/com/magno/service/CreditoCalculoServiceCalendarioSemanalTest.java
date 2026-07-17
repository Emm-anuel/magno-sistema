package com.magno.service;

import com.magno.model.CalendarioPago;
import com.magno.model.Credito;
import com.magno.repository.CalendarioPagoRepository;
import com.magno.repository.ConfigRangoCreditoRepository;
import com.magno.repository.DiaFestivoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CreditoCalculoServiceCalendarioSemanalTest {
    private DiaFestivoRepository diaFestivoRepo;
    private CreditoCalculoService service;

    @BeforeEach
    void setUp() {
        diaFestivoRepo = mock(DiaFestivoRepository.class);
        CalendarioPagoRepository calendarioRepo = mock(CalendarioPagoRepository.class);
        when(calendarioRepo.save(any(CalendarioPago.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        service = new CreditoCalculoService(diaFestivoRepo, calendarioRepo,
                mock(ConfigRangoCreditoRepository.class));
    }

    @Test
    void conservaElMismoDiaCadaSieteDiasCalendario() {
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of());

        List<CalendarioPago> pagos = service.generarCalendarioSemanal(
                new Credito(), LocalDate.of(2026, 7, 20), 3, calculo(3), 1L);

        assertThat(pagos).extracting(CalendarioPago::getFechaProgramada)
                .containsExactly(LocalDate.of(2026, 7, 20),
                        LocalDate.of(2026, 7, 27), LocalDate.of(2026, 8, 3));
    }

    @Test
    void recorreUnFestivoSinMoverElAnclaDeLaSemanaSiguiente() {
        when(diaFestivoRepo.findFechasBySucursalId(1L))
                .thenReturn(List.of(LocalDate.of(2026, 7, 20)));

        List<CalendarioPago> pagos = service.generarCalendarioSemanal(
                new Credito(), LocalDate.of(2026, 7, 20), 3, calculo(3), 1L);

        assertThat(pagos).extracting(CalendarioPago::getFechaProgramada)
                .containsExactly(LocalDate.of(2026, 7, 21),
                        LocalDate.of(2026, 7, 27), LocalDate.of(2026, 8, 3));
    }

    private CreditoCalculoService.ResumenCalculo calculo(int plazo) {
        return new CreditoCalculoService.ResumenCalculo(
                new BigDecimal("3000.00"), plazo, new BigDecimal("0.40"),
                new BigDecimal("1200.00"), new BigDecimal("4200.00"),
                new BigDecimal("1400.00"), new BigDecimal("1400.00"), BigDecimal.ZERO);
    }
}
