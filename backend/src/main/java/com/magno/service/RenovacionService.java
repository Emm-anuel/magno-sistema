package com.magno.service;

import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.magno.dto.cobros.MultaDTO;
import com.magno.dto.renovacion.*;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.service.CreditoCalculoService.ResumenCalculo;
import com.magno.util.DateTimeUtils;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.logging.Logger;

@Service
@Transactional(readOnly = true)
public class RenovacionService {

        private static final Logger log = Logger.getLogger(RenovacionService.class.getName());

        private static final List<EstadoCalendarioPago> ESTADOS_PENDIENTES = List.of(
                        EstadoCalendarioPago.PENDIENTE,
                        EstadoCalendarioPago.NO_PAGADO,
                        EstadoCalendarioPago.PARCIAL,
                        EstadoCalendarioPago.RECUPERADO_PARCIAL);

        private static final List<EstadoCalendarioPago> ESTADOS_REALIZADOS =
                        RenovacionElegibilidadService.ESTADOS_REALIZADOS;

        private final RenovacionRepository renovacionRepo;
        private final CreditoRepository creditoRepo;
        private final CalendarioPagoRepository calendarioPagoRepo;
        private final MultaRepository multaRepo;
        private final UsuarioRepository usuarioRepo;
        private final CreditoCalculoService calculoService;
        private final RenovacionElegibilidadService renovacionElegibilidadService;

        public RenovacionService(RenovacionRepository renovacionRepo,
                        CreditoRepository creditoRepo,
                        CalendarioPagoRepository calendarioPagoRepo,
                        MultaRepository multaRepo,
                        UsuarioRepository usuarioRepo,
                        CreditoCalculoService calculoService,
                        RenovacionElegibilidadService renovacionElegibilidadService) {
                this.renovacionRepo = renovacionRepo;
                this.creditoRepo = creditoRepo;
                this.calendarioPagoRepo = calendarioPagoRepo;
                this.multaRepo = multaRepo;
                this.usuarioRepo = usuarioRepo;
                this.calculoService = calculoService;
                this.renovacionElegibilidadService = renovacionElegibilidadService;
        }

        // ────────────────────────────────────────────────────────────────────
        // Cálculo previo (preview en tiempo real)
        // ────────────────────────────────────────────────────────────────────

        public RenovacionCalculoDTO calcularPreview(Long creditoId, BigDecimal montoNuevo, TipoPago tipoPagoNuevo) {
                Credito credito = findCredito(creditoId);

                if (credito.getEstado() != EstadoCredito.ACTIVO) {
                        throw new IllegalArgumentException(
                                        "El crédito debe estar ACTIVO para calcular una renovación. Estado: "
                                                        + credito.getEstado());
                }

                long pagosRealizados = calendarioPagoRepo.countByCreditoIdAndEstadoIn(creditoId, ESTADOS_REALIZADOS);

                int umbral = renovacionElegibilidadService.resolverUmbral(credito);
                boolean elegible = pagosRealizados >= umbral;
                if (!elegible) {
                        throw new IllegalArgumentException(
                                        "El cliente no es elegible para renovación. Pagos realizados: "
                                                        + pagosRealizados
                                                        + " de " + umbral + " requeridos.");
                }

                List<CalendarioPago> pagosPendientes = calendarioPagoRepo
                                .findByCreditoIdAndEstadoIn(creditoId, ESTADOS_PENDIENTES);
                int numPagosRestantes = pagosPendientes.size();
                BigDecimal montoPagosRestantes = credito.getPagoPeriodico()
                                .multiply(BigDecimal.valueOf(numPagosRestantes));

                BigDecimal multasPendientes = multaRepo.sumMontosPendientesByCreditoId(creditoId);

                TipoPago tipoPagoCalculo = tipoPagoNuevo == null ? credito.getTipoPago() : tipoPagoNuevo;
                Long sucursalId = credito.getSucursal().getId();
                ResumenCalculo calculoNuevo = tipoPagoCalculo == TipoPago.SEMANAL
                                ? calculoService.calcularCreditoSemanal(montoNuevo, sucursalId)
                                : calculoService.calcularCredito(montoNuevo, sucursalId);
                BigDecimal pagoAdelantado = calculoNuevo.pagoAdelantado();

                BigDecimal desembolso = montoNuevo
                                .subtract(montoPagosRestantes)
                                .subtract(multasPendientes)
                                .subtract(pagoAdelantado);

                boolean puedeAumentar = true;
                String advertencia = null;

                return new RenovacionCalculoDTO(
                                creditoId,
                                credito.getMontoCapital(),
                                credito.getPagoPeriodico(),
                                credito.getPlazoDias(),
                                montoNuevo,
                                numPagosRestantes,
                                montoPagosRestantes,
                                multasPendientes,
                                pagoAdelantado,
                                desembolso,
                                calculoNuevo.plazo(),
                                calculoNuevo.tasa(),
                                calculoNuevo.cargoFinanciero(),
                                calculoNuevo.totalAPagar(),
                                calculoNuevo.pagoPeriodico(),
                                puedeAumentar,
                                advertencia);
        }

