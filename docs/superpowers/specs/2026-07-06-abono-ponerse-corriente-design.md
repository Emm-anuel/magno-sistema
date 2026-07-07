# Diseño — Abono "Ponerse al Corriente"
**Fecha:** 2026-07-06
**Estado:** Aprobado — listo para implementación

---

## Contexto

Cuando un cliente no paga varios días consecutivos, el cobrador puede registrar "No pagó" cada día (generando multas). En un momento posterior, el cliente puede entregar un monto grande para ponerse al corriente. Actualmente el sistema no soporta distribuir ese monto sobre múltiples días atrasados. Esta feature añade un flujo explícito para registrar y visualizar ese evento.

---

## Decisiones de diseño confirmadas

| # | Pregunta | Decisión |
|---|----------|----------|
| 1 | ¿Se mantienen registros NO_PAGO originales? | Sí — se crean entidades separadas, los Pago de no_pago no se modifican |
| 2 | ¿Orden de distribución? | Día completo como unidad (cuota + multas del día) oldest-first. Parcial en el último día si no alcanza |
| 3 | ¿Punto de entrada en UI? | Botón "Pagar adeudo" en CobrosPage (ruta del día) |
| 4 | ¿El día actual entra en la distribución? | Sí — se incluye si es día hábil |
| 5 | ¿Segundo abono sobre día parcial? | Sí — RECUPERADO_PARCIAL entra en la cola oldest-first del siguiente abono |

---

## Algoritmo de distribución

Ejecutado en una sola transacción en `AbonoService.registrarAbono()`.

### Paso 1 — Recolectar slots a cubrir

```
estados elegibles = [NO_PAGADO, PENDIENTE (con fecha ≤ hoy), RECUPERADO_PARCIAL]
slots = CalendarioPago WHERE credito_id = X AND estado IN (elegibles)
        ORDER BY numero_pago ASC
```

### Paso 2 — Calcular costo restante por slot

Para cada slot:
- `multas_del_dia` = multas con `cobrada=false` cuya `fecha = slot.fecha_programada` (incluye tanto tipo NO_PAGO como INCOMPLETO — todos los tipos pendientes de ese día)
- `ya_abonado` = SUM(`abono_coberturas.total_aplicado`) WHERE `calendario_pago_id = slot.id`
- `costo_restante` = (`slot.monto_esperado` + SUM(`multas_del_dia.monto`)) − `ya_abonado`

### Paso 3 — Iterar y distribuir

```
saldo_disponible = monto_recibido

para cada slot en slots:
    si saldo_disponible <= 0: break

    si saldo_disponible >= costo_restante:
        → slot queda RECUPERADO
        → multas del día quedan cobrada=true
        → saldo_disponible -= costo_restante
        → crear AbonoCoberturaDetalle(es_parcial=false)
    si 0 < saldo_disponible < costo_restante:
        → slot queda RECUPERADO_PARCIAL
        → multas: cobrar primero las multas si saldo alcanza, luego cuota
        → saldo_disponible = 0
        → crear AbonoCoberturaDetalle(es_parcial=true)
```

### Ejemplo

Crédito $3,000 — cuota $156/día — multa $50/día — abono $1,500:

```
Día 1: $156 + $50 = $206 → RECUPERADO     | saldo: $1,294
Día 2: $206            → RECUPERADO     | saldo: $1,088
Día 3: $206            → RECUPERADO     | saldo: $882
Día 4: $206            → RECUPERADO     | saldo: $676
Día 5: $206            → RECUPERADO     | saldo: $470
Día 6: $206            → RECUPERADO     | saldo: $264
Día 7: $206            → RECUPERADO     | saldo: $58
Día 8: $206            → RECUPERADO_PARCIAL ($58 aplicados) | saldo: $0
```

**Segundo abono** sobre el mismo crédito:
- Día 8 entra primero con `costo_restante = $148` ($206 − $58 ya abonado)
- Luego continúa con días 9, 10...

---

## Modelo de datos

### Nuevas tablas

```sql
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

CREATE TABLE abono_coberturas (
    id                  BIGSERIAL PRIMARY KEY,
    abono_id            BIGINT NOT NULL REFERENCES abonos_corriente(id),
    calendario_pago_id  BIGINT NOT NULL REFERENCES calendario_pagos(id),
    numero_pago         INTEGER NOT NULL,
    monto_cuota         DECIMAL(12,2) NOT NULL,
    monto_multa         DECIMAL(12,2) NOT NULL,
    total_aplicado      DECIMAL(12,2) NOT NULL,
    es_parcial          BOOLEAN NOT NULL
);
```

### Cambios a tablas existentes

```sql
-- calendario_pagos.estado: dos nuevos valores
-- RECUPERADO          (cuota + multas cubiertos completamente)
-- RECUPERADO_PARCIAL  (cubierto parcialmente)

-- multas: nueva columna para rastrear qué abono la cobró
ALTER TABLE multas ADD COLUMN cobrada_en_abono_id BIGINT REFERENCES abonos_corriente(id);
```

**Sin cambios en:** `pagos`, `creditos`, ni sus restricciones únicas.

---

## API

### Registrar abono

```
POST /api/cobros/abono-corriente
Authorization: roles ASESOR_COBRADOR, SUPERVISOR_CAMPO, SUPERVISOR, ADMINISTRADOR
```

