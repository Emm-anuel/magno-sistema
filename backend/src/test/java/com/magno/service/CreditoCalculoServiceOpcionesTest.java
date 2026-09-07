package com.magno.service;

import com.magno.model.ConfigRangoCredito;
import com.magno.model.TipoPago;
import com.magno.repository.CalendarioPagoRepository;
import com.magno.repository.ConfigRangoCreditoRepository;
import com.magno.repository.DiaFestivoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CreditoCalculoServiceOpcionesTest {

    private ConfigRangoCreditoRepository rangoRepo;
    private CreditoCalculoService service;

    @BeforeEach
    void setUp() {
        rangoRepo = mock(ConfigRangoCreditoRepository.class);
        service = new CreditoCalculoService(
                mock(DiaFestivoRepository.class),
                mock(CalendarioPagoRepository.class),
                rangoRepo);
    }

    @Test
    void ofreceTodosLosPlazosCuandoCincuentaMilComparteLimite() {
        when(rangoRepo.findBySucursalIdAndTipoPagoOrderByRangoMinAsc(1L, "SEMANAL"))
                .thenReturn(List.of(
                        rango("30000", "50000", 12, "0.40"),
                        rango("50000", "60000", 16, "0.35")));

        var opciones = service.calcularOpciones(new BigDecimal("50000"), 1L, TipoPago.SEMANAL);

        assertThat(opciones).extracting(opcion -> opcion.producto().plazo())
                .containsExactly(12, 16);
        assertThat(opciones).extracting(opcion -> opcion.calculo().capital())
                .containsOnly(new BigDecimal("50000"));
    }

    @Test
    void calculaConElPlazoElegidoEnUnLimiteCompartido() {
        when(rangoRepo.findBySucursalIdAndTipoPagoOrderByRangoMinAsc(1L, "SEMANAL"))
                .thenReturn(List.of(
                        rango("30000", "50000", 12, "0.40"),
                        rango("50000", "60000", 16, "0.35")));

        var calculo = service.calcularCreditoSemanal(new BigDecimal("50000"), 1L, 16);

        assertThat(calculo.plazo()).isEqualTo(16);
        assertThat(calculo.tasa()).isEqualByComparingTo("0.35");
        assertThat(calculo.pagoPeriodico()).isEqualByComparingTo("4219");
    }

    @Test
    void exigeElegirPlazoCuandoHayAlternativasDistintas() {
        when(rangoRepo.findBySucursalIdAndTipoPagoOrderByRangoMinAsc(1L, "DIARIO"))
                .thenReturn(List.of(
                        rango("20000", "50000", 25, "0.24"),
                        rango("50000", "70000", 30, "0.22")));

        assertThatThrownBy(() -> service.calcularCredito(new BigDecimal("50000"), 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Selecciona el plazo");
    }

    private ConfigRangoCredito rango(String minimo, String maximo, int plazo, String tasa) {
        return ConfigRangoCredito.builder()
                .sucursalId(1L)
                .tipoPago("SEMANAL")
                .rangoMin(new BigDecimal(minimo))
                .rangoMax(new BigDecimal(maximo))
                .plazo(plazo)
                .tasaInteres(new BigDecimal(tasa))
                .build();
    }
}