        // ────────────────────────────────────────────────────────────────────
        // Crear solicitud (estado SOLICITADO — no procesa el crédito aún)
        // Solo SUPERVISOR_CAMPO y ASESOR_COBRADOR
        // ────────────────────────────────────────────────────────────────────

        @Transactional
        public RenovacionDetalleDTO crearSolicitud(RenovacionCreateRequest req, Long usuarioId) {
                Credito creditoAnterior = findCredito(req.creditoAnteriorId());

                if (creditoAnterior.getEstado() != EstadoCredito.ACTIVO) {
                        throw new IllegalArgumentException(
                                        "Solo se puede solicitar renovación de un crédito ACTIVO. Estado actual: "
                                                        + creditoAnterior.getEstado());
                }

                // Verificar que no exista ya una solicitud pendiente para este crédito
                boolean tieneSolicitudPendiente = renovacionRepo
                                .existsByCreditoAnteriorIdAndEstadoAndDeletedAtIsNull(
                                                req.creditoAnteriorId(), EstadoRenovacion.SOLICITADO);
                if (tieneSolicitudPendiente) {
                        throw new IllegalArgumentException(
                                        "Ya existe una solicitud de renovación pendiente para este crédito.");
                }

                // Verificar elegibilidad
                long pagosRealizados = calendarioPagoRepo.countByCreditoIdAndEstadoIn(
                                req.creditoAnteriorId(), ESTADOS_REALIZADOS);

                int umbral = renovacionElegibilidadService.resolverUmbral(creditoAnterior);
                if (pagosRealizados < umbral) {
                        throw new IllegalArgumentException(
                                        "El cliente no es elegible para renovación. Pagos realizados: "
                                                        + pagosRealizados + "/" + umbral);
                }

                // Calcular montos (se almacenan en la solicitud para que el gerente los vea)
                List<CalendarioPago> pagosPendientes = calendarioPagoRepo
                                .findByCreditoIdAndEstadoIn(req.creditoAnteriorId(), ESTADOS_PENDIENTES);
                int numPagosRestantes = pagosPendientes.size();
                BigDecimal montoPagosRestantes = creditoAnterior.getPagoPeriodico()
                                .multiply(BigDecimal.valueOf(numPagosRestantes));

                BigDecimal multasPendientesAmt = multaRepo.sumMontosPendientesByCreditoId(req.creditoAnteriorId());

                // Parsear tipo de pago primero para usarlo en cálculo
                TipoPago tipoPago = parseTipoPago(req.tipoPago());

                // Calcular crédito nuevo según su tipo
                Long sucursalIdCred = creditoAnterior.getSucursal().getId();
                ResumenCalculo calculoNuevo = tipoPago == TipoPago.SEMANAL
                                ? calculoService.calcularCreditoSemanal(req.montoNuevo(), sucursalIdCred)
                                : calculoService.calcularCredito(req.montoNuevo(), sucursalIdCred);

                BigDecimal montoDesembolso = req.montoNuevo()
                                .subtract(montoPagosRestantes)
                                .subtract(multasPendientesAmt)
                                .subtract(calculoNuevo.pagoAdelantado());

                Usuario asesor = creditoAnterior.getAsesor();
                Usuario creador = usuarioRepo.findById(usuarioId).orElse(null);
                LocalDate hoy = DateTimeUtils.hoyEnMagno();

                String[] evidenciaUrls = req.evidenciaUrls() != null && !req.evidenciaUrls().isEmpty()
                                ? req.evidenciaUrls().toArray(String[]::new)
                                : null;

                Renovacion solicitud = Renovacion.builder()
                                .creditoAnterior(creditoAnterior)
                                .creditoNuevo(null) // se crea al aprobar
                                .cliente(creditoAnterior.getCliente())
                                .asesor(asesor)
                                .estado(EstadoRenovacion.SOLICITADO)
                                .montoNuevo(req.montoNuevo())
                                .tipoPago(tipoPago)
                                .fecha(hoy)
                                .pagosRestantes(numPagosRestantes)
                                .montoPagosRestantes(montoPagosRestantes)
                                .multasPendientes(multasPendientesAmt)
                                .pagoAdelantado(calculoNuevo.pagoAdelantado())
                                .montoDesembolso(montoDesembolso)
                                .garantiaDescripcion(req.garantiaDescripcion())
                                .evidenciaUrls(evidenciaUrls)
                                .videoEntregaUrl(req.videoEntregaUrl())
                                .createdBy(creador)
                                .build();
                renovacionRepo.save(solicitud);

                log.info("Solicitud de renovación creada — renovacion.id=" + solicitud.getId()
                                + " credito_anterior=" + creditoAnterior.getId()
                                + " monto_nuevo=" + req.montoNuevo()
                                + " asesor=" + asesor.getNombreCompleto());

                return RenovacionDetalleDTO.from(solicitud, List.of());
        }

