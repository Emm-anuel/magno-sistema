package com.magno.service;

import com.magno.dto.cobros.*;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.util.DateTimeUtils;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.logging.Logger;

@Service
@Transactional(readOnly = true)
public class CobrosService {

    private static final Logger log = Logger.getLogger(CobrosService.class.getName());
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Mexico_City");

    private final PagoRepository pagoRepo;
    private final MultaRepository multaRepo;
    private final CreditoRepository creditoRepo;
    private final UsuarioRepository usuarioRepo;
    private final CalendarioPagoRepository calendarioPagoRepo;
    private final ConfigMultaRepository configMultaRepo;
    private final DiaFestivoRepository diaFestivoRepo;
    private final AbonoCoberturaDetalleRepository abonoCoberturaRepo;

    public CobrosService(PagoRepository pagoRepo,
            MultaRepository multaRepo,
            CreditoRepository creditoRepo,
            UsuarioRepository usuarioRepo,
            CalendarioPagoRepository calendarioPagoRepo,
            ConfigMultaRepository configMultaRepo,
            DiaFestivoRepository diaFestivoRepo,
            AbonoCoberturaDetalleRepository abonoCoberturaRepo) {
        this.pagoRepo = pagoRepo;
        this.multaRepo = multaRepo;
        this.creditoRepo = creditoRepo;
        this.usuarioRepo = usuarioRepo;
        this.calendarioPagoRepo = calendarioPagoRepo;
        this.configMultaRepo = configMultaRepo;
        this.diaFestivoRepo = diaFestivoRepo;
        this.abonoCoberturaRepo = abonoCoberturaRepo;
    }

    // ────────────────────────────────────────────────────────────────────
    // Ruta del día
    // ────────────────────────────────────────────────────────────────────

