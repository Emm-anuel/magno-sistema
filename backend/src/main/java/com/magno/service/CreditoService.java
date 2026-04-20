package com.magno.service;

import com.magno.dto.credito.*;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.service.CreditoCalculoService.ResumenCalculo;
import com.magno.util.DateTimeUtils;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.logging.Logger;

@Service
@Transactional(readOnly = true)
public class CreditoService {

        private static final Logger log = Logger.getLogger(CreditoService.class.getName());

        // Estados que bloquean nueva solicitud del cliente
        private static final List<EstadoCredito> ESTADOS_BLOQUEANTES = List.of(
                        EstadoCredito.SOLICITADO,
                        EstadoCredito.APROBADO,
                        EstadoCredito.ACTIVO);

        // Estados que cuentan como "pago realizado" para estadísticas
        private static final List<EstadoCalendarioPago> ESTADOS_REALIZADOS = List.of(
                        EstadoCalendarioPago.PAGADO,
                        EstadoCalendarioPago.PARCIAL,
                        EstadoCalendarioPago.ADELANTADO);

        private final CreditoRepository creditoRepo;
        private final CalendarioPagoRepository calendarioPagoRepo;
        private final ClienteRepository clienteRepo;
        private final UsuarioRepository usuarioRepo;
        private final SucursalRepository sucursalRepo;
        private final CreditoCalculoService calculoService;
        private final RenovacionRepository renovacionRepo;

        public CreditoService(CreditoRepository creditoRepo,
                        CalendarioPagoRepository calendarioPagoRepo,
                        ClienteRepository clienteRepo,
                        UsuarioRepository usuarioRepo,
                        SucursalRepository sucursalRepo,
                        CreditoCalculoService calculoService,
                        RenovacionRepository renovacionRepo) {
                this.creditoRepo = creditoRepo;
                this.calendarioPagoRepo = calendarioPagoRepo;
                this.clienteRepo = clienteRepo;
                this.usuarioRepo = usuarioRepo;
                this.sucursalRepo = sucursalRepo;
                this.calculoService = calculoService;
                this.renovacionRepo = renovacionRepo;
        }

        // ────────────────────────────────────────────────────────────────────
        // Listado
        // ────────────────────────────────────────────────────────────────────

        /**
         * Listado paginado con filtros opcionales.
         * El controlador aplica las restricciones por rol antes de llamar aquí.
         */
        public Page<CreditoResumenDTO> listar(Long clienteId,
                        Long asesorId,
                        Long sucursalId,
                        EstadoCredito estado,
                        Pageable pageable) {
                Specification<Credito> spec = Specification.where(null);

                // Solo créditos no eliminados (soft delete)
                spec = spec.and((r, q, cb) -> cb.isNull(r.get("deletedAt")));

                if (clienteId != null)
                        spec = spec.and((r, q, cb) -> cb.equal(r.get("cliente").get("id"), clienteId));
                if (asesorId != null)
                        spec = spec.and((r, q, cb) -> cb.equal(r.get("asesor").get("id"), asesorId));
                if (sucursalId != null)
                        spec = spec.and((r, q, cb) -> cb.equal(r.get("sucursal").get("id"), sucursalId));
                if (estado != null)
                        spec = spec.and((r, q, cb) -> cb.equal(r.get("estado"), estado));

                // Un crédito APROBADO pendiente de desembolso no debe tener fechaDesembolso.
                // Esto evita listar registros inconsistentes para la pestaña de desembolso.
                if (estado == EstadoCredito.APROBADO) {
                        spec = spec.and((r, q, cb) -> cb.isNull(r.get("fechaDesembolso")));
                }

                return creditoRepo.findAll(spec, pageable)
                                .map(c -> {
                                        long realizados = calendarioPagoRepo.countByCreditoIdAndEstadoIn(c.getId(),
                                                        ESTADOS_REALIZADOS);
                                        return CreditoResumenDTO.from(c, realizados);
                                });
        }

        // ────────────────────────────────────────────────────────────────────
        // Detalle
        // ────────────────────────────────────────────────────────────────────

        public CreditoDetalleDTO obtenerDetalle(Long id) {
                Credito c = findCreditoActivo(id);
                return buildDetalle(c);
        }

