# Detalle de Crédito — Vínculos de Renovación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en el detalle de un crédito RENOVADO el bloque "Liquidado por Renovación" y en el crédito nuevo generado el bloque "Originado por Renovación", permitiendo navegar la cadena de créditos de un cliente.

**Architecture:** No se necesita migración — la tabla `renovaciones` ya tiene `credito_anterior_id`, `credito_nuevo_id` y todos los campos requeridos (`created_at`, `pagos_restantes`, `monto_pagos_restantes`, `monto_desembolso`). Se añade un DTO `RenovacionVinculoDTO`, se extiende `CreditoDetalleDTO` con dos campos nullable, se actualiza `buildDetalle` en `CreditoService` para popular esos campos, y se añaden dos bloques visuales al final de `CreditoDetallePage` (fuera del card de tabs).

**Tech Stack:** Spring Boot 3 / Java 17 (records, Optional) + React 18 / TypeScript / Tailwind CSS / TanStack Query

---

## File Map

| Acción | Archivo |
|--------|---------|
| CREATE | `backend/src/main/java/com/magno/dto/credito/RenovacionVinculoDTO.java` |
| MODIFY | `backend/src/main/java/com/magno/dto/credito/CreditoDetalleDTO.java` |
| MODIFY | `backend/src/main/java/com/magno/repository/RenovacionRepository.java` |
| MODIFY | `backend/src/main/java/com/magno/service/CreditoService.java` |
| MODIFY | `frontend/src/types/index.ts` |
| MODIFY | `frontend/src/services/creditoService.ts` |
| MODIFY | `frontend/src/pages/creditos/CreditoDetallePage.tsx` |
| MODIFY | `docs/04-modulos-y-ui.md` |

---

### Task 1: Backend DTO — crear RenovacionVinculoDTO y extender CreditoDetalleDTO

**Files:**
- Create: `backend/src/main/java/com/magno/dto/credito/RenovacionVinculoDTO.java`
- Modify: `backend/src/main/java/com/magno/dto/credito/CreditoDetalleDTO.java`

- [ ] **Step 1: Crear RenovacionVinculoDTO**

Crear el archivo `backend/src/main/java/com/magno/dto/credito/RenovacionVinculoDTO.java` con este contenido exacto:

```java
package com.magno.dto.credito;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record RenovacionVinculoDTO(
        Long renovacionId,
        OffsetDateTime fechaRenovacion,
        Integer pagosRestantes,
        BigDecimal montoPagosRestantes,
        BigDecimal montoDesembolso,
        Long creditoVinculadoId,
        BigDecimal montoCapitalVinculado
) {}
```

- [ ] **Step 2: Extender CreditoDetalleDTO con los dos campos nullable**

El archivo actual está en `backend/src/main/java/com/magno/dto/credito/CreditoDetalleDTO.java`.

Es un Java `record`. Hay que añadir dos parámetros al final del constructor del record (antes del cierre del paréntesis de la declaración del record) y actualizar el método `from()`.

Reemplazar la declaración del record completa (líneas 14–73, desde `public record CreditoDetalleDTO(` hasta el cierre de la clase `Estadisticas`) con:

```java
public record CreditoDetalleDTO(
                Long id,

                // ── Relaciones ────────────────────────────────────────────
                CreditoResumenDTO.ClienteInfo cliente,
                CreditoResumenDTO.UsuarioInfo asesor,
                CreditoResumenDTO.SucursalInfo sucursal,

                // ── Producto ─────────────────────────────────────────────
                BigDecimal montoSolicitado,
                BigDecimal montoCapital,
                BigDecimal tasaInteres,
                BigDecimal cargoFinanciero,
                BigDecimal totalAPagar,
                BigDecimal pagoPeriodico,
                Integer plazoDias,
                String tipoPago,

                // ── Fechas ────────────────────────────────────────────────
                LocalDate fechaInicio,
                LocalDate fechaVencimiento,

                // ── Pago adelantado ───────────────────────────────────────
                BigDecimal pagoAdelantado,

                // ── Garantía y evidencia ──────────────────────────────────
                String garantiaDescripcion,
                String[] evidenciaUrls,
                String lugar,

                // ── Estado ───────────────────────────────────────────────
                String estado,

                // ── Aprobación (V4) ───────────────────────────────────────
                BigDecimal montoAprobado,
                String observaciones,
                OffsetDateTime fechaAprobacion,
                CreditoResumenDTO.UsuarioInfo aprobadoPor,

                // ── Desembolso (V4) ───────────────────────────────────────
                OffsetDateTime fechaDesembolso,
                String videoEntregaUrl,

                // ── Auditoría ────────────────────────────────────────────
                OffsetDateTime createdAt,
                OffsetDateTime updatedAt,

                // ── Calendario ────────────────────────────────────────────
                List<CalendarioPagoDTO> calendario,

                // ── Estadísticas ─────────────────────────────────────────
                Estadisticas estadisticas,

                // ── Vínculos de renovación (nullable) ────────────────────
                RenovacionVinculoDTO liquidadoPorRenovacion,
                RenovacionVinculoDTO originadoPorRenovacion) {

        public record Estadisticas(
                        long pagosRealizados,
                        long pagosPendientes,
                        long pagosVencidos,
                        BigDecimal multasPendientes,
                        boolean elegibleRenovacion) {
        }
```

- [ ] **Step 3: Actualizar el método `from()` para aceptar los dos nuevos parámetros**

Localizar el método `from()` (actualmente empieza en línea ~74). Reemplazarlo completo con:

```java
        public static CreditoDetalleDTO from(Credito c,
                        List<CalendarioPagoDTO> calendario,
                        Estadisticas estadisticas,
                        RenovacionVinculoDTO liquidadoPorRenovacion,
                        RenovacionVinculoDTO originadoPorRenovacion) {
                CreditoResumenDTO.ClienteInfo cliente = new CreditoResumenDTO.ClienteInfo(
                                c.getCliente().getId(),
                                c.getCliente().getNombreCompleto(),
                                c.getCliente().getCelular());
                CreditoResumenDTO.UsuarioInfo asesor = new CreditoResumenDTO.UsuarioInfo(
                                c.getAsesor().getId(),
                                c.getAsesor().getNombreCompleto());
                CreditoResumenDTO.SucursalInfo sucursal = new CreditoResumenDTO.SucursalInfo(
                                c.getSucursal().getId(),
                                c.getSucursal().getNombre());
                CreditoResumenDTO.UsuarioInfo aprobadoPor = c.getAprobadoPor() != null
                                ? new CreditoResumenDTO.UsuarioInfo(
                                                c.getAprobadoPor().getId(),
                                                c.getAprobadoPor().getNombreCompleto())
                                : null;

                return new CreditoDetalleDTO(
                                c.getId(),
                                cliente,
                                asesor,
                                sucursal,
                                c.getMontoSolicitado(),
                                c.getMontoCapital(),
                                c.getTasaInteres(),
                                c.getCargoFinanciero(),
                                c.getTotalAPagar(),
                                c.getPagoPeriodico(),
                                c.getPlazoDias(),
                                c.getTipoPago().name(),
                                c.getFechaInicio(),
                                c.getFechaVencimiento(),
                                c.getPagoAdelantado(),
                                c.getGarantiaDescripcion(),
                                c.getEvidenciaUrls(),
                                c.getLugar(),
                                c.getEstado().name(),
                                c.getMontoAprobado(),
                                c.getObservaciones(),
                                c.getFechaAprobacion(),
                                aprobadoPor,
                                c.getFechaDesembolso(),
                                c.getVideoEntregaUrl(),
                                c.getCreatedAt(),
                                c.getUpdatedAt(),
                                calendario,
                                estadisticas,
                                liquidadoPorRenovacion,
                                originadoPorRenovacion);
        }
}
```