    /**
     * Devuelve la ruta del día con créditos ACTIVO de la sucursal del solicitante,
     * con filtro opcional por asesor y estado de cobro del día solicitado.
     */
    public RutaDiaDTO getRutaDia(Long asesorId, Long sucursalId, LocalDate fecha, String rolSolicitante,
            Long usuarioIdSolicitante, Long sucursalIdSolicitante) {
        Long asesorIdEfectivo = resolverAsesorIdEfectivo(
                asesorId, rolSolicitante, usuarioIdSolicitante);

        Long sucursalIdEfectiva = resolverSucursalIdEfectiva(
                sucursalId, rolSolicitante, sucursalIdSolicitante);

        Usuario asesorEspecifico = null;
        if (asesorIdEfectivo != null) {
            asesorEspecifico = usuarioRepo.findById(asesorIdEfectivo)
                    .orElseThrow(() -> new EntityNotFoundException("Asesor no encontrado: " + asesorIdEfectivo));
        }

        // Obtener todos los créditos activos de la sucursal del solicitante.
        // Para ADMIN/SUPERVISOR sin asesorId específico, no se filtra por asesor.
        List<Credito> creditosActivos = creditoRepo.findRutaDiaCreditosActivos(
                sucursalIdEfectiva,
                asesorIdEfectivo,
                EstadoCredito.ACTIVO);

        // Obtener días festivos de la sucursal para la fecha consultada
        List<LocalDate> diasFestivos = diaFestivoRepo.findFechasBySucursalId(sucursalIdEfectiva);
        boolean esDiaInhabil = esInhabil(fecha, diasFestivos);

        // Pagos ya registrados hoy para la sucursal (asesor opcional)
        List<Pago> pagosHoy = pagoRepo.findBySucursalAndAsesorIdAndFecha(
                sucursalIdEfectiva,
                asesorIdEfectivo,
                fecha);

        List<ClienteRutaDTO> clientesRuta = new ArrayList<>();

        for (Credito credito : creditosActivos) {
            Cliente cliente = credito.getCliente();

            List<CalendarioPago> calendarioCredito = calendarioPagoRepo
                    .findByCreditoIdOrderByNumeroPago(credito.getId());

            // Buscar el pago del calendario correspondiente a esta fecha
            Optional<CalendarioPago> cpOpt = calendarioCredito.stream()
                    .filter(cp -> cp.getFechaProgramada().equals(fecha))
                    .findFirst();

            BigDecimal multasPendientesCredito = Optional.ofNullable(
                    multaRepo.sumMontosPendientesByCreditoId(credito.getId()))
                    .orElse(BigDecimal.ZERO);
            // Solo el atraso real de calendario (días sin resolver) bloquea el pago
            // normal del día. Una multa pendiente, por sí sola, ya no es un
            // obstáculo: el asesor puede cobrar el día con normalidad y la multa se
            // cubre aparte (botón dedicado) o al final con la renovación.
            boolean tieneAtrasoCalendario = tieneCalendarioAdeudo(calendarioCredito, fecha);
            boolean tieneAdeudoPendiente = multasPendientesCredito.compareTo(BigDecimal.ZERO) > 0
                    || tieneAtrasoCalendario;

            // Si la fecha no está en el calendario, puede ser día inhábil o fin de semana
            if (cpOpt.isEmpty() && esDiaInhabil) {
                clientesRuta.add(buildClienteRutaInhabil(cliente, credito, tieneAdeudoPendiente));
                continue;
            }
            if (cpOpt.isEmpty()) {
                // Fecha no programada (podría ser fin de semana)
                if (fecha.getDayOfWeek() == DayOfWeek.SATURDAY
                        || fecha.getDayOfWeek() == DayOfWeek.SUNDAY) {
                    clientesRuta.add(buildClienteRutaInhabil(cliente, credito, tieneAdeudoPendiente));
                    continue;
                }
                // Puede ser que (a) ya completó todos los pagos, o (b) el crédito
                // está vencido y todavía tiene adeudo pendiente (con o sin multa
                // generada — puede que nadie haya registrado "no pago" todavía)
                if (credito.getFechaVencimiento() != null
                        && credito.getFechaVencimiento().isBefore(fecha)
                        && tieneAdeudoPendiente) {
                    clientesRuta.add(buildClienteRutaVencido(cliente, credito, multasPendientesCredito));
                }
                continue;
            }

            CalendarioPago cp = cpOpt.get();

            // Buscar si ya hay pago registrado hoy para este crédito
            Optional<Pago> pagoHoyOpt = pagosHoy.stream()
                    .filter(p -> p.getCredito().getId().equals(credito.getId()))
                    .findFirst();

            BigDecimal multasPendientes = multasPendientesCredito;

            String estadoHoy;
            BigDecimal montoRecibidoHoy = BigDecimal.ZERO;
            String razonNoPago = null;
            Long pagoIdHoy = null;

            EstadoCalendarioPago estadoCalendario = cp.getEstado();
            if (esDiaInhabil) {
                estadoHoy = "INHABIL";
            } else if (estadoCalendario == EstadoCalendarioPago.RECUPERADO
                    || estadoCalendario == EstadoCalendarioPago.RECUPERADO_PARCIAL) {
                montoRecibidoHoy = Optional.ofNullable(
                        abonoCoberturaRepo.sumTotalAplicadoByCalendarioPagoId(cp.getId()))
                        .orElse(BigDecimal.ZERO);
                estadoHoy = estadoCalendario == EstadoCalendarioPago.RECUPERADO
                        ? "PAGADO"
                        : "PARCIAL";
            } else if (pagoHoyOpt.isPresent()) {
                Pago pagoHoy = pagoHoyOpt.get();
                pagoIdHoy = pagoHoy.getId();
                montoRecibidoHoy = Optional.ofNullable(pagoHoy.getMontoRecibido())
                        .orElse(BigDecimal.ZERO);
                razonNoPago = pagoHoy.getRazonNoPago();

                if (pagoHoy.getRazonNoPago() != null && !pagoHoy.getRazonNoPago().isBlank()) {
                    estadoHoy = "NO_PAGADO";
                } else if (Boolean.TRUE.equals(pagoHoy.getEsCompleto())) {
                    estadoHoy = "PAGADO";
                } else {
                    estadoHoy = "PARCIAL";
                }
            } else if (estadoCalendario == EstadoCalendarioPago.PAGADO
                    || estadoCalendario == EstadoCalendarioPago.ADELANTADO) {
                estadoHoy = "PAGADO";
                montoRecibidoHoy = cp.getMontoEsperado();
            } else if (estadoCalendario == EstadoCalendarioPago.PARCIAL) {
                estadoHoy = "PARCIAL";
            } else {
                estadoHoy = "SIN_REGISTRO";
            }

            clientesRuta.add(new ClienteRutaDTO(
                    cliente.getId(),
                    cliente.getNombreCompleto(),
                    cliente.getCelular(),
                    cliente.getNegocioNombre(),
                    credito.getAsesor().getNombreCompleto(),
                    credito.getId(),
                    credito.getMontoCapital(),
                    credito.getPagoPeriodico(),
                    credito.getTipoPago().toString(),
                    cp.getNumeroPago(),
                    credito.getPlazoDias(),
                    estadoHoy,
                    montoRecibidoHoy,
                    multasPendientes,
                    razonNoPago,
                    pagoIdHoy,
                    tieneAtrasoCalendario));
        }

        // Ordenar: SIN_REGISTRO primero, NO_PAGADO segundo, PARCIAL tercero, PAGADO al
        // final
        clientesRuta.sort(Comparator.comparingInt(c -> ordenEstado(c.estadoHoy())));

        // Calcular resumen
        RutaDiaDTO.Resumen resumen = calcularResumen(clientesRuta, pagosHoy);

        RutaDiaDTO.AsesorResumenDTO asesorResumen = asesorEspecifico != null
                ? new RutaDiaDTO.AsesorResumenDTO(asesorEspecifico.getId(), asesorEspecifico.getNombreCompleto())
                : new RutaDiaDTO.AsesorResumenDTO(null, "Todos los asesores");

        return new RutaDiaDTO(
                asesorResumen,
                fecha,
                clientesRuta,
                resumen);
    }

    // ────────────────────────────────────────────────────────────────────
    // No pago automático (cierre de caja)
    // ────────────────────────────────────────────────────────────────────

    private static final String RAZON_NO_PAGO_AUTOMATICO = "Cierre de caja — sin registro de pago";

    private record CandidatoNoPagoAutomatico(
            Credito credito, Cliente cliente, CalendarioPago calendarioPago, BigDecimal montoMulta) {
    }

