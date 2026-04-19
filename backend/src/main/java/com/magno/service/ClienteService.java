package com.magno.service;

import com.magno.dto.cliente.ClienteCreateRequest;
import com.magno.dto.cliente.ClienteDetalleDTO;
import com.magno.dto.cliente.ClienteDocumentoDTO;
import com.magno.dto.cliente.ClienteResumenDTO;
import com.magno.dto.cliente.ClienteUpdateRequest;
import com.magno.model.Cliente;
import com.magno.model.ClienteDocumento;
import com.magno.model.Sucursal;
import com.magno.model.Usuario;
import com.magno.repository.ClienteDocumentoRepository;
import com.magno.repository.ClienteRepository;
import com.magno.repository.SucursalRepository;
import com.magno.repository.UsuarioRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class ClienteService {

    private final ClienteRepository clienteRepo;
    private final UsuarioRepository usuarioRepo;
    private final SucursalRepository sucursalRepo;
    private final ClienteDocumentoRepository clienteDocumentoRepository;

    public ClienteService(ClienteRepository clienteRepo,
                          UsuarioRepository usuarioRepo,
                          SucursalRepository sucursalRepo,
                          ClienteDocumentoRepository clienteDocumentoRepository) {
        this.clienteRepo = clienteRepo;
        this.usuarioRepo = usuarioRepo;
        this.sucursalRepo = sucursalRepo;
        this.clienteDocumentoRepository = clienteDocumentoRepository;
    }

    /** Listado paginado con filtros. asesorId null = todos los clientes (para roles con acceso global). */
    public Page<ClienteResumenDTO> buscarClientes(String buscar,
                                                   String estado,
                                                   Long asesorId,
                                                   Long sucursalId,
                                                   Boolean activo,
                                                   Pageable pageable) {
        Specification<Cliente> spec = Specification.where(null);

        if (buscar != null && !buscar.isBlank()) {
            String term = "%" + buscar.toLowerCase() + "%";
            spec = spec.and((root, q, cb) -> cb.or(
                    cb.like(cb.lower(cb.concat(cb.concat(root.get("nombre"), " "),
                            cb.concat(root.get("apellidoPaterno"), ""))), term),
                    cb.like(cb.lower(root.get("celular")), term),
                    cb.like(cb.lower(root.get("curp")), term),
                    cb.like(cb.lower(root.get("ineNumero")), term)
            ));
        }

        if (asesorId != null) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("asesor").get("id"), asesorId));
        }

        if (sucursalId != null) {
            spec = spec.and((root, q, cb) ->
                    cb.equal(root.get("sucursal").get("id"), sucursalId));
        }

        // El estado INACTIVO implica activo=false, los demás implican activo=true
        if ("INACTIVO".equals(estado)) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("activo"), false));
        } else if (activo != null) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("activo"), activo));
        } else {
            // Por defecto mostrar solo activos
            spec = spec.and((root, q, cb) -> cb.equal(root.get("activo"), true));
        }

        return clienteRepo.findAll(spec, pageable)
                .map(c -> ClienteResumenDTO.from(c, clienteRepo.tieneCredito(c.getId())));
    }

    /** Detalle completo de un cliente. */
    public ClienteDetalleDTO obtenerDetalle(Long id) {
        Cliente c = clienteRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Cliente no encontrado: " + id));
        return ClienteDetalleDTO.from(c, clienteRepo.tieneCredito(id));
    }

    /** Crea un nuevo cliente. */
    @Transactional
    public ClienteDetalleDTO crearCliente(ClienteCreateRequest req, Long createdByUserId) {
        if (clienteRepo.existsByCurp(req.curp())) {
            throw new IllegalArgumentException("Ya existe un cliente registrado con ese CURP");
        }
        if (clienteRepo.existsByCelular(req.celular())) {
            throw new IllegalArgumentException("El número de celular ya está registrado");
        }

        // Resolver asesor primero para poder heredar su sucursal si no se especificó
        Usuario asesor = null;
        if (req.asesorId() != null) {
            asesor = usuarioRepo.findById(req.asesorId())
                    .orElseThrow(() -> new EntityNotFoundException("Asesor no encontrado: " + req.asesorId()));
        }

        // sucursalId puede ser null cuando SUPERVISOR_CAMPO crea un cliente (el controller
        // no restringe el payload). Heredar la sucursal del asesor, o del propio creador.
        Long sucursalId = req.sucursalId();
        if (sucursalId == null && asesor != null) {
            sucursalId = asesor.getSucursal().getId();
        }
        if (sucursalId == null) {
            throw new IllegalArgumentException("sucursalId es requerido");
        }

        final Long resolvedSucursalId = sucursalId;
        Sucursal sucursal = sucursalRepo.findById(resolvedSucursalId)
                .orElseThrow(() -> new EntityNotFoundException("Sucursal no encontrada: " + resolvedSucursalId));

        Usuario creador = usuarioRepo.findById(createdByUserId).orElse(null);

        Cliente nuevo = Cliente.builder()
                .nombre(req.nombre())
                .apellidoPaterno(req.apellidoPaterno())
                .apellidoMaterno(req.apellidoMaterno())
                .fechaNacimiento(req.fechaNacimiento())
                .genero(req.genero())
                .estadoCivil(req.estadoCivil())
                .nombreConyuge(req.nombreConyuge())
                .telefonoFijo(req.telefonoFijo())
                .celular(req.celular())
                .ineTipo(req.ineTipo())
                .ineNumero(req.ineNumero())
                .curp(req.curp())
                .rfc(req.rfc())
                .domCalle(req.domCalle())
                .domNoExterior(req.domNoExterior())
                .domNoInterior(req.domNoInterior())
                .domColonia(req.domColonia())
                .domMunicipio(req.domMunicipio())
                .domEstado(req.domEstado())
                .domCodigoPostal(req.domCodigoPostal())
                .domTipoVivienda(req.domTipoVivienda())
                .domMontoRenta(req.domMontoRenta())
                .negocioNombre(req.negocioNombre())
                .negocioGiro(req.negocioGiro())
                .negocioAntiguedad(req.negocioAntiguedad())
                .negocioDireccion(req.negocioDireccion())
                .negocioCalle(req.negocioCalle())
                .negocioNoExterior(req.negocioNoExterior())
                .negocioNoInterior(req.negocioNoInterior())
                .negocioColonia(req.negocioColonia())
                .negocioMunicipio(req.negocioMunicipio())
                .negocioEstado(req.negocioEstado())
                .negocioCp(req.negocioCp())
                .negocioTipoLocal(req.negocioTipoLocal())
                .negocioMontoRenta(req.negocioMontoRenta())
                .negocioHorarios(req.negocioHorarios())
                .negocioLat(req.negocioLat())
                .negocioLng(req.negocioLng())
                .ingresosSemanales(req.ingresosSemanales())
                .gastosSemanales(req.gastosSemanales())
                .gastosRenta(req.gastosRenta())
                .gastosOtros(req.gastosOtros())
                .ref1Nombre(req.ref1Nombre())
                .ref1Telefono(req.ref1Telefono())
                .ref1Parentesco(req.ref1Parentesco())
                .ref2Nombre(req.ref2Nombre())
                .ref2Telefono(req.ref2Telefono())
                .ref2Parentesco(req.ref2Parentesco())
                .avalNombre(req.avalNombre())
                .avalTelefono(req.avalTelefono())
                .avalDireccion(req.avalDireccion())
                .avalIdentificacion(req.avalIdentificacion())
                .asesor(asesor)
                .sucursal(sucursal)
                .activo(true)
                .createdBy(creador)
                .build();

        return ClienteDetalleDTO.from(clienteRepo.save(nuevo), false);
    }

    /** Actualiza los campos editables de un cliente. */
    @Transactional
    public ClienteDetalleDTO actualizarCliente(Long id, ClienteUpdateRequest req) {
        Cliente c = clienteRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Cliente no encontrado: " + id));

        if (req.curp() != null && !req.curp().equals(c.getCurp())) {
            if (clienteRepo.existsByCurpAndIdNot(req.curp(), id)) {
                throw new IllegalArgumentException("Ya existe un cliente registrado con ese CURP");
            }
            c.setCurp(req.curp());
        }
        if (req.celular() != null && !req.celular().equals(c.getCelular())) {
            if (clienteRepo.existsByCelularAndIdNot(req.celular(), id)) {
                throw new IllegalArgumentException("El número de celular ya está registrado");
            }
            c.setCelular(req.celular());
        }

        if (req.nombre() != null)             c.setNombre(req.nombre());
        if (req.apellidoPaterno() != null)    c.setApellidoPaterno(req.apellidoPaterno());
        if (req.apellidoMaterno() != null)    c.setApellidoMaterno(req.apellidoMaterno());
        if (req.fechaNacimiento() != null)    c.setFechaNacimiento(req.fechaNacimiento());
        if (req.genero() != null)             c.setGenero(req.genero());
        if (req.estadoCivil() != null)        c.setEstadoCivil(req.estadoCivil());
        if (req.nombreConyuge() != null)      c.setNombreConyuge(req.nombreConyuge());
        if (req.telefonoFijo() != null)       c.setTelefonoFijo(req.telefonoFijo());
        if (req.ineTipo() != null)            c.setIneTipo(req.ineTipo());
        if (req.ineNumero() != null)          c.setIneNumero(req.ineNumero());
        if (req.rfc() != null)                c.setRfc(req.rfc());

        if (req.domCalle() != null)           c.setDomCalle(req.domCalle());
        if (req.domNoExterior() != null)      c.setDomNoExterior(req.domNoExterior());
        if (req.domNoInterior() != null)      c.setDomNoInterior(req.domNoInterior());
        if (req.domColonia() != null)         c.setDomColonia(req.domColonia());
        if (req.domMunicipio() != null)       c.setDomMunicipio(req.domMunicipio());
        if (req.domEstado() != null)          c.setDomEstado(req.domEstado());
        if (req.domCodigoPostal() != null)    c.setDomCodigoPostal(req.domCodigoPostal());
        if (req.domTipoVivienda() != null)    c.setDomTipoVivienda(req.domTipoVivienda());
        if (req.domMontoRenta() != null)      c.setDomMontoRenta(req.domMontoRenta());

        if (req.negocioNombre() != null)      c.setNegocioNombre(req.negocioNombre());
        if (req.negocioGiro() != null)        c.setNegocioGiro(req.negocioGiro());
        if (req.negocioAntiguedad() != null)  c.setNegocioAntiguedad(req.negocioAntiguedad());
        if (req.negocioDireccion() != null)   c.setNegocioDireccion(req.negocioDireccion());
        if (req.negocioCalle() != null)       c.setNegocioCalle(req.negocioCalle());
        if (req.negocioNoExterior() != null)  c.setNegocioNoExterior(req.negocioNoExterior());
        if (req.negocioNoInterior() != null)  c.setNegocioNoInterior(req.negocioNoInterior());
        if (req.negocioColonia() != null)     c.setNegocioColonia(req.negocioColonia());
        if (req.negocioMunicipio() != null)   c.setNegocioMunicipio(req.negocioMunicipio());
        if (req.negocioEstado() != null)      c.setNegocioEstado(req.negocioEstado());
        if (req.negocioCp() != null)          c.setNegocioCp(req.negocioCp());
        if (req.negocioTipoLocal() != null)   c.setNegocioTipoLocal(req.negocioTipoLocal());
        if (req.negocioMontoRenta() != null)  c.setNegocioMontoRenta(req.negocioMontoRenta());
        if (req.negocioHorarios() != null)    c.setNegocioHorarios(req.negocioHorarios());
        if (req.negocioLat() != null) c.setNegocioLat(req.negocioLat());
        if (req.negocioLng() != null) c.setNegocioLng(req.negocioLng());

        if (req.ingresosSemanales() != null)  c.setIngresosSemanales(req.ingresosSemanales());
        if (req.gastosSemanales() != null)    c.setGastosSemanales(req.gastosSemanales());
        if (req.gastosRenta() != null)        c.setGastosRenta(req.gastosRenta());
        if (req.gastosOtros() != null)        c.setGastosOtros(req.gastosOtros());

        if (req.ref1Nombre() != null)         c.setRef1Nombre(req.ref1Nombre());
        if (req.ref1Telefono() != null)       c.setRef1Telefono(req.ref1Telefono());
        if (req.ref1Parentesco() != null)     c.setRef1Parentesco(req.ref1Parentesco());
        if (req.ref2Nombre() != null)         c.setRef2Nombre(req.ref2Nombre());
        if (req.ref2Telefono() != null)       c.setRef2Telefono(req.ref2Telefono());
        if (req.ref2Parentesco() != null)     c.setRef2Parentesco(req.ref2Parentesco());

        if (req.avalNombre() != null)         c.setAvalNombre(req.avalNombre());
        if (req.avalTelefono() != null)       c.setAvalTelefono(req.avalTelefono());
        if (req.avalDireccion() != null)      c.setAvalDireccion(req.avalDireccion());
        if (req.avalIdentificacion() != null) c.setAvalIdentificacion(req.avalIdentificacion());

        if (req.sucursalId() != null) {
            Sucursal sucursal = sucursalRepo.findById(req.sucursalId())
                    .orElseThrow(() -> new EntityNotFoundException("Sucursal no encontrada: " + req.sucursalId()));
            c.setSucursal(sucursal);
        }

        if (req.asesorId() != null) {
            Usuario asesor = usuarioRepo.findById(req.asesorId())
                    .orElseThrow(() -> new EntityNotFoundException("Asesor no encontrado: " + req.asesorId()));
            c.setAsesor(asesor);
        }

        return ClienteDetalleDTO.from(clienteRepo.save(c), clienteRepo.tieneCredito(id));
    }

    /** Activa o desactiva un cliente. */
    @Transactional
    public ClienteResumenDTO cambiarEstado(Long id, boolean activo, String motivo) {
        Cliente c = clienteRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Cliente no encontrado: " + id));

        if (!activo && clienteRepo.tieneCredito(id)) {
            throw new IllegalArgumentException("No se puede desactivar un cliente con crédito activo");
        }

        c.setActivo(activo);
        return ClienteResumenDTO.from(clienteRepo.save(c), false);
    }

    /** Verifica si un CURP ya existe (excluyendo un id dado para updates). */
    public boolean curpDisponible(String curp, Long excludeId) {
        if (excludeId != null) {
            return !clienteRepo.existsByCurpAndIdNot(curp, excludeId);
        }
        return !clienteRepo.existsByCurp(curp);
    }

    /** Verifica si un celular ya existe (excluyendo un id dado para updates). */
    public boolean celularDisponible(String celular, Long excludeId) {
        if (excludeId != null) {
            return !clienteRepo.existsByCelularAndIdNot(celular, excludeId);
        }
        return !clienteRepo.existsByCelular(celular);
    }

    /** Contadores para métricas del encabezado. */
    public long contarActivos() {
        return clienteRepo.countByActivoTrue();
    }

    public long contarTotal() {
        return clienteRepo.count();
    }

    // ── Documentos del cliente ────────────────────────────────────────

    public List<ClienteDocumentoDTO> listarDocumentos(Long clienteId) {
        return clienteDocumentoRepository.findByClienteIdActivos(clienteId)
                .stream().map(ClienteDocumentoDTO::from).toList();
    }

    @Transactional
    public ClienteDocumentoDTO agregarDocumento(Long clienteId, String tipo, String url, String nombre, Long createdByUserId) {
        Cliente cliente = clienteRepo.findById(clienteId)
                .orElseThrow(() -> new EntityNotFoundException("Cliente no encontrado: " + clienteId));

        Usuario createdBy = usuarioRepo.findById(createdByUserId).orElse(null);

        ClienteDocumento doc = ClienteDocumento.builder()
                .cliente(cliente)
                .tipo(tipo)
                .url(url)
                .nombre(nombre)
                .createdBy(createdBy)
                .build();

        return ClienteDocumentoDTO.from(clienteDocumentoRepository.save(doc));
    }

    @Transactional
    public void eliminarDocumento(Long documentoId, Long clienteId) {
        ClienteDocumento doc = clienteDocumentoRepository.findById(documentoId)
                .orElseThrow(() -> new EntityNotFoundException("Documento no encontrado: " + documentoId));
        if (!doc.getCliente().getId().equals(clienteId)) {
            throw new IllegalArgumentException("El documento no pertenece al cliente indicado");
        }
        doc.setDeletedAt(java.time.OffsetDateTime.now());
        clienteDocumentoRepository.save(doc);
    }

    /**
     * Lista resumida de usuarios con rol ASESOR_COBRADOR activos.
     * Si sucursalId != null, filtra por sucursal (para SUPERVISOR_CAMPO).
     */
    public List<Map<String, Object>> listarAsesores(Long sucursalId) {
        return usuarioRepo.findByRolNombre("ASESOR_COBRADOR").stream()
                .filter(u -> Boolean.TRUE.equals(u.getActivo()))
                .filter(u -> sucursalId == null || sucursalId.equals(u.getSucursal().getId()))
                .map(u -> {
                    // Usar snake_case explícito: Jackson NO convierte keys de Map
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("id", u.getId());
                    m.put("nombre_completo", u.getNombreCompleto());
                    m.put("sucursal_id", u.getSucursal().getId());
                    m.put("sucursal_nombre", u.getSucursal().getNombre());
                    return m;
                })
                .toList();
    }
}
