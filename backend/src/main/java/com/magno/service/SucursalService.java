package com.magno.service;

import com.magno.dto.sucursal.SucursalCreateRequest;
import com.magno.dto.sucursal.SucursalDTO;
import com.magno.dto.sucursal.SucursalUpdateRequest;
import com.magno.model.Sucursal;
import com.magno.repository.SucursalRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class SucursalService {

    private final SucursalRepository sucursalRepo;

    public SucursalService(SucursalRepository sucursalRepo) {
        this.sucursalRepo = sucursalRepo;
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

        return SucursalDTO.from(sucursalRepo.save(nueva));
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
