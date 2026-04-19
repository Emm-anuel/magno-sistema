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
import com.magno.dto.renovacion.*;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.service.CreditoCalculoService.ResumenCalculo;
import com.magno.util.DateTimeUtils;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
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
            EstadoCalendarioPago.PARCIAL);

    private static final List<EstadoCalendarioPago> ESTADOS_REALIZADOS = List.of(
            EstadoCalendarioPago.PAGADO,
            EstadoCalendarioPago.PARCIAL,
            EstadoCalendarioPago.ADELANTADO);

    private final RenovacionRepository renovacionRepo;
    private final CreditoRepository creditoRepo;
    private final CalendarioPagoRepository calendarioPagoRepo;
    private final MultaRepository multaRepo;
    private final UsuarioRepository usuarioRepo;
    private final CreditoCalculoService calculoService;

    public RenovacionService(RenovacionRepository renovacionRepo,
                             CreditoRepository creditoRepo,
                             CalendarioPagoRepository calendarioPagoRepo,
                             MultaRepository multaRepo,
                             UsuarioRepository usuarioRepo,
                             CreditoCalculoService calculoService) {
        this.renovacionRepo = renovacionRepo;
        this.creditoRepo = creditoRepo;
        this.calendarioPagoRepo = calendarioPagoRepo;
        this.multaRepo = multaRepo;
        this.usuarioRepo = usuarioRepo;
        this.calculoService = calculoService;
    }

    // ────────────────────────────────────────────────────────────────────
    // Cálculo previo (preview en tiempo real)
    // ────────────────────────────────────────────────────────────────────

    public RenovacionCalculoDTO calcularPreview(Long creditoId, BigDecimal montoNuevo) {
        Credito credito = findCredito(creditoId);

        if (credito.getEstado() != EstadoCredito.ACTIVO) {
            throw new IllegalArgumentException(
                    "El crédito debe estar ACTIVO para calcular una renovación. Estado: " + credito.getEstado());
        }

        long pagosRealizados = calendarioPagoRepo.countByCreditoIdAndEstadoIn(creditoId, ESTADOS_REALIZADOS);
        int umbral = credito.getPlazoDias() == 30 ? 19 : 16;
        boolean elegible = pagosRealizados >= umbral;
        if (!elegible) {
            throw new IllegalArgumentException(
                    "El cliente no es elegible para renovación. Pagos realizados: " + pagosRealizados
                    + " de " + umbral + " requeridos.");
        }

        List<CalendarioPago> pagosPendientes = calendarioPagoRepo
                .findByCreditoIdAndEstadoIn(creditoId, ESTADOS_PENDIENTES);
        int numPagosRestantes = pagosPendientes.size();
        BigDecimal montoPagosRestantes = credito.getPagoPeriodico()
                .multiply(BigDecimal.valueOf(numPagosRestantes));

        BigDecimal multasPendientes = multaRepo.sumMontosPendientesByCreditoId(creditoId);

        ResumenCalculo calculoNuevo = calculoService.calcularCredito(montoNuevo);
        BigDecimal pagoAdelantado = calculoNuevo.pagoAdelantado();

        BigDecimal desembolso = montoNuevo
                .subtract(montoPagosRestantes)
                .subtract(multasPendientes)
                .subtract(pagoAdelantado);

        boolean puedeAumentar = numPagosRestantes <= 1;
        String advertencia = null;
        if (!puedeAumentar && montoNuevo.compareTo(credito.getMontoCapital()) > 0) {
            advertencia = "Con " + numPagosRestantes + " pagos pendientes, el monto nuevo no puede superar "
                    + "$" + credito.getMontoCapital().toPlainString() + " (monto del crédito anterior).";
        }

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
                advertencia
        );
    }

    // ────────────────────────────────────────────────────────────────────
    // Procesar renovación
    // ────────────────────────────────────────────────────────────────────

    @Transactional
    public RenovacionDetalleDTO procesarRenovacion(RenovacionCreateRequest req, Long usuarioId) {
        Credito creditoAnterior = findCredito(req.creditoAnteriorId());

        if (creditoAnterior.getEstado() != EstadoCredito.ACTIVO) {
            throw new IllegalArgumentException(
                    "Solo se puede renovar un crédito ACTIVO. Estado actual: " + creditoAnterior.getEstado());
        }

        // Verificar elegibilidad
        long pagosRealizados = calendarioPagoRepo.countByCreditoIdAndEstadoIn(
                req.creditoAnteriorId(), ESTADOS_REALIZADOS);
        int umbral = creditoAnterior.getPlazoDias() == 30 ? 19 : 16;
        if (pagosRealizados < umbral) {
            throw new IllegalArgumentException(
                    "El cliente no es elegible para renovación. Pagos realizados: " + pagosRealizados
                    + "/" + umbral);
        }

        // Calcular pagos restantes y monto
        List<CalendarioPago> pagosPendientes = calendarioPagoRepo
                .findByCreditoIdAndEstadoIn(req.creditoAnteriorId(), ESTADOS_PENDIENTES);
        int numPagosRestantes = pagosPendientes.size();
        BigDecimal montoPagosRestantes = creditoAnterior.getPagoPeriodico()
                .multiply(BigDecimal.valueOf(numPagosRestantes));

        // Validar restricción de monto
        if (numPagosRestantes >= 2 && req.montoNuevo().compareTo(creditoAnterior.getMontoCapital()) > 0) {
            throw new IllegalArgumentException(
                    "Con " + numPagosRestantes + " pagos pendientes, el monto nuevo no puede superar "
                    + "$" + creditoAnterior.getMontoCapital().toPlainString());
        }

        // Validar salidaDe
        if (!"CAJA".equals(req.salidaDe()) && !"RUTA".equals(req.salidaDe())) {
            throw new IllegalArgumentException("salidaDe debe ser CAJA o RUTA");
        }

        BigDecimal multasPendientesAmt = multaRepo.sumMontosPendientesByCreditoId(req.creditoAnteriorId());
        ResumenCalculo calculoNuevo = calculoService.calcularCredito(req.montoNuevo());
        BigDecimal montoDesembolso = req.montoNuevo()
                .subtract(montoPagosRestantes)
                .subtract(multasPendientesAmt)
                .subtract(calculoNuevo.pagoAdelantado());

        TipoPago tipoPago;
        try {
            tipoPago = TipoPago.valueOf(req.tipoPago().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("tipoPago inválido: " + req.tipoPago());
        }

        Usuario asesor = creditoAnterior.getAsesor();
        Usuario creador = usuarioRepo.findById(usuarioId).orElse(null);
        LocalDate hoy = DateTimeUtils.hoyEnMagno();

        // 1. Saldar pagos pendientes del crédito anterior
        for (CalendarioPago pago : pagosPendientes) {
            pago.setEstado(EstadoCalendarioPago.PAGADO);
            calendarioPagoRepo.save(pago);
        }

        // 2. Marcar multas pendientes como cobradas (descontadas del desembolso)
        multaRepo.findByCreditoIdAndCobradaFalseAndDeletedAtIsNull(req.creditoAnteriorId())
                .forEach(m -> {
                    m.setCobrada(true);
                    multaRepo.save(m);
                });

        // 3. Cerrar crédito anterior
        creditoAnterior.setEstado(EstadoCredito.RENOVADO);
        creditoRepo.save(creditoAnterior);

        // 4. Crear nuevo crédito directamente ACTIVO
        String[] evidenciaUrls = req.evidenciaUrls() != null && !req.evidenciaUrls().isEmpty()
                ? req.evidenciaUrls().toArray(String[]::new)
                : null;

        Credito creditoNuevo = Credito.builder()
                .cliente(creditoAnterior.getCliente())
                .asesor(asesor)
                .sucursal(creditoAnterior.getSucursal())
                .montoSolicitado(req.montoNuevo())
                .montoCapital(calculoNuevo.capital())
                .montoAprobado(req.montoNuevo())
                .tasaInteres(calculoNuevo.tasa())
                .cargoFinanciero(calculoNuevo.cargoFinanciero())
                .totalAPagar(calculoNuevo.totalAPagar())
                .pagoPeriodico(calculoNuevo.pagoPeriodico())
                .plazoDias(calculoNuevo.plazo())
                .tipoPago(tipoPago)
                .pagoAdelantado(calculoNuevo.pagoAdelantado())
                .garantiaDescripcion(req.garantiaDescripcion())
                .evidenciaUrls(evidenciaUrls)
                .videoEntregaUrl(req.videoEntregaUrl())
                .estado(EstadoCredito.ACTIVO)
                .fechaInicio(hoy)
                .fechaDesembolso(DateTimeUtils.ahoraEnMagno())
                .createdBy(creador)
                .build();
        creditoRepo.save(creditoNuevo);

        // 5. Generar calendario de pagos para el nuevo crédito
        calculoService.generarCalendario(
                creditoNuevo, hoy, calculoNuevo.plazo(), calculoNuevo,
                creditoAnterior.getSucursal().getId());
        creditoRepo.save(creditoNuevo); // persiste fechaVencimiento actualizada por generarCalendario

        // 6. Registrar la renovación
        Renovacion renovacion = Renovacion.builder()
                .creditoAnterior(creditoAnterior)
                .creditoNuevo(creditoNuevo)
                .cliente(creditoAnterior.getCliente())
                .asesor(asesor)
                .fecha(hoy)
                .pagosRestantes(numPagosRestantes)
                .montoPagosRestantes(montoPagosRestantes)
                .multasPendientes(multasPendientesAmt)
                .pagoAdelantado(calculoNuevo.pagoAdelantado())
                .montoDesembolso(montoDesembolso)
                .salidaDe(req.salidaDe())
                .garantiaDescripcion(req.garantiaDescripcion())
                .evidenciaUrls(evidenciaUrls)
                .videoEntregaUrl(req.videoEntregaUrl())
                .createdBy(creador)
                .build();
        renovacionRepo.save(renovacion);

        log.info("Renovación procesada — renovacion.id=" + renovacion.getId()
                + " credito_anterior=" + creditoAnterior.getId()
                + " credito_nuevo=" + creditoNuevo.getId()
                + " monto_nuevo=" + req.montoNuevo()
                + " desembolso=" + montoDesembolso);

        return RenovacionDetalleDTO.from(renovacion);
    }

    // ────────────────────────────────────────────────────────────────────
    // Colocaciones semanales
    // ────────────────────────────────────────────────────────────────────

    public ColocacionesSemanaDTO getColocaciones(LocalDate semanaInicio, Long asesorId, Long sucursalId) {
        LocalDate semanaFin = semanaInicio.plusDays(4); // Lun–Vie

        List<ColocacionItemDTO> items = new ArrayList<>();

        // Renovaciones de la semana
        renovacionRepo.findColocaciones(semanaInicio, semanaFin, asesorId, sucursalId)
                .forEach(r -> items.add(new ColocacionItemDTO(
                        r.getFecha(),
                        r.getCliente().getNombreCompleto(),
                        r.getCliente().getId(),
                        r.getCreditoAnterior().getMontoCapital(),
                        r.getCreditoNuevo().getMontoCapital(),
                        r.getMontoDesembolso(),
                        r.getAsesor().getNombreCompleto(),
                        "RENOVACION",
                        r.getSalidaDe(),
                        r.getId())));

        // Créditos nuevos activados en la semana (fechaDesembolso en rango)
        java.time.OffsetDateTime inicioTs = semanaInicio.atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();
        java.time.OffsetDateTime finTs = semanaFin.plusDays(1).atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();
        creditoRepo.findColocacionesNuevos(EstadoCredito.ACTIVO, inicioTs, finTs, asesorId, sucursalId)
                .forEach(c -> items.add(new ColocacionItemDTO(
                        c.getFechaDesembolso().toLocalDate(),
                        c.getCliente().getNombreCompleto(),
                        c.getCliente().getId(),
                        null,
                        c.getMontoCapital(),
                        c.getMontoCapital().subtract(c.getPagoAdelantado()),
                        c.getAsesor().getNombreCompleto(),
                        "NUEVO",
                        null,
                        c.getId())));

        items.sort(Comparator.comparing(ColocacionItemDTO::fecha));

        BigDecimal totalDesembolsos = items.stream()
                .map(ColocacionItemDTO::desembolso)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCaja = items.stream()
                .filter(i -> "CAJA".equals(i.salidaDe()))
                .map(ColocacionItemDTO::desembolso)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new ColocacionesSemanaDTO(semanaInicio, semanaFin, items, totalDesembolsos, totalCaja);
    }

    // ────────────────────────────────────────────────────────────────────
    // Créditos listos para renovar
    // ────────────────────────────────────────────────────────────────────

    public List<ListoRenovarItemDTO> getListosParaRenovar(Long asesorId, Long sucursalId) {
        List<EstadoCalendarioPago> realizados = List.of(
                EstadoCalendarioPago.PAGADO,
                EstadoCalendarioPago.PARCIAL,
                EstadoCalendarioPago.ADELANTADO);

        return creditoRepo.findListosParaRenovar(asesorId, sucursalId, realizados)
                .stream()
                .map(c -> {
                    long pagosRealizados = calendarioPagoRepo
                            .countByCreditoIdAndEstadoIn(c.getId(), realizados);
                    int pagosRestantes = c.getPlazoDias() - (int) pagosRealizados;
                    BigDecimal multas = multaRepo.sumMontosPendientesByCreditoId(c.getId());

                    return new ListoRenovarItemDTO(
                            c.getCliente().getId(),
                            c.getCliente().getNombreCompleto(),
                            c.getId(),
                            c.getMontoCapital(),
                            c.getPlazoDias(),
                            c.getPagoPeriodico(),
                            c.getAsesor().getId(),
                            c.getAsesor().getNombreCompleto(),
                            c.getSucursal().getId(),
                            c.getSucursal().getNombre(),
                            pagosRealizados,
                            Math.max(0, pagosRestantes),
                            multas);
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

        float[] colWidths = {60, 120, 80, 80, 80, 100, 60};
        Table table = new Table(UnitValue.createPercentArray(colWidths));
        table.setWidth(UnitValue.createPercentValue(100));

        String[] headers = {"Fecha", "Cliente", "Créd. Anterior", "Créd. Nuevo", "Desembolso", "Asesor", "Tipo"};
        for (String h : headers) {
            table.addHeaderCell(new Cell()
                    .add(new Paragraph(h).setBold().setFontSize(9))
                    .setBackgroundColor(ColorConstants.LIGHT_GRAY));
        }

        for (ColocacionItemDTO item : data.items()) {
            table.addCell(cell(item.fecha().format(fmt)));
            table.addCell(cell(item.clienteNombre()));
            table.addCell(cell(item.creditoAnterior() != null ? "$" + item.creditoAnterior().toPlainString() : "—"));
            table.addCell(cell("$" + item.creditoNuevo().toPlainString()));
            table.addCell(cell("$" + item.desembolso().toPlainString()));
            table.addCell(cell(item.asesorNombre()));
            table.addCell(cell(item.tipo()));
        }

        doc.add(table);
        doc.add(new Paragraph(" "));
        doc.add(new Paragraph("Total Desembolsos: $" + data.totalDesembolsos().toPlainString())
                .setBold().setFontSize(11));
        doc.add(new Paragraph("Total Caja: $" + data.totalCaja().toPlainString())
                .setBold().setFontSize(11));

        doc.close();
        return baos.toByteArray();
    }

    // ────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────

    private Credito findCredito(Long id) {
        Credito c = creditoRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Crédito no encontrado: " + id));
        if (c.getDeletedAt() != null) {
            throw new EntityNotFoundException("Crédito no encontrado: " + id);
        }
        return c;
    }

    private static Cell cell(String text) {
        return new Cell().add(new Paragraph(text != null ? text : "").setFontSize(8));
    }

    public static LocalDate lunesDe(LocalDate fecha) {
        return fecha.with(DayOfWeek.MONDAY);
    }
}
