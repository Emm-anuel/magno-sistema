package com.magno.service;

import com.magno.dto.dashboard.DashboardPagoRecibidoDTO;
import com.magno.dto.dashboard.DashboardResponseDTO;
import com.magno.model.AbonoCorriente;
import com.magno.model.Cliente;
import com.magno.model.Credito;
import com.magno.model.Pago;
import com.magno.model.Usuario;
import com.magno.repository.AbonoCoberturaDetalleRepository;
import com.magno.repository.AbonoCorrienteRepository;
import com.magno.repository.CalendarioPagoRepository;
import com.magno.repository.ClienteRepository;
import com.magno.repository.ConfigSucursalRepository;
import com.magno.repository.CreditoRepository;
import com.magno.repository.PagoRepository;
import com.magno.repository.RenovacionRepository;
import com.magno.repository.UsuarioRepository;
import com.magno.security.JwtPrincipal;
import com.magno.util.DateTimeUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DashboardServiceTest {

    private PagoRepository pagoRepo;
    private AbonoCorrienteRepository abonoCorrienteRepo;
    private DashboardService service;

    @BeforeEach
    void setUp() {
        pagoRepo = mock(PagoRepository.class);
        abonoCorrienteRepo = mock(AbonoCorrienteRepository.class);
        service = new DashboardService(
                pagoRepo,
                abonoCorrienteRepo,
                mock(AbonoCoberturaDetalleRepository.class),
                mock(CreditoRepository.class),
                mock(RenovacionRepository.class),
                mock(CalendarioPagoRepository.class),
                mock(UsuarioRepository.class),
                mock(ClienteRepository.class),
                mock(ConfigSucursalRepository.class));
    }

    @Test
    void getDashboard_combinaPagosYAbonosDeHoyYLosOrdenaPorRegistro() {
        LocalDate hoy = DateTimeUtils.hoyEnMagno();
        Usuario asesor = Usuario.builder().id(7L).nombreCompleto("Ana Asesora").build();
        Cliente clientePago = Cliente.builder()
                .id(20L)
                .nombre("Luis")
                .apellidoPaterno("Perez")
                .build();
        Cliente clienteAbono = Cliente.builder()
                .id(21L)
                .nombre("Marta")
                .apellidoPaterno("Lopez")
                .build();

        Pago pago = Pago.builder()
                .id(100L)
                .cliente(clientePago)
                .asesor(asesor)
                .fechaPago(hoy)
                .montoRecibido(new BigDecimal("250.00"))
                .createdAt(OffsetDateTime.now(DateTimeUtils.MAGNO_ZONE).minusHours(1))
                .build();
        Credito credito = Credito.builder()
                .id(30L)
                .cliente(clienteAbono)
                .asesor(asesor)
                .build();
        AbonoCorriente abono = AbonoCorriente.builder()
                .id(101L)
                .credito(credito)
                .fecha(hoy)
                .montoTotal(new BigDecimal("400.00"))
                .createdAt(OffsetDateTime.now(DateTimeUtils.MAGNO_ZONE))
                .build();

        when(pagoRepo.findRecibidosByScopeAndFecha(1L, 7L, hoy)).thenReturn(List.of(pago));
        when(abonoCorrienteRepo.findRecibidosByScopeAndFecha(1L, 7L, hoy)).thenReturn(List.of(abono));

        DashboardResponseDTO result = service.getDashboard(
                1L,
                7L,
                hoy.minusDays(7),
                hoy,
                new JwtPrincipal(1L, "admin@magno.mx", "ADMINISTRADOR", 1L));

        assertThat(result.pagosRecibidosHoy()).hasSize(2);
        DashboardPagoRecibidoDTO primero = result.pagosRecibidosHoy().get(0);
        DashboardPagoRecibidoDTO segundo = result.pagosRecibidosHoy().get(1);
        assertThat(primero.tipoMovimiento()).isEqualTo("ABONO_CORRIENTE");
        assertThat(primero.clienteNombre()).isEqualTo("Marta Lopez");
        assertThat(primero.monto()).isEqualByComparingTo("400.00");
        assertThat(segundo.tipoMovimiento()).isEqualTo("PAGO");
        assertThat(segundo.clienteNombre()).isEqualTo("Luis Perez");
        assertThat(segundo.monto()).isEqualByComparingTo("250.00");

        verify(pagoRepo).findRecibidosByScopeAndFecha(1L, 7L, hoy);
        verify(abonoCorrienteRepo).findRecibidosByScopeAndFecha(1L, 7L, hoy);
    }
}
