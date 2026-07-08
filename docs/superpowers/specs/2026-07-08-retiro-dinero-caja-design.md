# Retiro de dinero de caja — Diseño

**Fecha:** 2026-07-08
**Estado:** Aprobado, pendiente de plan de implementación

## 1. Resumen y alcance

Nueva sección **"Retiros"** en el sidebar (ruta `/retiros`, roles `ADMINISTRADOR` y `SUPERVISOR`) que permite registrar salidas de efectivo de la caja del día con un monto y una **justificación en texto libre** (textarea).

Decisión de negocio confirmada: un retiro descuenta del `subtotal_caja` **antes** del apartado del 24% — el mismo punto de la fórmula donde ya restan las salidas de Inversiones, no el punto donde restan los Gastos (que se descuentan de `total_real_libres`, después del apartado).

Dado que el comportamiento financiero es idéntico al de una salida de Inversiones (`caja_movimiento_inversion`, ya implementado y probado), la implementación **reutiliza esa infraestructura** en vez de crear una tabla o cálculo paralelo. La UX, sin embargo, se expone como su propia sección de navegación (`/retiros`), separada de `/inversiones`, porque el flujo de captura es distinto: Inversiones requiere elegir un concepto de catálogo (`conceptos_inversion`); Retiros usa una justificación de texto libre y no tiene catálogo.

## 2. Modelo de datos

Se extiende `caja_movimiento_inversion` (no se crea tabla nueva) vía migración Liquibase:

| Columna | Cambio |
|---|---|
| `tipo` | Nueva: enum Java `TipoMovimientoCaja` (`INVERSION`\|`RETIRO`), mapeado `@Enumerated(EnumType.STRING)` (mismo patrón que `EstadoCaja`). Columna `VARCHAR NOT NULL DEFAULT 'INVERSION'` — backfill deja todo el histórico como `INVERSION` |
| `concepto_inversion_id` | Pasa de `NOT NULL` a **nullable** — un `RETIRO` no tiene concepto de catálogo |
| `justificacion` | Nueva: `TEXT`, nullable a nivel de columna; **obligatoria a nivel de API** cuando `tipo = RETIRO` (mínimo 10 caracteres) |
| `monto` | Sin cambio de tipo. Para `RETIRO`, el backend siempre lo persiste **negativo** — el usuario captura un monto positivo en el formulario y el servicio lo convierte antes de guardar |

`descripcion` (columna existente) queda reservada para `INVERSION`; `RETIRO` usa `justificacion`. Se evita mezclar semánticas distintas en el mismo campo.

**Repositorio** (`CajaMovimientoInversionRepository`): se agregan métodos filtrados por tipo, sin tocar el existente:

- `findByCajaDiaIdAndTipoOrderByCreatedAtAsc(Long cajaDiaId, TipoMovimientoCaja tipo)` — listados separados por sección.
- `sumMontoByCajaDiaIdAndTipo(Long cajaDiaId, TipoMovimientoCaja tipo)` — subtotales separados para preview/PDF/reportes.
- `sumMontoByCajaDiaId(Long cajaDiaId)` (existente, sin filtrar) — se mantiene intacto porque `subtotal_caja` debe seguir sumando ambos tipos juntos.

## 3. Backend

Inversiones **no vive en `CajaService`**: tiene su propio `InversionService` + `InversionController` (`/api/inversiones`, con `cajaId` como query param, no path variable). Retiros sigue el mismo patrón como módulo hermano, no como parte de `CajaService`:

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/retiros?cajaId=` | Lista retiros del día (`tipo = RETIRO`) vía `RetiroService.getByDia` |
| POST | `/api/retiros?cajaId=` | Registra retiro con body `RetiroRequest(monto, justificacion)`. `RetiroService.registrar` valida, persiste `tipo=RETIRO`, `monto` negativo, `concepto_inversion_id=null` |
| DELETE | `/api/retiros/{id}?cajaId=` | Elimina un retiro (hard delete, igual que `InversionService.eliminar` — esta tabla no usa soft delete) |

Nuevas clases, calco de las de Inversiones:

- `RetiroController` — `@PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")` a nivel de clase, igual que `InversionController`.
- `RetiroService` — mismo esqueleto que `InversionService` (`getByDia`, `registrar`, `eliminar`), pero sin `ConceptoInversionRepository` y con la validación de `justificacion`.
- `RetiroRequest(BigDecimal monto, String justificacion)` — DTO de entrada, sin `conceptoInversionId`.
- `RetiroDTO(Long id, BigDecimal monto, String justificacion, Long registradoPorId, String registradoPorNombre, OffsetDateTime createdAt)` — DTO de salida, sin campos de concepto.

