package com.magno.service;

import com.magno.model.ConfigSucursal;
import com.magno.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class NominaCajaServiceTest {

    private ConfigSucursalRepository configSucursalRepo;
    private DiaFestivoRepository diaFestivoRepo;
    private NominaCajaService service;

    @BeforeEach
    void setUp() {
        configSucursalRepo = mock(ConfigSucursalRepository.class);
        diaFestivoRepo = mock(DiaFestivoRepository.class);
        service = new NominaCajaService(
                mock(CajaDiaRepository.class),
                mock(NominaPagoRepository.class),
                mock(NominaPersonalRepository.class),
                configSucursalRepo,
                diaFestivoRepo,
                mock(UsuarioRepository.class));
    }

    @Test
    void calcularDiaEfectivo_cuandoDiaEsHabil_devuelveEseDia() {
        ConfigSucursal config = new ConfigSucursal();
        config.setDiaPagoNomina("JUEVES");
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of());

        LocalDate resultado = service.calcularDiaEfectivo(1L);
        assertThat(resultado.getDayOfWeek()).isEqualTo(DayOfWeek.THURSDAY);
    }

    @Test
    void calcularDiaEfectivo_cuandoJuevesEsFestivo_devuelveMiercoles() {
        ConfigSucursal config = new ConfigSucursal();
        config.setDiaPagoNomina("JUEVES");
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));

        LocalDate lunes = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate jueves = lunes.plusDays(3);
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of(jueves));

        LocalDate resultado = service.calcularDiaEfectivo(1L);
        assertThat(resultado.getDayOfWeek()).isEqualTo(DayOfWeek.WEDNESDAY);
    }
}
