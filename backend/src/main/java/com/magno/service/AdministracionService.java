package com.magno.service;

import com.magno.dto.admin.*;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.util.DateTimeUtils;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class AdministracionService {

    private final ConfigSucursalRepository configSucursalRepo;
    private final ConfigMultaRepository configMultaRepo;
    private final ConfigRangoCreditoRepository configRangoRepo;
    private final ConfigUmbralRenovacionRepository configUmbralRepo;
    private final NominaPersonalRepository nominaRepo;
    private final ConceptoInversionRepository conceptoRepo;
    private final DiaFestivoRepository diaFestivoRepo;
    private final BitacoraConfigRepository bitacoraConfigRepo;
    private final UsuarioRepository usuarioRepo;
    private final SucursalRepository sucursalRepo;

    public AdministracionService(
            ConfigSucursalRepository configSucursalRepo,
            ConfigMultaRepository configMultaRepo,
            ConfigRangoCreditoRepository configRangoRepo,
            ConfigUmbralRenovacionRepository configUmbralRepo,
            NominaPersonalRepository nominaRepo,
            ConceptoInversionRepository conceptoRepo,
            DiaFestivoRepository diaFestivoRepo,
            BitacoraConfigRepository bitacoraConfigRepo,
            UsuarioRepository usuarioRepo,
            SucursalRepository sucursalRepo) {
        this.configSucursalRepo = configSucursalRepo;
        this.configMultaRepo = configMultaRepo;
        this.configRangoRepo = configRangoRepo;
        this.configUmbralRepo = configUmbralRepo;
        this.nominaRepo = nominaRepo;
        this.conceptoRepo = conceptoRepo;
        this.diaFestivoRepo = diaFestivoRepo;
        this.bitacoraConfigRepo = bitacoraConfigRepo;
        this.usuarioRepo = usuarioRepo;
        this.sucursalRepo = sucursalRepo;
    }

    // ─────────────────────────────────────────────────────────────────
    // CONFIG GENERAL
    // ─────────────────────────────────────────────────────────────────

    public ConfigSucursalDTO getConfigSucursal(Long sucursalId) {
        return configSucursalRepo.findBySucursalId(sucursalId)
                .map(ConfigSucursalDTO::from)
                .orElse(ConfigSucursalDTO.defaults(sucursalId));
    }

    @Transactional
    public ConfigSucursalDTO saveConfigSucursal(Long sucursalId, ConfigSucursalRequest req, Long usuarioId) {
        validarSucursal(sucursalId);

        ConfigSucursal config = configSucursalRepo.findBySucursalId(sucursalId)
                .orElse(ConfigSucursal.builder().sucursalId(sucursalId).build());

        String horaPrev  = config.getHoraLimiteOperacion() != null ? config.getHoraLimiteOperacion().toString() : null;
        String ahorroP   = config.getPorcentajeAhorro() != null ? config.getPorcentajeAhorro().toPlainString() : null;
        String ahorroF   = config.getMontoAhorroFijo() != null ? config.getMontoAhorroFijo().toPlainString() : null;
        String nomP      = config.getDiaPagoNomina();

        config.setHoraLimiteOperacion(req.horaLimiteOperacion());
        config.setPorcentajeAhorro(req.porcentajeAhorro());
        config.setMontoAhorroFijo(req.montoAhorroFijo());
        config.setDiaPagoNomina(req.diaPagoNomina().toUpperCase());
        config.setUpdatedBy(usuarioId);
        configSucursalRepo.save(config);

        registrarCambio(usuarioId, sucursalId, "CONFIG_GENERAL", "hora_limite_operacion", horaPrev, req.horaLimiteOperacion().toString());
        registrarCambio(usuarioId, sucursalId, "AHORRO", "porcentaje_ahorro", ahorroP, req.porcentajeAhorro().toPlainString());
        registrarCambio(usuarioId, sucursalId, "AHORRO", "monto_ahorro_fijo", ahorroF, req.montoAhorroFijo().toPlainString());
        registrarCambio(usuarioId, sucursalId, "CONFIG_GENERAL", "dia_pago_nomina", nomP, req.diaPagoNomina().toUpperCase());

        return ConfigSucursalDTO.from(config);
    }

    // ─────────────────────────────────────────────────────────────────
    // CONFIG MULTAS
    // ─────────────────────────────────────────────────────────────────

    public List<ConfigMultaAdminDTO> getMultas(Long sucursalId) {
        return configMultaRepo.findBySucursalId(sucursalId).stream()
                .map(ConfigMultaAdminDTO::from)
                .toList();
    }

    @Transactional
    public List<ConfigMultaAdminDTO> saveMultas(Long sucursalId, ConfigMultaListRequest req, Long usuarioId) {
        validarSucursal(sucursalId);
        validarRangosMultaNoSolapados(req.multas());

        configMultaRepo.deleteBySucursalId(sucursalId);
        configMultaRepo.flush();
        for (ConfigMultaListRequest.MultaItem item : req.multas()) {
            configMultaRepo.save(ConfigMulta.builder()
                    .sucursalId(sucursalId)
                    .rangoMin(item.rangoMin())
                    .rangoMax(item.rangoMax())
                    .multaNoPago(item.multaNoPago())
                    .multaIncompletos(item.multaIncompletos())
                    .multaSemanalNoPago(item.multaSemanalNoPago())
                    .multaSemanalIncompletos(item.multaSemanalIncompletos())
                    .build());
        }

        registrarCambio(usuarioId, sucursalId, "MULTAS", "rangos_completos",
                "reemplazado", req.multas().size() + " rangos de multa");

        return configMultaRepo.findBySucursalId(sucursalId).stream()
                .map(ConfigMultaAdminDTO::from)
                .toList();
    }

    /** El cobro busca el rango de multa por monto con un Optional de resultado único — los rangos no pueden solaparse. */
    private void validarRangosMultaNoSolapados(List<ConfigMultaListRequest.MultaItem> items) {
        List<ConfigMultaListRequest.MultaItem> ordenados = items.stream()
                .sorted(java.util.Comparator.comparing(ConfigMultaListRequest.MultaItem::rangoMin))
                .toList();
        for (int i = 1; i < ordenados.size(); i++) {
            if (ordenados.get(i).rangoMin().compareTo(ordenados.get(i - 1).rangoMax()) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Los rangos de multa no pueden solaparse ni repetirse entre sí");
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // CONFIG RANGOS CRÉDITO
    // ─────────────────────────────────────────────────────────────────

    public List<ConfigRangoCreditoDTO> getRangos(Long sucursalId) {
        return configRangoRepo.findBySucursalIdOrderByTipoPagoAscRangoMinAsc(sucursalId).stream()
                .map(ConfigRangoCreditoDTO::from)
                .toList();
    }

    @Transactional
    public List<ConfigRangoCreditoDTO> saveRangos(Long sucursalId,
                                                   ConfigRangoCreditoRequest req,
                                                   Long usuarioId) {
        validarSucursal(sucursalId);

        // Las filas viejas deben quedar borradas en la BD antes de insertar las nuevas:
        // con GenerationType.IDENTITY el INSERT se ejecuta de inmediato y puede chocar
        // contra uq_config_rango si un rango nuevo reutiliza el mismo rango_min.
        configRangoRepo.deleteBySucursalIdAndTipoPago(sucursalId, "DIARIO");
        configRangoRepo.deleteBySucursalIdAndTipoPago(sucursalId, "SEMANAL");
        configRangoRepo.flush();

        for (ConfigRangoCreditoRequest.RangoItem item : req.diario()) {
            configRangoRepo.save(ConfigRangoCredito.builder()
                    .sucursalId(sucursalId)
                    .tipoPago("DIARIO")
                    .rangoMin(item.rangoMin())
                    .rangoMax(item.rangoMax())
                    .plazo(item.plazo())
                    .tasaInteres(item.tasaInteres())
                    .updatedBy(usuarioId)
                    .build());
        }

        for (ConfigRangoCreditoRequest.RangoItem item : req.semanal()) {
            configRangoRepo.save(ConfigRangoCredito.builder()
                    .sucursalId(sucursalId)
                    .tipoPago("SEMANAL")
                    .rangoMin(item.rangoMin())
                    .rangoMax(item.rangoMax())
                    .plazo(item.plazo())
                    .tasaInteres(item.tasaInteres())
                    .updatedBy(usuarioId)
                    .build());
        }

        registrarCambio(usuarioId, sucursalId, "RANGOS_CREDITO", "rangos_completos",
                "reemplazado", req.diario().size() + " diarios, " + req.semanal().size() + " semanales");

        return configRangoRepo.findBySucursalIdOrderByTipoPagoAscRangoMinAsc(sucursalId).stream()
                .map(ConfigRangoCreditoDTO::from)
                .toList();
    }

    // ─────────────────────────────────────────────────────────────────
    // CONFIG UMBRALES RENOVACIÓN
    // ─────────────────────────────────────────────────────────────────

    public List<ConfigUmbralRenovacionDTO> getUmbrales(Long sucursalId) {
        return configUmbralRepo.findBySucursalIdOrderByTipoPagoAscPlazoAsc(sucursalId).stream()
                .map(ConfigUmbralRenovacionDTO::from)
                .toList();
    }

    @Transactional
    public List<ConfigUmbralRenovacionDTO> saveUmbrales(Long sucursalId,
                                                         ConfigUmbralRenovacionRequest req,
                                                         Long usuarioId) {
        validarSucursal(sucursalId);

        configUmbralRepo.deleteBySucursalId(sucursalId);
        configUmbralRepo.flush();
        for (ConfigUmbralRenovacionRequest.UmbralItem item : req.umbrales()) {
            configUmbralRepo.save(ConfigUmbralRenovacion.builder()
                    .sucursalId(sucursalId)
                    .tipoPago(item.tipoPago().toUpperCase())
                    .plazo(item.plazo())
                    .umbralPagos(item.umbralPagos())
                    .updatedBy(usuarioId)
                    .build());
        }

        registrarCambio(usuarioId, sucursalId, "UMBRALES_RENOVACION", "umbrales_completos",
                "reemplazado", req.umbrales().size() + " registros");

        return configUmbralRepo.findBySucursalIdOrderByTipoPagoAscPlazoAsc(sucursalId).stream()
                .map(ConfigUmbralRenovacionDTO::from)
                .toList();
    }

    // ─────────────────────────────────────────────────────────────────
    // NÓMINA PERSONAL
    // ─────────────────────────────────────────────────────────────────

    public List<NominaPersonalDTO> getNomina(Long sucursalId) {
        return nominaRepo.findBySucursalIdAndDeletedAtIsNullOrderByNombreAsc(sucursalId).stream()
                .map(NominaPersonalDTO::from)
                .toList();
    }

    @Transactional
    public NominaPersonalDTO crearNomina(Long sucursalId, NominaPersonalRequest req, Long usuarioId) {
        validarSucursal(sucursalId);
        NominaPersonal np = nominaRepo.save(NominaPersonal.builder()
                .sucursalId(sucursalId)
                .nombre(req.nombre().trim())
                .puesto(req.puesto().trim())
                .montoSemanal(req.montoSemanal())
                .createdBy(usuarioId)
                .updatedBy(usuarioId)
                .build());
        registrarCambio(usuarioId, sucursalId, "NOMINA", "alta", null, req.nombre());
        return NominaPersonalDTO.from(np);
    }

    @Transactional
    public NominaPersonalDTO actualizarNomina(Long sucursalId, Long nominaId,
                                               NominaPersonalRequest req, Long usuarioId) {
        NominaPersonal np = nominaRepo.findByIdAndDeletedAtIsNull(nominaId)
                .orElseThrow(() -> new EntityNotFoundException("Registro de nómina no encontrado: " + nominaId));
        if (!np.getSucursalId().equals(sucursalId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El registro no pertenece a esta sucursal");
        }

        String prevMonto = np.getMontoSemanal().toPlainString();
        np.setNombre(req.nombre().trim());
        np.setPuesto(req.puesto().trim());
        np.setMontoSemanal(req.montoSemanal());
        np.setUpdatedBy(usuarioId);
        nominaRepo.save(np);

        registrarCambio(usuarioId, sucursalId, "NOMINA", "monto_semanal[" + np.getNombre() + "]",
                prevMonto, req.montoSemanal().toPlainString());
        return NominaPersonalDTO.from(np);
    }

    @Transactional
    public void eliminarNomina(Long sucursalId, Long nominaId, Long usuarioId) {
        NominaPersonal np = nominaRepo.findByIdAndDeletedAtIsNull(nominaId)
                .orElseThrow(() -> new EntityNotFoundException("Registro de nómina no encontrado: " + nominaId));
        if (!np.getSucursalId().equals(sucursalId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El registro no pertenece a esta sucursal");
        }
        np.setDeletedAt(DateTimeUtils.ahoraEnMagno());
        np.setUpdatedBy(usuarioId);
        nominaRepo.save(np);
        registrarCambio(usuarioId, sucursalId, "NOMINA", "baja", np.getNombre(), null);
    }

    // ─────────────────────────────────────────────────────────────────
    // CONCEPTOS DE INVERSIÓN
    // ─────────────────────────────────────────────────────────────────

    public List<ConceptoInversionDTO> getConceptos(Long sucursalId) {
        return conceptoRepo.findBySucursalIdAndDeletedAtIsNullOrderByNombreAsc(sucursalId).stream()
                .map(ConceptoInversionDTO::from)
                .toList();
    }

    @Transactional
    public ConceptoInversionDTO crearConcepto(Long sucursalId, ConceptoInversionRequest req, Long usuarioId) {
        validarSucursal(sucursalId);
        String nombre = req.nombre().trim();
        if (conceptoRepo.existsBySucursalIdAndNombreIgnoreCaseAndDeletedAtIsNull(sucursalId, nombre)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un concepto con ese nombre");
        }
        ConceptoInversion c = conceptoRepo.save(ConceptoInversion.builder()
                .sucursalId(sucursalId)
                .nombre(nombre)
                .createdBy(usuarioId)
                .updatedBy(usuarioId)
                .build());
        registrarCambio(usuarioId, sucursalId, "CONCEPTOS", "alta", null, nombre);
        return ConceptoInversionDTO.from(c);
    }

    @Transactional
    public ConceptoInversionDTO actualizarConcepto(Long sucursalId, Long conceptoId,
                                                    ConceptoInversionRequest req, Long usuarioId) {
        ConceptoInversion c = conceptoRepo.findByIdAndDeletedAtIsNull(conceptoId)
                .orElseThrow(() -> new EntityNotFoundException("Concepto no encontrado: " + conceptoId));
        if (!c.getSucursalId().equals(sucursalId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El concepto no pertenece a esta sucursal");
        }
        String prevNombre = c.getNombre();
        c.setNombre(req.nombre().trim());
        c.setUpdatedBy(usuarioId);
        conceptoRepo.save(c);
        registrarCambio(usuarioId, sucursalId, "CONCEPTOS", "nombre", prevNombre, req.nombre().trim());
        return ConceptoInversionDTO.from(c);
    }

    @Transactional
    public void eliminarConcepto(Long sucursalId, Long conceptoId, Long usuarioId) {
        ConceptoInversion c = conceptoRepo.findByIdAndDeletedAtIsNull(conceptoId)
                .orElseThrow(() -> new EntityNotFoundException("Concepto no encontrado: " + conceptoId));
        if (!c.getSucursalId().equals(sucursalId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El concepto no pertenece a esta sucursal");
        }
        c.setDeletedAt(DateTimeUtils.ahoraEnMagno());
        c.setUpdatedBy(usuarioId);
        conceptoRepo.save(c);
        registrarCambio(usuarioId, sucursalId, "CONCEPTOS", "baja", c.getNombre(), null);
    }

    // ─────────────────────────────────────────────────────────────────
    // DÍAS INHÁBILES (globales — aplica_sucursal_id = NULL)
    // ─────────────────────────────────────────────────────────────────

    public List<DiaFestivoAdminDTO> getDiasInhabiles() {
        return diaFestivoRepo.findByAplicaSucursalIdIsNullOrderByFechaAsc().stream()
                .map(DiaFestivoAdminDTO::from)
                .toList();
    }

    @Transactional
    public DiaFestivoAdminDTO crearDiaInhabil(DiaFestivoAdminRequest req, Long usuarioId) {
        if (diaFestivoRepo.existsByFechaAndAplicaSucursalIdIsNull(req.fecha())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya existe un día inhábil global para la fecha " + req.fecha());
        }
        DiaFestivo d = diaFestivoRepo.save(DiaFestivo.builder()
                .fecha(req.fecha())
                .descripcion(req.descripcion().trim())
                .aplicaSucursalId(null)
                .createdBy(usuarioId)
                .build());
        registrarCambio(usuarioId, null, "DIAS_INHABILES", "alta", null, req.fecha() + " — " + req.descripcion());
        return DiaFestivoAdminDTO.from(d);
    }

    @Transactional
    public DiaFestivoAdminDTO actualizarDiaInhabil(Long id, DiaFestivoAdminRequest req, Long usuarioId) {
        DiaFestivo d = diaFestivoRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Día inhábil no encontrado: " + id));
        if (d.getAplicaSucursalId() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Este día inhábil es específico de una sucursal y no puede editarse aquí");
        }
        String prev = d.getFecha() + " — " + d.getDescripcion();
        d.setFecha(req.fecha());
        d.setDescripcion(req.descripcion().trim());
        diaFestivoRepo.save(d);
        registrarCambio(usuarioId, null, "DIAS_INHABILES", "edicion", prev,
                req.fecha() + " — " + req.descripcion());
        return DiaFestivoAdminDTO.from(d);
    }

    @Transactional
    public void eliminarDiaInhabil(Long id, Long usuarioId) {
        DiaFestivo d = diaFestivoRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Día inhábil no encontrado: " + id));
        if (d.getAplicaSucursalId() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Este día inhábil es específico de una sucursal y no puede eliminarse aquí");
        }
        String desc = d.getFecha() + " — " + d.getDescripcion();
        diaFestivoRepo.delete(d);
        registrarCambio(usuarioId, null, "DIAS_INHABILES", "baja", desc, null);
    }

    // ─────────────────────────────────────────────────────────────────
    // BITÁCORA DE CONFIGURACIÓN
    // ─────────────────────────────────────────────────────────────────

    public Page<BitacoraConfigDTO> getBitacora(Long sucursalId, String seccion,
                                                Long usuarioId,
                                                LocalDate desde, LocalDate hasta,
                                                Pageable pageable) {
        OffsetDateTime desdeTs = desde != null
                ? desde.atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime() : null;
        OffsetDateTime hastaTs = hasta != null
                ? hasta.plusDays(1).atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime() : null;

        Specification<BitacoraConfig> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (sucursalId != null)
                predicates.add(cb.equal(root.get("sucursalId"), sucursalId));
            if (seccion != null && !seccion.isBlank())
                predicates.add(cb.equal(root.get("seccion"), seccion));
            if (usuarioId != null)
                predicates.add(cb.equal(root.get("usuarioId"), usuarioId));
            if (desdeTs != null)
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), desdeTs));
            if (hastaTs != null)
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), hastaTs));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return bitacoraConfigRepo.findAll(spec, pageable)
                .map(b -> {
                    String usuarioNombre = b.getUsuarioId() != null
                            ? usuarioRepo.findById(b.getUsuarioId())
                                    .map(Usuario::getNombreCompleto).orElse(null)
                            : null;
                    String sucursalNombre = b.getSucursalId() != null
                            ? sucursalRepo.findById(b.getSucursalId())
                                    .map(Sucursal::getNombre).orElse(null)
                            : "Global";
                    return new BitacoraConfigDTO(
                            b.getId(), b.getUsuarioId(), usuarioNombre,
                            b.getSucursalId(), sucursalNombre,
                            b.getSeccion(), b.getCampo(),
                            b.getValorAnterior(), b.getValorNuevo(), b.getCreatedAt());
                });
    }

    // ─────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────

    private void registrarCambio(Long usuarioId, Long sucursalId, String seccion,
                                  String campo, String valorAnterior, String valorNuevo) {
        bitacoraConfigRepo.save(BitacoraConfig.builder()
                .usuarioId(usuarioId)
                .sucursalId(sucursalId)
                .seccion(seccion)
                .campo(campo)
                .valorAnterior(valorAnterior)
                .valorNuevo(valorNuevo)
                .build());
    }

    private void validarSucursal(Long sucursalId) {
        if (!sucursalRepo.existsById(sucursalId)) {
            throw new EntityNotFoundException("Sucursal no encontrada: " + sucursalId);
        }
    }
}
