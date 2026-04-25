package com.magno.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "caja_movimiento_inversion")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"cajaDia", "conceptoInversion", "registradoPor"})
public class CajaMovimientoInversion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "caja_dia_id", nullable = false)
    private CajaDia cajaDia;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "concepto_inversion_id", nullable = false)
    private ConceptoInversion conceptoInversion;

    @Column(length = 255)
    private String descripcion;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registrado_por", nullable = false)
    private Usuario registradoPor;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void prePersist() {
        createdAt = OffsetDateTime.now();
    }
}
