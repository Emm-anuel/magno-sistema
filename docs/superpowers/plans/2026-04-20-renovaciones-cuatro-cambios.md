# Renovaciones — Cuatro Cambios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactorizar el flujo de renovaciones: eliminar restricción de monto, permitir al gerente ajustar el monto al aprobar, separar APROBADO (visto bueno) de ACTIVO (desembolso confirmado), y agregar upload de video en la confirmación del desembolso.

**Architecture:** Migración V13 agrega `monto_aprobado`, `confirmado_por`, `fecha_confirmacion` a la tabla `renovaciones` y convierte los registros existentes APROBADO-con-crédito a ACTIVO. Se agrega `ACTIVO` al enum. El endpoint `PATCH /renovaciones/{id}/aprobar` solo guarda el visto bueno y el monto sin tocar créditos. Un nuevo endpoint `PATCH /renovaciones/{id}/confirmar-desembolso` hace el procesamiento real. Frontend: `TabPendientesRenovacion` añade campo editable de monto; nuevo tab `TabPendientesDesembolso` para gerentes; `TabMisSolicitudes` muestra botón de confirmar para APROBADO con `FileUpload`.

**Tech Stack:** Spring Boot 3 / Java 17 / Liquibase / JPA, React 18 / TypeScript / TanStack Query v5 / Tailwind CSS

---

## File Map

**Backend — create:**
- `backend/src/main/resources/db/changelog/V13__renovaciones_desembolso_en_dos_pasos.sql`
- `backend/src/main/java/com/magno/dto/renovacion/RenovacionAprobarRequest.java`
- `backend/src/main/java/com/magno/dto/renovacion/RenovacionConfirmarDesembolsoRequest.java`

**Backend — modify:**
- `backend/src/main/resources/db/changelog/db.changelog-master.xml`
- `backend/src/main/java/com/magno/model/EstadoRenovacion.java`
- `backend/src/main/java/com/magno/model/Renovacion.java`
- `backend/src/main/java/com/magno/dto/renovacion/RenovacionDetalleDTO.java`
- `backend/src/main/java/com/magno/repository/RenovacionRepository.java`
- `backend/src/main/java/com/magno/service/RenovacionService.java`
- `backend/src/main/java/com/magno/controller/RenovacionController.java`

**Frontend — create:**
- `frontend/src/pages/renovaciones/TabPendientesDesembolso.tsx`

**Frontend — modify:**
- `frontend/src/types/index.ts`
- `frontend/src/services/renovacionService.ts`
- `frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx`
- `frontend/src/pages/renovaciones/TabPendientesRenovacion.tsx`
- `frontend/src/pages/renovaciones/TabMisSolicitudes.tsx`
- `frontend/src/pages/renovaciones/RenovacionesPage.tsx`

**Data / Docs — modify:**
- `backend/src/main/resources/db/seed_dev_02_centro.sql`
- `docs/03-reglas-de-negocio.md`
- `docs/04-modulos-y-ui.md`
- `docs/05-modelo-de-datos.md`
- `docs/06-archivos-y-storage.md`

---

### Task 1: Migración V13 — nuevas columnas y conversión de estado

**Files:**
- Create: `backend/src/main/resources/db/changelog/V13__renovaciones_desembolso_en_dos_pasos.sql`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- MAGNO — V13: Flujo de desembolso en dos pasos para renovaciones
-- APROBADO = gerente dio el visto bueno; crédito anterior intacto.
-- ACTIVO   = efectivo entregado; crédito anterior RENOVADO, nuevo crédito generado.

-- 1. Monto aprobado (puede diferir del solicitado si el gerente lo ajustó)
ALTER TABLE renovaciones
    ADD COLUMN IF NOT EXISTS monto_aprobado DECIMAL(12,2);

-- Backfill: registros existentes completados → monto_aprobado = monto_nuevo
UPDATE renovaciones SET monto_aprobado = monto_nuevo WHERE monto_aprobado IS NULL;

-- 2. Auditoría del confirmador de desembolso
ALTER TABLE renovaciones
    ADD COLUMN IF NOT EXISTS confirmado_por     BIGINT REFERENCES usuarios(id),
    ADD COLUMN IF NOT EXISTS fecha_confirmacion TIMESTAMPTZ;

-- 3. Registros existentes APROBADO con crédito nuevo ya creado → ACTIVO
--    (representan renovaciones completadas antes de V13; en el nuevo modelo son ACTIVO)
UPDATE renovaciones
SET estado = 'ACTIVO'
WHERE estado = 'APROBADO'
  AND credito_nuevo_id IS NOT NULL
  AND deleted_at IS NULL;
```

- [ ] **Step 2: Registrar en db.changelog-master.xml**

Agregar al final, antes de `</databaseChangeLog>`:
```xml
    <changeSet id="V13-renovaciones-desembolso-en-dos-pasos" author="magno">
        <sqlFile
            path="db/changelog/V13__renovaciones_desembolso_en_dos_pasos.sql"
            relativeToChangelogFile="false"
            splitStatements="true"
            stripComments="false"/>
    </changeSet>
```

- [ ] **Step 3: Commit**
```bash
git add backend/src/main/resources/db/changelog/V13__renovaciones_desembolso_en_dos_pasos.sql \
        backend/src/main/resources/db/changelog/db.changelog-master.xml
git commit -m "db: V13 — monto_aprobado, confirmado_por, fecha_confirmacion; APROBADO+creditoNuevo → ACTIVO"
```

---

### Task 2: Backend — Enum y modelo Renovacion

**Files:**
- Modify: `backend/src/main/java/com/magno/model/EstadoRenovacion.java`
- Modify: `backend/src/main/java/com/magno/model/Renovacion.java`

- [ ] **Step 1: Agregar ACTIVO al enum**

Reemplazar `EstadoRenovacion.java` completo:
```java
package com.magno.model;

public enum EstadoRenovacion {
    SOLICITADO,
    APROBADO,
    RECHAZADO,
    ACTIVO
}
```

- [ ] **Step 2: Agregar campos al modelo Renovacion**

En `Renovacion.java`, después del campo `motivoRechazo` agregar los tres campos nuevos:
```java
    @Column(name = "monto_aprobado", precision = 12, scale = 2)
    private BigDecimal montoAprobado;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "confirmado_por")
    private Usuario confirmadoPor;

    @Column(name = "fecha_confirmacion")
    private OffsetDateTime fechaConfirmacion;
```

- [ ] **Step 3: Commit**
```bash
git add backend/src/main/java/com/magno/model/EstadoRenovacion.java \
        backend/src/main/java/com/magno/model/Renovacion.java
git commit -m "feat(renovaciones): estado ACTIVO y campos montoAprobado/confirmadoPor/fechaConfirmacion en modelo"
```

---

### Task 3: Backend — Eliminar restricción de monto (Cambio 1)

**Files:**
- Modify: `backend/src/main/java/com/magno/service/RenovacionService.java`

La restricción aparece en dos métodos:

**`calcularPreview()`** — actualmente genera `advertenciaMonto` y devuelve `puedeAumentarMonto = false` cuando hay ≥2 pagos pendientes.

**`crearSolicitud()`** — actualmente lanza `IllegalArgumentException` si `montoNuevo > montoCapital` con ≥2 pagos pendientes.

- [ ] **Step 1: En `calcularPreview()` — reemplazar lógica de restricción**

Buscar exactamente:
```java
                boolean puedeAumentar = numPagosRestantes <= 1;
                String advertencia = null;
                if (!puedeAumentar && montoNuevo.compareTo(credito.getMontoCapital()) > 0) {
                        advertencia = "Con " + numPagosRestantes + " pagos pendientes, el monto nuevo no puede superar "
                                        + "$" + credito.getMontoCapital().toPlainString()
                                        + " (monto del crédito anterior).";
                }
```

Reemplazar con:
```java
                boolean puedeAumentar = true;
                String advertencia = null;
```

- [ ] **Step 2: En `crearSolicitud()` — eliminar el throw por restricción de monto**

Buscar y eliminar completamente el bloque:
```java
                if (numPagosRestantes >= 2 && req.montoNuevo().compareTo(creditoAnterior.getMontoCapital()) > 0) {
                        throw new IllegalArgumentException(
                                        "Con " + numPagosRestantes
                                                        + " pagos pendientes, el monto nuevo no puede superar "
                                                        + "$" + creditoAnterior.getMontoCapital().toPlainString());
                }
