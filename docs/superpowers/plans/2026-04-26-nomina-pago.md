# Nómina Pago — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar el pago semanal de nómina vinculado a la caja, con deducción automática en el corte y reflejo en el PDF.

**Architecture:** Nueva tabla `nomina_pago` (un registro por caja abierta) + columna `total_nomina` en `caja_dia` que se fija al cerrar. El patrón replica exactamente el de `gasto`/`total_gastos`. Tres nuevos endpoints REST bajo `/api/caja/{cajaDiaId}/nomina`. En el frontend: componente `SeccionNomina` en `CajaPage` y nueva línea de deducción en `CajaCierrePage`.

**Tech Stack:** Spring Boot 3 / Java 17 / JPA + Lombok / Flyway (Liquibase) / React 18 + TypeScript + TanStack Query / Tailwind CSS

---

## File Map

| Archivo | Acción |
|---|---|
| `backend/src/main/resources/db/changelog/V23__nomina_pago.sql` | Crear |
| `backend/.../model/NominaPago.java` | Crear |
| `backend/.../repository/NominaPagoRepository.java` | Crear |
| `backend/.../model/CajaDia.java` | Modificar — agregar `totalNomina` |
| `backend/.../dto/caja/NominaPagoDTO.java` | Crear |
| `backend/.../dto/caja/NominaEstadoDTO.java` | Crear |
| `backend/.../dto/caja/CajaCierrePreviewDTO.java` | Modificar — agregar `totalNomina` |
| `backend/.../dto/caja/CajaDiaDetalleDTO.java` | Modificar — agregar `totalNomina` |
| `backend/.../service/NominaCajaService.java` | Crear |
| `backend/.../controller/NominaCajaController.java` | Crear |
| `backend/.../service/CajaService.java` | Modificar — cerrar, cancelarCierre, preview, PDF, toDetalleDTO |
| `frontend/src/services/cajaService.ts` | Modificar — tipos + llamadas nómina |
| `frontend/src/pages/caja/CajaPage.tsx` | Modificar — SeccionNomina |
| `frontend/src/pages/caja/CajaCierrePage.tsx` | Modificar — línea nómina |

---

## Task 1: Migración V23

**Files:**
- Create: `backend/src/main/resources/db/changelog/V23__nomina_pago.sql`

- [ ] **Step 1: Crear el archivo SQL**

```sql
-- =============================================================
-- MAGNO — V23: nomina_pago
--
-- Registra el pago semanal de nómina vinculado a un día de caja.
-- total_nomina en caja_dia: snapshot al momento del cierre
-- (mismo patrón que total_gastos — nullable, se fija al cerrar).
-- =============================================================

-- Columna en caja_dia (nullable, se fija al cerrar igual que total_gastos)
ALTER TABLE caja_dia
    ADD COLUMN total_nomina DECIMAL(12,2);

-- Tabla de registro de pagos de nómina
CREATE TABLE nomina_pago (
    id              BIGSERIAL       PRIMARY KEY,
    caja_dia_id     BIGINT          NOT NULL REFERENCES caja_dia(id),
    sucursal_id     BIGINT          NOT NULL REFERENCES sucursales(id),
    total_pagado    DECIMAL(12,2)   NOT NULL CHECK (total_pagado > 0),
    registrado_por  BIGINT          NOT NULL REFERENCES usuarios(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- Índice parcial: garantiza un solo pago activo por día de caja
CREATE UNIQUE INDEX uq_nomina_pago_caja_dia_activo
    ON nomina_pago(caja_dia_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_nomina_pago_caja_dia
    ON nomina_pago(caja_dia_id);
```

- [ ] **Step 2: Arrancar la app para verificar que la migración aplica**

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```
Expected: `Flyway: Successfully applied 1 migration to schema "public"` en los logs. Sin errores de startup.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/changelog/V23__nomina_pago.sql
git commit -m "feat: add V23 nomina_pago migration"
```

---

## Task 2: Entidad NominaPago + Repository + actualizar CajaDia

**Files:**
- Create: `backend/src/main/java/com/magno/model/NominaPago.java`
- Create: `backend/src/main/java/com/magno/repository/NominaPagoRepository.java`
- Modify: `backend/src/main/java/com/magno/model/CajaDia.java`

- [ ] **Step 1: Crear `NominaPago.java`**

```java
package com.magno.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "nomina_pago")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"cajaDia", "registradoPor"})
public class NominaPago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "caja_dia_id", nullable = false)
    private CajaDia cajaDia;

    @Column(name = "sucursal_id", nullable = false)
    private Long sucursalId;

    @Column(name = "total_pagado", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPagado;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registrado_por", nullable = false)
    private Usuario registradoPor;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @PrePersist
    void prePersist() {
        createdAt = OffsetDateTime.now();
    }
}
```

