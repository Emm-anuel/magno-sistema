package com.magno.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "nomina_pago")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"cajaDia", "registradoPor"})
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class NominaPago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "caja_dia_id", nullable = false)
    private CajaDia cajaDia;

    @Column(name = "sucursal_id", nullable = false)
    private Long sucursalId;

    @Column(name = "total_pagado", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPagado;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registrado_por", nullable = false)
    private Usuario registradoPor;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @PrePersist
    void prePersist() {
        createdAt = OffsetDateTime.now();
    }
}