```

- [ ] **Step 3: Commit**
```bash
git add backend/src/main/java/com/magno/service/RenovacionService.java
git commit -m "feat(renovaciones): eliminar restricción de monto nuevo por pagos pendientes"
```

---

### Task 4: Backend — Nuevos DTOs de aprobación y confirmación

**Files:**
- Create: `backend/src/main/java/com/magno/dto/renovacion/RenovacionAprobarRequest.java`
- Create: `backend/src/main/java/com/magno/dto/renovacion/RenovacionConfirmarDesembolsoRequest.java`

- [ ] **Step 1: Crear RenovacionAprobarRequest.java**

```java
package com.magno.dto.renovacion;

import java.math.BigDecimal;

public record RenovacionAprobarRequest(
        BigDecimal montoAprobado   // null → se usa montoNuevo de la solicitud sin cambios
) {}
```

- [ ] **Step 2: Crear RenovacionConfirmarDesembolsoRequest.java**

```java
package com.magno.dto.renovacion;

public record RenovacionConfirmarDesembolsoRequest(
        String videoEntregaUrl   // null → opcional, se guarda si viene
) {}
```

- [ ] **Step 3: Commit**
```bash
git add backend/src/main/java/com/magno/dto/renovacion/RenovacionAprobarRequest.java \
        backend/src/main/java/com/magno/dto/renovacion/RenovacionConfirmarDesembolsoRequest.java
git commit -m "feat(renovaciones): DTOs RenovacionAprobarRequest y RenovacionConfirmarDesembolsoRequest"
```

---

### Task 5: Backend — Actualizar RenovacionDetalleDTO con campos nuevos

**Files:**
- Modify: `backend/src/main/java/com/magno/dto/renovacion/RenovacionDetalleDTO.java`

- [ ] **Step 1: Reemplazar el archivo completo**

```java
package com.magno.dto.renovacion;

import com.magno.model.Renovacion;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;

public record RenovacionDetalleDTO(
                Long id,
                ClienteInfo cliente,
                AsesorInfo asesor,
                CreditoInfo creditoAnterior,
                CreditoInfo creditoNuevo,
                LocalDate fecha,
                String estado,
                AsesorInfo aprobadoPor,
                OffsetDateTime fechaAprobacion,
                String motivoRechazo,
                BigDecimal montoNuevo,
                BigDecimal montoAprobado,
                AsesorInfo confirmadoPor,
                OffsetDateTime fechaConfirmacion,
                String tipoPago,
                int pagosRestantes,
                BigDecimal montoPagosRestantes,
                BigDecimal multasPendientes,
                BigDecimal pagoAdelantado,
                BigDecimal montoDesembolso,
                String garantiaDescripcion,
                String videoEntregaUrl,
                List<String> evidenciaUrls,
                OffsetDateTime createdAt) {

        public record ClienteInfo(Long id, String nombreCompleto, String celular) {}
        public record AsesorInfo(Long id, String nombreCompleto, String sucursalNombre) {}
        public record CreditoInfo(Long id, BigDecimal montoCapital, Integer plazoDias,
                        BigDecimal pagoPeriodico, String estado) {}

        public static RenovacionDetalleDTO from(Renovacion r) {
                CreditoInfo creditoNuevoInfo = null;
                if (r.getCreditoNuevo() != null) {
                        creditoNuevoInfo = new CreditoInfo(
                                        r.getCreditoNuevo().getId(),
                                        r.getCreditoNuevo().getMontoCapital(),
                                        r.getCreditoNuevo().getPlazoDias(),
                                        r.getCreditoNuevo().getPagoPeriodico(),
                                        r.getCreditoNuevo().getEstado().name());
                }

                AsesorInfo aprobadoPorInfo = null;
                if (r.getAprobadoPor() != null) {
                        aprobadoPorInfo = new AsesorInfo(
                                        r.getAprobadoPor().getId(),
                                        r.getAprobadoPor().getNombreCompleto(),
                                        r.getAprobadoPor().getSucursal().getNombre());
                }

                AsesorInfo confirmadoPorInfo = null;
                if (r.getConfirmadoPor() != null) {
                        confirmadoPorInfo = new AsesorInfo(
                                        r.getConfirmadoPor().getId(),
                                        r.getConfirmadoPor().getNombreCompleto(),
                                        r.getConfirmadoPor().getSucursal().getNombre());
                }

                return new RenovacionDetalleDTO(
                                r.getId(),
                                new ClienteInfo(
                                                r.getCliente().getId(),
                                                r.getCliente().getNombreCompleto(),
                                                r.getCliente().getCelular()),
                                new AsesorInfo(r.getAsesor().getId(), r.getAsesor().getNombreCompleto(),
                                                r.getAsesor().getSucursal().getNombre()),
                                new CreditoInfo(
                                                r.getCreditoAnterior().getId(),
                                                r.getCreditoAnterior().getMontoCapital(),
                                                r.getCreditoAnterior().getPlazoDias(),
                                                r.getCreditoAnterior().getPagoPeriodico(),
                                                r.getCreditoAnterior().getEstado().name()),
                                creditoNuevoInfo,
                                r.getFecha(),
                                r.getEstado().name(),
                                aprobadoPorInfo,
                                r.getFechaAprobacion(),
                                r.getMotivoRechazo(),
                                r.getMontoNuevo(),
                                r.getMontoAprobado(),
                                confirmadoPorInfo,
                                r.getFechaConfirmacion(),
                                r.getTipoPago().name(),
                                r.getPagosRestantes(),
                                r.getMontoPagosRestantes(),
                                r.getMultasPendientes(),
                                r.getPagoAdelantado(),
                                r.getMontoDesembolso(),
                                r.getGarantiaDescripcion(),
                                r.getVideoEntregaUrl(),
                                r.getEvidenciaUrls() != null ? Arrays.asList(r.getEvidenciaUrls()) : List.of(),
                                r.getCreatedAt());
        }
}
```

- [ ] **Step 2: Commit**
```bash
git add backend/src/main/java/com/magno/dto/renovacion/RenovacionDetalleDTO.java
git commit -m "feat(renovaciones): RenovacionDetalleDTO con montoAprobado, confirmadoPor, fechaConfirmacion"
```

---

### Task 6: Backend — Refactorizar service + repository + controller (Cambios 2 y 3)

**Files:**
- Modify: `backend/src/main/java/com/magno/repository/RenovacionRepository.java`
- Modify: `backend/src/main/java/com/magno/service/RenovacionService.java`
- Modify: `backend/src/main/java/com/magno/controller/RenovacionController.java`

- [ ] **Step 1: Agregar query `findPendientesDesembolso` al repositorio**

En `RenovacionRepository.java`, agregar al final (antes del cierre `}`):
```java
    // Renovaciones APROBADAS pendientes de confirmar desembolso
    @Query("SELECT r FROM Renovacion r " +
           "WHERE r.deletedAt IS NULL " +
           "AND r.estado = com.magno.model.EstadoRenovacion.APROBADO " +
           "AND (:sucursalId IS NULL OR r.creditoAnterior.sucursal.id = :sucursalId) " +
           "ORDER BY r.fechaAprobacion ASC")
    List<Renovacion> findPendientesDesembolso(@Param("sucursalId") Long sucursalId);
```

- [ ] **Step 2: Reemplazar el método `aprobarRenovacion` completo en el service**

Reemplazar el método existente `aprobarRenovacion` con esta versión que solo guarda el visto bueno sin tocar créditos:

```java
        @Transactional
        public RenovacionDetalleDTO aprobarRenovacion(Long renovacionId, BigDecimal montoAprobadoParam, Long aprobadorId) {
                Renovacion renovacion = findRenovacion(renovacionId);

                if (renovacion.getEstado() != EstadoRenovacion.SOLICITADO) {
                        throw new IllegalArgumentException(
                                        "Solo se puede aprobar una renovación en estado SOLICITADO. Estado actual: "
                                                        + renovacion.getEstado());
                }

                Usuario aprobador = usuarioRepo.findById(aprobadorId)
                                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + aprobadorId));

                BigDecimal montoAprobado = (montoAprobadoParam != null && montoAprobadoParam.compareTo(BigDecimal.ZERO) > 0)
                                ? montoAprobadoParam
                                : renovacion.getMontoNuevo();

                renovacion.setEstado(EstadoRenovacion.APROBADO);
                renovacion.setMontoAprobado(montoAprobado);
                renovacion.setAprobadoPor(aprobador);
                renovacion.setFechaAprobacion(DateTimeUtils.ahoraEnMagno());
                renovacionRepo.save(renovacion);

                log.info("Renovación APROBADA (pendiente desembolso) — renovacion.id=" + renovacion.getId()
                                + " monto_aprobado=" + montoAprobado
                                + " aprobado_por=" + aprobador.getNombreCompleto());

                return RenovacionDetalleDTO.from(renovacion);
        }
