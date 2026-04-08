package com.magno.controller;

import com.magno.model.Sucursal;
import com.magno.repository.SucursalRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/sucursales")
public class SucursalController {

    private final SucursalRepository sucursalRepo;

    public SucursalController(SucursalRepository sucursalRepo) {
        this.sucursalRepo = sucursalRepo;
    }

    @GetMapping
    public ResponseEntity<List<Sucursal>> listar() {
        return ResponseEntity.ok(sucursalRepo.findByActivaTrue());
    }
}