- [ ] **Step 4: Verificar que compila**

```bash
cd backend && ./mvnw compile -q 2>&1 | tail -20
```

Esperado: sin errores de compilación. Si hay errores, son por calls a `CreditoDetalleDTO.from()` que ahora exigen 5 argumentos — se corregirán en Task 2.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/magno/dto/credito/RenovacionVinculoDTO.java \
        backend/src/main/java/com/magno/dto/credito/CreditoDetalleDTO.java
git commit -m "feat(creditos): DTO RenovacionVinculoDTO y campos liquidadoPorRenovacion/originadoPorRenovacion en CreditoDetalleDTO"
```

---

### Task 2: Backend Service — queries y buildDetalle

**Files:**
- Modify: `backend/src/main/java/com/magno/repository/RenovacionRepository.java`
- Modify: `backend/src/main/java/com/magno/service/CreditoService.java`

- [ ] **Step 1: Añadir dos queries a RenovacionRepository**

Abrir `backend/src/main/java/com/magno/repository/RenovacionRepository.java`. Actualmente tiene (aprox.):

```java
@Repository
public interface RenovacionRepository extends JpaRepository<Renovacion, Long> {

    List<Renovacion> findByCreditoAnteriorId(Long creditoAnteriorId);

    @Query("SELECT r FROM Renovacion r " +
           "WHERE r.deletedAt IS NULL " + ...)
    List<Renovacion> findColocaciones(...);
}
```

Añadir dos métodos ANTES del método `findColocaciones`:

```java
    @Query("SELECT r FROM Renovacion r WHERE r.creditoAnterior.id = :creditoId AND r.deletedAt IS NULL")
    Optional<Renovacion> findActivaByCreditoAnteriorId(@Param("creditoId") Long creditoId);

    @Query("SELECT r FROM Renovacion r WHERE r.creditoNuevo.id = :creditoId AND r.deletedAt IS NULL")
    Optional<Renovacion> findActivaByCreditoNuevoId(@Param("creditoId") Long creditoId);
```

El import necesario en el archivo ya existe (`import org.springframework.data.jpa.repository.Query;`). Añadir si falta:
```java
import java.util.Optional;
```

- [ ] **Step 2: Inyectar RenovacionRepository en CreditoService**

En `backend/src/main/java/com/magno/service/CreditoService.java`, actualmente los campos son:

```java
        private final CreditoRepository creditoRepo;
        private final CalendarioPagoRepository calendarioPagoRepo;
        private final ClienteRepository clienteRepo;
        private final UsuarioRepository usuarioRepo;
        private final SucursalRepository sucursalRepo;
        private final CreditoCalculoService calculoService;
```

Añadir `private final RenovacionRepository renovacionRepo;` al final de esa lista.

Actualizar el constructor (que actualmente está en líneas ~46-58) para incluir el nuevo parámetro:

```java
        public CreditoService(CreditoRepository creditoRepo,
                        CalendarioPagoRepository calendarioPagoRepo,
                        ClienteRepository clienteRepo,
                        UsuarioRepository usuarioRepo,
                        SucursalRepository sucursalRepo,
                        CreditoCalculoService calculoService,
                        RenovacionRepository renovacionRepo) {
                this.creditoRepo = creditoRepo;
                this.calendarioPagoRepo = calendarioPagoRepo;
                this.clienteRepo = clienteRepo;
                this.usuarioRepo = usuarioRepo;
                this.sucursalRepo = sucursalRepo;
                this.calculoService = calculoService;
                this.renovacionRepo = renovacionRepo;
        }
