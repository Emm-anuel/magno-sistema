package com.magno.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.OffsetDateTime;

@Entity
@Table(name = "config_sucursal")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConfigSucursal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sucursal_id", nullable = false, unique = true)
    private Long sucursalId;

    @Column(name = "hora_limite_operacion", nullable = false)
    private LocalTime horaLimiteOperacion;

    @Column(name = "porcentaje_ahorro", nullable = false, precision = 5, scale = 4)
    private BigDecimal porcentajeAhorro;

    @Column(name = "monto_ahorro_fijo", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoAhorroFijo;

    @Column(name = "dia_pago_nomina", nullable = false, length = 10)
    private String diaPagoNomina;

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
        if (horaLimiteOperacion == null) horaLimiteOperacion = LocalTime.of(17, 0);
        if (porcentajeAhorro == null) porcentajeAhorro = new BigDecimal("0.2400");
        if (montoAhorroFijo == null) montoAhorroFijo = BigDecimal.ZERO;
        if (diaPagoNomina == null) diaPagoNomina = "JUEVES";
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
