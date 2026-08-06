package com.magno.service;

import com.magno.dto.usuario.UsuarioDTO;
import com.magno.dto.usuario.UsuarioUpdateRequest;
import com.magno.model.Rol;
import com.magno.model.Sucursal;
import com.magno.model.Usuario;
import com.magno.repository.RolRepository;
import com.magno.repository.SucursalRepository;
import com.magno.repository.UsuarioRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class UsuarioServiceTest {

    private UsuarioRepository usuarioRepo;
    private RolRepository rolRepo;
    private SucursalRepository sucursalRepo;
    private PasswordEncoder passwordEncoder;
    private FileService fileService;
    private UsuarioService service;

    private Sucursal home;
    private Sucursal adicional1;
    private Sucursal adicional2;
    private Rol rolSupervisorCampo;
    private Rol rolAdministrador;
    private Usuario supervisorCampo;

    private static final Long USUARIO_ID = 1L;

    @BeforeEach
    void setUp() {
        usuarioRepo = mock(UsuarioRepository.class);
        rolRepo = mock(RolRepository.class);
        sucursalRepo = mock(SucursalRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        fileService = mock(FileService.class);
        service = new UsuarioService(usuarioRepo, rolRepo, sucursalRepo, passwordEncoder, fileService);

        home = new Sucursal();
        home.setId(1L);
        home.setNombre("Home");

        adicional1 = new Sucursal();
        adicional1.setId(2L);
        adicional1.setNombre("Adicional 1");

        adicional2 = new Sucursal();
        adicional2.setId(3L);
        adicional2.setNombre("Adicional 2");

        rolSupervisorCampo = new Rol();
        rolSupervisorCampo.setNombre("SUPERVISOR_CAMPO");

        rolAdministrador = new Rol();
        rolAdministrador.setNombre("ADMINISTRADOR");

        supervisorCampo = new Usuario();
        supervisorCampo.setId(USUARIO_ID);
        supervisorCampo.setRol(rolSupervisorCampo);
        supervisorCampo.setSucursal(home);
        supervisorCampo.setSucursalesAdicionales(new HashSet<>());

        when(usuarioRepo.findById(USUARIO_ID)).thenReturn(Optional.of(supervisorCampo));
    }

    @Test
    void setSucursalesAdicionales_happyPath_asignaYDevuelveLista() {
        when(sucursalRepo.findAllById(List.of(2L, 3L))).thenReturn(List.of(adicional1, adicional2));

        List<UsuarioDTO.SucursalInfo> resultado = service.setSucursalesAdicionales(USUARIO_ID, List.of(2L, 3L));

        assertThat(resultado).extracting(UsuarioDTO.SucursalInfo::id).containsExactlyInAnyOrder(2L, 3L);
        verify(usuarioRepo).save(supervisorCampo);
    }

    @Test
    void setSucursalesAdicionales_conIdsDuplicados_noRechazaComoInexistentes() {
        when(sucursalRepo.findAllById(List.of(2L, 2L))).thenReturn(List.of(adicional1));

        List<UsuarioDTO.SucursalInfo> resultado = service.setSucursalesAdicionales(USUARIO_ID, List.of(2L, 2L));

        assertThat(resultado).extracting(UsuarioDTO.SucursalInfo::id).containsExactly(2L);
    }

    @Test
    void setSucursalesAdicionales_usuarioNoEsSupervisorCampo_lanza400() {
        Usuario admin = new Usuario();
        admin.setId(2L);
        admin.setRol(rolAdministrador);
        admin.setSucursal(home);
        when(usuarioRepo.findById(2L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> service.setSucursalesAdicionales(2L, List.of(2L)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void setSucursalesAdicionales_incluyeSucursalHome_lanza400() {
        assertThatThrownBy(() -> service.setSucursalesAdicionales(USUARIO_ID, List.of(1L)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void setSucursalesAdicionales_sucursalNoExiste_lanza404() {
        when(sucursalRepo.findAllById(List.of(99L))).thenReturn(List.of());

        assertThatThrownBy(() -> service.setSucursalesAdicionales(USUARIO_ID, List.of(99L)))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void getSucursalesAdicionales_devuelveLasAsignadas() {
        supervisorCampo.setSucursalesAdicionales(new HashSet<>(List.of(adicional1)));

        List<UsuarioDTO.SucursalInfo> resultado = service.getSucursalesAdicionales(USUARIO_ID);

        assertThat(resultado).extracting(UsuarioDTO.SucursalInfo::id).containsExactly(2L);
    }

    @Test
    void actualizar_cambiaRolFueraDeSupervisorCampo_limpiaSucursalesAdicionales() {
        supervisorCampo.setSucursalesAdicionales(new HashSet<>(List.of(adicional1)));
        when(rolRepo.findByNombre("ADMINISTRADOR")).thenReturn(Optional.of(rolAdministrador));
        when(sucursalRepo.findById(1L)).thenReturn(Optional.of(home));
        when(usuarioRepo.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        service.actualizar(USUARIO_ID, usuarioUpdateRequest("ADMINISTRADOR", 1L));

        assertThat(supervisorCampo.getSucursalesAdicionales()).isEmpty();
    }

    @Test
    void actualizar_mantieneRolSupervisorCampo_noTocaSucursalesAdicionales() {
        supervisorCampo.setSucursalesAdicionales(new HashSet<>(List.of(adicional1)));
        when(rolRepo.findByNombre("SUPERVISOR_CAMPO")).thenReturn(Optional.of(rolSupervisorCampo));
        when(sucursalRepo.findById(1L)).thenReturn(Optional.of(home));
        when(usuarioRepo.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

        service.actualizar(USUARIO_ID, usuarioUpdateRequest("SUPERVISOR_CAMPO", 1L));

        assertThat(supervisorCampo.getSucursalesAdicionales()).containsExactly(adicional1);
    }

    private UsuarioUpdateRequest usuarioUpdateRequest(String rol, Long sucursalId) {
        return new UsuarioUpdateRequest(
                "Nombre Test",
                "5555555555",
                LocalDate.of(1990, 1, 1),
                LocalDate.of(2020, 1, 1),
                rol,
                sucursalId,
                "Calle Test",
                "10",
                null,
                "Colonia Test",
                "Municipio Test",
                "Estado Test",
                "12345",
                "INE123",
                "http://test/ine.jpg",
                "http://test/ine-reverso.jpg",
                "Ref1 Nombre",
                "5551111111",
                "Padre",
                "Ref2 Nombre",
                "5552222222",
                "Madre",
                null
        );
    }
}