    private List<CandidatoNoPagoAutomatico> buscarCandidatosNoPagoAutomatico(Long sucursalId, LocalDate fecha) {
        List<Credito> activos = creditoRepo.findRutaDiaCreditosActivos(sucursalId, null, EstadoCredito.ACTIVO);
        List<CandidatoNoPagoAutomatico> candidatos = new ArrayList<>();
        for (Credito credito : activos) {
            calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(credito.getId()).stream()
                    .filter(cp -> cp.getFechaProgramada().equals(fecha)
                            && cp.getEstado() == EstadoCalendarioPago.PENDIENTE)
                    .findFirst()
                    .ifPresent(cp -> {
                        BigDecimal montoMulta = obtenerMontoMultaNoPago(
                                sucursalId, credito.getMontoCapital(), credito.getTipoPago());
                        candidatos.add(new CandidatoNoPagoAutomatico(
                                credito, credito.getCliente(), cp, montoMulta));
                    });
        }
        return candidatos;
    }

    /**
     * Vista previa de solo lectura: qué clientes se marcarían como no pago si se
     * cerrara la caja ahora mismo, sin persistir nada.
     */
    public List<ClienteNoPagoAutomaticoDTO> previsualizarNoPagoAutomatico(Long sucursalId, LocalDate fecha) {
        return buscarCandidatosNoPagoAutomatico(sucursalId, fecha).stream()
                .map(c -> new ClienteNoPagoAutomaticoDTO(
                        c.cliente().getId(),
                        c.cliente().getNombreCompleto(),
                        c.credito().getId(),
                        c.calendarioPago().getNumeroPago(),
                        c.montoMulta()))
                .toList();
    }