```

- [ ] **Step 3: Agregar método `confirmarDesembolso` en el service**

Agregar inmediatamente después de `aprobarRenovacion`. Este es el método que reemplaza la lógica que estaba en el viejo `aprobarRenovacion`:

```java
        @Transactional
        public RenovacionDetalleDTO confirmarDesembolso(Long renovacionId, Long confirmadorId, String videoEntregaUrl) {
                Renovacion renovacion = findRenovacion(renovacionId);

                if (renovacion.getEstado() != EstadoRenovacion.APROBADO) {
                        throw new IllegalArgumentException(
                                        "Solo se puede confirmar el desembolso de una renovación APROBADA. Estado actual: "
                                                        + renovacion.getEstado());
                }

                Credito creditoAnterior = renovacion.getCreditoAnterior();
                if (creditoAnterior.getEstado() != EstadoCredito.ACTIVO) {
                        throw new IllegalArgumentException(
                                        "El crédito anterior ya no está ACTIVO. Estado: "
                                                        + creditoAnterior.getEstado());
                }

                Usuario confirmador = usuarioRepo.findById(confirmadorId)
                                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + confirmadorId));

                BigDecimal montoAprobado = renovacion.getMontoAprobado() != null
                                ? renovacion.getMontoAprobado()
                                : renovacion.getMontoNuevo();

                // Re-leer pagos y multas al momento del desembolso real
                List<CalendarioPago> pagosPendientes = calendarioPagoRepo
                                .findByCreditoIdAndEstadoIn(creditoAnterior.getId(), ESTADOS_PENDIENTES);
                BigDecimal multasPendientesAmt = multaRepo.sumMontosPendientesByCreditoId(creditoAnterior.getId());
                ResumenCalculo calculoNuevo = calculoService.calcularCredito(montoAprobado);
                BigDecimal montoDesembolso = montoAprobado
                                .subtract(renovacion.getMontoPagosRestantes())
                                .subtract(multasPendientesAmt)
                                .subtract(calculoNuevo.pagoAdelantado());

                LocalDate hoy = DateTimeUtils.hoyEnMagno();

                // 1. Saldar pagos pendientes del crédito anterior
                for (CalendarioPago pago : pagosPendientes) {
                        pago.setEstado(EstadoCalendarioPago.PAGADO);
                        calendarioPagoRepo.save(pago);
                }

                // 2. Marcar multas como cobradas (descontadas del desembolso)
                multaRepo.findByCreditoIdAndCobradaFalseAndDeletedAtIsNull(creditoAnterior.getId())
                                .forEach(m -> {
                                        m.setCobrada(true);
                                        multaRepo.save(m);
                                });

                // 3. Cerrar crédito anterior
                creditoAnterior.setEstado(EstadoCredito.RENOVADO);
                creditoRepo.save(creditoAnterior);

                // 4. Crear nuevo crédito ACTIVO
                String[] evidenciaUrls = renovacion.getEvidenciaUrls();
                Credito creditoNuevo = Credito.builder()
                                .cliente(creditoAnterior.getCliente())
                                .asesor(creditoAnterior.getAsesor())
                                .sucursal(creditoAnterior.getSucursal())
                                .tipo(TipoCredito.RENOVACION)
                                .montoSolicitado(montoAprobado)
                                .montoCapital(calculoNuevo.capital())
                                .montoAprobado(montoAprobado)
                                .tasaInteres(calculoNuevo.tasa())
                                .cargoFinanciero(calculoNuevo.cargoFinanciero())
                                .totalAPagar(calculoNuevo.totalAPagar())
                                .pagoPeriodico(calculoNuevo.pagoPeriodico())
                                .plazoDias(calculoNuevo.plazo())
                                .tipoPago(renovacion.getTipoPago())
                                .pagoAdelantado(calculoNuevo.pagoAdelantado())
                                .garantiaDescripcion(renovacion.getGarantiaDescripcion())
                                .evidenciaUrls(evidenciaUrls)
                                .videoEntregaUrl(videoEntregaUrl)
                                .estado(EstadoCredito.ACTIVO)
                                .fechaInicio(hoy)
                                .fechaDesembolso(DateTimeUtils.ahoraEnMagno())
                                .aprobadoPor(renovacion.getAprobadoPor())
                                .fechaAprobacion(renovacion.getFechaAprobacion())
                                .createdBy(confirmador)
                                .build();
                creditoRepo.save(creditoNuevo);

                // 5. Generar calendario de pagos
                calculoService.generarCalendario(
                                creditoNuevo, hoy, calculoNuevo.plazo(), calculoNuevo,
                                creditoAnterior.getSucursal().getId());
                creditoRepo.save(creditoNuevo);

                // 6. Actualizar renovación → ACTIVO
                renovacion.setCreditoNuevo(creditoNuevo);
                renovacion.setEstado(EstadoRenovacion.ACTIVO);
                renovacion.setConfirmadoPor(confirmador);
                renovacion.setFechaConfirmacion(DateTimeUtils.ahoraEnMagno());
                renovacion.setFecha(hoy);
                renovacion.setMontoDesembolso(montoDesembolso);
                if (videoEntregaUrl != null && !videoEntregaUrl.isBlank()) {
                        renovacion.setVideoEntregaUrl(videoEntregaUrl);
                }
                renovacionRepo.save(renovacion);

                log.info("Renovación ACTIVA (desembolso confirmado) — renovacion.id=" + renovacion.getId()
                                + " credito_anterior=" + creditoAnterior.getId()
                                + " credito_nuevo=" + creditoNuevo.getId()
                                + " confirmado_por=" + confirmador.getNombreCompleto());

                return RenovacionDetalleDTO.from(renovacion);
        }
```

- [ ] **Step 4: Agregar método `getPendientesDesembolso` en el service**

Agregar después de `confirmarDesembolso`:
```java
        public List<RenovacionDetalleDTO> getPendientesDesembolso(Long sucursalId) {
                return renovacionRepo
                                .findPendientesDesembolso(sucursalId)
                                .stream()
                                .map(RenovacionDetalleDTO::from)
                                .toList();
        }
```

- [ ] **Step 5: Actualizar el controller — reemplazar `aprobar` y agregar dos endpoints nuevos**

Reemplazar el método `aprobar` existente:
```java
    // ────────────────────────────────────────────────────────────────────
    // PATCH /api/renovaciones/{id}/aprobar
    // Solo ADMINISTRADOR y SUPERVISOR — guarda montoAprobado, NO toca créditos
    // ────────────────────────────────────────────────────────────────────

    @PatchMapping("/{id}/aprobar")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<RenovacionDetalleDTO> aprobar(
            @PathVariable Long id,
            @RequestBody(required = false) RenovacionAprobarRequest req,
            Authentication auth) {

        JwtPrincipal p = principal(auth);
        java.math.BigDecimal montoAprobado = (req != null) ? req.montoAprobado() : null;
        return ResponseEntity.ok(renovacionService.aprobarRenovacion(id, montoAprobado, p.userId()));
    }
