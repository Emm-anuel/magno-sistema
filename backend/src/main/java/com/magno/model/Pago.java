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
@Table(name = "pagos")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = { "credito", "cliente", "asesor", "registradoPor", "modificadoPor" })
public class Pago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "credito_id", nullable = false)
    private Credito credito;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asesor_id", nullable = false)
    private Usuario asesor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "calendario_pago_id")
    private CalendarioPago calendarioPago;

    @Column(name = "numero_pago", nullable = false)
    private Integer numeroPago;

    @Column(name = "fecha_pago", nullable = false)
    private LocalDate fechaPago;

    @Column(name = "monto_recibido", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoRecibido;

    @Column(name = "monto_esperado", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoEsperado;

    @Column(name = "es_completo", nullable = false)
    private Boolean esCompleto;

    @Column(name = "razon_no_pago", columnDefinition = "TEXT")
    private String razonNoPago;

    @Column(name = "multa_aplicada", nullable = false, precision = 12, scale = 2)
    private BigDecimal multaAplicada;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registrado_por", nullable = false)
    private Usuario registradoPor;

    // Campos de modificación — solo ADMIN y SUPERVISOR pueden modificar
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "modificado_por")
    private Usuario modificadoPor;

    @Column(name = "fecha_modificacion")
    private OffsetDateTime fechaModificacion;

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
        if (esCompleto == null)
            esCompleto = true;
        if (multaAplicada == null)
            multaAplicada = BigDecimal.ZERO;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
