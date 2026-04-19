package com.magno.config;

import com.magno.model.*;
import com.magno.repository.*;
import com.magno.service.CreditoCalculoService;
import com.magno.service.CreditoCalculoService.ResumenCalculo;
import com.magno.util.DateTimeUtils;
import jakarta.annotation.PostConstruct;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.logging.Logger;

/**
 * Seeder idempotente. Inserta datos base solo si no existen.
 * Liquibase ya los crea via V1__init.sql; este seeder es un respaldo de
 * seguridad.
 */
@Component
@Profile("dev")
public class DataSeeder {

    private static final Logger log = Logger.getLogger(DataSeeder.class.getName());

    private final RolRepository rolRepo;
    private final SucursalRepository sucursalRepo;
    private final UsuarioRepository usuarioRepo;
    private final ClienteRepository clienteRepo;
    private final CreditoRepository creditoRepo;
    private final CalendarioPagoRepository calendarioPagoRepo;
    private final PagoRepository pagoRepo;
    private final MultaRepository multaRepo;
    private final CreditoCalculoService calculoService;
    private final PasswordEncoder passwordEncoder;

    public DataSeeder(RolRepository rolRepo,
            SucursalRepository sucursalRepo,
            UsuarioRepository usuarioRepo,
            ClienteRepository clienteRepo,
            CreditoRepository creditoRepo,
            CalendarioPagoRepository calendarioPagoRepo,
            PagoRepository pagoRepo,
            MultaRepository multaRepo,
            CreditoCalculoService calculoService,
            PasswordEncoder passwordEncoder) {
        this.rolRepo = rolRepo;
        this.sucursalRepo = sucursalRepo;
        this.usuarioRepo = usuarioRepo;
        this.clienteRepo = clienteRepo;
        this.creditoRepo = creditoRepo;
        this.calendarioPagoRepo = calendarioPagoRepo;
        this.pagoRepo = pagoRepo;
        this.multaRepo = multaRepo;
        this.calculoService = calculoService;
        this.passwordEncoder = passwordEncoder;
    }

