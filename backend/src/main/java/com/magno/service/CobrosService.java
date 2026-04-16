package com.magno.service;

import com.magno.dto.cobros.*;
import com.magno.model.*;
import com.magno.repository.*;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.logging.Logger;

@Service
@Transactional(readOnly = true)
public class CobrosService {

    private static final Logger log = Logger.getLogger(CobrosService.class.getName());

    private final PagoRepository pagoRepo;
    private final MultaRepository multaRepo;
    private final CreditoRepository creditoRepo;
    private final UsuarioRepository usuarioRepo;
    private final CalendarioPagoRepository calendarioPagoRepo;
    private final ConfigMultaRepository configMultaRepo;
    private final DiaFestivoRepository diaFestivoRepo;

    public CobrosService(PagoRepository pagoRepo,
            MultaRepository multaRepo,
            CreditoRepository creditoRepo,
            UsuarioRepository usuarioRepo,
            CalendarioPagoRepository calendarioPagoRepo,
            ConfigMultaRepository configMultaRepo,
            DiaFestivoRepository diaFestivoRepo) {
        this.pagoRepo = pagoRepo;
        this.multaRepo = multaRepo;
        this.creditoRepo = creditoRepo;
        this.usuarioRepo = usuarioRepo;
        this.calendarioPagoRepo = calendarioPagoRepo;
        this.configMultaRepo = configMultaRepo;
        this.diaFestivoRepo = diaFestivoRepo;
    }

    // ────────────────────────────────────────────────────────────────────
    // Ruta del día
    // ────────────────────────────────────────────────────────────────────

