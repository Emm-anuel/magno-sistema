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
import com.magno.dto.cliente.ClienteDetalleDTO;
import com.magno.util.DateTimeUtils;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
public class ClientePdfService {

    private static final DateTimeFormatter FMT_FECHA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter FMT_DT    = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    // ══════════════════════════════════════════════════════════════
    // PDF
    // ══════════════════════════════════════════════════════════════

    public byte[] generarFichaPdf(ClienteDetalleDTO c) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(new PdfDocument(new PdfWriter(baos)));

        doc.add(new Paragraph("MAGNO — Ficha de Cliente")
                .setBold().setFontSize(14).setTextAlignment(TextAlignment.CENTER));

        String subInfo = c.sucursal().nombre();
        if (c.numeroCliente() != null) subInfo = "No. " + c.numeroCliente() + " · " + subInfo;
        doc.add(new Paragraph(subInfo).setFontSize(9).setTextAlignment(TextAlignment.CENTER));
        doc.add(new Paragraph("Generado: " + DateTimeUtils.ahoraEnMagno().format(FMT_DT))
                .setFontSize(9).setTextAlignment(TextAlignment.CENTER));
        doc.add(new Paragraph(" "));

        doc.add(pdfSeccion("DATOS PERSONALES"));
        Table dp = pdfTabla();
        pdfFila(dp, "Nombre completo",  c.nombreCompleto());
        pdfFila(dp, "Fecha nacimiento", fmtFecha(c.fechaNacimiento()));
        pdfFila(dp, "Género",           c.genero());
        pdfFila(dp, "Estado civil",     fmtEstadoCivil(c.estadoCivil()));
        pdfFila(dp, "Cónyuge",          c.nombreConyuge());
        pdfFila(dp, "Celular",          c.celular());
        pdfFila(dp, "Teléfono fijo",    c.telefonoFijo());
        doc.add(dp);

        doc.add(pdfSeccion("IDENTIFICACIÓN"));
        Table id = pdfTabla();
        pdfFila(id, "INE tipo",   c.ineTipo());
        pdfFila(id, "INE número", c.ineNumero());
        pdfFila(id, "CURP",       c.curp());
        pdfFila(id, "RFC",        c.rfc());
        doc.add(id);

        doc.add(pdfSeccion("DOMICILIO"));
        Table dom = pdfTabla();
        pdfFila(dom, "Calle",         buildDomCalle(c));
        pdfFila(dom, "Colonia",       c.domColonia());
        pdfFila(dom, "Municipio",     c.domMunicipio());
        pdfFila(dom, "Estado / C.P.", c.domEstado() + " / " + c.domCodigoPostal());
        pdfFila(dom, "Tipo vivienda", c.domTipoVivienda());
        pdfFila(dom, "Renta mensual", fmtMonto(c.domMontoRenta()));
        doc.add(dom);

        doc.add(pdfSeccion("NEGOCIO"));
        Table neg = pdfTabla();
        pdfFila(neg, "Nombre",      c.negocioNombre());
        pdfFila(neg, "Giro",        c.negocioGiro());
        pdfFila(neg, "Antigüedad",  c.negocioAntiguedad());
        pdfFila(neg, "Dirección",   buildDirNegocio(c));
        pdfFila(neg, "Tipo local",  c.negocioTipoLocal());
        pdfFila(neg, "Renta local", fmtMonto(c.negocioMontoRenta()));
        pdfFila(neg, "Horarios",    c.negocioHorarios());
        doc.add(neg);

        if (hasFinanzas(c)) {
            doc.add(pdfSeccion("FINANZAS"));
            Table fin = pdfTabla();
            pdfFila(fin, "Ingresos semanales", fmtMonto(c.ingresosSemanales()));
            pdfFila(fin, "Gastos semanales",   fmtMonto(c.gastosSemanales()));
            pdfFila(fin, "Gastos renta",       fmtMonto(c.gastosRenta()));
            pdfFila(fin, "Gastos otros",       fmtMonto(c.gastosOtros()));
            doc.add(fin);
        }

