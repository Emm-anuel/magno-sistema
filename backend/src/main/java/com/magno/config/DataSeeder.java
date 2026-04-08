package com.magno.config;

import com.magno.model.Rol;
import com.magno.model.Sucursal;
import com.magno.model.Usuario;
import com.magno.repository.RolRepository;
import com.magno.repository.SucursalRepository;
import com.magno.repository.UsuarioRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.logging.Logger;

/**
 * Seeder idempotente. Inserta datos base solo si no existen.
 * Liquibase ya los crea via V1__init.sql; este seeder es un respaldo de seguridad.
 */
@Component
public class DataSeeder {

    private static final Logger log = Logger.getLogger(DataSeeder.class.getName());

    private final RolRepository rolRepo;
    private final SucursalRepository sucursalRepo;
    private final UsuarioRepository usuarioRepo;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(RolRepository rolRepo,
                      SucursalRepository sucursalRepo,
                      UsuarioRepository usuarioRepo,
                      PasswordEncoder passwordEncoder) {
        this.rolRepo = rolRepo;
        this.sucursalRepo = sucursalRepo;
        this.usuarioRepo = usuarioRepo;
        this.passwordEncoder = passwordEncoder;
    }

    @PostConstruct
    @Transactional
    public void seed() {
        seedRoles();
        seedSucursal();
        seedAdminUser();
    }

    private void seedRoles() {
        List<String> roles = List.of(
                "ADMINISTRADOR", "SUPERVISOR", "SUPERVISOR_CAMPO", "ASESOR_COBRADOR");

        for (String nombre : roles) {
            if (!rolRepo.existsByNombre(nombre)) {
                rolRepo.save(Rol.builder().nombre(nombre).build());
                log.info("Rol creado: " + nombre);
            }
        }
    }

    private void seedSucursal() {
        if (sucursalRepo.count() == 0) {
            sucursalRepo.save(Sucursal.builder()
                    .nombre("Casa Matriz")
                    .multaBase(new BigDecimal("50.00"))
                    .ahorroDiario(new BigDecimal("2000.00"))
                    .activa(true)
                    .build());
            log.info("Sucursal principal creada: Casa Matriz");
        }
    }

    private void seedAdminUser() {
        Rol rolAdmin = rolRepo.findByNombre("ADMINISTRADOR").orElseThrow();
        Sucursal sucursal = sucursalRepo.findAll().get(0);

        usuarioRepo.findByEmail("admin@magno.com").ifPresentOrElse(
                existing -> {
                    // Siempre actualizar el hash en el seeder para garantizar que sea correcto en dev
                    existing.setPasswordHash(passwordEncoder.encode("Admin@2024"));
                    usuarioRepo.save(existing);
                    log.info("Password del admin actualizado");
                },
                () -> {
                    Usuario admin = Usuario.builder()
                            .nombreCompleto("Administrador Sistema")
                            .email("admin@magno.com")
                            .passwordHash(passwordEncoder.encode("Admin@2024"))
                            .telefono("0000000000")
                            .rol(rolAdmin)
                            .sucursal(sucursal)
                            .calle("Calle Principal")
                            .noExterior("1")
                            .colonia("Centro")
                            .municipio("Ciudad")
                            .estado("Estado")
                            .codigoPostal("00000")
                            .ineNumero("0000000000000000000")
                            .ref1Nombre("Referencia Uno")
                            .ref1Telefono("0000000000")
                            .ref1Parentesco("Conocido")
                            .ref2Nombre("Referencia Dos")
                            .ref2Telefono("0000000000")
                            .ref2Parentesco("Conocido")
                            .activo(true)
                            .build();
                    usuarioRepo.save(admin);
                    log.info("Usuario admin creado: admin@magno.com");
                }
        );
    }
}
