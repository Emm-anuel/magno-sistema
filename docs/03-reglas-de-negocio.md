# Reglas de Negocio — MAGNO v3.5

## 6. Reglas de Negocio

### 6.1 Productos de Crédito

#### Producto Diario

| Rango de monto    | Plazo   | Tasa | Notas                       |
| ----------------- | ------- | ---- | --------------------------- |
| $1,000 – $14,000  | 25 días | 30%  | —                           |
| $15,000 – $19,999 | 25 días | 24%  | Zona confirmada con cliente |
| $20,000 – $50,000 | 30 días | 24%  | —                           |

#### Producto Semanal

| Rango de monto    | Plazo      | Tasa | Notas                           |
| ----------------- | ---------- | ---- | ------------------------------- |
| $2,000 – $9,999   | 8 semanas  | 40%  | Pago semanal, 1 pago adelantado |
| $10,000 – $30,000 | 12 semanas | 40%  | Pago semanal, 1 pago adelantado |

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
- Para créditos semanales se usa la misma fórmula financiera:
  - `cargo_financiero = capital * tasa`
  - `pago_semanal = (capital + cargo_financiero) / plazo`
  - calendario en intervalos de **7 días calendario** desde el desembolso; si un vencimiento cae en sábado, domingo o festivo, se recorre al siguiente día hábil sin alterar el ancla de las semanas posteriores.
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
- Al cerrar la caja del día, cualquier pago que ningún asesor haya registrado se
  marca automáticamente como "No pagó" (razón: "Cierre de caja — sin registro de
  pago") y genera su multa igual que un no-pago manual. El preview de cierre
  muestra estos clientes antes de confirmar.
- Para créditos semanales la multa por no pago usa `config_multas.multa_semanal_no_pago` (base seed: $300).

**Tipo 2 — Por pagos incompletos acumulados:**

- Por cada **2 pagos incompletos acumulados** → multa adicional (configurable, base $50).
- Contador independiente del Tipo 1.
- Para créditos semanales la multa por incompletos usa `config_multas.multa_semanal_incompletos` (base seed: $300).

- Las multas pendientes **se descuentan del desembolso en renovaciones**.
- Configuración en módulo Administración → Config. Multas: Sucursal | Rango Mín | Rango Máx | Multa/Día | Multa por 2 Incompletos.

### 6.4 Renovaciones ✅ Implementado (Módulo 5 — flujo de dos pasos V13)

#### Flujo de estados

**SOLICITADO → APROBADO → ACTIVO / RECHAZADO**

- **SOLICITADO**: El asesor/supervisor llena el formulario. El crédito anterior permanece ACTIVO. La solicitud queda pendiente de revisión por el gerente.
- **APROBADO**: El gerente da el visto bueno. Puede ajustar el monto aprobado. El crédito anterior **no se toca** todavía — la solicitud queda en cola de desembolso.
- **ACTIVO**: El gerente (o asesor) confirma que el efectivo fue entregado. En ese momento: crédito anterior → RENOVADO, pagos pendientes → PAGADO, multas → cobradas, nuevo crédito creado en ACTIVO con tipo=RENOVACION y calendario completo.
- **RECHAZADO**: El gerente rechaza con motivo. El crédito anterior permanece ACTIVO sin cambios.

#### Restricciones de rol

- Solo **Supervisor (campo)** y **Asesor** pueden crear solicitudes de renovación.
- Solo **Gerente de Sucursal** y **Gerente General** pueden aprobar o rechazar.
- La confirmación del desembolso (APROBADO → ACTIVO) la puede hacer cualquier rol autenticado.
- Se valida en backend con `@PreAuthorize`.

- Elegibilidad: pago **#16** (25 días) / pago **#19** (30 días). El sistema bloquea antes.
- Elegibilidad semanal: pago **#5** (8 semanas) / pago **#9** (12 semanas).
- El monto del crédito nuevo es a criterio del asesor y puede crecer conforme al historial. **No hay restricción basada en pagos pendientes.**
- El gerente puede ajustar el monto aprobado inline al aprobar; el ajuste se guarda en `monto_aprobado`.
- **Fórmula del desembolso (confirmada):**
  ```
  Desembolso = monto_aprobado − Pagos Restantes − Multas Pendientes − Pago Adelantado nuevo
  ```
  Ejemplo: $8,000 − (8 × $416 = $3,328) − $0 − $416 = **$4,256**
- Pago adelantado → se aplica al último pago del nuevo crédito.
- Campos calculados automáticamente: Pagos Restantes, Monto Pagos Restantes, Pago Crédito Nuevo, Monto a Entregar.
- Al confirmar desembolso: crédito anterior → estado RENOVADO; pagos pendientes → PAGADO; multas → cobradas=true.
- Se crea nuevo crédito directamente en estado ACTIVO con calendario de pagos generado.
- Registro de `renovaciones` vincula credito_anterior_id ↔ credito_nuevo_id para trazabilidad.
- Evidencias multimedia: `renovaciones.evidencia_urls TEXT[]` (fotos/videos del negocio, opcional).
- Video de entrega: `renovaciones.video_entrega_url` (opcional, se sube al confirmar el desembolso).

### 6.5 Colocaciones ✅ Implementado (Módulo 5)

- Vista semanal (Lunes–Viernes) por asesor. Incluye créditos nuevos + renovaciones.
- Columnas: Fecha | Cliente | Crédito Anterior | Crédito Nuevo | Desembolso | Asesor | Tipo.
- Columnas: Fecha | Cliente | Crédito Anterior | Crédito Nuevo | Desembolso | Forma de Pago | Asesor | Tipo.
- Totales al pie: Total Desembolsos (todos) y Total Caja (solo filas con salida_de=CAJA).
- Vive en módulo **Renovaciones** → pestaña "Colocaciones Semanales".
- **Implementación**: reporte calculado por JOIN a creditos (fechaDesembolso) + renovaciones (fecha).
  No requiere poblar la tabla `colocaciones`; esta queda disponible para Corte de Caja/Reportes.
- Exportable a PDF via iText 8 — `GET /api/renovaciones/colocaciones/pdf`.
- Filtros: semanaInicio (date), asesorId, sucursalId. Rol ASESOR_COBRADOR: solo sus filas.
- Total Caja = suma de desembolsos de renovaciones con salida_de='CAJA' (nuevos no tienen tracking de salida_de).

### 6.6 Corte de Caja

Fórmula implementada:

```
monto_apertura
+ ingreso_carteras       (COALESCE SUM pagos.monto_recibido de la sucursal hoy)
− desembolsos            (SUM creditos.monto_capital con fecha_desembolso hoy)
+ sum(movimientos_inv)   (neto positivo=entrada / negativo=salida)
= subtotal_caja

porcentaje_ahorro × ingreso_carteras = monto_libres
monto_libres − ahorro_fijo           = total_real_libres
```

- Solo pueden aperturar/cerrar: **Administrador y Supervisor**.
- Pantalla de cierre (`/caja/cierre`): muestra preview con todas las secciones antes de confirmar.
- El cierre es irreversible. Tras confirmar se muestra resumen final con botón "Exportar PDF".
- PDF generado server-side con iTextPDF (endpoint `GET /api/caja/{cajaId}/pdf`).
- **Secciones IMPLEMENTADAS en el cierre**: Inversiones, Ingresos por asesor, Desembolsos (nuevo vs renovación), Subtotal Caja, Libres, Multas por asesor.
- **Secciones PENDIENTES** (placeholder visual en UI y PDF): Gastos operativos, Nómina.
- Historial de cierres: tab "Historial" en `/caja`, filtro por rango de fechas, clic para expandir detalle, descarga PDF individual.
- Desglose desembolsos: usa `credito.tipo` (NUEVO | RENOVACION) para separar.

### 6.7 Gastos Operativos ✅ Implementado (Módulo 7 — V18/V19/V20/V21)

#### Categorías por sucursal

Las categorías son configurables por sucursal desde el módulo de Administración. Seed inicial (V19):

- **Gasolina** — combustible de las motocicletas de campo
- **Servicio de Motos** — mantenimiento, reparaciones, refacciones
- **Gastos Varios** — papelería, agua, recargas, limpieza, comidas, etc.

Las categorías se gestionan en la tabla `categoria_gasto` con `activo BOOLEAN` para soft-deactivate. No se eliminan filas para no romper FKs de gastos históricos.

#### Reglas de registro

- Los gastos **solo pueden registrarse mientras la caja del día está en estado `ABIERTA`**.
- Una vez cerrada la caja (`CERRADA`), los gastos del día quedan en modo lectura — no se pueden agregar, editar ni eliminar.
- El campo `concepto` es texto libre que complementa la categoría (ej: "Gasolina Isaul", "Cambio de llantas moto").
- El comprobante/referencia es **texto libre** (folio, número, descripción) — **NO es upload de archivo**.

#### Soft delete — tabla financiera

- La tabla `gasto` tiene `deleted_at TIMESTAMPTZ` — **NUNCA se borran registros financieros**.
- Al "eliminar" un gasto se actualiza `deleted_at = NOW()`.
- El cálculo de `total_gastos` en caja siempre filtra `WHERE deleted_at IS NULL`.

#### Impacto en el cierre de caja

Al cerrar la caja, `total_gastos` se calcula como `COALESCE(SUM(gasto.monto), 0)` de los gastos no eliminados del día. La fórmula actualizada de libres es:

```
total_real_libres = monto_libres − ahorro_fijo − total_gastos
```

Donde `monto_libres = porcentaje_ahorro × ingreso_carteras`.

#### Permisos por rol

- Solo **Administrador** y **Supervisor** (Gerente de Sucursal) pueden registrar gastos.
- Los roles `SUPERVISOR_CAMPO` y `ASESOR_COBRADOR` no tienen acceso al módulo de Gastos.

#### Nómina

Nómina: **NO es módulo del sistema** — excluida por el cliente.

### 6.8 Garantías

- Descripción textual del objeto únicamente — no se gestiona recuperación.
- Aplica en créditos nuevos y renovaciones de monto grande.
- Visible en ficha del cliente.