        // ────────────────────────────────────────────────────────────────────
        // Aprobar solicitud (APROBADO — solo visto bueno, sin tocar créditos)
        // Solo ADMINISTRADOR y SUPERVISOR
        // ────────────────────────────────────────────────────────────────────

        @Transactional
        public RenovacionDetalleDTO aprobarRenovacion(Long renovacionId, BigDecimal montoAprobadoParam,
                        List<Long> multasCondonadasIds, String motivoCondonacion, Long aprobadorId) {
                Renovacion renovacion = findRenovacion(renovacionId);

                if (renovacion.getEstado() != EstadoRenovacion.SOLICITADO) {
                        throw new IllegalArgumentException(
                                        "Solo se puede aprobar una renovación en estado SOLICITADO. Estado actual: "
                                                        + renovacion.getEstado());
                }

                Usuario aprobador = usuarioRepo.findById(aprobadorId)
                                .orElseThrow(() -> new EntityNotFoundException(
                                                "Usuario no encontrado: " + aprobadorId));

                BigDecimal montoAprobado = (montoAprobadoParam != null
                                && montoAprobadoParam.compareTo(BigDecimal.ZERO) > 0)
                                                ? montoAprobadoParam
                                                : renovacion.getMontoNuevo();

                // ── Procesar condonaciones ───────────────────────────────────────
                List<Multa> multasCondonadasList = new java.util.ArrayList<>();
                BigDecimal totalCondonado = BigDecimal.ZERO;

                if (multasCondonadasIds != null && !multasCondonadasIds.isEmpty()) {
                        if (motivoCondonacion == null || motivoCondonacion.isBlank()) {
                                throw new IllegalArgumentException(
                                                "El motivo de condonación es obligatorio cuando se condonan multas.");
                        }

                        Long creditoAnteriorId = renovacion.getCreditoAnterior().getId();
                        OffsetDateTime ahora = OffsetDateTime.now();

                        for (Long multaId : multasCondonadasIds) {
                                Multa multa = multaRepo.findById(multaId)
                                                .orElseThrow(() -> new EntityNotFoundException(
                                                                "Multa no encontrada: " + multaId));

                                if (!multa.getCredito().getId().equals(creditoAnteriorId)) {
                                        throw new IllegalArgumentException(
                                                        "La multa " + multaId
                                                                        + " no pertenece al crédito anterior de esta renovación.");
                                }
                                if (Boolean.TRUE.equals(multa.getCobrada())) {
                                        throw new IllegalArgumentException(
                                                        "La multa " + multaId + " ya fue cobrada.");
                                }
                                if (Boolean.TRUE.equals(multa.getCondonada())) {
                                        throw new IllegalArgumentException(
                                                        "La multa " + multaId + " ya fue condonada.");
                                }

                                multa.setCondonada(true);
                                multa.setCondonadaEnRenovacion(renovacion);
                                multa.setCondonadaPor(aprobador);
                                multa.setFechaCondonacion(ahora);
                                multa.setMotivoCondonacion(motivoCondonacion.trim());
                                multasCondonadasList.add(multaRepo.save(multa));
                        }

                        totalCondonado = multasCondonadasList.stream()
                                        .map(Multa::getMonto)
                                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                }

                // Recalcular desembolso con el monto aprobado real y descontando sólo las multas no condonadas
                Long sucursalId = renovacion.getCreditoAnterior().getSucursal().getId();
                ResumenCalculo calculoAprobado = renovacion.getTipoPago() == TipoPago.SEMANAL
                                ? calculoService.calcularCreditoSemanal(montoAprobado, sucursalId)
                                : calculoService.calcularCredito(montoAprobado, sucursalId);
                BigDecimal multasADescontar = renovacion.getMultasPendientes().subtract(totalCondonado);
                BigDecimal desembolsoAprobado = montoAprobado
                                .subtract(renovacion.getMontoPagosRestantes())
                                .subtract(multasADescontar)
                                .subtract(calculoAprobado.pagoAdelantado());

                renovacion.setEstado(EstadoRenovacion.APROBADO);
                renovacion.setMontoAprobado(montoAprobado);
                renovacion.setAprobadoPor(aprobador);
                renovacion.setFechaAprobacion(DateTimeUtils.ahoraEnMagno());
                renovacion.setMultasCondonadas(totalCondonado);
                renovacion.setMontoDesembolso(desembolsoAprobado);
                renovacion.setPagoAdelantado(calculoAprobado.pagoAdelantado());
                renovacionRepo.save(renovacion);

                log.info("Renovación APROBADA (pendiente desembolso) — renovacion.id=" + renovacion.getId()
                                + " monto_aprobado=" + montoAprobado
                                + " aprobado_por=" + aprobador.getNombreCompleto());

                List<MultaCondonadaDTO> condonadasDTO = multasCondonadasList.stream()
                                .map(MultaCondonadaDTO::from)
                                .toList();
                return RenovacionDetalleDTO.from(renovacion, condonadasDTO);
        }

