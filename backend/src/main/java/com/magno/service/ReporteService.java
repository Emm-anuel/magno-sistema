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
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormat;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
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
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

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
    private final GastoRepository gastoRepo;
    private final ClienteRepository clienteRepo;

    public ReporteService(CajaDiaRepository cajaDiaRepo,
            CajaMovimientoInversionRepository movimientoRepo,
            CreditoRepository creditoRepo,
            PagoRepository pagoRepo,
            MultaRepository multaRepo,
            CalendarioPagoRepository calendarioRepo,
            RenovacionRepository renovacionRepo,
            UsuarioRepository usuarioRepo,
            SucursalRepository sucursalRepo,
            GastoRepository gastoRepo,
            ClienteRepository clienteRepo) {
        this.cajaDiaRepo = cajaDiaRepo;
        this.movimientoRepo = movimientoRepo;
        this.creditoRepo = creditoRepo;
        this.pagoRepo = pagoRepo;
        this.multaRepo = multaRepo;
        this.calendarioRepo = calendarioRepo;
        this.renovacionRepo = renovacionRepo;
        this.usuarioRepo = usuarioRepo;
        this.sucursalRepo = sucursalRepo;
        this.gastoRepo = gastoRepo;
        this.clienteRepo = clienteRepo;
    }

    // ── Ingresos/Egresos ─────────────────────────────────────────────────

    public ReporteIngresosEgresosDTO getIngresosEgresos(Long sucursalId,
            LocalDate desde,
            LocalDate hasta) {
        Map<LocalDate, CajaDia> dias = cajaDiaRepo.findBySucursalAndFechaRange(sucursalId, desde, hasta).stream()
                .collect(Collectors.toMap(CajaDia::getFecha, Function.identity(), (a, b) -> a));

        BigDecimal totalIngresos = BigDecimal.ZERO;
        BigDecimal totalApertura = BigDecimal.ZERO;
        BigDecimal totalDesembolsos = BigDecimal.ZERO;
        BigDecimal totalGastos = BigDecimal.ZERO;
        BigDecimal totalNomina = BigDecimal.ZERO;

        List<FilaDiariaDTO> filas = new ArrayList<>();
        for (LocalDate fecha = desde; !fecha.isAfter(hasta); fecha = fecha.plusDays(1)) {
            CajaDia dia = dias.get(fecha);
            BigDecimal ingresos = coalesce(pagoRepo.sumIngresoBySucursalAndFecha(sucursalId, fecha));
            BigDecimal apertura = dia != null ? coalesce(dia.getMontoApertura()) : BigDecimal.ZERO;
            BigDecimal inversiones = dia != null ? coalesce(movimientoRepo.sumMontoByCajaDiaId(dia.getId())) : BigDecimal.ZERO;
            BigDecimal desembolsos = dia != null ? coalesce(dia.getDesembolsos()) : BigDecimal.ZERO;
            BigDecimal gastos = dia != null ? coalesce(dia.getTotalGastos()) : BigDecimal.ZERO;
            BigDecimal nomina = dia != null ? coalesce(dia.getTotalNomina()) : BigDecimal.ZERO;
            BigDecimal subtotal = dia != null && dia.getSubtotalCaja() != null
                    ? dia.getSubtotalCaja()
                    : apertura.add(ingresos).subtract(desembolsos).add(inversiones);

            if (dia == null && ingresos.compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }

            filas.add(new FilaDiariaDTO(fecha, apertura, ingresos, desembolsos, gastos, nomina, inversiones, subtotal));

            totalApertura = totalApertura.add(apertura);
            totalIngresos = totalIngresos.add(ingresos);
            totalDesembolsos = totalDesembolsos.add(desembolsos);
            totalGastos = totalGastos.add(gastos);
            totalNomina = totalNomina.add(nomina);
        }

        BigDecimal subtotalNeto = totalIngresos.subtract(totalDesembolsos).subtract(totalGastos).subtract(totalNomina);

        List<GastoReporteDTO> gastosDetalle = gastoRepo
                .findBySucursalAndFechaRange(sucursalId, desde, hasta)
                .stream()
                .map(g -> new GastoReporteDTO(
                        g.getCajaDia().getFecha(),
                        g.getCategoriaGasto() != null ? g.getCategoriaGasto().getNombre() : "—",
                        g.getConcepto(),
                        g.getMonto()))
                .toList();

        List<InversionReporteDTO> inversionesDetalle = movimientoRepo
                .findBySucursalAndFechaRange(sucursalId, desde, hasta)
                .stream()
                .map(m -> new InversionReporteDTO(
                        m.getCajaDia().getFecha(),
                        m.getConceptoInversion() != null ? m.getConceptoInversion().getNombre() : "—",
                        m.getDescripcion(),
                        m.getMonto()))
                .toList();

        return new ReporteIngresosEgresosDTO(
                filas,
                totalApertura,
                totalIngresos,
                totalDesembolsos,
                totalGastos,
                totalNomina,
                subtotalNeto,
                gastosDetalle,
                inversionesDetalle);
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
                    ? DateTimeUtils.toLocalDateEnMagno(c.getFechaDesembolso())
                    : c.getFechaInicio();
            items.add(new ColocacionItemDTO(
                    fecha,
                    c.getCliente().getNombreCompleto(),
                    c.getCliente().getId(),
                    null,
                    c.getMontoCapital(),
                    c.getMontoCapital(),
                    c.getAsesor().getNombreCompleto(),
                    c.getSucursal().getNombre(),
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
                    r.getCreditoNuevo().getSucursal().getNombre(),
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

    // ── Clientes ─────────────────────────────────────────────────────────

    public ReporteClientesDTO getClientes(Long sucursalId, Long asesorId, String estado) {
        List<Cliente> todos = asesorId != null
                ? clienteRepo.findBySucursalIdAndAsesorIdOrderByApellidoPaternoAscNombreAsc(sucursalId, asesorId)
                : clienteRepo.findBySucursalIdOrderByApellidoPaternoAscNombreAsc(sucursalId);

        // Mapa clienteId → crédito activo (evita N+1 para lookup de crédito)
        Map<Long, Credito> creditoPorCliente = creditoRepo
                .findActivosBySucursalAndAsesor(sucursalId, null).stream()
                .collect(Collectors.toMap(c -> c.getCliente().getId(),
                        Function.identity(), (a, b) -> a));

        LocalDate hoy = DateTimeUtils.hoyEnMagno();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        int totalActivos = 0, totalEnMora = 0, totalSinCredito = 0, totalInactivos = 0;
        List<ReporteClientesDTO.ClienteItemDTO> items = new ArrayList<>();

        for (Cliente c : todos) {
            boolean activo = Boolean.TRUE.equals(c.getActivo());
            String estadoCliente;

            if (!activo) {
                estadoCliente = "INACTIVO";
                totalInactivos++;
            } else if (!creditoPorCliente.containsKey(c.getId())) {
                estadoCliente = "SIN_CREDITO";
                totalSinCredito++;
            } else {
                long atrasados = calendarioRepo.countAtrasadosByCreditoId(
                        creditoPorCliente.get(c.getId()).getId(), hoy);
                if (atrasados > 0) {
                    estadoCliente = "EN_MORA";
                    totalEnMora++;
                } else {
                    estadoCliente = "ACTIVO";
                    totalActivos++;
                }
            }

            if (!"TODOS".equals(estado) && !estadoCliente.equals(estado)) continue;

            items.add(new ReporteClientesDTO.ClienteItemDTO(
                    c.getId(),
                    c.getNumeroCliente(),
                    c.getNombreCompleto(),
                    c.getCelular(),
                    c.getCurp(),
                    c.getNegocioNombre(),
                    c.getNegocioGiro(),
                    c.getAsesor() != null ? c.getAsesor().getNombreCompleto() : "—",
                    estadoCliente,
                    c.getCreatedAt() != null ? c.getCreatedAt().toLocalDate().format(fmt) : "—"
            ));
        }

        return new ReporteClientesDTO(items, todos.size(),
                totalActivos, totalEnMora, totalSinCredito, totalInactivos);
    }

    // ── PDF Clientes ──────────────────────────────────────────────────────

    public byte[] exportarClientesPdf(Long sucursalId, Long asesorId, String estado) {
        ReporteClientesDTO datos = getClientes(sucursalId, asesorId, estado);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(new PdfDocument(new PdfWriter(baos)));

        doc.add(pdfHeader("MAGNO — Reporte de Clientes"));
        doc.add(pdfSubtitle(resolveSucursalLabel(sucursalId)));
        doc.add(pdfSubtitle("Filtro asesor: " + resolveAsesorLabel(asesorId)));
        doc.add(pdfSubtitle("Estado: " + estado));
        doc.add(pdfSubtitle("Generado: " + ahoraFmt()));
        doc.add(new Paragraph(" "));

        doc.add(new Paragraph("Total clientes: " + datos.total()).setFontSize(10));
        doc.add(new Paragraph("Activos: " + datos.totalActivos()
                + "  |  En mora: " + datos.totalEnMora()
                + "  |  Sin crédito: " + datos.totalSinCredito()
                + "  |  Inactivos: " + datos.totalInactivos()).setFontSize(9));
        doc.add(new Paragraph(" "));

        float[] cols = {30, 100, 65, 90, 85, 75, 55, 45};
        Table t = new Table(UnitValue.createPercentArray(cols))
                .setWidth(UnitValue.createPercentValue(100));

        t.addHeaderCell(hCell("No."));
        t.addHeaderCell(hCell("Nombre"));
        t.addHeaderCell(hCell("Celular"));
        t.addHeaderCell(hCell("CURP"));
        t.addHeaderCell(hCell("Negocio"));
        t.addHeaderCell(hCell("Asesor"));
        t.addHeaderCell(hCell("Estado"));
        t.addHeaderCell(hCell("Alta"));

        for (ReporteClientesDTO.ClienteItemDTO item : datos.clientes()) {
            t.addCell(cell(item.numeroCliente()));
            t.addCell(cell(item.nombreCompleto()));
            t.addCell(cell(item.celular()));
            t.addCell(cell(item.curp()));
            t.addCell(cell(item.negocioNombre()));
            t.addCell(cell(item.asesorNombre()));
            t.addCell(cell(fmtEstadoCliente(item.estadoCliente())));
            t.addCell(cell(item.fechaAlta()));
        }

        doc.add(t);
        doc.close();
        return baos.toByteArray();
    }

    // ── Excel Clientes ────────────────────────────────────────────────────

    public byte[] exportarClientesExcel(Long sucursalId, Long asesorId, String estado) {
        ReporteClientesDTO datos = getClientes(sucursalId, asesorId, estado);

        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sh = wb.createSheet("Clientes");

            CellStyle title = xlTitle(wb);
            CellStyle hdr   = xlHeader(wb);

            int[] widths = {3000, 8000, 5000, 8000, 7000, 5500, 7000, 4500, 4500};
            for (int i = 0; i < widths.length; i++) sh.setColumnWidth(i, widths[i]);

            int r = 0;
            r = xlInfo(sh, r, title, "MAGNO — Reporte de Clientes");
            r = xlInfo(sh, r, null, resolveSucursalLabel(sucursalId));
            r = xlInfo(sh, r, null, "Filtro asesor: " + resolveAsesorLabel(asesorId) + "  |  Estado: " + estado);
            r = xlInfo(sh, r, null, "Total: " + datos.total()
                    + "  Activos: " + datos.totalActivos()
                    + "  En mora: " + datos.totalEnMora()
                    + "  Sin crédito: " + datos.totalSinCredito()
                    + "  Inactivos: " + datos.totalInactivos());
            r++;
            r = xlHRow(sh, r, hdr, "No.", "Nombre", "Celular", "CURP", "Negocio", "Giro", "Asesor", "Estado", "Alta");

            for (ReporteClientesDTO.ClienteItemDTO item : datos.clientes()) {
                Row row = sh.createRow(r++);
                xlText(row, 0, item.numeroCliente());
                xlText(row, 1, item.nombreCompleto());
                xlText(row, 2, item.celular());
                xlText(row, 3, item.curp());
                xlText(row, 4, item.negocioNombre());
                xlText(row, 5, item.negocioGiro());
                xlText(row, 6, item.asesorNombre());
                xlText(row, 7, fmtEstadoCliente(item.estadoCliente()));
                xlText(row, 8, item.fechaAlta());
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            wb.write(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Error generando Excel de clientes", e);
        }
    }

    private String fmtEstadoCliente(String e) {
        return switch (e) {
            case "ACTIVO"      -> "Activo";
            case "EN_MORA"     -> "En mora";
            case "SIN_CREDITO" -> "Sin crédito";
            case "INACTIVO"    -> "Inactivo";
            default            -> e;
        };
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

        doc.add(new Paragraph("Total Apertura: " + fmtMonto(datos.totalMontoApertura())).setFontSize(10));
        doc.add(new Paragraph("Total Ingresos Carteras: " + fmtMonto(datos.totalIngresoCarteras())).setFontSize(10));
        doc.add(new Paragraph("Total Desembolsos: " + fmtMonto(datos.totalDesembolsos())).setFontSize(10));
        doc.add(new Paragraph("Total Gastos: " + fmtMonto(datos.totalGastos())).setFontSize(10));
        doc.add(new Paragraph("Total Nómina: " + fmtMonto(datos.totalNomina())).setFontSize(10));
        doc.add(new Paragraph("Subtotal Neto: " + fmtMonto(datos.subtotalNeto())).setBold().setFontSize(11));
        doc.add(new Paragraph(" "));

        doc.add(sectionHeader("DETALLE POR DÍA"));
        Table t = new Table(UnitValue.createPercentArray(new float[] { 60, 65, 70, 70, 55, 55, 60, 70 }))
                .setWidth(UnitValue.createPercentValue(100));
        t.addHeaderCell(hCell("Fecha"));
        t.addHeaderCell(hCell("Apertura").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Ing. Carteras").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Desembolsos").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Gastos").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Nómina").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Inversiones").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Subtotal").setTextAlignment(TextAlignment.RIGHT));

        for (FilaDiariaDTO f : datos.filas()) {
            t.addCell(cell(f.fecha().format(fmt)));
            t.addCell(cell(fmtMonto(f.montoApertura())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.ingresoCarteras())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.desembolsos())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.gastos())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.nomina())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.inversiones())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.subtotalCaja())).setTextAlignment(TextAlignment.RIGHT));
        }
        doc.add(t);

        if (!datos.gastosDetalle().isEmpty()) {
            doc.add(new Paragraph(" "));
            doc.add(sectionHeader("DETALLE DE GASTOS"));
            Table tg = new Table(UnitValue.createPercentArray(new float[]{ 55, 90, 180, 70 }))
                    .setWidth(UnitValue.createPercentValue(100));
            tg.addHeaderCell(hCell("Fecha"));
            tg.addHeaderCell(hCell("Categoría"));
            tg.addHeaderCell(hCell("Concepto"));
            tg.addHeaderCell(hCell("Monto").setTextAlignment(TextAlignment.RIGHT));
            for (GastoReporteDTO g : datos.gastosDetalle()) {
                tg.addCell(cell(g.fecha().format(fmt)));
                tg.addCell(cell(g.categoria()));
                tg.addCell(cell(g.concepto()));
                tg.addCell(cell(fmtMonto(g.monto())).setTextAlignment(TextAlignment.RIGHT));
            }
            doc.add(tg);
        }

        if (!datos.inversionesDetalle().isEmpty()) {
            doc.add(new Paragraph(" "));
            doc.add(sectionHeader("DETALLE DE INVERSIONES"));
            Table ti = new Table(UnitValue.createPercentArray(new float[]{ 55, 90, 180, 70 }))
                    .setWidth(UnitValue.createPercentValue(100));
            ti.addHeaderCell(hCell("Fecha"));
            ti.addHeaderCell(hCell("Concepto"));
            ti.addHeaderCell(hCell("Descripción"));
            ti.addHeaderCell(hCell("Monto").setTextAlignment(TextAlignment.RIGHT));
            for (InversionReporteDTO inv : datos.inversionesDetalle()) {
                ti.addCell(cell(inv.fecha().format(fmt)));
                ti.addCell(cell(inv.concepto()));
                ti.addCell(cell(inv.descripcion()));
                ti.addCell(cell(fmtMonto(inv.monto())).setTextAlignment(TextAlignment.RIGHT));
            }
            doc.add(ti);
        }

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

    // ── Excel Ingresos/Egresos ───────────────────────────────────────────

    public byte[] exportarIngresosEgresosExcel(Long sucursalId, LocalDate desde, LocalDate hasta) {
        ReporteIngresosEgresosDTO datos = getIngresosEgresos(sucursalId, desde, hasta);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            CellStyle title = xlTitle(wb); CellStyle hdr = xlHeader(wb); CellStyle cur = xlCurrency(wb);

            // Hoja 1: resumen diario
            Sheet sheet = wb.createSheet("Ingresos y Egresos");
            int r = 0;
            r = xlInfo(sheet, r, title, "MAGNO — Reporte de Ingresos y Egresos");
            r = xlInfo(sheet, r, null, resolveSucursalLabel(sucursalId));
            r = xlInfo(sheet, r, null, "Período: " + desde.format(fmt) + " al " + hasta.format(fmt));
            r = xlInfo(sheet, r, null, "Generado: " + ahoraFmt());
            r++;
            r = xlKV(sheet, r, "Total Apertura", datos.totalMontoApertura(), hdr, cur);
            r = xlKV(sheet, r, "Total Ingresos Carteras", datos.totalIngresoCarteras(), hdr, cur);
            r = xlKV(sheet, r, "Total Desembolsos", datos.totalDesembolsos(), hdr, cur);
            r = xlKV(sheet, r, "Total Gastos", datos.totalGastos(), hdr, cur);
            r = xlKV(sheet, r, "Total Nómina", datos.totalNomina(), hdr, cur);
            r = xlKV(sheet, r, "Subtotal Neto", datos.subtotalNeto(), hdr, cur);
            r++;
            r = xlHRow(sheet, r, hdr, "Fecha", "Apertura", "Ing. Carteras", "Desembolsos", "Gastos", "Nómina", "Inversiones", "Subtotal");
            for (FilaDiariaDTO f : datos.filas()) {
                Row row = sheet.createRow(r++);
                xlText(row, 0, f.fecha().format(fmt));
                xlNum(row, 1, f.montoApertura(), cur); xlNum(row, 2, f.ingresoCarteras(), cur);
                xlNum(row, 3, f.desembolsos(), cur);  xlNum(row, 4, f.gastos(), cur);
                xlNum(row, 5, f.nomina(), cur);        xlNum(row, 6, f.inversiones(), cur);
                xlNum(row, 7, f.subtotalCaja(), cur);
            }
            for (int i = 0; i < 8; i++) sheet.autoSizeColumn(i);

            // Hoja 2: detalle de gastos
            if (!datos.gastosDetalle().isEmpty()) {
                Sheet sg = wb.createSheet("Detalle Gastos");
                int rg = 0;
                rg = xlInfo(sg, rg, title, "Detalle de Gastos");
                rg = xlInfo(sg, rg, null, "Período: " + desde.format(fmt) + " al " + hasta.format(fmt));
                rg++;
                rg = xlHRow(sg, rg, hdr, "Fecha", "Categoría", "Concepto", "Monto");
                for (GastoReporteDTO g : datos.gastosDetalle()) {
                    Row row = sg.createRow(rg++);
                    xlText(row, 0, g.fecha().format(fmt));
                    xlText(row, 1, g.categoria());
                    xlText(row, 2, g.concepto());
                    xlNum(row, 3, g.monto(), cur);
                }
                for (int i = 0; i < 4; i++) sg.autoSizeColumn(i);
            }

            // Hoja 3: detalle de inversiones
            if (!datos.inversionesDetalle().isEmpty()) {
                Sheet si = wb.createSheet("Detalle Inversiones");
                int ri = 0;
                ri = xlInfo(si, ri, title, "Detalle de Inversiones");
                ri = xlInfo(si, ri, null, "Período: " + desde.format(fmt) + " al " + hasta.format(fmt));
                ri++;
                ri = xlHRow(si, ri, hdr, "Fecha", "Concepto", "Descripción", "Monto");
                for (InversionReporteDTO inv : datos.inversionesDetalle()) {
                    Row row = si.createRow(ri++);
                    xlText(row, 0, inv.fecha().format(fmt));
                    xlText(row, 1, inv.concepto());
                    xlText(row, 2, inv.descripcion());
                    xlNum(row, 3, inv.monto(), cur);
                }
                for (int i = 0; i < 4; i++) si.autoSizeColumn(i);
            }

            wb.write(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Error generando Excel de ingresos/egresos", e);
        }
    }

    // ── Excel Colocaciones ───────────────────────────────────────────────

    public byte[] exportarColocacionesExcel(Long sucursalId, LocalDate desde, LocalDate hasta, Long asesorId) {
        ReporteColocacionesDTO datos = getColocaciones(sucursalId, desde, hasta, asesorId);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Colocaciones");
            CellStyle title = xlTitle(wb); CellStyle hdr = xlHeader(wb); CellStyle cur = xlCurrency(wb);
            int r = 0;
            r = xlInfo(sheet, r, title, "MAGNO — Reporte de Colocaciones");
            r = xlInfo(sheet, r, null, resolveSucursalLabel(sucursalId));
            r = xlInfo(sheet, r, null, "Período: " + desde.format(fmt) + " al " + hasta.format(fmt));
            r = xlInfo(sheet, r, null, "Filtro asesor: " + resolveAsesorLabel(asesorId));
            r = xlInfo(sheet, r, null, "Generado: " + ahoraFmt());
            r++;
            r = xlHRow(sheet, r, hdr, "Fecha", "Cliente", "Cto. Anterior", "Cto. Nuevo", "Desembolso", "Pago", "Asesor", "Tipo");
            for (ColocacionItemDTO item : datos.items()) {
                Row row = sheet.createRow(r++);
                xlText(row, 0, item.fecha().format(fmt));
                xlText(row, 1, item.clienteNombre());
                xlNum(row, 2, item.creditoAnterior(), cur);
                xlNum(row, 3, item.creditoNuevo(), cur);
                xlNum(row, 4, item.desembolso(), cur);
                xlText(row, 5, item.tipoPago());
                xlText(row, 6, item.asesorNombre());
                xlText(row, 7, item.tipo());
            }
            r++;
            r = xlKV(sheet, r, "Total Desembolsos", datos.totalDesembolsos(), hdr, cur);
            r = xlKV(sheet, r, "Total Caja", datos.totalCaja(), hdr, cur);
            for (int i = 0; i < 8; i++) sheet.autoSizeColumn(i);
            wb.write(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Error generando Excel de colocaciones", e);
        }
    }

    // ── Excel Cartera ────────────────────────────────────────────────────

    public byte[] exportarCarteraExcel(Long sucursalId, Long asesorId, String estado) {
        ReporteCarteraDTO datos = getCartera(sucursalId, asesorId, estado);
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Cartera");
            CellStyle title = xlTitle(wb); CellStyle hdr = xlHeader(wb); CellStyle cur = xlCurrency(wb);
            int r = 0;
            r = xlInfo(sheet, r, title, "MAGNO — Reporte de Cartera");
            r = xlInfo(sheet, r, null, resolveSucursalLabel(sucursalId));
            r = xlInfo(sheet, r, null, "Filtro asesor: " + resolveAsesorLabel(asesorId));
            r = xlInfo(sheet, r, null, "Estado: " + (estado == null ? "TODOS" : estado));
            r = xlInfo(sheet, r, null, "Generado: " + ahoraFmt());
            r++;
            r = xlKV(sheet, r, "Total créditos activos", BigDecimal.valueOf(datos.totalCreditosActivos()), hdr, xlCurrency(wb));
            r = xlKV(sheet, r, "Monto total colocado", datos.montoTotalColocado(), hdr, cur);
            r = xlKV(sheet, r, "Créditos en mora", BigDecimal.valueOf(datos.creditosEnMora()), hdr, xlCurrency(wb));
            r = xlKV(sheet, r, "Monto en riesgo", datos.montoEnRiesgo(), hdr, cur);
            r++;
            r = xlHRow(sheet, r, hdr, "Cliente", "Asesor", "Monto", "Pagos Realizados", "Pagos Total", "Saldo Pendiente", "Multas Pend.", "Estado");
            for (CreditoActivoDTO c : datos.creditos()) {
                Row row = sheet.createRow(r++);
                xlText(row, 0, c.clienteNombre());
                xlText(row, 1, c.asesorNombre());
                xlNum(row, 2, c.montoCapital(), cur);
                row.createCell(3).setCellValue(c.pagosRealizados());
                row.createCell(4).setCellValue(c.pagosTotal());
                xlNum(row, 5, c.saldoPendiente(), cur);
                xlNum(row, 6, c.multasPendientes(), cur);
                xlText(row, 7, c.enMora() ? "En mora" : "Al corriente");
            }
            for (int i = 0; i < 8; i++) sheet.autoSizeColumn(i);
            wb.write(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Error generando Excel de cartera", e);
        }
    }

    // ── Excel Por Asesor ─────────────────────────────────────────────────

    public byte[] exportarPorAsesorExcel(Long sucursalId, LocalDate desde, LocalDate hasta, Long asesorId) {
        ReportePorAsesorDTO datos = getPorAsesor(sucursalId, desde, hasta, asesorId);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("Por Asesor");
            CellStyle title = xlTitle(wb); CellStyle hdr = xlHeader(wb); CellStyle cur = xlCurrency(wb);
            int r = 0;
            r = xlInfo(sheet, r, title, "MAGNO — Reporte Por Asesor");
            r = xlInfo(sheet, r, null, resolveSucursalLabel(sucursalId));
            r = xlInfo(sheet, r, null, "Período: " + desde.format(fmt) + " al " + hasta.format(fmt));
            r = xlInfo(sheet, r, null, "Filtro asesor: " + resolveAsesorLabel(asesorId));
            r = xlInfo(sheet, r, null, "Generado: " + ahoraFmt());
            r++;
            r = xlHRow(sheet, r, hdr, "Asesor", "Cobros", "Mto. Cobrado", "Multas Cob.",
                    "Incompletos", "Cli. Activos", "Colocado", "En Mora", "En Riesgo");
            for (AsesorResumenDTO a : datos.asesores()) {
                Row row = sheet.createRow(r++);
                xlText(row, 0, a.asesorNombre());
                row.createCell(1).setCellValue(a.cobrosRegistrados());
                xlNum(row, 2, a.montoCobrado(), cur);
                xlNum(row, 3, a.multasCobradas(), cur);
                row.createCell(4).setCellValue(a.pagosIncompletos());
                row.createCell(5).setCellValue(a.clientesActivos());
                xlNum(row, 6, a.montoTotalColocado(), cur);
                row.createCell(7).setCellValue(a.clientesEnMora());
                xlNum(row, 8, a.montoEnRiesgo(), cur);
            }
            r++;
            Row totRow = sheet.createRow(r);
            xlText(totRow, 0, "TOTALES");
            totRow.createCell(1).setCellValue(datos.totalCobrosRegistrados());
            xlNum(totRow, 2, datos.totalMontoCobrado(), cur);
            xlNum(totRow, 3, datos.totalMultasCobradas(), cur);
            totRow.createCell(5).setCellValue(datos.totalClientesActivos());
            totRow.createCell(7).setCellValue(datos.totalClientesEnMora());
            for (int i = 0; i < 9; i++) sheet.autoSizeColumn(i);
            wb.write(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Error generando Excel por asesor", e);
        }
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

    // ── Excel helpers ────────────────────────────────────────────────────

    private CellStyle xlTitle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont(); f.setBold(true); f.setFontHeightInPoints((short) 13);
        s.setFont(f); return s;
    }

    private CellStyle xlHeader(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont(); f.setBold(true); f.setFontHeightInPoints((short) 10);
        s.setFont(f);
        s.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }

    private CellStyle xlCurrency(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        DataFormat fmt = wb.createDataFormat();
        s.setDataFormat(fmt.getFormat("$#,##0.00"));
        return s;
    }

    private int xlInfo(Sheet sheet, int rowIdx, CellStyle style, String text) {
        Row row = sheet.createRow(rowIdx);
        var cell = row.createCell(0);
        cell.setCellValue(text);
        if (style != null) cell.setCellStyle(style);
        return rowIdx + 1;
    }

    private int xlKV(Sheet sheet, int rowIdx, String label, BigDecimal value, CellStyle labelStyle, CellStyle numStyle) {
        Row row = sheet.createRow(rowIdx);
        var lbl = row.createCell(0); lbl.setCellValue(label); if (labelStyle != null) lbl.setCellStyle(labelStyle);
        var val = row.createCell(1); val.setCellValue(value != null ? value.doubleValue() : 0.0); if (numStyle != null) val.setCellStyle(numStyle);
        return rowIdx + 1;
    }

    private int xlHRow(Sheet sheet, int rowIdx, CellStyle style, String... cols) {
        Row row = sheet.createRow(rowIdx);
        for (int i = 0; i < cols.length; i++) {
            var cell = row.createCell(i); cell.setCellValue(cols[i]);
            if (style != null) cell.setCellStyle(style);
        }
        return rowIdx + 1;
    }

    private void xlText(Row row, int col, String val) {
        row.createCell(col).setCellValue(val != null ? val : "—");
    }

    private void xlNum(Row row, int col, BigDecimal val, CellStyle style) {
        var cell = row.createCell(col);
        cell.setCellValue(val != null ? val.doubleValue() : 0.0);
        if (style != null) cell.setCellStyle(style);
    }
}
