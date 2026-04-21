package com.magno.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "renovaciones")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = { "creditoAnterior", "creditoNuevo", "cliente", "asesor", "createdBy" })
public class Renovacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "credito_anterior_id", nullable = false)
    private Credito creditoAnterior;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "credito_nuevo_id")
    private Credito creditoNuevo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asesor_id", nullable = false)
    private Usuario asesor;

    // ── Estado del flujo de aprobación ──────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false, length = 20)
    private EstadoRenovacion estado;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "aprobado_por")
    private Usuario aprobadoPor;

    @Column(name = "fecha_aprobacion")
    private OffsetDateTime fechaAprobacion;

    @Column(name = "motivo_rechazo", columnDefinition = "TEXT")
    private String motivoRechazo;

    @Column(name = "monto_aprobado", precision = 12, scale = 2)
    private BigDecimal montoAprobado;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "confirmado_por")
    private Usuario confirmadoPor;

    @Column(name = "fecha_confirmacion")
    private OffsetDateTime fechaConfirmacion;

    // ── Datos del nuevo crédito solicitado ───────────────────────
    @Column(name = "monto_nuevo", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoNuevo;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_pago", nullable = false, length = 10)
    private TipoPago tipoPago;

    @Column(name = "fecha", nullable = false)
    private LocalDate fecha;

    @Column(name = "pagos_restantes", nullable = false)
    private Integer pagosRestantes;

    @Column(name = "monto_pagos_restantes", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoPagosRestantes;

    @Column(name = "multas_pendientes", nullable = false, precision = 12, scale = 2)
    private BigDecimal multasPendientes;

    @Column(name = "pago_adelantado", nullable = false, precision = 12, scale = 2)
    private BigDecimal pagoAdelantado;

    @Column(name = "monto_desembolso", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoDesembolso;

    @Column(name = "garantia_descripcion", columnDefinition = "TEXT")
    private String garantiaDescripcion;

    @Column(name = "video_entrega_url", length = 500)
    private String videoEntregaUrl;

    @Column(name = "evidencia_urls", columnDefinition = "text[]")
    private String[] evidenciaUrls;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Usuario createdBy;

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (estado == null)
            estado = EstadoRenovacion.SOLICITADO;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