    /**
     * Marca como NO_PAGADO (con multa) cualquier pago del calendario de la
     * sucursal que siga PENDIENTE en la fecha dada — invocado al cerrar la caja.
     */
    @Transactional
    public List<ClienteNoPagoAutomaticoDTO> marcarNoPagoAutomatico(Long sucursalId, LocalDate fecha,
            Long registradorId) {
        List<CandidatoNoPagoAutomatico> candidatos = buscarCandidatosNoPagoAutomatico(sucursalId, fecha);
        if (candidatos.isEmpty()) {
            return List.of();
        }

        Usuario registrador = usuarioRepo.findById(registradorId)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + registradorId));

        List<ClienteNoPagoAutomaticoDTO> resultado = new ArrayList<>();
        for (CandidatoNoPagoAutomatico candidato : candidatos) {
            Pago pago = Pago.builder()
                    .credito(candidato.credito())
                    .cliente(candidato.cliente())
                    .asesor(candidato.credito().getAsesor())
                    .calendarioPago(candidato.calendarioPago())
                    .numeroPago(candidato.calendarioPago().getNumeroPago())
                    .fechaPago(fecha)
                    .montoRecibido(BigDecimal.ZERO)
                    .montoEsperado(candidato.calendarioPago().getMontoEsperado())
                    .esCompleto(false)
                    .razonNoPago(RAZON_NO_PAGO_AUTOMATICO)
                    .multaAplicada(candidato.montoMulta())
                    .registradoPor(registrador)
                    .build();
            pagoRepo.save(pago);

            candidato.calendarioPago().setEstado(EstadoCalendarioPago.NO_PAGADO);
            calendarioPagoRepo.save(candidato.calendarioPago());

            Multa multa = Multa.builder()
                    .pago(pago)
                    .cliente(candidato.cliente())
                    .credito(candidato.credito())
                    .tipo("NO_PAGO")
                    .monto(candidato.montoMulta())
                    .fecha(fecha)
                    .cobrada(false)
                    .build();
            multaRepo.save(multa);

            resultado.add(new ClienteNoPagoAutomaticoDTO(
                    candidato.cliente().getId(),
                    candidato.cliente().getNombreCompleto(),
                    candidato.credito().getId(),
                    candidato.calendarioPago().getNumeroPago(),
                    candidato.montoMulta()));
        }
        return resultado;
    }

    // ────────────────────────────────────────────────────────────────────
    // Revertir no pagos automáticos al cancelar un cierre
    // ────────────────────────────────────────────────────────────────────

    /**
     * Revierte únicamente los no-pagos creados automáticamente por el cierre que
     * todavía no tuvieron actividad posterior. Se usa cuando el corte del mismo
     * día se cancela para que los clientes vuelvan a tener oportunidad de pagar.
     */
    @Transactional
    public List<ClienteNoPagoAutomaticoDTO> revertirNoPagoAutomatico(Long sucursalId, LocalDate fecha) {
        List<Pago> pagosAutomaticos = pagoRepo
                .findByCreditoSucursalIdAndFechaPagoAndRazonNoPagoAndDeletedAtIsNull(
                        sucursalId, fecha, RAZON_NO_PAGO_AUTOMATICO);
        if (pagosAutomaticos.isEmpty()) {
            return List.of();
        }

        OffsetDateTime ahora = DateTimeUtils.ahoraEnMagno();
        List<ClienteNoPagoAutomaticoDTO> resultado = new ArrayList<>();

        for (Pago pago : pagosAutomaticos) {
            CalendarioPago calendario = pago.getCalendarioPago();
            if (calendario == null
                    || calendario.getEstado() != EstadoCalendarioPago.NO_PAGADO
                    || pago.getModificadoPor() != null
                    || pago.getFechaModificacion() != null
                    || pagoRepo.existsOtroPagoActivoEnCalendario(calendario.getId(), pago.getId())
                    || abonoCoberturaRepo.existsByCalendarioPagoId(calendario.getId())) {
                continue;
            }

            List<Multa> multas = multaRepo.findByPagoIdAndDeletedAtIsNull(pago.getId());
            boolean multaConActividad = multas.stream().anyMatch(multa ->
                    Boolean.TRUE.equals(multa.getCobrada())
                            || Boolean.TRUE.equals(multa.getCondonada())
                            || multa.getCobradaEnPago() != null
                            || multa.getCobradaEnAbono() != null
                            || multa.getCondonadaEnRenovacion() != null);
            if (multaConActividad) {
                continue;
            }

            multas.forEach(multa -> multa.setDeletedAt(ahora));
            multaRepo.saveAll(multas);

            pago.setDeletedAt(ahora);
            pagoRepo.save(pago);

            calendario.setEstado(EstadoCalendarioPago.PENDIENTE);
            calendarioPagoRepo.save(calendario);

            resultado.add(new ClienteNoPagoAutomaticoDTO(
                    pago.getCliente().getId(),
                    pago.getCliente().getNombreCompleto(),
                    pago.getCredito().getId(),
                    pago.getNumeroPago(),
                    pago.getMultaAplicada()));
        }

        return resultado;
    }

    // Registrar pago

    @Transactional
    public PagoDTO registrarPago(PagoRegistrarRequest req, Long usuarioId) {
        // 1. Validación básica del request
        if (Boolean.TRUE.equals(req.noPago())) {
            if (req.razonNoPago() == null || req.razonNoPago().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "razon_no_pago es obligatorio cuando no_pago es true");
            }
        } else {
            if (req.montoRecibido() == null || req.montoRecibido().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "monto_recibido es obligatorio y debe ser mayor a 0 cuando no_pago es false");
            }
        }

        // 2. Obtener usuario que registra
        Usuario registrador = usuarioRepo.findById(usuarioId)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + usuarioId));

        String rol = registrador.getRol().getNombre();
        if (!"SUPERVISOR_CAMPO".equals(rol) && !"ASESOR_COBRADOR".equals(rol)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No tienes permisos para registrar cobros");
        }

        // 3. Obtener crédito
        Credito credito = creditoRepo.findById(req.creditoId())
                .orElseThrow(() -> new EntityNotFoundException("Crédito no encontrado: " + req.creditoId()));

        if (credito.getEstado() != EstadoCredito.ACTIVO) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El cliente no tiene un crédito activo");
        }

        // 4. Verificar acceso: ASESOR solo sus clientes, SUPERVISOR_CAMPO solo su
        // sucursal
        Cliente cliente = credito.getCliente();

        if ("ASESOR_COBRADOR".equals(rol)) {
            if (credito.getAsesor() == null
                    || !credito.getAsesor().getId().equals(usuarioId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No tienes acceso a este cliente");
            }
        } else if ("SUPERVISOR_CAMPO".equals(rol)) {
            if (!cliente.getSucursal().getId().equals(registrador.getSucursal().getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No tienes acceso a este cliente");
            }
        }

        // 5. Resolver fecha de operación (histórico solo para ADMINISTRADOR/SUPERVISOR)
        LocalDate fechaOperacion = resolverFechaOperacion(req.fechaPago(), rol);

        // 6. Obtener pago pendiente para la fecha seleccionada
        CalendarioPago cp = obtenerPagoPendienteParaFecha(credito, fechaOperacion);
        if (cp == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No hay pago pendiente para la fecha seleccionada");
        }

        // 7. Verificar que no se registre dos veces el mismo pago
        if (pagoRepo.existsByCreditoIdAndNumeroPago(credito.getId(), cp.getNumeroPago())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El pago #" + cp.getNumeroPago() + " ya fue registrado para este crédito");
        }

        // 8. Obtener config de multas para este crédito
        BigDecimal montoCapital = credito.getMontoCapital();
        Long sucursalId = credito.getSucursal().getId();

        // 9. Flujo según noPago
        Pago pago;
        if (Boolean.TRUE.equals(req.noPago())) {
            pago = registrarNoPago(credito, cliente, cp, registrador, req, sucursalId, montoCapital, fechaOperacion);
        } else {
            pago = registrarPagoRecibido(credito, cliente, cp, registrador, req, sucursalId, montoCapital,
                    fechaOperacion);
        }

        log.info("Pago registrado — crédito=" + credito.getId()
                + " pago#=" + cp.getNumeroPago()
                + " noPago=" + req.noPago()
                + " registradoPor=" + registrador.getNombreCompleto());

        return PagoDTO.from(pago);
    }

    // ────────────────────────────────────────────────────────────────────
    // Pagar multas pendientes (botón independiente, fuera del pago del día)
    // ────────────────────────────────────────────────────────────────────

    @Transactional
    public PagoDTO pagarMultasPendientes(Long creditoId, Long usuarioId, LocalDate fecha) {
        Credito credito = creditoRepo.findById(creditoId)
                .orElseThrow(() -> new EntityNotFoundException("Crédito no encontrado: " + creditoId));

        Usuario registrador = usuarioRepo.findById(usuarioId)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + usuarioId));

        String rol = registrador.getRol().getNombre();
        if (!"SUPERVISOR_CAMPO".equals(rol) && !"ASESOR_COBRADOR".equals(rol)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No tienes permisos para registrar cobros");
        }

        Cliente cliente = credito.getCliente();
        if ("ASESOR_COBRADOR".equals(rol)) {
            if (credito.getAsesor() == null || !credito.getAsesor().getId().equals(usuarioId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No tienes acceso a este cliente");
            }
        } else if ("SUPERVISOR_CAMPO".equals(rol)) {
            if (!cliente.getSucursal().getId().equals(registrador.getSucursal().getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No tienes acceso a este cliente");
            }
        }

        List<Multa> multasPendientes = fecha != null
                ? multaRepo.findPendientesByCreditoIdAndFecha(creditoId, fecha)
                : multaRepo.findByCreditoIdAndCobradaFalseAndCondonadaFalseAndDeletedAtIsNull(creditoId);
        if (multasPendientes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Este crédito no tiene multas pendientes por pagar");
        }

        BigDecimal totalMultas = multasPendientes.stream()
                .map(Multa::getMonto)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        LocalDate hoy = hoyNegocio();

        Pago pago = Pago.builder()
                .credito(credito)
                .cliente(cliente)
                .asesor(credito.getAsesor())
                .calendarioPago(null)
                .numeroPago(0)
                .fechaPago(hoy)
                .montoRecibido(totalMultas)
                .montoEsperado(totalMultas)
                .esCompleto(true)
                .razonNoPago(null)
                .multaAplicada(totalMultas)
                .registradoPor(registrador)
                .build();
        pago = pagoRepo.save(pago);

        for (Multa multa : multasPendientes) {
            multa.setCobrada(true);
            multa.setCobradaEnPago(pago);
            multaRepo.save(multa);
        }

        log.info("Multas pagadas de forma independiente — crédito=" + creditoId
                + " total=" + totalMultas
                + " registradoPor=" + registrador.getNombreCompleto());

        return PagoDTO.from(pago);
    }

    // ────────────────────────────────────────────────────────────────────
    // Modificar pago (solo ADMIN y SUPERVISOR)
    // ────────────────────────────────────────────────────────────────────

    @Transactional
    public PagoDTO modificarPago(Long pagoId, PagoModificarRequest req, Long usuarioId) {
        Pago pago = pagoRepo.findById(pagoId)
                .orElseThrow(() -> new EntityNotFoundException("Pago no encontrado: " + pagoId));

        if (pago.getDeletedAt() != null) {
            throw new EntityNotFoundException("Pago no encontrado: " + pagoId);
        }

        Usuario modificador = usuarioRepo.findById(usuarioId)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + usuarioId));

        // Actualizar campos. Cero también es un valor válido al corregir un pago
        // real para convertirlo en "No pagó".
        if (req.montoRecibido() != null) {
            if (req.montoRecibido().compareTo(BigDecimal.ZERO) < 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "monto_recibido no puede ser negativo");
            }
            pago.setMontoRecibido(req.montoRecibido());
            // Recalcular esCompleto
            boolean ahora = req.montoRecibido().compareTo(pago.getMontoEsperado()) >= 0;
            pago.setEsCompleto(ahora);
        }

        if (req.razonNoPago() != null) {
            pago.setRazonNoPago(req.razonNoPago().isBlank() ? null : req.razonNoPago());
        }

        // Un monto positivo corrige el registro como pago real. Aunque un cliente
        // antiguo omita razonNoPago en el PATCH, no debe conservarse la razón de
        // "No pagó", porque SaldoCuotaService excluye esos registros del abono.
        if (req.montoRecibido() != null && req.montoRecibido().compareTo(BigDecimal.ZERO) > 0) {
            pago.setRazonNoPago(null);
        }

        // Recalcular después de aplicar también la razón; permite corregir un
        // NO_PAGADO a PAGADO/PARCIAL en una sola operación.
        CalendarioPago cp = pago.getCalendarioPago();
        if (cp != null && (req.montoRecibido() != null || req.razonNoPago() != null)) {
            if (pago.getRazonNoPago() != null && !pago.getRazonNoPago().isBlank()) {
                cp.setEstado(EstadoCalendarioPago.NO_PAGADO);
            } else if (Boolean.TRUE.equals(pago.getEsCompleto())) {
                cp.setEstado(EstadoCalendarioPago.PAGADO);
            } else {
                cp.setEstado(EstadoCalendarioPago.PARCIAL);
            }
            calendarioPagoRepo.save(cp);
        }

        if (Boolean.TRUE.equals(req.condonarMultaDia())) {
            List<Multa> multasDia = multaRepo.findPendientesByCreditoIdAndFecha(
                    pago.getCredito().getId(), pago.getFechaPago());
            var ahoraCondonacion = DateTimeUtils.ahoraEnMagno();
            for (Multa multa : multasDia) {
                multa.setCondonada(true);
                multa.setCondonadaPor(modificador);
                multa.setFechaCondonacion(ahoraCondonacion);
                multa.setMotivoCondonacion(req.motivoModificacion().trim());
            }
            multaRepo.saveAll(multasDia);
            if (!multasDia.isEmpty()) {
                pago.setMultaAplicada(BigDecimal.ZERO);
            }
        }

        pago.setModificadoPor(modificador);
        pago.setFechaModificacion(DateTimeUtils.ahoraEnMagno());

        pagoRepo.save(pago);

        log.info("Pago modificado — id=" + pagoId
                + " por=" + modificador.getNombreCompleto()
                + " motivo=" + req.motivoModificacion());

        return PagoDTO.from(pago);
    }

    // ────────────────────────────────────────────────────────────────────
    // Historial de cobros
    // ────────────────────────────────────────────────────────────────────

    public Page<PagoDTO> getHistorial(Long asesorId, Long clienteId,
            LocalDate fechaDesde, LocalDate fechaHasta,
            Pageable pageable,
            String rolSolicitante, Long usuarioIdSolicitante,
            Long sucursalIdSolicitante) {
        if ("ASESOR_COBRADOR".equals(rolSolicitante)
                || "SUPERVISOR_CAMPO".equals(rolSolicitante)) {
            asesorId = usuarioIdSolicitante;
        }

        List<PagoDTO> registrados = pagoRepo
                .findHistorialList(asesorId, clienteId, fechaDesde, fechaHasta)
                .stream()
                .map(PagoDTO::from)
                .toList();

        List<PagoDTO> pendientes = calendarioPagoRepo
                .findPendientesByFechaRange(fechaDesde, fechaHasta, asesorId, clienteId)
                .stream()
                .map(PagoDTO::fromCalendario)
                .toList();

        List<PagoDTO> todos = new ArrayList<>(registrados);
        todos.addAll(pendientes);
        todos.sort(Comparator
                .comparing(PagoDTO::fechaPago, Comparator.reverseOrder())
                .thenComparingLong(p -> p.id() != null ? -p.id() : Long.MAX_VALUE));

        int total = todos.size();
        int from = (int) pageable.getOffset();
        int to = Math.min(from + pageable.getPageSize(), total);
        List<PagoDTO> pagina = from >= total ? List.of() : todos.subList(from, to);

        return new org.springframework.data.domain.PageImpl<>(pagina, pageable, total);
    }

    public List<PagoDTO> getPagosPorCliente(Long clienteId) {
        return pagoRepo.findByClienteIdOrderByFechaPagoDesc(clienteId)
                .stream()
                .filter(p -> p.getDeletedAt() == null)
                .map(PagoDTO::from)
                .toList();
    }

    public List<MultaDTO> getMultasPorCredito(Long creditoId) {
        return multaRepo.findByCreditoIdAndDeletedAtIsNullOrderByFechaDesc(creditoId)
                .stream()
                .map(MultaDTO::from)
                .toList();
    }

    // ────────────────────────────────────────────────────────────────────
    // Helpers privados
    // ────────────────────────────────────────────────────────────────────

    private Pago registrarNoPago(Credito credito, Cliente cliente, CalendarioPago cp,
            Usuario registrador, PagoRegistrarRequest req,
            Long sucursalId, BigDecimal montoCapital, LocalDate hoy) {
        // Obtener monto de multa desde configuración, considerando tipo de crédito
        BigDecimal montoMulta = obtenerMontoMultaNoPago(sucursalId, montoCapital, credito.getTipoPago());

        // Crear registro de pago con monto_recibido = 0
        Pago pago = Pago.builder()
                .credito(credito)
                .cliente(cliente)
                .asesor(credito.getAsesor())
                .calendarioPago(cp)
                .numeroPago(cp.getNumeroPago())
                .fechaPago(hoy)
                .montoRecibido(BigDecimal.ZERO)
                .montoEsperado(cp.getMontoEsperado())
                .esCompleto(false)

                .razonNoPago(req.razonNoPago())
                .multaAplicada(montoMulta)
                .registradoPor(registrador)
                .build();

        pagoRepo.save(pago);

        // Actualizar estado del calendario
        cp.setEstado(EstadoCalendarioPago.NO_PAGADO);
        calendarioPagoRepo.save(cp);

        // Crear multa tipo NO_PAGO
        Multa multa = Multa.builder()
                .pago(pago)
                .cliente(cliente)
                .credito(credito)
                .tipo("NO_PAGO")
                .monto(montoMulta)
                .fecha(hoy)
                .cobrada(false)
                .build();
        multaRepo.save(multa);

        return pago;
    }

    private Pago registrarPagoRecibido(Credito credito, Cliente cliente, CalendarioPago cp,
            Usuario registrador, PagoRegistrarRequest req,
            Long sucursalId, BigDecimal montoCapital, LocalDate hoy) {
        BigDecimal montoRecibido = req.montoRecibido();
        BigDecimal montoEsperado = cp.getMontoEsperado();

        // "Cobrar" cubre única y exclusivamente la cuota del día — nunca multas
        // pendientes ni adeudo acumulado ni adelantos a futuro. Para eso están
        // los botones dedicados: "Pagar multa", "Pagar adeudo", "Adelantar pagos".
        if (montoRecibido.compareTo(montoEsperado) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El monto no puede ser mayor a la cuota del día (" + montoEsperado
                            + "). Usa 'Pagar multa', 'Pagar adeudo' o 'Adelantar pagos' para cubrir el excedente.");
        }

        boolean esCompleto = montoRecibido.compareTo(montoEsperado) >= 0;

        Pago pago = Pago.builder()
                .credito(credito)
                .cliente(cliente)
                .asesor(credito.getAsesor())
                .calendarioPago(cp)
                .numeroPago(cp.getNumeroPago())
                .fechaPago(hoy)
                .montoRecibido(montoRecibido)
                .montoEsperado(montoEsperado)
                .esCompleto(esCompleto)
                .razonNoPago(null)
                .multaAplicada(BigDecimal.ZERO)
                .registradoPor(registrador)
                .build();

        pagoRepo.save(pago);

        // Actualizar estado del calendario
        EstadoCalendarioPago nuevoEstado = esCompleto
                ? EstadoCalendarioPago.PAGADO
                : EstadoCalendarioPago.PARCIAL;
        cp.setEstado(nuevoEstado);
        calendarioPagoRepo.save(cp);

        // Regla de 2 pagos incompletos: si no es completo, verificar acumulado
        if (!esCompleto) {
            verificarMultaIncompletos(credito, cliente, hoy, sucursalId, montoCapital, pago);
        }

        // Verificar si el crédito está completamente pagado
        verificarCreditoCompletado(credito);

        return pago;
    }

    /**
     * Verifica si se alcanzó un múltiplo de 2 en pagos incompletos y genera multa
     * INCOMPLETO. Considera el tipo de crédito para determinar el monto de multa.
     */
    private void verificarMultaIncompletos(Credito credito, Cliente cliente, LocalDate hoy,
            Long sucursalId, BigDecimal montoCapital, Pago pagoActual) {
        long pagosIncompletos = pagoRepo.countPagosIncompletosByCreditoId(credito.getId());

        // El pago actual ya está guardado, así que contamos incluyéndolo
        // Si el total de incompletos es múltiplo de 2 → generar multa
        if (pagosIncompletos > 0 && pagosIncompletos % 2 == 0) {
            BigDecimal montoMultaIncompletos = obtenerMontoMultaIncompletos(sucursalId, montoCapital,
                    credito.getTipoPago());

            Multa multa = Multa.builder()
                    .pago(pagoActual)
                    .cliente(cliente)
                    .credito(credito)
                    .tipo("INCOMPLETO")
                    .monto(montoMultaIncompletos)
                    .fecha(hoy)
                    .cobrada(false)
                    .build();
            multaRepo.save(multa);

            log.info("Multa INCOMPLETO generada — crédito=" + credito.getId()
                    + " acumulados=" + pagosIncompletos + " monto=" + montoMultaIncompletos);
        }
    }

    /**
     * Si todos los pagos del crédito ya están en estado terminal, marca el crédito
     * como PAGADO.
     */
    void verificarCreditoCompletado(Credito credito) {
        List<CalendarioPago> todos = calendarioPagoRepo
                .findByCreditoIdOrderByNumeroPago(credito.getId());

        boolean todosTerminados = todos.stream().allMatch(cp -> cp.getEstado() == EstadoCalendarioPago.PAGADO
                || cp.getEstado() == EstadoCalendarioPago.ADELANTADO
                || cp.getEstado() == EstadoCalendarioPago.RECUPERADO);

        if (todosTerminados) {
            credito.setEstado(EstadoCredito.PAGADO);
            creditoRepo.save(credito);
            log.info("Crédito marcado como PAGADO — id=" + credito.getId());
        }
    }

    private CalendarioPago obtenerPagoPendienteParaFecha(Credito credito, LocalDate fechaOperacion) {
        return calendarioPagoRepo
                .findByCreditoIdAndEstado(credito.getId(), EstadoCalendarioPago.PENDIENTE)
                .stream()
                .filter(cp -> fechaOperacion.equals(cp.getFechaProgramada()))
                .findFirst()
                .orElse(null);
    }

    private LocalDate resolverFechaOperacion(LocalDate fechaSolicitada, String rolSolicitante) {
        LocalDate hoy = hoyNegocio();
        if (fechaSolicitada == null) {
            return hoy;
        }

        boolean esRolCampo = "ASESOR_COBRADOR".equals(rolSolicitante)
                || "SUPERVISOR_CAMPO".equals(rolSolicitante);

        if (esRolCampo && !hoy.equals(fechaSolicitada)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Solo Gerente General y Gerente de Sucursal pueden registrar en fechas históricas");
        }

        return fechaSolicitada;
    }

    private BigDecimal obtenerMontoMultaNoPago(Long sucursalId, BigDecimal montoCapital, TipoPago tipoPago) {
        ConfigMulta config = configMultaRepo.findBySucursalAndMonto(sucursalId, montoCapital).orElse(null);
        if (config == null) {
            // Fallback si no hay configuración
            return tipoPago == TipoPago.SEMANAL ? new BigDecimal("300.00") : new BigDecimal("50.00");
        }
        return tipoPago == TipoPago.SEMANAL ? config.getMultaSemanalNoPago() : config.getMultaNoPago();
    }

    private BigDecimal obtenerMontoMultaIncompletos(Long sucursalId, BigDecimal montoCapital, TipoPago tipoPago) {
        ConfigMulta config = configMultaRepo.findBySucursalAndMonto(sucursalId, montoCapital).orElse(null);
        if (config == null) {
            // Fallback si no hay configuración
            return tipoPago == TipoPago.SEMANAL ? new BigDecimal("300.00") : new BigDecimal("50.00");
        }
        return tipoPago == TipoPago.SEMANAL ? config.getMultaSemanalIncompletos() : config.getMultaIncompletos();
    }

    private LocalDate hoyNegocio() {
        return LocalDate.now(BUSINESS_ZONE);
    }

    private boolean esInhabil(LocalDate fecha, List<LocalDate> diasFestivos) {
        DayOfWeek dia = fecha.getDayOfWeek();
        if (dia == DayOfWeek.SATURDAY || dia == DayOfWeek.SUNDAY)
            return true;
        return diasFestivos.contains(fecha);
    }

    /**
     * Un slot cuenta como adeudo si quedó explícitamente sin resolver (NO_PAGADO,
     * RECUPERADO_PARCIAL) o si sigue PENDIENTE con fecha ya pasada — esto último
     * cubre el caso en que nadie ha registrado "no pago" para ese día todavía.
     */
    private boolean tieneCalendarioAdeudo(List<CalendarioPago> calendario, LocalDate fecha) {
        return calendario.stream().anyMatch(cp -> cp.getEstado() == EstadoCalendarioPago.NO_PAGADO
                || cp.getEstado() == EstadoCalendarioPago.RECUPERADO_PARCIAL
                || (cp.getEstado() == EstadoCalendarioPago.PENDIENTE
                        && cp.getFechaProgramada() != null
                        && cp.getFechaProgramada().isBefore(fecha)));
    }

    private ClienteRutaDTO buildClienteRutaInhabil(Cliente cliente, Credito credito, boolean tieneAdeudoPendiente) {
        return new ClienteRutaDTO(
                cliente.getId(),
                cliente.getNombreCompleto(),
                cliente.getCelular(),
                cliente.getNegocioNombre(),
                credito.getAsesor().getNombreCompleto(),
                credito.getId(),
                credito.getMontoCapital(),
                credito.getPagoPeriodico(),
                credito.getTipoPago().toString(),
                null,
                credito.getPlazoDias(),
                "INHABIL",
                null,
                BigDecimal.ZERO,
                null,
                null,
                tieneAdeudoPendiente);
    }

    private ClienteRutaDTO buildClienteRutaVencido(Cliente cliente, Credito credito, BigDecimal multasPendientes) {
        return new ClienteRutaDTO(
                cliente.getId(),
                cliente.getNombreCompleto(),
                cliente.getCelular(),
                cliente.getNegocioNombre(),
                credito.getAsesor().getNombreCompleto(),
                credito.getId(),
                credito.getMontoCapital(),
                credito.getPagoPeriodico(),
                credito.getTipoPago().toString(),
                null,
                credito.getPlazoDias(),
                "VENCIDO",
                null,
                multasPendientes,
                null,
                null,
                true);
    }

    private Long resolverAsesorIdEfectivo(Long asesorId, String rolSolicitante, Long usuarioIdSolicitante) {
        if (asesorId != null) {
            if ("ASESOR_COBRADOR".equals(rolSolicitante)
                    && !asesorId.equals(usuarioIdSolicitante)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No puedes consultar la ruta de otro asesor");
            }
            return asesorId;
        }

        if ("ADMINISTRADOR".equals(rolSolicitante) || "SUPERVISOR".equals(rolSolicitante)) {
            return null;
        }

        return usuarioIdSolicitante;
    }

    private Long resolverSucursalIdEfectiva(Long sucursalId, String rolSolicitante, Long sucursalIdSolicitante) {
        boolean puedeElegirSucursal = "ADMINISTRADOR".equals(rolSolicitante)
                || "SUPERVISOR".equals(rolSolicitante);

        if (puedeElegirSucursal && sucursalId != null) {
            return sucursalId;
        }

        return sucursalIdSolicitante;
    }

    private int ordenEstado(String estado) {
        return switch (estado) {
            case "SIN_REGISTRO" -> 0;
            case "NO_PAGADO", "VENCIDO" -> 1;
            case "PARCIAL" -> 2;
            case "INHABIL" -> 3;
            case "PAGADO" -> 4;
            default -> 5;
        };
    }

    private RutaDiaDTO.Resumen calcularResumen(List<ClienteRutaDTO> clientes, List<Pago> pagosHoy) {
        int totalClientes = clientes.size();
        int cobrados = 0;
        int noPagaron = 0;
        int sinRegistrar = 0;
        int inhabiles = 0;

        for (ClienteRutaDTO c : clientes) {
            switch (c.estadoHoy()) {
                case "PAGADO", "PARCIAL" -> cobrados++;
                case "NO_PAGADO", "VENCIDO" -> noPagaron++;
                case "SIN_REGISTRO" -> sinRegistrar++;
                case "INHABIL" -> inhabiles++;
            }
        }

        BigDecimal totalMultasCobradas = pagosHoy.stream()
                .map(p -> Optional.ofNullable(p.getMultaAplicada()).orElse(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCobrado = pagosHoy.stream()
                .map(p -> Optional.ofNullable(p.getMontoRecibido()).orElse(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new RutaDiaDTO.Resumen(
                totalClientes, cobrados, noPagaron, sinRegistrar, inhabiles,
                BigDecimal.ZERO, totalCobrado,
                totalMultasCobradas);
    }
}
