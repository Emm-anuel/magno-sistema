package com.magno.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "sucursales")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Sucursal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nombre;

    @Column(length = 255)
    private String direccion;

    @Column(length = 20)
    private String telefono;

    /** responsable_id como Long simple para evitar FK circular con Usuario */
    @Column(name = "responsable_id")
    private Long responsableId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal multaBase;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal ahorroDiario;

    @Column(nullable = false)
    private Boolean activa;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (activa == null) activa = true;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
