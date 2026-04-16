package com.magno.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "config_multas")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConfigMulta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sucursal_id", nullable = false)
    private Long sucursalId;

    @Column(name = "rango_min", nullable = false, precision = 12, scale = 2)
    private BigDecimal rangoMin;

    @Column(name = "rango_max", nullable = false, precision = 12, scale = 2)
    private BigDecimal rangoMax;

    /** Monto de multa por cada día sin pago (Tipo 1). */
    @Column(name = "multa_no_pago", nullable = false, precision = 12, scale = 2)
    private BigDecimal multaNoPago;

    /** Monto de multa por cada 2 pagos incompletos acumulados (Tipo 2). */
    @Column(name = "multa_incompletos", nullable = false, precision = 12, scale = 2)
    private BigDecimal multaIncompletos;

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
