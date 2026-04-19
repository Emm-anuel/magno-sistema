# Reglas de Negocio — MAGNO v3.5

## 6. Reglas de Negocio

### 6.1 Productos de Crédito

| Rango de monto    | Plazo   | Tasa | Notas                       |
| ----------------- | ------- | ---- | --------------------------- |
| $1,000 – $14,000  | 25 días | 30%  | —                           |
| $15,000 – $19,999 | 25 días | 24%  | Zona confirmada con cliente |
| $20,000 – $50,000 | 30 días | 24%  | —                           |

- La tabla de referencia del cliente solo muestra ejemplos representativos.
  Para cualquier monto la fórmula es: `cargo_financiero = capital * tasa`
- Sistema **autodetecta** plazo y tasa según monto:
  - `capital < $15,000` → plazo=25 días, tasa=30%
  - `$15,000 ≤ capital < $20,000` → plazo=25 días, tasa=24%
  - `capital ≥ $20,000` → plazo=30 días, tasa=24%
- Fórmula universal: `pago_diario = (capital + cargo_financiero) / plazo_dias`
- Cobros de **lunes a viernes**.
- Calendario: se generan exactamente N días hábiles (sin contar sábados,
  domingos ni días festivos configurados). Opción C confirmada con cliente.
- Un cliente solo puede tener **UN crédito activo** a la vez. El sistema
  bloquea nuevas solicitudes si ya existe uno en estado ACTIVO.
- Modalidad: **diario** (más común) o **semanal** (casos especiales). ⚠️ Confirmar cálculo semanal.
- IVA = $0.00

### Tabla de Pagos Diarios Completa

#### 25 días — 30% interés

| Crédito | Ganancia | Total   | Pago/día |
| ------- | -------- | ------- | -------- |
| $1,000  | $300     | $1,300  | $52      |
| $2,000  | $600     | $2,600  | $104     |
| $3,000  | $900     | $3,900  | $156     |
| $4,000  | $1,200   | $5,200  | $208     |
| $5,000  | $1,500   | $6,500  | $260     |
| $6,000  | $1,800   | $7,800  | $312     |
| $7,000  | $2,100   | $9,100  | $364     |
| $8,000  | $2,400   | $10,400 | $416     |
| $9,000  | $2,700   | $11,700 | $468     |
| $10,000 | $3,000   | $13,000 | $520     |
| $11,000 | $3,300   | $14,300 | $572     |
| $12,000 | $3,600   | $15,600 | $624     |
| $13,000 | $3,900   | $16,900 | $676     |
| $14,000 | $4,200   | $18,200 | $728     |

#### 25 días — 24% interés

| Crédito | Ganancia | Total   | Pago/día |
| ------- | -------- | ------- | -------- |
| $15,000 | $3,600   | $18,600 | $744     |

#### 30 días — 24% interés

| Crédito | Ganancia | Total   | Pago/día |
| ------- | -------- | ------- | -------- |
| $20,000 | $4,810   | $24,810 | $827     |
| $25,000 | $6,000   | —       | $1,033   |
| $30,000 | $7,200   | —       | $1,240   |
| $35,000 | $8,400   | —       | $1,447   |
| $40,000 | $9,600   | —       | $1,653   |
| $45,000 | $10,800  | —       | $1,860   |
| $50,000 | $12,000  | —       | $2,067   |

### 6.2 Cobros y Pagos

- Al aprobar un crédito el sistema genera automáticamente el **calendario de pagos**, saltando sábados, domingos y días festivos. ⚠️ Confirmar lógica exacta de salto.
- Al momento del desembolso se cobra **1 pago adelantado** → se aplica al último pago (#25 o #30).
- Cada pago reduce el saldo del total (capital + intereses), no solo el capital.
- Se permiten **pagos incompletos** (abonos).
- Al marcar "No pagó" → campo de razón **obligatorio** → multa se aplica automáticamente.
- Las razones de no pago quedan en historial del cliente y se ven como tooltip sobre ✗.
- El timestamp exacto de registro (`created_at`) se guarda automáticamente al registrar un pago y se muestra en el historial de cobros en formato `dd/MM/yyyy HH:mm` (hora local `America/Mexico_City`).

### 6.3 Multas — DOS tipos independientes

**Tipo 1 — Por día no pagado:**

- Multa fija por cada día sin pago. Base: $50. Configurable por sucursal y rango de monto.
- Ejemplo: créditos $1k–$14k → $50/día; créditos $15k+ → $100/día.
- Se aplica automáticamente al registrar "No pagó".
- Días INHÁBIL NO generan multa.

**Tipo 2 — Por pagos incompletos acumulados:**

- Por cada **2 pagos incompletos acumulados** → multa adicional (configurable, base $50).
- Contador independiente del Tipo 1.

- Las multas pendientes **se descuentan del desembolso en renovaciones**.
- Configuración en módulo Administración → Config. Multas: Sucursal | Rango Mín | Rango Máx | Multa/Día | Multa por 2 Incompletos.

### 6.4 Renovaciones

- Elegibilidad: pago **#16** (25 días) / pago **#19** (30 días). El sistema bloquea antes.
- 0–1 pagos pendientes → puede aumentar monto. 2–3 pendientes → igual o menor.
- **Fórmula del desembolso (confirmada):**
  ```
  Desembolso = Crédito Nuevo − Pagos Restantes − Multas Pendientes − Pago Adelantado nuevo
  ```
  Ejemplo: $8,000 − (8 × $416 = $3,328) − $0 − $416 = **$4,256**
- Pago adelantado → se aplica al último pago del nuevo crédito.
- Salida de: **CAJA** o **RUTA** (campo requerido).
- Campos calculados automáticamente: Pagos Restantes, Monto Pagos Restantes, Pago Crédito Nuevo, Monto a Entregar.

### 6.5 Colocaciones

- Tabla semanal (Lunes–Viernes) por asesor. Incluye créditos nuevos + renovaciones.
- Columnas: Día | Cliente | Crédito Actual | Crédito Solicitado | Desembolso | Asesor | Tipo (Nuevo/Renovación).
- Totales al pie: Total Caja y Total Desembolsos.
- Vive en módulo **Renovaciones** → pestaña "Colocaciones Semanales".
- ⚠️ Confirmar: ¿tabla almacenada o reporte calculado?

### 6.6 Corte de Caja

```
+ Inversión inicial
+ Ingreso Carteras (cobros del día por todos los asesores)
− Desembolsos del día
= Subtotal Caja
− Apartado 24% del ingreso  ⚠️ confirmar base exacta
= Total Caja Libres
− Gastos del día
− Créditos nuevos colocados
− Ahorro fijo ($2,000/día hábil, configurable)
= Total Real Libres
```

- Solo pueden aperturar/cerrar: **Administrador y Supervisor**.
- Columnas de la tabla de cierre: Asesor | Inversión | Ingresos | Desembolsos | Apartado 24% | Libres | Multas.
- Exporta a PDF y envía por correo a gerencia.

### 6.7 Gastos Operativos

Categorías (exactas del sistema):

- Gasolina | Servicio motos | Recargas | Solicitud dinero dueño | Gastos varios

Campos por gasto: fecha, categoría, descripción, monto, responsable, sucursal, **comprobante/referencia (texto libre)**.

> El comprobante es un campo de texto (folio, número, descripción) — NO es upload de archivo.

Nómina: **NO es módulo del sistema** — excluida por el cliente.

### 6.8 Garantías

- Descripción textual del objeto únicamente — no se gestiona recuperación.
- Aplica en créditos nuevos y renovaciones de monto grande.
- Visible en ficha del cliente.
