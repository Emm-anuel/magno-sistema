# Condonación de Multas en Renovaciones — Diseño

**Fecha:** 2026-06-30  
**Módulo:** Renovaciones (Módulo 5) + Corte de Caja (Módulo 6)  
**Estado:** Aprobado

---

## Contexto

Al renovar un crédito, las multas pendientes se descuentan automáticamente del desembolso que recibe el cliente. El cliente solicitó la posibilidad de **condonar multas individuales** al momento de aprobar una renovación, de modo que no se descuenten del desembolso. La condonación debe quedar registrada para auditoría y reflejarse correctamente en el corte de caja.

---

## Decisiones confirmadas

| Pregunta | Decisión |
|---|---|
| ¿En qué paso ocurre la condonación? | Al **aprobar** (SOLICITADO → APROBADO) |
| ¿Total o parcial? | **Parcial** — el Gerente selecciona multas individuales |
| ¿Qué roles pueden condonar? | **ADMINISTRADOR** y **SUPERVISOR** (mismos que aprueban) |
| ¿Impacto en caja? | Dos renglones separados: multas cobradas y multas condonadas |
| ¿Auditoría? | Registro por multa: quién, cuándo, motivo, en qué renovación |

---

## Sección 1: Modelo de Datos

### Migración — tabla `multas`

Agregar 5 columnas nullable (sin romper datos existentes):

```sql
ALTER TABLE multas ADD COLUMN condonada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE multas ADD COLUMN condonada_en_renovacion_id BIGINT REFERENCES renovaciones(id);
ALTER TABLE multas ADD COLUMN condonada_por_id BIGINT REFERENCES usuarios(id);
ALTER TABLE multas ADD COLUMN fecha_condonacion TIMESTAMPTZ;
ALTER TABLE multas ADD COLUMN motivo_condonacion TEXT;
```

**Constraint de negocio** (validado en servicio, no en BD): una multa no puede tener `cobrada = true` y `condonada = true` simultáneamente.

### Migración — tabla `renovaciones`

Campo de resumen para consultas eficientes en caja:

```sql
ALTER TABLE renovaciones ADD COLUMN multas_condonadas DECIMAL(12,2) NOT NULL DEFAULT 0;
```

### Fórmula de desembolso actualizada

```
-- Antes
Desembolso = monto_aprobado − Pagos Restantes − Multas Pendientes − Pago Adelantado

-- Después
Multas a Descontar = Multas Pendientes − Multas Condonadas
Desembolso = monto_aprobado − Pagos Restantes − Multas a Descontar − Pago Adelantado
```

Las multas condonadas **no se descuentan del desembolso** — el cliente recibe más efectivo y la microfinanciera absorbe el importe.

---

## Sección 2: Backend

### `RenovacionAprobarRequest` — campos nuevos

```java
public record RenovacionAprobarRequest(
    BigDecimal montoAprobado,          // ya existe
    List<Long> multasCondonadasIds,    // IDs de multas a condonar (puede ser vacío o null)
    String motivoCondonacion           // obligatorio si multasCondonadasIds no está vacío
)
```

### `aprobarRenovacion()` — lógica adicional

Dentro de la misma transacción de aprobación:

1. Si `multasCondonadasIds` no está vacío, validar que `motivoCondonacion` no sea nulo/vacío.
2. Validar que cada multa:
   - Pertenezca al `creditoAnterior` de la renovación.
   - Tenga `cobrada = false`.
   - Tenga `condonada = false`.
3. Para cada multa seleccionada:
   ```
   multa.condonada = true
   multa.condonadaEnRenovacionId = renovacion.id
   multa.condonadaPorId = aprobadorId
   multa.fechaCondonacion = now()
   multa.motivoCondonacion = motivo
   ```
4. Calcular `totalCondonado = SUM(multas condonadas)` y guardar en `renovacion.multasCondonadas`.
5. Recalcular `renovacion.montoDesembolso` con la nueva fórmula.

### `confirmarDesembolso()` — ajuste

Al marcar multas como cobradas, excluir las ya condonadas:

```java
// Solo se marcan como cobradas las NO condonadas
multaRepo.findByCreditoIdAndCobradaFalseAndCondonadaFalseAndDeletedAtIsNull(creditoId)
    .forEach(m -> { m.setCobrada(true); multaRepo.save(m); });
```

### `calcularPreview()` — sin cambios

El endpoint `GET /api/renovaciones/calcular` no necesita cambios. La condonación ocurre en el paso de aprobación. El recálculo del desembolso al seleccionar multas en el frontend se hace localmente restando los montos — no requiere llamada al backend.

### DTOs actualizados

**`RenovacionCalculoDTO`** agrega:
- `multasCondonadas: BigDecimal`
- `multasADescontar: BigDecimal` (= multasPendientes − multasCondonadas)

**`RenovacionDetalleDTO`** agrega:
- `multasCondonadas: BigDecimal`
- `motivoCondonacion: String`
- `multasCondonadasDetalle: List<MultaCondonadaDTO>`

**`MultaCondonadaDTO`** (nuevo):
```java
public record MultaCondonadaDTO(
    Long id,
    BigDecimal monto,
    String tipo,           // NO_PAGO | INCOMPLETO
    LocalDate fecha,
    String motivoCondonacion,
    String condonadaPorNombre,
    OffsetDateTime fechaCondonacion
)
```

### Caja — `getPreviewCierre()` y `cerrarCaja()`

Nueva consulta en `RenovacionRepository`:
```java
BigDecimal sumMultasCondonadasBySucursalAndFecha(Long sucursalId, LocalDate fecha);
```

