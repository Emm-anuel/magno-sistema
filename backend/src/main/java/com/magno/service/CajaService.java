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
import com.magno.dto.caja.*;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.security.JwtPrincipal;
import com.magno.util.DateTimeUtils;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class CajaService {

        private final CajaDiaRepository cajaDiaRepo;
        private final CajaMovimientoInversionRepository movimientoRepo;
        private final ConfigSucursalRepository configSucursalRepo;
        private final ConceptoInversionRepository conceptoRepo;
        private final PagoRepository pagoRepo;
        private final CreditoRepository creditoRepo;
        private final UsuarioRepository usuarioRepo;
        private final SucursalRepository sucursalRepo;
        private final GastoRepository gastoRepo;

        public CajaService(CajaDiaRepository cajaDiaRepo,
                        CajaMovimientoInversionRepository movimientoRepo,
                        ConfigSucursalRepository configSucursalRepo,
                        ConceptoInversionRepository conceptoRepo,
                        PagoRepository pagoRepo,
                        CreditoRepository creditoRepo,
                        UsuarioRepository usuarioRepo,
                        SucursalRepository sucursalRepo,
                        GastoRepository gastoRepo) {
                this.cajaDiaRepo = cajaDiaRepo;
                this.movimientoRepo = movimientoRepo;
                this.configSucursalRepo = configSucursalRepo;
                this.conceptoRepo = conceptoRepo;
                this.pagoRepo = pagoRepo;
                this.creditoRepo = creditoRepo;
                this.usuarioRepo = usuarioRepo;
                this.sucursalRepo = sucursalRepo;
                this.gastoRepo = gastoRepo;
        }

        // ── Abrir ─────────────────────────────────────────────────────────────

        @Transactional
        public CajaDiaDetalleDTO abrir(AbrirCajaRequest req, JwtPrincipal principal) {
                Long sucursalId = effectiveSucursalId(req.sucursalId(), principal);
                LocalDate hoy = DateTimeUtils.hoyEnMagno();

                if (cajaDiaRepo.findBySucursalIdAndFecha(sucursalId, hoy).isPresent()) {
                        throw new IllegalArgumentException("Ya existe una caja registrada para esta sucursal hoy");
                }

                configSucursalRepo.findBySucursalId(sucursalId)
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Configure la sucursal en Administración antes de abrir la caja"));

                CajaDia caja = CajaDia.builder()
                                .sucursal(sucursalRepo.getReferenceById(sucursalId))
                                .fecha(hoy)
                                .estado(EstadoCaja.ABIERTA)
                                .montoApertura(req.montoApertura())
                                .conceptoApertura(req.conceptoApertura())
                                .abiertaPor(usuarioRepo.getReferenceById(principal.userId()))
                                .fechaHoraApertura(DateTimeUtils.ahoraEnMagno())
                                .build();

                return toDetalleDTO(cajaDiaRepo.save(caja), List.of());
        }

        // ── Cerrar ────────────────────────────────────────────────────────────

        @Transactional
        public CajaDiaDetalleDTO cerrar(CerrarCajaRequest req, JwtPrincipal principal) {
                Long sucursalId = effectiveSucursalId(req.sucursalId(), principal);
                LocalDate hoy = DateTimeUtils.hoyEnMagno();

                CajaDia caja = cajaDiaRepo.findBySucursalIdAndFechaAndEstado(sucursalId, hoy, EstadoCaja.ABIERTA)
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "No hay una caja abierta para esta sucursal hoy"));

                OffsetDateTime inicioTs = hoy.atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();
                OffsetDateTime finTs = hoy.plusDays(1).atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();

                BigDecimal ingresoCarteras = pagoRepo.sumIngresoBySucursalAndFecha(sucursalId, hoy);
                BigDecimal desembolsos = creditoRepo.sumDesembolsosBySucursalAndFecha(sucursalId, inicioTs, finTs);
                BigDecimal sumInversiones = movimientoRepo.sumMontoByCajaDiaId(caja.getId());
                BigDecimal subtotalCaja = ingresoCarteras.subtract(desembolsos).add(sumInversiones);

                ConfigSucursal config = configSucursalRepo.findBySucursalId(sucursalId)
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "No se encontró configuración de la sucursal"));

                BigDecimal montoLibres = config.getPorcentajeAhorro().multiply(ingresoCarteras);
                BigDecimal ahorroFijo = config.getMontoAhorroFijo();
                BigDecimal totalGastos = Optional.ofNullable(gastoRepo.sumMontoByCajaDiaId(caja.getId())).orElse(BigDecimal.ZERO);
                BigDecimal totalRealLibres = montoLibres.subtract(ahorroFijo).subtract(totalGastos);

                caja.setEstado(EstadoCaja.CERRADA);
                caja.setCerradaPor(usuarioRepo.getReferenceById(principal.userId()));
                caja.setFechaHoraCierre(DateTimeUtils.ahoraEnMagno());
                caja.setIngresoCarteras(ingresoCarteras);
                caja.setDesembolsos(desembolsos);
                caja.setSubtotalCaja(subtotalCaja);
                caja.setMontoLibres(montoLibres);
                caja.setAhorroFijo(ahorroFijo);
                caja.setTotalGastos(totalGastos);
                caja.setTotalRealLibres(totalRealLibres);

                CajaDia saved = cajaDiaRepo.save(caja);
                List<MovimientoInversionDTO> inversiones = movimientoRepo
                                .findByCajaDiaIdOrderByCreatedAtAsc(saved.getId())
                                .stream().map(this::toMovimientoDTO).toList();
                return toDetalleDTO(saved, inversiones);
        }

        @Transactional
        public CajaDiaDetalleDTO cancelarCierre(Long cajaId, JwtPrincipal principal) {
                CajaDia caja = cajaDiaRepo.findById(cajaId)
                                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));

                if (caja.getEstado() != EstadoCaja.CERRADA) {
                        throw new IllegalArgumentException("Solo se puede cancelar un corte de caja cerrado");
                }

                LocalDate hoy = DateTimeUtils.hoyEnMagno();
                if (!hoy.equals(caja.getFecha())) {
                        throw new IllegalArgumentException("Solo se puede cancelar el corte de caja del día actual");
                }

                caja.setEstado(EstadoCaja.ABIERTA);
                caja.setCerradaPor(null);
                caja.setFechaHoraCierre(null);
                caja.setIngresoCarteras(null);
                caja.setDesembolsos(null);
                caja.setSubtotalCaja(null);
                caja.setMontoLibres(null);
                caja.setAhorroFijo(null);
                caja.setTotalGastos(null);
                caja.setTotalRealLibres(null);

                CajaDia saved = cajaDiaRepo.save(caja);
                List<MovimientoInversionDTO> inversiones = movimientoRepo
                                .findByCajaDiaIdOrderByCreatedAtAsc(saved.getId())
                                .stream().map(this::toMovimientoDTO).toList();
                return toDetalleDTO(saved, inversiones);
        }

        // ── Estado / operativa ────────────────────────────────────────────────

        public CajaEstadoDTO getEstado(Long sucursalId, JwtPrincipal principal) {
                Long effectiveId = effectiveSucursalIdForRead(sucursalId, principal);
                LocalDate hoy = DateTimeUtils.hoyEnMagno();
                LocalTime horaLimite = configSucursalRepo.findBySucursalId(effectiveId)
                                .map(ConfigSucursal::getHoraLimiteOperacion)
                                .orElse(LocalTime.of(17, 0));

                return cajaDiaRepo.findBySucursalIdAndFecha(effectiveId, hoy)
                                .map(c -> new CajaEstadoDTO(
                                                c.getId(),
                                                c.getEstado().name(),
                                                c.getEstado() != EstadoCaja.ABIERTA,
                                                c.getAbiertaPor().getNombreCompleto(),
                                                c.getFechaHoraApertura(),
                                                horaLimite))
                                .orElse(new CajaEstadoDTO(null, null, true, null, null, horaLimite));
        }

        public CajaOperativaDTO getOperativa(Long sucursalId, JwtPrincipal principal) {
                Long effectiveId = effectiveSucursalIdForRead(sucursalId, principal);
                boolean abierta = cajaDiaRepo.existsBySucursalIdAndFechaAndEstado(
                                effectiveId, DateTimeUtils.hoyEnMagno(), EstadoCaja.ABIERTA);
                return abierta
                                ? new CajaOperativaDTO(true, null)
                                : new CajaOperativaDTO(false,
                                                "No es posible registrar operaciones — la caja está cerrada");
        }

        // ── Inversiones ───────────────────────────────────────────────────────

        public List<MovimientoInversionDTO> getInversiones(Long cajaId) {
                if (!cajaDiaRepo.existsById(cajaId)) {
                        throw new EntityNotFoundException("Caja no encontrada: " + cajaId);
                }
                return movimientoRepo.findByCajaDiaIdOrderByCreatedAtAsc(cajaId)
                                .stream().map(this::toMovimientoDTO).toList();
        }

        @Transactional
        public MovimientoInversionDTO agregarInversion(Long cajaId, MovimientoInversionRequest req, Long usuarioId) {
                CajaDia caja = cajaDiaRepo.findById(cajaId)
                                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));
                if (caja.getEstado() != EstadoCaja.ABIERTA) {
                        throw new IllegalArgumentException(
                                        "Solo se pueden registrar movimientos mientras la caja está abierta");
                }
                ConceptoInversion concepto = conceptoRepo.findByIdAndDeletedAtIsNull(req.conceptoInversionId())
                                .orElseThrow(() -> new EntityNotFoundException(
                                                "Concepto de inversión no encontrado: " + req.conceptoInversionId()));

                CajaMovimientoInversion mov = CajaMovimientoInversion.builder()
                                .cajaDia(caja)
                                .conceptoInversion(concepto)
                                .descripcion(req.descripcion())
                                .monto(req.monto())
                                .registradoPor(usuarioRepo.getReferenceById(usuarioId))
                                .build();

                return toMovimientoDTO(movimientoRepo.save(mov));
        }

        @Transactional
        public void eliminarInversion(Long cajaId, Long movimientoId) {
                CajaDia caja = cajaDiaRepo.findById(cajaId)
                                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));
                if (caja.getEstado() != EstadoCaja.ABIERTA) {
                        throw new IllegalArgumentException(
                                        "Solo se pueden eliminar movimientos mientras la caja está abierta");
                }
                CajaMovimientoInversion mov = movimientoRepo.findById(movimientoId)
                                .orElseThrow(() -> new EntityNotFoundException(
                                                "Movimiento no encontrado: " + movimientoId));
                if (!mov.getCajaDia().getId().equals(cajaId)) {
                        throw new IllegalArgumentException("El movimiento no pertenece a esta caja");
                }
                movimientoRepo.delete(mov);
        }

        // ── Historial ─────────────────────────────────────────────────────────

        public CajaDiaDetalleDTO getHistorial(Long sucursalId, LocalDate fecha, JwtPrincipal principal) {
                Long effectiveId = effectiveSucursalIdForRead(sucursalId, principal);
                CajaDia caja = cajaDiaRepo.findBySucursalIdAndFecha(effectiveId, fecha)
                                .orElseThrow(() -> new EntityNotFoundException(
                                                "No hay caja registrada para la fecha: " + fecha));
                List<MovimientoInversionDTO> inversiones = movimientoRepo
                                .findByCajaDiaIdOrderByCreatedAtAsc(caja.getId())
                                .stream().map(this::toMovimientoDTO).toList();
                return toDetalleDTO(caja, inversiones);
        }

        public List<CajaDiaResumenDTO> getHistorialLista(
                        Long sucursalId, LocalDate desde, LocalDate hasta, JwtPrincipal principal) {
                Long effectiveId = effectiveSucursalIdForRead(sucursalId, principal);
                LocalDate effectiveDesde = desde != null ? desde : LocalDate.now().minusMonths(1);
                LocalDate effectiveHasta = hasta != null ? hasta : LocalDate.now();
                return cajaDiaRepo.findBySucursalAndFechaRange(effectiveId, effectiveDesde, effectiveHasta)
                                .stream()
                                .map(c -> new CajaDiaResumenDTO(
                                                c.getId(),
                                                c.getFecha(),
                                                c.getSucursal().getNombre(),
                                                c.getAbiertaPor().getNombreCompleto(),
                                                c.getCerradaPor() != null ? c.getCerradaPor().getNombreCompleto()
                                                                : null,
                                                c.getFechaHoraCierre(),
                                                c.getSubtotalCaja(),
                                                c.getEstado().name()))
                                .toList();
        }

        // ── Preview cierre ────────────────────────────────────────────────────

        public CajaCierrePreviewDTO getPreviewCierre(Long sucursalId, JwtPrincipal principal) {
                Long effectiveId = effectiveSucursalIdForRead(sucursalId, principal);
                LocalDate hoy = DateTimeUtils.hoyEnMagno();

                CajaDia caja = cajaDiaRepo.findBySucursalIdAndFechaAndEstado(effectiveId, hoy, EstadoCaja.ABIERTA)
                                .orElseThrow(() -> new EntityNotFoundException(
                                                "No hay una caja abierta para esta sucursal hoy"));

                OffsetDateTime inicioTs = hoy.atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();
                OffsetDateTime finTs = hoy.plusDays(1).atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();

                List<MovimientoInversionDTO> inversiones = movimientoRepo
                                .findByCajaDiaIdOrderByCreatedAtAsc(caja.getId())
                                .stream().map(this::toMovimientoDTO).toList();
                BigDecimal subtotalInversiones = movimientoRepo.sumMontoByCajaDiaId(caja.getId());

                BigDecimal totalIngresoCarteras = pagoRepo.sumIngresoBySucursalAndFecha(effectiveId, hoy);

                List<CobroAsesorItemDTO> cobrosPorAsesor = pagoRepo
                                .findCobrosPorAsesorBySucursalAndFecha(effectiveId, hoy)
                                .stream()
                                .map(row -> new CobroAsesorItemDTO(
                                                (String) row[0],
                                                ((Number) row[1]).intValue(),
                                                (BigDecimal) row[2]))
                                .toList();

                BigDecimal desembolsosNuevos = creditoRepo.sumDesembolsosByTipoAndSucursalAndFecha(
                                effectiveId, TipoCredito.NUEVO, inicioTs, finTs);
                BigDecimal desembolsosRenovaciones = creditoRepo.sumDesembolsosByTipoAndSucursalAndFecha(
                                effectiveId, TipoCredito.RENOVACION, inicioTs, finTs);
                BigDecimal totalDesembolsos = desembolsosNuevos.add(desembolsosRenovaciones);

                BigDecimal subtotalCaja = caja.getMontoApertura()
                                .add(totalIngresoCarteras)
                                .subtract(totalDesembolsos)
                                .add(subtotalInversiones);

                ConfigSucursal config = configSucursalRepo.findBySucursalId(effectiveId)
                                .orElseThrow(() -> new EntityNotFoundException(
                                                "No se encontró configuración de la sucursal"));

                BigDecimal montoLibres = config.getPorcentajeAhorro().multiply(totalIngresoCarteras)
                                .setScale(2, RoundingMode.HALF_UP);
                BigDecimal ahorroFijo = config.getMontoAhorroFijo();
                BigDecimal totalGastos = Optional.ofNullable(gastoRepo.sumMontoByCajaDiaId(caja.getId())).orElse(BigDecimal.ZERO);
                BigDecimal totalRealLibres = montoLibres.subtract(ahorroFijo).subtract(totalGastos);

                List<MultaAsesorItemDTO> multasPorAsesor = pagoRepo
                                .findMultasPorAsesorBySucursalAndFecha(effectiveId, hoy)
                                .stream()
                                .map(row -> new MultaAsesorItemDTO(
                                                (String) row[0],
                                                (BigDecimal) row[1]))
                                .toList();
                BigDecimal totalMultas = multasPorAsesor.stream()
                                .map(MultaAsesorItemDTO::totalMultas)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                return new CajaCierrePreviewDTO(
                                caja.getId(),
                                caja.getMontoApertura(),
                                inversiones,
                                subtotalInversiones,
                                cobrosPorAsesor,
                                totalIngresoCarteras,
                                desembolsosNuevos,
                                desembolsosRenovaciones,
                                totalDesembolsos,
                                subtotalCaja,
                                config.getPorcentajeAhorro(),
                                montoLibres,
                                ahorroFijo,
                                totalGastos,
                                totalRealLibres,
                                multasPorAsesor,
                                totalMultas);
        }

        // ── PDF de cierre ─────────────────────────────────────────────────────

        public byte[] exportarPdf(Long cajaId) {
                CajaDia caja = cajaDiaRepo.findById(cajaId)
                                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));
                if (caja.getEstado() != EstadoCaja.CERRADA) {
                        throw new IllegalArgumentException("Solo se puede exportar el PDF de una caja cerrada");
                }

                List<MovimientoInversionDTO> inversiones = movimientoRepo
                                .findByCajaDiaIdOrderByCreatedAtAsc(cajaId)
                                .stream().map(this::toMovimientoDTO).toList();

                DateTimeFormatter fmtFecha = DateTimeFormatter.ofPattern("dd/MM/yyyy");
                DateTimeFormatter fmtHora = DateTimeFormatter.ofPattern("HH:mm");

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                PdfWriter writer = new PdfWriter(baos);
                PdfDocument pdf = new PdfDocument(writer);
                Document doc = new Document(pdf);

                // ── Encabezado ──────────────────────────────────────────────────
                doc.add(new Paragraph("MAGNO — Corte de Caja Diario")
                                .setBold().setFontSize(16).setTextAlignment(TextAlignment.CENTER));
                doc.add(new Paragraph(caja.getSucursal().getNombre())
                                .setFontSize(12).setTextAlignment(TextAlignment.CENTER));
                doc.add(new Paragraph("Fecha: " + caja.getFecha().format(fmtFecha))
                                .setFontSize(11).setTextAlignment(TextAlignment.CENTER));
                if (caja.getFechaHoraCierre() != null) {
                        doc.add(new Paragraph("Cierre: "
                                        + caja.getFechaHoraCierre().toLocalTime().format(fmtHora)
                                        + " — Realizado por: " + caja.getCerradaPor().getNombreCompleto())
                                        .setFontSize(10).setTextAlignment(TextAlignment.CENTER));
                }
                doc.add(new Paragraph(" "));

                // ── Inversiones ─────────────────────────────────────────────────
                doc.add(sectionHeader("INVERSIONES"));
                if (inversiones.isEmpty()) {
                        doc.add(new Paragraph("Sin movimientos de inversión").setFontSize(9).setItalic());
                } else {
                        Table tInv = new Table(UnitValue.createPercentArray(new float[] { 180, 100, 80 }))
                                        .setWidth(UnitValue.createPercentValue(100));
                        tInv.addHeaderCell(hCell("Concepto"));
                        tInv.addHeaderCell(hCell("Descripción"));
                        tInv.addHeaderCell(hCell("Monto").setTextAlignment(TextAlignment.RIGHT));
                        BigDecimal totalInv = BigDecimal.ZERO;
                        for (MovimientoInversionDTO m : inversiones) {
                                tInv.addCell(cell(m.conceptoNombre()));
                                tInv.addCell(cell(m.descripcion() != null ? m.descripcion() : "—"));
                                tInv.addCell(cell(fmtMonto(m.monto())).setTextAlignment(TextAlignment.RIGHT));
                                totalInv = totalInv.add(m.monto());
                        }
                        doc.add(tInv);
                        doc.add(new Paragraph("Subtotal inversiones: " + fmtMonto(totalInv))
                                        .setBold().setFontSize(9).setTextAlignment(TextAlignment.RIGHT));
                }
                doc.add(new Paragraph(" "));

                // ── Ingresos carteras ────────────────────────────────────────────
                doc.add(sectionHeader("INGRESOS DE CARTERAS"));
                if (caja.getIngresoCarteras() != null) {
                        doc.add(new Paragraph("Total cobrado: " + fmtMonto(caja.getIngresoCarteras()))
                                        .setBold().setFontSize(10));
                }
                doc.add(new Paragraph(" "));

                // ── Desembolsos ──────────────────────────────────────────────────
                doc.add(sectionHeader("DESEMBOLSOS"));
                if (caja.getDesembolsos() != null) {
                        doc.add(new Paragraph("Total desembolsos: " + fmtMonto(caja.getDesembolsos()))
                                        .setBold().setFontSize(10));
                }
                doc.add(new Paragraph(" "));

                // ── Fórmula subtotal ─────────────────────────────────────────────
                doc.add(sectionHeader("SUBTOTAL CAJA"));
                if (caja.getSubtotalCaja() != null) {
                        doc.add(new Paragraph(
                                        "Apertura + Ingresos − Desembolsos + Inversiones = "
                                                        + fmtMonto(caja.getSubtotalCaja()))
                                        .setBold().setFontSize(11));
                }
                doc.add(new Paragraph(" "));

                // ── Libres ───────────────────────────────────────────────────────
                doc.add(sectionHeader("LIBRES"));
                if (caja.getMontoLibres() != null) {
                        doc.add(new Paragraph("Monto Libres: " + fmtMonto(caja.getMontoLibres())).setFontSize(9));
                        doc.add(new Paragraph("Ahorro fijo: " + fmtMonto(caja.getAhorroFijo())).setFontSize(9));
                        doc.add(new Paragraph("Total Real Libres: " + fmtMonto(caja.getTotalRealLibres()))
                                        .setBold().setFontSize(10));
                }
                doc.add(new Paragraph("[Gastos operativos — Pendiente]").setFontSize(9).setItalic()
                                .setFontColor(com.itextpdf.kernel.colors.ColorConstants.GRAY));
                doc.add(new Paragraph("[Nómina — Pendiente]").setFontSize(9).setItalic()
                                .setFontColor(com.itextpdf.kernel.colors.ColorConstants.GRAY));
                doc.add(new Paragraph(" "));

                doc.close();
                return baos.toByteArray();
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private Long effectiveSucursalId(Long requestId, JwtPrincipal principal) {
                if ("ADMINISTRADOR".equals(principal.rol())) {
                        if (requestId != null) {
                                return requestId;
                        }
                        if (principal.sucursalId() != null) {
                                return principal.sucursalId();
                        }
                        throw new IllegalArgumentException("sucursalId es requerido para el rol ADMINISTRADOR");
                }
                return principal.sucursalId();
        }

        private Long effectiveSucursalIdForRead(Long requestId, JwtPrincipal principal) {
                if ("ADMINISTRADOR".equals(principal.rol()) && requestId != null) {
                        return requestId;
                }
                return principal.sucursalId();
        }

        private CajaDiaDetalleDTO toDetalleDTO(CajaDia c, List<MovimientoInversionDTO> inversiones) {
                return new CajaDiaDetalleDTO(
                                c.getId(),
                                c.getSucursal().getId(),
                                c.getSucursal().getNombre(),
                                c.getFecha(),
                                c.getEstado().name(),
                                c.getMontoApertura(),
                                c.getConceptoApertura(),
                                c.getAbiertaPor().getId(),
                                c.getAbiertaPor().getNombreCompleto(),
                                c.getFechaHoraApertura(),
                                c.getCerradaPor() != null ? c.getCerradaPor().getId() : null,
                                c.getCerradaPor() != null ? c.getCerradaPor().getNombreCompleto() : null,
                                c.getFechaHoraCierre(),
                                c.getIngresoCarteras(),
                                c.getDesembolsos(),
                                c.getSubtotalCaja(),
                                c.getMontoLibres(),
                                c.getAhorroFijo(),
                                c.getTotalGastos(),
                                c.getTotalRealLibres(),
                                inversiones);
        }

        private MovimientoInversionDTO toMovimientoDTO(CajaMovimientoInversion m) {
                return new MovimientoInversionDTO(
                                m.getId(),
                                m.getConceptoInversion().getId(),
                                m.getConceptoInversion().getNombre(),
                                m.getDescripcion(),
                                m.getMonto(),
                                m.getRegistradoPor().getId(),
                                m.getRegistradoPor().getNombreCompleto(),
                                m.getCreatedAt());
        }

        private static Paragraph sectionHeader(String title) {
                return new Paragraph(title).setBold().setFontSize(11)
                                .setBackgroundColor(ColorConstants.LIGHT_GRAY)
                                .setMarginTop(4f);
        }

        private static Cell hCell(String text) {
                return new Cell().add(new Paragraph(text).setBold().setFontSize(9))
                                .setBackgroundColor(ColorConstants.LIGHT_GRAY);
        }

        private static Cell cell(String text) {
                return new Cell().add(new Paragraph(text != null ? text : "").setFontSize(8));
        }

        private static String fmtMonto(BigDecimal v) {
                if (v == null)
                        return "—";
                return "$" + v.setScale(2, RoundingMode.HALF_UP).toPlainString();
        }
}
