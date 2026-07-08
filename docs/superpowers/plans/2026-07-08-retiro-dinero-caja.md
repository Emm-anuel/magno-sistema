# Retiro de Dinero de Caja Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Retiros" section that lets Admin/Supervisor withdraw cash from the daily caja with a free-text justification, correctly reflected in the caja close calculation, the close PDF, and the historical Ingresos y Egresos report.

**Architecture:** Extend the existing `caja_movimiento_inversion` table with a `tipo` discriminator (`INVERSION`|`RETIRO`) instead of creating a parallel table — a retiro behaves financially identically to an inversion "salida" (it subtracts from `subtotal_caja` before the 24% apartado). Retiros get their own `RetiroService`/`RetiroController` (mirroring the existing `InversionService`/`InversionController`, which are separate from `CajaService`) and their own nav entry (`/retiros`), but share the underlying table and sum logic with Inversiones.

**Tech Stack:** Spring Boot 3 / Java 17 / PostgreSQL / Liquibase (backend), React 18 / TypeScript / TanStack Query (frontend).

**Spec:** `docs/superpowers/specs/2026-07-08-retiro-dinero-caja-design.md`

---

## Task 1: Migration — add `tipo`/`justificacion` to `caja_movimiento_inversion`

**Files:**
- Create: `backend/src/main/resources/db/changelog/V30__caja_movimiento_tipo_retiro.sql`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Distingue movimientos de Inversión de Retiros de caja en la misma tabla
ALTER TABLE caja_movimiento_inversion ADD COLUMN tipo VARCHAR(20) NOT NULL DEFAULT 'INVERSION';
ALTER TABLE caja_movimiento_inversion ALTER COLUMN concepto_inversion_id DROP NOT NULL;
ALTER TABLE caja_movimiento_inversion ADD COLUMN justificacion TEXT;
```

- [ ] **Step 2: Register the changeset in the master changelog**

Insert before the closing `</databaseChangeLog>` tag at the end of `backend/src/main/resources/db/changelog/db.changelog-master.xml` (mirrors the `V29-abono-corriente` entry immediately above it):

```xml
    <changeSet id="V30-caja-movimiento-tipo-retiro" author="magno">
        <sqlFile
            path="db/changelog/V30__caja_movimiento_tipo_retiro.sql"
            relativeToChangelogFile="false"
            splitStatements="true"
            stripComments="false"/>
    </changeSet>

</databaseChangeLog>
```

- [ ] **Step 3: Verify the migration applies cleanly**

Run: `cd backend && mvn -Dtest=MagnoApplicationTests test`
Expected: BUILD SUCCESS — `MagnoApplicationTests#contextLoads` is the only test in the suite that boots the full Spring context (`@SpringBootTest`), which runs Liquibase against the configured datasource. All other tests in this codebase (including `CajaServiceTest`) are pure Mockito unit tests that never touch a real database, so this is the one check that catches a broken migration. Requires the `dev` profile's datasource (see `application-dev.yml`) to be reachable — if it isn't in your environment, skip this step and rely on manual verification in Task 17 instead.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/changelog/V30__caja_movimiento_tipo_retiro.sql backend/src/main/resources/db/changelog/db.changelog-master.xml
git commit -m "feat: agregar columna tipo/justificacion a caja_movimiento_inversion"
```

---

## Task 2: `TipoMovimientoCaja` enum + entity update

**Files:**
- Create: `backend/src/main/java/com/magno/model/TipoMovimientoCaja.java`
- Modify: `backend/src/main/java/com/magno/model/CajaMovimientoInversion.java`

- [ ] **Step 1: Create the enum**

```java
package com.magno.model;

public enum TipoMovimientoCaja { INVERSION, RETIRO }
```

- [ ] **Step 2: Add `tipo`/`justificacion` fields to the entity and make `conceptoInversion` nullable**

In `backend/src/main/java/com/magno/model/CajaMovimientoInversion.java`, change the `concepto_inversion_id` join column to nullable and add the two new fields:

```java
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "concepto_inversion_id", nullable = true)
    private ConceptoInversion conceptoInversion;

    @Column(length = 255)
    private String descripcion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoMovimientoCaja tipo;

    @Column(columnDefinition = "TEXT")
    private String justificacion;
```

Add the import at the top of the file:

```java
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
```

(Note: `import jakarta.persistence.*;` is already present at line 3 — check whether it already covers `Enumerated`/`EnumType` before adding a duplicate import; if the wildcard import is there, skip this step.)

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && mvn compile`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/model/TipoMovimientoCaja.java backend/src/main/java/com/magno/model/CajaMovimientoInversion.java
git commit -m "feat: agregar tipo y justificacion a CajaMovimientoInversion"
```

---

## Task 3: Repository — add tipo-filtered queries

**Files:**
- Modify: `backend/src/main/java/com/magno/repository/CajaMovimientoInversionRepository.java`

- [ ] **Step 1: Add the two new methods**

```java
package com.magno.repository;

