package com.magno.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "caja_dia")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"sucursal", "abiertaPor", "cerradaPor"})
public class CajaDia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sucursal_id", nullable = false)
    private Sucursal sucursal;

    @Column(nullable = false)
    private LocalDate fecha;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private EstadoCaja estado;

    @Column(name = "monto_apertura", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoApertura;

    @Column(name = "concepto_apertura", length = 255)
    private String conceptoApertura;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "abierta_por", nullable = false)
    private Usuario abiertaPor;

    @Column(name = "fecha_hora_apertura", nullable = false)
    private OffsetDateTime fechaHoraApertura;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cerrada_por")
    private Usuario cerradaPor;

    @Column(name = "fecha_hora_cierre")
    private OffsetDateTime fechaHoraCierre;

    @Column(name = "ingreso_carteras", precision = 12, scale = 2)
    private BigDecimal ingresoCarteras;

    @Column(precision = 12, scale = 2)
    private BigDecimal desembolsos;

    @Column(name = "subtotal_caja", precision = 12, scale = 2)
    private BigDecimal subtotalCaja;

    @Column(name = "monto_libres", precision = 12, scale = 2)
    private BigDecimal montoLibres;

    @Column(name = "ahorro_fijo", precision = 12, scale = 2)
    private BigDecimal ahorroFijo;

    @Column(name = "total_gastos", precision = 12, scale = 2)
    private BigDecimal totalGastos;

    @Column(name = "total_real_libres", precision = 12, scale = 2)
    private BigDecimal totalRealLibres;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (estado == null) estado = EstadoCaja.ABIERTA;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
