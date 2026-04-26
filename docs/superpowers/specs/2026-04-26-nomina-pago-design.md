# Spec: Pago de Nómina — Integración con Caja
**Fecha:** 2026-04-26
**Estado:** Aprobado

---

## Contexto

El módulo de Administración ya cuenta con un catálogo `nomina_personal` (nombre, puesto, monto_semanal) y la config `dia_pago_nomina` por sucursal. Lo que faltaba era:

- Registrar cuándo se realizó el pago semanal de nómina
- Que ese pago se descuente de la caja del día
- Que aparezca como línea propia en el corte de caja y en su PDF

---

## Decisiones confirmadas

- Un solo pago de nómina por día de caja (transacción global por sucursal, no por empleado)
- Solo `ADMINISTRADOR` (Gerente General) puede registrar y anular el pago
- Si el día de nómina cae en festivo o fin de semana, se paga el **día hábil anterior**
- El monto es calculado automáticamente por el sistema (suma de `monto_semanal` del personal activo); el Gerente confirma, no edita el monto
- Soft delete para anular (registro financiero — nunca borrar)

---

## Modelo de datos

### Nueva tabla: `nomina_pago`

| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | BIGSERIAL | PK | — |
| `caja_dia_id` | BIGINT | NOT NULL · FK `caja_dia(id)` · **UNIQUE** | Un solo pago por día de caja |
| `sucursal_id` | BIGINT | NOT NULL · FK `sucursales(id)` | — |
| `total_pagado` | DECIMAL(12,2) | NOT NULL | Suma de `monto_semanal` al momento del pago |
| `registrado_por` | BIGINT | NOT NULL · FK `usuarios(id)` | Solo ADMINISTRADOR |
| `created_at` | TIMESTAMPTZ | NOT NULL · DEFAULT NOW() | — |
| `deleted_at` | TIMESTAMPTZ | nullable | Soft delete — registro financiero |

### Columna nueva en `caja_dia`

```sql
total_nomina DECIMAL(12,2) NOT NULL DEFAULT 0
```

### Fórmula actualizada del cierre

```
total_real_libres = monto_libres − ahorro_fijo − total_gastos − total_nomina
```

### Migración

Número siguiente disponible (V23 o el que corresponda). Incluye:
1. `ALTER TABLE caja_dia ADD COLUMN total_nomina DECIMAL(12,2) NOT NULL DEFAULT 0`
2. `CREATE TABLE nomina_pago (...)`
3. Índice: `idx_nomina_pago_caja_dia ON nomina_pago(caja_dia_id)`

---

## Reglas de negocio

### Cálculo del día efectivo de nómina

1. Tomar `config_sucursal.dia_pago_nomina` para la sucursal (ej: `MIERCOLES`)
2. Encontrar esa fecha en la semana actual (lunes–viernes)
3. Si la fecha cae en `dias_festivos` o es sábado/domingo → retroceder al día hábil anterior
4. El resultado es el **día efectivo de pago** de esa semana

### Condiciones para registrar el pago

- El usuario tiene rol `ADMINISTRADOR`
- La caja está abierta (`caja_dia.abierta = true`)
- Hoy es el día efectivo de nómina calculado
- No existe ya un `nomina_pago` activo para este `caja_dia_id` (sin `deleted_at`)
- Existe al menos un registro activo en `nomina_personal` para la sucursal

### Monto del pago

```
total_pagado = SUM(monto_semanal) 
               FROM nomina_personal 
               WHERE sucursal_id = X AND deleted_at IS NULL
```

El monto se calcula en el momento del registro. El Gerente lo ve antes de confirmar.

### Anulación

- Solo `ADMINISTRADOR`
- Soft delete: `nomina_pago.deleted_at = NOW()`
- Revierte: `caja_dia.total_nomina = 0`
- Solo posible mientras la caja siga abierta

---

## Backend

### Nuevos endpoints

| Método | Ruta | Rol requerido | Descripción |
|---|---|---|---|
| `GET` | `/api/caja/{cajaDiaId}/nomina` | ADMIN, SUPERVISOR | Estado del pago del día: si existe pago, detalles; siempre incluye lista de personal activo y total calculado |
| `POST` | `/api/caja/{cajaDiaId}/nomina` | ADMINISTRADOR | Registra el pago. Valida todas las condiciones del negocio |
| `DELETE` | `/api/caja/{cajaDiaId}/nomina` | ADMINISTRADOR | Anula el pago (soft delete). Revierte `total_nomina` en `caja_dia` |

### Nuevo método en servicio de caja

`calcularDiaEfectivoNomina(Long sucursalId, LocalDate semana)` — devuelve la fecha efectiva de pago de esa semana aplicando la lógica de retroceso por festivos/fines de semana.

### Cambios en `CortesCajaService`

- Incluir `totalNomina` en el DTO de preview y en el DTO de cierre
- Ajustar cálculo de `totalRealLibres`
- Pasar `totalNomina` y fecha de pago al generador de PDF

---

## Frontend

### Caja abierta (`/caja`)

Nueva sección **"Nómina"** visible solo para `ADMINISTRADOR`, posicionada junto a la sección de gastos.

**Estado: no es día de nómina**
> Mensaje informativo: "El próximo pago de nómina es el [fecha efectiva]."

**Estado: es día de nómina, pago pendiente**
- Lista de personal activo con nombre, puesto y monto semanal
- Total calculado destacado
- Botón **"Registrar pago de nómina"**

**Modal de confirmación:**
```
¿Confirmar pago de nómina?
──────────────────────────
Juan Pérez  · Asesor     · $1,200.00
María López · Supervisora · $1,500.00
──────────────────────────
Total: $2,700.00

[Cancelar]  [Confirmar pago]
```

**Estado: pago ya registrado**
- Chip/badge verde "Nómina pagada"
- Fecha de pago y total
- Botón "Anular" (solo ADMINISTRADOR, solo caja abierta)

### Corte de caja (`/caja/cierre`)

En la tabla de deducciones del preview y del cierre confirmado, nueva línea:

| Concepto | Monto |
|---|---|
| Ahorro fijo | $X,XXX.00 |
| Gastos operativos | $X,XXX.00 |
| **Nómina** | **$X,XXX.00** |
| **Total real libres** | **$XX,XXX.00** |

Si no se pagó nómina en la semana, la línea muestra `$0.00` — no bloquea el cierre.

### PDF del corte

Incluye la misma línea de nómina con monto y fecha de pago. Si no se registró pago, muestra $0.00 sin fecha.

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `db/changelog/V23__nomina_pago.sql` | Crear — migración nueva |
| `NominaPago.java` | Crear — entidad JPA |
| `NominaPagoRepository.java` | Crear |
| `NominaPagoDTO.java` | Crear |
| `NominaEstadoDTO.java` | Crear — respuesta del GET (estado + personal + total) |
| `NominaCajaService.java` | Crear — lógica de registro, anulación, cálculo día efectivo |
| `NominaCajaController.java` | Crear — endpoints REST |
| `CortesCajaService.java` | Modificar — incluir totalNomina en preview/cierre/PDF |
| `CajaPage.tsx` | Modificar — agregar SeccionNomina |
| `CajaCierrePage.tsx` | Modificar — agregar línea nómina en tabla de deducciones |
| `cajaService.ts` | Modificar — agregar llamadas a los nuevos endpoints |