import com.magno.model.CajaMovimientoInversion;
import com.magno.model.TipoMovimientoCaja;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface CajaMovimientoInversionRepository extends JpaRepository<CajaMovimientoInversion, Long> {

    List<CajaMovimientoInversion> findByCajaDiaIdOrderByCreatedAtAsc(Long cajaDiaId);

    List<CajaMovimientoInversion> findByCajaDiaIdAndTipoOrderByCreatedAtAsc(Long cajaDiaId, TipoMovimientoCaja tipo);

    @Query("SELECT COALESCE(SUM(m.monto), 0) FROM CajaMovimientoInversion m WHERE m.cajaDia.id = :cajaDiaId")
    BigDecimal sumMontoByCajaDiaId(@Param("cajaDiaId") Long cajaDiaId);

    @Query("SELECT COALESCE(SUM(m.monto), 0) FROM CajaMovimientoInversion m WHERE m.cajaDia.id = :cajaDiaId AND m.tipo = :tipo")
    BigDecimal sumMontoByCajaDiaIdAndTipo(@Param("cajaDiaId") Long cajaDiaId, @Param("tipo") TipoMovimientoCaja tipo);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && mvn compile`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/magno/repository/CajaMovimientoInversionRepository.java
git commit -m "feat: agregar consultas filtradas por tipo a CajaMovimientoInversionRepository"
```

---

## Task 4: `InversionService` — filter to `tipo = INVERSION`

Inversiones today saves/reads every row in the table unfiltered. Once Retiros start writing to the same table, `InversionService` must only see `INVERSION` rows. This is the first behavior change, so it gets a dedicated test file (none exists yet for this service).

**Files:**
- Create: `backend/src/test/java/com/magno/service/InversionServiceTest.java`
- Modify: `backend/src/main/java/com/magno/service/InversionService.java`

- [ ] **Step 1: Write the failing tests**

```java
package com.magno.service;

import com.magno.dto.caja.MovimientoInversionDTO;
import com.magno.dto.caja.MovimientoInversionRequest;
import com.magno.model.*;
import com.magno.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class InversionServiceTest {

    private CajaDiaRepository cajaDiaRepo;
    private CajaMovimientoInversionRepository movimientoRepo;
    private ConceptoInversionRepository conceptoRepo;
    private UsuarioRepository usuarioRepo;
    private InversionService service;

    private CajaDia caja;
    private ConceptoInversion concepto;
    private Usuario usuario;

    @BeforeEach
    void setUp() {
        cajaDiaRepo = mock(CajaDiaRepository.class);
        movimientoRepo = mock(CajaMovimientoInversionRepository.class);
        conceptoRepo = mock(ConceptoInversionRepository.class);
        usuarioRepo = mock(UsuarioRepository.class);
        service = new InversionService(cajaDiaRepo, movimientoRepo, conceptoRepo, usuarioRepo);

        Sucursal sucursal = new Sucursal();
        sucursal.setId(1L);

        caja = CajaDia.builder()
                .id(500L)
                .sucursal(sucursal)
                .estado(EstadoCaja.ABIERTA)
                .build();

        concepto = new ConceptoInversion();
        concepto.setId(10L);
        concepto.setNombre("Aportación del dueño");

        usuario = new Usuario();
        usuario.setId(99L);
        usuario.setNombreCompleto("Laura Gerente");
    }

    @Test
    void getByDia_soloRetornaMovimientosTipoInversion() {
        when(cajaDiaRepo.existsById(500L)).thenReturn(true);
        CajaMovimientoInversion mov = CajaMovimientoInversion.builder()
                .id(1L).cajaDia(caja).conceptoInversion(concepto)
                .monto(new BigDecimal("500.00")).tipo(TipoMovimientoCaja.INVERSION)
                .registradoPor(usuario).build();
        when(movimientoRepo.findByCajaDiaIdAndTipoOrderByCreatedAtAsc(500L, TipoMovimientoCaja.INVERSION))
                .thenReturn(List.of(mov));

        List<MovimientoInversionDTO> result = service.getByDia(500L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).conceptoNombre()).isEqualTo("Aportación del dueño");
        verify(movimientoRepo, never()).findByCajaDiaIdOrderByCreatedAtAsc(any());
    }

    @Test
    void registrar_persisteConTipoInversion() {
        when(cajaDiaRepo.findById(500L)).thenReturn(Optional.of(caja));
        when(conceptoRepo.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(concepto));
        when(usuarioRepo.getReferenceById(99L)).thenReturn(usuario);
        when(movimientoRepo.save(any(CajaMovimientoInversion.class))).thenAnswer(inv -> {
            CajaMovimientoInversion m = inv.getArgument(0);
            m.setId(1L);
            return m;
        });

        MovimientoInversionRequest req = new MovimientoInversionRequest(10L, "Aportación", new BigDecimal("500.00"));
        service.registrar(500L, req, 99L);

        verify(movimientoRepo).save(argThat(m -> m.getTipo() == TipoMovimientoCaja.INVERSION));
    }

    @Test
    void registrar_fallaSiCajaCerrada() {
        caja.setEstado(EstadoCaja.CERRADA);
        when(cajaDiaRepo.findById(500L)).thenReturn(Optional.of(caja));

        MovimientoInversionRequest req = new MovimientoInversionRequest(10L, "Aportación", new BigDecimal("500.00"));

        assertThatThrownBy(() -> service.registrar(500L, req, 99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("abierta");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && mvn -Dtest=InversionServiceTest test`
Expected: FAIL — `getByDia` still calls `findByCajaDiaIdOrderByCreatedAtAsc` (unfiltered) and `registrar` never sets `tipo` (the builder call has no `.tipo(...)`, so `getTipo()` returns `null`, not `INVERSION`).

- [ ] **Step 3: Update `InversionService` to filter/set `tipo = INVERSION`**

In `backend/src/main/java/com/magno/service/InversionService.java`:

```java
package com.magno.service;

import com.magno.dto.caja.MovimientoInversionDTO;
import com.magno.dto.caja.MovimientoInversionRequest;
import com.magno.model.*;
import com.magno.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class InversionService {

    private final CajaDiaRepository cajaDiaRepo;
    private final CajaMovimientoInversionRepository movimientoRepo;
    private final ConceptoInversionRepository conceptoRepo;
    private final UsuarioRepository usuarioRepo;

    public InversionService(CajaDiaRepository cajaDiaRepo,
            CajaMovimientoInversionRepository movimientoRepo,
            ConceptoInversionRepository conceptoRepo,
            UsuarioRepository usuarioRepo) {
        this.cajaDiaRepo = cajaDiaRepo;
        this.movimientoRepo = movimientoRepo;
        this.conceptoRepo = conceptoRepo;
        this.usuarioRepo = usuarioRepo;
    }

    public List<MovimientoInversionDTO> getByDia(Long cajaId) {
        if (!cajaDiaRepo.existsById(cajaId)) {
            throw new EntityNotFoundException("Caja no encontrada: " + cajaId);
        }
        return movimientoRepo.findByCajaDiaIdAndTipoOrderByCreatedAtAsc(cajaId, TipoMovimientoCaja.INVERSION)
                .stream().map(this::toDTO).toList();
    }

    @Transactional
    public MovimientoInversionDTO registrar(Long cajaId, MovimientoInversionRequest req, Long usuarioId) {
        CajaDia caja = cajaDiaRepo.findById(cajaId)
                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));
        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException(
                    "Solo se pueden registrar movimientos mientras la caja está abierta");
        }
        ConceptoInversion concepto = conceptoRepo.findByIdAndDeletedAtIsNull(req.conceptoInversionId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Concepto no encontrado: " + req.conceptoInversionId()));

        CajaMovimientoInversion mov = CajaMovimientoInversion.builder()
                .cajaDia(caja)
                .conceptoInversion(concepto)
                .descripcion(req.descripcion())
                .monto(req.monto())
                .tipo(TipoMovimientoCaja.INVERSION)
                .registradoPor(usuarioRepo.getReferenceById(usuarioId))
                .build();
        return toDTO(movimientoRepo.save(mov));
    }

    @Transactional
    public void eliminar(Long cajaId, Long movimientoId) {
        CajaDia caja = cajaDiaRepo.findById(cajaId)
                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));
        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException(
                    "Solo se pueden eliminar movimientos mientras la caja está abierta");
        }
        CajaMovimientoInversion mov = movimientoRepo.findById(movimientoId)
                .orElseThrow(() -> new EntityNotFoundException("Movimiento no encontrado: " + movimientoId));
        if (!mov.getCajaDia().getId().equals(cajaId)) {
            throw new IllegalArgumentException("El movimiento no pertenece a esta caja");
        }
        movimientoRepo.delete(mov);
    }

    private MovimientoInversionDTO toDTO(CajaMovimientoInversion m) {
        return new MovimientoInversionDTO(
                m.getId(),
                m.getConceptoInversion().getId(),
                m.getConceptoInversion().getNombre(),
                m.getDescripcion(),
                m.getMonto(),
                m.getRegistradoPor().getId(),
                m.getRegistradoPor().getNombreCompleto(),
                m.getCreatedAt());
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && mvn -Dtest=InversionServiceTest test`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add backend/src/test/java/com/magno/service/InversionServiceTest.java backend/src/main/java/com/magno/service/InversionService.java
git commit -m "feat: InversionService filtra y persiste tipo=INVERSION"
```

---

## Task 5: `RetiroRequest` / `RetiroDTO`

**Files:**
- Create: `backend/src/main/java/com/magno/dto/caja/RetiroRequest.java`
- Create: `backend/src/main/java/com/magno/dto/caja/RetiroDTO.java`

- [ ] **Step 1: Create the request DTO**

```java
package com.magno.dto.caja;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record RetiroRequest(
        @NotNull @DecimalMin("0.01") BigDecimal monto,
        @NotBlank @Size(min = 10, max = 500) String justificacion
) {}
```

- [ ] **Step 2: Create the response DTO**

```java
package com.magno.dto.caja;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record RetiroDTO(
        Long id,
        BigDecimal monto,
        String justificacion,
        Long registradoPorId,
        String registradoPorNombre,
        OffsetDateTime createdAt
) {}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && mvn compile`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/dto/caja/RetiroRequest.java backend/src/main/java/com/magno/dto/caja/RetiroDTO.java
git commit -m "feat: agregar RetiroRequest y RetiroDTO"
```

---

## Task 6: `RetiroService` (TDD)

**Files:**
- Create: `backend/src/test/java/com/magno/service/RetiroServiceTest.java`
- Create: `backend/src/main/java/com/magno/service/RetiroService.java`

- [ ] **Step 1: Write the failing tests**

```java
package com.magno.service;

import com.magno.dto.caja.RetiroDTO;
import com.magno.dto.caja.RetiroRequest;
import com.magno.model.*;
import com.magno.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RetiroServiceTest {

    private CajaDiaRepository cajaDiaRepo;
    private CajaMovimientoInversionRepository movimientoRepo;
    private UsuarioRepository usuarioRepo;
    private RetiroService service;

    private CajaDia caja;
    private Usuario usuario;

    @BeforeEach
    void setUp() {
        cajaDiaRepo = mock(CajaDiaRepository.class);
        movimientoRepo = mock(CajaMovimientoInversionRepository.class);
        usuarioRepo = mock(UsuarioRepository.class);
        service = new RetiroService(cajaDiaRepo, movimientoRepo, usuarioRepo);

        Sucursal sucursal = new Sucursal();
        sucursal.setId(1L);

        caja = CajaDia.builder()
                .id(500L)
                .sucursal(sucursal)
                .estado(EstadoCaja.ABIERTA)
                .build();

        usuario = new Usuario();
        usuario.setId(99L);
        usuario.setNombreCompleto("Laura Gerente");
    }

    @Test
    void registrar_persisteMontoNegativoConTipoRetiro() {
        when(cajaDiaRepo.findById(500L)).thenReturn(Optional.of(caja));
        when(usuarioRepo.getReferenceById(99L)).thenReturn(usuario);
        when(movimientoRepo.save(any(CajaMovimientoInversion.class))).thenAnswer(inv -> {
            CajaMovimientoInversion m = inv.getArgument(0);
            m.setId(1L);
            return m;
        });

        RetiroRequest req = new RetiroRequest(new BigDecimal("300.00"), "Pago de proveedor urgente");
        RetiroDTO result = service.registrar(500L, req, 99L);

        assertThat(result.monto()).isEqualByComparingTo("-300.00");
        assertThat(result.justificacion()).isEqualTo("Pago de proveedor urgente");
        verify(movimientoRepo).save(argThat(m ->
                m.getTipo() == TipoMovimientoCaja.RETIRO
                        && m.getConceptoInversion() == null
                        && m.getMonto().compareTo(new BigDecimal("-300.00")) == 0));
    }

    @Test
    void registrar_fallaSiCajaCerrada() {
        caja.setEstado(EstadoCaja.CERRADA);
        when(cajaDiaRepo.findById(500L)).thenReturn(Optional.of(caja));

        RetiroRequest req = new RetiroRequest(new BigDecimal("300.00"), "Pago de proveedor urgente");

        assertThatThrownBy(() -> service.registrar(500L, req, 99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("abierta");
    }

    @Test
    void getByDia_soloRetornaMovimientosTipoRetiro() {
        when(cajaDiaRepo.existsById(500L)).thenReturn(true);
        CajaMovimientoInversion mov = CajaMovimientoInversion.builder()
                .id(1L).cajaDia(caja).tipo(TipoMovimientoCaja.RETIRO)
                .monto(new BigDecimal("-300.00")).justificacion("Pago de proveedor urgente")
                .registradoPor(usuario).build();
        when(movimientoRepo.findByCajaDiaIdAndTipoOrderByCreatedAtAsc(500L, TipoMovimientoCaja.RETIRO))
                .thenReturn(List.of(mov));

        List<RetiroDTO> result = service.getByDia(500L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).justificacion()).isEqualTo("Pago de proveedor urgente");
    }

    @Test
    void eliminar_fallaSiElMovimientoNoPerteneceALaCaja() {
        CajaDia otraCaja = CajaDia.builder().id(600L).estado(EstadoCaja.ABIERTA).build();
        CajaMovimientoInversion mov = CajaMovimientoInversion.builder()
                .id(1L).cajaDia(otraCaja).tipo(TipoMovimientoCaja.RETIRO)
                .monto(new BigDecimal("-300.00")).registradoPor(usuario).build();

        when(cajaDiaRepo.findById(500L)).thenReturn(Optional.of(caja));
        when(movimientoRepo.findById(1L)).thenReturn(Optional.of(mov));

        assertThatThrownBy(() -> service.eliminar(500L, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no pertenece");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && mvn -Dtest=RetiroServiceTest test`
Expected: FAIL — `RetiroService` does not exist yet (compile error).

- [ ] **Step 3: Implement `RetiroService`**

```java
package com.magno.service;

import com.magno.dto.caja.RetiroDTO;
import com.magno.dto.caja.RetiroRequest;
import com.magno.model.*;
import com.magno.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class RetiroService {

    private final CajaDiaRepository cajaDiaRepo;
    private final CajaMovimientoInversionRepository movimientoRepo;
    private final UsuarioRepository usuarioRepo;

    public RetiroService(CajaDiaRepository cajaDiaRepo,
            CajaMovimientoInversionRepository movimientoRepo,
            UsuarioRepository usuarioRepo) {
        this.cajaDiaRepo = cajaDiaRepo;
        this.movimientoRepo = movimientoRepo;
        this.usuarioRepo = usuarioRepo;
    }

    public List<RetiroDTO> getByDia(Long cajaId) {
        if (!cajaDiaRepo.existsById(cajaId)) {
            throw new EntityNotFoundException("Caja no encontrada: " + cajaId);
        }
        return movimientoRepo.findByCajaDiaIdAndTipoOrderByCreatedAtAsc(cajaId, TipoMovimientoCaja.RETIRO)
                .stream().map(this::toDTO).toList();
    }

    @Transactional
    public RetiroDTO registrar(Long cajaId, RetiroRequest req, Long usuarioId) {
        CajaDia caja = cajaDiaRepo.findById(cajaId)
                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));
        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException(
                    "Solo se pueden registrar retiros mientras la caja está abierta");
        }

        CajaMovimientoInversion mov = CajaMovimientoInversion.builder()
                .cajaDia(caja)
                .conceptoInversion(null)
                .justificacion(req.justificacion())
                .monto(req.monto().negate())
                .tipo(TipoMovimientoCaja.RETIRO)
                .registradoPor(usuarioRepo.getReferenceById(usuarioId))
                .build();
        return toDTO(movimientoRepo.save(mov));
    }

    @Transactional
    public void eliminar(Long cajaId, Long movimientoId) {
        CajaDia caja = cajaDiaRepo.findById(cajaId)
                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaId));
        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException(
                    "Solo se pueden eliminar retiros mientras la caja está abierta");
        }
        CajaMovimientoInversion mov = movimientoRepo.findById(movimientoId)
                .orElseThrow(() -> new EntityNotFoundException("Retiro no encontrado: " + movimientoId));
        if (!mov.getCajaDia().getId().equals(cajaId)) {
            throw new IllegalArgumentException("El retiro no pertenece a esta caja");
        }
        movimientoRepo.delete(mov);
    }

    private RetiroDTO toDTO(CajaMovimientoInversion m) {
        return new RetiroDTO(
                m.getId(),
                m.getMonto(),
                m.getJustificacion(),
                m.getRegistradoPor().getId(),
                m.getRegistradoPor().getNombreCompleto(),
                m.getCreatedAt());
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && mvn -Dtest=RetiroServiceTest test`
Expected: PASS (4/4)

- [ ] **Step 5: Commit**

```bash
git add backend/src/test/java/com/magno/service/RetiroServiceTest.java backend/src/main/java/com/magno/service/RetiroService.java
git commit -m "feat: agregar RetiroService"
```

---

## Task 7: `RetiroController`

**Files:**
- Create: `backend/src/main/java/com/magno/controller/RetiroController.java`

- [ ] **Step 1: Implement the controller (mirrors `InversionController`)**

```java
package com.magno.controller;

import com.magno.dto.caja.RetiroDTO;
import com.magno.dto.caja.RetiroRequest;
import com.magno.security.JwtPrincipal;
import com.magno.service.RetiroService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/retiros")
@PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
public class RetiroController {

    private final RetiroService retiroService;

    public RetiroController(RetiroService retiroService) {
        this.retiroService = retiroService;
    }

    @GetMapping
    public ResponseEntity<List<RetiroDTO>> getRetiros(@RequestParam Long cajaId) {
        return ResponseEntity.ok(retiroService.getByDia(cajaId));
    }

    @PostMapping
    public ResponseEntity<RetiroDTO> registrar(
            @RequestParam Long cajaId,
            @Valid @RequestBody RetiroRequest req,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(retiroService.registrar(cajaId, req, principal(auth).userId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(
            @RequestParam Long cajaId,
            @PathVariable Long id) {
        retiroService.eliminar(cajaId, id);
        return ResponseEntity.noContent().build();
    }

    private JwtPrincipal principal(Authentication auth) {
        return (JwtPrincipal) auth.getPrincipal();
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && mvn compile`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/magno/controller/RetiroController.java
git commit -m "feat: agregar RetiroController"
```

---

## Task 8: `CajaCierrePreviewDTO` — add `subtotalRetiros`

**Files:**
- Modify: `backend/src/main/java/com/magno/dto/caja/CajaCierrePreviewDTO.java`
- Modify: `backend/src/main/java/com/magno/service/CajaService.java:303-393` (`getPreviewCierre`)
- Modify: `backend/src/test/java/com/magno/service/CajaServiceTest.java`

- [ ] **Step 1: Extend the failing test first**

In `backend/src/test/java/com/magno/service/CajaServiceTest.java`, update `getPreviewCierre_incluyeClientesSinRegistro` to stub the two new tipo-filtered sums instead of the old unfiltered one, and add an assertion on the new field:

```java
    @Test
    void getPreviewCierre_incluyeClientesSinRegistro() {
        when(cajaDiaRepo.findBySucursalIdAndFechaAndEstado(1L, hoy, EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(caja));
        when(movimientoRepo.sumMontoByCajaDiaIdAndTipo(500L, TipoMovimientoCaja.INVERSION))
                .thenReturn(BigDecimal.ZERO);
        when(movimientoRepo.sumMontoByCajaDiaIdAndTipo(500L, TipoMovimientoCaja.RETIRO))
                .thenReturn(new BigDecimal("-150.00"));
        when(pagoRepo.sumIngresoBySucursalAndFecha(1L, hoy)).thenReturn(BigDecimal.ZERO);
        when(pagoRepo.findCobrosPorAsesorBySucursalAndFecha(1L, hoy)).thenReturn(List.of());
        when(creditoRepo.sumDesembolsosByTipoAndSucursalAndFecha(eq(1L), eq(TipoCredito.NUEVO), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(renovacionRepo.sumDesembolsosByScopeAndFecha(1L, null, hoy, hoy)).thenReturn(BigDecimal.ZERO);
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));
        when(gastoRepo.sumMontoByCajaDiaId(500L)).thenReturn(BigDecimal.ZERO);
        when(nominaPagoRepo.findByCajaDiaIdAndDeletedAtIsNull(500L)).thenReturn(Optional.empty());
        when(pagoRepo.findMultasPorAsesorBySucursalAndFecha(1L, hoy)).thenReturn(List.of());
        when(multaRepo.sumMultasCobrasViaRenovacionBySucursalAndFecha(1L, hoy)).thenReturn(BigDecimal.ZERO);
        when(multaRepo.sumMultasCondonadasBySucursalAndFecha(1L, hoy)).thenReturn(BigDecimal.ZERO);

        List<ClienteNoPagoAutomaticoDTO> esperado = List.of(
                new ClienteNoPagoAutomaticoDTO(5L, "Juana Pérez", 42L, 5, new BigDecimal("50.00")));
        when(cobrosService.previsualizarNoPagoAutomatico(1L, hoy)).thenReturn(esperado);

        CajaCierrePreviewDTO preview = service.getPreviewCierre(1L, principal);

        assertThat(preview.clientesSinRegistro()).isEqualTo(esperado);
        assertThat(preview.subtotalRetiros()).isEqualByComparingTo("-150.00");
        // subtotalCaja = montoApertura(1000.00) + ingresos(0) − desembolsos(0) + inversiones(0) + retiros(-150.00)
        assertThat(preview.subtotalCaja()).isEqualByComparingTo("850.00");
    }
```

Also update `cerrar_marcaNoPagoAutomaticoAntesDeCalcularElResumen`'s stub from `movimientoRepo.sumMontoByCajaDiaId(500L)` — leave that one as-is, `cerrar()` keeps using the unfiltered sum (see Step 3 below, `cerrar()` is unchanged).

Add the import at the top of the test file:

```java
import com.magno.model.TipoMovimientoCaja;
```

(`import com.magno.model.*;` is already present — check before adding a duplicate.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && mvn -Dtest=CajaServiceTest#getPreviewCierre_incluyeClientesSinRegistro test`
Expected: FAIL — `movimientoRepo.sumMontoByCajaDiaIdAndTipo(...)` is stubbed but never called; `getPreviewCierre` still calls the unfiltered `sumMontoByCajaDiaId`, and `CajaCierrePreviewDTO` has no `subtotalRetiros()` accessor (compile error until the DTO changes in Step 3).

- [ ] **Step 3: Add `subtotalRetiros` to `CajaCierrePreviewDTO`**

In `backend/src/main/java/com/magno/dto/caja/CajaCierrePreviewDTO.java`, insert the new field right after `subtotalInversiones`:

```java
        // Inversiones — solo el subtotal; el detalle está en /inversiones
        BigDecimal subtotalInversiones,

        // Retiros — solo el subtotal; el detalle está en /retiros
        BigDecimal subtotalRetiros,
```

- [ ] **Step 4: Update `getPreviewCierre` in `CajaService.java`**

Replace the single-line calculation:

```java
                BigDecimal subtotalInversiones = movimientoRepo.sumMontoByCajaDiaId(caja.getId());
```

with:

```java
                BigDecimal subtotalInversiones = movimientoRepo
                                .sumMontoByCajaDiaIdAndTipo(caja.getId(), TipoMovimientoCaja.INVERSION);
                BigDecimal subtotalRetiros = movimientoRepo
                                .sumMontoByCajaDiaIdAndTipo(caja.getId(), TipoMovimientoCaja.RETIRO);
```

Replace the `subtotalCaja` calculation:

```java
                BigDecimal subtotalCaja = caja.getMontoApertura()
                                .add(totalIngresoCarteras)
                                .subtract(totalDesembolsos)
                                .add(subtotalInversiones);
```

with:

```java
                BigDecimal subtotalCaja = caja.getMontoApertura()
                                .add(totalIngresoCarteras)
                                .subtract(totalDesembolsos)
                                .add(subtotalInversiones)
                                .add(subtotalRetiros);
```

Update the `CajaCierrePreviewDTO` constructor call to pass `subtotalRetiros` right after `subtotalInversiones`:

```java
                return new CajaCierrePreviewDTO(
                                caja.getId(),
                                caja.getMontoApertura(),
                                subtotalInversiones,
                                subtotalRetiros,
                                cobrosPorAsesor,
                                totalIngresoCarteras,
                                desembolsosNuevos,
                                desembolsosRenovaciones,
                                totalDesembolsos,
                                subtotalCaja,
                                config.getPorcentajeAhorro(),
                                montoLibres,
                                total,
                                ahorroFijo,
                                totalGastos,
                                totalNomina,
                                totalRealLibres,
                                multasPorAsesor,
                                totalMultas,
                                multasCobrasRenovaciones,
                                totalMultasCondonadas,
                                clientesSinRegistro);
```

- [ ] **Step 5: Run the full test class to verify it passes**

Run: `cd backend && mvn -Dtest=CajaServiceTest test`
Expected: PASS (all tests, including `cerrar_marcaNoPagoAutomaticoAntesDeCalcularElResumen`, which is unaffected since `cerrar()` wasn't touched)

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/magno/dto/caja/CajaCierrePreviewDTO.java backend/src/main/java/com/magno/service/CajaService.java backend/src/test/java/com/magno/service/CajaServiceTest.java
git commit -m "feat: desglosar subtotalRetiros en el preview de cierre de caja"
```

---

## Task 9: `CajaDiaDetalleDTO` — add `retiros` list

This covers `abrir`, `cerrar`, `cancelarCierre`, and `getHistorial`, all of which build a `CajaDiaDetalleDTO` through the shared `toDetalleDTO` helper.

**Files:**
- Modify: `backend/src/main/java/com/magno/dto/caja/CajaDiaDetalleDTO.java`
- Modify: `backend/src/main/java/com/magno/service/CajaService.java`

- [ ] **Step 1: Add `retiros` to the DTO**

In `backend/src/main/java/com/magno/dto/caja/CajaDiaDetalleDTO.java`, add the field after `inversiones`:

```java
        List<MovimientoInversionDTO> inversiones,
        List<RetiroDTO> retiros
) {}
```

- [ ] **Step 2: Update `toDetalleDTO` to accept and pass through `retiros`**

In `backend/src/main/java/com/magno/service/CajaService.java`, change the helper signature and constructor call:

```java
        private CajaDiaDetalleDTO toDetalleDTO(CajaDia c, List<MovimientoInversionDTO> inversiones,
                        List<RetiroDTO> retiros) {
                return new CajaDiaDetalleDTO(
                                c.getId(),
                                c.getSucursal().getId(),
                                c.getSucursal().getNombre(),
                                c.getFecha(),
                                c.getEstado().name(),
                                c.getMontoApertura(),
                                c.getConceptoApertura(),
                                c.getAbiertaPor().getId(),
                                c.getAbiertaPor().getNombreCompleto(),
                                c.getFechaHoraApertura(),
                                c.getCerradaPor() != null ? c.getCerradaPor().getId() : null,
                                c.getCerradaPor() != null ? c.getCerradaPor().getNombreCompleto() : null,
                                c.getFechaHoraCierre(),
                                c.getIngresoCarteras(),
                                c.getDesembolsos(),
                                c.getSubtotalCaja(),
                                c.getMontoLibres(),
                                calcularTotal(c.getSubtotalCaja(), c.getMontoLibres()),
                                c.getAhorroFijo(),
                                c.getTotalGastos(),
                                c.getTotalNomina(),
                                c.getTotalRealLibres(),
                                inversiones,
                                retiros);
        }
```

Add a `toRetiroDTO` helper next to the existing `toMovimientoDTO`:

```java
        private RetiroDTO toRetiroDTO(CajaMovimientoInversion m) {
                return new RetiroDTO(
                                m.getId(),
                                m.getMonto(),
                                m.getJustificacion(),
                                m.getRegistradoPor().getId(),
                                m.getRegistradoPor().getNombreCompleto(),
                                m.getCreatedAt());
        }
```

- [ ] **Step 3: Update the 4 call sites**

In `abrir()` — change the return statement:

```java
                return toDetalleDTO(cajaDiaRepo.save(caja), List.of(), List.of());
```

In `cerrar()` — change the `inversiones` fetch to filter by `INVERSION` and add a `retiros` fetch:

```java
                CajaDia saved = cajaDiaRepo.save(caja);
                List<MovimientoInversionDTO> inversiones = movimientoRepo
                                .findByCajaDiaIdAndTipoOrderByCreatedAtAsc(saved.getId(), TipoMovimientoCaja.INVERSION)
                                .stream().map(this::toMovimientoDTO).toList();
                List<RetiroDTO> retiros = movimientoRepo
                                .findByCajaDiaIdAndTipoOrderByCreatedAtAsc(saved.getId(), TipoMovimientoCaja.RETIRO)
                                .stream().map(this::toRetiroDTO).toList();
                return toDetalleDTO(saved, inversiones, retiros);
```

In `cancelarCierre()` — same pattern:

```java
                CajaDia saved = cajaDiaRepo.save(caja);
                List<MovimientoInversionDTO> inversiones = movimientoRepo
                                .findByCajaDiaIdAndTipoOrderByCreatedAtAsc(saved.getId(), TipoMovimientoCaja.INVERSION)
                                .stream().map(this::toMovimientoDTO).toList();
                List<RetiroDTO> retiros = movimientoRepo
                                .findByCajaDiaIdAndTipoOrderByCreatedAtAsc(saved.getId(), TipoMovimientoCaja.RETIRO)
                                .stream().map(this::toRetiroDTO).toList();
                return toDetalleDTO(saved, inversiones, retiros);
```

In `getHistorial()` — same pattern:

```java
                List<MovimientoInversionDTO> inversiones = movimientoRepo
                                .findByCajaDiaIdAndTipoOrderByCreatedAtAsc(caja.getId(), TipoMovimientoCaja.INVERSION)
                                .stream().map(this::toMovimientoDTO).toList();
                List<RetiroDTO> retiros = movimientoRepo
                                .findByCajaDiaIdAndTipoOrderByCreatedAtAsc(caja.getId(), TipoMovimientoCaja.RETIRO)
                                .stream().map(this::toRetiroDTO).toList();
                return toDetalleDTO(caja, inversiones, retiros);
```

- [ ] **Step 4: Update `cerrar_marcaNoPagoAutomaticoAntesDeCalcularElResumen` test stub**

In `backend/src/test/java/com/magno/service/CajaServiceTest.java`, the existing stub:

```java
        when(movimientoRepo.findByCajaDiaIdOrderByCreatedAtAsc(500L)).thenReturn(List.of());
```

becomes two stubs:

```java
        when(movimientoRepo.findByCajaDiaIdAndTipoOrderByCreatedAtAsc(500L, TipoMovimientoCaja.INVERSION))
                .thenReturn(List.of());
        when(movimientoRepo.findByCajaDiaIdAndTipoOrderByCreatedAtAsc(500L, TipoMovimientoCaja.RETIRO))
                .thenReturn(List.of());
```

Also add these two stubs (unfiltered `sumMontoByCajaDiaId(500L)` stays for `cerrar()`'s subtotal calc — unchanged):

```java
        when(movimientoRepo.sumMontoByCajaDiaId(500L)).thenReturn(BigDecimal.ZERO);
```

(already present in the test — no change needed there, just confirming it stays.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && mvn -Dtest=CajaServiceTest test`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/magno/dto/caja/CajaDiaDetalleDTO.java backend/src/main/java/com/magno/service/CajaService.java backend/src/test/java/com/magno/service/CajaServiceTest.java
git commit -m "feat: incluir lista de retiros en CajaDiaDetalleDTO"
```

---

## Task 10: PDF del corte individual — sección RETIROS

**Files:**
- Modify: `backend/src/main/java/com/magno/service/CajaService.java:397-526` (`exportarPdf`)

- [ ] **Step 1: Filter the existing inversiones fetch and add a retiros fetch**

Replace:

```java
                List<MovimientoInversionDTO> inversiones = movimientoRepo
                                .findByCajaDiaIdOrderByCreatedAtAsc(cajaId)
                                .stream().map(this::toMovimientoDTO).toList();
```

with:

```java
                List<MovimientoInversionDTO> inversiones = movimientoRepo
                                .findByCajaDiaIdAndTipoOrderByCreatedAtAsc(cajaId, TipoMovimientoCaja.INVERSION)
                                .stream().map(this::toMovimientoDTO).toList();
                List<RetiroDTO> retiros = movimientoRepo
                                .findByCajaDiaIdAndTipoOrderByCreatedAtAsc(cajaId, TipoMovimientoCaja.RETIRO)
                                .stream().map(this::toRetiroDTO).toList();
```

- [ ] **Step 2: Add the RETIROS section right after the INVERSIONES section**

Insert immediately after the existing block that ends with `doc.add(new Paragraph(" "));` following the "Subtotal inversiones" paragraph (i.e. right before the `// ── Ingresos carteras` comment):

```java
                // ── Retiros ─────────────────────────────────────────────────────
                doc.add(sectionHeader("RETIROS"));
                if (retiros.isEmpty()) {
                        doc.add(new Paragraph("Sin retiros registrados").setFontSize(9).setItalic());
                } else {
                        Table tRet = new Table(UnitValue.createPercentArray(new float[] { 260, 80, 100 }))
                                        .setWidth(UnitValue.createPercentValue(100));
                        tRet.addHeaderCell(hCell("Justificación"));
                        tRet.addHeaderCell(hCell("Monto").setTextAlignment(TextAlignment.RIGHT));
                        tRet.addHeaderCell(hCell("Registrado por"));
                        BigDecimal totalRet = BigDecimal.ZERO;
                        for (RetiroDTO r : retiros) {
                                tRet.addCell(cell(r.justificacion()));
                                tRet.addCell(cell(fmtMonto(r.monto())).setTextAlignment(TextAlignment.RIGHT));
                                tRet.addCell(cell(r.registradoPorNombre()));
                                totalRet = totalRet.add(r.monto());
                        }
                        doc.add(tRet);
                        doc.add(new Paragraph("Subtotal retiros: " + fmtMonto(totalRet))
                                        .setBold().setFontSize(9).setTextAlignment(TextAlignment.RIGHT));
                }
                doc.add(new Paragraph(" "));
```

- [ ] **Step 3: Update the formula paragraph text**

Replace:

```java
                        doc.add(new Paragraph(
                                        "Apertura + Ingresos − Desembolsos + Inversiones = "
                                                        + fmtMonto(caja.getSubtotalCaja()))
                                        .setBold().setFontSize(11));
```

with:

```java
                        doc.add(new Paragraph(
                                        "Apertura + Ingresos − Desembolsos + Inversiones + Retiros = "
                                                        + fmtMonto(caja.getSubtotalCaja()))
                                        .setBold().setFontSize(11));
```

- [ ] **Step 4: Verify it compiles**

Run: `cd backend && mvn compile`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/magno/service/CajaService.java
git commit -m "feat: agregar sección RETIROS al PDF del corte de caja"
```

---

## Task 11: `ReporteService` — desglosar Retiros en Ingresos y Egresos

**Files:**
- Modify: `backend/src/main/java/com/magno/dto/reporte/FilaDiariaDTO.java`
- Modify: `backend/src/main/java/com/magno/service/ReporteService.java`
- Modify: `backend/src/test/java/com/magno/service/ReporteServiceTest.java`

- [ ] **Step 1: Extend the failing test first**

In `backend/src/test/java/com/magno/service/ReporteServiceTest.java`, update `getIngresosEgresos_conDias_sumaCorrectamente` to stub the two tipo-filtered sums (replacing the unfiltered stub) and assert the new `retiros` field on the resulting fila:

```java
        when(movimientoRepo.sumMontoByCajaDiaIdAndTipo(1L, TipoMovimientoCaja.INVERSION)).thenReturn(BigDecimal.ZERO);
        when(movimientoRepo.sumMontoByCajaDiaIdAndTipo(1L, TipoMovimientoCaja.RETIRO)).thenReturn(new BigDecimal("-50.00"));
        when(movimientoRepo.sumMontoByCajaDiaIdAndTipo(2L, TipoMovimientoCaja.INVERSION)).thenReturn(BigDecimal.ZERO);
        when(movimientoRepo.sumMontoByCajaDiaIdAndTipo(2L, TipoMovimientoCaja.RETIRO)).thenReturn(BigDecimal.ZERO);
```

(this replaces the two `when(movimientoRepo.sumMontoByCajaDiaId(...))` lines in that test)

Add an assertion right after the existing ones in that test:

```java
        assertThat(result.filas().get(0).retiros()).isEqualByComparingTo("-50.00");
```

Add the import at the top of the test file:

```java
import com.magno.model.TipoMovimientoCaja;
```

(`import com.magno.model.*;` is already present — check before adding a duplicate.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && mvn -Dtest=ReporteServiceTest#getIngresosEgresos_conDias_sumaCorrectamente test`
Expected: FAIL — `sumMontoByCajaDiaIdAndTipo` is stubbed but `getIngresosEgresos` still calls the unfiltered `sumMontoByCajaDiaId`; `FilaDiariaDTO` has no `retiros()` accessor (compile error until Step 3).

- [ ] **Step 3: Add `retiros` to `FilaDiariaDTO`**

```java
package com.magno.dto.reporte;

import java.math.BigDecimal;
import java.time.LocalDate;

public record FilaDiariaDTO(
        LocalDate fecha,
        BigDecimal ingresoCarteras,
        BigDecimal desembolsos,
        BigDecimal gastos,
        BigDecimal nomina,
        BigDecimal inversiones,
        BigDecimal retiros,
        BigDecimal subtotalCaja) {
}
```

- [ ] **Step 4: Update `getIngresosEgresos` in `ReporteService.java`**

Replace:

```java
            BigDecimal inversiones = dia != null ? coalesce(movimientoRepo.sumMontoByCajaDiaId(dia.getId())) : BigDecimal.ZERO;
```

with:

```java
            BigDecimal inversiones = dia != null
                    ? coalesce(movimientoRepo.sumMontoByCajaDiaIdAndTipo(dia.getId(), TipoMovimientoCaja.INVERSION))
                    : BigDecimal.ZERO;
            BigDecimal retiros = dia != null
                    ? coalesce(movimientoRepo.sumMontoByCajaDiaIdAndTipo(dia.getId(), TipoMovimientoCaja.RETIRO))
                    : BigDecimal.ZERO;
```

Replace the `subtotal` calculation:

```java
            BigDecimal subtotal = dia != null && dia.getSubtotalCaja() != null
                    ? dia.getSubtotalCaja()
                    : ingresos.subtract(desembolsos).subtract(gastos).subtract(nomina).add(inversiones);
```

with:

```java
            BigDecimal subtotal = dia != null && dia.getSubtotalCaja() != null
                    ? dia.getSubtotalCaja()
                    : ingresos.subtract(desembolsos).subtract(gastos).subtract(nomina).add(inversiones).add(retiros);
```

Replace the `filas.add(...)` call:

```java
            filas.add(new FilaDiariaDTO(fecha, ingresos, desembolsos, gastos, nomina, inversiones, subtotal));
```

with:

```java
            filas.add(new FilaDiariaDTO(fecha, ingresos, desembolsos, gastos, nomina, inversiones, retiros, subtotal));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && mvn -Dtest=ReporteServiceTest test`
Expected: PASS (all tests)

- [ ] **Step 6: Add the Retiros column to the PDF table**

In `backend/src/main/java/com/magno/service/ReporteService.java`, in the `exportarIngresosEgresosPdf` method (around line 329), update the table column widths and headers:

```java
        Table t = new Table(UnitValue.createPercentArray(new float[] { 60, 68, 68, 55, 55, 60, 60, 70 }))
                .setWidth(UnitValue.createPercentValue(100));
        t.addHeaderCell(hCell("Fecha"));
        t.addHeaderCell(hCell("Ing. Carteras").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Desembolsos").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Gastos").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Nómina").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Inversiones").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Retiros").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Subtotal").setTextAlignment(TextAlignment.RIGHT));

        for (FilaDiariaDTO f : datos.filas()) {
            t.addCell(cell(f.fecha().format(fmt)));
            t.addCell(cell(fmtMonto(f.ingresoCarteras())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.desembolsos())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.gastos())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.nomina())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.inversiones())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.retiros())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.subtotalCaja())).setTextAlignment(TextAlignment.RIGHT));
        }
```

- [ ] **Step 7: Verify it compiles and tests still pass**

Run: `cd backend && mvn -Dtest=ReporteServiceTest test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/magno/dto/reporte/FilaDiariaDTO.java backend/src/main/java/com/magno/service/ReporteService.java backend/src/test/java/com/magno/service/ReporteServiceTest.java
git commit -m "feat: desglosar Retiros en el reporte de Ingresos y Egresos"
```

---

## Task 12: Frontend — `retiroService.ts`

**Files:**
- Create: `frontend/src/services/retiroService.ts`

- [ ] **Step 1: Create the service (mirrors `inversionService.ts`)**

```typescript
import { api } from '@/services/api'

export interface Retiro {
  id: number
  monto: number
  justificacion: string
  registradoPorId: number
  registradoPorNombre: string
  createdAt: string
}

function normalize(raw: any): Retiro {
  return {
    id:                  raw?.id,
    monto:               Number(raw?.monto ?? 0),
    justificacion:       raw?.justificacion ?? '',
    registradoPorId:     raw?.registradoPorId,
    registradoPorNombre: raw?.registradoPorNombre ?? '',
    createdAt:           raw?.createdAt ?? '',
  }
}

export const retiroService = {
  getByDia: (cajaId: number): Promise<Retiro[]> =>
    api.get(`/retiros?cajaId=${cajaId}`).then(r => (r.data as any[]).map(normalize)),

  registrar: (cajaId: number, payload: {
    monto: number
    justificacion: string
  }): Promise<Retiro> =>
    api.post(`/retiros?cajaId=${cajaId}`, payload).then(r => normalize(r.data)),

  eliminar: (cajaId: number, retiroId: number): Promise<void> =>
    api.delete(`/retiros/${retiroId}?cajaId=${cajaId}`).then(() => undefined),
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/retiroService.ts
git commit -m "feat: agregar retiroService"
```

---

## Task 13: Frontend — `RetirosPage.tsx`

**Files:**
- Create: `frontend/src/pages/retiros/RetirosPage.tsx`

- [ ] **Step 1: Create the page (structural clone of `InversionesPage.tsx`, with monto + justificación form instead of concepto)**

```tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { cajaService } from '@/services/cajaService'
import { retiroService } from '@/services/retiroService'
import { api } from '@/services/api'
import { todayLocalStr } from '@/utils/date'

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

export default function RetirosPage() {
  const { usuario } = useAuthStore()
  const queryClient = useQueryClient()

  const isAdmin = usuario?.rol === 'ADMINISTRADOR'
  const [fecha, setFecha] = useState(todayLocalStr())
  const [adminSucursalId, setAdminSucursalId] = useState<number | null>(null)

  const efectivaSucursalId: number | undefined = isAdmin
    ? (adminSucursalId ?? undefined)
    : usuario?.sucursal?.id

  const { data: sucursales = [] } = useQuery({
    queryKey: ['sucursales-lista'],
    queryFn: () => api.get<{ id: number; nombre: string }[]>('/sucursales').then(r => r.data),
    enabled: isAdmin,
    staleTime: 300_000,
  })

  useEffect(() => {
    if (isAdmin && sucursales.length > 0 && adminSucursalId === null) {
      setAdminSucursalId(sucursales[0].id)
    }
  }, [isAdmin, sucursales, adminSucursalId])

  const isToday = fecha === todayLocalStr()

  const { data: estadoHoy } = useQuery({
    queryKey: ['caja-estado', efectivaSucursalId],
    queryFn: () => cajaService.getEstado(efectivaSucursalId),
    enabled: isToday && efectivaSucursalId !== undefined,
    staleTime: 30_000,
  })

  const { data: historialLista } = useQuery({
    queryKey: ['caja-historial-lista', efectivaSucursalId, fecha],
    queryFn: () => cajaService.getHistorialLista({ sucursalId: efectivaSucursalId, desde: fecha, hasta: fecha }),
    enabled: !isToday && efectivaSucursalId !== undefined,
    staleTime: 60_000,
  })

  const cajaId: number | null = isToday
    ? (estadoHoy?.cajaId ?? null)
    : (historialLista?.[0]?.id ?? null)

  const cajaEstado: string | null = isToday
    ? (estadoHoy?.estado ?? null)
    : (historialLista?.[0]?.estado ?? null)

  const editMode = isToday && cajaEstado === 'ABIERTA'

  const { data: retiros = [], isLoading, isError } = useQuery({
    queryKey: ['retiros', cajaId],
    queryFn: () => retiroService.getByDia(cajaId!),
    enabled: cajaId !== null,
    staleTime: 30_000,
  })

  const [showForm, setShowForm] = useState(false)
  const [monto, setMonto] = useState('')
  const [justificacion, setJustificacion] = useState('')

  const formValid = Number(monto) > 0 && justificacion.trim().length >= 10

  function resetForm() {
    setMonto('')
    setJustificacion('')
    setShowForm(false)
  }

  const registrarMut = useMutation({
    mutationFn: () => retiroService.registrar(cajaId!, {
      monto: Number(monto),
      justificacion: justificacion.trim(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiros', cajaId] })
      queryClient.invalidateQueries({ queryKey: ['caja-cierre-preview', efectivaSucursalId] })
      resetForm()
      toast.success('Retiro registrado')
    },
    onError: () => toast.error('Error al registrar el retiro'),
  })

  const eliminarMut = useMutation({
    mutationFn: (retiroId: number) => retiroService.eliminar(cajaId!, retiroId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retiros', cajaId] })
      queryClient.invalidateQueries({ queryKey: ['caja-cierre-preview', efectivaSucursalId] })
      toast.success('Retiro eliminado')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const total = retiros.reduce((s, r) => s + r.monto, 0)

  return (
    <div className="page-container space-y-4">
      <h1 className="page-title">Retiros de Caja</h1>

      {/* Filtros */}
      <div className="card card-body">
        <div className="flex flex-wrap gap-3">
          {isAdmin && (
            <div className="flex-1 min-w-[160px]">
              <label className="text-[12px] font-medium text-[#495057] block mb-1">Sucursal</label>
              <select
                className="input"
                value={adminSucursalId ?? ''}
                onChange={e => setAdminSucursalId(Number(e.target.value))}
              >
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1 min-w-[140px]">
            <label className="text-[12px] font-medium text-[#495057] block mb-1">Fecha</label>
            <input
              type="date"
              className="input"
              value={fecha}
              max={todayLocalStr()}
              onChange={e => setFecha(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Banner estado caja */}
      {cajaId !== null && cajaEstado && (
        <div className={`rounded-lg px-4 py-2 text-[13px] font-medium flex items-center gap-2 ${
          cajaEstado === 'ABIERTA'
            ? 'bg-[#d1fae5] text-[#065f46]'
            : 'bg-[#f3f4f6] text-[#6b7280]'
        }`}>
          <span className={`w-2 h-2 rounded-full inline-block ${
            cajaEstado === 'ABIERTA' ? 'bg-[#10b981]' : 'bg-[#9ca3af]'
          }`} />
          {cajaEstado === 'ABIERTA'
            ? 'Caja abierta — puedes registrar retiros'
            : `Caja ${cajaEstado.toLowerCase()}`}
        </div>
      )}

      {/* Sin caja */}
      {cajaId === null && !isLoading && efectivaSucursalId !== undefined && (
        <div className="alert alert-warning flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No hay caja registrada para esta fecha.
        </div>
      )}

      {/* Tabla principal */}
      {cajaId !== null && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Retiros del día</h2>
            {editMode && !showForm && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setShowForm(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                Retirar dinero
              </button>
            )}
          </div>
          <div className="card-body space-y-4">
            {/* Formulario de alta */}
            {showForm && (
              <form
                onSubmit={e => { e.preventDefault(); if (formValid) registrarMut.mutate() }}
                className="p-3 bg-[#f8f9fa] rounded-lg border border-[#dee2e6] space-y-3"
              >
                <div>
                  <label className="block text-[12px] font-medium text-[#495057] mb-1">
                    Monto ($) <span className="text-[#dc2626]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="input"
                    placeholder="0.00"
                    value={monto}
                    onChange={e => setMonto(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#495057] mb-1">
                    Justificación <span className="text-[#dc2626]">*</span>
                  </label>
                  <textarea
                    className="input w-full"
                    rows={3}
                    placeholder="Explica por qué se retira este dinero (mínimo 10 caracteres)"
                    value={justificacion}
                    onChange={e => setJustificacion(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn btn-sm" onClick={resetForm}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary"
                    disabled={!formValid || registrarMut.isPending}
                  >
                    {registrarMut.isPending ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
            )}

            {/* Lista */}
            {isLoading ? (
              <p className="text-[13px] text-[#6c757d]">Cargando…</p>
            ) : isError ? (
              <p className="text-[13px] text-[#dc2626]">Error al cargar los retiros</p>
            ) : retiros.length === 0 ? (
              <p className="text-[13px] text-[#adb5bd] text-center py-4">
                Sin retiros registrados
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Justificación</th>
                      <th className="text-right">Monto</th>
                      <th>Registrado por</th>
                      <th>Hora</th>
                      {editMode && <th className="w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {retiros.map(r => (
                      <tr key={r.id}>
                        <td className="font-medium">{r.justificacion}</td>
                        <td className="text-right font-mono text-[#dc2626]">
                          {fmtMoney(r.monto)}
                        </td>
                        <td className="text-[#6c757d]">{r.registradoPorNombre}</td>
                        <td className="text-[#6c757d]">{fmtTime(r.createdAt)}</td>
                        {editMode && (
                          <td>
                            <button
                              type="button"
                              className="text-[#adb5bd] hover:text-[#dc2626] transition-colors"
                              onClick={() => {
                                if (window.confirm('¿Eliminar este retiro?')) {
                                  eliminarMut.mutate(r.id)
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Subtotal */}
            {retiros.length > 0 && (
              <div className="text-right text-[13px]">
                <span className="text-[#6c757d]">Subtotal retiros: </span>
                <span className="font-semibold font-mono text-[#dc2626]">
                  {fmtMoney(total)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/retiros/RetirosPage.tsx
git commit -m "feat: agregar página RetirosPage"
```

---

## Task 14: Frontend — Sidebar, ruta, y tipo `CajaCierrePreview`

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/services/cajaService.ts`

- [ ] **Step 1: Add the sidebar entry**

In `frontend/src/components/Sidebar.tsx`, add `Banknote` to the lucide-react import (line 6):

```tsx
import {
  LayoutDashboard, CreditCard, Wallet, RefreshCw, Users, History,
  Archive, Receipt, BarChart2, Building2, UserCog, Settings, X,
  CalendarDays, TrendingUp, Banknote,
} from 'lucide-react'
```

Add the nav item in the `Finanzas` section, between `Gastos` and `Inversiones`:

```tsx
      { label: 'Caja',     to: '/caja',     icon: Archive,  roles: ['ADMINISTRADOR','SUPERVISOR'] },
      { label: 'Gastos',      to: '/gastos',      icon: Receipt,     roles: ['ADMINISTRADOR','SUPERVISOR'] },
      { label: 'Retiros',     to: '/retiros',     icon: Banknote,    roles: ['ADMINISTRADOR','SUPERVISOR'] },
      { label: 'Inversiones', to: '/inversiones', icon: TrendingUp,  roles: ['ADMINISTRADOR','SUPERVISOR'] },
      { label: 'Reportes',    to: '/reportes',    icon: BarChart2,   roles: ['ADMINISTRADOR','SUPERVISOR'] },
```

- [ ] **Step 2: Add the route**

In `frontend/src/App.tsx`, add the import next to the other Caja-related page imports:

```tsx
import RetirosPage from '@/pages/retiros/RetirosPage'
```

Add the route next to the `/gastos`/`/inversiones` routes:

```tsx
              <Route path="/gastos" element={<GastosPage />} />
              <Route path="/retiros" element={<RetirosPage />} />
              <Route path="/inversiones" element={<InversionesPage />} />
```

- [ ] **Step 3: Add `subtotalRetiros` to the `CajaCierrePreview` type and mapping**

In `frontend/src/services/cajaService.ts`, add the field to the interface right after `subtotalInversiones`:

```typescript
export interface CajaCierrePreview {
  cajaId: number
  montoApertura: number
  subtotalInversiones: number
  subtotalRetiros: number
  cobrosPorAsesor: CobroAsesorItem[]
  ...
```

Add the mapping right after `subtotalInversiones` in `getPreviewCierre`:

```typescript
           subtotalInversiones:       Number(d.subtotalInversiones ?? 0),
           subtotalRetiros:           Number(d.subtotalRetiros ?? 0),
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/App.tsx frontend/src/services/cajaService.ts
git commit -m "feat: agregar navegación y tipo de Retiros al frontend"
```

---

## Task 15: Frontend — línea "Retiros" en el preview de cierre

**Files:**
- Modify: `frontend/src/pages/caja/CajaCierrePage.tsx`

- [ ] **Step 1: Add the Retiros line right after the Inversiones line**

Find the block (around line 369-378):

```tsx
              {preview.subtotalInversiones !== 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6c757d]">
                    {preview.subtotalInversiones >= 0 ? '+' : '−'} Inversiones
                  </span>
                  <span className={`font-mono ${preview.subtotalInversiones < 0 ? 'text-[#dc2626]' : ''}`}>
                    {fmtMoney(preview.subtotalInversiones)}
                  </span>
                </div>
              )}
```

Add immediately after it:

```tsx
              {preview.subtotalRetiros !== 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6c757d]">− Retiros</span>
                  <span className="font-mono text-[#dc2626]">
                    {fmtMoney(preview.subtotalRetiros)}
                  </span>
                </div>
              )}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/caja/CajaCierrePage.tsx
