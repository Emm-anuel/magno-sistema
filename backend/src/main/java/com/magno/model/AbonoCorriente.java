package com.magno.model;

import com.magno.util.DateTimeUtils;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "abonos_corriente")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"credito", "registradoPor"})
public class AbonoCorriente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "credito_id", nullable = false)
    private Credito credito;

    @Column(name = "fecha", nullable = false)
    private LocalDate fecha;

    @Column(name = "monto_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoTotal;

    @Column(name = "monto_distribuido", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoDistribuido;

    @Column(name = "monto_sobrante", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoSobrante;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registrado_por_id", nullable = false)
    private Usuario registradoPor;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void prePersist() {
        createdAt = DateTimeUtils.ahoraEnMagno();
    }
}
