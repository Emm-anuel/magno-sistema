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

    /** Monto de multa por cada día sin pago en créditos DIARIOS (Tipo 1). */
    @Column(name = "multa_no_pago", nullable = false, precision = 12, scale = 2)
    private BigDecimal multaNoPago;

    /**
     * Monto de multa por cada 2 pagos incompletos acumulados en créditos DIARIOS
     * (Tipo 2).
     */
    @Column(name = "multa_incompletos", nullable = false, precision = 12, scale = 2)
    private BigDecimal multaIncompletos;

    /**
     * Monto de multa por cada semana sin pago en créditos SEMANALES (Tipo 1).
     * Default: $300
     */
    @Column(name = "multa_semanal_no_pago", nullable = false, precision = 12, scale = 2)
    private BigDecimal multaSemanalNoPago;

    /**
     * Monto de multa por cada 2 pagos incompletos acumulados en créditos SEMANALES
     * (Tipo 2). Default: $300
     */
    @Column(name = "multa_semanal_incompletos", nullable = false, precision = 12, scale = 2)
    private BigDecimal multaSemanalIncompletos;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        // Defaults si no se especificaron
        if (multaSemanalNoPago == null)
            multaSemanalNoPago = new BigDecimal("300.00");
        if (multaSemanalIncompletos == null)
            multaSemanalIncompletos = new BigDecimal("300.00");
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
