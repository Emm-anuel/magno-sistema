package com.magno.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "config_umbrales_renovacion")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConfigUmbralRenovacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sucursal_id", nullable = false)
    private Long sucursalId;

    /** "DIARIO" o "SEMANAL" */
    @Column(name = "tipo_pago", nullable = false, length = 10)
    private String tipoPago;

    /** Plazo del crédito: 25/30 para DIARIO; 8/12 para SEMANAL */
    @Column(name = "plazo", nullable = false)
    private Integer plazo;

    /** Número mínimo de pagos realizados para ser elegible a renovar */
    @Column(name = "umbral_pagos", nullable = false)
    private Integer umbralPagos;

    @Column(name = "updated_by")
    private Long updatedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
