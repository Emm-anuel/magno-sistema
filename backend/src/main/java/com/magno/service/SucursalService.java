package com.magno.service;

import com.magno.dto.sucursal.SucursalCreateRequest;
import com.magno.dto.sucursal.SucursalDTO;
import com.magno.dto.sucursal.SucursalUpdateRequest;
import com.magno.model.CategoriaGasto;
import com.magno.model.Sucursal;
import com.magno.repository.CategoriaGastoRepository;
import com.magno.repository.SucursalRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class SucursalService {

    // Categorías de gasto con las que arranca toda sucursal nueva (mismo catálogo
    // inicial que V19__gastos_seed.sql aplicó a las sucursales existentes).
    private static final List<String> CATEGORIAS_GASTO_INICIALES =
            List.of("Gasolina", "Servicio de Motos", "Gastos Varios");

    private final SucursalRepository sucursalRepo;
    private final CategoriaGastoRepository categoriaGastoRepo;

    public SucursalService(SucursalRepository sucursalRepo, CategoriaGastoRepository categoriaGastoRepo) {
        this.sucursalRepo = sucursalRepo;
        this.categoriaGastoRepo = categoriaGastoRepo;
    }

    public List<SucursalDTO> listarActivas() {
        return sucursalRepo.findByActivaTrue(Sort.by("nombre"))
                .stream()
                .map(SucursalDTO::from)
                .toList();
    }

    public List<SucursalDTO> listarTodas() {
        return sucursalRepo.findAll(Sort.by("nombre"))
                .stream()
                .map(SucursalDTO::from)
                .toList();
    }

    public SucursalDTO obtener(Long id) {
        return sucursalRepo.findById(id)
                .map(SucursalDTO::from)
                .orElseThrow(() -> new EntityNotFoundException("Sucursal no encontrada: " + id));
    }

    @Transactional
    public SucursalDTO crear(SucursalCreateRequest req) {
        Sucursal nueva = Sucursal.builder()
                .nombre(req.nombre())
                .direccion(req.direccion())
                .telefono(req.telefono())
                .activa(true)
                .build();

        Sucursal guardada = sucursalRepo.save(nueva);
        CATEGORIAS_GASTO_INICIALES.forEach(nombreCategoria ->
                categoriaGastoRepo.save(CategoriaGasto.builder()
                        .sucursalId(guardada.getId())
                        .nombre(nombreCategoria)
                        .activo(true)
                        .build()));

        return SucursalDTO.from(guardada);
    }

    @Transactional
    public SucursalDTO actualizar(Long id, SucursalUpdateRequest req) {
        Sucursal s = sucursalRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Sucursal no encontrada: " + id));

        s.setNombre(req.nombre());
        s.setDireccion(req.direccion());
        s.setTelefono(req.telefono());

        return SucursalDTO.from(sucursalRepo.save(s));
    }

    @Transactional
    public SucursalDTO cambiarEstado(Long id, boolean activa) {
        Sucursal s = sucursalRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Sucursal no encontrada: " + id));
        s.setActiva(activa);
        return SucursalDTO.from(sucursalRepo.save(s));
    }
}
