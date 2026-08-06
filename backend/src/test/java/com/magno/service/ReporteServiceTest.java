package com.magno.service;

import com.magno.dto.reporte.AsesorResumenDTO;
import com.magno.dto.reporte.ReporteCarteraDTO;
import com.magno.dto.reporte.ReporteIngresosEgresosDTO;
import com.magno.dto.reporte.ReportePorAsesorDTO;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.util.DateTimeUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ReporteServiceTest {

        private CajaDiaRepository cajaDiaRepo;
        private CajaMovimientoInversionRepository movimientoRepo;
        private CreditoRepository creditoRepo;
        private PagoRepository pagoRepo;
        private MultaRepository multaRepo;
        private CalendarioPagoRepository calendarioRepo;
        private RenovacionRepository renovacionRepo;
        private UsuarioRepository usuarioRepo;
        private SucursalRepository sucursalRepo;
        private GastoRepository gastoRepo;
        private ClienteRepository clienteRepo;
        private AbonoCorrienteRepository abonoCorrienteRepo;
        private ReporteService service;

        @BeforeEach
        void setUp() {
                cajaDiaRepo = mock(CajaDiaRepository.class);
                movimientoRepo = mock(CajaMovimientoInversionRepository.class);
                creditoRepo = mock(CreditoRepository.class);
                pagoRepo = mock(PagoRepository.class);
                multaRepo = mock(MultaRepository.class);
                calendarioRepo = mock(CalendarioPagoRepository.class);
                renovacionRepo = mock(RenovacionRepository.class);
                usuarioRepo = mock(UsuarioRepository.class);
                sucursalRepo = mock(SucursalRepository.class);
                gastoRepo = mock(GastoRepository.class);
                clienteRepo = mock(ClienteRepository.class);
                abonoCorrienteRepo = mock(AbonoCorrienteRepository.class);
                service = new ReporteService(
                                cajaDiaRepo, movimientoRepo, creditoRepo,
                                pagoRepo, multaRepo, calendarioRepo,
                                renovacionRepo, usuarioRepo, sucursalRepo, gastoRepo, clienteRepo,
                                abonoCorrienteRepo);
        }

        @Test
        void getIngresosEgresos_sinDias_retornaDTO_conCeros() {
                when(cajaDiaRepo.findBySucursalAndFechaRange(1L,
                                LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30)))
                                .thenReturn(List.of());
                for (int day = 1; day <= 30; day++) {
                        when(pagoRepo.sumIngresoBySucursalAndFecha(1L, LocalDate.of(2026, 4, day)))
                                        .thenReturn(BigDecimal.ZERO);
                }

                ReporteIngresosEgresosDTO result = service.getIngresosEgresos(1L,
                                LocalDate.of(2026, 4, 1),
                                LocalDate.of(2026, 4, 30));

                assertThat(result.filas()).isEmpty();
                assertThat(result.totalMontoApertura()).isEqualByComparingTo(BigDecimal.ZERO);
                assertThat(result.totalIngresoCarteras()).isEqualByComparingTo(BigDecimal.ZERO);
                assertThat(result.totalDesembolsos()).isEqualByComparingTo(BigDecimal.ZERO);
                assertThat(result.totalGastos()).isEqualByComparingTo(BigDecimal.ZERO);
                assertThat(result.subtotalNeto()).isEqualByComparingTo(BigDecimal.ZERO);
        }

        @Test
        void getIngresosEgresos_conDias_sumaCorrectamente() {
                CajaDia dia1 = cajaDia(1L, LocalDate.of(2026, 4, 7),
                                new BigDecimal("1000.00"), new BigDecimal("500.00"),
                                new BigDecimal("100.00"), new BigDecimal("800.00"));
                CajaDia dia2 = cajaDia(2L, LocalDate.of(2026, 4, 8),
                                new BigDecimal("2000.00"), new BigDecimal("800.00"),
                                new BigDecimal("150.00"), new BigDecimal("1100.00"));

                when(cajaDiaRepo.findBySucursalAndFechaRange(1L,
                                LocalDate.of(2026, 4, 7), LocalDate.of(2026, 4, 8)))
                                .thenReturn(List.of(dia1, dia2));
                when(pagoRepo.sumIngresoBySucursalAndFecha(1L, LocalDate.of(2026, 4, 7)))
                                .thenReturn(new BigDecimal("1000.00"));
                when(pagoRepo.sumIngresoBySucursalAndFecha(1L, LocalDate.of(2026, 4, 8)))
                                .thenReturn(new BigDecimal("2000.00"));
                when(movimientoRepo.sumMontoByCajaDiaId(1L)).thenReturn(BigDecimal.ZERO);
                when(movimientoRepo.sumMontoByCajaDiaId(2L)).thenReturn(BigDecimal.ZERO);

                ReporteIngresosEgresosDTO result = service.getIngresosEgresos(1L,
                                LocalDate.of(2026, 4, 7),
                                LocalDate.of(2026, 4, 8));

                assertThat(result.filas()).hasSize(2);
                assertThat(result.totalMontoApertura()).isEqualByComparingTo("750.00");
                assertThat(result.filas().get(0).montoApertura()).isEqualByComparingTo("500.00");
                assertThat(result.totalIngresoCarteras()).isEqualByComparingTo("3000.00");
                assertThat(result.totalDesembolsos()).isEqualByComparingTo("1300.00");
                assertThat(result.totalGastos()).isEqualByComparingTo("250.00");
                assertThat(result.subtotalNeto()).isEqualByComparingTo("1450.00");
        }

        @Test
        void getIngresosEgresos_conCobrosSinCaja_incluyeIngresoDelDia() {
                LocalDate fecha = LocalDate.of(2026, 4, 9);
                when(cajaDiaRepo.findBySucursalAndFechaRange(1L, fecha, fecha))
                                .thenReturn(List.of());
                when(pagoRepo.sumIngresoBySucursalAndFecha(1L, fecha))
                                .thenReturn(new BigDecimal("750.00"));

                ReporteIngresosEgresosDTO result = service.getIngresosEgresos(1L, fecha, fecha);

                assertThat(result.filas()).hasSize(1);
                assertThat(result.filas().get(0).fecha()).isEqualTo(fecha);
                assertThat(result.filas().get(0).montoApertura()).isEqualByComparingTo(BigDecimal.ZERO);
                assertThat(result.filas().get(0).ingresoCarteras()).isEqualByComparingTo("750.00");
                assertThat(result.totalMontoApertura()).isEqualByComparingTo(BigDecimal.ZERO);
                assertThat(result.totalIngresoCarteras()).isEqualByComparingTo("750.00");
                assertThat(result.subtotalNeto()).isEqualByComparingTo("750.00");
        }

        @Test
        void getIngresosEgresos_incluyeAbonosDePagarAdeudoEnElIngresoDelDia() {
                LocalDate fecha = LocalDate.of(2026, 4, 9);
                when(cajaDiaRepo.findBySucursalAndFechaRange(1L, fecha, fecha))
                                .thenReturn(List.of());
                when(pagoRepo.sumIngresoBySucursalAndFecha(1L, fecha))
                                .thenReturn(new BigDecimal("750.00"));
                when(abonoCorrienteRepo.sumMontoTotalBySucursalAndFecha(1L, fecha))
                                .thenReturn(new BigDecimal("300.00"));

                ReporteIngresosEgresosDTO result = service.getIngresosEgresos(1L, fecha, fecha);

                assertThat(result.filas().get(0).ingresoCarteras()).isEqualByComparingTo("1050.00");
                assertThat(result.totalIngresoCarteras()).isEqualByComparingTo("1050.00");
        }

        @Test
        void getCartera_enMora_filtraCorrectamente() {
                Credito creditoSano = credito(10L, new BigDecimal("5000.00"), new BigDecimal("260.00"), 25);
                Credito creditoMora = credito(11L, new BigDecimal("3000.00"), new BigDecimal("156.00"), 25);

                when(creditoRepo.findActivosBySucursalAndAsesor(1L, null))
                                .thenReturn(List.of(creditoSano, creditoMora));

                LocalDate hoy = DateTimeUtils.hoyEnMagno();

                when(calendarioRepo.countAtrasadosByCreditoId(10L, hoy)).thenReturn(0L);
                when(calendarioRepo.countRealizadosByCreditoId(10L)).thenReturn(10L);
                when(multaRepo.sumMontosPendientesByCreditoId(10L)).thenReturn(BigDecimal.ZERO);

                when(calendarioRepo.countAtrasadosByCreditoId(11L, hoy)).thenReturn(2L);
                when(calendarioRepo.countRealizadosByCreditoId(11L)).thenReturn(8L);
                when(multaRepo.sumMontosPendientesByCreditoId(11L)).thenReturn(new BigDecimal("100.00"));

                ReporteCarteraDTO result = service.getCartera(1L, null, "EN_MORA");

                assertThat(result.creditos()).hasSize(1);
                assertThat(result.creditos().get(0).creditoId()).isEqualTo(11L);
                assertThat(result.creditos().get(0).enMora()).isTrue();
                assertThat(result.creditosEnMora()).isEqualTo(1);
                assertThat(result.totalCreditosActivos()).isEqualTo(2);
        }

        @Test
        void getPorAsesor_conUnAsesor_retornaResumenCorrecto() {
                Usuario asesor = usuario(5L, "ASESOR_COBRADOR", "Juan Pérez");
                Credito credito = credito(20L, new BigDecimal("4000.00"), new BigDecimal("208.00"), 25);

                when(usuarioRepo.findBySucursalId(1L)).thenReturn(List.of(asesor));
                when(creditoRepo.findActivosBySucursalAndAsesor(1L, 5L))
                                .thenReturn(List.of(credito));

                LocalDate desde = LocalDate.of(2026, 4, 1);
                LocalDate hasta = LocalDate.of(2026, 4, 30);
                LocalDate hoy = DateTimeUtils.hoyEnMagno();

                when(pagoRepo.countByAsesorAndFechaRange(5L, desde, hasta)).thenReturn(15L);
                when(pagoRepo.sumMontoCobradoByAsesorAndFechaRange(5L, desde, hasta))
                                .thenReturn(new BigDecimal("3120.00"));
                when(multaRepo.sumMultasCobradaByAsesorAndFechaRange(5L, desde, hasta))
                                .thenReturn(BigDecimal.ZERO);
                when(pagoRepo.countIncompletosByAsesorAndFechaRange(5L, desde, hasta)).thenReturn(1L);

                when(calendarioRepo.countAtrasadosByCreditoId(20L, hoy)).thenReturn(0L);
                when(calendarioRepo.countRealizadosByCreditoId(20L)).thenReturn(10L);
                when(multaRepo.sumMontosPendientesByCreditoId(20L)).thenReturn(BigDecimal.ZERO);

                ReportePorAsesorDTO result = service.getPorAsesor(1L, desde, hasta, null);

                assertThat(result.asesores()).hasSize(1);
                AsesorResumenDTO resumen = result.asesores().get(0);
                assertThat(resumen.asesorNombre()).isEqualTo("Juan Pérez");
                assertThat(resumen.cobrosRegistrados()).isEqualTo(15L);
                assertThat(resumen.montoCobrado()).isEqualByComparingTo("3120.00");
                assertThat(resumen.clientesActivos()).isEqualTo(1);
                assertThat(result.totalClientesActivos()).isEqualTo(1);
        }

        @Test
        void getPorAsesor_sumaAbonosDePagarAdeudoAlMontoCobrado() {
                Usuario asesor = usuario(5L, "ASESOR_COBRADOR", "Juan Pérez");
                Credito credito = credito(20L, new BigDecimal("4000.00"), new BigDecimal("208.00"), 25);

                when(usuarioRepo.findBySucursalId(1L)).thenReturn(List.of(asesor));
                when(creditoRepo.findActivosBySucursalAndAsesor(1L, 5L))
                                .thenReturn(List.of(credito));

                LocalDate desde = LocalDate.of(2026, 4, 1);
                LocalDate hasta = LocalDate.of(2026, 4, 30);
                LocalDate hoy = DateTimeUtils.hoyEnMagno();

                when(pagoRepo.countByAsesorAndFechaRange(5L, desde, hasta)).thenReturn(15L);
                when(pagoRepo.sumMontoCobradoByAsesorAndFechaRange(5L, desde, hasta))
                                .thenReturn(new BigDecimal("3120.00"));
                when(abonoCorrienteRepo.sumMontoTotalByScopeAndFechaRange(null, 5L, desde, hasta))
                                .thenReturn(new BigDecimal("450.00"));
                when(multaRepo.sumMultasCobradaByAsesorAndFechaRange(5L, desde, hasta))
                                .thenReturn(BigDecimal.ZERO);
                when(pagoRepo.countIncompletosByAsesorAndFechaRange(5L, desde, hasta)).thenReturn(1L);

                when(calendarioRepo.countAtrasadosByCreditoId(20L, hoy)).thenReturn(0L);
                when(calendarioRepo.countRealizadosByCreditoId(20L)).thenReturn(10L);
                when(multaRepo.sumMontosPendientesByCreditoId(20L)).thenReturn(BigDecimal.ZERO);

                ReportePorAsesorDTO result = service.getPorAsesor(1L, desde, hasta, null);

                assertThat(result.asesores().get(0).montoCobrado()).isEqualByComparingTo("3570.00");
        }

        private CajaDia cajaDia(Long id, LocalDate fecha,
                        BigDecimal ingresoCarteras, BigDecimal desembolsos,
                        BigDecimal totalGastos, BigDecimal subtotalCaja) {
                CajaDia cd = new CajaDia();
                cd.setId(id);
                cd.setFecha(fecha);
                cd.setMontoApertura(id == 1L ? new BigDecimal("500.00") : new BigDecimal("250.00"));
                cd.setIngresoCarteras(ingresoCarteras);
                cd.setDesembolsos(desembolsos);
                cd.setTotalGastos(totalGastos);
                cd.setSubtotalCaja(subtotalCaja);
                cd.setEstado(EstadoCaja.CERRADA);
                return cd;
        }

        private Credito credito(Long id, BigDecimal montoCapital,
                        BigDecimal pagoPeriodico, int plazoDias) {
                Cliente cliente = new Cliente();
                cliente.setNombre("Test");
                cliente.setApellidoPaterno("Cliente");

                Usuario asesor = new Usuario();
                asesor.setNombreCompleto("Asesor Test");

                Credito c = new Credito();
                c.setId(id);
                c.setMontoCapital(montoCapital);
                c.setPagoPeriodico(pagoPeriodico);
                c.setPlazoDias(plazoDias);
                c.setEstado(EstadoCredito.ACTIVO);
                c.setCliente(cliente);
                c.setAsesor(asesor);
                return c;
        }

        private Usuario usuario(Long id, String rol, String nombre) {
                Rol rolObj = new Rol();
                rolObj.setNombre(rol);

                Usuario u = new Usuario();
                u.setId(id);
                u.setNombreCompleto(nombre);
                u.setRol(rolObj);
                return u;
        }
}