- [ ] **Step 2: Crear `NominaPagoRepository.java`**

```java
package com.magno.repository;

import com.magno.model.NominaPago;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NominaPagoRepository extends JpaRepository<NominaPago, Long> {

    @Query("SELECT n FROM NominaPago n JOIN FETCH n.registradoPor WHERE n.cajaDia.id = :cajaDiaId AND n.deletedAt IS NULL")
    Optional<NominaPago> findActiveByCajaDiaId(@Param("cajaDiaId") Long cajaDiaId);
}
```

- [ ] **Step 3: Agregar `totalNomina` a `CajaDia.java`**

Añadir el campo **después** del campo `totalGastos` existente (línea ~69 del archivo original):

```java
    @Column(name = "total_nomina", precision = 12, scale = 2)
    private BigDecimal totalNomina;
```

Y en `cancelarCierre`, agregar `caja.setTotalNomina(null);` junto a los demás nulls (se hará en Task 6).

- [ ] **Step 4: Compilar**

```bash
mvn compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/magno/model/NominaPago.java \
        backend/src/main/java/com/magno/repository/NominaPagoRepository.java \
        backend/src/main/java/com/magno/model/CajaDia.java
git commit -m "feat: add NominaPago entity, repository, and totalNomina field in CajaDia"
```

---

## Task 3: DTOs

**Files:**
- Create: `backend/src/main/java/com/magno/dto/caja/NominaPagoDTO.java`
- Create: `backend/src/main/java/com/magno/dto/caja/NominaEstadoDTO.java`
- Modify: `backend/src/main/java/com/magno/dto/caja/CajaCierrePreviewDTO.java`
- Modify: `backend/src/main/java/com/magno/dto/caja/CajaDiaDetalleDTO.java`

- [ ] **Step 1: Crear `NominaPagoDTO.java`**

```java
package com.magno.dto.caja;

import com.magno.model.NominaPago;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record NominaPagoDTO(
        Long id,
        BigDecimal totalPagado,
        String registradoPorNombre,
        OffsetDateTime createdAt
) {
    public static NominaPagoDTO from(NominaPago n) {
        return new NominaPagoDTO(
                n.getId(),
                n.getTotalPagado(),
                n.getRegistradoPor().getNombreCompleto(),
                n.getCreatedAt());
    }
}
```

- [ ] **Step 2: Crear `NominaEstadoDTO.java`**

```java
package com.magno.dto.caja;

import com.magno.dto.admin.NominaPersonalDTO;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record NominaEstadoDTO(
        boolean esDiaEfectivo,
        LocalDate diaEfectivo,
        List<NominaPersonalDTO> personal,
        BigDecimal totalCalculado,
        NominaPagoDTO pago
) {}
```

- [ ] **Step 3: Actualizar `CajaCierrePreviewDTO.java`**

Reemplazar el record completo para agregar `totalNomina` después de `totalGastos`:

```java
package com.magno.dto.caja;

import java.math.BigDecimal;
import java.util.List;

public record CajaCierrePreviewDTO(
        Long cajaId,
        BigDecimal montoApertura,
        BigDecimal subtotalInversiones,
        List<CobroAsesorItemDTO> cobrosPorAsesor,
        BigDecimal totalIngresoCarteras,
        BigDecimal desembolsosCreditosNuevos,
        BigDecimal desembolsosRenovaciones,
        BigDecimal totalDesembolsos,
        BigDecimal subtotalCaja,
        BigDecimal porcentajeAhorro,
        BigDecimal montoLibres,
        BigDecimal ahorroFijo,
        BigDecimal totalGastos,
        BigDecimal totalNomina,
        BigDecimal totalRealLibres,
        List<MultaAsesorItemDTO> multasPorAsesor,
        BigDecimal totalMultasCobradas
) {}
```

- [ ] **Step 4: Actualizar `CajaDiaDetalleDTO.java`**

Agregar `totalNomina` después de `totalGastos`:

```java
package com.magno.dto.caja;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record CajaDiaDetalleDTO(
        Long id,
        Long sucursalId,
        String sucursalNombre,
        LocalDate fecha,
        String estado,
        BigDecimal montoApertura,
        String conceptoApertura,
        Long abiertaPorId,
        String abiertaPorNombre,
        OffsetDateTime fechaHoraApertura,
        Long cerradaPorId,
        String cerradaPorNombre,
        OffsetDateTime fechaHoraCierre,
        BigDecimal ingresoCarteras,
        BigDecimal desembolsos,
        BigDecimal subtotalCaja,
        BigDecimal montoLibres,
        BigDecimal ahorroFijo,
        BigDecimal totalGastos,
        BigDecimal totalNomina,
        BigDecimal totalRealLibres,
        List<MovimientoInversionDTO> inversiones
) {}
```

- [ ] **Step 5: Compilar**

