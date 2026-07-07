# Abono Ponerse al Corriente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir registrar un abono grande que se distribuye automáticamente sobre días atrasados (oldest-first, cuota+multa como unidad), dejando el historial de NO_PAGOs intacto y reflejando la cobertura en el calendario del crédito.

**Architecture:** Nueva entidad `AbonoCorriente` + tabla de coberturas `AbonoCoberturaDetalle` desacopladas de `Pago`. Dos nuevos estados en `EstadoCalendarioPago` (RECUPERADO, RECUPERADO_PARCIAL). Botón "Pagar adeudo" en la ruta del día + `ModalPagarAdeudo` con preview en tiempo real.

**Tech Stack:** Spring Boot 3 / Java 17 / JPA / Liquibase (backend) · React 18 / TypeScript / TanStack Query (frontend)

**Spec:** `docs/superpowers/specs/2026-07-06-abono-ponerse-corriente-design.md`

---

## File Map

### Backend — New
- `backend/src/main/resources/db/changelog/V29__abono_corriente.sql`
- `backend/src/main/java/com/magno/model/AbonoCorriente.java`
- `backend/src/main/java/com/magno/model/AbonoCoberturaDetalle.java`
- `backend/src/main/java/com/magno/dto/cobros/AbonoCorrienteRequest.java`
- `backend/src/main/java/com/magno/dto/cobros/AbonoCorrienteDTO.java`
- `backend/src/main/java/com/magno/repository/AbonoCorrienteRepository.java`
- `backend/src/main/java/com/magno/repository/AbonoCoberturaDetalleRepository.java`
- `backend/src/main/java/com/magno/service/AbonoCorrienteService.java`
- `backend/src/test/java/com/magno/service/AbonoCorrienteServiceTest.java`

### Backend — Modified
- `backend/src/main/java/com/magno/model/EstadoCalendarioPago.java` — +RECUPERADO, +RECUPERADO_PARCIAL
- `backend/src/main/java/com/magno/model/Multa.java` — +cobradaEnAbono FK
- `backend/src/main/java/com/magno/dto/cobros/MultaDTO.java` — +cobradaEnAbonoId
- `backend/src/main/java/com/magno/repository/CalendarioPagoRepository.java` — +findSlotsCubrir
- `backend/src/main/java/com/magno/repository/MultaRepository.java` — +findPendientesByCreditoIdAndFecha
- `backend/src/main/java/com/magno/controller/CobrosController.java` — +2 endpoints
- `backend/src/main/resources/db/changelog/db.changelog-master.xml` — register V29

### Frontend — New
- `frontend/src/components/cobros/ModalPagarAdeudo.tsx`

### Frontend — Modified
- `frontend/src/types/index.ts` — +AbonoCorrienteDTO, +AbonoCoberturaDTO, +EstadoPago values
- `frontend/src/services/cobrosService.ts` — +registrarAbonoCorrente, +getAbonosPorCredito
- `frontend/src/pages/cobros/TabRutaDia.tsx` — +"Pagar adeudo" button
- `frontend/src/pages/creditos/CreditoDetallePage.tsx` — +RECUPERADO badges, +"Ver abono" modal, +"Abonos extraordinarios" section

---

## Task 1: DB Migration + EstadoCalendarioPago enum

**Files:**
- Create: `backend/src/main/resources/db/changelog/V29__abono_corriente.sql`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`
- Modify: `backend/src/main/java/com/magno/model/EstadoCalendarioPago.java`

- [ ] **Step 1: Create migration SQL**

Create `backend/src/main/resources/db/changelog/V29__abono_corriente.sql`:

```sql
-- Tabla principal del abono extraordinario
CREATE TABLE abonos_corriente (
    id                BIGSERIAL PRIMARY KEY,
    credito_id        BIGINT NOT NULL REFERENCES creditos(id),
    fecha             DATE NOT NULL,
    monto_total       DECIMAL(12,2) NOT NULL,
    monto_distribuido DECIMAL(12,2) NOT NULL,
    monto_sobrante    DECIMAL(12,2) NOT NULL,
    registrado_por_id BIGINT NOT NULL REFERENCES usuarios(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Detalle de cobertura por día
CREATE TABLE abono_coberturas (
    id                  BIGSERIAL PRIMARY KEY,
    abono_id            BIGINT NOT NULL REFERENCES abonos_corriente(id),
    calendario_pago_id  BIGINT NOT NULL REFERENCES calendario_pagos(id),
    numero_pago         INTEGER NOT NULL,
    monto_cuota         DECIMAL(12,2) NOT NULL,
    monto_multa         DECIMAL(12,2) NOT NULL,
    total_aplicado      DECIMAL(12,2) NOT NULL,
    es_parcial          BOOLEAN NOT NULL DEFAULT FALSE
);

-- FK en multas para registrar qué abono las cobró
ALTER TABLE multas ADD COLUMN cobrada_en_abono_id BIGINT REFERENCES abonos_corriente(id);

-- Los nuevos valores del enum se agregan en Java; PostgreSQL con varchar no necesita ALTER TYPE
-- (El campo estado en calendario_pagos es VARCHAR(20), no un tipo enum de Postgres)
```

- [ ] **Step 2: Register V29 in db.changelog-master.xml**

In `backend/src/main/resources/db/changelog/db.changelog-master.xml`, add before the closing `</databaseChangeLog>` tag:

```xml
    <changeSet id="V29-abono-corriente" author="magno">
        <sqlFile
            path="db/changelog/V29__abono_corriente.sql"
            relativeToChangelogFile="false"
            splitStatements="true"
            stripComments="false"/>
    </changeSet>
```

- [ ] **Step 3: Add new enum values to EstadoCalendarioPago**

Replace content of `backend/src/main/java/com/magno/model/EstadoCalendarioPago.java`:

```java
package com.magno.model;

public enum EstadoCalendarioPago {
    PENDIENTE,
    PAGADO,
    NO_PAGADO,
    PARCIAL,
    ADELANTADO,
    RECUPERADO,
    RECUPERADO_PARCIAL
}
```

- [ ] **Step 4: Verify migration compiles and runs**

```bash
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=dev" 2>&1 | grep -E "(ERROR|Migrating|Successfully)" | head -20
```

Expected: no Liquibase errors, tables `abonos_corriente` and `abono_coberturas` created.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/changelog/V29__abono_corriente.sql \
        backend/src/main/resources/db/changelog/db.changelog-master.xml \
        backend/src/main/java/com/magno/model/EstadoCalendarioPago.java
git commit -m "feat: migration V29 + EstadoCalendarioPago RECUPERADO/RECUPERADO_PARCIAL"
```

---

## Task 2: Entity models

**Files:**
- Create: `backend/src/main/java/com/magno/model/AbonoCorriente.java`
- Create: `backend/src/main/java/com/magno/model/AbonoCoberturaDetalle.java`
- Modify: `backend/src/main/java/com/magno/model/Multa.java`
- Modify: `backend/src/main/java/com/magno/dto/cobros/MultaDTO.java`

- [ ] **Step 1: Create AbonoCorriente entity**

Create `backend/src/main/java/com/magno/model/AbonoCorriente.java`:

```java
package com.magno.model;

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
        createdAt = OffsetDateTime.now();
    }
}
```

- [ ] **Step 2: Create AbonoCoberturaDetalle entity**

Create `backend/src/main/java/com/magno/model/AbonoCoberturaDetalle.java`:

```java
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
```

- [ ] **Step 3: Add cobradaEnAbono FK to Multa.java**

In `backend/src/main/java/com/magno/model/Multa.java`, after the `cobradaEnPago` field (line 56), add:

```java
    /** Abono extraordinario en el que se cobró esta multa (alternativo a cobradaEnPago) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cobrada_en_abono_id")
    private AbonoCorriente cobradaEnAbono;
```

Also update the `@ToString` exclude list to include `cobradaEnAbono`:
```java
@ToString(exclude = {"pago", "cliente", "credito", "cobradaEnPago", "cobradaEnAbono", "condonadaEnRenovacion", "condonadaPor"})
```

- [ ] **Step 4: Update MultaDTO to expose cobradaEnAbonoId**

In `backend/src/main/java/com/magno/dto/cobros/MultaDTO.java`, add `cobradaEnAbonoId` to the record and the `from()` factory.

Replace the full file content:

```java
package com.magno.dto.cobros;

import com.magno.model.Multa;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record MultaDTO(
        Long id,
        Long creditoId,
        Long clienteId,
        Long pagoId,
        String tipo,
        BigDecimal monto,
        LocalDate fecha,
        Boolean cobrada,
        Long cobradaEnPagoId,
        Long cobradaEnAbonoId,
        Boolean condonada,
        Long condonadaEnRenovacionId,
        String condonadaPorNombre,
        OffsetDateTime fechaCondonacion,
        String motivoCondonacion
) {
    public static MultaDTO from(Multa m) {
        return new MultaDTO(
                m.getId(),
                m.getCredito().getId(),
                m.getCliente().getId(),
                m.getPago() != null ? m.getPago().getId() : null,
                m.getTipo(),
                m.getMonto(),
                m.getFecha(),
                m.getCobrada(),
                m.getCobradaEnPago() != null ? m.getCobradaEnPago().getId() : null,
                m.getCobradaEnAbono() != null ? m.getCobradaEnAbono().getId() : null,
                m.getCondonada(),
                m.getCondonadaEnRenovacion() != null ? m.getCondonadaEnRenovacion().getId() : null,
                m.getCondonadaPor() != null ? m.getCondonadaPor().getNombreCompleto() : null,
                m.getFechaCondonacion(),
                m.getMotivoCondonacion()
        );
    }
}
```

- [ ] **Step 5: Verify compilation**

```bash
cd backend && ./mvnw compile -q 2>&1 | grep -E "ERROR|error" | head -20
```

Expected: no compilation errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/magno/model/AbonoCorriente.java \
        backend/src/main/java/com/magno/model/AbonoCoberturaDetalle.java \
        backend/src/main/java/com/magno/model/Multa.java \
        backend/src/main/java/com/magno/dto/cobros/MultaDTO.java
git commit -m "feat: entities AbonoCorriente, AbonoCoberturaDetalle + Multa.cobradaEnAbono"
```

---

## Task 3: Repositories + custom queries

**Files:**
- Create: `backend/src/main/java/com/magno/repository/AbonoCorrienteRepository.java`
- Create: `backend/src/main/java/com/magno/repository/AbonoCoberturaDetalleRepository.java`
- Modify: `backend/src/main/java/com/magno/repository/CalendarioPagoRepository.java`
- Modify: `backend/src/main/java/com/magno/repository/MultaRepository.java`

- [ ] **Step 1: Create AbonoCorrienteRepository**

Create `backend/src/main/java/com/magno/repository/AbonoCorrienteRepository.java`:

```java
package com.magno.repository;

import com.magno.model.AbonoCorriente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AbonoCorrienteRepository extends JpaRepository<AbonoCorriente, Long> {

    List<AbonoCorriente> findByCreditoIdOrderByFechaDesc(Long creditoId);
}
```

- [ ] **Step 2: Create AbonoCoberturaDetalleRepository**

Create `backend/src/main/java/com/magno/repository/AbonoCoberturaDetalleRepository.java`:

```java
package com.magno.repository;

import com.magno.model.AbonoCoberturaDetalle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface AbonoCoberturaDetalleRepository extends JpaRepository<AbonoCoberturaDetalle, Long> {

    List<AbonoCoberturaDetalle> findByAbono_CreditoIdOrderByNumeroPagoAsc(Long creditoId);

    List<AbonoCoberturaDetalle> findByCalendarioPagoId(Long calendarioPagoId);

    @Query("SELECT COALESCE(SUM(d.totalAplicado), 0) FROM AbonoCoberturaDetalle d WHERE d.calendarioPago.id = :cpId")
    BigDecimal sumTotalAplicadoByCalendarioPagoId(@Param("cpId") Long cpId);

    @Query("SELECT COALESCE(SUM(d.montoMulta), 0) FROM AbonoCoberturaDetalle d WHERE d.calendarioPago.id = :cpId")
    BigDecimal sumMontoMultaByCalendarioPagoId(@Param("cpId") Long cpId);

    @Query("SELECT COALESCE(SUM(d.montoCuota), 0) FROM AbonoCoberturaDetalle d WHERE d.calendarioPago.id = :cpId")
    BigDecimal sumMontoCuotaByCalendarioPagoId(@Param("cpId") Long cpId);
}
```

- [ ] **Step 3: Add findSlotsCubrir to CalendarioPagoRepository**

In `backend/src/main/java/com/magno/repository/CalendarioPagoRepository.java`, add this method before the closing `}`:

```java
    @Query("SELECT cp FROM CalendarioPago cp WHERE cp.credito.id = :creditoId " +
           "AND (cp.estado = com.magno.model.EstadoCalendarioPago.NO_PAGADO " +
           "OR cp.estado = com.magno.model.EstadoCalendarioPago.RECUPERADO_PARCIAL " +
           "OR (cp.estado = com.magno.model.EstadoCalendarioPago.PENDIENTE AND cp.fechaProgramada <= :hoy)) " +
           "ORDER BY cp.numeroPago ASC")
    List<CalendarioPago> findSlotsCubrir(
            @Param("creditoId") Long creditoId,
            @Param("hoy") LocalDate hoy);
```

- [ ] **Step 4: Add findPendientesByCreditoIdAndFecha to MultaRepository**

In `backend/src/main/java/com/magno/repository/MultaRepository.java`, add before the closing `}`:

```java
    @Query("SELECT m FROM Multa m WHERE m.credito.id = :creditoId " +
           "AND m.cobrada = false AND m.condonada = false AND m.deletedAt IS NULL " +
           "AND m.fecha = :fecha ORDER BY m.id ASC")
    List<Multa> findPendientesByCreditoIdAndFecha(
            @Param("creditoId") Long creditoId,
            @Param("fecha") LocalDate fecha);
