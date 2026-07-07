package com.magno.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "abono_coberturas")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"abono", "calendarioPago"})
public class AbonoCoberturaDetalle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "abono_id", nullable = false)
    private AbonoCorriente abono;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "calendario_pago_id", nullable = false)
    private CalendarioPago calendarioPago;

    @Column(name = "numero_pago", nullable = false)
    private Integer numeroPago;

    @Column(name = "monto_cuota", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoCuota;

    @Column(name = "monto_multa", nullable = false, precision = 12, scale = 2)
    private BigDecimal montoMulta;

    @Column(name = "total_aplicado", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAplicado;

    @Column(name = "es_parcial", nullable = false)
    private Boolean esParcial;
}