        // ────────────────────────────────────────────────────────────────────
        // Confirmar desembolso (ACTIVO — procesa el crédito)
        // Todos los roles
        // ────────────────────────────────────────────────────────────────────

        @Transactional
        public RenovacionDetalleDTO confirmarDesembolso(Long renovacionId, Long confirmadorId, String videoEntregaUrl) {
                Renovacion renovacion = findRenovacion(renovacionId);

                if (renovacion.getEstado() != EstadoRenovacion.APROBADO) {
                        throw new IllegalArgumentException(
                                        "Solo se puede confirmar el desembolso de una renovación APROBADA. Estado actual: "
                                                        + renovacion.getEstado());
                }

                Credito creditoAnterior = renovacion.getCreditoAnterior();
                if (creditoAnterior.getEstado() != EstadoCredito.ACTIVO) {
                        throw new IllegalArgumentException(
                                        "El crédito anterior ya no está ACTIVO. Estado: "
                                                        + creditoAnterior.getEstado());
                }

                Usuario confirmador = usuarioRepo.findById(confirmadorId)
                                .orElseThrow(() -> new EntityNotFoundException(
                                                "Usuario no encontrado: " + confirmadorId));

                BigDecimal montoAprobado = renovacion.getMontoAprobado() != null
                                ? renovacion.getMontoAprobado()
                                : renovacion.getMontoNuevo();

                // Re-leer pagos y multas al momento del desembolso real
                List<CalendarioPago> pagosPendientes = calendarioPagoRepo
                                .findByCreditoIdAndEstadoIn(creditoAnterior.getId(), ESTADOS_PENDIENTES);
                BigDecimal multasPendientesAmt = multaRepo.sumMontosPendientesByCreditoId(creditoAnterior.getId());
                ResumenCalculo calculoNuevo = renovacion.getTipoPago() == TipoPago.SEMANAL
                                ? calculoService.calcularCreditoSemanal(montoAprobado,
                                                creditoAnterior.getSucursal().getId())
                                : calculoService.calcularCredito(montoAprobado, creditoAnterior.getSucursal().getId());
                BigDecimal montoDesembolso = montoAprobado
                                .subtract(renovacion.getMontoPagosRestantes())
                                .subtract(multasPendientesAmt)
                                .subtract(calculoNuevo.pagoAdelantado());

                LocalDate hoy = DateTimeUtils.hoyEnMagno();

                // 1. Saldar pagos pendientes del crédito anterior
                for (CalendarioPago pago : pagosPendientes) {
                        pago.setEstado(EstadoCalendarioPago.PAGADO);
                        calendarioPagoRepo.save(pago);
                }

                // 2. Marcar multas como cobradas (descontadas del desembolso) — excluye condonadas
                multaRepo.findByCreditoIdAndCobradaFalseAndCondonadaFalseAndDeletedAtIsNull(creditoAnterior.getId())
                                .forEach(m -> {
                                        m.setCobrada(true);
                                        multaRepo.save(m);
                                });

                // 3. Cerrar crédito anterior
                creditoAnterior.setEstado(EstadoCredito.RENOVADO);
                creditoRepo.save(creditoAnterior);

                // 4. Crear nuevo crédito ACTIVO
                String[] evidenciaUrls = renovacion.getEvidenciaUrls();
                Credito creditoNuevo = Credito.builder()
                                .cliente(creditoAnterior.getCliente())
                                .asesor(creditoAnterior.getAsesor())
                                .sucursal(creditoAnterior.getSucursal())
                                .tipo(TipoCredito.RENOVACION)
                                .montoSolicitado(montoAprobado)
                                .montoCapital(calculoNuevo.capital())
                                .montoAprobado(montoAprobado)
                                .tasaInteres(calculoNuevo.tasa())
                                .cargoFinanciero(calculoNuevo.cargoFinanciero())
                                .totalAPagar(calculoNuevo.totalAPagar())
                                .pagoPeriodico(calculoNuevo.pagoPeriodico())
                                .plazoDias(calculoNuevo.plazo())
                                .tipoPago(renovacion.getTipoPago())
                                .pagoAdelantado(calculoNuevo.pagoAdelantado())
                                .garantiaDescripcion(renovacion.getGarantiaDescripcion())
                                .evidenciaUrls(evidenciaUrls)
                                .videoEntregaUrl(videoEntregaUrl)
                                .estado(EstadoCredito.ACTIVO)
                                .fechaInicio(hoy)
                                .fechaDesembolso(DateTimeUtils.ahoraEnMagno())
                                .aprobadoPor(renovacion.getAprobadoPor())
                                .fechaAprobacion(renovacion.getFechaAprobacion())
                                .createdBy(confirmador)
                                .build();
                creditoRepo.save(creditoNuevo);

                // 5. Generar calendario desde el día siguiente al desembolso
                LocalDate inicioPagos = hoy.plusDays(1);
                if (creditoNuevo.getTipoPago() == TipoPago.SEMANAL) {
                        calculoService.generarCalendarioSemanal(
                                        creditoNuevo, inicioPagos, calculoNuevo.plazo(), calculoNuevo,
                                        creditoAnterior.getSucursal().getId());
                } else {
                        calculoService.generarCalendario(
                                        creditoNuevo, inicioPagos, calculoNuevo.plazo(), calculoNuevo,
                                        creditoAnterior.getSucursal().getId());
                }
                creditoRepo.save(creditoNuevo);

                // 6. Actualizar renovación → ACTIVO
                renovacion.setCreditoNuevo(creditoNuevo);
                renovacion.setEstado(EstadoRenovacion.ACTIVO);
                renovacion.setConfirmadoPor(confirmador);
                renovacion.setFechaConfirmacion(DateTimeUtils.ahoraEnMagno());
                renovacion.setFecha(hoy);
                renovacion.setMontoDesembolso(montoDesembolso);
                if (videoEntregaUrl != null && !videoEntregaUrl.isBlank()) {
                        renovacion.setVideoEntregaUrl(videoEntregaUrl);
                }
                renovacionRepo.save(renovacion);

                log.info("Renovación ACTIVA (desembolso confirmado) — renovacion.id=" + renovacion.getId()
                                + " credito_anterior=" + creditoAnterior.getId()
                                + " credito_nuevo=" + creditoNuevo.getId()
                                + " confirmado_por=" + confirmador.getNombreCompleto());

                return RenovacionDetalleDTO.from(renovacion, cargarCondonadasDetalle(renovacion));
        }