`InversionService.getByDia` y `.registrar` se ajustan para filtrar/setear explícitamente `tipo = INVERSION` (hoy no filtran por tipo porque la columna no existe todavía).

El cálculo de `subtotal_caja` en `CajaService` **no cambia**: sigue usando `sumMontoByCajaDiaId` sin filtrar, así que inversiones y retiros se combinan automáticamente en el mismo término.

**Reglas de negocio** (mismo patrón que Gastos/Inversiones):

- Solo se puede registrar/eliminar mientras la caja del día está `ABIERTA` (misma validación de estado que ya hace `InversionService`, comparando `caja.getEstado() != EstadoCaja.ABIERTA`).
- Solo roles `ADMINISTRADOR` y `SUPERVISOR` (vía `@PreAuthorize` a nivel de controller, igual que Inversiones).
- Validaciones: `monto > 0` (input del usuario, antes de negativizar) y `justificacion` no vacía, mínimo 10 caracteres (`@NotBlank @Size(min = 10)` en `RetiroRequest`).

## 4. Frontend

Nueva página `RetirosPage.tsx`, calco estructural de `InversionesPage.tsx` (selector de sucursal para Admin, selector de fecha, banner de estado de caja), con formulario simplificado:

- Campo `Monto ($)` — numérico, positivo.
- Campo `Justificación` — textarea, mínimo 10 caracteres.
- Sin campo de concepto (no aplica a Retiros).

Tabla de retiros del día: Justificación | Monto | Registrado por | Hora | (columna de eliminar si `editMode`, igual que Inversiones — sin edición, solo alta/baja).

**Sidebar** (`Sidebar.tsx`): nueva entrada `Retiros` entre `Gastos` e `Inversiones`, roles `['ADMINISTRADOR','SUPERVISOR']`. Ícono a definir en implementación (ej. `Wallet` o `MinusCircle` de lucide-react).

**Rutas** (`App.tsx`): nueva ruta `/retiros`.

**Servicios**: nuevo `retiroService.ts`, mismo patrón de llamadas que `inversionService.ts`, apuntando a `/api/retiros?cajaId=`.

## 5. Impacto en cierre de caja y reportes

**`CajaCierrePreviewDTO`** (usado por `/caja/cierre-preview`): hoy solo trae `subtotalInversiones` (el detalle vive en `/inversiones`). Se agrega `subtotalRetiros` como campo hermano, calculado con `sumMontoByCajaDiaIdAndTipo(cajaId, RETIRO)`. El frontend de preview de cierre pasa de mostrar una línea "Inversiones" a mostrar dos: "Inversiones" y "Retiros".

**`CajaDiaDetalleDTO`** (usado por historial de cierres y por la generación del PDF en `CajaService`): hoy trae `List<MovimientoInversionDTO> inversiones` sin filtrar por tipo. Se agrega `List<RetiroDTO> retiros` como campo hermano, poblado con `findByCajaDiaIdAndTipoOrderByCreatedAtAsc(cajaId, RETIRO)`, y `inversiones` pasa a poblarse solo con `tipo=INVERSION`.

**PDF del corte individual** (`CajaService`, sección `doc.add(sectionHeader("INVERSIONES"))`): se agrega una sección hermana `RETIROS` con su propia tabla (Justificación | Monto | Registrado por | Hora) y su propio subtotal, igual que hoy hace la tabla de inversiones. La fórmula impresa se actualiza de `"Apertura + Ingresos − Desembolsos + Inversiones = ..."` a `"Apertura + Ingresos − Desembolsos + Inversiones + Retiros = ..."` (aunque aritméticamente ya estaba incluido en `subtotal_caja`, el texto debe reflejar ambos términos para no confundir a quien lea el PDF).

```
INVERSIONES
  [tabla de movimientos tipo=INVERSION]
  Subtotal inversiones: $X

RETIROS
  [tabla: justificación | monto | registrado por | hora]
  Subtotal retiros: $Y
```