        doc.add(pdfSeccion("REFERENCIAS PERSONALES"));
        Table ref = pdfTabla();
        pdfFila(ref, "Referencia 1", c.ref1Nombre() + " — " + c.ref1Parentesco());
        pdfFila(ref, "Teléfono",     c.ref1Telefono());
        pdfFila(ref, "Referencia 2", c.ref2Nombre() + " — " + c.ref2Parentesco());
        pdfFila(ref, "Teléfono",     c.ref2Telefono());
        doc.add(ref);

        if (c.avalNombre() != null && !c.avalNombre().isBlank()) {
            doc.add(pdfSeccion("AVAL"));
            Table av = pdfTabla();
            pdfFila(av, "Nombre",         c.avalNombre());
            pdfFila(av, "Teléfono",       c.avalTelefono());
            pdfFila(av, "Dirección",      c.avalDireccion());
            pdfFila(av, "Identificación", c.avalIdentificacion());
            doc.add(av);
        }

        doc.add(pdfSeccion("ASIGNACIÓN"));
        Table asig = pdfTabla();
        pdfFila(asig, "Asesor",   c.asesor() != null ? c.asesor().nombreCompleto() : "—");
        pdfFila(asig, "Sucursal", c.sucursal().nombre());
        doc.add(asig);

        doc.close();
        return baos.toByteArray();
    }

    private Paragraph pdfSeccion(String titulo) {
        return new Paragraph(titulo).setBold().setFontSize(9)
                .setBackgroundColor(ColorConstants.LIGHT_GRAY)
                .setMarginTop(8).setMarginBottom(2);
    }

    private Table pdfTabla() {
        return new Table(UnitValue.createPercentArray(new float[]{30, 70}))
                .setWidth(UnitValue.createPercentValue(100));
    }

    private void pdfFila(Table t, String label, String valor) {
        t.addCell(new Cell().add(new Paragraph(label).setFontSize(8).setBold()));
        t.addCell(new Cell().add(new Paragraph(
                valor != null && !valor.isBlank() ? valor : "—").setFontSize(8)));
    }

    // ══════════════════════════════════════════════════════════════
    // Excel
    // ══════════════════════════════════════════════════════════════

    public byte[] generarFichaExcel(ClienteDetalleDTO c) throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            XSSFSheet sh = wb.createSheet("Ficha Cliente");
            sh.setColumnWidth(0, 7000);
            sh.setColumnWidth(1, 14000);

            XSSFCellStyle styleTitle   = styleTitle(wb);
            XSSFCellStyle styleSub     = styleSub(wb);
            XSSFCellStyle styleSection = styleSection(wb);
            XSSFCellStyle styleLabel   = styleLabel(wb);
            XSSFCellStyle styleValue   = styleValue(wb);

            int r = 0;

            // Título
            r = xlMerged(sh, r, "MAGNO — Ficha de Cliente", styleTitle);
            String subInfo = c.sucursal().nombre();
            if (c.numeroCliente() != null) subInfo = "No. " + c.numeroCliente() + " · " + subInfo;
            r = xlMerged(sh, r, subInfo, styleSub);
            r = xlMerged(sh, r, "Generado: " + DateTimeUtils.ahoraEnMagno().format(FMT_DT), styleSub);
            r++;

            // Datos personales
            r = xlSection(sh, r, "DATOS PERSONALES", styleSection);
            r = xlRow(sh, r, "Nombre completo",  c.nombreCompleto(),          styleLabel, styleValue);
            r = xlRow(sh, r, "Fecha nacimiento", fmtFecha(c.fechaNacimiento()), styleLabel, styleValue);
            r = xlRow(sh, r, "Género",           c.genero(),                   styleLabel, styleValue);
            r = xlRow(sh, r, "Estado civil",     fmtEstadoCivil(c.estadoCivil()), styleLabel, styleValue);
            r = xlRow(sh, r, "Cónyuge",          c.nombreConyuge(),            styleLabel, styleValue);
            r = xlRow(sh, r, "Celular",          c.celular(),                  styleLabel, styleValue);
            r = xlRow(sh, r, "Teléfono fijo",    c.telefonoFijo(),             styleLabel, styleValue);

            // Identificación
            r = xlSection(sh, r, "IDENTIFICACIÓN", styleSection);
            r = xlRow(sh, r, "INE tipo",   c.ineTipo(),   styleLabel, styleValue);
            r = xlRow(sh, r, "INE número", c.ineNumero(), styleLabel, styleValue);
            r = xlRow(sh, r, "CURP",       c.curp(),      styleLabel, styleValue);
            r = xlRow(sh, r, "RFC",        c.rfc(),       styleLabel, styleValue);

            // Domicilio
            r = xlSection(sh, r, "DOMICILIO", styleSection);
            r = xlRow(sh, r, "Calle",         buildDomCalle(c),                               styleLabel, styleValue);
            r = xlRow(sh, r, "Colonia",       c.domColonia(),                                 styleLabel, styleValue);
            r = xlRow(sh, r, "Municipio",     c.domMunicipio(),                               styleLabel, styleValue);
            r = xlRow(sh, r, "Estado / C.P.", c.domEstado() + " / " + c.domCodigoPostal(),    styleLabel, styleValue);
            r = xlRow(sh, r, "Tipo vivienda", c.domTipoVivienda(),                            styleLabel, styleValue);
            r = xlRow(sh, r, "Renta mensual", fmtMonto(c.domMontoRenta()),                    styleLabel, styleValue);

            // Negocio
            r = xlSection(sh, r, "NEGOCIO", styleSection);
            r = xlRow(sh, r, "Nombre",      c.negocioNombre(),           styleLabel, styleValue);
            r = xlRow(sh, r, "Giro",        c.negocioGiro(),             styleLabel, styleValue);
            r = xlRow(sh, r, "Antigüedad",  c.negocioAntiguedad(),       styleLabel, styleValue);
            r = xlRow(sh, r, "Dirección",   buildDirNegocio(c),          styleLabel, styleValue);
            r = xlRow(sh, r, "Tipo local",  c.negocioTipoLocal(),        styleLabel, styleValue);
            r = xlRow(sh, r, "Renta local", fmtMonto(c.negocioMontoRenta()), styleLabel, styleValue);
            r = xlRow(sh, r, "Horarios",    c.negocioHorarios(),         styleLabel, styleValue);

            // Finanzas
            if (hasFinanzas(c)) {
                r = xlSection(sh, r, "FINANZAS", styleSection);
                r = xlRow(sh, r, "Ingresos semanales", fmtMonto(c.ingresosSemanales()), styleLabel, styleValue);
                r = xlRow(sh, r, "Gastos semanales",   fmtMonto(c.gastosSemanales()),   styleLabel, styleValue);
                r = xlRow(sh, r, "Gastos renta",       fmtMonto(c.gastosRenta()),       styleLabel, styleValue);
                r = xlRow(sh, r, "Gastos otros",       fmtMonto(c.gastosOtros()),       styleLabel, styleValue);
            }

            // Referencias
            r = xlSection(sh, r, "REFERENCIAS PERSONALES", styleSection);
            r = xlRow(sh, r, "Referencia 1", c.ref1Nombre() + " — " + c.ref1Parentesco(), styleLabel, styleValue);
            r = xlRow(sh, r, "Teléfono",     c.ref1Telefono(),                             styleLabel, styleValue);
            r = xlRow(sh, r, "Referencia 2", c.ref2Nombre() + " — " + c.ref2Parentesco(), styleLabel, styleValue);
            r = xlRow(sh, r, "Teléfono",     c.ref2Telefono(),                             styleLabel, styleValue);

            // Aval
            if (c.avalNombre() != null && !c.avalNombre().isBlank()) {
                r = xlSection(sh, r, "AVAL", styleSection);
                r = xlRow(sh, r, "Nombre",         c.avalNombre(),         styleLabel, styleValue);
                r = xlRow(sh, r, "Teléfono",       c.avalTelefono(),       styleLabel, styleValue);
                r = xlRow(sh, r, "Dirección",      c.avalDireccion(),      styleLabel, styleValue);
                r = xlRow(sh, r, "Identificación", c.avalIdentificacion(), styleLabel, styleValue);
            }

            // Asignación
            r = xlSection(sh, r, "ASIGNACIÓN", styleSection);
            xlRow(sh, r, "Asesor",   c.asesor() != null ? c.asesor().nombreCompleto() : "—", styleLabel, styleValue);
            r++;
            xlRow(sh, r, "Sucursal", c.sucursal().nombre(), styleLabel, styleValue);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            wb.write(baos);
            return baos.toByteArray();
        }
    }

    // ── Excel helpers ─────────────────────────────────────────────

    private int xlMerged(XSSFSheet sh, int rowIdx, String text, XSSFCellStyle style) {
        XSSFRow row = sh.createRow(rowIdx);
        var cell = row.createCell(0);
        cell.setCellValue(text);
        cell.setCellStyle(style);
        sh.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, 1));
        return rowIdx + 1;
    }

    private int xlSection(XSSFSheet sh, int rowIdx, String text, XSSFCellStyle style) {
        XSSFRow row = sh.createRow(rowIdx);
        var cell = row.createCell(0);
        cell.setCellValue(text);
        cell.setCellStyle(style);
        sh.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, 1));
        return rowIdx + 1;
    }

    private int xlRow(XSSFSheet sh, int rowIdx, String label, String value,
                      XSSFCellStyle labelStyle, XSSFCellStyle valueStyle) {
        XSSFRow row = sh.createRow(rowIdx);
        var c0 = row.createCell(0);
        c0.setCellValue(label);
        c0.setCellStyle(labelStyle);
        var c1 = row.createCell(1);
        c1.setCellValue(value != null && !value.isBlank() ? value : "—");
        c1.setCellStyle(valueStyle);
        return rowIdx + 1;
    }

    // ── Excel styles ──────────────────────────────────────────────

    private XSSFCellStyle styleTitle(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setBold(true); f.setFontHeightInPoints((short) 13);
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        return s;
    }

    private XSSFCellStyle styleSub(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setFontHeightInPoints((short) 9);
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        return s;
    }

    private XSSFCellStyle styleSection(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setBold(true); f.setFontHeightInPoints((short) 9);
        s.setFont(f);
        s.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }

    private XSSFCellStyle styleLabel(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setBold(true); f.setFontHeightInPoints((short) 9);
        s.setFont(f);
        s.setBorderBottom(BorderStyle.THIN);
        s.setBorderRight(BorderStyle.THIN);
        s.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }

    private XSSFCellStyle styleValue(XSSFWorkbook wb) {
        XSSFCellStyle s = wb.createCellStyle();
        XSSFFont f = wb.createFont();
        f.setFontHeightInPoints((short) 9);
        s.setFont(f);
        s.setBorderBottom(BorderStyle.THIN);
        return s;
    }

    // ── Shared helpers ────────────────────────────────────────────

    private String fmtFecha(Object fecha) {
        if (fecha == null) return "—";
        return LocalDate.parse(fecha.toString()).format(FMT_FECHA);
    }

    private String fmtMonto(BigDecimal v) {
        if (v == null) return "—";
        return String.format("$%,.2f", v);
    }

    private String fmtEstadoCivil(String v) {
        if (v == null) return "—";
        return switch (v) {
            case "SOLTERO"     -> "Soltero(a)";
            case "CASADO"      -> "Casado(a)";
            case "UNION_LIBRE" -> "Unión libre";
            default            -> v;
        };
    }

    private String buildDomCalle(ClienteDetalleDTO c) {
        StringBuilder sb = new StringBuilder(c.domCalle()).append(" #").append(c.domNoExterior());
        if (c.domNoInterior() != null) sb.append(" Int. ").append(c.domNoInterior());
        return sb.toString();
    }

    private String buildDirNegocio(ClienteDetalleDTO c) {
        if (c.negocioCalle() != null && !c.negocioCalle().isBlank()) {
            StringBuilder sb = new StringBuilder(c.negocioCalle());
            if (c.negocioNoExterior() != null) sb.append(" #").append(c.negocioNoExterior());
            if (c.negocioNoInterior() != null) sb.append(" Int. ").append(c.negocioNoInterior());
            if (c.negocioColonia()    != null) sb.append(", ").append(c.negocioColonia());
            if (c.negocioMunicipio()  != null) sb.append(", ").append(c.negocioMunicipio());
            return sb.toString();
        }
        return c.negocioDireccion() != null ? c.negocioDireccion() : "—";
    }

    private boolean hasFinanzas(ClienteDetalleDTO c) {
        return c.ingresosSemanales() != null || c.gastosSemanales() != null
                || c.gastosRenta() != null || c.gastosOtros() != null;
    }
}