```

Agregar después del endpoint `aprobar`:
```java
    // ────────────────────────────────────────────────────────────────────
    // PATCH /api/renovaciones/{id}/confirmar-desembolso
    // Todos los roles — confirma entrega del efectivo; activa el crédito
    // ────────────────────────────────────────────────────────────────────

    @PatchMapping("/{id}/confirmar-desembolso")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<RenovacionDetalleDTO> confirmarDesembolso(
            @PathVariable Long id,
            @RequestBody(required = false) RenovacionConfirmarDesembolsoRequest req,
            Authentication auth) {

        JwtPrincipal p = principal(auth);
        String videoUrl = (req != null) ? req.videoEntregaUrl() : null;
        return ResponseEntity.ok(renovacionService.confirmarDesembolso(id, p.userId(), videoUrl));
    }

    // ────────────────────────────────────────────────────────────────────
    // GET /api/renovaciones/pendientes-desembolso
    // Renovaciones APROBADAS pendientes — solo ADMINISTRADOR y SUPERVISOR
    // ────────────────────────────────────────────────────────────────────

    @GetMapping("/pendientes-desembolso")
    @PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
    public ResponseEntity<List<RenovacionDetalleDTO>> pendientesDesembolso(
            @AuthenticationPrincipal JwtPrincipal p) {

        Long effectiveSucursalId = null;
        if ("SUPERVISOR".equals(p.rol())) {
            effectiveSucursalId = p.sucursalId();
        }
        return ResponseEntity.ok(renovacionService.getPendientesDesembolso(effectiveSucursalId));
    }
```

- [ ] **Step 6: Commit**
```bash
git add backend/src/main/java/com/magno/repository/RenovacionRepository.java \
        backend/src/main/java/com/magno/service/RenovacionService.java \
        backend/src/main/java/com/magno/controller/RenovacionController.java
git commit -m "feat(renovaciones): flujo dos pasos — aprobar guarda montoAprobado, confirmar activa crédito"
```

---

### Task 7: Frontend — Actualizar tipos y servicio

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/renovacionService.ts`

- [ ] **Step 1: Agregar ACTIVO a EstadoRenovacion en types/index.ts**

Cambiar la línea (actualmente línea 22):
```typescript
export type EstadoRenovacion = 'SOLICITADO' | 'APROBADO' | 'RECHAZADO'
```
A:
```typescript
export type EstadoRenovacion = 'SOLICITADO' | 'APROBADO' | 'RECHAZADO' | 'ACTIVO'
```

- [ ] **Step 2: Actualizar interfaz RenovacionDetalle**

Reemplazar la interfaz `RenovacionDetalle` (actualmente líneas 585-607) con:
```typescript
export interface RenovacionDetalle {
  id: number
  cliente: { id: number; nombreCompleto: string; celular: string }
  asesor: { id: number; nombreCompleto: string; sucursalNombre: string }
  creditoAnterior: { id: number; montoCapital: number; plazoDias: number; pagoPeriodico: number; estado: string }
  creditoNuevo: { id: number; montoCapital: number; plazoDias: number; pagoPeriodico: number; estado: string } | null
  fecha: string
  estado: EstadoRenovacion
  aprobadoPor: { id: number; nombreCompleto: string } | null
  fechaAprobacion: string | null
  motivoRechazo: string | null
  montoNuevo: number
  montoAprobado: number | null
  confirmadoPor: { id: number; nombreCompleto: string } | null
  fechaConfirmacion: string | null
  tipoPago: TipoPago
  pagosRestantes: number
  montoPagosRestantes: number
  multasPendientes: number
  pagoAdelantado: number
  montoDesembolso: number
  garantiaDescripcion: string | null
  videoEntregaUrl: string | null
  evidenciaUrls: string[]
  createdAt: string
}
```

- [ ] **Step 3: Actualizar normalizeDetalle en renovacionService.ts**

En la función `normalizeDetalle`, agregar después de `motivoRechazo`:
```typescript
    montoAprobado: raw.montoAprobado ?? raw.monto_aprobado ?? null,
    confirmadoPor: raw.confirmadoPor ?? raw.confirmado_por ?? null,
    fechaConfirmacion: raw.fechaConfirmacion ?? raw.fecha_confirmacion ?? null,
```

- [ ] **Step 4: Reemplazar el método `aprobar` existente en renovacionService y agregar los nuevos**

Reemplazar el método `aprobar` existente:
```typescript
  aprobar: (renovacionId: number, montoAprobado?: number): Promise<RenovacionDetalle> =>
    api.patch(`/renovaciones/${renovacionId}/aprobar`, { montoAprobado: montoAprobado ?? null })
      .then((r) => normalizeDetalle(r.data)),
```

Agregar después de `aprobar`:
```typescript
  confirmarDesembolso: (renovacionId: number, videoEntregaUrl?: string): Promise<RenovacionDetalle> =>
    api.patch(`/renovaciones/${renovacionId}/confirmar-desembolso`, {
      videoEntregaUrl: videoEntregaUrl ?? null,
    }).then((r) => normalizeDetalle(r.data)),

  getPendientesDesembolso: (): Promise<RenovacionDetalle[]> =>
    api.get('/renovaciones/pendientes-desembolso')
      .then((r) => (r.data as any[]).map(normalizeDetalle)),
```

- [ ] **Step 5: Commit**
```bash
git add frontend/src/types/index.ts \
        frontend/src/services/renovacionService.ts
git commit -m "feat(renovaciones): tipos ACTIVO, montoAprobado, confirmadoPor; métodos confirmarDesembolso y getPendientesDesembolso"
```

---

### Task 8: Frontend — Eliminar restricción de monto en TabNuevaRenovacion (Cambio 1)

**Files:**
- Modify: `frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx`

- [ ] **Step 1: Eliminar la variable `montoViolado` y su uso en `canContinue`**

Eliminar la línea (~190):
```typescript
  const montoViolado = calculo?.advertenciaMonto != null
```

Cambiar `canContinue` de:
```typescript
  const canContinue =
    clienteSeleccionado != null &&
    creditoActivo != null &&
    elegible &&
    montoValido &&
    calculo != null &&
    !montoViolado
```
A:
```typescript
  const canContinue =
    clienteSeleccionado != null &&
    creditoActivo != null &&
    elegible &&
    montoValido &&
    calculo != null
```

- [ ] **Step 2: Eliminar el Info box de restricción de monto (~líneas 335-343)**

Eliminar completamente:
```tsx
              {!calculo?.puedeAumentarMonto && (
                <div className="mb-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Con {creditoActivo.estadisticas.pagosPendientes} pago(s) pendiente(s), el monto nuevo debe ser
                    igual o menor al crédito anterior ({fmt(creditoActivo.montoCapital)}).
                  </p>
                </div>
              )}
```

- [ ] **Step 3: Eliminar el bloque de error advertenciaMonto (~líneas 360-365)**

Eliminar completamente:
```tsx
              {calculo?.advertenciaMonto && (
                <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{calculo.advertenciaMonto}</p>
                </div>
              )}
```

- [ ] **Step 4: Limpiar imports sin usar**