```bash
mvn compile -q
```
Expected: BUILD SUCCESS (habrá errores de compilación en `CajaService` porque el DTO cambió — se corrigen en Task 6)

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/magno/dto/caja/
git commit -m "feat: add NominaPagoDTO, NominaEstadoDTO; update CajaCierrePreviewDTO and CajaDiaDetalleDTO with totalNomina"
```

---

## Task 4: NominaCajaService

**Files:**
- Create: `backend/src/main/java/com/magno/service/NominaCajaService.java`
- Create: `backend/src/test/java/com/magno/service/NominaCajaServiceTest.java`

- [ ] **Step 1: Crear `NominaCajaService.java`**

```java
package com.magno.service;

import com.magno.dto.admin.NominaPersonalDTO;
import com.magno.dto.caja.NominaEstadoDTO;
import com.magno.dto.caja.NominaPagoDTO;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.util.DateTimeUtils;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class NominaCajaService {

    private final CajaDiaRepository cajaDiaRepo;
    private final NominaPagoRepository nominaPagoRepo;
    private final NominaPersonalRepository nominaPersonalRepo;
    private final ConfigSucursalRepository configSucursalRepo;
    private final DiaFestivoRepository diaFestivoRepo;
    private final UsuarioRepository usuarioRepo;

    public NominaCajaService(CajaDiaRepository cajaDiaRepo,
                             NominaPagoRepository nominaPagoRepo,
                             NominaPersonalRepository nominaPersonalRepo,
                             ConfigSucursalRepository configSucursalRepo,
                             DiaFestivoRepository diaFestivoRepo,
                             UsuarioRepository usuarioRepo) {
        this.cajaDiaRepo = cajaDiaRepo;
        this.nominaPagoRepo = nominaPagoRepo;
        this.nominaPersonalRepo = nominaPersonalRepo;
        this.configSucursalRepo = configSucursalRepo;
        this.diaFestivoRepo = diaFestivoRepo;
        this.usuarioRepo = usuarioRepo;
    }

    // ── Consulta ──────────────────────────────────────────────────────────

    public NominaEstadoDTO getEstado(Long cajaDiaId) {
        CajaDia caja = cajaDiaRepo.findById(cajaDiaId)
                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaDiaId));

        Long sucursalId = caja.getSucursal().getId();
        LocalDate diaEfectivo = calcularDiaEfectivo(sucursalId);
        boolean esDiaEfectivo = DateTimeUtils.hoyEnMagno().equals(diaEfectivo);

        List<NominaPersonalDTO> personal = nominaPersonalRepo
                .findBySucursalIdAndDeletedAtIsNullOrderByNombreAsc(sucursalId)
                .stream()
                .map(NominaPersonalDTO::from)
                .toList();

        BigDecimal totalCalculado = personal.stream()
                .map(NominaPersonalDTO::montoSemanal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        NominaPagoDTO pago = nominaPagoRepo.findActiveByCajaDiaId(cajaDiaId)
                .map(NominaPagoDTO::from)
                .orElse(null);

        return new NominaEstadoDTO(esDiaEfectivo, diaEfectivo, personal, totalCalculado, pago);
    }

    // ── Registro ──────────────────────────────────────────────────────────

    @Transactional
    public NominaPagoDTO registrarPago(Long cajaDiaId, Long usuarioId) {
        CajaDia caja = cajaDiaRepo.findById(cajaDiaId)
                .orElseThrow(() -> new EntityNotFoundException("Caja no encontrada: " + cajaDiaId));

        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException("Solo se puede registrar la nómina con la caja abierta");
        }

        Long sucursalId = caja.getSucursal().getId();
        LocalDate diaEfectivo = calcularDiaEfectivo(sucursalId);

        if (!DateTimeUtils.hoyEnMagno().equals(diaEfectivo)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Hoy no es el día efectivo de pago de nómina (" + diaEfectivo + ")");
        }

        if (nominaPagoRepo.findActiveByCajaDiaId(cajaDiaId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ya se registró el pago de nómina para esta caja");
        }

        List<NominaPersonal> personal = nominaPersonalRepo
                .findBySucursalIdAndDeletedAtIsNullOrderByNombreAsc(sucursalId);

        if (personal.isEmpty()) {
            throw new IllegalArgumentException("No hay personal registrado en la sucursal");
        }

        BigDecimal total = personal.stream()
                .map(NominaPersonal::getMontoSemanal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        NominaPago pago = NominaPago.builder()
                .cajaDia(caja)
                .sucursalId(sucursalId)
                .totalPagado(total)
                .registradoPor(usuarioRepo.getReferenceById(usuarioId))
                .build();

        return NominaPagoDTO.from(nominaPagoRepo.save(pago));
    }

    // ── Anulación ─────────────────────────────────────────────────────────

    @Transactional
    public void anularPago(Long cajaDiaId) {
        NominaPago pago = nominaPagoRepo.findActiveByCajaDiaId(cajaDiaId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "No hay pago de nómina activo para esta caja"));

        CajaDia caja = pago.getCajaDia();

        if (caja.getEstado() != EstadoCaja.ABIERTA) {
            throw new IllegalArgumentException("Solo se puede anular la nómina con la caja abierta");
        }

        pago.setDeletedAt(DateTimeUtils.ahoraEnMagno());
        nominaPagoRepo.save(pago);
    }

    // ── Cálculo del día efectivo ──────────────────────────────────────────

    public LocalDate calcularDiaEfectivo(Long sucursalId) {
        String diaConfig = configSucursalRepo.findBySucursalId(sucursalId)
                .map(ConfigSucursal::getDiaPagoNomina)
                .orElse("JUEVES");

        DayOfWeek targetDow = parseDia(diaConfig);
        LocalDate hoy = DateTimeUtils.hoyEnMagno();
        LocalDate monday = hoy.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        // targetDow.getValue(): MONDAY=1 ... FRIDAY=5
        LocalDate candidato = monday.plusDays(targetDow.getValue() - 1L);

        Set<LocalDate> festivos = new HashSet<>(diaFestivoRepo.findFechasBySucursalId(sucursalId));

        while (candidato.getDayOfWeek() == DayOfWeek.SATURDAY
                || candidato.getDayOfWeek() == DayOfWeek.SUNDAY
                || festivos.contains(candidato)) {
            candidato = candidato.minusDays(1);
        }

        return candidato;
    }

    private DayOfWeek parseDia(String dia) {
        return switch (dia.toUpperCase()) {
            case "LUNES"     -> DayOfWeek.MONDAY;
            case "MARTES"    -> DayOfWeek.TUESDAY;
            case "MIERCOLES" -> DayOfWeek.WEDNESDAY;
            case "JUEVES"    -> DayOfWeek.THURSDAY;
            case "VIERNES"   -> DayOfWeek.FRIDAY;
            default          -> DayOfWeek.THURSDAY;
        };
    }
}
```

- [ ] **Step 2: Crear `NominaCajaServiceTest.java`**

```java
package com.magno.service;