```

- [ ] **Step 5: Verify compilation**

```bash
cd backend && ./mvnw compile -q 2>&1 | grep -E "ERROR|error" | head -20
```

Expected: no compilation errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/magno/repository/AbonoCorrienteRepository.java \
        backend/src/main/java/com/magno/repository/AbonoCoberturaDetalleRepository.java \
        backend/src/main/java/com/magno/repository/CalendarioPagoRepository.java \
        backend/src/main/java/com/magno/repository/MultaRepository.java
git commit -m "feat: repositories AbonoCorriente + queries findSlotsCubrir, findPendientesByFecha"
```

---

## Task 4: DTOs

**Files:**
- Create: `backend/src/main/java/com/magno/dto/cobros/AbonoCorrienteRequest.java`
- Create: `backend/src/main/java/com/magno/dto/cobros/AbonoCorrienteDTO.java`

- [ ] **Step 1: Create AbonoCorrienteRequest**

Create `backend/src/main/java/com/magno/dto/cobros/AbonoCorrienteRequest.java`:

```java
package com.magno.dto.cobros;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AbonoCorrienteRequest(

        @NotNull(message = "credito_id es obligatorio")
        @JsonAlias("credito_id")
        Long creditoId,

        @NotNull(message = "monto_recibido es obligatorio")
        @DecimalMin(value = "0.01", message = "monto_recibido debe ser mayor a 0")
        @JsonAlias("monto_recibido")
        BigDecimal montoRecibido,

        @JsonAlias("fecha_pago")
        LocalDate fechaPago
) {}
```

- [ ] **Step 2: Create AbonoCorrienteDTO**

Create `backend/src/main/java/com/magno/dto/cobros/AbonoCorrienteDTO.java`:

```java
package com.magno.dto.cobros;

import com.magno.model.AbonoCoberturaDetalle;
import com.magno.model.AbonoCorriente;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record AbonoCorrienteDTO(
        Long abonoId,
        Long creditoId,
        LocalDate fecha,
        BigDecimal montoTotal,
        BigDecimal montoDistribuido,
        BigDecimal montoSobrante,
        int diasCubiertos,
        int diasParciales,
        List<CoberturaDetalleDTO> coberturas
) {

    public record CoberturaDetalleDTO(
            Integer numeroPago,
            LocalDate fechaProgramada,
            BigDecimal montoCuota,
            BigDecimal montoMulta,
            BigDecimal totalAplicado,
            boolean esParcial
    ) {
        public static CoberturaDetalleDTO from(AbonoCoberturaDetalle d) {
            return new CoberturaDetalleDTO(
                    d.getNumeroPago(),
                    d.getCalendarioPago().getFechaProgramada(),
                    d.getMontoCuota(),
                    d.getMontoMulta(),
                    d.getTotalAplicado(),
                    Boolean.TRUE.equals(d.getEsParcial())
            );
        }
    }

    public static AbonoCorrienteDTO from(AbonoCorriente a, List<AbonoCoberturaDetalle> coberturas) {
        List<CoberturaDetalleDTO> dtos = coberturas.stream()
                .map(CoberturaDetalleDTO::from)
                .toList();
        int cubiertos = (int) dtos.stream().filter(c -> !c.esParcial()).count();
        int parciales = (int) dtos.stream().filter(CoberturaDetalleDTO::esParcial).count();
        return new AbonoCorrienteDTO(
                a.getId(),
                a.getCredito().getId(),
                a.getFecha(),
                a.getMontoTotal(),
                a.getMontoDistribuido(),
                a.getMontoSobrante(),
                cubiertos,
                parciales,
                dtos
        );
    }
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd backend && ./mvnw compile -q 2>&1 | grep -E "ERROR|error" | head -20
```

Expected: no compilation errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/dto/cobros/AbonoCorrienteRequest.java \
        backend/src/main/java/com/magno/dto/cobros/AbonoCorrienteDTO.java