```

Añadir el import necesario al inicio del archivo (junto a los demás imports de repository):
```java
import com.magno.repository.RenovacionRepository;
```

- [ ] **Step 3: Actualizar buildDetalle para poblar los vínculos**

En `CreditoService`, localizar el método `buildDetalle(Credito c)` (actualmente en líneas ~424-458). Reemplazarlo completo con:

```java
        private CreditoDetalleDTO buildDetalle(Credito c) {
                List<CalendarioPagoDTO> calendario = calendarioPagoRepo
                                .findByCreditoIdOrderByNumeroPago(c.getId())
                                .stream().map(CalendarioPagoDTO::from).toList();

                LocalDate hoy = DateTimeUtils.hoyEnMagno();
                long pagosRealizados = calendarioPagoRepo.countByCreditoIdAndEstadoIn(c.getId(), ESTADOS_REALIZADOS);
                long pagosPendientes = calendarioPagoRepo.countByCreditoIdAndEstadoIn(
                                c.getId(), List.of(EstadoCalendarioPago.PENDIENTE));
                long pagosVencidos = calendario.stream()
                                .filter(p -> EstadoCalendarioPago.PENDIENTE.name().equals(p.estado())
                                                && p.fechaProgramada() != null
                                                && p.fechaProgramada().isBefore(hoy))
                                .count();

                long pagosNoPagados = calendarioPagoRepo.countByCreditoIdAndEstadoIn(
                                c.getId(), List.of(EstadoCalendarioPago.NO_PAGADO));
                pagosVencidos += pagosNoPagados;

                BigDecimal multasPendientes = creditoRepo.sumMultasPendientes(c.getId());

                int umbralRenovacion = c.getPlazoDias() == 30 ? 19 : 16;
                boolean elegibleRenovacion = c.getEstado() == EstadoCredito.ACTIVO
                                && pagosRealizados >= umbralRenovacion;

                CreditoDetalleDTO.Estadisticas stats = new CreditoDetalleDTO.Estadisticas(
                                pagosRealizados,
                                pagosPendientes,
                                pagosVencidos,
                                multasPendientes,
                                elegibleRenovacion);

                // Vínculo: este crédito fue liquidado por una renovación (estado RENOVADO)
                RenovacionVinculoDTO liquidadoPorRenovacion = null;
                if (c.getEstado() == EstadoCredito.RENOVADO) {
                        liquidadoPorRenovacion = renovacionRepo
                                        .findActivaByCreditoAnteriorId(c.getId())
                                        .map(r -> new RenovacionVinculoDTO(
                                                        r.getId(),
                                                        r.getCreatedAt(),
                                                        r.getPagosRestantes(),
                                                        r.getMontoPagosRestantes(),
                                                        r.getMontoDesembolso(),
                                                        r.getCreditoNuevo().getId(),
                                                        r.getCreditoNuevo().getMontoCapital()))
                                        .orElse(null);
                }

                // Vínculo: este crédito fue creado como resultado de una renovación
                RenovacionVinculoDTO originadoPorRenovacion = renovacionRepo
                                .findActivaByCreditoNuevoId(c.getId())
                                .map(r -> new RenovacionVinculoDTO(
                                                r.getId(),
                                                r.getCreatedAt(),
                                                r.getPagosRestantes(),
                                                r.getMontoPagosRestantes(),
                                                r.getMontoDesembolso(),
                                                r.getCreditoAnterior().getId(),
                                                r.getCreditoAnterior().getMontoCapital()))
                                .orElse(null);

                return CreditoDetalleDTO.from(c, calendario, stats, liquidadoPorRenovacion, originadoPorRenovacion);
        }
```

Añadir el import necesario junto a los demás imports de DTO:
```java
import com.magno.dto.credito.RenovacionVinculoDTO;
```

- [ ] **Step 4: Compilar y verificar**

```bash
cd backend && ./mvnw compile -q 2>&1 | tail -20
```

Esperado: BUILD SUCCESS sin errores. Si hay error por `Optional` no importado, añadir `import java.util.Optional;` (aunque en Java 11+ suele estar disponible vía los imports del repo JPA).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/magno/repository/RenovacionRepository.java \
        backend/src/main/java/com/magno/service/CreditoService.java
git commit -m "feat(creditos): poblar vínculos de renovación en buildDetalle — liquidadoPorRenovacion y originadoPorRenovacion"
```