        // ────────────────────────────────────────────────────────────────────
        // Renovaciones APROBADAS pendientes de desembolso
        // Solo ADMINISTRADOR y SUPERVISOR
        // ────────────────────────────────────────────────────────────────────

        public List<RenovacionDetalleDTO> getPendientesDesembolso(Long sucursalId) {
                return renovacionRepo
                                .findPendientesDesembolso(sucursalId)
                                .stream()
                                .map(r -> RenovacionDetalleDTO.from(r, cargarCondonadasDetalle(r)))
                                .toList();
        }

        // ────────────────────────────────────────────────────────────────────
        // Rechazar solicitud
        // Solo ADMINISTRADOR y SUPERVISOR
        // ────────────────────────────────────────────────────────────────────

        @Transactional
        public RenovacionDetalleDTO rechazarRenovacion(Long renovacionId, String motivo, Long rechazadorId) {
                Renovacion renovacion = findRenovacion(renovacionId);

                if (renovacion.getEstado() != EstadoRenovacion.SOLICITADO) {
                        throw new IllegalArgumentException(
                                        "Solo se puede rechazar una renovación en estado SOLICITADO. Estado actual: "
                                                        + renovacion.getEstado());
                }

                Usuario rechazador = usuarioRepo.findById(rechazadorId)
                                .orElseThrow(() -> new EntityNotFoundException(
                                                "Usuario no encontrado: " + rechazadorId));

                renovacion.setEstado(EstadoRenovacion.RECHAZADO);
                renovacion.setAprobadoPor(rechazador);
                renovacion.setFechaAprobacion(DateTimeUtils.ahoraEnMagno());
                renovacion.setMotivoRechazo(motivo != null ? motivo.trim() : "");
                renovacionRepo.save(renovacion);

                log.info("Renovación RECHAZADA — renovacion.id=" + renovacion.getId()
                                + " motivo=" + motivo
                                + " rechazado_por=" + rechazador.getNombreCompleto());

                return RenovacionDetalleDTO.from(renovacion, List.of());
        }

