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
import com.magno.dto.cobros.ClienteNoPagoAutomaticoDTO;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.repository.MultaRepository;
import com.magno.repository.NominaPagoRepository;
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
        private final PagoRepository pagoRepo;
        private final CreditoRepository creditoRepo;
        private final RenovacionRepository renovacionRepo;
        private final UsuarioRepository usuarioRepo;
        private final SucursalRepository sucursalRepo;
        private final GastoRepository gastoRepo;
        private final NominaPagoRepository nominaPagoRepo;
        private final MultaRepository multaRepo;
        private final CobrosService cobrosService;

        public CajaService(CajaDiaRepository cajaDiaRepo,
                        CajaMovimientoInversionRepository movimientoRepo,
                        ConfigSucursalRepository configSucursalRepo,
                        PagoRepository pagoRepo,
                        CreditoRepository creditoRepo,
                        RenovacionRepository renovacionRepo,
                        UsuarioRepository usuarioRepo,
                        SucursalRepository sucursalRepo,
                        GastoRepository gastoRepo,
                        NominaPagoRepository nominaPagoRepo,
                        MultaRepository multaRepo,
                        CobrosService cobrosService) {
                this.cajaDiaRepo = cajaDiaRepo;
                this.movimientoRepo = movimientoRepo;
                this.configSucursalRepo = configSucursalRepo;
                this.pagoRepo = pagoRepo;
                this.creditoRepo = creditoRepo;
                this.renovacionRepo = renovacionRepo;
                this.usuarioRepo = usuarioRepo;
                this.sucursalRepo = sucursalRepo;
                this.gastoRepo = gastoRepo;
                this.nominaPagoRepo = nominaPagoRepo;
                this.multaRepo = multaRepo;
                this.cobrosService = cobrosService;
        }

        // ── Abrir ─────────────────────────────────────────────────────────────

        @Transactional
        public CajaDiaDetalleDTO abrir(AbrirCajaRequest req, JwtPrincipal principal) {
                Long sucursalId = effectiveSucursalId(req.sucursalId(), principal);
                LocalDate hoy = DateTimeUtils.hoyEnMagno();

                cajaDiaRepo.findFirstBySucursalIdAndEstadoAndFechaBeforeOrderByFechaAsc(
                                sucursalId, EstadoCaja.ABIERTA, hoy)
                                .ifPresent(c -> {
                                        throw new IllegalArgumentException(
                                                        "Hay una caja sin cerrar del " + c.getFecha()
                                                                        + ". Ciérrala antes de abrir la de hoy.");
                                });

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
                LocalDate fechaCaja;

                CajaDia caja = req.cajaId() != null
                                ? cajaDiaRepo.findById(req.cajaId())
                                                .orElseThrow(() -> new EntityNotFoundException(
                                                                "Caja no encontrada: " + req.cajaId()))
                                : cajaDiaRepo.findBySucursalIdAndFechaAndEstado(
                                                sucursalId, DateTimeUtils.hoyEnMagno(), EstadoCaja.ABIERTA)
                                                .orElseThrow(() -> new IllegalArgumentException(
                                                                "No hay una caja abierta para esta sucursal hoy"));

                if (!caja.getSucursal().getId().equals(sucursalId)) {
                        throw new IllegalArgumentException("La caja no pertenece a la sucursal seleccionada");
                }
                if (caja.getEstado() != EstadoCaja.ABIERTA) {
                        throw new IllegalArgumentException("Solo se puede cerrar una caja abierta");
                }

                fechaCaja = caja.getFecha();
                OffsetDateTime inicioTs = fechaCaja.atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();
                OffsetDateTime finTs = fechaCaja.plusDays(1).atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();

                cobrosService.marcarNoPagoAutomatico(sucursalId, fechaCaja, principal.userId());

                BigDecimal ingresoCarteras = pagoRepo.sumIngresoBySucursalAndFecha(sucursalId, fechaCaja);
                BigDecimal desembolsosNuevos = creditoRepo.sumDesembolsosBySucursalAndFecha(sucursalId, inicioTs, finTs);
                BigDecimal desembolsosRenov = renovacionRepo.sumDesembolsosByScopeAndFecha(
                                sucursalId, null, fechaCaja, fechaCaja);
                BigDecimal desembolsos = desembolsosNuevos.add(desembolsosRenov);
                BigDecimal sumInversiones = movimientoRepo.sumMontoByCajaDiaId(caja.getId());
                BigDecimal subtotalCaja = caja.getMontoApertura()
                                .add(ingresoCarteras)
                                .subtract(desembolsos)
                                .add(sumInversiones);

                ConfigSucursal config = configSucursalRepo.findBySucursalId(sucursalId)
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "No se encontró configuración de la sucursal"));

                BigDecimal montoLibres = config.getPorcentajeAhorro().multiply(ingresoCarteras);
                BigDecimal ahorroFijo = config.getMontoAhorroFijo();
                BigDecimal totalGastos = Optional.ofNullable(gastoRepo.sumMontoByCajaDiaId(caja.getId()))
                                .orElse(BigDecimal.ZERO);
                BigDecimal totalNomina = nominaPagoRepo.findByCajaDiaIdAndDeletedAtIsNull(caja.getId())
                                .map(com.magno.model.NominaPago::getTotalPagado)
                                .orElse(BigDecimal.ZERO);
                BigDecimal totalRealLibres = montoLibres.subtract(ahorroFijo).subtract(totalGastos).subtract(totalNomina);

                caja.setEstado(EstadoCaja.CERRADA);
                caja.setCerradaPor(usuarioRepo.getReferenceById(principal.userId()));
                caja.setFechaHoraCierre(DateTimeUtils.ahoraEnMagno());
                caja.setIngresoCarteras(ingresoCarteras);
                caja.setDesembolsos(desembolsos);
                caja.setSubtotalCaja(subtotalCaja);
                caja.setMontoLibres(montoLibres);
                caja.setAhorroFijo(ahorroFijo);
                caja.setTotalGastos(totalGastos);
                caja.setTotalNomina(totalNomina);
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

                if (!"ADMINISTRADOR".equals(principal.rol())
                                && !caja.getSucursal().getId().equals(principal.sucursalId())) {
                        throw new IllegalArgumentException("No puedes reabrir una caja de otra sucursal");
                }

                if (caja.getEstado() != EstadoCaja.CERRADA) {
                        throw new IllegalArgumentException("Solo se puede reabrir una caja cerrada");
                }

                LocalDate hoy = DateTimeUtils.hoyEnMagno();
                if (!hoy.equals(caja.getFecha())) {
                        throw new IllegalArgumentException("Solo se puede reabrir la caja del dia actual");
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
                caja.setTotalNomina(null);
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

                boolean isFieldRole = "ASESOR_COBRADOR".equals(principal.rol())
                                || "SUPERVISOR_CAMPO".equals(principal.rol());
                boolean horaExcedida = isFieldRole
                                && LocalTime.now(DateTimeUtils.MAGNO_ZONE).isAfter(horaLimite);

                return cajaDiaRepo.findBySucursalIdAndFecha(effectiveId, hoy)
                                .map(c -> {
                                        boolean cajaNoAbierta = c.getEstado() != EstadoCaja.ABIERTA;
                                        boolean bloqueado = cajaNoAbierta || horaExcedida;
                                        String motivo = !bloqueado ? null
                                                        : cajaNoAbierta ? "CAJA_CERRADA" : "HORA_LIMITE";
                                        return new CajaEstadoDTO(
                                                        c.getId(),
                                                        c.getEstado().name(),
                                                        bloqueado,
                                                        c.getAbiertaPor().getNombreCompleto(),
                                                        c.getFechaHoraApertura(),
                                                        horaLimite,
                                                        motivo);
                                })
                                .orElse(new CajaEstadoDTO(null, null, true, null, null, horaLimite,
                                                "CAJA_CERRADA"));
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
                                                c.getMontoApertura(),
                                                c.getSubtotalCaja(),
                                                c.getMontoLibres(),
                                                calcularTotal(c.getSubtotalCaja(), c.getMontoLibres()),
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
                BigDecimal desembolsosRenovaciones = renovacionRepo.sumDesembolsosByScopeAndFecha(
                                effectiveId, null, hoy, hoy);
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
                BigDecimal total = calcularTotal(subtotalCaja, montoLibres);
                BigDecimal ahorroFijo = config.getMontoAhorroFijo();
                BigDecimal totalGastos = Optional.ofNullable(gastoRepo.sumMontoByCajaDiaId(caja.getId()))
                                .orElse(BigDecimal.ZERO);
                BigDecimal totalNomina = nominaPagoRepo.findByCajaDiaIdAndDeletedAtIsNull(caja.getId())
                                .map(com.magno.model.NominaPago::getTotalPagado)
                                .orElse(BigDecimal.ZERO);
                BigDecimal totalRealLibres = montoLibres.subtract(ahorroFijo).subtract(totalGastos).subtract(totalNomina);

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
                BigDecimal multasCobrasRenovaciones = multaRepo
                                .sumMultasCobrasViaRenovacionBySucursalAndFecha(effectiveId, hoy);
                BigDecimal totalMultasCondonadas = multaRepo
                                .sumMultasCondonadasBySucursalAndFecha(effectiveId, hoy);

                List<ClienteNoPagoAutomaticoDTO> clientesSinRegistro = cobrosService
                                .previsualizarNoPagoAutomatico(effectiveId, hoy);

                return new CajaCierrePreviewDTO(
                                caja.getId(),
                                caja.getMontoApertura(),
                                subtotalInversiones,
                                cobrosPorAsesor,
                                totalIngresoCarteras,
                                desembolsosNuevos,
                                desembolsosRenovaciones,
                                totalDesembolsos,
                                subtotalCaja,
                                config.getPorcentajeAhorro(),
                                montoLibres,
                                total,
                                ahorroFijo,
                                totalGastos,
                                totalNomina,
                                totalRealLibres,
                                multasPorAsesor,
                                totalMultas,
                                multasCobrasRenovaciones,
                                totalMultasCondonadas,
                                clientesSinRegistro);
        }

        // ── PDF de cierre ─────────────────────────────────────────────────────

        public byte[] exportarPdf(Long cajaId, JwtPrincipal principal) {
                CajaDia caja = cajaDiaRepo.findById(cajaId)
                                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));
                if (!"ADMINISTRADOR".equals(principal.rol())
                                && !caja.getSucursal().getId().equals(principal.sucursalId())) {
                        throw new IllegalArgumentException("No tienes acceso a la caja de otra sucursal");
                }
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
                                tInv.addCell(cell(m.conceptoNombre() != null ? m.conceptoNombre() : "—"));
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
                doc.add(new Paragraph("Apertura: " + fmtMonto(caja.getMontoApertura()))
                                .setFontSize(10));
                if (caja.getIngresoCarteras() != null) {
                        doc.add(new Paragraph("Ingresos carteras: " + fmtMonto(caja.getIngresoCarteras()))
                                        .setFontSize(9));
                }
                if (caja.getDesembolsos() != null) {
                        doc.add(new Paragraph("Desembolsos: -" + fmtMonto(caja.getDesembolsos()))
                                        .setFontSize(9));
                }
                if (caja.getSubtotalCaja() != null) {
                        doc.add(new Paragraph(
                                        "Apertura + Ingresos − Desembolsos + Inversiones = "
                                                        + fmtMonto(caja.getSubtotalCaja()))
                                        .setBold().setFontSize(11));
                }
                doc.add(new Paragraph(" "));

                // ── Gastos operativos ────────────────────────────────────────────
                doc.add(sectionHeader("TOTAL"));
                if (caja.getSubtotalCaja() != null && caja.getMontoLibres() != null) {
                        BigDecimal total = calcularTotal(caja.getSubtotalCaja(), caja.getMontoLibres());
                        doc.add(new Paragraph("Subtotal caja - Monto Libres = " + fmtMonto(total))
                                        .setBold().setFontSize(12));
                }
                doc.add(new Paragraph(" "));

                List<Gasto> gastos = gastoRepo.findByCajaDiaIdAndDeletedAtIsNullOrderByCreatedAtAsc(cajaId);
                if (!gastos.isEmpty()) {
                        doc.add(sectionHeader("GASTOS OPERATIVOS"));
                        Table tGastos = new Table(UnitValue.createPercentArray(new float[] { 140, 180, 80 }))
                                        .setWidth(UnitValue.createPercentValue(100));
                        tGastos.addHeaderCell(hCell("Categoría"));
                        tGastos.addHeaderCell(hCell("Concepto"));
                        tGastos.addHeaderCell(hCell("Monto").setTextAlignment(TextAlignment.RIGHT));
                        for (Gasto g : gastos) {
                                tGastos.addCell(cell(g.getCategoriaGasto() != null ? g.getCategoriaGasto().getNombre() : "—"));
                                tGastos.addCell(cell(g.getConcepto()));
                                tGastos.addCell(cell(fmtMonto(g.getMonto())).setTextAlignment(TextAlignment.RIGHT));
                        }
                        doc.add(tGastos);
                        doc.add(new Paragraph("Total gastos: " + fmtMonto(caja.getTotalGastos()))
                                        .setBold().setFontSize(9).setTextAlignment(TextAlignment.RIGHT));
                        doc.add(new Paragraph(" "));
                }

                // ── Libres ───────────────────────────────────────────────────────
                doc.add(sectionHeader("LIBRES"));
                if (caja.getMontoLibres() != null) {
                        doc.add(new Paragraph("Monto Libres: " + fmtMonto(caja.getMontoLibres())).setFontSize(9));
                        doc.add(new Paragraph("Ahorro fijo: −" + fmtMonto(caja.getAhorroFijo())).setFontSize(9));
                        if (caja.getTotalGastos() != null && caja.getTotalGastos().compareTo(BigDecimal.ZERO) > 0) {
                                doc.add(new Paragraph("Gastos operativos: −" + fmtMonto(caja.getTotalGastos())).setFontSize(9));
                        }
                        if (caja.getTotalNomina() != null && caja.getTotalNomina().compareTo(BigDecimal.ZERO) > 0) {
                                doc.add(new Paragraph("Nómina: −" + fmtMonto(caja.getTotalNomina())).setFontSize(9));
                        }
                        doc.add(new Paragraph("Total Real Libres: " + fmtMonto(caja.getTotalRealLibres()))
                                        .setBold().setFontSize(10));
                }
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
                                calcularTotal(c.getSubtotalCaja(), c.getMontoLibres()),
                                c.getAhorroFijo(),
                                c.getTotalGastos(),
                                c.getTotalNomina(),
                                c.getTotalRealLibres(),
                                inversiones);
        }

        private static BigDecimal calcularTotal(BigDecimal subtotalCaja, BigDecimal montoLibres) {
                if (subtotalCaja == null || montoLibres == null) {
                        return null;
                }
                return subtotalCaja.subtract(montoLibres);
        }

        private MovimientoInversionDTO toMovimientoDTO(CajaMovimientoInversion m) {
                return new MovimientoInversionDTO(
                                m.getId(),
                                m.getConceptoInversion() != null ? m.getConceptoInversion().getId() : null,
                                m.getConceptoInversion() != null ? m.getConceptoInversion().getNombre() : null,
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