git commit -m "feat: mostrar subtotal de retiros en el preview de cierre de caja"
```

---

## Task 16: Frontend — columna "Retiros" en el reporte de Ingresos y Egresos

**Files:**
- Modify: `frontend/src/services/reporteService.ts`
- Modify: `frontend/src/pages/reportes/TabIngresosEgresos.tsx`

- [ ] **Step 1: Add `retiros` to the `FilaDiaria` type**

In `frontend/src/services/reporteService.ts`:

```typescript
export interface FilaDiaria {
  fecha: string
  ingresoCarteras: number
  desembolsos: number
  gastos: number
  nomina: number
  inversiones: number
  retiros: number
  subtotalCaja: number
}
```

(No changes needed to `getIngresosEgresos` itself — the generic `norm()` snake_case→camelCase converter already picks up the new backend field automatically.)

- [ ] **Step 2: Add the column to the table**

In `frontend/src/pages/reportes/TabIngresosEgresos.tsx`, add a header cell after "Inversiones" (around line 106):

```tsx
                    <th className="px-4 py-3 text-right">Inversiones</th>
                    <th className="px-4 py-3 text-right">Retiros</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
```

Add the matching data cell after the Inversiones cell in the row map (around line 122):

```tsx
                      <td className="px-4 py-3 text-right text-gray-600">{fmt(f.inversiones)}</td>
                      <td className="px-4 py-3 text-right text-red-700">{fmt(f.retiros)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmt(f.subtotalCaja)}</td>
