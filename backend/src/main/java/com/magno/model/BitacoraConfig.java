package com.magno.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "bitacora_config")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BitacoraConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id")
    private Long usuarioId;

    /** NULL = cambio global (p.ej. días inhábiles) */
    @Column(name = "sucursal_id")
    private Long sucursalId;

    /**
     * Sección del módulo: MULTAS | RANGOS_CREDITO | UMBRALES_RENOVACION |
     * CONFIG_GENERAL | AHORRO | NOMINA | CONCEPTOS | DIAS_INHABILES
     */
    @Column(nullable = false, length = 50)
    private String seccion;

    /** Campo específico que cambió, p.ej. "hora_limite_operacion" */
    @Column(nullable = false, length = 100)
    private String campo;

    @Column(name = "valor_anterior", columnDefinition = "TEXT")
    private String valorAnterior;

    @Column(name = "valor_nuevo", columnDefinition = "TEXT")
    private String valorNuevo;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void prePersist() {
        createdAt = OffsetDateTime.now();
    }
}