        public List<CreditoResumenDTO> getCreditosCliente(Long clienteId) {
                return creditoRepo.findByClienteIdOrderByCreatedAtDesc(clienteId).stream()
                                .filter(c -> c.getDeletedAt() == null)
                                .map(c -> {
                                        long realizados = calendarioPagoRepo.countByCreditoIdAndEstadoIn(c.getId(),
                                                        ESTADOS_REALIZADOS);
                                        return CreditoResumenDTO.from(c, realizados);
                                })
                                .toList();
        }

        public List<CalendarioPagoDTO> getCalendario(Long creditoId) {
                return calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(creditoId)
                                .stream().map(CalendarioPagoDTO::from).toList();
        }

        // ────────────────────────────────────────────────────────────────────
        // Workflow: Crear → Aprobar → Activar
        // ────────────────────────────────────────────────────────────────────

        /**
         * Registra una nueva solicitud de crédito.
         * Estado resultante: SOLICITADO.
         */
        @Transactional
        public CreditoDetalleDTO crearSolicitud(CreditoCreateRequest req, Long usuarioId) {
                // 1. Verificar cliente
                Cliente cliente = clienteRepo.findById(req.clienteId())
                                .orElseThrow(() -> new EntityNotFoundException(
                                                "Cliente no encontrado: " + req.clienteId()));
                if (!Boolean.TRUE.equals(cliente.getActivo())) {
                        throw new IllegalArgumentException("El cliente está inactivo");
                }

                // 2. Bloquear si ya tiene crédito activo/solicitado/aprobado
                if (creditoRepo.existsByClienteIdAndEstadoIn(req.clienteId(), ESTADOS_BLOQUEANTES)) {
                        throw new IllegalArgumentException(
                                        "El cliente ya tiene un crédito activo o en proceso. " +
                                                        "Debe completarlo antes de solicitar uno nuevo.");
                }

                // 3. Resolver asesor
                Usuario asesor = usuarioRepo.findById(req.asesorId())
                                .orElseThrow(() -> new EntityNotFoundException(
                                                "Asesor no encontrado: " + req.asesorId()));

                // 4. Resolver sucursal (del request o del asesor)
                Long sucursalId = req.sucursalId() != null
                                ? req.sucursalId()
                                : asesor.getSucursal().getId();
                Sucursal sucursal = sucursalRepo.findById(sucursalId)
                                .orElseThrow(() -> new EntityNotFoundException(
                                                "Sucursal no encontrada: " + sucursalId));

                // 5. Calcular
                ResumenCalculo calculo = calculoService.calcularCredito(req.montoSolicitado());

                // 6. Tipo de pago
                TipoPago tipoPago = parseTipoPago(req.tipoPago());

                // 7. Evidencia URLs (ya subidas a S3 antes de llamar este endpoint)
                String[] evidenciaUrls = req.evidenciaUrls() != null && !req.evidenciaUrls().isEmpty()
                                ? req.evidenciaUrls().toArray(String[]::new)
                                : null;

                // 8. Creador
                Usuario creador = usuarioRepo.findById(usuarioId).orElse(null);

                Credito credito = Credito.builder()
                                .cliente(cliente)
                                .asesor(asesor)
                                .sucursal(sucursal)
                                .montoSolicitado(req.montoSolicitado())
                                .montoCapital(calculo.capital())
                                .tasaInteres(calculo.tasa())
                                .cargoFinanciero(calculo.cargoFinanciero())
                                .totalAPagar(calculo.totalAPagar())
                                .pagoPeriodico(calculo.pagoPeriodico())
                                .plazoDias(calculo.plazo())
                                .tipoPago(tipoPago)
                                .pagoAdelantado(calculo.pagoAdelantado())
                                .garantiaDescripcion(req.garantiaDescripcion())
                                .evidenciaUrls(evidenciaUrls)
                                .lugar(req.lugar())
                                .estado(EstadoCredito.SOLICITADO)
                                .createdBy(creador)
                                .build();

                creditoRepo.save(credito);

                log.info("Crédito SOLICITADO creado — id=" + credito.getId()
                                + " cliente=" + cliente.getNombreCompleto()
                                + " monto=" + calculo.capital());

                return buildDetalle(credito);
        }