    /**
     * Devuelve la ruta del día con créditos ACTIVO de la sucursal del solicitante,
     * con filtro opcional por asesor y estado de cobro del día solicitado.
     */
    public RutaDiaDTO getRutaDia(Long asesorId, LocalDate fecha, String rolSolicitante,
            Long usuarioIdSolicitante, Long sucursalIdSolicitante) {
        Long asesorIdEfectivo = resolverAsesorIdEfectivo(
                asesorId, rolSolicitante, usuarioIdSolicitante);

        Usuario asesorEspecifico = null;
        if (asesorIdEfectivo != null) {
            asesorEspecifico = usuarioRepo.findById(asesorIdEfectivo)
                    .orElseThrow(() -> new EntityNotFoundException("Asesor no encontrado: " + asesorIdEfectivo));
        }

        // Obtener todos los créditos activos de la sucursal del solicitante.
        // Para ADMIN/SUPERVISOR sin asesorId específico, no se filtra por asesor.
        List<Credito> creditosActivos = creditoRepo.findRutaDiaCreditosActivos(
                sucursalIdSolicitante,
                asesorIdEfectivo,
                EstadoCredito.ACTIVO,
                LocalDate.now());

        // Obtener días festivos de la sucursal para la fecha consultada
        List<LocalDate> diasFestivos = diaFestivoRepo.findFechasBySucursalId(sucursalIdSolicitante);
        boolean esDiaInhabil = esInhabil(fecha, diasFestivos);

        // Pagos ya registrados hoy para la sucursal (asesor opcional)
        List<Pago> pagosHoy = pagoRepo.findBySucursalAndAsesorIdAndFecha(
                sucursalIdSolicitante,
                asesorIdEfectivo,
                fecha);

        List<ClienteRutaDTO> clientesRuta = new ArrayList<>();

        for (Credito credito : creditosActivos) {
            Cliente cliente = credito.getCliente();

            // Buscar el pago del calendario correspondiente a esta fecha
            Optional<CalendarioPago> cpOpt = calendarioPagoRepo
                    .findByCreditoIdOrderByNumeroPago(credito.getId())
                    .stream()
                    .filter(cp -> cp.getFechaProgramada().equals(fecha))
                    .findFirst();

            // Si la fecha no está en el calendario, puede ser día inhábil o fin de semana
            if (cpOpt.isEmpty() && esDiaInhabil) {
                clientesRuta.add(buildClienteRutaInhabil(cliente, credito));
                continue;
            }
            if (cpOpt.isEmpty()) {
                // Fecha no programada (podría ser fin de semana)
                if (fecha.getDayOfWeek() == DayOfWeek.SATURDAY
                        || fecha.getDayOfWeek() == DayOfWeek.SUNDAY) {
                    clientesRuta.add(buildClienteRutaInhabil(cliente, credito));
                    continue;
                }
                // No tiene pago programado ese día (ya completó todos)
                continue;
            }

            CalendarioPago cp = cpOpt.get();

            // Buscar si ya hay pago registrado hoy para este crédito
            Optional<Pago> pagoHoyOpt = pagosHoy.stream()
                    .filter(p -> p.getCredito().getId().equals(credito.getId()))
                    .findFirst();

            BigDecimal multasPendientes = Optional.ofNullable(
                    multaRepo.sumMontosPendientesByCreditoId(credito.getId()))
                    .orElse(BigDecimal.ZERO);

            String estadoHoy;
            BigDecimal montoRecibidoHoy = BigDecimal.ZERO;
            String razonNoPago = null;
            Long pagoIdHoy = null;

            if (esDiaInhabil) {
                estadoHoy = "INHABIL";
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
                    cp.getNumeroPago(),
                    credito.getPlazoDias(),
                    estadoHoy,
                    montoRecibidoHoy,
                    multasPendientes,
                    razonNoPago,
                    pagoIdHoy));
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
    // Registrar pago
    // ────────────────────────────────────────────────────────────────────

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

        // 3. Obtener crédito
        Credito credito = creditoRepo.findById(req.creditoId())
                .orElseThrow(() -> new EntityNotFoundException("Crédito no encontrado: " + req.creditoId()));

        if (credito.getEstado() != EstadoCredito.ACTIVO) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "El cliente no tiene un crédito activo");
        }

        // 4. Verificar acceso: ASESOR solo sus clientes, SUPERVISOR_CAMPO solo su
        // sucursal
        String rol = registrador.getRol().getNombre();
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

        // 5. Obtener el próximo pago pendiente del calendario
        CalendarioPago cp = obtenerProximoPagoPendiente(credito);
        if (cp == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No hay pagos pendientes para este crédito");
        }

        // 6. Verificar que no se registre dos veces el mismo día
        LocalDate hoy = LocalDate.now();
        if (pagoRepo.existsByCreditoIdAndNumeroPago(credito.getId(), cp.getNumeroPago())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El pago #" + cp.getNumeroPago() + " ya fue registrado para este crédito");
        }

        // 7. Obtener config de multas para este crédito
        BigDecimal montoCapital = credito.getMontoCapital();
        Long sucursalId = credito.getSucursal().getId();

        // 8. Flujo según noPago
        Pago pago;
        if (Boolean.TRUE.equals(req.noPago())) {
            pago = registrarNoPago(credito, cliente, cp, registrador, req, sucursalId, montoCapital, hoy);
        } else {
            pago = registrarPagoRecibido(credito, cliente, cp, registrador, req, sucursalId, montoCapital, hoy);
        }

        log.info("Pago registrado — crédito=" + credito.getId()
                + " pago#=" + cp.getNumeroPago()
                + " noPago=" + req.noPago()
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

        // Actualizar campos
        if (req.montoRecibido() != null && req.montoRecibido().compareTo(BigDecimal.ZERO) > 0) {
            pago.setMontoRecibido(req.montoRecibido());
            // Recalcular esCompleto
            boolean ahora = req.montoRecibido().compareTo(pago.getMontoEsperado()) >= 0;
            pago.setEsCompleto(ahora);

            // Actualizar estado del calendario
            CalendarioPago cp = pago.getCalendarioPago();
            if (cp != null) {
                if (pago.getRazonNoPago() != null && !pago.getRazonNoPago().isBlank()) {
                    cp.setEstado(EstadoCalendarioPago.NO_PAGADO);
                } else if (ahora) {
                    cp.setEstado(EstadoCalendarioPago.PAGADO);
                } else {
                    cp.setEstado(EstadoCalendarioPago.PARCIAL);
                }
                calendarioPagoRepo.save(cp);
            }
        }

        if (req.modalidad() != null) {
            pago.setModalidad(req.modalidad());
        }

        if (req.razonNoPago() != null) {
            pago.setRazonNoPago(req.razonNoPago().isBlank() ? null : req.razonNoPago());
        }

        pago.setModificadoPor(modificador);
        pago.setFechaModificacion(OffsetDateTime.now());

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
        // ASESOR_COBRADOR solo puede ver sus propios pagos
        if ("ASESOR_COBRADOR".equals(rolSolicitante)) {
            asesorId = usuarioIdSolicitante;
        }
        // SUPERVISOR_CAMPO puede ver su sucursal completa pero el filtro lo aplica el
        // controller

        return pagoRepo.findHistorial(asesorId, clienteId, fechaDesde, fechaHasta, pageable)
                .map(PagoDTO::from);
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
        // Obtener monto de multa desde configuración
        BigDecimal montoMulta = obtenerMontoMultaNoPago(sucursalId, montoCapital);

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
                .modalidad(req.modalidad())
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

        // Obtener multas pendientes no cobradas
        List<Multa> multasPendientes = multaRepo
                .findByCreditoIdAndCobradaFalseAndDeletedAtIsNull(credito.getId());
        BigDecimal totalMultasPendientes = multasPendientes.stream()
                .map(Multa::getMonto)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Determinar si el pago es completo (cubre el monto esperado)
        boolean esCompleto = montoRecibido.compareTo(montoEsperado) >= 0;
        BigDecimal multaAplicadaEnEstePago = BigDecimal.ZERO;

        // Determinar si cubre además las multas pendientes
        if (montoRecibido.compareTo(montoEsperado.add(totalMultasPendientes)) >= 0) {
            // Cubre todo: pago + multas
            multaAplicadaEnEstePago = totalMultasPendientes;
        }

        // Crear el pago
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
                .modalidad(req.modalidad())
                .razonNoPago(null)
                .multaAplicada(multaAplicadaEnEstePago)
                .registradoPor(registrador)
                .build();

        pagoRepo.save(pago);

        // Marcar multas como cobradas si el pago las cubrió
        if (multaAplicadaEnEstePago.compareTo(BigDecimal.ZERO) > 0) {
            for (Multa m : multasPendientes) {
                m.setCobrada(true);
                m.setCobradaEnPago(pago);
                multaRepo.save(m);
            }
        }

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
     * INCOMPLETO.
     */
    private void verificarMultaIncompletos(Credito credito, Cliente cliente, LocalDate hoy,
            Long sucursalId, BigDecimal montoCapital, Pago pagoActual) {
        long pagosIncompletos = pagoRepo.countPagosIncompletosByCreditoId(credito.getId());

        // El pago actual ya está guardado, así que contamos incluyéndolo
        // Si el total de incompletos es múltiplo de 2 → generar multa
        if (pagosIncompletos > 0 && pagosIncompletos % 2 == 0) {
            BigDecimal montoMulta = obtenerMontoMultaIncompletos(sucursalId, montoCapital);

            Multa multa = Multa.builder()
                    .pago(pagoActual)
                    .cliente(cliente)
                    .credito(credito)
                    .tipo("INCOMPLETO")
                    .monto(montoMulta)
                    .fecha(hoy)
                    .cobrada(false)
                    .build();
            multaRepo.save(multa);

            log.info("Multa INCOMPLETO generada — crédito=" + credito.getId()
                    + " acumulados=" + pagosIncompletos + " monto=" + montoMulta);
        }
    }

    /**
     * Si todos los pagos del crédito ya están en estado terminal, marca el crédito
     * como PAGADO.
     */
    private void verificarCreditoCompletado(Credito credito) {
        List<CalendarioPago> todos = calendarioPagoRepo
                .findByCreditoIdOrderByNumeroPago(credito.getId());

        boolean todosTerminados = todos.stream().allMatch(cp -> cp.getEstado() == EstadoCalendarioPago.PAGADO
                || cp.getEstado() == EstadoCalendarioPago.PARCIAL
                || cp.getEstado() == EstadoCalendarioPago.ADELANTADO);

        if (todosTerminados) {
            credito.setEstado(EstadoCredito.PAGADO);
            creditoRepo.save(credito);
            log.info("Crédito marcado como PAGADO — id=" + credito.getId());
        }
    }

    /**
     * Obtiene el próximo pago PENDIENTE del calendario, ordenado por número de
     * pago.
     * Si no hay pagos vencidos (fecha <= hoy), toma el próximo futuro.
     */
    private CalendarioPago obtenerProximoPagoPendiente(Credito credito) {
        List<CalendarioPago> pendientes = calendarioPagoRepo
                .findByCreditoIdAndEstado(credito.getId(), EstadoCalendarioPago.PENDIENTE);

        if (pendientes.isEmpty())
            return null;

        LocalDate hoy = LocalDate.now();

        // Preferir el pendiente más antiguo vencido (fecha <= hoy)
        return pendientes.stream()
                .filter(cp -> !cp.getFechaProgramada().isAfter(hoy))
                .min(Comparator.comparingInt(CalendarioPago::getNumeroPago))
                .orElseGet(() ->
                // Si no hay vencidos, tomar el próximo futuro
                pendientes.stream()
                        .min(Comparator.comparingInt(CalendarioPago::getNumeroPago))
                        .orElse(null));
    }

    private BigDecimal obtenerMontoMultaNoPago(Long sucursalId, BigDecimal montoCapital) {
        return configMultaRepo.findBySucursalAndMonto(sucursalId, montoCapital)
                .map(ConfigMulta::getMultaNoPago)
                .orElse(new BigDecimal("50.00")); // fallback si no hay config
    }

    private BigDecimal obtenerMontoMultaIncompletos(Long sucursalId, BigDecimal montoCapital) {
        return configMultaRepo.findBySucursalAndMonto(sucursalId, montoCapital)
                .map(ConfigMulta::getMultaIncompletos)
                .orElse(new BigDecimal("50.00")); // fallback
    }

    private boolean esInhabil(LocalDate fecha, List<LocalDate> diasFestivos) {
        DayOfWeek dia = fecha.getDayOfWeek();
        if (dia == DayOfWeek.SATURDAY || dia == DayOfWeek.SUNDAY)
            return true;
        return diasFestivos.contains(fecha);
    }

    private ClienteRutaDTO buildClienteRutaInhabil(Cliente cliente, Credito credito) {
        return new ClienteRutaDTO(
                cliente.getId(),
                cliente.getNombreCompleto(),
                cliente.getCelular(),
                cliente.getNegocioNombre(),
                credito.getAsesor().getNombreCompleto(),
                credito.getId(),
                credito.getMontoCapital(),
                credito.getPagoPeriodico(),
                null,
                credito.getPlazoDias(),
                "INHABIL",
                null,
                BigDecimal.ZERO,
                null,
                null);
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

    private int ordenEstado(String estado) {
        return switch (estado) {
            case "SIN_REGISTRO" -> 0;
            case "NO_PAGADO" -> 1;
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
                case "NO_PAGADO" -> noPagaron++;
                case "SIN_REGISTRO" -> sinRegistrar++;
                case "INHABIL" -> inhabiles++;
            }
        }

        BigDecimal totalCaja = pagosHoy.stream()
                .filter(p -> "CAJA".equals(p.getModalidad()))
                .map(p -> Optional.ofNullable(p.getMontoRecibido()).orElse(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalRuta = pagosHoy.stream()
                .filter(p -> "RUTA".equals(p.getModalidad()))
                .map(p -> Optional.ofNullable(p.getMontoRecibido()).orElse(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalMultasCobradas = pagosHoy.stream()
                .map(p -> Optional.ofNullable(p.getMultaAplicada()).orElse(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new RutaDiaDTO.Resumen(
                totalClientes, cobrados, noPagaron, sinRegistrar, inhabiles,
                totalCaja, totalRuta, totalMultasCobradas);
    }
}
