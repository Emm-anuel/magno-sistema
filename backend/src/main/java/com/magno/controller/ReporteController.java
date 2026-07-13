package com.magno.controller;

import com.magno.dto.reporte.ReporteCarteraDTO;
import com.magno.dto.reporte.ReporteClientesDTO;
import com.magno.dto.reporte.ReporteColocacionesDTO;
import com.magno.dto.reporte.ReporteIngresosEgresosDTO;
import com.magno.dto.reporte.ReportePorAsesorDTO;
import com.magno.security.JwtPrincipal;
import com.magno.service.ReporteService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/reportes")
@PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
public class ReporteController {

    private final ReporteService reporteService;

    public ReporteController(ReporteService reporteService) {
        this.reporteService = reporteService;
    }

    // ── Ingresos/Egresos ─────────────────────────────────────────────────

    @GetMapping("/ingresos-egresos")
    public ResponseEntity<ReporteIngresosEgresosDTO> ingresosEgresos(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        return ResponseEntity.ok(reporteService.getIngresosEgresos(sid, desde, hasta));
    }

    @GetMapping("/ingresos-egresos/pdf")
    public ResponseEntity<byte[]> ingresosEgresosPdf(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        byte[] pdf = reporteService.exportarIngresosEgresosPdf(sid, desde, hasta);
        return pdfResponse(pdf, "ingresos-egresos-" + desde + "-" + hasta + ".pdf");
    }

    // ── Colocaciones ─────────────────────────────────────────────────────

    @GetMapping("/colocaciones")
    public ResponseEntity<ReporteColocacionesDTO> colocaciones(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) Long asesorId,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        return ResponseEntity.ok(reporteService.getColocaciones(sid, desde, hasta, asesorId));
    }

    @GetMapping("/colocaciones/pdf")
    public ResponseEntity<byte[]> colocacionesPdf(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) Long asesorId,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        byte[] pdf = reporteService.exportarColocacionesPdf(sid, desde, hasta, asesorId);
        return pdfResponse(pdf, "colocaciones-" + desde + "-" + hasta + ".pdf");
    }

    // ── Cartera ──────────────────────────────────────────────────────────

    @GetMapping("/cartera")
    public ResponseEntity<ReporteCarteraDTO> cartera(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(defaultValue = "TODOS") String estado,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        return ResponseEntity.ok(reporteService.getCartera(sid, asesorId, estado));
    }

    @GetMapping("/cartera/pdf")
    public ResponseEntity<byte[]> carteraPdf(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(defaultValue = "TODOS") String estado,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        byte[] pdf = reporteService.exportarCarteraPdf(sid, asesorId, estado);
        return pdfResponse(pdf, "cartera.pdf");
    }

    // ── Por Asesor ───────────────────────────────────────────────────────

    @GetMapping("/por-asesor")
    public ResponseEntity<ReportePorAsesorDTO> porAsesor(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) Long asesorId,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        return ResponseEntity.ok(reporteService.getPorAsesor(sid, desde, hasta, asesorId));
    }

    @GetMapping("/por-asesor/pdf")
    public ResponseEntity<byte[]> porAsesorPdf(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) Long asesorId,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        byte[] pdf = reporteService.exportarPorAsesorPdf(sid, desde, hasta, asesorId);
        return pdfResponse(pdf, "por-asesor-" + desde + "-" + hasta + ".pdf");
    }

    // ── Clientes ─────────────────────────────────────────────────────────

    @GetMapping("/clientes")
    public ResponseEntity<ReporteClientesDTO> clientes(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(defaultValue = "TODOS") String estado,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        return ResponseEntity.ok(reporteService.getClientes(sid, asesorId, estado));
    }

    @GetMapping("/clientes/pdf")
    public ResponseEntity<byte[]> clientesPdf(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(defaultValue = "TODOS") String estado,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        return pdfResponse(reporteService.exportarClientesPdf(sid, asesorId, estado), "clientes.pdf");
    }

    @GetMapping("/clientes/excel")
    public ResponseEntity<byte[]> clientesExcel(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(defaultValue = "TODOS") String estado,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        return xlsxResponse(reporteService.exportarClientesExcel(sid, asesorId, estado), "clientes.xlsx");
    }

    // ── Excel ─────────────────────────────────────────────────────────────

    @GetMapping("/ingresos-egresos/excel")
    public ResponseEntity<byte[]> ingresosEgresosExcel(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        byte[] xlsx = reporteService.exportarIngresosEgresosExcel(sid, desde, hasta);
        return xlsxResponse(xlsx, "ingresos-egresos-" + desde + "-" + hasta + ".xlsx");
    }

    @GetMapping("/colocaciones/excel")
    public ResponseEntity<byte[]> colocacionesExcel(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) Long asesorId,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        byte[] xlsx = reporteService.exportarColocacionesExcel(sid, desde, hasta, asesorId);
        return xlsxResponse(xlsx, "colocaciones-" + desde + "-" + hasta + ".xlsx");
    }

    @GetMapping("/cartera/excel")
    public ResponseEntity<byte[]> carteraExcel(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(defaultValue = "TODOS") String estado,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        byte[] xlsx = reporteService.exportarCarteraExcel(sid, asesorId, estado);
        return xlsxResponse(xlsx, "cartera.xlsx");
    }

    @GetMapping("/por-asesor/excel")
    public ResponseEntity<byte[]> porAsesorExcel(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) Long asesorId,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        byte[] xlsx = reporteService.exportarPorAsesorExcel(sid, desde, hasta, asesorId);
        return xlsxResponse(xlsx, "por-asesor-" + desde + "-" + hasta + ".xlsx");
    }

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

    private JwtPrincipal principal(Authentication auth) {
        return (JwtPrincipal) auth.getPrincipal();
    }

    private ResponseEntity<byte[]> pdfResponse(byte[] pdf, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        return ResponseEntity.ok().headers(headers).body(pdf);
    }

    private ResponseEntity<byte[]> xlsxResponse(byte[] data, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        return ResponseEntity.ok().headers(headers).body(data);
    }
}