        /**
         * Actualiza una solicitud de crédito en estado SOLICITADO.
         * Solo ADMINISTRADOR y SUPERVISOR deben invocar este flujo.
         */
        @Transactional
        public CreditoDetalleDTO actualizarSolicitud(Long id, CreditoActualizarSolicitudRequest req, Long usuarioId) {
                Credito c = findCreditoActivo(id);

                if (c.getEstado() != EstadoCredito.SOLICITADO) {
                        throw new IllegalArgumentException(
                                        "Solo se puede editar una solicitud en estado SOLICITADO. Estado actual: "
                                                        + c.getEstado());
                }

                Usuario asesor = usuarioRepo.findById(req.asesorId())
                                .orElseThrow(() -> new EntityNotFoundException(
                                                "Asesor no encontrado: " + req.asesorId()));
                Sucursal sucursal = asesor.getSucursal();

                ResumenCalculo calculo = calculoService.calcularCredito(req.montoSolicitado());

                String[] evidenciaUrls = req.evidenciaUrls() != null && !req.evidenciaUrls().isEmpty()
                                ? req.evidenciaUrls().toArray(String[]::new)
                                : null;

                c.setAsesor(asesor);
                c.setSucursal(sucursal);
                c.setMontoSolicitado(req.montoSolicitado());
                c.setMontoCapital(calculo.capital());
                c.setTasaInteres(calculo.tasa());
                c.setCargoFinanciero(calculo.cargoFinanciero());
                c.setTotalAPagar(calculo.totalAPagar());
                c.setPagoPeriodico(calculo.pagoPeriodico());
                c.setPlazoDias(calculo.plazo());
                c.setPagoAdelantado(calculo.pagoAdelantado());
                c.setTipoPago(parseTipoPago(req.tipoPago()));
                c.setGarantiaDescripcion(req.garantiaDescripcion());
                c.setEvidenciaUrls(evidenciaUrls);
                c.setLugar(req.lugar());

                creditoRepo.save(c);

                log.info("Solicitud de crédito actualizada — id=" + c.getId()
                                + " monto=" + calculo.capital()
                                + " usuario=" + usuarioId);

                return buildDetalle(c);
        }