La respuesta `CajaCierrePreviewDTO` agrega:
- `totalMultasCondonadas: BigDecimal`
- `totalMultasCobradas: BigDecimal` (renombrado para claridad, era `totalMultas`)
- `multasCobrasRenovaciones: BigDecimal` (multas de renovaciones cobradas ese día)

### Nuevo endpoint para multas del crédito

Para que el frontend pueda mostrar la lista de multas individuales al momento de aprobar:

```
GET /api/renovaciones/{renovacionId}/multas-pendientes
```

Retorna `List<MultaDTO>` — las multas `cobrada=false AND condonada=false` del crédito anterior.

---

## Sección 3: Frontend

### `TabPendientesRenovacion` — aprobación

Si `multasPendientes > 0`, mostrar sección expandible **"Multas Pendientes"** dentro de la tarjeta de aprobación.

**Lista de multas individuales:**
- Checkbox por multa
- Columnas: Tipo, Fecha, Monto
- Al seleccionar ≥1 multa: aparece campo de texto **"Motivo de condonación"** (obligatorio)

**Resumen de cálculo actualizado:**
```
Pagos restantes:        $X
Multas pendientes:      $350
  └─ A condonar:       −$200   (solo si hay selección)
  └─ A descontar:       $150
Pago adelantado:        $Y
─────────────────────────────
Monto a entregar:       $Z
```

El botón **"Aprobar"** envía: `montoAprobado` + `multasCondonadasIds` + `motivoCondonacion`.

### `TabPendientesDesembolso` — confirmación

Dos renglones read-only en el desglose (la aprobación ya procesó la condonación):

```
Multas condonadas:   $200   ← verde, informativo
Multas a descontar:  $150
```

Si hubieron condonaciones, mostrar al pie:
> *Condonadas por [Nombre Gerente] — "[Motivo]"*

### Caja — `/caja/cierre` preview

La sección **"Multas"** pasa a mostrar:

| Concepto | Monto |
|---|---|
| Cobradas en cobros diarios | $X |
| Cobradas en renovaciones | $Y |
| **Total cobrado** | **$X + Y** |
| Condonadas en renovaciones | −$Z *(rojo, informativo)* |

Las multas condonadas son informativas — **no afectan el subtotal de caja** (no hubo ingreso real).

### `ClienteDetallePage` — historial del crédito

Las multas condonadas muestran badge **"CONDONADA"** (estilo gris/ámbar) con tooltip:
> *"Condonada por [Nombre] el [fecha] — [motivo]"*

---

## Reglas de negocio

1. Solo roles `ADMINISTRADOR` y `SUPERVISOR` pueden condonar multas.
2. La condonación ocurre únicamente en el paso de aprobación (SOLICITADO → APROBADO).
3. Una multa no puede ser cobrada y condonada al mismo tiempo.
4. Una multa ya condonada no puede ser "des-condonada" — operación irreversible.
5. Si se condonan multas, el motivo es obligatorio.
6. Las multas condonadas no se descuentan del desembolso ni generan ingreso en caja.
7. Las multas condonadas aparecen como renglón separado (informativo) en el cierre de caja.

---

## Archivos afectados

### Backend
| Archivo | Cambio |
|---|---|
| `db/changelog/` | Nueva migración Liquibase (VXX) |
| `model/Multa.java` | +5 campos |
| `model/Renovacion.java` | +`multasCondonadas` |
| `dto/renovacion/RenovacionAprobarRequest.java` | +`multasCondonadasIds`, `motivoCondonacion` |
| `dto/renovacion/RenovacionCalculoDTO.java` | +`multasCondonadas`, `multasADescontar` |
| `dto/renovacion/RenovacionDetalleDTO.java` | +`multasCondonadas`, `motivoCondonacion`, `multasCondonadasDetalle` |
| `dto/renovacion/MultaCondonadaDTO.java` | Nuevo record |
| `dto/cobros/MultaDTO.java` | +campos de condonación para el historial |
| `repository/MultaRepository.java` | +nuevo método de query |
| `repository/RenovacionRepository.java` | +query sum condonadas por sucursal/fecha |
| `service/RenovacionService.java` | Lógica de condonación en `aprobarRenovacion()` y ajuste en `confirmarDesembolso()` |
| `service/CajaService.java` | +consulta multas condonadas, actualizar preview DTO |
| `dto/caja/CajaCierrePreviewDTO.java` | +`totalMultasCondonadas`, `multasCobrasRenovaciones` |
| `controller/RenovacionController.java` | +endpoint `GET /{id}/multas-pendientes` |

### Frontend
| Archivo | Cambio |
|---|---|
| `services/renovacionService.ts` | +tipos para condonación, +función fetch multas pendientes |
| `pages/renovaciones/TabPendientesRenovacion.tsx` | +sección de multas con checkboxes y motivo |
| `pages/renovaciones/TabPendientesDesembolso.tsx` | +renglones condonadas/a descontar |
| `pages/caja/CajaCierrePage.tsx` | +sección multas condonadas |
| `pages/clientes/ClienteDetallePage.tsx` | +badge CONDONADA en historial de multas |

---

## Consideraciones de auditoría

Cada multa condonada queda trazable con:
- **Qué** multa fue condonada (id, monto, tipo, fecha)
- **En qué renovación** (`condonada_en_renovacion_id`)
- **Quién** la autorizó (`condonada_por_id` → nombre del Gerente)
- **Cuándo** (`fecha_condonacion`)
- **Por qué** (`motivo_condonacion`)

Esta información es accesible desde: historial de la renovación, ficha del cliente, y futuro módulo de reportes.
