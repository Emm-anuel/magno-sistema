package com.magno.service;

import com.magno.dto.admin.NominaPersonalDTO;
import com.magno.dto.caja.NominaEstadoDTO;
import com.magno.dto.caja.NominaPagoDTO;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.util.DateTimeUtils;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class NominaCajaService {

    private final CajaDiaRepository cajaDiaRepo;
    private final NominaPagoRepository nominaPagoRepo;
    private final NominaPersonalRepository nominaPersonalRepo;
    private final ConfigSucursalRepository configSucursalRepo;
    private final DiaFestivoRepository diaFestivoRepo;
    private final UsuarioRepository usuarioRepo;

    public NominaCajaService(CajaDiaRepository cajaDiaRepo,
                             NominaPagoRepository nominaPagoRepo,
                             NominaPersonalRepository nominaPersonalRepo,
                             ConfigSucursalRepository configSucursalRepo,
                             DiaFestivoRepository diaFestivoRepo,
                             UsuarioRepository usuarioRepo) {
        this.cajaDiaRepo = cajaDiaRepo;
        this.nominaPagoRepo = nominaPagoRepo;
        this.nominaPersonalRepo = nominaPersonalRepo;
        this.configSucursalRepo = configSucursalRepo;
        this.diaFestivoRepo = diaFestivoRepo;
        this.usuarioRepo = usuarioRepo;
    }

    // ── Consulta ──────────────────────────────────────────────────────────

    public NominaEstadoDTO getEstado(Long cajaDiaId) {
        CajaDia caja = cajaDiaRepo.findById(cajaDiaId)
                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaDiaId));

        Long sucursalId = caja.getSucursal().getId();
        LocalDate diaEfectivo = calcularDiaEfectivo(sucursalId);
        boolean esDiaEfectivo = DateTimeUtils.hoyEnMagno().equals(diaEfectivo);

        List<NominaPersonalDTO> personal = nominaPersonalRepo
                .findBySucursalIdAndDeletedAtIsNullOrderByNombreAsc(sucursalId)
                .stream()
                .map(NominaPersonalDTO::from)
                .toList();

        BigDecimal totalCalculado = personal.stream()
                .map(NominaPersonalDTO::montoSemanal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        NominaPagoDTO pago = nominaPagoRepo.findByCajaDiaIdAndDeletedAtIsNull(cajaDiaId)
                .map(NominaPagoDTO::from)
                .orElse(null);

        return new NominaEstadoDTO(esDiaEfectivo, diaEfectivo, personal, totalCalculado, pago);
    }

    // ── Registro ──────────────────────────────────────────────────────────

    @Transactional
    public NominaPagoDTO registrarPago(Long cajaDiaId, Long usuarioId) {
        CajaDia caja = cajaDiaRepo.findById(cajaDiaId)
                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaDiaId));

        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException("Solo se puede registrar la nómina con la caja abierta");
        }

        Long sucursalId = caja.getSucursal().getId();
        LocalDate diaEfectivo = calcularDiaEfectivo(sucursalId);

        if (!DateTimeUtils.hoyEnMagno().equals(diaEfectivo)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Hoy no es el día efectivo de pago de nómina (" + diaEfectivo + ")");
        }

        if (nominaPagoRepo.findByCajaDiaIdAndDeletedAtIsNull(cajaDiaId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya se registró el pago de nómina para esta caja");
        }

        List<NominaPersonal> personal = nominaPersonalRepo
                .findBySucursalIdAndDeletedAtIsNullOrderByNombreAsc(sucursalId);

        if (personal.isEmpty()) {
            throw new IllegalArgumentException("No hay personal registrado en la sucursal");
        }

        BigDecimal total = personal.stream()
                .map(NominaPersonal::getMontoSemanal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        NominaPago pago = NominaPago.builder()
                .cajaDia(caja)
                .sucursalId(sucursalId)
                .totalPagado(total)
                .registradoPor(usuarioRepo.getReferenceById(usuarioId))
                .build();

        return NominaPagoDTO.from(nominaPagoRepo.save(pago));
    }

    // ── Anulación ─────────────────────────────────────────────────────────

    @Transactional
    public void anularPago(Long cajaDiaId) {
        NominaPago pago = nominaPagoRepo.findByCajaDiaIdAndDeletedAtIsNull(cajaDiaId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "No hay pago de nómina activo para esta caja"));

        CajaDia caja = pago.getCajaDia();

        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException("Solo se puede anular la nómina con la caja abierta");
        }

        pago.setDeletedAt(DateTimeUtils.ahoraEnMagno());
        nominaPagoRepo.save(pago);
    }

    // ── Cálculo del día efectivo ──────────────────────────────────────────

    public LocalDate calcularDiaEfectivo(Long sucursalId) {
        String diaConfig = configSucursalRepo.findBySucursalId(sucursalId)
                .map(ConfigSucursal::getDiaPagoNomina)
                .orElse("JUEVES");

        DayOfWeek targetDow = parseDia(diaConfig);
        LocalDate hoy = DateTimeUtils.hoyEnMagno();
        LocalDate monday = hoy.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate candidato = monday.plusDays(targetDow.getValue() - 1L);

        Set<LocalDate> festivos = new HashSet<>(diaFestivoRepo.findFechasBySucursalId(sucursalId));

        while (candidato.getDayOfWeek() == DayOfWeek.SATURDAY
                || candidato.getDayOfWeek() == DayOfWeek.SUNDAY
                || festivos.contains(candidato)) {
            candidato = candidato.minusDays(1);
        }

        return candidato;
    }

    private DayOfWeek parseDia(String dia) {
        return switch (dia.toUpperCase()) {
            case "LUNES"     -> DayOfWeek.MONDAY;
            case "MARTES"    -> DayOfWeek.TUESDAY;
            case "MIERCOLES" -> DayOfWeek.WEDNESDAY;
            case "JUEVES"    -> DayOfWeek.THURSDAY;
            case "VIERNES"   -> DayOfWeek.FRIDAY;
            default          -> DayOfWeek.THURSDAY;
        };
    }
}