**`ReporteService.getIngresosEgresos`** (reporte histórico Ingresos y Egresos): hoy `FilaDiariaDTO.inversiones` se calcula con `movimientoRepo.sumMontoByCajaDiaId(dia.getId())`, sin filtrar por tipo — una vez agregada la columna `tipo`, esa suma automáticamente mezclaría inversiones y retiros. Se cambia a dos llamadas separadas:

```java
BigDecimal inversiones = dia != null ? coalesce(movimientoRepo.sumMontoByCajaDiaIdAndTipo(dia.getId(), INVERSION)) : ZERO;
BigDecimal retiros     = dia != null ? coalesce(movimientoRepo.sumMontoByCajaDiaIdAndTipo(dia.getId(), RETIRO))     : ZERO;
```

`FilaDiariaDTO` gana un campo `retiros`, y la fórmula de `subtotal` (hoy `ingresos.subtract(desembolsos).subtract(gastos).subtract(nomina).add(inversiones)`) pasa a `.add(inversiones).add(retiros)`. La tabla del PDF de este reporte (columna `hCell("Inversiones")` en `ReporteService`) gana una columna `hCell("Retiros")` hermana.

**Frontend → `TabIngresosEgresos.tsx`**: se agrega una columna **"Retiros"** en la tabla, leyendo el nuevo campo `retiros` de `FilaDiariaDTO`, separada de la columna existente "Inversiones".

Todos estos subtotales/columnas nuevos se siguen sumando al mismo término `subtotal_caja` / `subtotal` — el cambio es de presentación/desglose en cada capa (preview, PDF de corte, reporte histórico y su PDF), no de fórmula financiera.

## 6. Testing

Siguiendo TDD in-session (proyecto ya establece esto para features chicas/medianas, sin plan formal separado). Nota: hoy no existe `InversionServiceTest` — el módulo de Inversiones no tiene suite dedicada — así que `RetiroServiceTest` es un archivo nuevo, no una extensión de uno existente.

- **`RetiroServiceTest`** (nuevo):
  - Registrar y eliminar retiro.
  - Validación de justificación: obligatoria, mínimo 10 caracteres.
  - Validación de monto positivo (rechaza cero o negativo en el input) y que se persiste negativo.
  - Bloqueo cuando la caja está `CERRADA`.
  - **Permisos por rol**: `SUPERVISOR_CAMPO` y `ASESOR_COBRADOR` reciben 403 al intentar registrar/eliminar retiros (vía `@PreAuthorize` del controller — test de integración o de seguridad, no solo del service).
- **`CajaServiceTest`** (extender):
  - Cálculo de `subtotal_caja` incluyendo retiros junto con inversiones (mismo `sumMontoByCajaDiaId` sin filtrar).
  - Desglose correcto en `CajaCierrePreviewDTO.subtotalRetiros` y `CajaDiaDetalleDTO.retiros` (separados de inversiones).
  - PDF del corte: sección "RETIROS" con su propio subtotal, separada de "INVERSIONES".
- **`ReporteServiceTest`** (extender):
  - `FilaDiariaDTO.retiros` calculado correctamente y separado de `inversiones`.
  - Fórmula de `subtotal`/`subtotalNeto` sigue cuadrando con la suma de ambos términos.
- **Migración Liquibase**: verificar que el backfill de `tipo='INVERSION'` en filas existentes no rompe datos históricos, y que `concepto_inversion_id` nullable no afecta las inversiones ya registradas.
- **Frontend**: sin suite automatizada en el repo para estas páginas — validación manual del flujo en navegador (registrar, eliminar, ver reflejado en preview de cierre y en el reporte de Ingresos y Egresos) antes de dar por terminado, igual que el resto de módulos de Caja.

## Decisiones descartadas

- ❌ Poner Retiro dentro del módulo de Gastos: descartado porque Gastos resta de `total_real_libres` (después del apartado del 24%), no de `subtotal_caja` — hubiera producido un cálculo financiero incorrecto.
- ❌ Tabla y lógica de cálculo completamente independientes: descartado por duplicar infraestructura ya probada (`caja_movimiento_inversion` ya soporta montos negativos que restan de `subtotal_caja`).
- ❌ Reutilizar la UI de Inversiones sin nueva navegación (solo agregar un botón "Retirar dinero" dentro de `/inversiones`): descartado a favor de una entrada de navegación propia, por preferencia explícita del usuario de tener Retiros como concepto separado y descubrible.
