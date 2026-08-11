package com.magno.service;

import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.geom.PageSize;
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
    private final AbonoCorrienteRepository abonoCorrienteRepo;

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
            ClienteRepository clienteRepo,
            AbonoCorrienteRepository abonoCorrienteRepo) {
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
        this.abonoCorrienteRepo = abonoCorrienteRepo;
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
            BigDecimal ingresos = coalesce(pagoRepo.sumIngresoBySucursalAndFecha(sucursalId, fecha))
                    .add(coalesce(abonoCorrienteRepo.sumMontoTotalBySucursalAndFecha(sucursalId, fecha)));
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
            BigDecimal montoCobrado = coalesce(pagoRepo.sumMontoCobradoByAsesorAndFechaRange(u.getId(), desde, hasta))
                    .add(coalesce(abonoCorrienteRepo.sumMontoTotalByScopeAndFechaRange(null, u.getId(), desde, hasta)));
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
        Map<Long, Credito> ultimoCreditoPorCliente = creditoRepo
                .findForClientReport(sucursalId).stream()
                .collect(Collectors.toMap(c -> c.getCliente().getId(),
                        Function.identity(), (masReciente, anterior) -> masReciente));

        LocalDate hoy = DateTimeUtils.hoyEnMagno();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        int totalActivos = 0, totalEnMora = 0, totalSinCredito = 0, totalInactivos = 0;
        List<ReporteClientesDTO.ClienteItemDTO> items = new ArrayList<>();

        for (Cliente c : todos) {
            boolean activo = Boolean.TRUE.equals(c.getActivo());
            Credito creditoActivo = creditoPorCliente.get(c.getId());
            Credito creditoReporte = creditoActivo != null
                    ? creditoActivo
                    : ultimoCreditoPorCliente.get(c.getId());
            String estadoCliente;

            if (!activo) {
                estadoCliente = "INACTIVO";
                totalInactivos++;
            } else if (!creditoPorCliente.containsKey(c.getId())) {
                estadoCliente = "SIN_CREDITO";
                totalSinCredito++;
            } else {
                long atrasados = calendarioRepo.countAtrasadosByCreditoId(creditoActivo.getId(), hoy);
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
                    c.getNombre(),
                    c.getApellidoPaterno(),
                    c.getApellidoMaterno(),
                    c.getNombreCompleto(),
                    formatDate(c.getFechaNacimiento(), fmt),
                    c.getGenero(),
                    c.getEstadoCivil(),
                    c.getNombreConyuge(),
                    c.getTelefonoFijo(),
                    c.getCelular(),
                    c.getIneTipo(),
                    c.getIneNumero(),
                    c.getCurp(),
                    c.getRfc(),
                    c.getDomCalle(),
                    c.getDomNoExterior(),
                    c.getDomNoInterior(),
                    c.getDomColonia(),
                    c.getDomMunicipio(),
                    c.getDomEstado(),
                    c.getDomCodigoPostal(),
                    c.getDomTipoVivienda(),
                    c.getDomMontoRenta(),
                    c.getNegocioNombre(),
                    c.getNegocioGiro(),
                    c.getNegocioAntiguedad(),
                    c.getNegocioDireccion(),
                    c.getNegocioCalle(),
                    c.getNegocioNoExterior(),
                    c.getNegocioNoInterior(),
                    c.getNegocioColonia(),
                    c.getNegocioMunicipio(),
                    c.getNegocioEstado(),
                    c.getNegocioCp(),
                    c.getNegocioTipoLocal(),
                    c.getNegocioMontoRenta(),
                    c.getNegocioHorarios(),
                    c.getNegocioLat(),
                    c.getNegocioLng(),
                    c.getIngresosSemanales(),
                    c.getGastosSemanales(),
                    c.getGastosRenta(),
                    c.getGastosOtros(),
                    c.getRef1Nombre(),
                    c.getRef1Telefono(),
                    c.getRef1Parentesco(),
                    c.getRef2Nombre(),
                    c.getRef2Telefono(),
                    c.getRef2Parentesco(),
                    c.getAvalNombre(),
                    c.getAvalTelefono(),
                    c.getAvalDireccion(),
                    c.getAvalIdentificacion(),
                    c.getAsesor() != null ? c.getAsesor().getNombreCompleto() : "—",
                    c.getSucursal() != null ? c.getSucursal().getNombre() : "—",
                    estadoCliente,
                    c.getCreatedAt() != null ? c.getCreatedAt().toLocalDate().format(fmt) : "—",
                    c.getUpdatedAt() != null ? c.getUpdatedAt().toLocalDate().format(fmt) : "—",
                    creditoReporte != null ? creditoReporte.getId() : null,
                    creditoReporte != null && creditoReporte.getTipo() != null ? creditoReporte.getTipo().name() : null,
                    creditoReporte != null && creditoReporte.getTipoPago() != null ? creditoReporte.getTipoPago().name() : null,
                    creditoReporte != null
                            ? (creditoReporte.getMontoAprobado() != null
                                    ? creditoReporte.getMontoAprobado()
                                    : creditoReporte.getMontoCapital())
                            : null,
                    creditoReporte != null ? creditoReporte.getMontoSolicitado() : null,
                    creditoReporte != null ? creditoReporte.getTasaInteres() : null,
                    creditoReporte != null ? creditoReporte.getCargoFinanciero() : null,
                    creditoReporte != null ? creditoReporte.getTotalAPagar() : null,
                    creditoReporte != null ? creditoReporte.getPagoPeriodico() : null,
                    creditoReporte != null ? creditoReporte.getPlazoDias() : null,
                    creditoReporte != null ? formatDate(creditoReporte.getFechaInicio(), fmt) : null,
                    creditoReporte != null ? formatDate(creditoReporte.getFechaVencimiento(), fmt) : null,
                    creditoReporte != null && creditoReporte.getEstado() != null ? creditoReporte.getEstado().name() : null
            ));
        }

        return new ReporteClientesDTO(items, todos.size(),
                totalActivos, totalEnMora, totalSinCredito, totalInactivos);
    }

    private String formatDate(LocalDate fecha, DateTimeFormatter formatter) {
        return fecha != null ? fecha.format(formatter) : null;
    }

    // ── PDF Clientes ──────────────────────────────────────────────────────

    public byte[] exportarClientesPdf(Long sucursalId, Long asesorId, String estado) {
        ReporteClientesDTO datos = getClientes(sucursalId, asesorId, estado);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfDocument pdf = new PdfDocument(new PdfWriter(baos));
        pdf.setDefaultPageSize(PageSize.A4.rotate());
        Document doc = new Document(pdf);

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

        for (ReporteClientesDTO.ClienteItemDTO item : datos.clientes()) {
            Table detalle = new Table(UnitValue.createPercentArray(new float[] {12, 21.33f, 12, 21.33f, 12, 21.34f}))
                    .setWidth(UnitValue.createPercentValue(100))
                    .setMarginBottom(8);
            detalle.addCell(new Cell(1, 6)
                    .add(new Paragraph((item.numeroCliente() != null ? item.numeroCliente() + " — " : "")
                            + item.nombreCompleto()).setBold().setFontSize(9))
                    .setBackgroundColor(ColorConstants.LIGHT_GRAY));

            pdfDetailRow(detalle, "Nombre", item.nombre(), "Apellido paterno", item.apellidoPaterno(),
                    "Apellido materno", item.apellidoMaterno());
            pdfDetailRow(detalle, "Nacimiento", item.fechaNacimiento(), "Género", item.genero(),
                    "Estado civil", item.estadoCivil());
            pdfDetailRow(detalle, "Cónyuge", item.nombreConyuge(), "Celular", item.celular(),
                    "Teléfono fijo", item.telefonoFijo());
            pdfDetailRow(detalle, "CURP", item.curp(), "RFC", item.rfc(),
                    "Identificación", joinValues(item.ineTipo(), item.ineNumero()));

            pdfDetailRow(detalle, "Domicilio", formatAddress(item.domCalle(), item.domNoExterior(),
                            item.domNoInterior(), item.domColonia(), item.domMunicipio(), item.domEstado(),
                            item.domCodigoPostal()),
                    "Tipo vivienda", item.domTipoVivienda(), "Renta vivienda", fmtNullableMonto(item.domMontoRenta()));

            pdfDetailRow(detalle, "Negocio", item.negocioNombre(), "Giro", item.negocioGiro(),
                    "Antigüedad", item.negocioAntiguedad());
            pdfDetailRow(detalle, "Dirección negocio", businessAddress(item), "Tipo local", item.negocioTipoLocal(),
                    "Renta local", fmtNullableMonto(item.negocioMontoRenta()));
            pdfDetailRow(detalle, "Horario", item.negocioHorarios(), "Latitud", value(item.negocioLat()),
                    "Longitud", value(item.negocioLng()));

            pdfDetailRow(detalle, "Ingreso semanal", fmtNullableMonto(item.ingresosSemanales()),
                    "Gasto semanal", fmtNullableMonto(item.gastosSemanales()),
                    "Gasto renta/otros", joinValues(fmtNullableMonto(item.gastosRenta()), fmtNullableMonto(item.gastosOtros())));
            pdfDetailRow(detalle, "Referencia 1", reference(item.ref1Nombre(), item.ref1Telefono(), item.ref1Parentesco()),
                    "Referencia 2", reference(item.ref2Nombre(), item.ref2Telefono(), item.ref2Parentesco()),
                    "Aval", guarantor(item));

            pdfDetailRow(detalle, "Asesor", item.asesorNombre(), "Sucursal", item.sucursalNombre(),
                    "Estado cliente", fmtEstadoCliente(item.estadoCliente()));
            pdfDetailRow(detalle, "Alta", item.fechaAlta(), "Actualización", item.fechaActualizacion(),
                    "Crédito", item.creditoId() != null ? "#" + item.creditoId() : "Sin crédito activo");
            pdfDetailRow(detalle, "Tipo crédito", formatEnum(item.tipoCredito()),
                    "Modalidad", formatEnum(item.tipoPago()), "Estado crédito", formatEnum(item.estadoCredito()));
            pdfDetailRow(detalle, "Monto crédito", fmtNullableMonto(item.montoCredito()),
                    "Monto solicitado", fmtNullableMonto(item.montoSolicitado()),
                    "Tasa", formatRate(item.tasaInteres()));
            pdfDetailRow(detalle, "Cargo financiero", fmtNullableMonto(item.cargoFinanciero()),
                    "Total a pagar", fmtNullableMonto(item.totalAPagar()),
                    "Pago periódico", fmtNullableMonto(item.pagoPeriodico()));
            pdfDetailRow(detalle, "Plazo", item.plazoDias() != null ? item.plazoDias() + " días" : null,
                    "Inicio", item.fechaInicio(), "Vencimiento", item.fechaVencimiento());
            doc.add(detalle);
        }
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
            CellStyle currency = xlCurrency(wb);
            CellStyle percentage = xlPercentage(wb);

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
            r = xlHRow(sh, r, hdr,
                    "No.", "Nombre", "Apellido paterno", "Apellido materno", "Nombre completo",
                    "Fecha nacimiento", "Género", "Estado civil", "Cónyuge", "Teléfono fijo", "Celular",
                    "Tipo identificación", "Número identificación", "CURP", "RFC",
                    "Calle domicilio", "No. exterior", "No. interior", "Colonia", "Municipio", "Estado domicilio",
                    "Código postal", "Tipo vivienda", "Renta vivienda",
                    "Negocio", "Giro", "Antigüedad", "Dirección negocio", "Calle negocio", "No. exterior negocio",
                    "No. interior negocio", "Colonia negocio", "Municipio negocio", "Estado negocio", "CP negocio",
                    "Tipo local", "Renta local", "Horarios", "Latitud", "Longitud",
                    "Ingresos semanales", "Gastos semanales", "Gastos renta", "Otros gastos",
                    "Referencia 1", "Teléfono ref. 1", "Parentesco ref. 1", "Referencia 2", "Teléfono ref. 2",
                    "Parentesco ref. 2", "Aval", "Teléfono aval", "Dirección aval", "Identificación aval",
                    "Asesor", "Sucursal", "Estado cliente", "Alta", "Actualización",
                    "ID crédito", "Tipo crédito", "Modalidad pago", "Monto crédito", "Monto solicitado",
                    "Tasa interés", "Cargo financiero", "Total a pagar", "Pago periódico", "Plazo días",
                    "Inicio crédito", "Vencimiento crédito", "Estado crédito");

            for (ReporteClientesDTO.ClienteItemDTO item : datos.clientes()) {
                Row row = sh.createRow(r++);
                int col = 0;
                xlText(row, col++, item.numeroCliente());
                xlText(row, col++, item.nombre());
                xlText(row, col++, item.apellidoPaterno());
                xlText(row, col++, item.apellidoMaterno());
                xlText(row, col++, item.nombreCompleto());
                xlText(row, col++, item.fechaNacimiento());
                xlText(row, col++, item.genero());
                xlText(row, col++, item.estadoCivil());
                xlText(row, col++, item.nombreConyuge());
                xlText(row, col++, item.telefonoFijo());
                xlText(row, col++, item.celular());
                xlText(row, col++, item.ineTipo());
                xlText(row, col++, item.ineNumero());
                xlText(row, col++, item.curp());
                xlText(row, col++, item.rfc());
                xlText(row, col++, item.domCalle());
                xlText(row, col++, item.domNoExterior());
                xlText(row, col++, item.domNoInterior());
                xlText(row, col++, item.domColonia());
                xlText(row, col++, item.domMunicipio());
                xlText(row, col++, item.domEstado());
                xlText(row, col++, item.domCodigoPostal());
                xlText(row, col++, item.domTipoVivienda());
                xlNullableNum(row, col++, item.domMontoRenta(), currency);
                xlText(row, col++, item.negocioNombre());
                xlText(row, col++, item.negocioGiro());
                xlText(row, col++, item.negocioAntiguedad());
                xlText(row, col++, item.negocioDireccion());
                xlText(row, col++, item.negocioCalle());
                xlText(row, col++, item.negocioNoExterior());
                xlText(row, col++, item.negocioNoInterior());
                xlText(row, col++, item.negocioColonia());
                xlText(row, col++, item.negocioMunicipio());
                xlText(row, col++, item.negocioEstado());
                xlText(row, col++, item.negocioCp());
                xlText(row, col++, item.negocioTipoLocal());
                xlNullableNum(row, col++, item.negocioMontoRenta(), currency);
                xlText(row, col++, item.negocioHorarios());
                xlNullableNum(row, col++, item.negocioLat(), null);
                xlNullableNum(row, col++, item.negocioLng(), null);
                xlNullableNum(row, col++, item.ingresosSemanales(), currency);
                xlNullableNum(row, col++, item.gastosSemanales(), currency);
                xlNullableNum(row, col++, item.gastosRenta(), currency);
                xlNullableNum(row, col++, item.gastosOtros(), currency);
                xlText(row, col++, item.ref1Nombre());
                xlText(row, col++, item.ref1Telefono());
                xlText(row, col++, item.ref1Parentesco());
                xlText(row, col++, item.ref2Nombre());
                xlText(row, col++, item.ref2Telefono());
                xlText(row, col++, item.ref2Parentesco());
                xlText(row, col++, item.avalNombre());
                xlText(row, col++, item.avalTelefono());
                xlText(row, col++, item.avalDireccion());
                xlText(row, col++, item.avalIdentificacion());
                xlText(row, col++, item.asesorNombre());
                xlText(row, col++, item.sucursalNombre());
                xlText(row, col++, fmtEstadoCliente(item.estadoCliente()));
                xlText(row, col++, item.fechaAlta());
                xlText(row, col++, item.fechaActualizacion());
                if (item.creditoId() != null) row.createCell(col).setCellValue(item.creditoId());
                col++;
                xlText(row, col++, formatEnum(item.tipoCredito()));
                xlText(row, col++, formatEnum(item.tipoPago()));
                xlNullableNum(row, col++, item.montoCredito(), currency);
                xlNullableNum(row, col++, item.montoSolicitado(), currency);
                xlNullableNum(row, col++, item.tasaInteres(), percentage);
                xlNullableNum(row, col++, item.cargoFinanciero(), currency);
                xlNullableNum(row, col++, item.totalAPagar(), currency);
                xlNullableNum(row, col++, item.pagoPeriodico(), currency);
                if (item.plazoDias() != null) row.createCell(col).setCellValue(item.plazoDias());
                col++;
                xlText(row, col++, item.fechaInicio());
                xlText(row, col++, item.fechaVencimiento());
                xlText(row, col, formatEnum(item.estadoCredito()));
            }

            sh.createFreezePane(0, 6);
            sh.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(5, 5, 0, 71));
            for (int i = 0; i <= 71; i++) sh.setColumnWidth(i, i == 4 || i == 27 || i == 53 ? 9000 : 5000);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            wb.write(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Error generando Excel de clientes", e);
        }
    }

    private void pdfDetailRow(Table table,
            String label1, String value1, String label2, String value2, String label3, String value3) {
        table.addCell(hCell(label1));
        table.addCell(cell(value1));
        table.addCell(hCell(label2));
        table.addCell(cell(value2));
        table.addCell(hCell(label3));
        table.addCell(cell(value3));
    }

    private String joinValues(String... values) {
        return java.util.Arrays.stream(values)
                .filter(v -> v != null && !v.isBlank() && !"—".equals(v))
                .collect(Collectors.joining(" · "));
    }

    private String formatAddress(String calle, String exterior, String interior,
            String colonia, String municipio, String estado, String codigoPostal) {
        String numero = joinValues(exterior, interior != null && !interior.isBlank() ? "Int. " + interior : null);
        String calleNumero = joinValues(calle, numero);
        String ubicacion = joinValues(colonia, municipio, estado, codigoPostal != null ? "CP " + codigoPostal : null);
        return joinValues(calleNumero, ubicacion);
    }

    private String businessAddress(ReporteClientesDTO.ClienteItemDTO item) {
        String separada = formatAddress(item.negocioCalle(), item.negocioNoExterior(), item.negocioNoInterior(),
                item.negocioColonia(), item.negocioMunicipio(), item.negocioEstado(), item.negocioCp());
        return !separada.isBlank() ? separada : item.negocioDireccion();
    }

    private String reference(String nombre, String telefono, String parentesco) {
        return joinValues(nombre, telefono, parentesco);
    }

    private String guarantor(ReporteClientesDTO.ClienteItemDTO item) {
        return joinValues(item.avalNombre(), item.avalTelefono(), item.avalDireccion(), item.avalIdentificacion());
    }

    private String value(Object value) {
        return value != null ? value.toString() : null;
    }

    private String fmtNullableMonto(BigDecimal value) {
        return value != null ? fmtMonto(value) : null;
    }

    private String formatRate(BigDecimal rate) {
        return rate != null ? rate.multiply(BigDecimal.valueOf(100)).stripTrailingZeros().toPlainString() + "%" : null;
    }

    private String formatEnum(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = value.toLowerCase().replace('_', ' ');
        return Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1);
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

    private CellStyle xlPercentage(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        DataFormat fmt = wb.createDataFormat();
        s.setDataFormat(fmt.getFormat("0.00%"));
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

    private void xlNullableNum(Row row, int col, BigDecimal val, CellStyle style) {
        var cell = row.createCell(col);
        if (val != null) cell.setCellValue(val.doubleValue());
        if (style != null) cell.setCellStyle(style);
    }
}
