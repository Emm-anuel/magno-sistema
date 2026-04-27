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
import com.magno.dto.reporte.*;
import com.magno.dto.renovacion.ColocacionItemDTO;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.util.DateTimeUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class ReporteService {

    private static final List<String> ROLES_CAMPO = List.of("ASESOR_COBRADOR", "SUPERVISOR_CAMPO");

    private final CajaDiaRepository cajaDiaRepo;
    private final CajaMovimientoInversionRepository movimientoRepo;
    private final CreditoRepository creditoRepo;
    private final PagoRepository pagoRepo;
    private final MultaRepository multaRepo;
    private final CalendarioPagoRepository calendarioRepo;
    private final RenovacionRepository renovacionRepo;
    private final UsuarioRepository usuarioRepo;
    private final SucursalRepository sucursalRepo;

    public ReporteService(CajaDiaRepository cajaDiaRepo,
            CajaMovimientoInversionRepository movimientoRepo,
            CreditoRepository creditoRepo,
            PagoRepository pagoRepo,
            MultaRepository multaRepo,
            CalendarioPagoRepository calendarioRepo,
            RenovacionRepository renovacionRepo,
            UsuarioRepository usuarioRepo,
            SucursalRepository sucursalRepo) {
        this.cajaDiaRepo = cajaDiaRepo;
        this.movimientoRepo = movimientoRepo;
        this.creditoRepo = creditoRepo;
        this.pagoRepo = pagoRepo;
        this.multaRepo = multaRepo;
        this.calendarioRepo = calendarioRepo;
        this.renovacionRepo = renovacionRepo;
        this.usuarioRepo = usuarioRepo;
        this.sucursalRepo = sucursalRepo;
    }

    // ── Ingresos/Egresos ─────────────────────────────────────────────────

    public ReporteIngresosEgresosDTO getIngresosEgresos(Long sucursalId,
            LocalDate desde,
            LocalDate hasta) {
        List<CajaDia> dias = cajaDiaRepo.findCerradasBySucursalAndFechaRange(sucursalId, desde, hasta);

        BigDecimal totalIngresos = BigDecimal.ZERO;
        BigDecimal totalDesembolsos = BigDecimal.ZERO;
        BigDecimal totalGastos = BigDecimal.ZERO;
        BigDecimal totalNomina = BigDecimal.ZERO;

        List<FilaDiariaDTO> filas = new ArrayList<>();
        for (CajaDia dia : dias) {
            BigDecimal inversiones = coalesce(movimientoRepo.sumMontoByCajaDiaId(dia.getId()));
            BigDecimal ingresos = coalesce(dia.getIngresoCarteras());
            BigDecimal desembolsos = coalesce(dia.getDesembolsos());
            BigDecimal gastos = coalesce(dia.getTotalGastos());
            BigDecimal nomina = coalesce(dia.getTotalNomina());
            BigDecimal subtotal = coalesce(dia.getSubtotalCaja());

            filas.add(new FilaDiariaDTO(dia.getFecha(), ingresos, desembolsos, gastos, nomina, inversiones, subtotal));

            totalIngresos = totalIngresos.add(ingresos);
            totalDesembolsos = totalDesembolsos.add(desembolsos);
            totalGastos = totalGastos.add(gastos);
            totalNomina = totalNomina.add(nomina);
        }

        BigDecimal subtotalNeto = totalIngresos.subtract(totalDesembolsos).subtract(totalGastos).subtract(totalNomina);

        return new ReporteIngresosEgresosDTO(
                filas,
                totalIngresos,
                totalDesembolsos,
                totalGastos,
                totalNomina,
                subtotalNeto);
    }

    // ── Colocaciones ─────────────────────────────────────────────────────

    public ReporteColocacionesDTO getColocaciones(Long sucursalId,
            LocalDate desde,
            LocalDate hasta,
            Long asesorId) {
        OffsetDateTime inicioTs = desde.atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();
        OffsetDateTime finTs = hasta.plusDays(1).atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();

        List<Credito> nuevos = creditoRepo.findColocacionesNuevos(
                inicioTs, finTs, asesorId, sucursalId);

        List<Renovacion> renovaciones = renovacionRepo.findColocaciones(desde, hasta, asesorId, sucursalId);

        List<ColocacionItemDTO> items = new ArrayList<>();

        for (Credito c : nuevos) {
            LocalDate fecha = c.getFechaDesembolso() != null
                    ? c.getFechaDesembolso().toLocalDate()
                    : c.getFechaInicio();
            items.add(new ColocacionItemDTO(
                    fecha,
                    c.getCliente().getNombreCompleto(),
                    c.getCliente().getId(),
                    null,
                    c.getMontoCapital(),
                    c.getMontoCapital(),
                    c.getAsesor().getNombreCompleto(),
                    c.getTipoPago().name(),
                    "NUEVO",
                    c.getId()));
        }

        for (Renovacion r : renovaciones) {
            if (r.getCreditoNuevo() == null)
                continue;
            items.add(new ColocacionItemDTO(
                    r.getFecha(),
                    r.getCliente().getNombreCompleto(),
                    r.getCliente().getId(),
                    r.getCreditoAnterior().getMontoCapital(),
                    r.getCreditoNuevo().getMontoCapital(),
                    coalesce(r.getMontoDesembolso()),
                    r.getAsesor().getNombreCompleto(),
                    r.getTipoPago().name(),
                    "RENOVACION",
                    r.getId()));
        }

        items.sort(Comparator.comparing(ColocacionItemDTO::fecha));

        BigDecimal totalDesembolsos = items.stream()
                .map(ColocacionItemDTO::desembolso)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCaja = renovaciones.stream()
                .filter(r -> r.getCreditoNuevo() != null)
                .map(r -> coalesce(r.getMontoDesembolso()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new ReporteColocacionesDTO(items, totalDesembolsos, totalCaja);
    }

    // ── Cartera ──────────────────────────────────────────────────────────

    public ReporteCarteraDTO getCartera(Long sucursalId, Long asesorId, String estado) {
        List<Credito> activos = creditoRepo.findActivosBySucursalAndAsesor(sucursalId, asesorId);
        LocalDate hoy = DateTimeUtils.hoyEnMagno();

        List<CreditoActivoDTO> dtos = new ArrayList<>();
        int totalEnMora = 0;
        BigDecimal montoEnRiesgo = BigDecimal.ZERO;
        BigDecimal montoTotalColocado = BigDecimal.ZERO;

        for (Credito c : activos) {
            long atrasados = calendarioRepo.countAtrasadosByCreditoId(c.getId(), hoy);
            boolean enMora = atrasados > 0;
            long realizados = calendarioRepo.countRealizadosByCreditoId(c.getId());
            BigDecimal multasPendientes = multaRepo.sumMontosPendientesByCreditoId(c.getId());
            int pagosRestantes = c.getPlazoDias() - (int) realizados;
            BigDecimal saldoPendiente = coalesce(c.getPagoPeriodico())
                    .multiply(BigDecimal.valueOf(Math.max(pagosRestantes, 0)))
                    .setScale(2, RoundingMode.HALF_UP);

            montoTotalColocado = montoTotalColocado.add(coalesce(c.getMontoCapital()));

            if (enMora) {
                totalEnMora++;
                montoEnRiesgo = montoEnRiesgo.add(saldoPendiente);
            }

            dtos.add(new CreditoActivoDTO(
                    c.getId(),
                    c.getCliente().getNombreCompleto(),
                    c.getAsesor().getNombreCompleto(),
                    c.getMontoCapital(),
                    (int) realizados,
                    c.getPlazoDias(),
                    saldoPendiente,
                    coalesce(multasPendientes),
                    enMora));
        }

        List<CreditoActivoDTO> filtrados = switch (estado) {
            case "EN_MORA" -> dtos.stream().filter(CreditoActivoDTO::enMora).toList();
            case "AL_CORRIENTE" -> dtos.stream().filter(d -> !d.enMora()).toList();
            default -> dtos;
        };

        return new ReporteCarteraDTO(
                activos.size(),
                montoTotalColocado,
                totalEnMora,
                montoEnRiesgo,
                filtrados);
    }

    // ── Por Asesor ───────────────────────────────────────────────────────

    public ReportePorAsesorDTO getPorAsesor(Long sucursalId,
            LocalDate desde,
            LocalDate hasta,
            Long asesorId) {
        LocalDate hoy = DateTimeUtils.hoyEnMagno();

        List<Usuario> usuarios = usuarioRepo.findBySucursalId(sucursalId).stream()
                .filter(u -> u.getRol() != null && ROLES_CAMPO.contains(u.getRol().getNombre()))
                .filter(u -> asesorId == null || u.getId().equals(asesorId))
                .toList();

        List<AsesorResumenDTO> res = new ArrayList<>();

        long totalCobrosRegistrados = 0;
        BigDecimal totalMontoCobrado = BigDecimal.ZERO;
        BigDecimal totalMultasCobradas = BigDecimal.ZERO;
        int totalClientesActivos = 0;
        BigDecimal totalMontoColocado = BigDecimal.ZERO;
        int totalClientesEnMora = 0;

        for (Usuario u : usuarios) {
            long cobros = pagoRepo.countByAsesorAndFechaRange(u.getId(), desde, hasta);
            BigDecimal montoCobrado = pagoRepo.sumMontoCobradoByAsesorAndFechaRange(u.getId(), desde, hasta);
            BigDecimal multasCobradas = multaRepo.sumMultasCobradaByAsesorAndFechaRange(u.getId(), desde, hasta);
            long pagosIncompletos = pagoRepo.countIncompletosByAsesorAndFechaRange(u.getId(), desde, hasta);

            List<Credito> creditosActivos = creditoRepo.findActivosBySucursalAndAsesor(sucursalId, u.getId());
            int enMoraCount = 0;
            BigDecimal riesgo = BigDecimal.ZERO;
            BigDecimal colocado = BigDecimal.ZERO;

            for (Credito c : creditosActivos) {
                colocado = colocado.add(coalesce(c.getMontoCapital()));
                long atrasados = calendarioRepo.countAtrasadosByCreditoId(c.getId(), hoy);
                if (atrasados > 0) {
                    enMoraCount++;
                    long realizados = calendarioRepo.countRealizadosByCreditoId(c.getId());
                    int restantes = c.getPlazoDias() - (int) realizados;
                    riesgo = riesgo.add(coalesce(c.getPagoPeriodico())
                            .multiply(BigDecimal.valueOf(Math.max(restantes, 0)))
                            .setScale(2, RoundingMode.HALF_UP));
                }
            }

            res.add(new AsesorResumenDTO(
                    u.getId(), u.getNombreCompleto(),
                    cobros, coalesce(montoCobrado), coalesce(multasCobradas), pagosIncompletos,
                    creditosActivos.size(), colocado, enMoraCount, riesgo));

            totalCobrosRegistrados += cobros;
            totalMontoCobrado = totalMontoCobrado.add(coalesce(montoCobrado));
            totalMultasCobradas = totalMultasCobradas.add(coalesce(multasCobradas));
            totalClientesActivos += creditosActivos.size();
            totalMontoColocado = totalMontoColocado.add(colocado);
            totalClientesEnMora += enMoraCount;
        }

        return new ReportePorAsesorDTO(
                res,
                totalCobrosRegistrados,
                totalMontoCobrado,
                totalMultasCobradas,
                totalClientesActivos,
                totalMontoColocado,
                totalClientesEnMora);
    }

    // ── PDF Ingresos/Egresos ─────────────────────────────────────────────

    public byte[] exportarIngresosEgresosPdf(Long sucursalId, LocalDate desde, LocalDate hasta) {
        ReporteIngresosEgresosDTO datos = getIngresosEgresos(sucursalId, desde, hasta);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document doc = new Document(pdf);

        doc.add(pdfHeader("MAGNO — Reporte de Ingresos y Egresos"));
        doc.add(pdfSubtitle(resolveSucursalLabel(sucursalId)));
        doc.add(pdfSubtitle("Período: " + desde.format(fmt) + " al " + hasta.format(fmt)));
        doc.add(pdfSubtitle("Generado: " + ahoraFmt()));
        doc.add(new Paragraph(" "));

        doc.add(new Paragraph("Total Ingresos Carteras: " + fmtMonto(datos.totalIngresoCarteras())).setFontSize(10));
        doc.add(new Paragraph("Total Desembolsos: " + fmtMonto(datos.totalDesembolsos())).setFontSize(10));
        doc.add(new Paragraph("Total Gastos: " + fmtMonto(datos.totalGastos())).setFontSize(10));
        doc.add(new Paragraph("Total Nómina: " + fmtMonto(datos.totalNomina())).setFontSize(10));
        doc.add(new Paragraph("Subtotal Neto: " + fmtMonto(datos.subtotalNeto())).setBold().setFontSize(11));
        doc.add(new Paragraph(" "));

        doc.add(sectionHeader("DETALLE POR DÍA"));
        Table t = new Table(UnitValue.createPercentArray(new float[] { 65, 75, 75, 60, 60, 65, 75 }))
                .setWidth(UnitValue.createPercentValue(100));
        t.addHeaderCell(hCell("Fecha"));
        t.addHeaderCell(hCell("Ing. Carteras").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Desembolsos").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Gastos").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Nómina").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Inversiones").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Subtotal").setTextAlignment(TextAlignment.RIGHT));

        for (FilaDiariaDTO f : datos.filas()) {
            t.addCell(cell(f.fecha().format(fmt)));
            t.addCell(cell(fmtMonto(f.ingresoCarteras())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.desembolsos())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.gastos())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.nomina())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.inversiones())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.subtotalCaja())).setTextAlignment(TextAlignment.RIGHT));
        }
        doc.add(t);

        doc.close();
        return baos.toByteArray();
    }

    // ── PDF Colocaciones ─────────────────────────────────────────────────

    public byte[] exportarColocacionesPdf(Long sucursalId, LocalDate desde, LocalDate hasta, Long asesorId) {
        ReporteColocacionesDTO datos = getColocaciones(sucursalId, desde, hasta, asesorId);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(new PdfDocument(new PdfWriter(baos)));

        doc.add(pdfHeader("MAGNO — Reporte de Colocaciones"));
        doc.add(pdfSubtitle(resolveSucursalLabel(sucursalId)));
        doc.add(pdfSubtitle("Período: " + desde.format(fmt) + " al " + hasta.format(fmt)));
        doc.add(pdfSubtitle("Filtro asesor: " + resolveAsesorLabel(asesorId)));
        doc.add(pdfSubtitle("Generado: " + ahoraFmt()));
        doc.add(new Paragraph(" "));

        Table t = new Table(UnitValue.createPercentArray(new float[] { 55, 110, 70, 70, 70, 70, 80, 50 }))
                .setWidth(UnitValue.createPercentValue(100));
        t.addHeaderCell(hCell("Fecha"));
        t.addHeaderCell(hCell("Cliente"));
        t.addHeaderCell(hCell("Cto. Anterior").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Cto. Nuevo").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Desembolso").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Pago"));
        t.addHeaderCell(hCell("Asesor"));
        t.addHeaderCell(hCell("Tipo"));

        for (ColocacionItemDTO item : datos.items()) {
            t.addCell(cell(item.fecha().format(fmt)));
            t.addCell(cell(item.clienteNombre()));
            t.addCell(cell(item.creditoAnterior() != null ? fmtMonto(item.creditoAnterior()) : "—")
                    .setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(item.creditoNuevo())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(item.desembolso())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(item.tipoPago()));
            t.addCell(cell(item.asesorNombre()));
            t.addCell(cell(item.tipo()));
        }
        doc.add(t);

        doc.add(new Paragraph(" "));
        doc.add(new Paragraph("Total Desembolsos: " + fmtMonto(datos.totalDesembolsos())).setBold().setFontSize(10));
        doc.add(new Paragraph("Total Caja: " + fmtMonto(datos.totalCaja())).setBold().setFontSize(10));

        doc.close();
        return baos.toByteArray();
    }

    // ── PDF Cartera ──────────────────────────────────────────────────────

    public byte[] exportarCarteraPdf(Long sucursalId, Long asesorId, String estado) {
        ReporteCarteraDTO datos = getCartera(sucursalId, asesorId, estado);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(new PdfDocument(new PdfWriter(baos)));

        doc.add(pdfHeader("MAGNO — Reporte de Cartera"));
        doc.add(pdfSubtitle(resolveSucursalLabel(sucursalId)));
        doc.add(pdfSubtitle("Filtro asesor: " + resolveAsesorLabel(asesorId)));
        doc.add(pdfSubtitle("Estado: " + (estado == null ? "TODOS" : estado)));
        doc.add(pdfSubtitle("Generado: " + ahoraFmt()));
        doc.add(new Paragraph(" "));

        doc.add(new Paragraph("Total créditos activos: " + datos.totalCreditosActivos()).setFontSize(10));
        doc.add(new Paragraph("Monto total colocado: " + fmtMonto(datos.montoTotalColocado())).setFontSize(10));
        doc.add(new Paragraph("Créditos en mora: " + datos.creditosEnMora()).setFontSize(10));
        doc.add(new Paragraph("Monto en riesgo: " + fmtMonto(datos.montoEnRiesgo())).setFontSize(10));
        doc.add(new Paragraph(" "));

        doc.add(sectionHeader("DETALLE DE CRÉDITOS"));
        Table t = new Table(UnitValue.createPercentArray(new float[] { 120, 90, 70, 50, 70, 60, 55 }))
                .setWidth(UnitValue.createPercentValue(100));
        t.addHeaderCell(hCell("Cliente"));
        t.addHeaderCell(hCell("Asesor"));
        t.addHeaderCell(hCell("Monto").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Pagos"));
        t.addHeaderCell(hCell("Saldo Pend.").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Multas").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Estado"));

        for (CreditoActivoDTO c : datos.creditos()) {
            t.addCell(cell(c.clienteNombre()));
            t.addCell(cell(c.asesorNombre()));
            t.addCell(cell(fmtMonto(c.montoCapital())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(c.pagosRealizados() + "/" + c.pagosTotal()));
            t.addCell(cell(fmtMonto(c.saldoPendiente())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(c.multasPendientes())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(c.enMora() ? "En mora" : "Al corriente"));
        }
        doc.add(t);

        doc.close();
        return baos.toByteArray();
    }

    // ── PDF Por Asesor ───────────────────────────────────────────────────

    public byte[] exportarPorAsesorPdf(Long sucursalId, LocalDate desde, LocalDate hasta, Long asesorId) {
        ReportePorAsesorDTO datos = getPorAsesor(sucursalId, desde, hasta, asesorId);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(new PdfDocument(new PdfWriter(baos)));

        doc.add(pdfHeader("MAGNO — Reporte Por Asesor"));
        doc.add(pdfSubtitle(resolveSucursalLabel(sucursalId)));
        doc.add(pdfSubtitle("Período: " + desde.format(fmt) + " al " + hasta.format(fmt)));
        doc.add(pdfSubtitle("Filtro asesor: " + resolveAsesorLabel(asesorId)));
        doc.add(pdfSubtitle("Generado: " + ahoraFmt()));
        doc.add(new Paragraph(" "));

        Table t = new Table(UnitValue.createPercentArray(new float[] { 90, 50, 75, 75, 45, 50, 75, 45, 75 }))
                .setWidth(UnitValue.createPercentValue(100));
        t.addHeaderCell(hCell("Asesor"));
        t.addHeaderCell(hCell("Cobros").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Mto. Cobrado").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Multas Cob.").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Incompletos").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Cli. Activos").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Colocado").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("En Mora").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("En Riesgo").setTextAlignment(TextAlignment.RIGHT));

        for (AsesorResumenDTO a : datos.asesores()) {
            t.addCell(cell(a.asesorNombre()));
            t.addCell(cell(String.valueOf(a.cobrosRegistrados())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(a.montoCobrado())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(a.multasCobradas())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(String.valueOf(a.pagosIncompletos())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(String.valueOf(a.clientesActivos())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(a.montoTotalColocado())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(String.valueOf(a.clientesEnMora())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(a.montoEnRiesgo())).setTextAlignment(TextAlignment.RIGHT));
        }
        doc.add(t);

        doc.add(new Paragraph(" "));
        doc.add(new Paragraph("Totales — Cobros: " + datos.totalCobrosRegistrados()
                + " | Cobrado: " + fmtMonto(datos.totalMontoCobrado())
                + " | Multas cobradas: " + fmtMonto(datos.totalMultasCobradas())
                + " | Clientes activos: " + datos.totalClientesActivos()
                + " | En mora: " + datos.totalClientesEnMora())
                .setBold().setFontSize(9));

        doc.close();
        return baos.toByteArray();
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private BigDecimal coalesce(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private String resolveSucursalLabel(Long sucursalId) {
        if (sucursalId == null) {
            return "Sucursal: —";
        }
        Optional<Sucursal> sucursal = sucursalRepo.findById(sucursalId);
        return "Sucursal: " + sucursal.map(Sucursal::getNombre).orElse("ID " + sucursalId);
    }

    private String resolveAsesorLabel(Long asesorId) {
        if (asesorId == null)
            return "Todos";
        return usuarioRepo.findById(asesorId)
                .map(Usuario::getNombreCompleto)
                .orElse("ID " + asesorId);
    }

    private String ahoraFmt() {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        return DateTimeUtils.ahoraEnMagno().format(fmt);
    }

    private Paragraph pdfHeader(String text) {
        return new Paragraph(text).setBold().setFontSize(14).setTextAlignment(TextAlignment.CENTER);
    }

    private Paragraph pdfSubtitle(String text) {
        return new Paragraph(text).setFontSize(9).setTextAlignment(TextAlignment.CENTER);
    }

    private Paragraph sectionHeader(String text) {
        return new Paragraph(text).setBold().setFontSize(10)
                .setBackgroundColor(ColorConstants.LIGHT_GRAY).setMarginTop(8);
    }

    private Cell hCell(String text) {
        return new Cell().add(new Paragraph(text).setBold().setFontSize(8))
                .setBackgroundColor(ColorConstants.LIGHT_GRAY);
    }

    private Cell cell(String text) {
        return new Cell().add(new Paragraph(text != null ? text : "—").setFontSize(8));
    }

    private String fmtMonto(BigDecimal value) {
        if (value == null)
            return "$0.00";
        return "$" + String.format("%,.2f", value);
    }
}
