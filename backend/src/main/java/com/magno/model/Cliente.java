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
@Table(name = "clientes")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"asesor", "sucursal", "createdBy"})
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Datos personales ──────────────────────────────────────────
    @Column(nullable = false, length = 100)
    private String nombre;

    @Column(nullable = false, length = 100)
    private String apellidoPaterno;

    @Column(length = 100)
    private String apellidoMaterno;

    @Column(nullable = false)
    private LocalDate fechaNacimiento;

    @Column(length = 20)
    private String genero;

    @Column(nullable = false, length = 20)
    private String estadoCivil; // SOLTERO | CASADO | UNION_LIBRE

    @Column(length = 150)
    private String nombreConyuge;

    @Column(length = 20)
    private String telefonoFijo;

    @Column(nullable = false, length = 20)
    private String celular;

    // ── Identificación ────────────────────────────────────────────
    @Column(length = 50)
    private String ineTipo;

    @Column(nullable = false, length = 50)
    private String ineNumero;

    @Column(nullable = false, length = 18)
    private String curp;

    @Column(length = 13)
    private String rfc;

    // ── Domicilio ─────────────────────────────────────────────────
    @Column(name = "dom_calle", nullable = false, length = 150)
    private String domCalle;

    @Column(name = "dom_no_exterior", nullable = false, length = 20)
    private String domNoExterior;

    @Column(name = "dom_no_interior", length = 20)
    private String domNoInterior;

    @Column(name = "dom_colonia", nullable = false, length = 100)
    private String domColonia;

    @Column(name = "dom_municipio", nullable = false, length = 100)
    private String domMunicipio;

    @Column(name = "dom_estado", nullable = false, length = 100)
    private String domEstado;

    @Column(name = "dom_codigo_postal", nullable = false, length = 10)
    private String domCodigoPostal;

    @Column(name = "dom_tipo_vivienda", length = 50)
    private String domTipoVivienda;

    @Column(name = "dom_monto_renta", precision = 12, scale = 2)
    private BigDecimal domMontoRenta;

    // ── Negocio ───────────────────────────────────────────────────
    @Column(name = "negocio_nombre", nullable = false, length = 150)
    private String negocioNombre;

    @Column(name = "negocio_giro", nullable = false, length = 100)
    private String negocioGiro;

    @Column(name = "negocio_antiguedad", nullable = false, length = 50)
    private String negocioAntiguedad;

    @Column(name = "negocio_direccion", length = 255)
    private String negocioDireccion;

    // Dirección del negocio en campos separados (V2)
    @Column(name = "negocio_calle", length = 255)
    private String negocioCalle;

    @Column(name = "negocio_no_exterior", length = 20)
    private String negocioNoExterior;

    @Column(name = "negocio_no_interior", length = 20)
    private String negocioNoInterior;

    @Column(name = "negocio_colonia", length = 255)
    private String negocioColonia;

    @Column(name = "negocio_municipio", length = 255)
    private String negocioMunicipio;

    @Column(name = "negocio_estado", length = 100)
    private String negocioEstado;

    @Column(name = "negocio_cp", length = 10)
    private String negocioCp;

    @Column(name = "negocio_tipo_local", length = 50)
    private String negocioTipoLocal;

    @Column(name = "negocio_monto_renta", precision = 12, scale = 2)
    private BigDecimal negocioMontoRenta;

    @Column(name = "negocio_horarios", length = 150)
    private String negocioHorarios;

    @Column(name = "negocio_lat", precision = 10, scale = 7)
    private BigDecimal negocioLat;

    @Column(name = "negocio_lng", precision = 10, scale = 7)
    private BigDecimal negocioLng;

    // ── Finanzas ──────────────────────────────────────────────────
    @Column(name = "ingresos_semanales", precision = 12, scale = 2)
    private BigDecimal ingresosSemanales;

    @Column(name = "gastos_semanales", precision = 12, scale = 2)
    private BigDecimal gastosSemanales;

    @Column(name = "gastos_renta", precision = 12, scale = 2)
    private BigDecimal gastosRenta;

    @Column(name = "gastos_otros", precision = 12, scale = 2)
    private BigDecimal gastosOtros;

    // ── Referencias personales ────────────────────────────────────
    @Column(name = "ref1_nombre", nullable = false, length = 150)
    private String ref1Nombre;

    @Column(name = "ref1_telefono", nullable = false, length = 20)
    private String ref1Telefono;

    @Column(name = "ref1_parentesco", nullable = false, length = 50)
    private String ref1Parentesco;

    @Column(name = "ref2_nombre", nullable = false, length = 150)
    private String ref2Nombre;

    @Column(name = "ref2_telefono", nullable = false, length = 20)
    private String ref2Telefono;

    @Column(name = "ref2_parentesco", nullable = false, length = 50)
    private String ref2Parentesco;

    // ── Aval ──────────────────────────────────────────────────────
    @Column(name = "aval_nombre", length = 150)
    private String avalNombre;

    @Column(name = "aval_telefono", length = 20)
    private String avalTelefono;

    @Column(name = "aval_direccion", length = 255)
    private String avalDireccion;

    @Column(name = "aval_identificacion", length = 50)
    private String avalIdentificacion;

    // ── Relaciones ────────────────────────────────────────────────
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asesor_id")
    private Usuario asesor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sucursal_id", nullable = false)
    private Sucursal sucursal;

    @Column(nullable = false)
    private Boolean activo;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(nullable = false)
    private OffsetDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Usuario createdBy;

    // ── Computed helper ───────────────────────────────────────────
    @Transient
    public String getNombreCompleto() {
        StringBuilder sb = new StringBuilder(nombre).append(" ").append(apellidoPaterno);
        if (apellidoMaterno != null && !apellidoMaterno.isBlank()) {
            sb.append(" ").append(apellidoMaterno);
        }
        return sb.toString();
    }

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (activo == null) activo = true;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
