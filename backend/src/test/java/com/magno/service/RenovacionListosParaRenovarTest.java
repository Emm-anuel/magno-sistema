package com.magno.service;

import com.magno.model.Cliente;
import com.magno.model.ConfigUmbralRenovacion;
import com.magno.model.Credito;
import com.magno.model.EstadoCredito;
import com.magno.model.EstadoRenovacion;
import com.magno.model.Sucursal;
import com.magno.model.TipoPago;
import com.magno.model.Usuario;
import com.magno.repository.CalendarioPagoRepository;
import com.magno.repository.ConfigUmbralRenovacionRepository;
import com.magno.repository.CreditoRepository;
import com.magno.repository.MultaRepository;
import com.magno.repository.RenovacionRepository;
import com.magno.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RenovacionListosParaRenovarTest {

    private RenovacionRepository renovacionRepo;
    private CreditoRepository creditoRepo;
    private CalendarioPagoRepository calendarioPagoRepo;
    private MultaRepository multaRepo;
    private ConfigUmbralRenovacionRepository configUmbralRepo;
    private RenovacionService service;

    @BeforeEach
    void setUp() {
        renovacionRepo = mock(RenovacionRepository.class);
        creditoRepo = mock(CreditoRepository.class);
        calendarioPagoRepo = mock(CalendarioPagoRepository.class);
        multaRepo = mock(MultaRepository.class);
        UsuarioRepository usuarioRepo = mock(UsuarioRepository.class);
        CreditoCalculoService calculoService = mock(CreditoCalculoService.class);
        configUmbralRepo = mock(ConfigUmbralRenovacionRepository.class);

        service = new RenovacionService(
                renovacionRepo,
                creditoRepo,
                calendarioPagoRepo,
                multaRepo,
                usuarioRepo,
                calculoService,
                new RenovacionElegibilidadService(configUmbralRepo));
    }

    @Test
    void getListosParaRenovar_usaUmbralConfigurado() {
        Credito credito = creditoActivoDiario30();
        when(creditoRepo.findActivosParaEvaluarRenovacion(null, null)).thenReturn(List.of(credito));
        when(calendarioPagoRepo.countByCreditoIdAndEstadoIn(100L, RenovacionElegibilidadService.ESTADOS_REALIZADOS))
                .thenReturn(12L);
        when(configUmbralRepo.findBySucursalIdAndTipoPagoAndPlazo(1L, "DIARIO", 30))
                .thenReturn(Optional.of(ConfigUmbralRenovacion.builder()
                        .sucursalId(1L)
                        .tipoPago("DIARIO")
                        .plazo(30)
                        .umbralPagos(12)
                        .build()));
        when(renovacionRepo.existsByCreditoAnteriorIdAndEstadoAndDeletedAtIsNull(
                100L, EstadoRenovacion.SOLICITADO)).thenReturn(false);
        when(multaRepo.sumMontosPendientesByCreditoId(100L)).thenReturn(BigDecimal.ZERO);

        var listos = service.getListosParaRenovar(null, null);

        assertThat(listos).hasSize(1);
        assertThat(listos.get(0).creditoId()).isEqualTo(100L);
    }

    @Test
    void getListosParaRenovar_excluyeSiNoAlcanzaUmbralConfigurado() {
        Credito credito = creditoActivoDiario30();
        when(creditoRepo.findActivosParaEvaluarRenovacion(null, null)).thenReturn(List.of(credito));
        when(calendarioPagoRepo.countByCreditoIdAndEstadoIn(100L, RenovacionElegibilidadService.ESTADOS_REALIZADOS))
                .thenReturn(11L);
        when(configUmbralRepo.findBySucursalIdAndTipoPagoAndPlazo(1L, "DIARIO", 30))
                .thenReturn(Optional.of(ConfigUmbralRenovacion.builder()
                        .sucursalId(1L)
                        .tipoPago("DIARIO")
                        .plazo(30)
                        .umbralPagos(12)
                        .build()));

        assertThat(service.getListosParaRenovar(null, null)).isEmpty();
    }

    private Credito creditoActivoDiario30() {
        Sucursal sucursal = new Sucursal();
        sucursal.setId(1L);
        sucursal.setNombre("Centro");

        Cliente cliente = new Cliente();
        cliente.setId(10L);
        cliente.setNombre("Ana");
        cliente.setApellidoPaterno("Garcia");

        Usuario asesor = new Usuario();
        asesor.setId(20L);
        asesor.setNombreCompleto("Carlos Asesor");

        Credito credito = new Credito();
        credito.setId(100L);
        credito.setCliente(cliente);
        credito.setAsesor(asesor);
        credito.setSucursal(sucursal);
        credito.setEstado(EstadoCredito.ACTIVO);
        credito.setMontoCapital(BigDecimal.valueOf(10000));
        credito.setPlazoDias(30);
        credito.setPagoPeriodico(BigDecimal.valueOf(500));
        credito.setTipoPago(TipoPago.DIARIO);
        return credito;
    }
}
