package com.magno.service;

import com.magno.model.ConfigSucursal;
import com.magno.repository.*;
import com.magno.util.DateTimeUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class NominaCajaServiceTest {

    private ConfigSucursalRepository configSucursalRepo;
    private DiaFestivoRepository diaFestivoRepo;
    private CajaDiaRepository cajaDiaRepo;
    private NominaCajaService service;

    @BeforeEach
    void setUp() {
        configSucursalRepo = mock(ConfigSucursalRepository.class);
        diaFestivoRepo = mock(DiaFestivoRepository.class);
        cajaDiaRepo = mock(CajaDiaRepository.class);
        service = new NominaCajaService(
                cajaDiaRepo,
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

        LocalDate hoy = DateTimeUtils.hoyEnMagno();
        LocalDate lunes = hoy.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate jueves = lunes.plusDays(3);
        if (jueves.isBefore(hoy)) {
            jueves = jueves.plusWeeks(1);
        }
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of(jueves));

        LocalDate resultado = service.calcularDiaEfectivo(1L);
        assertThat(resultado).isEqualTo(jueves.minusDays(1));
    }

    @Test
    void calcularDiaEfectivo_sinConfig_usaJuevesComoDefault() {
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.empty());
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of());

        LocalDate resultado = service.calcularDiaEfectivo(1L);
        assertThat(resultado.getDayOfWeek()).isEqualTo(DayOfWeek.THURSDAY);
    }

    @Test
    void calcularDiaEfectivo_cuandoLunesEsFestivo_ajustaASiguienteFechaNoPasada() {
        ConfigSucursal config = new ConfigSucursal();
        config.setDiaPagoNomina("LUNES");
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));

        LocalDate hoy = DateTimeUtils.hoyEnMagno();
        LocalDate lunes = hoy.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        if (lunes.isBefore(hoy)) {
            lunes = lunes.plusWeeks(1);
        }
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of(lunes));

        LocalDate resultado = service.calcularDiaEfectivo(1L);
        LocalDate viernesAjustado = lunes.minusDays(3);
        LocalDate esperado = viernesAjustado.isBefore(hoy) ? lunes.plusWeeks(1) : viernesAjustado;
        assertThat(resultado).isEqualTo(esperado);
    }

    @Test
    void calcularDiaEfectivo_conLunesConfigurado_nuncaDevuelveFechaPasada() {
        ConfigSucursal config = new ConfigSucursal();
        config.setDiaPagoNomina("LUNES");
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of());

        LocalDate hoy = DateTimeUtils.hoyEnMagno();
        LocalDate resultado = service.calcularDiaEfectivo(1L);

        assertThat(resultado.getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
        assertThat(resultado).isAfterOrEqualTo(hoy);
    }

    @Test
    void calcularDiaEfectivo_conMiercolesAcentuado_parseoCorrectamente() {
        ConfigSucursal config = new ConfigSucursal();
        config.setDiaPagoNomina("MIÉRCOLES");
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of());

        LocalDate resultado = service.calcularDiaEfectivo(1L);
        assertThat(resultado.getDayOfWeek()).isEqualTo(DayOfWeek.WEDNESDAY);
    }

    @Test
    void calcularDiaEfectivo_conDiaDesconocido_lanzaExcepcion() {
        ConfigSucursal config = new ConfigSucursal();
        config.setDiaPagoNomina("DOMINGO");
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of());

        assertThatThrownBy(() -> service.calcularDiaEfectivo(1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("DOMINGO");
    }

    @Test
    void registrarPago_cuandoCajaNoEstaAbierta_lanzaExcepcion() {
        com.magno.model.CajaDia caja = mock(com.magno.model.CajaDia.class);
        when(caja.getEstado()).thenReturn(com.magno.model.EstadoCaja.CERRADA);
        when(cajaDiaRepo.findById(1L)).thenReturn(Optional.of(caja));

        assertThatThrownBy(() -> service.registrarPago(1L, 99L))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
