package com.magno.service;

import com.magno.dto.cliente.ClienteCoincidenciaDTO;
import com.magno.dto.cliente.ClienteCreateRequest;
import com.magno.dto.cliente.ClienteUpdateRequest;
import com.magno.model.Cliente;
import com.magno.model.Credito;
import com.magno.model.EstadoCredito;
import com.magno.model.Rol;
import com.magno.model.Sucursal;
import com.magno.model.Usuario;
import com.magno.repository.ClienteDocumentoRepository;
import com.magno.repository.ClienteRepository;
import com.magno.repository.CreditoRepository;
import com.magno.repository.SucursalRepository;
import com.magno.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.AdditionalAnswers.returnsFirstArg;

class ClienteServiceTest {

    private ClienteRepository clienteRepo;
    private CreditoRepository creditoRepo;
    private UsuarioRepository usuarioRepo;
    private SucursalRepository sucursalRepo;
    private ClienteService service;
    private Cliente existente;

    @BeforeEach
    void setUp() {
        clienteRepo = mock(ClienteRepository.class);
        creditoRepo = mock(CreditoRepository.class);
        usuarioRepo = mock(UsuarioRepository.class);
        sucursalRepo = mock(SucursalRepository.class);
        service = new ClienteService(clienteRepo, creditoRepo, usuarioRepo, sucursalRepo,
                mock(ClienteDocumentoRepository.class));

        Sucursal sucursal = new Sucursal();
        sucursal.setId(1L);
        sucursal.setNombre("Centro");
        Usuario asesor = new Usuario();
        asesor.setId(7L);
        asesor.setNombreCompleto("Asesor Existente");
        Rol rol = new Rol();
        rol.setNombre("ASESOR_COBRADOR");
        asesor.setRol(rol);

        existente = Cliente.builder()
                .id(25L)
                .numeroCliente("CLI-0025")
                .nombre("María")
                .apellidoPaterno("López")
                .apellidoMaterno("Soto")
                .fechaNacimiento(LocalDate.of(1990, 5, 20))
                .celular("5512345678")
                .curp("losm900520mdfpta01")
                .ineNumero("INE-998877")
                .asesor(asesor)
                .sucursal(sucursal)
                .activo(true)
                .build();
    }

    @Test
    void buscarPosiblesDuplicados_devuelveRegistroYMotivosDeCoincidencia() {
        when(clienteRepo.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(existente)));
        when(clienteRepo.tieneCredito(25L)).thenReturn(true);

        List<ClienteCoincidenciaDTO> result = service.buscarPosiblesDuplicados(
                "María", "López", LocalDate.of(1990, 5, 20),
                "5512345678", "LOSM900520MDFPTA01", "INE-998877");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(25L);
        assertThat(result.get(0).numeroCliente()).isEqualTo("CLI-0025");
        assertThat(result.get(0).coincidencias())
                .containsExactly("CURP", "celular", "INE", "nombre y fecha de nacimiento");
        assertThat(result.get(0).tieneCreditoActivo()).isTrue();
    }

    @Test
    void crearCliente_conCoincidencia_noGuardaDuplicado() {
        ClienteCreateRequest request = mock(ClienteCreateRequest.class);
        when(request.nombre()).thenReturn("María");
        when(request.apellidoPaterno()).thenReturn("López");
        when(request.fechaNacimiento()).thenReturn(LocalDate.of(1990, 5, 20));
        when(request.celular()).thenReturn("5512345678");
        when(request.curp()).thenReturn("LOSM900520MDFPTA01");
        when(request.ineNumero()).thenReturn("INE-998877");
        when(request.sucursalId()).thenReturn(1L);
        when(request.asesorId()).thenReturn(null);
        when(sucursalRepo.findByIdForUpdate(1L)).thenReturn(Optional.of(existente.getSucursal()));
        when(clienteRepo.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(existente)));

        assertThatThrownBy(() -> service.crearCliente(request, 99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Ya existe un cliente con esos datos")
                .hasMessageContaining("Utiliza el registro existente");

        verify(clienteRepo, never()).save(any(Cliente.class));
    }

    @Test
    void actualizarCliente_normalizaCurpYRfcAMayusculas() {
        ClienteUpdateRequest request = mock(ClienteUpdateRequest.class);
        when(request.curp()).thenReturn("losm900520mdfpta01");
        when(request.rfc()).thenReturn("losm900520ab1");
        when(request.sucursalId()).thenReturn(null);
        when(request.asesorId()).thenReturn(null);
        when(clienteRepo.findById(25L)).thenReturn(Optional.of(existente));
        when(clienteRepo.existsByCurpIgnoreCaseAndIdNot("LOSM900520MDFPTA01", 25L)).thenReturn(false);
        when(clienteRepo.save(any(Cliente.class))).then(returnsFirstArg());

        service.actualizarCliente(25L, request);

        assertThat(existente.getCurp()).isEqualTo("LOSM900520MDFPTA01");
        assertThat(existente.getRfc()).isEqualTo("LOSM900520AB1");
    }

    @Test
    void actualizarCliente_alCambiarAsesor_transfiereLosCreditosActivos() {
        ClienteUpdateRequest request = mock(ClienteUpdateRequest.class);
        Usuario asesorNuevo = new Usuario();
        asesorNuevo.setId(11L);
        asesorNuevo.setNombreCompleto("Asesor Nuevo");
        asesorNuevo.setRol(existente.getAsesor().getRol());
        Credito creditoActivo = Credito.builder()
                .id(40L)
                .cliente(existente)
                .asesor(existente.getAsesor())
                .estado(EstadoCredito.ACTIVO)
                .build();

        when(request.asesorId()).thenReturn(11L);
        when(request.sucursalId()).thenReturn(null);
        when(clienteRepo.findById(25L)).thenReturn(Optional.of(existente));
        when(usuarioRepo.findById(11L)).thenReturn(Optional.of(asesorNuevo));
        when(creditoRepo.findByClienteIdAndEstadoAndDeletedAtIsNull(25L, EstadoCredito.ACTIVO))
                .thenReturn(List.of(creditoActivo));
        when(clienteRepo.save(any(Cliente.class))).then(returnsFirstArg());

        service.actualizarCliente(25L, request);

        assertThat(existente.getAsesor()).isSameAs(asesorNuevo);
        assertThat(creditoActivo.getAsesor()).isSameAs(asesorNuevo);
        verify(creditoRepo).saveAll(List.of(creditoActivo));
    }
}
