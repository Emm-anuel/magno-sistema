package com.magno.service;

import com.magno.dto.gasto.*;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.util.DateTimeUtils;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class GastoService {

    private final GastoRepository gastoRepo;
    private final CategoriaGastoRepository categoriaGastoRepo;
    private final CajaDiaRepository cajaDiaRepo;
    private final UsuarioRepository usuarioRepo;

    public GastoService(GastoRepository gastoRepo,
                        CategoriaGastoRepository categoriaGastoRepo,
                        CajaDiaRepository cajaDiaRepo,
                        UsuarioRepository usuarioRepo) {
        this.gastoRepo = gastoRepo;
        this.categoriaGastoRepo = categoriaGastoRepo;
        this.cajaDiaRepo = cajaDiaRepo;
        this.usuarioRepo = usuarioRepo;
    }

    // ── Consulta ──────────────────────────────────────────────────────────

    public GastosDelDiaDTO getGastos(Long cajaId) {
        if (!cajaDiaRepo.existsById(cajaId)) {
            throw new EntityNotFoundException("Caja no encontrada: " + cajaId);
        }

        List<Gasto> gastos = gastoRepo.findByCajaDiaIdAndDeletedAtIsNullOrderByCreatedAtAsc(cajaId);

        Map<Long, List<Gasto>> byCategoria = gastos.stream()
                .collect(Collectors.groupingBy(g -> g.getCategoriaGasto().getId()));

        List<GastoAgrupadoDTO> grupos = byCategoria.entrySet().stream()
                .map(entry -> {
                    List<Gasto> list = entry.getValue();
                    CategoriaGasto cat = list.get(0).getCategoriaGasto();
                    List<GastoDTO> gastoDTOs = list.stream().map(this::toDTO).toList();
                    BigDecimal subtotal = list.stream().map(Gasto::getMonto).reduce(BigDecimal.ZERO, BigDecimal::add);
                    return new GastoAgrupadoDTO(cat.getId(), cat.getNombre(), gastoDTOs, subtotal);
                })
                .sorted(Comparator.comparing(GastoAgrupadoDTO::categoriaNombre))
                .toList();

        BigDecimal total = grupos.stream()
                .map(GastoAgrupadoDTO::subtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new GastosDelDiaDTO(cajaId, grupos, total);
    }

    // ── Registro ──────────────────────────────────────────────────────────

    @Transactional
    public GastoDTO registrarGasto(Long cajaId, GastoCreateRequest req, Long userId) {
        CajaDia caja = cajaDiaRepo.findById(cajaId)
                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));

        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException(
                    "Solo se pueden registrar gastos mientras la caja está abierta");
        }

        CategoriaGasto categoria = categoriaGastoRepo.findById(req.categoriaGastoId())
                .filter(CategoriaGasto::isActivo)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Categoría de gasto no encontrada o inactiva"));

        if (!categoria.getSucursalId().equals(caja.getSucursal().getId())) {
            throw new IllegalArgumentException(
                    "La categoría no pertenece a la sucursal de la caja");
        }

        Gasto gasto = Gasto.builder()
                .cajaDia(caja)
                .categoriaGasto(categoria)
                .concepto(req.concepto())
                .monto(req.monto())
                .registradoPor(usuarioRepo.getReferenceById(userId))
                .build();

        return toDTO(gastoRepo.save(gasto));
    }

    // ── Actualización ─────────────────────────────────────────────────────

    @Transactional
    public GastoDTO actualizarGasto(Long id, GastoUpdateRequest req) {
        Gasto gasto = gastoRepo.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new EntityNotFoundException("Gasto no encontrado: " + id));

        CajaDia caja = gasto.getCajaDia();

        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException(
                    "Solo se pueden modificar gastos mientras la caja está abierta");
        }

        if (!DateTimeUtils.hoyEnMagno().equals(caja.getFecha())) {
            throw new IllegalArgumentException(
                    "Solo se pueden modificar gastos del día actual");
        }

        CategoriaGasto categoria = categoriaGastoRepo.findById(req.categoriaGastoId())
                .filter(CategoriaGasto::isActivo)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Categoría de gasto no encontrada o inactiva"));

        if (!categoria.getSucursalId().equals(caja.getSucursal().getId())) {
            throw new IllegalArgumentException(
                    "La categoría no pertenece a la sucursal de la caja");
        }

        gasto.setCategoriaGasto(categoria);
        gasto.setConcepto(req.concepto());
        gasto.setMonto(req.monto());

        return toDTO(gastoRepo.save(gasto));
    }

    // ── Eliminación (soft delete) ─────────────────────────────────────────

    @Transactional
    public void eliminarGasto(Long id) {
        Gasto gasto = gastoRepo.findByIdAndDeletedAtIsNull(id)
                .orElseThrow(() -> new EntityNotFoundException("Gasto no encontrado: " + id));

        CajaDia caja = gasto.getCajaDia();

        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException(
                    "Solo se pueden eliminar gastos mientras la caja está abierta");
        }

        if (!DateTimeUtils.hoyEnMagno().equals(caja.getFecha())) {
            throw new IllegalArgumentException(
                    "Solo se pueden eliminar gastos del día actual");
        }

        gasto.setDeletedAt(DateTimeUtils.ahoraEnMagno());
        gastoRepo.save(gasto);
    }

    // ── Categorías ────────────────────────────────────────────────────────

    public List<CategoriaGastoDTO> getCategorias(Long sucursalId) {
        return categoriaGastoRepo.findBySucursalIdAndActivoTrueOrderByNombreAsc(sucursalId)
                .stream()
                .map(this::toCategoria)
                .toList();
    }

    @Transactional
    public CategoriaGastoDTO crearCategoria(Long sucursalId, CategoriaGastoUpsertRequest req) {
        CategoriaGasto cat = CategoriaGasto.builder()
                .sucursalId(sucursalId)
                .nombre(req.nombre().trim())
                .descripcion(req.descripcion())
                .build();
        return toCategoria(categoriaGastoRepo.save(cat));
    }

    @Transactional
    public CategoriaGastoDTO actualizarCategoria(Long id, CategoriaGastoUpsertRequest req) {
        CategoriaGasto cat = categoriaGastoRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Categoría no encontrada: " + id));
        cat.setNombre(req.nombre().trim());
        cat.setDescripcion(req.descripcion());
        return toCategoria(categoriaGastoRepo.save(cat));
    }

    @Transactional
    public void desactivarCategoria(Long id) {
        CategoriaGasto cat = categoriaGastoRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Categoría no encontrada: " + id));
        cat.setActivo(false);
        categoriaGastoRepo.save(cat);
    }

    // ── Helper ────────────────────────────────────────────────────────────

    private CategoriaGastoDTO toCategoria(CategoriaGasto c) {
        return new CategoriaGastoDTO(c.getId(), c.getSucursalId(), c.getNombre(), c.getDescripcion());
    }

    private GastoDTO toDTO(Gasto g) {
        return new GastoDTO(
                g.getId(),
                g.getCajaDia().getId(),
                g.getCategoriaGasto().getId(),
                g.getCategoriaGasto().getNombre(),
                g.getConcepto(),
                g.getMonto(),
                g.getRegistradoPor().getId(),
                g.getRegistradoPor().getNombreCompleto(),
                g.getCreatedAt());
    }
}