        /**
         * Aprueba una solicitud. Solo ADMINISTRADOR y SUPERVISOR.
         * Puede modificar el monto (monto_aprobado ≠ monto_capital).
         * Estado resultante: APROBADO.
         */
        @Transactional
        public CreditoDetalleDTO aprobarCredito(Long id, CreditoAprobarRequest req, Long usuarioId) {
                Credito c = findCreditoActivo(id);

                if (c.getEstado() != EstadoCredito.SOLICITADO) {
                        throw new IllegalArgumentException(
                                        "Solo se puede aprobar un crédito en estado SOLICITADO. Estado actual: "
                                                        + c.getEstado());
                }

                // Recalcular con el monto aprobado (puede diferir del solicitado)
                ResumenCalculo calculo = calculoService.calcularCredito(req.montoAprobado());

                Usuario aprobadoPorUsuario = usuarioRepo.findById(usuarioId)
                                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + usuarioId));

                c.setMontoAprobado(req.montoAprobado());
                // Actualizar montoCapital para reflejar el monto aprobado (puede diferir del
                // solicitado)
                c.setMontoCapital(req.montoAprobado());
                // Mantener montoSolicitado histórico y recalcular campos operativos con monto
                // aprobado
                c.setTasaInteres(calculo.tasa());
                c.setCargoFinanciero(calculo.cargoFinanciero());
                c.setTotalAPagar(calculo.totalAPagar());
                c.setPagoPeriodico(calculo.pagoPeriodico());
                c.setPlazoDias(calculo.plazo());
                c.setPagoAdelantado(calculo.pagoAdelantado());
                c.setObservaciones(req.observaciones());
                c.setFechaAprobacion(DateTimeUtils.ahoraEnMagno());
                c.setAprobadoPor(aprobadoPorUsuario);
                c.setEstado(EstadoCredito.APROBADO);

                creditoRepo.save(c);

                log.info("Crédito APROBADO — id=" + c.getId()
                                + " monto_aprobado=" + req.montoAprobado()
                                + " aprobado_por=" + aprobadoPorUsuario.getNombreCompleto());

                return buildDetalle(c);
        }

        /**
         * Activa un crédito: genera el calendario de pagos con la fecha de hoy.
         * Estado resultante: ACTIVO.
         */
        @Transactional
        public CreditoDetalleDTO activarCredito(Long id, Long usuarioId) {
                Credito c = findCreditoActivo(id);

                // Blindaje ante datos inconsistentes históricos: si ya existe desembolso o
                // calendario, no debe volver a activarse.
                boolean yaTieneCalendario = !calendarioPagoRepo
                                .findByCreditoIdOrderByNumeroPago(c.getId())
                                .isEmpty();
                if (c.getFechaDesembolso() != null || c.getFechaInicio() != null || yaTieneCalendario) {
                        throw new IllegalArgumentException(
                                        "El crédito ya tiene desembolso/calendario registrado y no puede activarse nuevamente");
                }

                if (c.getEstado() != EstadoCredito.APROBADO) {
                        throw new IllegalArgumentException(
                                        "Solo se puede activar un crédito en estado APROBADO. Estado actual: "
                                                        + c.getEstado());
                }

                // Usar monto aprobado si existe, si no el monto capital original
                BigDecimal montoBase = c.getMontoAprobado() != null ? c.getMontoAprobado() : c.getMontoCapital();
                ResumenCalculo calculo = calculoService.calcularCredito(montoBase);

                LocalDate hoy = DateTimeUtils.hoyEnMagno();

                // Generar calendario (modifica c.fechaVencimiento in-place)
                calculoService.generarCalendario(c, hoy, calculo.plazo(), calculo, c.getSucursal().getId());

                c.setFechaInicio(hoy);
                c.setFechaDesembolso(DateTimeUtils.ahoraEnMagno());
                c.setEstado(EstadoCredito.ACTIVO);

                creditoRepo.save(c);

                log.info("Crédito ACTIVO — id=" + c.getId()
                                + " inicio=" + hoy
                                + " vencimiento=" + c.getFechaVencimiento());

                return buildDetalle(c);
        }

        /**
         * Sube o reemplaza el video de entrega de dinero.
         * El crédito no necesita estar ACTIVO (puede subirse en cualquier estado no
         * cancelado).
         */
        @Transactional
        public CreditoDetalleDTO subirVideoEntrega(Long id, String videoUrl) {
                Credito c = findCreditoActivo(id);

                if (c.getEstado() == EstadoCredito.CANCELADO) {
                        throw new IllegalArgumentException("No se puede actualizar un crédito cancelado");
                }

                c.setVideoEntregaUrl(videoUrl);
                creditoRepo.save(c);

                log.info("Video entrega actualizado — id=" + c.getId());

                return buildDetalle(c);
        }

        /**
         * Cancela una solicitud o aprobación pendiente.
         * Solo se pueden cancelar créditos en estado SOLICITADO o APROBADO.
         */
        @Transactional
        public CreditoDetalleDTO cancelarCredito(Long id, String motivo) {
                Credito c = findCreditoActivo(id);

                if (c.getEstado() == EstadoCredito.ACTIVO) {
                        throw new IllegalArgumentException(
                                        "No se puede cancelar un crédito activo. " +
                                                        "Solo se pueden cancelar solicitudes en estado SOLICITADO o APROBADO.");
                }
                if (c.getEstado() == EstadoCredito.CANCELADO) {
                        throw new IllegalArgumentException("El crédito ya está cancelado");
                }
                if (c.getEstado() == EstadoCredito.PAGADO || c.getEstado() == EstadoCredito.RENOVADO) {
                        throw new IllegalArgumentException(
                                        "No se puede cancelar un crédito en estado " + c.getEstado());
                }

                c.setEstado(EstadoCredito.CANCELADO);
                c.setObservaciones(motivo);
                c.setDeletedAt(DateTimeUtils.ahoraEnMagno());

                creditoRepo.save(c);

                log.info("Crédito CANCELADO — id=" + c.getId() + " motivo=" + motivo);

                return buildDetalle(c);
        }

        // ────────────────────────────────────────────────────────────────────
        // Helpers privados
        // ────────────────────────────────────────────────────────────────────

        private Credito findCreditoActivo(Long id) {
                Credito c = creditoRepo.findById(id)
                                .orElseThrow(() -> new EntityNotFoundException("Crédito no encontrado: " + id));
                if (c.getDeletedAt() != null) {
                        throw new EntityNotFoundException("Crédito no encontrado: " + id);
                }
                return c;
        }

        private TipoPago parseTipoPago(String tipoPagoStr) {
                try {
                        return TipoPago.valueOf(tipoPagoStr.toUpperCase());
                } catch (IllegalArgumentException e) {
                        throw new IllegalArgumentException(
                                        "tipo_pago inválido: '" + tipoPagoStr + "'. Valores válidos: DIARIO, SEMANAL");
                }
        }

        private CreditoDetalleDTO buildDetalle(Credito c) {
                List<CalendarioPagoDTO> calendario = calendarioPagoRepo
                                .findByCreditoIdOrderByNumeroPago(c.getId())
                                .stream().map(CalendarioPagoDTO::from).toList();

                LocalDate hoy = DateTimeUtils.hoyEnMagno();
                long pagosRealizados = calendarioPagoRepo.countByCreditoIdAndEstadoIn(c.getId(), ESTADOS_REALIZADOS);
                long pagosPendientes = calendarioPagoRepo.countByCreditoIdAndEstadoIn(
                                c.getId(), List.of(EstadoCalendarioPago.PENDIENTE));
                long pagosVencidos = calendario.stream()
                                .filter(p -> EstadoCalendarioPago.PENDIENTE.name().equals(p.estado())
                                                && p.fechaProgramada() != null
                                                && p.fechaProgramada().isBefore(hoy))
                                .count();

                long pagosNoPagados = calendarioPagoRepo.countByCreditoIdAndEstadoIn(
                                c.getId(), List.of(EstadoCalendarioPago.NO_PAGADO));
                pagosVencidos += pagosNoPagados;

                BigDecimal multasPendientes = creditoRepo.sumMultasPendientes(c.getId());

                int umbralRenovacion = c.getPlazoDias() == 30 ? 19 : 16;
                boolean elegibleRenovacion = c.getEstado() == EstadoCredito.ACTIVO
                                && pagosRealizados >= umbralRenovacion;

                CreditoDetalleDTO.Estadisticas stats = new CreditoDetalleDTO.Estadisticas(
                                pagosRealizados,
                                pagosPendientes,
                                pagosVencidos,
                                multasPendientes,
                                elegibleRenovacion);

                // Vínculo: este crédito fue liquidado por una renovación (estado RENOVADO)
                RenovacionVinculoDTO liquidadoPorRenovacion = null;
                if (c.getEstado() == EstadoCredito.RENOVADO) {
                        liquidadoPorRenovacion = renovacionRepo
                                        .findActivaByCreditoAnteriorId(c.getId())
                                        .map(r -> new RenovacionVinculoDTO(
                                                        r.getId(),
                                                        r.getCreatedAt(),
                                                        r.getPagosRestantes(),
                                                        r.getMontoPagosRestantes(),
                                                        r.getMontoDesembolso(),
                                                        r.getCreditoNuevo().getId(),
                                                        r.getCreditoNuevo().getMontoCapital()))
                                        .orElse(null);
                }

                // Vínculo: este crédito fue creado como resultado de una renovación
                RenovacionVinculoDTO originadoPorRenovacion = renovacionRepo
                                .findActivaByCreditoNuevoId(c.getId())
                                .map(r -> new RenovacionVinculoDTO(
                                                r.getId(),
                                                r.getCreatedAt(),
                                                r.getPagosRestantes(),
                                                r.getMontoPagosRestantes(),
                                                r.getMontoDesembolso(),
                                                r.getCreditoAnterior().getId(),
                                                r.getCreditoAnterior().getMontoCapital()))
                                .orElse(null);

                return CreditoDetalleDTO.from(c, calendario, stats, liquidadoPorRenovacion, originadoPorRenovacion);
        }
}