import com.magno.model.ConfigSucursal;
import com.magno.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.mock;

class NominaCajaServiceTest {

    private ConfigSucursalRepository configSucursalRepo;
    private DiaFestivoRepository diaFestivoRepo;
    private NominaCajaService service;

    @BeforeEach
    void setUp() {
        configSucursalRepo = mock(ConfigSucursalRepository.class);
        diaFestivoRepo = mock(DiaFestivoRepository.class);
        service = new NominaCajaService(
                mock(com.magno.repository.CajaDiaRepository.class),
                mock(com.magno.repository.NominaPagoRepository.class),
                mock(com.magno.repository.NominaPersonalRepository.class),
                configSucursalRepo,
                diaFestivoRepo,
                mock(com.magno.repository.UsuarioRepository.class));
    }

    @Test
    void calcularDiaEfectivo_cuandoDiaEsHabil_devuelveEseDia() {
        ConfigSucursal config = new ConfigSucursal();
        config.setDiaPagoNomina("JUEVES");
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of());

        // Para cualquier semana, el jueves debe ser el resultado si no es festivo
        LocalDate resultado = service.calcularDiaEfectivo(1L);
        assertThat(resultado.getDayOfWeek()).isEqualTo(DayOfWeek.THURSDAY);
    }

    @Test
    void calcularDiaEfectivo_cuandoJuevesEsFestivo_devuelveMiercoles() {
        ConfigSucursal config = new ConfigSucursal();
        config.setDiaPagoNomina("JUEVES");
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));

        // Calcula el jueves de esta semana y lo marca festivo
        LocalDate lunes = LocalDate.now().with(java.time.temporal.TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate jueves = lunes.plusDays(3);
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of(jueves));

        LocalDate resultado = service.calcularDiaEfectivo(1L);
        assertThat(resultado.getDayOfWeek()).isEqualTo(DayOfWeek.WEDNESDAY);
    }
}
```

- [ ] **Step 3: Ejecutar tests**

```bash
mvn test -pl backend -Dtest=NominaCajaServiceTest -q
```
Expected: Tests run: 2, Failures: 0

- [ ] **Step 4: Compilar todo**

```bash
mvn compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/magno/service/NominaCajaService.java \
        backend/src/test/java/com/magno/service/NominaCajaServiceTest.java
git commit -m "feat: add NominaCajaService with calcularDiaEfectivo, registrarPago, anularPago"
```

---

## Task 5: NominaCajaController

**Files:**
- Create: `backend/src/main/java/com/magno/controller/NominaCajaController.java`

- [ ] **Step 1: Crear `NominaCajaController.java`**

```java
package com.magno.controller;