---

### Task 3: Frontend — tipos TypeScript

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Añadir interfaz RenovacionVinculo**

En `frontend/src/types/index.ts`, localizar el bloque `// Shape returned by GET /api/creditos/:id` (justo antes de `export interface CreditoDetalle`). Insertar la nueva interfaz ANTES de ese bloque:

```typescript
export interface RenovacionVinculo {
  renovacionId: number
  fechaRenovacion: string
  pagosRestantes: number
  montoPagosRestantes: number
  montoDesembolso: number
  creditoVinculadoId: number
  montoCapitalVinculado: number
}
```

- [ ] **Step 2: Extender CreditoDetalle con los dos campos nullable**

Dentro de `export interface CreditoDetalle { ... }`, añadir los dos campos al final (después de `estadisticas`):

```typescript
  liquidadoPorRenovacion: RenovacionVinculo | null
  originadoPorRenovacion: RenovacionVinculo | null
```

La interfaz quedaría con los mismos campos de antes más estos dos al final.

- [ ] **Step 3: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: solo los errores pre-existentes en `TabRutaDia.tsx` (líneas 131, 136). Cualquier error nuevo en `types/index.ts` debe resolverse.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(creditos): tipo RenovacionVinculo y campos en CreditoDetalle"
```

---

### Task 4: Frontend — normalizer en creditoService

**Files:**
- Modify: `frontend/src/services/creditoService.ts`

- [ ] **Step 1: Añadir función normalizeRenovacionVinculo**

En `frontend/src/services/creditoService.ts`, añadir esta función ANTES de la función `normalizeCreditoDetalle`:

```typescript
function normalizeRenovacionVinculo(raw: any): RenovacionVinculo {
  return {
    renovacionId: raw.renovacionId ?? raw.renovacion_id,
    fechaRenovacion: raw.fechaRenovacion ?? raw.fecha_renovacion,
    pagosRestantes: raw.pagosRestantes ?? raw.pagos_restantes,
    montoPagosRestantes: raw.montoPagosRestantes ?? raw.monto_pagos_restantes,
    montoDesembolso: raw.montoDesembolso ?? raw.monto_desembolso,
    creditoVinculadoId: raw.creditoVinculadoId ?? raw.credito_vinculado_id,
    montoCapitalVinculado: raw.montoCapitalVinculado ?? raw.monto_capital_vinculado,
  }
}
```

- [ ] **Step 2: Actualizar el import del tipo**

En la línea 2 de `creditoService.ts`:
```typescript
import type { CreditoResumen, CreditoDetalle, CalendarioPagoDetalle, ProductoCalculo, Page } from '@/types'
```

Añadir `RenovacionVinculo` a la lista:
```typescript
import type { CreditoResumen, CreditoDetalle, CalendarioPagoDetalle, ProductoCalculo, Page, RenovacionVinculo } from '@/types'
```

- [ ] **Step 3: Actualizar normalizeCreditoDetalle para los nuevos campos**

Dentro de la función `normalizeCreditoDetalle`, localizar el `return { ... }`. Añadir los dos campos al final del objeto retornado (después de `estadisticas: { ... }`):

```typescript
    const liquidadoRaw = raw.liquidadoPorRenovacion ?? raw.liquidado_por_renovacion
    const origenRaw = raw.originadoPorRenovacion ?? raw.originado_por_renovacion
