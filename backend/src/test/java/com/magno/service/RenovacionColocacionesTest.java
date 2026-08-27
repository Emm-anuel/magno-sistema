package com.magno.service;

import com.magno.dto.renovacion.ColocacionItemDTO;
import com.magno.model.*;
import com.magno.repository.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RenovacionColocacionesTest {

    private RenovacionRepository renovacionRepo;
    private CreditoRepository creditoRepo;

    private RenovacionService service;

    private Sucursal sucursal;

    @BeforeEach
    void setUp() {
        renovacionRepo = mock(RenovacionRepository.class);
        creditoRepo = mock(CreditoRepository.class);
        CalendarioPagoRepository calendarioPagoRepo = mock(CalendarioPagoRepository.class);
        MultaRepository multaRepo = mock(MultaRepository.class);
        UsuarioRepository usuarioRepo = mock(UsuarioRepository.class);
        CreditoCalculoService calculoService = mock(CreditoCalculoService.class);
        ConfigUmbralRenovacionRepository configUmbralRepo = mock(ConfigUmbralRenovacionRepository.class);
        RenovacionElegibilidadService renovacionElegibilidadService =
                new RenovacionElegibilidadService(configUmbralRepo);

        service = new RenovacionService(
                renovacionRepo,
                creditoRepo,
                calendarioPagoRepo,
                multaRepo,
                usuarioRepo,
                calculoService,
                renovacionElegibilidadService,
                mock(SaldoCuotaService.class));

        sucursal = new Sucursal();
        sucursal.setId(1L);
        sucursal.setNombre("Magno Plata (Malinalco)");
    }

    private Usuario asesor() {
        Usuario asesor = new Usuario();
        asesor.setId(20L);
        asesor.setNombreCompleto("Marcial Hernandez Bacilio");
        asesor.setSucursal(sucursal);
        return asesor;
    }

    private Cliente cliente(long id, String nombre) {
        Cliente cliente = new Cliente();
        cliente.setId(id);
        cliente.setNombre(nombre);
        cliente.setApellidoPaterno("Pliego");
        cliente.setApellidoMaterno("Millán");
        cliente.setCelular("5568977572");
        return cliente;
    }

    @Test
    void getColocaciones_incluyeSucursalNombre_paraCreditosNuevos() {
        Cliente cliente = cliente(10L, "María");
        Credito creditoNuevo = new Credito();
        creditoNuevo.setId(4L);
        creditoNuevo.setCliente(cliente);
        creditoNuevo.setAsesor(asesor());
        creditoNuevo.setSucursal(sucursal);
        creditoNuevo.setMontoCapital(new BigDecimal("3000.00"));
        creditoNuevo.setPagoAdelantado(new BigDecimal("156.00"));
        creditoNuevo.setTipoPago(TipoPago.DIARIO);
        creditoNuevo.setFechaInicio(LocalDate.of(2026, 7, 13));
        creditoNuevo.setFechaDesembolso(OffsetDateTime.parse("2026-07-13T20:00:00-06:00"));

        when(renovacionRepo.findColocaciones(any(), any(), any(), any())).thenReturn(List.of());
        when(creditoRepo.findColocacionesNuevos(any(), any(), any(), any()))
                .thenReturn(List.of(creditoNuevo));

        var resultado = service.getColocaciones(LocalDate.of(2026, 7, 13), null, null);

        assertThat(resultado.items()).hasSize(1);
        ColocacionItemDTO item = resultado.items().get(0);
        assertThat(item.sucursalNombre()).isEqualTo("Magno Plata (Malinalco)");
        assertThat(item.tipo()).isEqualTo("NUEVO");
    }

    @Test
    void getColocaciones_incluyeSucursalNombre_paraRenovaciones() {
        Cliente cliente = cliente(11L, "Lucia");
        Credito creditoAnterior = new Credito();
        creditoAnterior.setId(200L);
        creditoAnterior.setCliente(cliente);
        creditoAnterior.setSucursal(sucursal);
        creditoAnterior.setMontoCapital(new BigDecimal("4000.00"));

        Credito creditoNuevo = new Credito();
        creditoNuevo.setId(201L);
        creditoNuevo.setCliente(cliente);
        creditoNuevo.setSucursal(sucursal);
        creditoNuevo.setMontoCapital(new BigDecimal("5000.00"));
        creditoNuevo.setTipoPago(TipoPago.DIARIO);

        Renovacion renovacion = new Renovacion();
        renovacion.setId(300L);
        renovacion.setCliente(cliente);
        renovacion.setAsesor(asesor());
        renovacion.setCreditoAnterior(creditoAnterior);
        renovacion.setCreditoNuevo(creditoNuevo);
        renovacion.setFecha(LocalDate.of(2026, 7, 13));
        renovacion.setMontoDesembolso(new BigDecimal("1000.00"));

        when(renovacionRepo.findColocaciones(any(), any(), any(), any())).thenReturn(List.of(renovacion));
        when(creditoRepo.findColocacionesNuevos(any(), any(), any(), any())).thenReturn(List.of());

        var resultado = service.getColocaciones(LocalDate.of(2026, 7, 13), null, null);

        assertThat(resultado.items()).hasSize(1);
        ColocacionItemDTO item = resultado.items().get(0);
        assertThat(item.sucursalNombre()).isEqualTo("Magno Plata (Malinalco)");
        assertThat(item.tipo()).isEqualTo("RENOVACION");
    }
}