Verificar si `Info` y `AlertTriangle` se usan en otro lugar del mismo archivo. Si no, eliminarlos del import de `lucide-react`.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx
git commit -m "feat(renovaciones): eliminar restricción de monto UI — canContinue y bloques de advertencia"
```

---

### Task 9: Frontend — Monto aprobado editable en TarjetaPendiente (Cambio 2)

**Files:**
- Modify: `frontend/src/pages/renovaciones/TabPendientesRenovacion.tsx`

El componente principal `TabPendientesRenovacion` necesita estado para los montos editados por tarjeta, y la función `TarjetaPendiente` necesita recibir y mostrar el campo editable con recálculo en tiempo real vía la API de cálculo existente (`renovacionService.calcular`).

- [ ] **Step 1: Agregar imports necesarios al inicio del archivo**

Agregar `useRef` a los imports de React si no está:
```typescript
import { useState, useRef } from 'react'
```

Agregar `renovacionService` si no está importado (ya está en el archivo).

- [ ] **Step 2: Actualizar la interfaz `TarjetaProps`**

Reemplazar la interfaz `TarjetaProps` actual con:
```typescript
interface TarjetaProps {
  renovacion: RenovacionDetalle
  dismissing: boolean
  montoAprobadoStr: string
  onMontoAprobadoChange: (val: string) => void
  montoDesembolsoCalculado: number | null
  calculandoMonto: boolean
  onAprobar: () => void
  onRechazar: () => void
  loadingAprobar: boolean
  loadingRechazar: boolean
}
```

- [ ] **Step 3: Actualizar la firma de `TarjetaPendiente` para desestructurar los nuevos props**

```typescript
function TarjetaPendiente({
  renovacion: r,
  dismissing,
  montoAprobadoStr,
  onMontoAprobadoChange,
  montoDesembolsoCalculado,
  calculandoMonto,
  onAprobar,
  onRechazar,
  loadingAprobar,
  loadingRechazar,
}: TarjetaProps) {
```

- [ ] **Step 4: En el cuerpo de `TarjetaPendiente` — reemplazar la zona derecha del grid**

Reemplazar el bloque "Zona derecha — números para la decisión" completo con:
```tsx
        {/* Zona derecha — números y monto aprobado editable */}
        <div className="space-y-3">
          {/* Comparación crédito anterior vs solicitado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
              <p className="text-xs text-gray-400 mb-0.5">Crédito anterior</p>
              <p className="text-base font-bold text-gray-700">{fmt(r.creditoAnterior.montoCapital)}</p>
              <p className="text-xs text-gray-400">{r.creditoAnterior.plazoDias} días</p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
              <p className="text-xs text-gray-400 mb-0.5">Monto solicitado</p>
              <p className="text-base font-bold text-gray-500">{fmt(r.montoNuevo)}</p>
              <p className="text-xs text-gray-400">{r.tipoPago === 'DIARIO' ? 'Diario' : 'Semanal'}</p>
            </div>
          </div>

          {/* Monto aprobado — editable inline */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Monto Aprobado
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min={1000}
                step={500}
                value={montoAprobadoStr}
                onChange={(e) => onMontoAprobadoChange(e.target.value)}
                className="input pl-7 w-full text-sm"
                placeholder={String(r.montoNuevo)}
              />
            </div>
          </div>

          {/* Pagos restantes */}
          <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
            <span className="text-gray-500">Pagos restantes</span>
            <span className="font-medium text-gray-700">
              {r.pagosRestantes} pago{r.pagosRestantes !== 1 ? 's' : ''} · {fmt(r.montoPagosRestantes)}
            </span>
          </div>

          {/* Multas */}
          <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
            <span className="text-gray-500">Multas a descontar</span>
            <span className={tieneMultas ? 'font-semibold text-red-600' : 'text-gray-400'}>
              {tieneMultas ? fmt(r.multasPendientes) : '$0'}
            </span>
          </div>

          {/* Monto a desembolsar — recalculado en tiempo real */}
          <div className="rounded-xl bg-white border-2 border-[#3d6b35]/30 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">Monto a desembolsar</span>
            {calculandoMonto ? (
              <span className="w-5 h-5 border-2 border-[#3d6b35] border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className={`text-xl font-extrabold tabular-nums ${
                (montoDesembolsoCalculado ?? Number(r.montoDesembolso)) >= 0
                  ? 'text-[#3d6b35]'
                  : 'text-red-600'
              }`}>
                {fmt(montoDesembolsoCalculado ?? r.montoDesembolso)}
              </span>
            )}
          </div>
        </div>
```

- [ ] **Step 5: Agregar estado y lógica de debounce en `TabPendientesRenovacion`**

Agregar después de `const [dismissingIds, setDismissingIds] = useState<Set<number>>(new Set())`:
```typescript
  const [montosAprobados, setMontosAprobados] = useState<Record<number, string>>({})
  const [calculos, setCalculos] = useState<Record<number, { desembolso: number; loading: boolean }>>({})
  const calcTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  function handleMontoChange(renovacionId: number, creditoAnteriorId: number, val: string) {
    setMontosAprobados((prev) => ({ ...prev, [renovacionId]: val }))
    if (calcTimers.current[renovacionId]) clearTimeout(calcTimers.current[renovacionId])
    const num = parseFloat(val)
    if (!Number.isFinite(num) || num < 1000) {
      setCalculos((prev) => ({ ...prev, [renovacionId]: { desembolso: 0, loading: false } }))
      return
    }
    setCalculos((prev) => ({ ...prev, [renovacionId]: { ...prev[renovacionId], loading: true } }))
    calcTimers.current[renovacionId] = setTimeout(async () => {
      try {
        const result = await renovacionService.calcular(creditoAnteriorId, num)
        setCalculos((prev) => ({
          ...prev,
          [renovacionId]: { desembolso: result.montoDesembolso, loading: false },
        }))
      } catch {
        setCalculos((prev) => ({ ...prev, [renovacionId]: { ...prev[renovacionId], loading: false } }))
      }
    }, 400)
  }
```

- [ ] **Step 6: Actualizar `aprobarMutation` para pasar montoAprobado**

Reemplazar el `aprobarMutation` existente con:
```typescript
  const aprobarMutation = useMutation({
    mutationFn: (id: number) => {
      const montoStr = montosAprobados[id]
      const monto = montoStr ? parseFloat(montoStr) : undefined
      return renovacionService.aprobar(id, Number.isFinite(monto) ? monto : undefined)
    },
    onSuccess: (_data, id) => {
      toast.success('Solicitud aprobada — pendiente de confirmación del desembolso')
      dismissAndRefresh(id, () => {
        queryClient.invalidateQueries({ queryKey: ['renovaciones-pendientes-desembolso'] })
      })
    },
    onError: (err: any) => toast.error(err?.message ?? 'Error al aprobar'),
  })
```

- [ ] **Step 7: Actualizar el render del `map` en el JSX**

Reemplazar `{pendientes.map((r) => (` con:
```tsx
      {pendientes.map((r) => (
        <TarjetaPendiente
          key={r.id}
          renovacion={r}
          dismissing={dismissingIds.has(r.id)}
          montoAprobadoStr={montosAprobados[r.id] ?? String(r.montoNuevo)}
          onMontoAprobadoChange={(val) => handleMontoChange(r.id, r.creditoAnterior.id, val)}
          montoDesembolsoCalculado={calculos[r.id]?.desembolso ?? null}
          calculandoMonto={calculos[r.id]?.loading ?? false}
          onAprobar={() => aprobarMutation.mutate(r.id)}
          onRechazar={() => setRechazandoId(r.id)}
          loadingAprobar={aprobarMutation.isPending}
          loadingRechazar={rechazarMutation.isPending}
        />
      ))}
```

- [ ] **Step 8: Commit**
```bash
git add frontend/src/pages/renovaciones/TabPendientesRenovacion.tsx
git commit -m "feat(renovaciones): monto aprobado editable inline con recálculo en tiempo real"
```

---

### Task 10: Frontend — Crear TabPendientesDesembolso (Cambio 3 — vista gerentes)

**Files:**
- Create: `frontend/src/pages/renovaciones/TabPendientesDesembolso.tsx`

- [ ] **Step 1: Crear el archivo completo**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  CheckCircle,
  Building2,
  User,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Video,
} from 'lucide-react'
import { renovacionService } from '@/services/renovacionService'
import FileUpload from '@/components/FileUpload'
import type { RenovacionDetalle } from '@/types'

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

interface TarjetaDesembolsoProps {
  renovacion: RenovacionDetalle
  dismissing: boolean
  onConfirmar: (videoUrl: string | undefined) => void
  loading: boolean
}

function TarjetaDesembolso({ renovacion: r, dismissing, onConfirmar, loading }: TarjetaDesembolsoProps) {
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined)
  const tieneMultas = Number(r.multasPendientes) > 0
  const montoAprobado = r.montoAprobado ?? r.montoNuevo
  const montoModificado = r.montoAprobado != null && Number(r.montoAprobado) !== Number(r.montoNuevo)

  return (
    <div className={`card overflow-hidden transition-all duration-300 ease-in-out ${
      dismissing ? 'opacity-0 scale-95 -translate-y-1 pointer-events-none' : ''
    }`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-amber-50/60 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-base truncate">{r.cliente.nombreCompleto}</h3>
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5">
              Listo para desembolsar
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 flex-shrink-0" />{r.asesor.nombreCompleto}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3 flex-shrink-0" />{r.asesor.sucursalNombre}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              Aprobada {fmtDateTime(r.fechaAprobacion)}
            </span>
          </div>
          {r.aprobadoPor && (
            <p className="text-xs text-gray-400 mt-1">Aprobada por: {r.aprobadoPor.nombreCompleto}</p>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Izquierda: multas y video */}
        <div className="space-y-4">
          {tieneMultas ? (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-700">Multas a descontar</p>
                <p className="text-sm font-bold text-red-600">{fmt(r.multasPendientes)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="text-xs text-gray-500">Sin multas pendientes</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" />
              Video de entrega <span className="font-normal text-gray-400">(opcional)</span>
            </p>
            {videoUrl ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <span className="text-green-700 text-xs font-medium">✓ Video listo</span>
                <button
                  type="button"
                  onClick={() => setVideoUrl(undefined)}
                  className="ml-auto text-xs text-gray-400 underline hover:text-gray-600"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <FileUpload
                accept="video/mp4,video/quicktime,video/mov"
                compress={false}
                folder={`video-entrega/renovaciones/${r.id}`}
                label="Video de entrega (opcional)"
                onUploadComplete={(url) => setVideoUrl(url)}
              />
            )}
          </div>
        </div>

        {/* Derecha: montos */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
              <p className="text-xs text-gray-400 mb-0.5">Crédito anterior</p>
              <p className="text-base font-bold text-gray-700">{fmt(r.creditoAnterior.montoCapital)}</p>
            </div>
            <div className="rounded-lg bg-[#3d6b35]/5 border border-[#3d6b35]/20 px-3 py-2.5">
              <div className="flex items-center gap-1 mb-0.5">
                <TrendingUp className="w-3 h-3 text-[#3d6b35]" />
                <p className="text-xs text-[#3d6b35] font-medium">Monto aprobado</p>
              </div>
              <p className="text-base font-bold text-[#3d6b35]">{fmt(montoAprobado)}</p>
              {montoModificado && (
                <p className="text-xs text-gray-400">Solicitado: {fmt(r.montoNuevo)}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
            <span className="text-gray-500">Pagos restantes</span>
            <span className="font-medium text-gray-700">
              {r.pagosRestantes} · {fmt(r.montoPagosRestantes)}
            </span>
          </div>

          <div className="rounded-xl bg-white border-2 border-[#3d6b35]/30 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">A entregar al cliente</span>
            <span className={`text-xl font-extrabold tabular-nums ${
              Number(r.montoDesembolso) >= 0 ? 'text-[#3d6b35]' : 'text-red-600'
            }`}>
              {fmt(r.montoDesembolso)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 bg-amber-50/40">
        <button
          type="button"
          onClick={() => onConfirmar(videoUrl)}
          disabled={loading}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          {loading ? 'Confirmando…' : 'Confirmar desembolso'}
        </button>
      </div>
    </div>
  )
}

export default function TabPendientesDesembolso() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(new Set())

  const { data: pendientes = [], isLoading, isError } = useQuery({
    queryKey: ['renovaciones-pendientes-desembolso'],
    queryFn: () => renovacionService.getPendientesDesembolso(),
    select: (data) => [...data].sort(
      (a, b) =>
        new Date(a.fechaAprobacion ?? '').getTime() -
        new Date(b.fechaAprobacion ?? '').getTime()
    ),
  })

  function dismissAndRefresh(id: number, callback?: () => void) {
    setDismissingIds((prev) => new Set([...prev, id]))
    setTimeout(() => {
      callback?.()
      queryClient.invalidateQueries({ queryKey: ['renovaciones-pendientes-desembolso'] })
      queryClient.invalidateQueries({ queryKey: ['creditos'] })
    }, 320)
  }

  const confirmarMutation = useMutation({
    mutationFn: ({ id, videoUrl }: { id: number; videoUrl?: string }) =>
      renovacionService.confirmarDesembolso(id, videoUrl),
    onSuccess: (data, { id }) => {
      toast.success('Desembolso confirmado — nuevo crédito activado')
      dismissAndRefresh(id, () => {
        if (data.creditoNuevo) navigate(`/creditos/${data.creditoNuevo.id}`)
      })
    },
    onError: (err: any) => toast.error(err?.message ?? 'Error al confirmar'),
  })

  if (isLoading) return <div className="card p-10 text-center text-gray-500">Cargando…</div>
  if (isError) return <div className="card p-10 text-center text-red-600">Error al cargar. Recarga la página.</div>

  if (pendientes.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-amber-500" />
        </div>
        <p className="font-semibold text-gray-700">No hay desembolsos pendientes</p>
        <p className="text-sm text-gray-400 mt-1">Todas las renovaciones aprobadas han sido desembolsadas</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {pendientes.length} renovación{pendientes.length !== 1 ? 'es' : ''} aprobada{pendientes.length !== 1 ? 's' : ''} — confirma la entrega del efectivo al cliente
      </p>
      <div className="space-y-4">
        {pendientes.map((r) => (
          <TarjetaDesembolso
            key={r.id}
            renovacion={r}
            dismissing={dismissingIds.has(r.id)}
            onConfirmar={(videoUrl) => confirmarMutation.mutate({ id: r.id, videoUrl })}
            loading={confirmarMutation.isPending}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/pages/renovaciones/TabPendientesDesembolso.tsx
git commit -m "feat(renovaciones): TabPendientesDesembolso con FileUpload de video para gerentes"
```

---

### Task 11: Frontend — Actualizar RenovacionesPage con nuevo tab

**Files:**
- Modify: `frontend/src/pages/renovaciones/RenovacionesPage.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
import { useState } from 'react'
import TabListosRenovar from './TabListosRenovar'
import TabNuevaRenovacion from './TabNuevaRenovacion'
import TabPendientesRenovacion from './TabPendientesRenovacion'
import TabPendientesDesembolso from './TabPendientesDesembolso'
import TabMisSolicitudes from './TabMisSolicitudes'
import { useAuthStore } from '@/hooks/useAuthStore'
import type { ClienteResumen } from '@/types'

type Tab = 'listos' | 'nueva' | 'pendientes' | 'desembolso' | 'mis-solicitudes'

export default function RenovacionesPage() {
  const { usuario } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('listos')
  const [clientePreseleccionado, setClientePreseleccionado] = useState<ClienteResumen | null>(null)

  const isGerente = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'
  const puedeCrear  = usuario?.rol === 'SUPERVISOR_CAMPO' || usuario?.rol === 'ASESOR_COBRADOR'

  function handleRenovar(cliente: ClienteResumen) {
    setClientePreseleccionado(cliente)
    setActiveTab('nueva')
  }

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'listos',          label: 'Listos para Renovar',      visible: true },
    { id: 'pendientes',      label: 'Pendientes de Aprobación', visible: isGerente },
    { id: 'desembolso',      label: 'Pendientes de Desembolso', visible: isGerente },
    { id: 'nueva',           label: 'Nueva Solicitud',          visible: puedeCrear },
    { id: 'mis-solicitudes', label: 'Mis Solicitudes',          visible: puedeCrear },
  ]

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Renovaciones</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isGerente
            ? 'Aprueba solicitudes y confirma los desembolsos de renovación'
            : 'Consulta clientes listos para renovar y envía solicitudes'}
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Pestañas">
          {tabs.filter((t) => t.visible).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={
                activeTab === tab.id
                  ? 'border-b-2 border-[#3d6b35] text-[#3d6b35] pb-3 text-sm font-semibold whitespace-nowrap'
                  : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 pb-3 text-sm font-medium whitespace-nowrap'
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'listos' && (
        <TabListosRenovar onRenovar={handleRenovar} />
      )}
      {activeTab === 'pendientes' && isGerente && (
        <TabPendientesRenovacion />
      )}
      {activeTab === 'desembolso' && isGerente && (
        <TabPendientesDesembolso />
      )}
      {activeTab === 'nueva' && puedeCrear && (
        <TabNuevaRenovacion
          initialCliente={clientePreseleccionado}
          onClearInitial={() => setClientePreseleccionado(null)}
        />
      )}
      {activeTab === 'mis-solicitudes' && puedeCrear && (
        <TabMisSolicitudes />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/pages/renovaciones/RenovacionesPage.tsx
git commit -m "feat(renovaciones): tab Pendientes de Desembolso en RenovacionesPage"
```

---

### Task 12: Frontend — Actualizar TabMisSolicitudes (ACTIVO badge + confirmar desembolso)

**Files:**
- Modify: `frontend/src/pages/renovaciones/TabMisSolicitudes.tsx`

- [ ] **Step 1: Agregar ACTIVO a ESTADO_CONFIG**

En el objeto `ESTADO_CONFIG`, agregar la entrada para ACTIVO:
```typescript
  ACTIVO: {
    label: 'Activa',
    chip: 'bg-teal-100 text-teal-800 ring-1 ring-teal-200',
    dot: 'bg-teal-500',
    pulse: false,
  },
```

- [ ] **Step 2: Actualizar FILTROS para incluir APROBADO y ACTIVO**

Reemplazar el array `FILTROS`:
```typescript
const FILTROS: { value: FiltroEstado; label: string }[] = [
  { value: 'TODOS', label: 'Todas' },
  { value: 'SOLICITADO', label: 'En revisión' },
  { value: 'APROBADO', label: 'Pendiente desembolso' },
  { value: 'ACTIVO', label: 'Activas' },
  { value: 'RECHAZADO', label: 'Rechazadas' },
]
```

- [ ] **Step 3: Agregar imports necesarios al inicio del archivo**

Agregar al import block si no están ya:
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import FileUpload from '@/components/FileUpload'
```

- [ ] **Step 4: Convertir TarjetaSolicitud en componente con estado y mutation**

Reemplazar la interfaz y la función `TarjetaSolicitud` actuales con:

```tsx
function TarjetaSolicitud({
  r,
  onConfirmadoExitoso,
}: {
  r: RenovacionDetalle
  onConfirmadoExitoso: (data: RenovacionDetalle) => void
}) {
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined)
  const tieneMultas = Number(r.multasPendientes) > 0
  const montoAprobado = r.montoAprobado ?? r.montoNuevo
  const montoModificado = r.montoAprobado != null && Number(r.montoAprobado) !== Number(r.montoNuevo)

  const confirmarMutation = useMutation({
    mutationFn: () => renovacionService.confirmarDesembolso(r.id, videoUrl),
    onSuccess: (data) => {
      toast.success('Desembolso confirmado — nuevo crédito activado')
      onConfirmadoExitoso(data)
    },
    onError: (err: any) => toast.error(err?.message ?? 'Error al confirmar'),
  })

  return (
    <div className="card overflow-hidden">
      {/* Header — igual que antes */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 text-base truncate">{r.cliente.nombreCompleto}</h3>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 flex-shrink-0" />
            Enviada {fmtDateTime(r.createdAt)}
          </p>
        </div>
        <EstadoBadge estado={r.estado} />
      </div>

      {/* Cuerpo */}
      <div className="px-5 py-4 space-y-4">
        {/* Resumen de montos */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
            <p className="text-xs text-gray-400 mb-0.5">Crédito anterior</p>
            <p className="text-base font-bold text-gray-700">{fmt(r.creditoAnterior.montoCapital)}</p>
            <p className="text-xs text-gray-400">{r.creditoAnterior.plazoDias} días</p>
          </div>
          <div className="rounded-lg bg-[#3d6b35]/5 border border-[#3d6b35]/20 px-3 py-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="w-3 h-3 text-[#3d6b35]" />
              <p className="text-xs text-[#3d6b35] font-medium">
                {r.estado === 'SOLICITADO' ? 'Crédito nuevo' : 'Monto aprobado'}
              </p>
            </div>
            <p className="text-base font-bold text-[#3d6b35]">{fmt(montoAprobado)}</p>
            {montoModificado && r.estado !== 'SOLICITADO' && (
              <p className="text-xs text-gray-400">Solicitado: {fmt(r.montoNuevo)}</p>
            )}
            {r.estado === 'SOLICITADO' && (
              <p className="text-xs text-gray-400">{r.tipoPago === 'DIARIO' ? 'Diario' : 'Semanal'}</p>
            )}
          </div>
        </div>

        {/* Detalle */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="text-gray-500">Pagos restantes al enviar</span>
            <span className="font-medium text-gray-700">
              {r.pagosRestantes} pago{r.pagosRestantes !== 1 ? 's' : ''} · {fmt(r.montoPagosRestantes)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="text-gray-500">Multas pendientes</span>
            <span className={tieneMultas ? 'font-semibold text-red-600' : 'text-gray-400'}>
              {tieneMultas ? fmt(r.multasPendientes) : 'Sin multas'}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-2 rounded-xl bg-white border-2 border-[#3d6b35]/20 px-3 py-2">
            <span className="text-sm font-semibold text-gray-600">Monto a desembolsar</span>
            <span className={`text-lg font-extrabold tabular-nums ${Number(r.montoDesembolso) >= 0 ? 'text-[#3d6b35]' : 'text-red-600'}`}>
              {fmt(r.montoDesembolso)}
            </span>
          </div>
        </div>

        {/* Caso RECHAZADO */}
        {r.estado === 'RECHAZADO' && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-700 mb-0.5">Motivo del rechazo</p>
              <p className="text-sm text-red-600">
                {r.motivoRechazo && r.motivoRechazo.trim().length > 0
                  ? r.motivoRechazo
                  : 'No se especificó un motivo.'}
              </p>
              {r.aprobadoPor && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Rechazada por {r.aprobadoPor.nombreCompleto} · {fmtDateTime(r.fechaAprobacion)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Caso APROBADO — pendiente de desembolso */}
        {r.estado === 'APROBADO' && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-0.5">
                ✓ El gerente aprobó esta renovación
              </p>
              {montoModificado && (
                <p className="text-xs text-amber-700">
                  Monto ajustado: <strong>{fmt(montoAprobado)}</strong> (solicitado: {fmt(r.montoNuevo)})
                </p>
              )}
              {r.aprobadoPor && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                  <User className="w-3 h-3" />
                  Aprobada por {r.aprobadoPor.nombreCompleto} · {fmtDateTime(r.fechaAprobacion)}
                </p>
              )}
              <p className="text-xs text-amber-600 mt-1.5">
                Confirma cuando hayas entregado el efectivo al cliente.
              </p>
            </div>

            {videoUrl ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <span className="text-green-700 text-xs font-medium">✓ Video listo para adjuntar</span>
                <button
                  type="button"
                  onClick={() => setVideoUrl(undefined)}
                  className="ml-auto text-xs text-gray-400 underline hover:text-gray-600"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <FileUpload
                accept="video/mp4,video/quicktime,video/mov"
                compress={false}
                folder={`video-entrega/renovaciones/${r.id}`}
                label="Video de entrega (opcional)"
                onUploadComplete={(url) => setVideoUrl(url)}
              />
            )}

            <button
              type="button"
              onClick={() => confirmarMutation.mutate()}
              disabled={confirmarMutation.isPending}
              className="w-full btn-primary text-sm py-2.5 disabled:opacity-50"
            >
              {confirmarMutation.isPending ? 'Confirmando…' : 'Confirmar desembolso →'}
            </button>
          </div>
        )}

        {/* Caso ACTIVO — crédito generado */}
        {r.estado === 'ACTIVO' && r.creditoNuevo && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 space-y-2">
            <Link
              to={`/creditos/${r.creditoNuevo.id}`}
              className="flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-800 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ver crédito activo →
            </Link>
            {r.confirmadoPor && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <User className="w-3 h-3" />
                Desembolsado por {r.confirmadoPor.nombreCompleto} · {fmtDateTime(r.fechaConfirmacion)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Actualizar `TabMisSolicitudes` para pasar `onConfirmadoExitoso`**

```typescript
export default function TabMisSolicitudes() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<FiltroEstado>('TODOS')

  const { data: solicitudes = [], isLoading, isError } = useQuery({
    queryKey: ['mis-solicitudes-renovacion'],
    queryFn: () => renovacionService.getMisSolicitudes(),
  })

  function handleConfirmadoExitoso(data: RenovacionDetalle) {
    queryClient.invalidateQueries({ queryKey: ['mis-solicitudes-renovacion'] })
    queryClient.invalidateQueries({ queryKey: ['creditos'] })
    if (data.creditoNuevo) {
      navigate(`/creditos/${data.creditoNuevo.id}`)
    }
  }

  // ... (filtros y renders igual que antes, pero en el map:)
  {visibles.map((r) => (
    <TarjetaSolicitud key={r.id} r={r} onConfirmadoExitoso={handleConfirmadoExitoso} />
  ))}
```

- [ ] **Step 6: Agregar `Link` y `ExternalLink` a los imports si no están**

```typescript
import { Link } from 'react-router-dom'
import { ..., ExternalLink } from 'lucide-react'
```

- [ ] **Step 7: Commit**
```bash
git add frontend/src/pages/renovaciones/TabMisSolicitudes.tsx
git commit -m "feat(renovaciones): ACTIVO badge, confirmar desembolso con video en TabMisSolicitudes"
```

---

### Task 13: Seed — Agregar muestra APROBADO pendiente de desembolso

**Files:**
- Modify: `backend/src/main/resources/db/seed_dev_02_centro.sql`

En el DO block de este archivo, buscar la sección donde se insertan las renovaciones SOLICITADAS (hay variables `v_sol_isabel`, `v_sol_ramon`, `v_sol_vero`). Agregar una renovación adicional en APROBADO con `v_c14` (Patricia Castillo — crédito activo con pago 20/30, listo para renovar).

- [ ] **Step 1: En el bloque DECLARE, agregar la variable**

Después de `v_sol_vero BIGINT;`, agregar:
```sql
  v_ren_aprobada BIGINT; -- Renovación APROBADO pendiente desembolso (Patricia)
```

- [ ] **Step 2: En el bloque DO, después de las inserciones SOLICITADO existentes, agregar**

Buscar el crédito activo de Patricia (v_c14) y agregar la renovación APROBADO. Patricia tiene un crédito de $25,000 a 30 días con 20 pagos realizados (10 restantes). Agregar después de la sección de renovaciones SOLICITADAS:

```sql
  -- ─── Renovación APROBADO pendiente de desembolso (Patricia Castillo) ─────────
  SELECT id INTO v_ca FROM creditos WHERE cliente_id = v_c14 AND estado = 'ACTIVO' LIMIT 1;

  INSERT INTO renovaciones (
      credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id,
      estado, monto_nuevo, monto_aprobado, tipo_pago,
      pagos_restantes, monto_pagos_restantes, multas_pendientes,
      pago_adelantado, monto_desembolso,
      aprobado_por, fecha_aprobacion,
      fecha, created_by, created_at, updated_at
  ) VALUES (
      v_ca, NULL, v_c14, v_ase_c2,
      'APROBADO', 28000.00, 30000.00, 'DIARIO',
      10, (SELECT pago_periodico * 10 FROM creditos WHERE id = v_ca), 0.00,
      ROUND((30000.00 * 1.24) / 25, 2),
      30000.00 - (SELECT pago_periodico * 10 FROM creditos WHERE id = v_ca) - ROUND((30000.00 * 1.24) / 25, 2),
      v_sup_cen, NOW() - INTERVAL '1 hour',
      CURRENT_DATE, v_ase_c2, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'
  ) RETURNING id INTO v_ren_aprobada;
```

- [ ] **Step 3: Commit**
```bash
git add backend/src/main/resources/db/seed_dev_02_centro.sql
git commit -m "seed: renovación APROBADO pendiente de desembolso para Patricia Castillo"
```

---

### Task 14: Actualizar documentación

**Files:**
- Modify: `docs/03-reglas-de-negocio.md`
- Modify: `docs/04-modulos-y-ui.md`
- Modify: `docs/05-modelo-de-datos.md`
- Modify: `docs/06-archivos-y-storage.md`

- [ ] **Step 1: docs/03-reglas-de-negocio.md — flujo de estados y regla de monto**

Buscar la sección de renovaciones y actualizar:
1. El flujo de estados: `SOLICITADO → APROBADO → ACTIVO / RECHAZADO`
2. La regla de monto: eliminar la restricción. Agregar: "El monto del crédito nuevo es a criterio del asesor y puede crecer conforme al historial. No hay restricción basada en pagos pendientes."
3. La fórmula del desembolso sigue igual: `monto_aprobado − pagos_restantes_monto − multas_pendientes − pago_adelantado`

- [ ] **Step 2: docs/04-modulos-y-ui.md — nuevo tab y comportamiento de APROBADO**

1. Actualizar la línea del módulo renovaciones para incluir "Pendientes de Desembolso"
2. Agregar descripción del tab "Pendientes de Desembolso" (gerentes, endpoint `/pendientes-desembolso`, cards con FileUpload de video y botón Confirmar)
3. Actualizar descripción de "Mis Solicitudes" para incluir el caso APROBADO (bloque ámbar, mostrar diferencia de montos, FileUpload, botón Confirmar) y el caso ACTIVO (enlace + confirmadoPor + fechaConfirmacion)
4. Actualizar "Pendientes de Aprobación": el campo de monto es editable inline; al aprobar, NO se crea el crédito

- [ ] **Step 3: docs/05-modelo-de-datos.md — tabla renovaciones**

En la fila de `renovaciones`, actualizar campos para incluir:
- `monto_aprobado DECIMAL(12,2)` (nullable, lo que aprobó el gerente)
- `confirmado_por FK usuarios` (nullable)
- `fecha_confirmacion TIMESTAMPTZ` (nullable)
- Estados: `SOLICITADO | APROBADO | RECHAZADO | ACTIVO`

- [ ] **Step 4: docs/06-archivos-y-storage.md — ruta S3 para video en desembolso**

En la tabla 4.1, la fila de Renovaciones ya tiene `video_entrega_url`. Actualizar el campo "Sección" de "Nueva Renovación" a "Confirmación de Desembolso" (ya que ahora el video se sube al confirmar, no al solicitar).

En la sección 4.3 (árbol S3), agregar:
```
├── video-entrega/
│   ├── creditos/
│   │   └── {credito_id}/
│   │       └── video.mp4
│   └── renovaciones/
│       └── {renovacion_id}/
│           └── video.mp4
```

- [ ] **Step 5: Commit**
```bash
git add docs/03-reglas-de-negocio.md docs/04-modulos-y-ui.md \
        docs/05-modelo-de-datos.md docs/06-archivos-y-storage.md
git commit -m "docs: flujo renovaciones dos pasos, sin restricción de monto, tablas y S3 actualizados"
```

---

## Self-Review

### Spec Coverage Check

| Requisito | Tarea que lo cubre |
|-----------|-------------------|
| Eliminar restricción de monto en backend (calcular + crear) | Task 3 |
| Eliminar advertencia de monto en frontend | Task 8 |
| Campo monto aprobado editable inline en Pendientes de Aprobación | Task 9 |
| Recálculo en tiempo real de desembolso al editar monto | Task 9 |
| Guardar monto_solicitado y monto_aprobado separados | Task 5 (DTO) + Task 6 (service) |
| Mostrar diferencia de montos en Mis Solicitudes | Task 12 |
| Estado APROBADO intermedio (sin crear crédito) | Task 2, 6 |
| Estado ACTIVO (desembolso confirmado, crédito creado) | Task 2, 6 |
| Transición SOLICITADO → APROBADO: solo gerentes | Task 6 |
| Transición APROBADO → ACTIVO: todos los roles | Task 6 |
| Tab Pendientes de Desembolso para gerentes | Task 10, 11 |
| Botón Confirmar en Mis Solicitudes para APROBADO | Task 12 |
| Mensaje "gerente aprobó — confirma cuando entregues" | Task 12 |
| FileUpload de video en confirmación (igual que Créditos Nuevos) | Task 10, 12 |
| Video es opcional, no bloquea confirmación | Task 10, 12 |
| Ruta S3 video-entrega/renovaciones/{id}/ | Task 14 |
| Migración V13 con backfill | Task 1 |
| Seed con al menos un APROBADO | Task 13 |
| Docs 03, 04, 05, 06 | Task 14 |

### Notas de implementación

- **El viejo `aprobarMutation` en `TabPendientesRenovacion`** navegaba al crédito nuevo al aprobar. Esto ya no aplica — el crédito no existe hasta confirmarDesembolso. Task 9 actualiza `onSuccess` para NO navegar.
- **El `dismissAndRefresh` en `TabPendientesRenovacion`** debe invalidar también `['renovaciones-pendientes-desembolso']` para que el nuevo tab se actualice cuando llega una aprobación nueva. Task 9 incluye esto.
- **Los registros existentes** en DB que son APROBADO con `credito_nuevo_id NOT NULL` pasan a ACTIVO en la migración V13. Esto es correcto — son renovaciones completadas antes del nuevo flujo.
- **El campo `video_entrega_url`** ya existe en la tabla desde V10. Solo cambia cuándo/cómo se sube.
- **`TabNuevaRenovacion` Step 2 (confirmación)** tiene un `<input type="file">` manual que no usa `FileUpload`. No se toca en este plan — esa pantalla es para enviar la solicitud, no para confirmar el desembolso.