```

Añadir estas dos líneas justo ANTES del `return {` en `normalizeCreditoDetalle`, y añadir al objeto retornado:

```typescript
    liquidadoPorRenovacion: liquidadoRaw ? normalizeRenovacionVinculo(liquidadoRaw) : null,
    originadoPorRenovacion: origenRaw ? normalizeRenovacionVinculo(origenRaw) : null,
```

El resultado de `normalizeCreditoDetalle` debe tener estos dos campos al final.

- [ ] **Step 4: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: solo los errores pre-existentes de `TabRutaDia.tsx`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/creditoService.ts
git commit -m "feat(creditos): normalizer para vínculos de renovación en creditoService"
```

---

### Task 5: Frontend — bloques visuales en CreditoDetallePage

**Files:**
- Modify: `frontend/src/pages/creditos/CreditoDetallePage.tsx`

**Contexto:**  
- El archivo termina con el cierre del `<div className="space-y-4">` principal alrededor de la línea 789.  
- Los bloques se añaden DESPUÉS del card de tabs (el `<div className="card overflow-hidden">` que contiene la navegación de pestañas) y ANTES del primer modal.  
- Ambos bloques son tarjetas independientes con fondo de color distinto al resto de la página.  
- Los helpers `fmtMoney`, `fmtDateTime` y `navigate` ya existen en el componente — no reimplementar.

- [ ] **Step 1: Añadir los dos bloques visuales**

Localizar en `CreditoDetallePage.tsx` la línea que cierra el card de tabs:
```tsx
      </div>

      {/* Modal Ver pago */}
```

Insertar los dos bloques entre el cierre del card de tabs y el primer modal:

```tsx
      {/* Bloque: Liquidado por Renovación */}
      {credito.estado === 'RENOVADO' && credito.liquidadoPorRenovacion && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5 space-y-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            Liquidado por Renovación
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">Fecha de renovación</div>
              <div className="font-medium text-gray-800 mt-0.5">
                {fmtDateTime(credito.liquidadoPorRenovacion.fechaRenovacion)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">Pagos cubiertos</div>
              <div className="font-medium text-gray-800 mt-0.5">
                {credito.liquidadoPorRenovacion.pagosRestantes} pagos · {fmtMoney(credito.liquidadoPorRenovacion.montoPagosRestantes)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">Monto crédito nuevo</div>
              <div className="font-medium text-gray-800 mt-0.5">
                {fmtMoney(credito.liquidadoPorRenovacion.montoCapitalVinculado)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">Desembolso al cliente</div>
              <div className="font-semibold text-[#3d6b35] mt-0.5">
                {fmtMoney(credito.liquidadoPorRenovacion.montoDesembolso)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/creditos/${credito.liquidadoPorRenovacion!.creditoVinculadoId}`)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            Ver crédito #{credito.liquidadoPorRenovacion.creditoVinculadoId} →
          </button>
        </div>
      )}

      {/* Bloque: Originado por Renovación */}
      {credito.originadoPorRenovacion && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5 space-y-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
            Originado por Renovación
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">Crédito anterior</div>
              <div className="font-medium text-gray-800 mt-0.5">
                #{credito.originadoPorRenovacion.creditoVinculadoId} · {fmtMoney(credito.originadoPorRenovacion.montoCapitalVinculado)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">Pagos cubiertos del anterior</div>
              <div className="font-medium text-gray-800 mt-0.5">
                {credito.originadoPorRenovacion.pagosRestantes} pagos · {fmtMoney(credito.originadoPorRenovacion.montoPagosRestantes)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/creditos/${credito.originadoPorRenovacion!.creditoVinculadoId}`)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900"
          >
            ← Ver crédito anterior #{credito.originadoPorRenovacion.creditoVinculadoId}
          </button>
        </div>
      )}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: solo los errores pre-existentes de `TabRutaDia.tsx`. No debe haber errores en `CreditoDetallePage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/creditos/CreditoDetallePage.tsx
git commit -m "feat(creditos): bloques Liquidado/Originado por Renovación en CreditoDetallePage"
```

---

### Task 6: Documentación

**Files:**
- Modify: `docs/04-modulos-y-ui.md`

- [ ] **Step 1: Documentar los nuevos bloques en docs/04-modulos-y-ui.md**

Leer el archivo `docs/04-modulos-y-ui.md` y localizar la sección que describe el módulo de **Créditos Nuevos** o el detalle de crédito.

Añadir o actualizar la descripción del detalle de crédito con los dos nuevos bloques:

```markdown
#### Bloques de vínculo de renovación (CreditoDetallePage)

Aparecen al final del detalle de crédito, después del card de tabs, como tarjetas independientes:

- **"Liquidado por Renovación"** (borde/fondo azul) — visible únicamente cuando el crédito tiene estado `RENOVADO`. Muestra: fecha y hora de la renovación, pagos cubiertos y su monto total, monto del crédito nuevo generado, desembolso entregado al cliente, y un botón "Ver crédito #N →" que navega al crédito nuevo.

- **"Originado por Renovación"** (borde/fondo ámbar) — visible cuando el crédito fue generado a partir de una renovación (es el crédito nuevo en la cadena). Muestra: ID y monto del crédito anterior, pagos del anterior que fueron cubiertos, y un botón "← Ver crédito anterior #N" para navegar al crédito predecesor.

Ambos bloques permiten navegar la cadena completa de créditos de un cliente (crédito #1 → renovado → crédito #2 → renovado → crédito #3). No se muestran en créditos ACTIVOS, PAGADOS ni CANCELADOS sin vínculo de renovación.
```

- [ ] **Step 2: Commit**

```bash
git add docs/04-modulos-y-ui.md
git commit -m "docs: documentar bloques de vínculo de renovación en CreditoDetallePage"
```

---

## Self-Review

### Spec coverage

| Requisito del spec | Cubierto en |
|--------------------|-------------|
| Fecha y hora de la renovación | Task 2 (createdAt) + Task 5 (fmtDateTime) |
| Pagos restantes cubiertos | Task 1 (pagosRestantes) + Task 5 (display) |
| Monto total de esos pagos | Task 1 (montoPagosRestantes) + Task 5 |
| Monto del crédito nuevo | Task 1 (montoCapitalVinculado) + Task 5 |
| Monto desembolsado | Task 1 (montoDesembolso) + Task 5 |
| Enlace "Ver crédito #N →" | Task 5 (navigate button) |
| Bloque "Originado por Renovación" | Task 2 (findActivaByCreditoNuevoId) + Task 5 |
| Enlace "← Ver crédito anterior #N" | Task 5 |
| Solo en crédito RENOVADO el bloque "Liquidado" | Task 2 (condición RENOVADO) + Task 5 (condición JSX) |
| Bloque "Originado" solo si tiene predecesor | Task 2 + Task 5 |
| Mobile-first, al final del detalle | Task 5 (grid cols-1 sm:cols-2, fuera del card de tabs) |
| No interrumpe lectura normal | Task 5 (posición: después del card de tabs) |
| Estilos existentes, sin libs nuevas | Task 5 (Tailwind puro, clases blue-*/amber-*) |
| Actualizar docs | Task 6 |

### Placeholder scan

Ningún placeholder encontrado. Todos los steps tienen código completo.

### Type consistency

- `RenovacionVinculoDTO` (Java, Task 1) → `RenovacionVinculo` (TypeScript, Task 3): campos consistentes con camelCase
- `liquidadoPorRenovacion` / `originadoPorRenovacion`: nombre consistente en Java record (Task 1), TypeScript interface (Task 3), normalizer (Task 4), y JSX (Task 5)
- `creditoVinculadoId` / `montoCapitalVinculado`: nombre consistente en Tasks 1, 3, 4 y 5
- `fmtDateTime` y `fmtMoney`: ya existen en `CreditoDetallePage.tsx` — usados en Task 5 sin reimplementar
