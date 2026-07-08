package com.magno.service;

import com.magno.model.ConfigUmbralRenovacion;
import com.magno.model.Credito;
import com.magno.model.EstadoCredito;
import com.magno.model.Sucursal;
import com.magno.model.TipoPago;
import com.magno.repository.ConfigUmbralRenovacionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RenovacionElegibilidadServiceTest {

    private ConfigUmbralRenovacionRepository configUmbralRepo;
    private RenovacionElegibilidadService service;

    @BeforeEach
    void setUp() {
        configUmbralRepo = mock(ConfigUmbralRenovacionRepository.class);
        service = new RenovacionElegibilidadService(configUmbralRepo);
    }

    @Test
    void resolverUmbral_usaConfiguracionPorSucursalTipoYPlazo() {
        Credito credito = credito(1L, TipoPago.DIARIO, 30, EstadoCredito.ACTIVO);
        when(configUmbralRepo.findBySucursalIdAndTipoPagoAndPlazo(1L, "DIARIO", 30))
                .thenReturn(Optional.of(ConfigUmbralRenovacion.builder()
                        .sucursalId(1L)
                        .tipoPago("DIARIO")
                        .plazo(30)
                        .umbralPagos(12)
                        .build()));

        assertThat(service.resolverUmbral(credito)).isEqualTo(12);
        assertThat(service.esElegible(credito, 11)).isFalse();
        assertThat(service.esElegible(credito, 12)).isTrue();
    }

    @Test
    void resolverUmbral_usaDefaultsCuandoNoHayConfiguracion() {
        when(configUmbralRepo.findBySucursalIdAndTipoPagoAndPlazo(1L, "DIARIO", 25))
                .thenReturn(Optional.empty());
        when(configUmbralRepo.findBySucursalIdAndTipoPagoAndPlazo(1L, "SEMANAL", 12))
                .thenReturn(Optional.empty());

        assertThat(service.resolverUmbral(credito(1L, TipoPago.DIARIO, 25, EstadoCredito.ACTIVO))).isEqualTo(16);
        assertThat(service.resolverUmbral(credito(1L, TipoPago.SEMANAL, 12, EstadoCredito.ACTIVO))).isEqualTo(9);
    }

    private Credito credito(Long sucursalId, TipoPago tipoPago, int plazo, EstadoCredito estado) {
        Sucursal sucursal = new Sucursal();
        sucursal.setId(sucursalId);

        Credito credito = new Credito();
        credito.setSucursal(sucursal);
        credito.setTipoPago(tipoPago);
        credito.setPlazoDias(plazo);
        credito.setEstado(estado);
        return credito;
    }
}