        // ────────────────────────────────────────────────────────────────────
        // Renovaciones pendientes de aprobación
        // Solo ADMINISTRADOR y SUPERVISOR
        // ────────────────────────────────────────────────────────────────────

        public List<RenovacionDetalleDTO> getPendientes(Long asesorId, Long sucursalId) {
                return renovacionRepo
                                .findPendientes(asesorId, sucursalId)
                                .stream()
                                .map(r -> RenovacionDetalleDTO.from(r, cargarCondonadasDetalle(r)))
                                .toList();
        }

        // ────────────────────────────────────────────────────────────────────
        // Mis Solicitudes — todas las del asesor autenticado (SUPERVISOR_CAMPO /
        // ASESOR_COBRADOR)
        // ────────────────────────────────────────────────────────────────────

        public List<RenovacionDetalleDTO> getMisSolicitudes(Long asesorId) {
                return renovacionRepo
                                .findMisSolicitudes(asesorId)
                                .stream()
                                .map(r -> RenovacionDetalleDTO.from(r, cargarCondonadasDetalle(r)))
                                .toList();
        }

        // ────────────────────────────────────────────────────────────────────
        // Colocaciones semanales (solo renovaciones ACTIVAS)
        // ────────────────────────────────────────────────────────────────────

        public ColocacionesSemanaDTO getColocaciones(LocalDate semanaInicio, Long asesorId, Long sucursalId) {
                LocalDate semanaFin = semanaInicio.plusDays(4); // Lun–Vie

                List<ColocacionItemDTO> items = new ArrayList<>();

                // Renovaciones APROBADAS de la semana
                renovacionRepo.findColocaciones(semanaInicio, semanaFin, asesorId, sucursalId)
                                .forEach(r -> items.add(new ColocacionItemDTO(
                                                r.getFecha(),
                                                r.getCliente().getNombreCompleto(),
                                                r.getCliente().getId(),
                                                r.getCreditoAnterior().getMontoCapital(),
                                                r.getCreditoNuevo().getMontoCapital(),
                                                r.getMontoDesembolso(),
                                                r.getAsesor().getNombreCompleto(),
                                                r.getCreditoNuevo().getSucursal().getNombre(),
                                                r.getCreditoNuevo().getTipoPago().toString(),
                                                "RENOVACION",
                                                r.getId())));

                // Créditos nuevos activados en la semana
                java.time.OffsetDateTime inicioTs = semanaInicio.atStartOfDay(DateTimeUtils.MAGNO_ZONE)
                                .toOffsetDateTime();
                java.time.OffsetDateTime finTs = semanaFin.plusDays(1).atStartOfDay(DateTimeUtils.MAGNO_ZONE)
                                .toOffsetDateTime();
                creditoRepo.findColocacionesNuevos(inicioTs, finTs, asesorId, sucursalId)
                                .forEach(c -> items.add(new ColocacionItemDTO(
                                                DateTimeUtils.toLocalDateEnMagno(c.getFechaDesembolso()),
                                                c.getCliente().getNombreCompleto(),
                                                c.getCliente().getId(),
                                                null,
                                                c.getMontoCapital(),
                                                c.getMontoCapital().subtract(c.getPagoAdelantado()),
                                                c.getAsesor().getNombreCompleto(),
                                                c.getSucursal().getNombre(),
                                                c.getTipoPago().toString(),
                                                "NUEVO",
                                                c.getId())));

                items.sort(Comparator.comparing(ColocacionItemDTO::fecha));

                BigDecimal totalDesembolsos = items.stream()
                                .map(ColocacionItemDTO::desembolso)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                return new ColocacionesSemanaDTO(semanaInicio, semanaFin, items, totalDesembolsos);
        }