**Request:**
```json
{
  "credito_id": 42,
  "monto_recibido": 1500.00,
  "fecha_pago": "2026-07-06"
}
```
`fecha_pago` es opcional. ASESOR_COBRADOR y SUPERVISOR_CAMPO solo pueden usar la fecha actual. ADMINISTRADOR y SUPERVISOR pueden usar fechas históricas.

**Response 200:**
```json
{
  "abono_id": 7,
  "credito_id": 42,
  "fecha": "2026-07-06",
  "monto_total": 1500.00,
  "monto_distribuido": 1500.00,
  "monto_sobrante": 0.00,
  "dias_cubiertos": 7,
  "dias_parciales": 1,
  "coberturas": [
    {
      "numero_pago": 1,
      "fecha_programada": "2026-06-25",
      "monto_cuota": 156.00,
      "monto_multa": 50.00,
      "total_aplicado": 206.00,
      "es_parcial": false
    },
    {
      "numero_pago": 8,
      "fecha_programada": "2026-07-04",
      "monto_cuota": 8.00,
      "monto_multa": 50.00,
      "total_aplicado": 58.00,
      "es_parcial": true
    }
  ]
}
```

**Errores:**
- `400` — crédito no activo
- `400` — monto_recibido ≤ 0
- `400` — no hay días atrasados para cubrir
- `403` — sin permisos (asesor intentando acceder a cliente de otro asesor)

### Consultar abonos de un crédito

```
GET /api/cobros/abono-corriente?credito_id=42
```

Devuelve lista de `AbonoCorrienteDTO` con sus coberturas. Usado por el detalle del crédito.

---

## UI

### CobrosPage — tarjeta del cliente

Cuando un cliente tiene `estadoHoy = NO_PAGADO` o tiene `CalendarioPago` con estados `NO_PAGADO` / `RECUPERADO_PARCIAL` / `PENDIENTE` vencidos:

- Aparece botón **"Pagar adeudo"** (color naranja/rojo) junto al botón normal de cobro.
- El botón normal permanece para registrar el pago del día de forma independiente si aplica.

### Modal "Pagar adeudo"

Calcula en tiempo real (frontend, sin llamada al servidor) usando los datos del calendario ya cargados:

```
┌─────────────────────────────────────────────┐
│  Pagar adeudo — {nombre cliente}            │
├─────────────────────────────────────────────┤
│  Días atrasados: 8                          │
│  Para ponerse al corriente: $1,648          │
│  (8 cuotas × $156 + 8 multas × $50)         │
│                                             │
│  Monto a recibir:  [ $_______ ]             │
│                                             │
│  Distribución:                              │
│  ✓ #1 — 25 jun   $206   completo            │
│  ✓ #2 — 26 jun   $206   completo            │
│    ...                                      │
│  ~ #8 — 04 jul   $58    parcial             │
│  — #9 — 07 jul   —      no alcanza          │
│                                             │
│  [Cancelar]              [Confirmar abono]  │
└─────────────────────────────────────────────┘
```

La tabla de distribución se recalcula con cada tecla. Al confirmar se llama `POST /api/cobros/abono-corriente`.

### CreditoDetallePage — tab Calendario

Los días cubiertos por abono muestran badges diferenciados:

| Estado CalendarioPago | Badge | Color |
|-----------------------|-------|-------|
| RECUPERADO | Abono ✓ | Azul |
| RECUPERADO_PARCIAL | Abono parcial | Naranja |

Columna "Monto recibido" muestra el `total_aplicado` del abono para esa fila.

Botón **"Ver abono"** en la fila abre un modal con:
- Fecha del abono
- Monto total entregado por el cliente
- Desglose: monto a cuota + monto a multas
- Lista de todos los días que cubrió ese mismo abono

### CreditoDetallePage — tab Información, sección "Abonos extraordinarios"

Aparece solo si existen abonos. Lista compacta:

```
Abono #7 — 06 jul 2026 — $1,500 — Cubrió 7 días + 1 parcial  [Ver detalle]
```

---

## Archivos afectados (estimado)

### Backend
- `db/changelog/` — 1 migration: tablas nuevas + columna `cobrada_en_abono_id` + nuevos valores de enum
- `model/AbonoCorriente.java` — nueva entidad
- `model/AbonoCoberturaDetalle.java` — nueva entidad
- `model/EstadoCalendarioPago.java` — agregar `RECUPERADO`, `RECUPERADO_PARCIAL`
- `dto/cobros/AbonoCorrienteRequest.java` — nuevo DTO
- `dto/cobros/AbonoCorrienteDTO.java` — nuevo DTO (con lista de coberturas)
- `repository/AbonoCorrienteRepository.java` — nuevo repo
- `repository/AbonoCoberturaDetalleRepository.java` — nuevo repo
- `service/AbonoCorrienteService.java` — nueva lógica de distribución
- `controller/CobrosController.java` — 2 endpoints nuevos

### Frontend
- `types/index.ts` — nuevos tipos `AbonoCorrienteDTO`, `AbonoCoberturaDTO`
- `services/cobrosService.ts` — 2 métodos nuevos
- `components/cobros/ModalPagarAdeudo.tsx` — modal nuevo con cálculo en tiempo real
- `pages/cobros/CobrosPage.tsx` — botón "Pagar adeudo" en tarjeta del cliente
- `pages/creditos/CreditoDetallePage.tsx` — badges RECUPERADO, modal "Ver abono", sección "Abonos extraordinarios"
