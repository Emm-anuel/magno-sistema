package com.magno.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "config_rangos_credito")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConfigRangoCredito {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sucursal_id", nullable = false)
    private Long sucursalId;

    /** "DIARIO" o "SEMANAL" */
    @Column(name = "tipo_pago", nullable = false, length = 10)
    private String tipoPago;

    @Column(name = "rango_min", nullable = false, precision = 12, scale = 2)
    private BigDecimal rangoMin;

    @Column(name = "rango_max", nullable = false, precision = 12, scale = 2)
    private BigDecimal rangoMax;

    /** Días hábiles para DIARIO (25/30); semanas para SEMANAL (8/12) */
    @Column(name = "plazo", nullable = false)
    private Integer plazo;

    /** Tasa de interés sobre capital: 0.30 = 30% */
    @Column(name = "tasa_interes", nullable = false, precision = 5, scale = 4)
    private BigDecimal tasaInteres;

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