```

Add a `—` placeholder cell in the totals `<tfoot>` row (around line 134, next to the existing Inversiones `—` cell):

```tsx
                    <td className="px-4 py-3 text-right">—</td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className={`px-4 py-3 text-right ${neto < 0 ? 'text-red-700' : ''}`}>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/reporteService.ts frontend/src/pages/reportes/TabIngresosEgresos.tsx
git commit -m "feat: agregar columna Retiros al reporte de Ingresos y Egresos"
```

---

## Task 17: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run: `cd backend && mvn test`
Expected: BUILD SUCCESS, all tests pass (including the new `InversionServiceTest` and `RetiroServiceTest`).

- [ ] **Step 2: Start the backend and frontend dev servers**

Run backend: `cd backend && mvn spring-boot:run` (background)
Run frontend: `cd frontend && npm run dev` (background)

- [ ] **Step 3: Walk through the flow in the browser as ADMINISTRADOR or SUPERVISOR**

1. Open a caja for today if none is open (`/caja`).
2. Go to `/retiros` — confirm the sidebar shows "Retiros" between Gastos and Inversiones.
3. Click "Retirar dinero", try submitting with a justificación under 10 characters — confirm it's rejected (button disabled) or the backend returns 400.
4. Submit a valid retiro (e.g. $300, justificación "Pago de proveedor urgente") — confirm it appears in the table with a red/negative amount.
5. Go to `/inversiones` — confirm the retiro does **not** appear there (only real inversiones do).
6. Go to `/caja/cierre` — confirm the preview shows a separate "− Retiros" line distinct from "+ Inversiones".
7. Close the caja and download the PDF — confirm it has a "RETIROS" section separate from "INVERSIONES", and the formula line mentions both.
8. Go to `/reportes` → "Ingresos y Egresos" for a date range including today — confirm the table has a distinct "Retiros" column with a negative value on today's row.
9. Log in as `SUPERVISOR_CAMPO` or `ASESOR_COBRADOR` — confirm "Retiros" does not appear in the sidebar (same as Gastos/Inversiones today).

- [ ] **Step 4: Report results**

If any step fails, fix the underlying issue and re-run the relevant backend test class before re-testing manually. Do not mark this task complete until all 9 sub-checks in Step 3 pass.

---

## Self-Review Notes

**Spec coverage:** Section 2 (modelo de datos) → Tasks 1–2. Section 3 (backend) → Tasks 3–7. Section 4 (frontend) → Tasks 12–14. Section 5 (impacto en cierre y reportes) → Tasks 8–11, 15–16. Section 6 (testing) → covered inline via TDD steps in Tasks 4, 6, 8, 9, 11; the explicit role-permission test was descoped per user decision (no controller-test precedent in the repo — see spec Task 7 note) in favor of relying on the same untested `@PreAuthorize` pattern already used by `InversionController`/`GastoController`. Migration backfill safety (Section 6 bullet) is covered by Task 1 Step 3, which runs the full Spring context (including Liquibase) against the test datasource.

**Type consistency:** `RetiroDTO(id, monto, justificacion, registradoPorId, registradoPorNombre, createdAt)` is used identically in `RetiroService.toDTO`, `RetiroController`, `retiroService.ts`'s `Retiro` interface, and `CajaService.toRetiroDTO`/`CajaDiaDetalleDTO.retiros`. `TipoMovimientoCaja.{INVERSION,RETIRO}` names match across the entity, repository methods, and all call sites in `CajaService`/`InversionService`/`RetiroService`/`ReporteService`.
