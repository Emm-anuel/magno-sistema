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
@Table(name = "multas")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"pago", "cliente", "credito", "cobradaEnPago", "condonadaEnRenovacion", "condonadaPor"})
public class Multa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Pago que originó la multa (nullable — multa puede crearse sin pago aún registrado) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pago_id")
    private Pago pago;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "credito_id", nullable = false)
    private Credito credito;

    /** NO_PAGO: por día no pagado | INCOMPLETO: por cada 2 pagos incompletos */
    @Column(name = "tipo", nullable = false, length = 20)
    private String tipo;  // NO_PAGO | INCOMPLETO

    @Column(name = "monto", nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    @Column(name = "fecha", nullable = false)
    private LocalDate fecha;

    @Column(name = "cobrada", nullable = false)
    private Boolean cobrada;

    /** Pago en el que se cobró esta multa */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cobrada_en_pago_id")
    private Pago cobradaEnPago;

    // Condonación — una multa no puede ser cobrada Y condonada al mismo tiempo (validado en servicio)
    @Column(name = "condonada", nullable = false)
    private Boolean condonada;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "condonada_en_renovacion_id")
    private Renovacion condonadaEnRenovacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "condonada_por_id")
    private Usuario condonadaPor;

    @Column(name = "fecha_condonacion")
    private OffsetDateTime fechaCondonacion;

    @Column(name = "motivo_condonacion", columnDefinition = "TEXT")
    private String motivoCondonacion;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (cobrada == null) cobrada = false;
        if (condonada == null) condonada = false;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
