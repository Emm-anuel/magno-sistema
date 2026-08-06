package com.magno.service;

import com.magno.dto.usuario.PasswordChangeRequest;
import com.magno.dto.usuario.UsuarioCreateRequest;
import com.magno.dto.usuario.UsuarioDTO;
import com.magno.dto.usuario.UsuarioUpdateRequest;
import com.magno.model.Rol;
import com.magno.model.Sucursal;
import com.magno.model.Usuario;
import com.magno.repository.RolRepository;
import com.magno.repository.SucursalRepository;
import com.magno.repository.UsuarioRepository;
import jakarta.persistence.EntityNotFoundException;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UsuarioService {

    private final UsuarioRepository usuarioRepo;
    private final RolRepository rolRepo;
    private final SucursalRepository sucursalRepo;
    private final PasswordEncoder passwordEncoder;
    private final FileService fileService;

    public UsuarioService(UsuarioRepository usuarioRepo,
                          RolRepository rolRepo,
                          SucursalRepository sucursalRepo,
                          PasswordEncoder passwordEncoder,
                          FileService fileService) {
        this.usuarioRepo = usuarioRepo;
        this.rolRepo = rolRepo;
        this.sucursalRepo = sucursalRepo;
        this.passwordEncoder = passwordEncoder;
        this.fileService = fileService;
    }

    /** Listado paginado con filtros opcionales. */
    public Page<UsuarioDTO> listar(String rol, Long sucursalId, Boolean activo, Pageable pageable) {
        Specification<Usuario> spec = Specification.where(null);

        if (rol != null && !rol.isBlank()) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("rol").get("nombre"), rol));
        }
        if (sucursalId != null) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("sucursal").get("id"), sucursalId));
        }
        if (activo != null) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("activo"), activo));
        }

        return usuarioRepo.findAll(spec, pageable).map(UsuarioDTO::from);
    }

    /** Obtiene un usuario por ID. */
    public UsuarioDTO obtener(Long id) {
        return usuarioRepo.findById(id)
                .map(UsuarioDTO::from)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + id));
    }

    /** Crea un nuevo usuario. Solo ADMINISTRADOR puede llamar esto. */
    @Transactional
    public UsuarioDTO crear(UsuarioCreateRequest req, String emailCreador) {
        if (usuarioRepo.existsByEmail(req.email())) {
            throw new IllegalArgumentException("El correo ya está registrado: " + req.email());
        }

        Rol rol = rolRepo.findByNombre(req.rol())
                .orElseThrow(() -> new EntityNotFoundException("Rol no encontrado: " + req.rol()));

        Sucursal sucursal = sucursalRepo.findById(req.sucursalId())
                .orElseThrow(() -> new EntityNotFoundException("Sucursal no encontrada: " + req.sucursalId()));

        Usuario creador = usuarioRepo.findByEmail(emailCreador).orElse(null);

        Usuario nuevo = Usuario.builder()
                .nombreCompleto(req.nombreCompleto())
                .email(req.email())
                .passwordHash(passwordEncoder.encode(req.password()))
                .telefono(req.telefono())
                .rol(rol)
                .sucursal(sucursal)
                .calle(req.calle())
                .noExterior(req.noExterior())
                .noInterior(req.noInterior())
                .colonia(req.colonia())
                .municipio(req.municipio())
                .estado(req.estado())
                .codigoPostal(req.codigoPostal())
                .ineNumero(req.ineNumero())
                .ineImagenUrl(req.ineImagenUrl())
                .ineImagenReversoUrl(req.ineImagenReversoUrl())
                .ref1Nombre(req.ref1Nombre())
                .ref1Telefono(req.ref1Telefono())
                .ref1Parentesco(req.ref1Parentesco())
                .ref2Nombre(req.ref2Nombre())
                .ref2Telefono(req.ref2Telefono())
                .ref2Parentesco(req.ref2Parentesco())
                .activo(true)
                .createdBy(creador)
                .build();

        return UsuarioDTO.from(usuarioRepo.save(nuevo));
    }

    /** Actualiza los campos editables de un usuario. */
    @Transactional
    public UsuarioDTO actualizar(Long id, UsuarioUpdateRequest req) {
        Usuario u = usuarioRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + id));

        Rol rol = rolRepo.findByNombre(req.rol())
                .orElseThrow(() -> new EntityNotFoundException("Rol no encontrado: " + req.rol()));

        Sucursal sucursal = sucursalRepo.findById(req.sucursalId())
                .orElseThrow(() -> new EntityNotFoundException("Sucursal no encontrada: " + req.sucursalId()));

        // Delete old INE image from S3 if a new one is provided
        String oldIneUrl = u.getIneImagenUrl();
        String newIneUrl = req.ineImagenUrl();
        if (newIneUrl != null && !newIneUrl.isBlank()
                && !newIneUrl.equals(oldIneUrl)) {
            fileService.deleteFile(oldIneUrl);
        }

        String oldIneReversoUrl = u.getIneImagenReversoUrl();
        String newIneReversoUrl = req.ineImagenReversoUrl();
        if (newIneReversoUrl != null && !newIneReversoUrl.isBlank()
                && !newIneReversoUrl.equals(oldIneReversoUrl)) {
            fileService.deleteFile(oldIneReversoUrl);
        }

        u.setNombreCompleto(req.nombreCompleto());
        u.setTelefono(req.telefono());
        u.setRol(rol);
        if (!"SUPERVISOR_CAMPO".equals(rol.getNombre())) {
            u.getSucursalesAdicionales().clear();
        }
        u.setSucursal(sucursal);
        u.setCalle(req.calle());
        u.setNoExterior(req.noExterior());
        u.setNoInterior(req.noInterior());
        u.setColonia(req.colonia());
        u.setMunicipio(req.municipio());
        u.setEstado(req.estado());
        u.setCodigoPostal(req.codigoPostal());
        u.setIneNumero(req.ineNumero());
        u.setIneImagenUrl(req.ineImagenUrl());
        u.setIneImagenReversoUrl(req.ineImagenReversoUrl());
        u.setRef1Nombre(req.ref1Nombre());
        u.setRef1Telefono(req.ref1Telefono());
        u.setRef1Parentesco(req.ref1Parentesco());
        u.setRef2Nombre(req.ref2Nombre());
        u.setRef2Telefono(req.ref2Telefono());
        u.setRef2Parentesco(req.ref2Parentesco());

        if (req.password() != null && !req.password().isBlank()) {
            u.setPasswordHash(passwordEncoder.encode(req.password()));
        }

        return UsuarioDTO.from(usuarioRepo.save(u));
    }

    /** Permite a cualquier usuario autenticado cambiar su propia contraseña. */
    @Transactional
    public void cambiarMiPassword(String email, PasswordChangeRequest req) {
        Usuario u = usuarioRepo.findByEmail(email)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado"));

        if (!passwordEncoder.matches(req.passwordActual(), u.getPasswordHash())) {
            throw new IllegalArgumentException("La contraseña actual es incorrecta");
        }

        u.setPasswordHash(passwordEncoder.encode(req.passwordNuevo()));
        usuarioRepo.save(u);
    }

    /** Activa o desactiva un usuario. */
    @Transactional
    public UsuarioDTO cambiarEstado(Long id, boolean activo) {
        Usuario u = usuarioRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + id));
        u.setActivo(activo);
        return UsuarioDTO.from(usuarioRepo.save(u));
    }

    /** Lista las sucursales adicionales asignadas a un usuario Supervisor. */
    public List<UsuarioDTO.SucursalInfo> getSucursalesAdicionales(Long usuarioId) {
        Usuario u = usuarioRepo.findById(usuarioId)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + usuarioId));
        return u.getSucursalesAdicionales().stream()
                .map(UsuarioDTO.SucursalInfo::from)
                .toList();
    }

    /**
     * Reemplaza el conjunto completo de sucursales adicionales de un usuario Supervisor.
     * Solo aplica a SUPERVISOR_CAMPO — es el único rol para el que este flujo está expuesto
     * en el admin (ver spec: docs/superpowers/specs/2026-08-06-supervisor-multi-sucursal-design.md).
     */
    @Transactional
    public List<UsuarioDTO.SucursalInfo> setSucursalesAdicionales(Long usuarioId, java.util.List<Long> sucursalIds) {
        Usuario u = usuarioRepo.findById(usuarioId)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + usuarioId));

        if (!"SUPERVISOR_CAMPO".equals(u.getRol().getNombre())) {
            throw new IllegalArgumentException(
                    "Solo se pueden asignar sucursales adicionales a usuarios con rol Supervisor");
        }
        if (sucursalIds.contains(u.getSucursal().getId())) {
            throw new IllegalArgumentException(
                    "La sucursal home del usuario no debe incluirse en sucursales adicionales");
        }

        java.util.List<Sucursal> sucursales = sucursalRepo.findAllById(sucursalIds);
        if (sucursales.size() != new java.util.HashSet<>(sucursalIds).size()) {
            throw new EntityNotFoundException("Una o más sucursales no existen");
        }

        u.setSucursalesAdicionales(new java.util.HashSet<>(sucursales));
        usuarioRepo.save(u);

        return sucursales.stream()
                .map(UsuarioDTO.SucursalInfo::from)
                .toList();
    }
}