        // ────────────────────────────────────────────────────────────────────
        // Créditos listos para renovar
        // ────────────────────────────────────────────────────────────────────

        public List<ListoRenovarItemDTO> getListosParaRenovar(Long asesorId, Long sucursalId) {
                List<EstadoCalendarioPago> realizados = ESTADOS_REALIZADOS;

                return creditoRepo.findActivosParaEvaluarRenovacion(asesorId, sucursalId)
                                .stream()
                                .filter(c -> {
                                        long pagosRealizados = calendarioPagoRepo
                                                        .countByCreditoIdAndEstadoIn(c.getId(), realizados);
                                        return renovacionElegibilidadService.esElegible(c, pagosRealizados);
                                })
                                .filter(c -> !renovacionRepo.existsByCreditoAnteriorIdAndEstadoAndDeletedAtIsNull(
                                                c.getId(), EstadoRenovacion.SOLICITADO))
                                .map(c -> {
                                        long pagosRealizados = calendarioPagoRepo
                                                        .countByCreditoIdAndEstadoIn(c.getId(), realizados);
                                        int pagosRestantes = c.getPlazoDias() - (int) pagosRealizados;
                                        BigDecimal multas = multaRepo.sumMontosPendientesByCreditoId(c.getId());
                                        long pagosVencidos = calendarioPagoRepo
                                                        .countAtrasadosByCreditoId(c.getId(), DateTimeUtils.hoyEnMagno());

                                        return new ListoRenovarItemDTO(
                                                        c.getCliente().getId(),
                                                        c.getCliente().getNombreCompleto(),
                                                        c.getId(),
                                                        c.getMontoCapital(),
                                                        c.getPlazoDias(),
                                                        c.getPagoPeriodico(),
                                                        c.getTipoPago().toString(),
                                                        c.getAsesor().getId(),
                                                        c.getAsesor().getNombreCompleto(),
                                                        c.getSucursal().getId(),
                                                        c.getSucursal().getNombre(),
                                                        pagosRealizados,
                                                        Math.max(0, pagosRestantes),
                                                        multas,
                                                        pagosVencidos);
                                })
                                .toList();
        }

        // ────────────────────────────────────────────────────────────────────
        // Exportar PDF de colocaciones
        // ────────────────────────────────────────────────────────────────────