git commit -m "feat: DTOs AbonoCorrienteRequest + AbonoCorrienteDTO"
```

---

## Task 5: Service tests (TDD — write failing tests first)

**Files:**
- Create: `backend/src/test/java/com/magno/service/AbonoCorrienteServiceTest.java`

- [ ] **Step 1: Create test class with failing tests**

Create `backend/src/test/java/com/magno/service/AbonoCorrienteServiceTest.java`:

```java
package com.magno.service;

import com.magno.dto.cobros.AbonoCorrienteDTO;
import com.magno.dto.cobros.AbonoCorrienteRequest;
import com.magno.model.*;
import com.magno.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class AbonoCorrienteServiceTest {

    private AbonoCorrienteRepository abonoCorrienteRepo;
    private AbonoCoberturaDetalleRepository abonoCoberturaRepo;
    private CreditoRepository creditoRepo;
    private UsuarioRepository usuarioRepo;
    private CalendarioPagoRepository calendarioPagoRepo;
    private MultaRepository multaRepo;

    private AbonoCorrienteService service;

    private Sucursal sucursal;
    private Cliente cliente;
    private Rol rolAsesor;
    private Usuario asesor;
    private Credito credito;

    @BeforeEach
    void setUp() {
        abonoCorrienteRepo = mock(AbonoCorrienteRepository.class);
        abonoCoberturaRepo = mock(AbonoCoberturaDetalleRepository.class);
        creditoRepo        = mock(CreditoRepository.class);
        usuarioRepo        = mock(UsuarioRepository.class);
        calendarioPagoRepo = mock(CalendarioPagoRepository.class);
        multaRepo          = mock(MultaRepository.class);

        service = new AbonoCorrienteService(
                abonoCorrienteRepo,
                abonoCoberturaRepo,
                creditoRepo,
                usuarioRepo,
                calendarioPagoRepo,
                multaRepo);

        // Entities de prueba
        sucursal = new Sucursal();
        sucursal.setId(1L);

        rolAsesor = new Rol();
        rolAsesor.setNombre("ASESOR_COBRADOR");

        asesor = new Usuario();
        asesor.setId(10L);
        asesor.setRol(rolAsesor);
        asesor.setSucursal(sucursal);

        cliente = new Cliente();
        cliente.setId(5L);
        cliente.setSucursal(sucursal);

        credito = new Credito();
        credito.setId(42L);
        credito.setEstado(EstadoCredito.ACTIVO);
        credito.setAsesor(asesor);
        credito.setCliente(cliente);
        credito.setSucursal(sucursal);
    }

    // ── Helper: crea un CalendarioPago con estado NO_PAGADO ──────────
    private CalendarioPago slot(long id, int numeroPago, LocalDate fecha, BigDecimal monto, EstadoCalendarioPago estado) {
        CalendarioPago cp = new CalendarioPago();
        cp.setId(id);
        cp.setNumeroPago(numeroPago);
        cp.setFechaProgramada(fecha);
        cp.setMontoEsperado(monto);
        cp.setEstado(estado);
        cp.setCredito(credito);
        return cp;
    }

    private Multa multaNoPago(long id, LocalDate fecha, BigDecimal monto) {
        Multa m = new Multa();
        m.setId(id);
        m.setTipo("NO_PAGO");
        m.setMonto(monto);
        m.setFecha(fecha);
        m.setCobrada(false);
        m.setCondonada(false);
        m.setCredito(credito);
        m.setCliente(cliente);
        return m;
    }

    // ── Test 1: distribución correcta 7 días + 1 parcial ────────────
    @Test
    void distribuyeCorrectamente_cubriendo7DiasCompletos_y1Parcial() {
        LocalDate base = LocalDate.of(2026, 6, 25);
        BigDecimal cuota = new BigDecimal("156.00");
        BigDecimal multa = new BigDecimal("50.00");

        List<CalendarioPago> slots = new java.util.ArrayList<>();
        for (int i = 0; i < 8; i++) {
            slots.add(slot(100L + i, i + 1, base.plusDays(i), cuota, EstadoCalendarioPago.NO_PAGADO));
        }

        when(usuarioRepo.findById(10L)).thenReturn(Optional.of(asesor));
        when(creditoRepo.findById(42L)).thenReturn(Optional.of(credito));
        when(calendarioPagoRepo.findSlotsCubrir(eq(42L), any())).thenReturn(slots);
        for (int i = 0; i < 8; i++) {
            when(multaRepo.findPendientesByCreditoIdAndFecha(eq(42L), eq(base.plusDays(i))))
                .thenReturn(List.of(multaNoPago(200L + i, base.plusDays(i), multa)));
        }
        when(abonoCoberturaRepo.sumTotalAplicadoByCalendarioPagoId(anyLong())).thenReturn(BigDecimal.ZERO);
        when(abonoCoberturaRepo.sumMontoMultaByCalendarioPagoId(anyLong())).thenReturn(BigDecimal.ZERO);
        when(abonoCoberturaRepo.sumMontoCuotaByCalendarioPagoId(anyLong())).thenReturn(BigDecimal.ZERO);

        AbonoCorriente savedAbono = new AbonoCorriente();
        savedAbono.setId(7L);
        savedAbono.setCredito(credito);
        savedAbono.setFecha(LocalDate.now(ZoneId.of("America/Mexico_City")));
        savedAbono.setMontoTotal(new BigDecimal("1500.00"));
        savedAbono.setMontoDistribuido(new BigDecimal("1500.00"));
        savedAbono.setMontoSobrante(BigDecimal.ZERO);
        savedAbono.setRegistradoPor(asesor);
        when(abonoCorrienteRepo.save(any())).thenReturn(savedAbono);
        when(abonoCoberturaRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(multaRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AbonoCorrienteRequest req = new AbonoCorrienteRequest(42L, new BigDecimal("1500.00"), null);
        AbonoCorrienteDTO result = service.registrarAbono(req, 10L);

        assertThat(result.diasCubiertos()).isEqualTo(7);
        assertThat(result.diasParciales()).isEqualTo(1);
        assertThat(result.montoSobrante()).isEqualByComparingTo(BigDecimal.ZERO);

        // día 8 es parcial con $58 aplicados
        AbonoCorrienteDTO.CoberturaDetalleDTO dia8 = result.coberturas().get(7);
        assertThat(dia8.esParcial()).isTrue();
        assertThat(dia8.totalAplicado()).isEqualByComparingTo(new BigDecimal("58.00"));

        // CalendarioPago del día 8 debe marcarse RECUPERADO_PARCIAL
        assertThat(slots.get(7).getEstado()).isEqualTo(EstadoCalendarioPago.RECUPERADO_PARCIAL);
        // días 1-7 deben ser RECUPERADO
        for (int i = 0; i < 7; i++) {
            assertThat(slots.get(i).getEstado()).isEqualTo(EstadoCalendarioPago.RECUPERADO);
        }
    }

    // ── Test 2: cobertura exacta ─────────────────────────────────────
    @Test
    void cubreExactamente_cuandoMontoEsExacto() {
        LocalDate base = LocalDate.of(2026, 6, 25);
        BigDecimal cuota = new BigDecimal("156.00");
        BigDecimal multa = new BigDecimal("50.00");
        // 8 días × $206 = $1648
        BigDecimal montoExacto = new BigDecimal("1648.00");

        List<CalendarioPago> slots = new java.util.ArrayList<>();
        for (int i = 0; i < 8; i++) {
            slots.add(slot(100L + i, i + 1, base.plusDays(i), cuota, EstadoCalendarioPago.NO_PAGADO));
        }

        when(usuarioRepo.findById(10L)).thenReturn(Optional.of(asesor));
        when(creditoRepo.findById(42L)).thenReturn(Optional.of(credito));
        when(calendarioPagoRepo.findSlotsCubrir(eq(42L), any())).thenReturn(slots);
        for (int i = 0; i < 8; i++) {
            when(multaRepo.findPendientesByCreditoIdAndFecha(eq(42L), eq(base.plusDays(i))))
                .thenReturn(List.of(multaNoPago(200L + i, base.plusDays(i), multa)));
        }
        when(abonoCoberturaRepo.sumTotalAplicadoByCalendarioPagoId(anyLong())).thenReturn(BigDecimal.ZERO);
        when(abonoCoberturaRepo.sumMontoMultaByCalendarioPagoId(anyLong())).thenReturn(BigDecimal.ZERO);
        when(abonoCoberturaRepo.sumMontoCuotaByCalendarioPagoId(anyLong())).thenReturn(BigDecimal.ZERO);

        AbonoCorriente savedAbono = new AbonoCorriente();
        savedAbono.setId(8L);
        savedAbono.setCredito(credito);
        savedAbono.setFecha(LocalDate.now(ZoneId.of("America/Mexico_City")));
        savedAbono.setMontoTotal(montoExacto);
        savedAbono.setMontoDistribuido(montoExacto);
        savedAbono.setMontoSobrante(BigDecimal.ZERO);
        savedAbono.setRegistradoPor(asesor);
        when(abonoCorrienteRepo.save(any())).thenReturn(savedAbono);
        when(abonoCoberturaRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(multaRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AbonoCorrienteRequest req = new AbonoCorrienteRequest(42L, montoExacto, null);
        AbonoCorrienteDTO result = service.registrarAbono(req, 10L);

        assertThat(result.diasCubiertos()).isEqualTo(8);
        assertThat(result.diasParciales()).isEqualTo(0);
        assertThat(result.montoSobrante()).isEqualByComparingTo(BigDecimal.ZERO);
        for (CalendarioPago cp : slots) {
            assertThat(cp.getEstado()).isEqualTo(EstadoCalendarioPago.RECUPERADO);
        }
    }

    // ── Test 3: segundo abono sobre slot RECUPERADO_PARCIAL ──────────
    @Test
    void segundoAbono_completa_slotRecuperadoParcial() {
        LocalDate dia8 = LocalDate.of(2026, 7, 4);
        LocalDate dia9 = LocalDate.of(2026, 7, 7);
        BigDecimal cuota = new BigDecimal("156.00");
        BigDecimal multa = new BigDecimal("50.00");

        CalendarioPago slotParcial = slot(108L, 8, dia8, cuota, EstadoCalendarioPago.RECUPERADO_PARCIAL);
        CalendarioPago slotPendiente = slot(109L, 9, dia9, cuota, EstadoCalendarioPago.NO_PAGADO);

        when(usuarioRepo.findById(10L)).thenReturn(Optional.of(asesor));
        when(creditoRepo.findById(42L)).thenReturn(Optional.of(credito));
        when(calendarioPagoRepo.findSlotsCubrir(eq(42L), any())).thenReturn(List.of(slotParcial, slotPendiente));

        // dia8: ya abonados $58 (del primer abono)
        when(abonoCoberturaRepo.sumTotalAplicadoByCalendarioPagoId(108L)).thenReturn(new BigDecimal("58.00"));
        when(abonoCoberturaRepo.sumMontoMultaByCalendarioPagoId(108L)).thenReturn(new BigDecimal("50.00")); // multa ya cobrada
        when(abonoCoberturaRepo.sumMontoCuotaByCalendarioPagoId(108L)).thenReturn(new BigDecimal("8.00"));
        // dia9: sin abonos previos
        when(abonoCoberturaRepo.sumTotalAplicadoByCalendarioPagoId(109L)).thenReturn(BigDecimal.ZERO);
        when(abonoCoberturaRepo.sumMontoMultaByCalendarioPagoId(109L)).thenReturn(BigDecimal.ZERO);
        when(abonoCoberturaRepo.sumMontoCuotaByCalendarioPagoId(109L)).thenReturn(BigDecimal.ZERO);

        // dia8: multa ya cobrada (no aparece como pendiente)
        when(multaRepo.findPendientesByCreditoIdAndFecha(eq(42L), eq(dia8))).thenReturn(List.of());
        when(multaRepo.findPendientesByCreditoIdAndFecha(eq(42L), eq(dia9)))
            .thenReturn(List.of(multaNoPago(209L, dia9, multa)));

        AbonoCorriente savedAbono = new AbonoCorriente();
        savedAbono.setId(9L);
        savedAbono.setCredito(credito);
        savedAbono.setFecha(LocalDate.now(ZoneId.of("America/Mexico_City")));
        savedAbono.setMontoTotal(new BigDecimal("354.00")); // $148 + $206
        savedAbono.setMontoDistribuido(new BigDecimal("354.00"));
        savedAbono.setMontoSobrante(BigDecimal.ZERO);
        savedAbono.setRegistradoPor(asesor);
        when(abonoCorrienteRepo.save(any())).thenReturn(savedAbono);
        when(abonoCoberturaRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(multaRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // $354 = $148 costo restante día8 + $206 día9
        AbonoCorrienteRequest req = new AbonoCorrienteRequest(42L, new BigDecimal("354.00"), null);
        AbonoCorrienteDTO result = service.registrarAbono(req, 10L);

        assertThat(result.diasCubiertos()).isEqualTo(2);
        assertThat(result.diasParciales()).isEqualTo(0);
        assertThat(slotParcial.getEstado()).isEqualTo(EstadoCalendarioPago.RECUPERADO);
        assertThat(slotPendiente.getEstado()).isEqualTo(EstadoCalendarioPago.RECUPERADO);
    }

    // ── Test 4: error si no hay días atrasados ───────────────────────
    @Test
    void lanzaError400_cuandoNoHayDiasAtrasados() {
        when(usuarioRepo.findById(10L)).thenReturn(Optional.of(asesor));
        when(creditoRepo.findById(42L)).thenReturn(Optional.of(credito));
        when(calendarioPagoRepo.findSlotsCubrir(eq(42L), any())).thenReturn(List.of());

        AbonoCorrienteRequest req = new AbonoCorrienteRequest(42L, new BigDecimal("500.00"), null);

        assertThatThrownBy(() -> service.registrarAbono(req, 10L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("No hay días atrasados");
    }

    // ── Test 5: error si crédito no está activo ──────────────────────
    @Test
    void lanzaError400_cuandoCreditoNoActivo() {
        credito.setEstado(EstadoCredito.PAGADO);
        when(usuarioRepo.findById(10L)).thenReturn(Optional.of(asesor));
        when(creditoRepo.findById(42L)).thenReturn(Optional.of(credito));

        AbonoCorrienteRequest req = new AbonoCorrienteRequest(42L, new BigDecimal("500.00"), null);

        assertThatThrownBy(() -> service.registrarAbono(req, 10L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("activo");
    }

    // ── Test 6: asesor sin acceso al crédito ─────────────────────────
    @Test
    void lanzaError403_cuandoAsesorNoTieneAcceso() {
        Usuario otroAsesor = new Usuario();
        otroAsesor.setId(99L);
        otroAsesor.setRol(rolAsesor);
        otroAsesor.setSucursal(sucursal);

        when(usuarioRepo.findById(99L)).thenReturn(Optional.of(otroAsesor));
        when(creditoRepo.findById(42L)).thenReturn(Optional.of(credito)); // asignado al asesor id=10

        AbonoCorrienteRequest req = new AbonoCorrienteRequest(42L, new BigDecimal("500.00"), null);

        assertThatThrownBy(() -> service.registrarAbono(req, 99L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("acceso");
    }
}
```

- [ ] **Step 2: Run tests and verify they FAIL (class doesn't exist yet)**

```bash
cd backend && ./mvnw test -pl . -Dtest=AbonoCorrienteServiceTest -q 2>&1 | tail -20
```

Expected: `COMPILATION ERROR` or `NoClassDefFoundError` for `AbonoCorrienteService`.

- [ ] **Step 3: Commit failing tests**

```bash
git add backend/src/test/java/com/magno/service/AbonoCorrienteServiceTest.java
git commit -m "test: AbonoCorrienteServiceTest — 6 failing tests (TDD)"
```

---

## Task 6: AbonoCorrienteService implementation

**Files:**
- Create: `backend/src/main/java/com/magno/service/AbonoCorrienteService.java`

- [ ] **Step 1: Create service**

Create `backend/src/main/java/com/magno/service/AbonoCorrienteService.java`:

```java
package com.magno.service;

import com.magno.dto.cobros.AbonoCorrienteDTO;
import com.magno.dto.cobros.AbonoCorrienteRequest;
import com.magno.model.*;
import com.magno.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class AbonoCorrienteService {

    private static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Mexico_City");

    private final AbonoCorrienteRepository abonoCorrienteRepo;
    private final AbonoCoberturaDetalleRepository abonoCoberturaRepo;
    private final CreditoRepository creditoRepo;
    private final UsuarioRepository usuarioRepo;
    private final CalendarioPagoRepository calendarioPagoRepo;
    private final MultaRepository multaRepo;

    public AbonoCorrienteService(
            AbonoCorrienteRepository abonoCorrienteRepo,
            AbonoCoberturaDetalleRepository abonoCoberturaRepo,
            CreditoRepository creditoRepo,
            UsuarioRepository usuarioRepo,
            CalendarioPagoRepository calendarioPagoRepo,
            MultaRepository multaRepo) {
        this.abonoCorrienteRepo = abonoCorrienteRepo;
        this.abonoCoberturaRepo = abonoCoberturaRepo;
        this.creditoRepo = creditoRepo;
        this.usuarioRepo = usuarioRepo;
        this.calendarioPagoRepo = calendarioPagoRepo;
        this.multaRepo = multaRepo;
    }

    @Transactional
    public AbonoCorrienteDTO registrarAbono(AbonoCorrienteRequest req, Long usuarioId) {
        // 1. Obtener usuario y validar rol
        Usuario registrador = usuarioRepo.findById(usuarioId)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + usuarioId));
        String rol = registrador.getRol().getNombre();

        // 2. Obtener y validar crédito
        Credito credito = creditoRepo.findById(req.creditoId())
                .orElseThrow(() -> new EntityNotFoundException("Crédito no encontrado: " + req.creditoId()));

        if (credito.getEstado() != EstadoCredito.ACTIVO) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El crédito no está activo");
        }

        // 3. Validar acceso por rol
        if ("ASESOR_COBRADOR".equals(rol)) {
            if (credito.getAsesor() == null || !credito.getAsesor().getId().equals(usuarioId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes acceso a este crédito");
            }
        } else if ("SUPERVISOR_CAMPO".equals(rol)) {
            if (!credito.getCliente().getSucursal().getId().equals(registrador.getSucursal().getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes acceso a este crédito");
            }
        }

        // 4. Resolver fecha de operación
        LocalDate hoy = LocalDate.now(BUSINESS_ZONE);
        LocalDate fechaOperacion = resolverFecha(req.fechaPago(), rol, hoy);

        // 5. Obtener slots a cubrir ordenados de más antiguo a más reciente
        List<CalendarioPago> slots = calendarioPagoRepo.findSlotsCubrir(credito.getId(), fechaOperacion);
        if (slots.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No hay días atrasados para cubrir en este crédito");
        }

        // 6. Distribuir
        BigDecimal saldo = req.montoRecibido();
        List<AbonoCoberturaDetalle> coberturas = new ArrayList<>();
        List<Multa> multasCubiertas = new ArrayList<>();

        for (CalendarioPago slot : slots) {
            if (saldo.compareTo(BigDecimal.ZERO) <= 0) break;

            List<Multa> multasDia = multaRepo.findPendientesByCreditoIdAndFecha(
                    credito.getId(), slot.getFechaProgramada());
            BigDecimal totalMultasDia = multasDia.stream()
                    .map(Multa::getMonto).reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal yaAbonado = abonoCoberturaRepo.sumTotalAplicadoByCalendarioPagoId(slot.getId());
            BigDecimal multaYaAbonada = abonoCoberturaRepo.sumMontoMultaByCalendarioPagoId(slot.getId());
            BigDecimal cuotaYaAbonada = abonoCoberturaRepo.sumMontoCuotaByCalendarioPagoId(slot.getId());

            BigDecimal costoRestante = slot.getMontoEsperado()
                    .add(totalMultasDia)
                    .subtract(yaAbonado);

            if (costoRestante.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal aplicar = saldo.min(costoRestante);
            saldo = saldo.subtract(aplicar);
            boolean esCompleto = aplicar.compareTo(costoRestante) >= 0;

            // Multas-first para el split
            BigDecimal multaRestante = totalMultasDia.subtract(multaYaAbonada);
            BigDecimal montoMultaAplicado = aplicar.min(multaRestante);
            BigDecimal montoCuotaAplicado = aplicar.subtract(montoMultaAplicado);

            AbonoCoberturaDetalle cobertura = AbonoCoberturaDetalle.builder()
                    .calendarioPago(slot)
                    .numeroPago(slot.getNumeroPago())
                    .montoCuota(montoCuotaAplicado)
                    .montoMulta(montoMultaAplicado)
                    .totalAplicado(aplicar)
                    .esParcial(!esCompleto)
                    .build();
            coberturas.add(cobertura);

            slot.setEstado(esCompleto ? EstadoCalendarioPago.RECUPERADO : EstadoCalendarioPago.RECUPERADO_PARCIAL);
            calendarioPagoRepo.save(slot);

            // Marcar multas cobradas solo si el día quedó completamente cubierto
            // o si el parcial alcanzó a cubrir todas las multas
            if (montoMultaAplicado.compareTo(totalMultasDia) >= 0) {
                multasCubiertas.addAll(multasDia);
            }
        }

        BigDecimal totalDistribuido = req.montoRecibido().subtract(saldo);

        // 7. Crear AbonoCorriente
        AbonoCorriente abono = AbonoCorriente.builder()
                .credito(credito)
                .fecha(fechaOperacion)
                .montoTotal(req.montoRecibido())
                .montoDistribuido(totalDistribuido)
                .montoSobrante(saldo)
                .registradoPor(registrador)
                .build();
        abono = abonoCorrienteRepo.save(abono);

        // 8. Guardar coberturas con referencia al abono
        final AbonoCorriente abonoFinal = abono;
        for (AbonoCoberturaDetalle c : coberturas) {
            c.setAbono(abonoFinal);
            abonoCoberturaRepo.save(c);
        }

        // 9. Marcar multas con referencia al abono
        for (Multa m : multasCubiertas) {
            m.setCobrada(true);
            m.setCobradaEnAbono(abonoFinal);
            multaRepo.save(m);
        }

        return AbonoCorrienteDTO.from(abono, coberturas);
    }

    public List<AbonoCorrienteDTO> getAbonosPorCredito(Long creditoId) {
        List<AbonoCorriente> abonos = abonoCorrienteRepo.findByCreditoIdOrderByFechaDesc(creditoId);
        return abonos.stream().map(a -> {
            List<AbonoCoberturaDetalle> coberturas =
                    abonoCoberturaRepo.findByAbono_CreditoIdOrderByNumeroPagoAsc(creditoId)
                            .stream()
                            .filter(c -> c.getAbono().getId().equals(a.getId()))
                            .toList();
            return AbonoCorrienteDTO.from(a, coberturas);
        }).toList();
    }

    private LocalDate resolverFecha(LocalDate fechaSolicitada, String rol, LocalDate hoy) {
        if (fechaSolicitada == null) return hoy;
        boolean esRolCampo = "ASESOR_COBRADOR".equals(rol) || "SUPERVISOR_CAMPO".equals(rol);
        if (esRolCampo && !hoy.equals(fechaSolicitada)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Solo Gerente General y Gerente de Sucursal pueden registrar en fechas históricas");
        }
        return fechaSolicitada;
    }
}
```

- [ ] **Step 2: Run tests — verify they PASS**

```bash
cd backend && ./mvnw test -Dtest=AbonoCorrienteServiceTest -q 2>&1 | tail -20
```

Expected: `BUILD SUCCESS`, 6 tests passed, 0 failures.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/magno/service/AbonoCorrienteService.java
git commit -m "feat: AbonoCorrienteService — algoritmo de distribución oldest-first"
```

---

## Task 7: Controller endpoints

**Files:**
- Modify: `backend/src/main/java/com/magno/controller/CobrosController.java`

- [ ] **Step 1: Inject AbonoCorrienteService and add 2 endpoints**

In `CobrosController.java`:

1. Add field and constructor parameter:
```java
    private final AbonoCorrienteService abonoCorrienteService;

    public CobrosController(CobrosService cobrosService, CajaGuard cajaGuard,
                             AbonoCorrienteService abonoCorrienteService) {
        this.cobrosService = cobrosService;
        this.cajaGuard = cajaGuard;
        this.abonoCorrienteService = abonoCorrienteService;
    }
```

2. Add imports at the top of the file:
```java
import com.magno.dto.cobros.AbonoCorrienteDTO;
import com.magno.dto.cobros.AbonoCorrienteRequest;
import com.magno.service.AbonoCorrienteService;
```

3. Add two new methods before the closing `}` of the class:

```java
    // ────────────────────────────────────────────────────────────────────
    // POST /api/cobros/abono-corriente
    // ────────────────────────────────────────────────────────────────────

    @PostMapping("/abono-corriente")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<AbonoCorrienteDTO> registrarAbono(
            @Valid @RequestBody AbonoCorrienteRequest req,
            Authentication auth) {

        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        cajaGuard.validarCajaAbierta(principal);
        AbonoCorrienteDTO abono = abonoCorrienteService.registrarAbono(req, principal.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(abono);
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/cobros/abono-corriente?credito_id={id}
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/abono-corriente")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<AbonoCorrienteDTO>> getAbonosPorCredito(
            @RequestParam(name = "credito_id") Long creditoId) {

        return ResponseEntity.ok(abonoCorrienteService.getAbonosPorCredito(creditoId));
    }
```

- [ ] **Step 2: Verify compilation**

```bash
cd backend && ./mvnw compile -q 2>&1 | grep -E "ERROR|error" | head -20
```

Expected: no errors.

- [ ] **Step 3: Smoke test with curl** (app must be running)

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <token>" \
  "http://localhost:8080/api/cobros/abono-corriente?credito_id=1"
```

Expected: `200` (empty array `[]` if no abonos exist).

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/controller/CobrosController.java
git commit -m "feat: endpoints POST/GET /api/cobros/abono-corriente"
```

---

## Task 8: Frontend types + service methods

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/cobrosService.ts`

- [ ] **Step 1: Add new types to types/index.ts**

In `frontend/src/types/index.ts`, replace the existing `EstadoPago` line:
```typescript
export type EstadoPago = 'PENDIENTE' | 'PAGADO' | 'NO_PAGADO' | 'PARCIAL' | 'ADELANTADO'
```
with:
```typescript
export type EstadoPago =
  | 'PENDIENTE'
  | 'PAGADO'
  | 'NO_PAGADO'
  | 'PARCIAL'
  | 'ADELANTADO'
  | 'RECUPERADO'
  | 'RECUPERADO_PARCIAL'
```

Then add these new interfaces at the end of the cobros section (after `MultaCobroDTO`):

```typescript
export interface AbonoCoberturaDTO {
  numeroPago: number
  fechaProgramada: string
  montoCuota: number
  montoMulta: number
  totalAplicado: number
  esParcial: boolean
}

export interface AbonoCorrienteDTO {
  abonoId: number
  creditoId: number
  fecha: string
  montoTotal: number
  montoDistribuido: number
  montoSobrante: number
  diasCubiertos: number
  diasParciales: number
  coberturas: AbonoCoberturaDTO[]
}

export interface AbonoCorrienteRequest {
  creditoId: number
  montoRecibido: number
  fechaPago?: string
}
```

- [ ] **Step 2: Add service methods to cobrosService.ts**

In `frontend/src/services/cobrosService.ts`, add the following imports at the top:
```typescript
import type {
  RutaDia,
  ClienteRuta,
  PagoRegistrarRequest,
  PagoModificarRequest,
  PagoCobroDTO,
  MultaCobroDTO,
  AbonoCorrienteDTO,
  AbonoCorrienteRequest,
  Page,
} from '@/types'
```

Then add two methods to the `cobrosService` object (after `getMultasPorCredito`):

```typescript
  registrarAbonoCorrente: (req: AbonoCorrienteRequest): Promise<AbonoCorrienteDTO> =>
    api
      .post<AbonoCorrienteDTO>('/cobros/abono-corriente', {
        credito_id: req.creditoId,
        monto_recibido: req.montoRecibido,
        fecha_pago: req.fechaPago,
      })
      .then((r) => r.data),

  getAbonosPorCredito: (creditoId: number): Promise<AbonoCorrienteDTO[]> =>
    api
      .get<AbonoCorrienteDTO[]>('/cobros/abono-corriente', {
        params: { credito_id: creditoId },
      })
      .then((r) => r.data ?? []),
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/cobrosService.ts
git commit -m "feat: frontend types AbonoCorrienteDTO + cobrosService methods"
```

---

## Task 9: ModalPagarAdeudo component

**Files:**
- Create: `frontend/src/components/cobros/ModalPagarAdeudo.tsx`

- [ ] **Step 1: Create modal component**

Create `frontend/src/components/cobros/ModalPagarAdeudo.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X, AlertTriangle, CheckCircle, Minus } from 'lucide-react'
import { cobrosService } from '@/services/cobrosService'
import { creditoService } from '@/services/creditoService'
import { todayLocalStr } from '@/utils/date'
import type { AbonoCoberturaDTO } from '@/types'

interface Props {
  creditoId: number
  nombreCliente: string
  onClose: () => void
  onSuccess: () => void
}

function fmtMoney(v: number) {
  return `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
  })
}

interface DistribucionRow extends AbonoCoberturaDTO {
  noAlcanza: boolean
}

function computeDistribucion(
  monto: number,
  slots: Array<{ id: number; numeroPago: number; fechaProgramada: string; montoEsperado: number; estado: string }>,
  multasPendientes: Array<{ fecha: string; monto: number; cobrada: boolean }>,
  abonosExistentes: Array<{ coberturas: AbonoCoberturaDTO[] }>,
  hoy: string,
): DistribucionRow[] {
  const eligibles = slots.filter((p) => {
    if (p.estado === 'NO_PAGADO' || p.estado === 'RECUPERADO_PARCIAL') return true
    if (p.estado === 'PENDIENTE' && p.fechaProgramada <= hoy) return true
    return false
  }).sort((a, b) => a.numeroPago - b.numeroPago)

  // ya_abonado por calendarioPagoId
  const yaAbonado: Record<number, number> = {}
  const multaYaAbonada: Record<number, number> = {}
  for (const abono of abonosExistentes) {
    for (const c of abono.coberturas) {
      const slot = slots.find((s) => s.numeroPago === c.numeroPago)
      if (slot) {
        yaAbonado[slot.id] = (yaAbonado[slot.id] ?? 0) + c.totalAplicado
        multaYaAbonada[slot.id] = (multaYaAbonada[slot.id] ?? 0) + c.montoMulta
      }
    }
  }

  let saldo = monto
  const rows: DistribucionRow[] = []

  for (const slot of eligibles) {
    const multasDia = multasPendientes.filter(
      (m) => m.fecha === slot.fechaProgramada && !m.cobrada,
    )
    const totalMultasDia = multasDia.reduce((s, m) => s + Number(m.monto), 0)
    const costoRestante =
      Number(slot.montoEsperado) +
      totalMultasDia -
      (yaAbonado[slot.id] ?? 0)

    if (costoRestante <= 0) continue

    if (saldo <= 0) {
      rows.push({
        numeroPago: slot.numeroPago,
        fechaProgramada: slot.fechaProgramada,
        montoCuota: 0,
        montoMulta: 0,
        totalAplicado: 0,
        esParcial: false,
        noAlcanza: true,
      })
      continue
    }

    const aplicar = Math.min(saldo, costoRestante)
    saldo -= aplicar
    const esParcial = aplicar < costoRestante

    const multaRestante = totalMultasDia - (multaYaAbonada[slot.id] ?? 0)
    const montoMultaAplicado = Math.min(aplicar, multaRestante)
    const montoCuotaAplicado = aplicar - montoMultaAplicado

    rows.push({
      numeroPago: slot.numeroPago,
      fechaProgramada: slot.fechaProgramada,
      montoCuota: montoCuotaAplicado,
      montoMulta: montoMultaAplicado,
      totalAplicado: aplicar,
      esParcial,
      noAlcanza: false,
    })
  }

  return rows
}

export default function ModalPagarAdeudo({ creditoId, nombreCliente, onClose, onSuccess }: Props) {
  const qc = useQueryClient()
  const hoy = useMemo(() => todayLocalStr(), [])
  const [monto, setMonto] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const { data: credito } = useQuery({
    queryKey: ['credito', creditoId],
    queryFn: () => creditoService.obtener(creditoId),
    staleTime: 30_000,
  })

  const { data: multas = [] } = useQuery({
    queryKey: ['multas-credito', creditoId],
    queryFn: () => cobrosService.getMultasPorCredito(creditoId),
    staleTime: 30_000,
  })

  const { data: abonosExistentes = [] } = useQuery({
    queryKey: ['abonos-credito', creditoId],
    queryFn: () => cobrosService.getAbonosPorCredito(creditoId),
    staleTime: 30_000,
  })

  const calendario = credito?.calendario ?? []
  const montoNum = Number(monto)
  const montoValido = Number.isFinite(montoNum) && montoNum > 0

  const distribucion = useMemo(() => {
    if (!montoValido) return []
    return computeDistribucion(montoNum, calendario, multas, abonosExistentes, hoy)
  }, [montoNum, calendario, multas, abonosExistentes, hoy, montoValido])

  // Calcular el monto total para ponerse al corriente
  const montoParaCorriente = useMemo(() => {
    const eligibles = calendario.filter((p) => {
      if (p.estado === 'NO_PAGADO' || p.estado === 'RECUPERADO_PARCIAL') return true
      if (p.estado === 'PENDIENTE' && p.fechaProgramada <= hoy) return true
      return false
    })
    return eligibles.reduce((sum, slot) => {
      const multasDia = multas
        .filter((m) => m.fecha === slot.fechaProgramada && !m.cobrada)
        .reduce((s, m) => s + Number(m.monto), 0)
      return sum + Number(slot.montoEsperado) + multasDia
    }, 0)
  }, [calendario, multas, hoy])

  const diasAtrasados = useMemo(() =>
    calendario.filter((p) => {
      if (p.estado === 'NO_PAGADO' || p.estado === 'RECUPERADO_PARCIAL') return true
      if (p.estado === 'PENDIENTE' && p.fechaProgramada <= hoy) return true
      return false
    }).length,
    [calendario, hoy],
  )

  const mutation = useMutation({
    mutationFn: () =>
      cobrosService.registrarAbonoCorrente({
        creditoId,
        montoRecibido: montoNum,
      }),
    onSuccess: () => {
      toast.success('Abono registrado correctamente')
      qc.invalidateQueries({ queryKey: ['ruta-dia'] })
      qc.invalidateQueries({ queryKey: ['credito', creditoId] })
      qc.invalidateQueries({ queryKey: ['multas-credito', creditoId] })
      qc.invalidateQueries({ queryKey: ['abonos-credito', creditoId] })
      qc.invalidateQueries({ queryKey: ['pagos-cliente-credito'] })
      onSuccess()
      onClose()
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Error al registrar abono'
      toast.error(msg)
    },
  })

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[2000] flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:w-[520px] sm:max-w-[95vw] rounded-t-2xl sm:rounded-xl max-h-[92dvh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9ecef] sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-[#212529]">Pagar adeudo</h2>
            <p className="text-[12px] text-[#6c757d] mt-0.5">{nombreCliente}</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* Resumen de adeudo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-[11px] text-[#6c757d] mb-0.5">Días atrasados</p>
              <p className="text-[20px] font-bold text-red-600">{diasAtrasados}</p>
            </div>
            <div className="bg-[#fef3c7] rounded-lg p-3 text-center">
              <p className="text-[11px] text-[#6c757d] mb-0.5">Para ponerse al corriente</p>
              <p className="text-[16px] font-bold text-[#92400e]">{fmtMoney(montoParaCorriente)}</p>
            </div>
          </div>

          {/* Input monto */}
          <div>
            <label className="block text-[12px] font-medium text-[#495057] mb-1">
              Monto a recibir <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6c757d] text-[13px]">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                className="input pl-7"
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Tabla de distribución */}
          {montoValido && distribucion.length > 0 && (
            <div>
              <p className="text-[12px] font-medium text-[#495057] mb-2">Distribución:</p>
              <div className="rounded-lg border border-[#e9ecef] overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#f8f9fa]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#6c757d] font-medium"># / Fecha</th>
                      <th className="text-right px-3 py-2 text-[#6c757d] font-medium">Aplicado</th>
                      <th className="text-center px-3 py-2 text-[#6c757d] font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distribucion.map((row) => (
                      <tr key={row.numeroPago} className="border-t border-[#f1f3f5]">
                        <td className="px-3 py-2">
                          <span className="font-medium text-[#212529]">#{row.numeroPago}</span>
                          <span className="text-[#adb5bd] ml-1">— {fmtDate(row.fechaProgramada)}</span>
                        </td>
                        <td className="text-right px-3 py-2 font-mono text-[#212529]">
                          {row.noAlcanza ? <span className="text-[#adb5bd]">—</span> : fmtMoney(row.totalAplicado)}
                        </td>
                        <td className="text-center px-3 py-2">
                          {row.noAlcanza ? (
                            <span className="inline-flex items-center gap-1 text-[#adb5bd]">
                              <Minus className="w-3 h-3" /> no alcanza
                            </span>
                          ) : row.esParcial ? (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <AlertTriangle className="w-3 h-3" /> parcial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-3 h-3" /> completo
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-[#e9ecef] px-5 py-4 flex gap-3">
          <button type="button" onClick={onClose} className="btn flex-1 py-3 text-[14px]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!montoValido || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="flex-1 py-3 rounded-lg border-2 border-[#d97706] bg-[#d97706] text-white text-[14px] font-semibold hover:bg-[#b45309] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mutation.isPending ? 'Registrando...' : 'Confirmar abono'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/cobros/ModalPagarAdeudo.tsx
git commit -m "feat: ModalPagarAdeudo con preview de distribución en tiempo real"
```

---

## Task 10: TabRutaDia — botón "Pagar adeudo"

**Files:**
- Modify: `frontend/src/pages/cobros/TabRutaDia.tsx`

- [ ] **Step 1: Add import and state for the new modal**

In `frontend/src/pages/cobros/TabRutaDia.tsx`:

1. Add import after the existing modal imports:
```tsx
import ModalPagarAdeudo from '@/components/cobros/ModalPagarAdeudo'
```

2. Add state after `const [pagoEditar, setPagoEditar] = useState<PagoCobroDTO | null>(null)`:
```tsx
const [abonoModal, setAbonoModal] = useState<ClienteRuta | null>(null)
```

- [ ] **Step 2: Add helper to detect if client has overdue debt**

After the existing `puedeModificar` helper:
```tsx
const tieneAdeudo = (c: ClienteRuta) =>
  c.multasPendientes > 0 && !esFechaHistorica
```

- [ ] **Step 3: Update ClienteCard to show "Pagar adeudo" button**

In the `ClienteCard` component, update the Props interface to add `onPagarAdeudo`:
```tsx
function ClienteCard({
  cliente: c,
  puedeRegistrar,
  onCobrar,
  onPagarAdeudo,
}: {
  cliente: ClienteRuta
  puedeRegistrar: boolean
  onCobrar: () => void
  onPagarAdeudo: () => void
}) {
```

Replace the existing button block (where `{puedeRegistrar && ...}` is rendered) with:
```tsx
        <div className="flex flex-col gap-1.5 shrink-0">
          {puedeRegistrar && (
            <button
              type="button"
              onClick={onCobrar}
              className="btn-primary py-2.5 px-4 text-[13px] min-w-[80px]"
            >
              {c.estadoHoy === 'SIN_REGISTRO' ? 'Cobrar' : 'Modificar'}
            </button>
          )}
          {c.multasPendientes > 0 && !esFechaHistorica && (
            <button
              type="button"
              onClick={onPagarAdeudo}
              className="py-2.5 px-4 rounded-lg border-2 border-[#d97706] bg-[#d97706] text-white text-[13px] font-semibold hover:bg-[#b45309] min-w-[80px]"
            >
              Pagar adeudo
            </button>
          )}
        </div>
```

**Note:** `esFechaHistorica` needs to be passed as a prop to `ClienteCard` since it's defined in the parent. Update `ClienteCard` props to add `esFechaHistorica: boolean` and pass it from the map call.

- [ ] **Step 4: Update ClienteRow similarly**

In `ClienteRow`, add `onPagarAdeudo` prop and `esFechaHistorica` prop, and add the button to the last `<td>`:

```tsx
function ClienteRow({
  cliente: c,
  puedeRegistrar,
  onCobrar,
  onPagarAdeudo,
  esFechaHistorica,
}: {
  cliente: ClienteRuta
  puedeRegistrar: boolean
  onCobrar: () => void
  onPagarAdeudo: () => void
  esFechaHistorica: boolean
}) {
```

Replace the `<td>` with the button:
```tsx
      <td>
        <div className="flex gap-1.5">
          {puedeRegistrar && (
            <button type="button" onClick={onCobrar} className="btn btn-sm">
              {c.estadoHoy === 'SIN_REGISTRO' ? 'Cobrar' : 'Modificar'}
            </button>
          )}
          {c.multasPendientes > 0 && !esFechaHistorica && (
            <button
              type="button"
              onClick={onPagarAdeudo}
              className="btn btn-sm border-[#d97706] text-[#d97706] hover:bg-[#fef3c7]"
            >
              Pagar adeudo
            </button>
          )}
        </div>
      </td>
```

- [ ] **Step 5: Update the map calls and render the new modal**

Update the mobile cards map:
```tsx
{filtrados.map((c) => (
  <ClienteCard
    key={c.clienteId}
    cliente={c}
    puedeRegistrar={puedeCobrar(c) || puedeModificar(c)}
    onCobrar={() => void abrirAccionCobro(c)}
    onPagarAdeudo={() => setAbonoModal(c)}
    esFechaHistorica={esFechaHistorica}
  />
))}
```

Update the desktop table map:
```tsx
{filtrados.map((c) => (
  <ClienteRow
    key={c.clienteId}
    cliente={c}
    puedeRegistrar={puedeCobrar(c) || puedeModificar(c)}
    onCobrar={() => void abrirAccionCobro(c)}
    onPagarAdeudo={() => setAbonoModal(c)}
    esFechaHistorica={esFechaHistorica}
  />
))}
```

Add modal at the end (after the existing modals):
```tsx
{abonoModal && (
  <ModalPagarAdeudo
    creditoId={abonoModal.creditoId}
    nombreCliente={abonoModal.nombreCompleto}
    onClose={() => setAbonoModal(null)}
    onSuccess={() => setAbonoModal(null)}
  />
)}
```

- [ ] **Step 6: Verify TypeScript compilation**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/cobros/TabRutaDia.tsx
git commit -m "feat: botón 'Pagar adeudo' en ruta del día cuando hay multas pendientes"
```

---

## Task 11: CreditoDetallePage — badges + "Abonos extraordinarios"

**Files:**
- Modify: `frontend/src/pages/creditos/CreditoDetallePage.tsx`

- [ ] **Step 1: Add import and data fetch for abonos**

At the top of the component, after the existing queries, add:
```tsx
const { data: abonosCredito = [] } = useQuery({
  queryKey: ['abonos-credito', numId],
  queryFn: () => cobrosService.getAbonosPorCredito(numId),
  enabled: !!credito,
  staleTime: 30_000,
})
```

Also add the import:
```tsx
import type { PagoCobroDTO, TipoPago, AbonoCorrienteDTO } from '@/types'
```

- [ ] **Step 2: Update badge logic in calendar tab to handle RECUPERADO states**

In the calendar `tbody` section, find the `let badgeCls = ''` block and add two new cases at the top (before ADELANTADO):

```tsx
let badgeCls = ''
let badgeLabel = ''
if (pago.estado === 'RECUPERADO') {
  badgeCls = 'bg-blue-100 text-blue-700'
  badgeLabel = 'Abono ✓'
} else if (pago.estado === 'RECUPERADO_PARCIAL') {
  badgeCls = 'bg-amber-100 text-amber-800'
  badgeLabel = 'Abono parcial'
} else if (pago.estado === 'ADELANTADO') {
  // ... existing cases continue unchanged
```

Also update `rowClass` to handle the new states:
```tsx
if (pago.estado === 'RECUPERADO')         rowClass = 'bg-blue-50/60'
else if (pago.estado === 'RECUPERADO_PARCIAL') rowClass = 'bg-amber-50'
else if (pago.estado === 'ADELANTADO')    rowClass = 'bg-green-50'
// ... existing cases
```

- [ ] **Step 3: Update montoRecibido column to show abono amount for RECUPERADO rows**

In the `<td>` that currently shows `pagoRegistrado?.montoRecibido`, add a fallback for abono rows:

```tsx
<td className="text-center font-mono text-sm px-2 py-3 whitespace-nowrap">
  {pagoRegistrado
    ? pagoRegistrado.razonNoPago
      ? <span className="text-[#dc2626] italic text-xs">No pagó</span>
      : fmtMoney(pagoRegistrado.montoRecibido)
    : (() => {
        if (pago.estado === 'RECUPERADO' || pago.estado === 'RECUPERADO_PARCIAL') {
          const cobertura = abonosCredito
            .flatMap((a) => a.coberturas)
            .find((c) => c.numeroPago === pago.numeroPago)
          return cobertura
            ? <span className="text-blue-700 font-mono">{fmtMoney(cobertura.totalAplicado)}</span>
            : <span className="text-gray-400">—</span>
        }
        return <span className="text-gray-400">—</span>
      })()
  }
</td>
```

- [ ] **Step 4: Update tieneRegistro and action buttons for abono rows**

Find `const tieneRegistro = ['PAGADO', 'PARCIAL', 'NO_PAGADO', 'ADELANTADO'].includes(pago.estado)` and update:

```tsx
const tieneRegistro = ['PAGADO', 'PARCIAL', 'NO_PAGADO', 'ADELANTADO'].includes(pago.estado)
const esAbono = pago.estado === 'RECUPERADO' || pago.estado === 'RECUPERADO_PARCIAL'
const abonoDeEstaFila = esAbono
  ? abonosCredito.find((a) => a.coberturas.some((c) => c.numeroPago === pago.numeroPago))
  : null
```

Then in the actions `<td>`, add a "Ver abono" button after the existing buttons:
```tsx
<td className="text-center px-2 py-3 whitespace-nowrap">
  <div className="flex justify-center gap-1.5">
    {tieneRegistro && pagoRegistrado && (
      <button
        type="button"
        className="btn btn-sm text-xs py-0.5 px-2"
        onClick={() => setPagoModal(pagoRegistrado)}
      >
        Ver pago
      </button>
    )}
    {tieneRegistro && pagoRegistrado && esAdminSupervisor && (
      <button
        type="button"
        className="btn btn-sm text-xs py-0.5 px-2"
        onClick={() => setPagoEditar(pagoRegistrado)}
      >
        Modificar
      </button>
    )}
    {esAbono && abonoDeEstaFila && (
      <button
        type="button"
        className="btn btn-sm text-xs py-0.5 px-2 text-blue-700 border-blue-200 hover:bg-blue-50"
        onClick={() => setAbonoDetalleModal(abonoDeEstaFila)}
      >
        Ver abono
      </button>
    )}
  </div>
</td>
```

- [ ] **Step 5: Add abonoDetalleModal state and modal UI**

Add state:
```tsx
const [abonoDetalleModal, setAbonoDetalleModal] = useState<AbonoCorrienteDTO | null>(null)
```

Add modal at the end of the component (after the existing modals), inside the `return`:
```tsx
{abonoDetalleModal && (
  <div
    className="fixed inset-0 bg-black/50 z-[2000] flex items-end sm:items-center justify-center"
    onClick={(e) => { if (e.target === e.currentTarget) setAbonoDetalleModal(null) }}
  >
    <div className="bg-white w-full sm:w-[480px] rounded-t-2xl sm:rounded-xl max-h-[80dvh] overflow-y-auto shadow-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9ecef] sticky top-0 bg-white">
        <div>
          <h2 className="text-[15px] font-semibold">Abono extraordinario #{abonoDetalleModal.abonoId}</h2>
          <p className="text-[12px] text-[#6c757d] mt-0.5">{fmtDate(abonoDetalleModal.fecha)}</p>
        </div>
        <button type="button" onClick={() => setAbonoDetalleModal(null)} className="btn btn-sm p-1.5">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-5 py-4 space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-[#f8f9fa] rounded-lg p-3">
            <p className="text-[11px] text-[#6c757d]">Total recibido</p>
            <p className="text-[16px] font-bold text-[#212529]">{fmtMoney(abonoDetalleModal.montoTotal)}</p>
          </div>
          <div className="bg-[#f8f9fa] rounded-lg p-3">
            <p className="text-[11px] text-[#6c757d]">Días cubiertos</p>
            <p className="text-[16px] font-bold text-[#16a34a]">{abonoDetalleModal.diasCubiertos}</p>
          </div>
          <div className="bg-[#f8f9fa] rounded-lg p-3">
            <p className="text-[11px] text-[#6c757d]">Parciales</p>
            <p className="text-[16px] font-bold text-amber-600">{abonoDetalleModal.diasParciales}</p>
          </div>
        </div>
        <div className="rounded-lg border border-[#e9ecef] overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-[#f8f9fa]">
              <tr>
                <th className="text-left px-3 py-2 text-[#6c757d] font-medium"># / Fecha</th>
                <th className="text-right px-3 py-2 text-[#6c757d] font-medium">Cuota</th>
                <th className="text-right px-3 py-2 text-[#6c757d] font-medium">Multa</th>
                <th className="text-right px-3 py-2 text-[#6c757d] font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {abonoDetalleModal.coberturas.map((c) => (
                <tr key={c.numeroPago} className="border-t border-[#f1f3f5]">
                  <td className="px-3 py-2">
                    <span className="font-medium">#{c.numeroPago}</span>
                    <span className="text-[#adb5bd] ml-1">
                      — {new Date(c.fechaProgramada + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </span>
                    {c.esParcial && (
                      <span className="ml-1 text-amber-600 text-[10px]">(parcial)</span>
                    )}
                  </td>
                  <td className="text-right px-3 py-2 font-mono">{fmtMoney(c.montoCuota)}</td>
                  <td className="text-right px-3 py-2 font-mono">{fmtMoney(c.montoMulta)}</td>
                  <td className="text-right px-3 py-2 font-mono font-semibold">{fmtMoney(c.totalAplicado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: Add "Abonos extraordinarios" section in tab Información**

Inside the `tab === 'informacion'` block, after the "Estadísticas" `<section>` and before the "Cliente card" `<section>`, add:

```tsx
{abonosCredito.length > 0 && (
  <section>
    <h2 className="text-sm font-semibold text-[#3d6b35] uppercase tracking-wide mb-3">
      Abonos extraordinarios
    </h2>
    <div className="space-y-2">
      {abonosCredito.map((abono) => (
        <button
          key={abono.abonoId}
          type="button"
          onClick={() => setAbonoDetalleModal(abono)}
          className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-100 transition-colors text-left"
        >
          <div>
            <span className="text-[13px] font-semibold text-blue-800">
              Abono #{abono.abonoId}
            </span>
            <span className="text-[12px] text-blue-600 ml-2">
              {new Date(abono.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            <span className="text-[12px] text-blue-600 ml-2">
              — {abono.diasCubiertos} días cubiertos{abono.diasParciales > 0 ? ` + ${abono.diasParciales} parcial` : ''}
            </span>
          </div>
          <div className="text-[13px] font-bold text-blue-800 shrink-0">
            {fmtMoney(abono.montoTotal)}
          </div>
        </button>
      ))}
    </div>
  </section>
)}
```

Also add the missing `X` import in `CreditoDetallePage.tsx` if not already there (it's used in the abono detail modal):
```tsx
import { ArrowLeft, ChevronRight, Play, ExternalLink, X } from 'lucide-react'
```
(X is already imported — no change needed.)

- [ ] **Step 7: Verify TypeScript compilation**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/creditos/CreditoDetallePage.tsx
git commit -m "feat: badges RECUPERADO/RECUPERADO_PARCIAL, modal Ver abono, sección Abonos extraordinarios"
```

---

## Self-Review Checklist

- [x] **Spec § Algoritmo**: Task 6 implementa oldest-first con multas-first para parciales — cubierto
- [x] **Spec § Algoritmo / segundo abono**: Test 3 + servicio usa `sumTotalAplicadoByCalendarioPagoId` — cubierto
- [x] **Spec § Modelo**: Tables V29 + entities Tasks 1-2 — cubierto
- [x] **Spec § API POST**: Task 7 — cubierto
- [x] **Spec § API GET**: Task 7 — cubierto
- [x] **Spec § UI CobrosPage**: Task 10 — cubierto
- [x] **Spec § UI Modal**: Task 9 — cubierto
- [x] **Spec § UI Calendario badges**: Task 11 step 2 — cubierto
- [x] **Spec § UI "Ver abono" modal**: Task 11 steps 4-5 — cubierto
- [x] **Spec § UI "Abonos extraordinarios"**: Task 11 step 6 — cubierto
- [x] **Placeholders**: ninguno — todos los steps tienen código completo
- [x] **Type consistency**: `AbonoCorrienteDTO`, `CoberturaDetalleDTO`, `AbonoCoberturaDTO` consistentes entre Tasks 4, 8, 9, 11