import com.magno.dto.caja.NominaEstadoDTO;
import com.magno.dto.caja.NominaPagoDTO;
import com.magno.security.JwtPrincipal;
import com.magno.service.NominaCajaService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/caja/{cajaDiaId}/nomina")
public class NominaCajaController {

    private final NominaCajaService nominaService;

    public NominaCajaController(NominaCajaService nominaService) {
        this.nominaService = nominaService;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<NominaEstadoDTO> getEstado(@PathVariable Long cajaDiaId) {
        return ResponseEntity.ok(nominaService.getEstado(cajaDiaId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<NominaPagoDTO> registrarPago(
            @PathVariable Long cajaDiaId,
            Authentication auth) {
        JwtPrincipal p = (JwtPrincipal) auth.getPrincipal();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(nominaService.registrarPago(cajaDiaId, p.userId()));
    }

    @DeleteMapping
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<Void> anularPago(@PathVariable Long cajaDiaId) {
        nominaService.anularPago(cajaDiaId);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 2: Compilar**

```bash
mvn compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 3: Smoke test manual (con la app corriendo)**

```bash
# GET — debe devolver estado actual
curl -s -H "Authorization: Bearer <token>" \
  http://localhost:8080/api/caja/1/nomina | jq .
```
Expected: JSON con `esDiaEfectivo`, `personal`, `totalCalculado`, `pago: null`

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/controller/NominaCajaController.java
git commit -m "feat: add NominaCajaController with GET, POST, DELETE endpoints"
```

---

## Task 6: Actualizar CajaService (cerrar, preview, PDF, toDetalleDTO)

**Files:**
- Modify: `backend/src/main/java/com/magno/service/CajaService.java`

- [ ] **Step 1: Agregar `NominaPagoRepository` al constructor de `CajaService`**

Agregar el campo y el argumento al constructor. Localizar la sección de campos (líneas ~35-59):

```java
// Campo nuevo (agregar después de gastoRepo):
private final NominaPagoRepository nominaPagoRepo;

// Agregar al constructor (después de GastoRepository gastoRepo):
NominaPagoRepository nominaPagoRepo,

// Agregar en el cuerpo del constructor:
this.nominaPagoRepo = nominaPagoRepo;
```

- [ ] **Step 2: Actualizar `cerrar()` — incluir `totalNomina`**

Dentro del método `cerrar`, después del cálculo de `totalGastos`, agregar:

```java
BigDecimal totalNomina = nominaPagoRepo.findActiveByCajaDiaId(caja.getId())
        .map(com.magno.model.NominaPago::getTotalPagado)
        .orElse(BigDecimal.ZERO);
BigDecimal totalRealLibres = montoLibres.subtract(ahorroFijo).subtract(totalGastos).subtract(totalNomina);
```

Reemplazar la línea existente `BigDecimal totalRealLibres = montoLibres.subtract(ahorroFijo).subtract(totalGastos);`.

También agregar `caja.setTotalNomina(totalNomina);` junto a `caja.setTotalGastos(totalGastos);`.

- [ ] **Step 3: Actualizar `cancelarCierre()` — resetear `totalNomina`**

En el bloque de nulls (después de `caja.setTotalGastos(null);`):
```java
caja.setTotalNomina(null);
```

- [ ] **Step 4: Actualizar `getPreviewCierre()` — incluir `totalNomina`**

Después del cálculo de `totalGastos` en el preview:

```java
BigDecimal totalNomina = nominaPagoRepo.findActiveByCajaDiaId(caja.getId())
        .map(com.magno.model.NominaPago::getTotalPagado)
        .orElse(BigDecimal.ZERO);
BigDecimal totalRealLibres = montoLibres.subtract(ahorroFijo).subtract(totalGastos).subtract(totalNomina);
```

Reemplazar la línea existente `BigDecimal totalRealLibres = montoLibres.subtract(ahorroFijo).subtract(totalGastos);`.

Y en el `return new CajaCierrePreviewDTO(...)`, agregar `totalNomina` entre `totalGastos` y `totalRealLibres`:
```java
return new CajaCierrePreviewDTO(
        caja.getId(),
        caja.getMontoApertura(),
        subtotalInversiones,
        cobrosPorAsesor,
        totalIngresoCarteras,
        desembolsosNuevos,
        desembolsosRenovaciones,
        totalDesembolsos,
        subtotalCaja,
        config.getPorcentajeAhorro(),
        montoLibres,
        ahorroFijo,
        totalGastos,
        totalNomina,       // <-- nuevo
        totalRealLibres,
        multasPorAsesor,
        totalMultas);
```

- [ ] **Step 5: Actualizar `toDetalleDTO()` — agregar `totalNomina`**

El método `toDetalleDTO` construye `CajaDiaDetalleDTO`. Agregar `c.getTotalNomina()` entre `c.getTotalGastos()` y `c.getTotalRealLibres()`:

```java
private CajaDiaDetalleDTO toDetalleDTO(CajaDia c, List<MovimientoInversionDTO> inversiones) {
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
            c.getAhorroFijo(),
            c.getTotalGastos(),
            c.getTotalNomina(),   // <-- nuevo
            c.getTotalRealLibres(),
            inversiones);
}
```

- [ ] **Step 6: Actualizar `exportarPdf()` — agregar sección nómina**

Localizar el bloque `// ── Libres` en `exportarPdf()` (alrededor de la línea 429). Agregar la línea de nómina después de la línea de gastos y antes de "Total Real Libres":

```java
// Dentro del bloque if (caja.getMontoLibres() != null):
if (caja.getTotalNomina() != null && caja.getTotalNomina().compareTo(BigDecimal.ZERO) > 0) {
    doc.add(new Paragraph("Nómina: −" + fmtMonto(caja.getTotalNomina())).setFontSize(9));
}
```

- [ ] **Step 7: Compilar**

```bash
mvn compile -q
```
Expected: BUILD SUCCESS

- [ ] **Step 8: Arrancar y probar flujo completo**

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```
Verificar manualmente:
1. POST `/api/caja/{id}/nomina` → 201 Created con `totalPagado`
2. GET `/api/caja/preview-cierre?sucursalId=1` → `totalNomina` aparece en respuesta
3. POST cierre de caja → `total_nomina` guardado en DB

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/com/magno/service/CajaService.java
git commit -m "feat: integrate totalNomina into CajaService cerrar, preview, PDF, and toDetalleDTO"
```

---

## Task 7: Frontend — tipos y service calls

**Files:**
- Modify: `frontend/src/services/cajaService.ts`

- [ ] **Step 1: Agregar tipos de nómina al final de las interfaces**

Agregar después de la interfaz `MovimientoInversion`:

```typescript
export interface NominaPersonalItem {
  id: number
  nombre: string
  puesto: string
  montoSemanal: number
}

export interface NominaPago {
  id: number
  totalPagado: number
  registradoPorNombre: string
  createdAt: string
}

export interface NominaEstado {
  esDiaEfectivo: boolean
  diaEfectivo: string          // ISO date "YYYY-MM-DD"
  personal: NominaPersonalItem[]
  totalCalculado: number
  pago: NominaPago | null
}
```

- [ ] **Step 2: Agregar `totalNomina` a las interfaces y normalizadores**

En la interfaz `CajaCierrePreview`, agregar `totalNomina: number` después de `totalGastos`:
```typescript
  totalGastos: number
  totalNomina: number
  totalRealLibres: number
```

En la interfaz `CajaDiaDetalle`, agregar `totalNomina: number | null` después de `totalGastos`:
```typescript
  totalGastos: number | null
  totalNomina: number | null
  totalRealLibres: number | null
```

En la función `normalizeDetalle` (alrededor de la línea 140), agregar `totalNomina` junto a `totalGastos`:
```typescript
    totalGastos:     raw?.totalGastos    != null ? Number(raw.totalGastos)    : null,
    totalNomina:     raw?.totalNomina    != null ? Number(raw.totalNomina)    : null,
    totalRealLibres: raw?.totalRealLibres != null ? Number(raw.totalRealLibres) : null,
```

En el método `getPreviewCierre` dentro de `cajaService` (alrededor de la línea 208), agregar `totalNomina` entre `totalGastos` y `totalRealLibres`:
```typescript
           totalGastos:               Number(d.totalGastos ?? 0),
           totalNomina:               Number(d.totalNomina ?? 0),
           totalRealLibres:           Number(d.totalRealLibres ?? 0),
```

- [ ] **Step 3: Agregar funciones de servicio de nómina**

Localizar el `export const cajaService = {` y agregar dentro del objeto (al final, antes del cierre `}`):

```typescript
  async getNominaEstado(cajaDiaId: number): Promise<NominaEstado> {
    const { data } = await api.get(`/caja/${cajaDiaId}/nomina`)
    return {
      esDiaEfectivo: data.esDiaEfectivo,
      diaEfectivo:   data.diaEfectivo,
      personal:      (data.personal ?? []).map((p: any) => ({
        id:           p.id,
        nombre:       p.nombre,
        puesto:       p.puesto,
        montoSemanal: Number(p.montoSemanal ?? 0),
      })),
      totalCalculado: Number(data.totalCalculado ?? 0),
      pago: data.pago
        ? {
            id:                  data.pago.id,
            totalPagado:         Number(data.pago.totalPagado ?? 0),
            registradoPorNombre: data.pago.registradoPorNombre ?? '',
            createdAt:           data.pago.createdAt,
          }
        : null,
    }
  },

  async registrarNomina(cajaDiaId: number): Promise<NominaPago> {
    const { data } = await api.post(`/caja/${cajaDiaId}/nomina`)
    return {
      id:                  data.id,
      totalPagado:         Number(data.totalPagado ?? 0),
      registradoPorNombre: data.registradoPorNombre ?? '',
      createdAt:           data.createdAt,
    }
  },

  async anularNomina(cajaDiaId: number): Promise<void> {
    await api.delete(`/caja/${cajaDiaId}/nomina`)
  },
```

- [ ] **Step 4: Compilar TypeScript**

```bash
cd frontend && npx tsc --noEmit
```
Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/cajaService.ts
git commit -m "feat: add NominaEstado types and service calls to cajaService"
```

---

## Task 8: Frontend — SeccionNomina en CajaPage

**Files:**
- Modify: `frontend/src/pages/caja/CajaPage.tsx`

- [ ] **Step 1: Agregar el import del servicio**

Al inicio del archivo, en las importaciones (junto a `gastoService`):

```typescript
import { cajaService, type NominaEstado } from '@/services/cajaService'
```

(Si `cajaService` ya está importado, solo agregar `type NominaEstado` al import existente)

- [ ] **Step 2: Definir el componente `SeccionNomina`**

Agregar el componente antes de la función principal `CajaPage`. Se puede colocar después de los helpers de `fmtMoney`, `fmtTime`, etc., y antes del componente `Section`:

```typescript
// ── Sección Nómina ─────────────────────────────────────────────────────

function SeccionNomina({ cajaDiaId }: { cajaDiaId: number }) {
  const qc = useQueryClient()
  const [confirmando, setConfirmando] = useState(false)

  const { data: estado, isLoading } = useQuery<NominaEstado>({
    queryKey: ['caja-nomina', cajaDiaId],
    queryFn:  () => cajaService.getNominaEstado(cajaDiaId),
    staleTime: 60_000,
  })

  const registrarMut = useMutation({
    mutationFn: () => cajaService.registrarNomina(cajaDiaId),
    onSuccess: () => {
      toast.success('Nómina registrada')
      qc.invalidateQueries({ queryKey: ['caja-nomina', cajaDiaId] })
      qc.invalidateQueries({ queryKey: ['caja-preview'] })
      setConfirmando(false)
    },
    onError: () => toast.error('Error al registrar la nómina'),
  })

  const anularMut = useMutation({
    mutationFn: () => cajaService.anularNomina(cajaDiaId),
    onSuccess: () => {
      toast.success('Nómina anulada')
      qc.invalidateQueries({ queryKey: ['caja-nomina', cajaDiaId] })
      qc.invalidateQueries({ queryKey: ['caja-preview'] })
    },
    onError: () => toast.error('Error al anular la nómina'),
  })

  if (isLoading || !estado) return null

  return (
    <Section title="Nómina" defaultOpen={false}>
      {!estado.esDiaEfectivo ? (
        <p className="text-[13px] text-[#6c757d]">
          El próximo pago de nómina es el{' '}
          <span className="font-medium text-[#212529]">
            {new Date(estado.diaEfectivo + 'T12:00:00').toLocaleDateString('es-MX', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </span>
          .
        </p>
      ) : estado.pago ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
            <span className="text-[13px] font-medium text-[#15803d]">
              Nómina pagada — {fmtMoney(estado.pago.totalPagado)}
            </span>
          </div>
          <p className="text-[12px] text-[#6c757d]">
            Registrado por {estado.pago.registradoPorNombre}
          </p>
          <button
            type="button"
            className="btn btn-sm btn-ghost text-[#dc2626] text-[12px]"
            onClick={() => anularMut.mutate()}
            disabled={anularMut.isPending}
          >
            {anularMut.isPending ? 'Anulando…' : 'Anular pago'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] text-[#6c757d] uppercase tracking-wide">
                <th className="text-left font-medium pb-1">Nombre</th>
                <th className="text-left font-medium pb-1">Puesto</th>
                <th className="text-right font-medium pb-1">Monto semanal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f5]">
              {estado.personal.map(p => (
                <tr key={p.id}>
                  <td className="py-1">{p.nombre}</td>
                  <td className="py-1 text-[#6c757d]">{p.puesto}</td>
                  <td className="py-1 text-right font-mono">{fmtMoney(p.montoSemanal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#dee2e6] font-semibold">
                <td colSpan={2} className="pt-1.5 text-right text-[12px] text-[#6c757d]">Total</td>
                <td className="pt-1.5 text-right font-mono">{fmtMoney(estado.totalCalculado)}</td>
              </tr>
            </tfoot>
          </table>

          {!confirmando ? (
            <button
              type="button"
              className="btn btn-sm btn-primary w-full"
              onClick={() => setConfirmando(true)}
              disabled={estado.personal.length === 0}
            >
              Registrar pago de nómina
            </button>
          ) : (
            <div className="border border-[#fca5a5] rounded-lg p-3 bg-[#fef2f2] space-y-2">
              <p className="text-[13px] font-medium text-[#991b1b]">
                ¿Confirmar pago de nómina por {fmtMoney(estado.totalCalculado)}?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-ghost flex-1"
                  onClick={() => setConfirmando(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary flex-1"
                  onClick={() => registrarMut.mutate()}
                  disabled={registrarMut.isPending}
                >
                  {registrarMut.isPending ? 'Registrando…' : 'Confirmar pago'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}
```

- [ ] **Step 3: Renderizar `SeccionNomina` en la caja abierta**

Dentro de `CajaPage`, localizar donde se renderizan las secciones de la caja abierta (donde aparece `isAdmin` y `cajaAbierta`). Agregar `<SeccionNomina>` solo cuando `isAdmin && cajaAbierta && cajaId != null`:

Buscar el bloque donde se renderiza la sección de Gastos (contiene `gastoService`) y añadir **después** de ese bloque:

```tsx
{isAdmin && cajaAbierta && cajaId != null && (
  <SeccionNomina cajaDiaId={cajaId} />
)}
```

- [ ] **Step 4: Agregar `useState` import si no está**

Verificar que `useState` esté en el import de React. Ya debería estar: `import { useState, ... } from 'react'`.

- [ ] **Step 5: Verificar compilación TypeScript**

```bash
cd frontend && npx tsc --noEmit
```
Expected: sin errores

- [ ] **Step 6: Probar en el navegador**

```bash
cd frontend && npm run dev
```
1. Abrir `/caja` con rol ADMINISTRADOR y caja abierta
2. Verificar que aparece la sección "Nómina"
3. Si hoy es día de nómina: verificar tabla de personal + botón
4. Si no es día de nómina: verificar mensaje con fecha próxima

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/caja/CajaPage.tsx
git commit -m "feat: add SeccionNomina component to CajaPage for ADMINISTRADOR"
```

---

## Task 9: Frontend — CajaCierrePage y Historial

**Files:**
- Modify: `frontend/src/pages/caja/CajaCierrePage.tsx`
- Modify: `frontend/src/pages/caja/CajaPage.tsx` (historial)

- [ ] **Step 1: Agregar línea nómina en la sección "Libres" de CajaCierrePage**

Localizar el bloque donde se muestra `totalGastos` en la sección "Libres" del preview (alrededor de la línea con `{preview.totalGastos > 0 && ...}`). Agregar inmediatamente después:

```tsx
{preview.totalNomina > 0 && (
  <div className="flex justify-between">
    <span className="text-[#6c757d]">− Nómina</span>
    <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.totalNomina)}</span>
  </div>
)}
```

- [ ] **Step 2: Agregar línea nómina en el resumen de caja cerrada**

Localizar el bloque `SummaryItem` donde aparece `totalGastos` (para la vista de caja ya cerrada):

```tsx
{(caja.totalNomina ?? 0) > 0 && (
  <SummaryItem label="Nómina" value={fmtMoney(caja.totalNomina)} />
)}
```

- [ ] **Step 3: Agregar línea nómina en el historial de CajaPage**

En `CajaPage.tsx`, localizar el bloque del historial donde aparece `histDetalle.totalGastos` (alrededor de la línea 639). Añadir inmediatamente después:

```tsx
{(histDetalle.totalNomina ?? 0) > 0 && (
  <div>
    <span className="text-[#6c757d]">Nómina</span>
    <div className="font-mono font-medium text-[#dc2626]">{fmtMoney(histDetalle.totalNomina)}</div>
  </div>
)}
```

Y también en el mini-preview de libres en `CajaPage` (alrededor de la línea 130):

```tsx
{(preview.totalNomina ?? 0) > 0 && (
  <div className="flex justify-between">
    <span className="text-[#6c757d]">− Nómina</span>
    <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.totalNomina)}</span>
  </div>
)}
```

- [ ] **Step 4: Verificar compilación TypeScript**

```bash
cd frontend && npx tsc --noEmit
```
Expected: sin errores

- [ ] **Step 5: Probar flujo completo en el navegador**

1. Abrir caja
2. Registrar pago de nómina en `/caja` (botón en SeccionNomina)
3. Ir a `/caja/cierre` — verificar que aparece "− Nómina $X,XXX" en la sección Libres
4. Confirmar cierre
5. Descargar PDF — verificar línea "Nómina: −$X,XXX"
6. Verificar en historial que `totalNomina` aparece en el detalle de la caja cerrada

- [ ] **Step 6: Commit final**

```bash
git add frontend/src/pages/caja/CajaCierrePage.tsx \
        frontend/src/pages/caja/CajaPage.tsx
git commit -m "feat: display totalNomina in CajaCierrePage preview, cierre summary, and historial"
```
