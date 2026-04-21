package com.magno.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "creditos")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = { "cliente", "asesor", "sucursal", "aprobadoPor", "createdBy" })
public class Credito {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Relaciones ──────────────────────────────────────────────
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asesor_id", nullable = false)
    private Usuario asesor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sucursal_id", nullable = false)
    private Sucursal sucursal;

    // ── Producto financiero ──────────────────────────────────────
    @Column(name = "monto_solicitado", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoSolicitado;

    @Column(name = "monto_capital", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoCapital;

    @Column(name = "tasa_interes", nullable = false, precision = 5, scale = 4)
    private BigDecimal tasaInteres; // 0.30 = 30%

    @Column(name = "cargo_financiero", nullable = false, precision = 12, scale = 2)
    private BigDecimal cargoFinanciero;

    @Column(name = "total_a_pagar", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAPagar;

    @Column(name = "pago_periodico", nullable = false, precision = 12, scale = 2)
    private BigDecimal pagoPeriodico; // pago diario o semanal redondeado

    @Column(name = "plazo_dias", nullable = false)
    private Integer plazoDias; // 25 o 30

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_pago", nullable = false, length = 10)
    private TipoPago tipoPago;

    // ── Fechas — nullable hasta que el crédito sea ACTIVO ───────
    @Column(name = "fecha_inicio")
    private LocalDate fechaInicio;

    @Column(name = "fecha_vencimiento")
    private LocalDate fechaVencimiento;

    // ── Pago adelantado ─────────────────────────────────────────
    @Column(name = "pago_adelantado", nullable = false, precision = 12, scale = 2)
    private BigDecimal pagoAdelantado;

    // ── Garantía y evidencia ────────────────────────────────────
    @Column(name = "garantia_descripcion", columnDefinition = "TEXT")
    private String garantiaDescripcion;

    /**
     * URLs de evidencia del negocio subidas a S3.
     * Mapeadas a columna TEXT[] de PostgreSQL.
     * Hibernate 6 + PostgreSQLDialect maneja el binding nativo.
     */
    @Column(name = "evidencia_urls", columnDefinition = "text[]")
    private String[] evidenciaUrls;

    // ── Lugar ────────────────────────────────────────────────────
    @Column(name = "lugar", length = 100)
    private String lugar;

    // ── Tipo (NUEVO | RENOVACION) ─────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", nullable = false, length = 20)
    private TipoCredito tipo;

    // ── Estado ───────────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false, length = 20)
    private EstadoCredito estado;

    // ── Campos de aprobación (V4) ────────────────────────────────
    @Column(name = "monto_aprobado", precision = 12, scale = 2)
    private BigDecimal montoAprobado;

    @Column(name = "observaciones", columnDefinition = "TEXT")
    private String observaciones;

    @Column(name = "fecha_aprobacion")
    private OffsetDateTime fechaAprobacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "aprobado_por")
    private Usuario aprobadoPor;

    @Column(name = "fecha_desembolso")
    private OffsetDateTime fechaDesembolso;

    @Column(name = "video_entrega_url", length = 500)
    private String videoEntregaUrl;

    // ── Auditoría ────────────────────────────────────────────────
    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Usuario createdBy;

    // ── Lifecycle ────────────────────────────────────────────────
    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (tipo == null)
            tipo = TipoCredito.NUEVO;
        if (estado == null)
            estado = EstadoCredito.SOLICITADO;
        if (pagoAdelantado == null)
            pagoAdelantado = BigDecimal.ZERO;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