        public byte[] exportarPdf(LocalDate semanaInicio, Long asesorId, Long sucursalId) {
                ColocacionesSemanaDTO data = getColocaciones(semanaInicio, asesorId, sucursalId);

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                PdfWriter writer = new PdfWriter(baos);
                PdfDocument pdf = new PdfDocument(writer);
                Document doc = new Document(pdf);

                DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");

                doc.add(new Paragraph("Colocaciones Semanales")
                                .setBold().setFontSize(16).setTextAlignment(TextAlignment.CENTER));
                doc.add(new Paragraph("Semana: " + data.semanaInicio().format(fmt)
                                + " — " + data.semanaFin().format(fmt))
                                .setFontSize(11).setTextAlignment(TextAlignment.CENTER));
                doc.add(new Paragraph(" "));

                float[] colWidths = { 60, 120, 80, 80, 80, 100, 60 };
                Table table = new Table(UnitValue.createPercentArray(colWidths));
                table.setWidth(UnitValue.createPercentValue(100));

                String[] headers = { "Fecha", "Cliente", "Créd. Anterior", "Créd. Nuevo", "Desembolso", "Asesor",
                                "Tipo" };
                for (String h : headers) {
                        table.addHeaderCell(new Cell()
                                        .add(new Paragraph(h).setBold().setFontSize(9))
                                        .setBackgroundColor(ColorConstants.LIGHT_GRAY));
                }

                for (ColocacionItemDTO item : data.items()) {
                        table.addCell(cell(item.fecha().format(fmt)));
                        table.addCell(cell(item.clienteNombre()));
                        table.addCell(cell(item.creditoAnterior() != null ? "$" + item.creditoAnterior().toPlainString()
                                        : "—"));
                        table.addCell(cell("$" + item.creditoNuevo().toPlainString()));
                        table.addCell(cell("$" + item.desembolso().toPlainString()));
                        table.addCell(cell(item.asesorNombre()));
                        table.addCell(cell(item.tipo()));
                }

                doc.add(table);
                doc.add(new Paragraph(" "));
                doc.add(new Paragraph("Total Desembolsos: $" + data.totalDesembolsos().toPlainString())
                                .setBold().setFontSize(11));

                doc.close();
                return baos.toByteArray();
        }

        // ────────────────────────────────────────────────────────────────────
        // Multas pendientes de una renovación (para la pantalla de aprobación)
        // ────────────────────────────────────────────────────────────────────

        public List<MultaDTO> getMultasPendientesByRenovacion(Long renovacionId) {
                Renovacion renovacion = findRenovacion(renovacionId);
                Long creditoAnteriorId = renovacion.getCreditoAnterior().getId();
                return multaRepo.findPendientesByCreditoId(creditoAnteriorId)
                                .stream()
                                .map(MultaDTO::from)
                                .toList();
        }

        // ────────────────────────────────────────────────────────────────────
        // Helpers
        // ────────────────────────────────────────────────────────────────────

        private List<MultaCondonadaDTO> cargarCondonadasDetalle(Renovacion r) {
                if (r.getMultasCondonadas() == null
                                || r.getMultasCondonadas().compareTo(BigDecimal.ZERO) == 0) {
                        return List.of();
                }
                return multaRepo.findByCreditoIdAndDeletedAtIsNullOrderByFechaDesc(r.getCreditoAnterior().getId())
                                .stream()
                                .filter(m -> Boolean.TRUE.equals(m.getCondonada())
                                                && m.getCondonadaEnRenovacion() != null
                                                && m.getCondonadaEnRenovacion().getId().equals(r.getId()))
                                .map(MultaCondonadaDTO::from)
                                .toList();
        }

        private Credito findCredito(Long id) {
                Credito c = creditoRepo.findById(id)
                                .orElseThrow(() -> new EntityNotFoundException("Crédito no encontrado: " + id));
                if (c.getDeletedAt() != null) {
                        throw new EntityNotFoundException("Crédito no encontrado: " + id);
                }
                return c;
        }

        private Renovacion findRenovacion(Long id) {
                Renovacion r = renovacionRepo.findById(id)
                                .orElseThrow(() -> new EntityNotFoundException("Renovación no encontrada: " + id));
                if (r.getDeletedAt() != null) {
                        throw new EntityNotFoundException("Renovación no encontrada: " + id);
                }
                return r;
        }

        private TipoPago parseTipoPago(String s) {
                try {
                        return TipoPago.valueOf(s.toUpperCase());
                } catch (IllegalArgumentException e) {
                        throw new IllegalArgumentException("tipoPago inválido: " + s);
                }
        }

        private static Cell cell(String text) {
                return new Cell().add(new Paragraph(text != null ? text : "").setFontSize(8));
        }

        public static LocalDate lunesDe(LocalDate fecha) {
                return fecha.with(DayOfWeek.MONDAY);
        }

}