    @PostConstruct
    @Transactional
    public void seed() {
        seedRoles();
        seedSucursal();
        seedAdminUser();
        seedAsesor();
        seedClientes();
        seedCreditos();
        seedPagosDePrueba();
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
                    // Siempre actualizar el hash en el seeder para garantizar que sea correcto en
                    // dev
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
                });
    }

    private void seedAsesor() {
        if (usuarioRepo.findByEmail("asesor1@magno.com").isEmpty()) {
            Rol rolAsesor = rolRepo.findByNombre("ASESOR_COBRADOR").orElseThrow();
            Sucursal sucursal = sucursalRepo.findAll().get(0);

            usuarioRepo.save(Usuario.builder()
                    .nombreCompleto("Carlos Ramírez López")
                    .email("asesor1@magno.com")
                    .passwordHash(passwordEncoder.encode("Asesor@2024"))
                    .telefono("5512345678")
                    .rol(rolAsesor)
                    .sucursal(sucursal)
                    .calle("Av. Insurgentes")
                    .noExterior("250")
                    .colonia("Doctores")
                    .municipio("Cuauhtémoc")
                    .estado("Ciudad de México")
                    .codigoPostal("06720")
                    .ineNumero("RAML850315HDFMPZ07")
                    .ref1Nombre("Miguel Ángel Torres")
                    .ref1Telefono("5587654321")
                    .ref1Parentesco("Hermano")
                    .ref2Nombre("Lucía González")
                    .ref2Telefono("5523456789")
                    .ref2Parentesco("Compañero de trabajo")
                    .activo(true)
                    .build());
            log.info("Asesor de prueba creado: asesor1@magno.com");
        }
    }

    private void seedClientes() {
        if (clienteRepo.count() > 0) {
            log.info("Clientes ya existen, omitiendo seeder");
            return;
        }

        Sucursal sucursal = sucursalRepo.findAll().get(0);
        Usuario asesor = usuarioRepo.findByEmail("asesor1@magno.com")
                .orElse(usuarioRepo.findByEmail("admin@magno.com").orElse(null));

        List<Cliente> clientes = List.of(
                Cliente.builder()
                        .nombre("Rosa").apellidoPaterno("Garcés").apellidoMaterno("Santana")
                        .fechaNacimiento(LocalDate.of(1985, 3, 12))
                        .estadoCivil("CASADO").celular("5534567890")
                        .ineNumero("GASA850312MDFRNZ09").curp("GASA850312MDFRNZ09")
                        .domCalle("Calle Morelos").domNoExterior("14").domColonia("San Juan")
                        .domMunicipio("Iztapalapa").domEstado("Ciudad de México").domCodigoPostal("09830")
                        .negocioNombre("Tortillería La Rosa").negocioGiro("Alimentos")
                        .negocioAntiguedad("8 años")
                        .ingresosSemanales(new BigDecimal("3500.00"))
                        .ref1Nombre("Ana Santana").ref1Telefono("5534567800").ref1Parentesco("Madre")
                        .ref2Nombre("Pedro Garcés").ref2Telefono("5534567801").ref2Parentesco("Hermano")
                        .asesor(asesor).sucursal(sucursal).activo(true)
                        .build(),

                Cliente.builder()
                        .nombre("María Elena").apellidoPaterno("López").apellidoMaterno("Hernández")
                        .fechaNacimiento(LocalDate.of(1978, 7, 25))
                        .estadoCivil("SOLTERO").celular("5545678901")
                        .ineNumero("LOHM780725MDFPNR05").curp("LOHM780725MDFPNR05")
                        .domCalle("Av. Tláhuac").domNoExterior("320").domColonia("Los Ángeles")
                        .domMunicipio("Tláhuac").domEstado("Ciudad de México").domCodigoPostal("13010")
                        .negocioNombre("Papelería y Copias Maru").negocioGiro("Papelería")
                        .negocioAntiguedad("12 años")
                        .ingresosSemanales(new BigDecimal("4200.00"))
                        .ref1Nombre("Juan López").ref1Telefono("5545678900").ref1Parentesco("Padre")
                        .ref2Nombre("Carmen Flores").ref2Telefono("5545678902").ref2Parentesco("Amiga")
                        .asesor(asesor).sucursal(sucursal).activo(true)
                        .build(),

                Cliente.builder()
                        .nombre("Jorge").apellidoPaterno("Mendoza").apellidoMaterno("Reyes")
                        .fechaNacimiento(LocalDate.of(1990, 11, 8))
                        .estadoCivil("CASADO").celular("5556789012")
                        .ineNumero("MERJ901108HDFNYR02").curp("MERJ901108HDFNYR02")
                        .domCalle("Calle Hidalgo").domNoExterior("7").domColonia("Centro")
                        .domMunicipio("Xochimilco").domEstado("Ciudad de México").domCodigoPostal("16000")
                        .negocioNombre("Ferretería El Clavo").negocioGiro("Ferretería")
                        .negocioAntiguedad("5 años")
                        .ingresosSemanales(new BigDecimal("6000.00"))
                        .ref1Nombre("Sofía Reyes").ref1Telefono("5556789010").ref1Parentesco("Esposa")
                        .ref2Nombre("Roberto Mendoza").ref2Telefono("5556789011").ref2Parentesco("Hermano")
                        .asesor(asesor).sucursal(sucursal).activo(true)
                        .build(),

                Cliente.builder()
                        .nombre("Guadalupe").apellidoPaterno("Torres").apellidoMaterno("Vázquez")
                        .fechaNacimiento(LocalDate.of(1982, 5, 30))
                        .estadoCivil("UNION_LIBRE").celular("5567890123")
                        .ineNumero("TOVG820530MDFRZD08").curp("TOVG820530MDFRZD08")
                        .domCalle("Calle Juárez").domNoExterior("45").domNoInterior("2B")
                        .domColonia("Pedregal de Santo Domingo").domMunicipio("Coyoacán")
                        .domEstado("Ciudad de México").domCodigoPostal("04369")
                        .negocioNombre("Cosméticos Lupe").negocioGiro("Belleza y cosméticos")
                        .negocioAntiguedad("6 años")
                        .ingresosSemanales(new BigDecimal("2800.00"))
                        .ref1Nombre("Patricia Vázquez").ref1Telefono("5567890120").ref1Parentesco("Madre")
                        .ref2Nombre("Ricardo Castro").ref2Telefono("5567890121").ref2Parentesco("Pareja")
                        .asesor(asesor).sucursal(sucursal).activo(true)
                        .build(),

                Cliente.builder()
                        .nombre("Francisco").apellidoPaterno("Jiménez").apellidoMaterno("Cruz")
                        .fechaNacimiento(LocalDate.of(1975, 9, 15))
                        .estadoCivil("CASADO").celular("5578901234")
                        .ineNumero("JICF750915HDFRMR06").curp("JICF750915HDFRMR06")
                        .domCalle("Calz. de la Viga").domNoExterior("180").domColonia("El Rodeo")
                        .domMunicipio("Iztacalco").domEstado("Ciudad de México").domCodigoPostal("08820")
                        .negocioNombre("Taquería El Güero").negocioGiro("Alimentos")
                        .negocioAntiguedad("15 años")
                        .ingresosSemanales(new BigDecimal("9000.00"))
                        .ref1Nombre("Elena Cruz").ref1Telefono("5578901230").ref1Parentesco("Esposa")
                        .ref2Nombre("Antonio Jiménez").ref2Telefono("5578901231").ref2Parentesco("Padre")
                        .asesor(asesor).sucursal(sucursal).activo(true)
                        .build());

        clienteRepo.saveAll(clientes);
        log.info("5 clientes de prueba creados");
    }

    private void seedCreditos() {
        if (creditoRepo.count() > 0) {
            log.info("Créditos ya existen, omitiendo seeder");
            return;
        }

        List<Cliente> clientes = clienteRepo.findAll();
        if (clientes.size() < 3) {
            log.info("No hay suficientes clientes para seeder de créditos");
            return;
        }

        Sucursal sucursal = sucursalRepo.findAll().get(0);
        Usuario asesor = usuarioRepo.findByEmail("asesor1@magno.com")
                .orElse(usuarioRepo.findAll().get(0));
        Usuario admin = usuarioRepo.findByEmail("admin@magno.com")
                .orElse(usuarioRepo.findAll().get(0));

        // ── Crédito 1: $2,000 ACTIVO, calendario desde hace 30 días ──────────
        ResumenCalculo c1 = calculoService.calcularCredito(new BigDecimal("2000.00"));

        Credito credito1 = Credito.builder()
                .cliente(clientes.get(0))
                .asesor(asesor)
                .sucursal(sucursal)
                .montoSolicitado(c1.capital())
                .montoCapital(c1.capital())
                .tasaInteres(c1.tasa())
                .cargoFinanciero(c1.cargoFinanciero())
                .totalAPagar(c1.totalAPagar())
                .pagoPeriodico(c1.pagoPeriodico())
                .plazoDias(c1.plazo())
                .tipoPago(TipoPago.DIARIO)
                .pagoAdelantado(c1.pagoAdelantado())
                .estado(EstadoCredito.APROBADO) // necesita APROBADO antes de activar
                .montoAprobado(c1.capital())
                .fechaAprobacion(DateTimeUtils.ahoraEnMagno().minusDays(31))
                .aprobadoPor(admin)
                .createdBy(admin)
                .build();
        creditoRepo.save(credito1);

        // Generar calendario desde hace 30 días y marcar primeros pagos
        java.time.LocalDate fechaInicio1 = DateTimeUtils.hoyEnMagno().minusDays(30);
        calculoService.generarCalendario(credito1, fechaInicio1, c1.plazo(), c1, sucursal.getId());

        credito1.setFechaInicio(fechaInicio1);
        credito1.setFechaDesembolso(DateTimeUtils.ahoraEnMagno().minusDays(30));
        credito1.setEstado(EstadoCredito.ACTIVO);
        creditoRepo.save(credito1);

        // Marcar pago #1 como ADELANTADO ya está hecho por generarCalendario.
        // Marcar pagos #2 a #10 como PAGADO.
        List<CalendarioPago> pagos1 = calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(credito1.getId());
        for (CalendarioPago cp : pagos1) {
            if (cp.getNumeroPago() >= 2 && cp.getNumeroPago() <= 10) {
                cp.setEstado(EstadoCalendarioPago.PAGADO);
                calendarioPagoRepo.save(cp);
            }
        }
        log.info("Crédito 1 creado: $2,000 ACTIVO — " + pagos1.size() + " pagos generados");

        // ── Crédito 2: $8,000 SOLICITADO ─────────────────────────────────────
        ResumenCalculo c2 = calculoService.calcularCredito(new BigDecimal("8000.00"));

        Credito credito2 = Credito.builder()
                .cliente(clientes.get(1))
                .asesor(asesor)
                .sucursal(sucursal)
                .montoSolicitado(c2.capital())
                .montoCapital(c2.capital())
                .tasaInteres(c2.tasa())
                .cargoFinanciero(c2.cargoFinanciero())
                .totalAPagar(c2.totalAPagar())
                .pagoPeriodico(c2.pagoPeriodico())
                .plazoDias(c2.plazo())
                .tipoPago(TipoPago.DIARIO)
                .pagoAdelantado(c2.pagoAdelantado())
                .estado(EstadoCredito.SOLICITADO)
                .createdBy(asesor)
                .build();
        creditoRepo.save(credito2);
        log.info("Crédito 2 creado: $8,000 SOLICITADO");

        // ── Crédito 3: $20,000 APROBADO ──────────────────────────────────────
        ResumenCalculo c3 = calculoService.calcularCredito(new BigDecimal("20000.00"));

        Credito credito3 = Credito.builder()
                .cliente(clientes.get(2))
                .asesor(asesor)
                .sucursal(sucursal)
                .montoSolicitado(c3.capital())
                .montoCapital(c3.capital())
                .tasaInteres(c3.tasa())
                .cargoFinanciero(c3.cargoFinanciero())
                .totalAPagar(c3.totalAPagar())
                .pagoPeriodico(c3.pagoPeriodico())
                .plazoDias(c3.plazo())
                .tipoPago(TipoPago.DIARIO)
                .pagoAdelantado(c3.pagoAdelantado())
                .estado(EstadoCredito.APROBADO)
                .montoAprobado(new BigDecimal("20000.00"))
                .fechaAprobacion(DateTimeUtils.ahoraEnMagno().minusDays(1))
                .aprobadoPor(admin)
                .observaciones("Aprobado por Gerente General. Cliente con historial limpio.")
                .createdBy(asesor)
                .build();
        creditoRepo.save(credito3);
        log.info("Crédito 3 creado: $20,000 APROBADO");
    }

    /**
     * Crea registros en la tabla pagos para los 10 pagos marcados como PAGADO
     * en el calendario del crédito ACTIVO ($2,000).
     * También crea 1 multa de prueba (cobrada=false) para probar el flujo.
     */
    private void seedPagosDePrueba() {
        if (pagoRepo.count() > 0) {
            log.info("Pagos ya existen, omitiendo seeder");
            return;
        }

        // Buscar el crédito ACTIVO de $2,000 (cliente Rosa Garcés)
        List<Cliente> clientes = clienteRepo.findAll();
        if (clientes.isEmpty())
            return;

        Usuario asesor = usuarioRepo.findByEmail("asesor1@magno.com")
                .orElse(null);
        if (asesor == null)
            return;

        creditoRepo.findByClienteIdAndEstado(clientes.get(0).getId(), EstadoCredito.ACTIVO)
                .ifPresent(credito -> {
                    List<CalendarioPago> calendario = calendarioPagoRepo
                            .findByCreditoIdOrderByNumeroPago(credito.getId());

                    // Crear registros de pago para los pagos #2–#10 (PAGADO en calendario)
                    String[] modalidades = { "CAJA", "RUTA", "CAJA", "RUTA", "CAJA",
                            "RUTA", "CAJA", "RUTA", "CAJA" };
                    int modalIdx = 0;

                    for (CalendarioPago cp : calendario) {
                        if (cp.getNumeroPago() < 2 || cp.getNumeroPago() > 10)
                            continue;

                        Pago pago = Pago.builder()
                                .credito(credito)
                                .cliente(credito.getCliente())
                                .asesor(asesor)
                                .calendarioPago(cp)
                                .numeroPago(cp.getNumeroPago())
                                .fechaPago(cp.getFechaProgramada())
                                .montoRecibido(credito.getPagoPeriodico())
                                .montoEsperado(cp.getMontoEsperado())
                                .esCompleto(true)
                                .modalidad(modalidades[modalIdx % modalidades.length])
                                .multaAplicada(BigDecimal.ZERO)
                                .registradoPor(asesor)
                                .build();

                        pagoRepo.save(pago);
                        modalIdx++;
                    }

                    log.info("9 pagos de prueba creados para crédito id=" + credito.getId());

                    // Crear 1 multa NO_PAGO pendiente para probar el flujo de cobro con multa
                    Multa multaPrueba = Multa.builder()
                            .cliente(credito.getCliente())
                            .credito(credito)
                            .tipo("NO_PAGO")
                            .monto(new BigDecimal("50.00"))
                            .fecha(DateTimeUtils.hoyEnMagno().minusDays(2))
                            .cobrada(false)
                            .build();
                    multaRepo.save(multaPrueba);

                    log.info("Multa de prueba creada (cobrada=false) — crédito id=" + credito.getId());
                });
    }
}
