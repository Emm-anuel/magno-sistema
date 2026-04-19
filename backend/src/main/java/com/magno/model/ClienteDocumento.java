package com.magno.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "cliente_documentos")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"cliente", "createdBy"})
public class ClienteDocumento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @Column(nullable = false, length = 30)
    private String tipo; // INE_FRENTE | INE_REVERSO | COMPROBANTE_DOMICILIO | OTRO

    @Column(nullable = false, length = 500)
    private String url;

    @Column(length = 150)
    private String nombre;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Usuario createdBy;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @PrePersist
    void prePersist() {
        createdAt = OffsetDateTime.now();
    }
}
