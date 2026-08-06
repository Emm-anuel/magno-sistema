package com.magno.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "usuarios")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"createdBy"})
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String nombreCompleto;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Column(nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 20)
    private String telefono;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "rol_id", nullable = false)
    private Rol rol;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "sucursal_id", nullable = false)
    private Sucursal sucursal;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "usuario_sucursal_adicional",
            joinColumns = @JoinColumn(name = "usuario_id"),
            inverseJoinColumns = @JoinColumn(name = "sucursal_id"))
    @Builder.Default
    private Set<Sucursal> sucursalesAdicionales = new HashSet<>();

    // ── Domicilio ──────────────────────────────────────────────────
    @Column(nullable = false, length = 150)
    private String calle;

    @Column(nullable = false, length = 20)
    private String noExterior;

    @Column(length = 20)
    private String noInterior;

    @Column(nullable = false, length = 100)
    private String colonia;

    @Column(nullable = false, length = 100)
    private String municipio;

    @Column(nullable = false, length = 100)
    private String estado;

    @Column(nullable = false, length = 10)
    private String codigoPostal;

    // ── Identificación ────────────────────────────────────────────
    @Column(nullable = false, length = 50)
    private String ineNumero;

    @Column(length = 500)
    private String ineImagenUrl;

    @Column(length = 500)
    private String ineImagenReversoUrl;

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

    @Column(nullable = false)
    private Boolean activo;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(nullable = false)
    private OffsetDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Usuario createdBy;

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
