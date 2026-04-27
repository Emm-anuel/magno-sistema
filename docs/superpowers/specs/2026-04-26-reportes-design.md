# Módulo 8 — Reportes: Diseño
**Fecha:** 2026-04-26  
**Estado:** Aprobado  
**Ruta:** `/reportes`  
**Roles con acceso:** `ADMINISTRADOR` (Gerente General) · `SUPERVISOR` (Gerente de Sucursal)  
**Responsive:** Prioridad baja — solo oficina (desktop/tablet)

---

## 1. Estructura General

### Selector de sucursal
- **ADMINISTRADOR:** dropdown con todas las sucursales activas. Se pre-selecciona la primera sucursal al cargar la página. Debe tener una seleccionada siempre — sin opción "todas consolidadas".
- **SUPERVISOR:** su sucursal pre-fijada (solo lectura, sin dropdown).
- El selector es persistente en todas las pestañas, visible arriba de los filtros de cada tab.

### Pestañas
```
[ Ingresos/Egresos ] [ Colocaciones ] [ Cartera ] [ Por Asesor ]
```
Cada pestaña mantiene sus propios filtros de forma independiente. Cambiar de tab no resetea los filtros del tab anterior.

### Exportación PDF
- Cada pestaña tiene un botón "Exportar PDF".
- Llama al endpoint PDF del reporte activo con los mismos filtros aplicados.
- Se deshabilita mientras carga (`loading` state).
- **No hay envío por correo** — solo exportación a archivo.

### Paleta de colores del módulo
Coherente con el sistema (verde esmeralda principal):
- Ingresos / métricas positivas: `bg-emerald-50 border-emerald-300 text-emerald-800`
- Datos financieros (créditos, desembolsos): `bg-blue-50 border-blue-300 text-blue-800`
- Gastos / alertas secundarias: `bg-amber-50 border-amber-300 text-amber-800`
- Mora / riesgo: `bg-red-50 border-red-300 text-red-800`
- Filas de totales: `bg-emerald-100 font-semibold`

---

## 2. Tab "Ingresos/Egresos"

**Propósito:** reporte consolidado de múltiples días de caja en un rango de fechas.

### Filtros
- Desde / Hasta (date inputs, default = mes actual)
- Botón "Generar reporte" — la tabla carga solo al hacer clic, no en tiempo real

### Cards de resumen (4 métricas, arriba de la tabla)
| Card | Color |
|---|---|
| Total Ingresos Carteras | `bg-emerald-50 border-emerald-300 text-emerald-800` |
| Total Desembolsos | `bg-blue-50 border-blue-300 text-blue-800` |
| Total Gastos | `bg-amber-50 border-amber-300 text-amber-800` |
| Subtotal Neto (ingresos − egresos) | Verde si positivo / rojo si negativo |

### Tabla detallada por día
| Columna | Fuente |
|---|---|
| Fecha | `caja_dia.fecha` |
| Ingresos Carteras | `caja_dia.ingreso_carteras` |
| Desembolsos | `caja_dia.desembolsos` |
| Gastos | `caja_dia.total_gastos` |
| Inversiones | suma neta de `caja_movimiento_inversion` del día |
| Subtotal | `caja_dia.subtotal_caja` |

- Solo se muestran días con caja en estado `CERRADA`.
- Fila de totales al pie con `bg-emerald-100 font-semibold`.

### Endpoints
```
GET /api/reportes/ingresos-egresos     ?sucursalId= &desde= &hasta=
GET /api/reportes/ingresos-egresos/pdf ?sucursalId= &desde= &hasta=
```

---

## 3. Tab "Colocaciones"

**Propósito:** misma vista que el módulo `/colocaciones` existente pero con rango de fechas libre (no limitado a la semana actual).

### Filtros
- Desde / Hasta (default = semana actual, lunes a hoy)
- Asesor — dropdown opcional (todos por defecto)
- Botón "Generar reporte"

### Tabla
| Fecha | Cliente | Cto. Anterior | Cto. Nuevo | Desembolso | Forma de Pago | Asesor | Tipo |
|---|---|---|---|---|---|---|---|

Badges:
- `NUEVO` → `bg-emerald-100 text-emerald-800`
- `RENOVACION` → `bg-blue-100 text-blue-800`
- `DIARIO` → `bg-gray-100 text-gray-700`
- `SEMANAL` → `bg-blue-100 text-blue-700`

Fila de totales al pie (`bg-emerald-100 font-semibold`):
- Total Desembolsos (todas las filas)
- Total Caja (solo renovaciones con `salida_de = CAJA`)

### Fuente de datos
JOIN `creditos` + `renovaciones` por `fecha_desembolso` en el rango indicado.  
Este endpoint es distinto al existente `/api/renovaciones/colocaciones` (que solo acepta `semanaInicio`). Se reutiliza la misma lógica SQL pero los parámetros cambian a `desde`/`hasta`.

### Endpoints
```
GET /api/reportes/colocaciones     ?sucursalId= &desde= &hasta= &asesorId=
GET /api/reportes/colocaciones/pdf ?sucursalId= &desde= &hasta= &asesorId=
```

---

## 4. Tab "Cartera"

**Propósito:** foto del estado actual de la cartera activa + métricas de mora. Sin filtro de fechas.

### Filtros
- Asesor — dropdown opcional (todos por defecto)
- Estado de mora — chips: `Todos · Al corriente · En mora`

### Cards de resumen (4 métricas)
| Card | Color |
|---|---|
| Total créditos activos | `bg-emerald-50 border-emerald-300 text-emerald-800` |
| Monto total colocado | `bg-blue-50 border-blue-300 text-blue-800` |
| Créditos en mora | `bg-red-50 border-red-300 text-red-800` |
| Monto en riesgo | `bg-amber-50 border-amber-300 text-amber-800` |

### Tabla de créditos activos
| Cliente | Asesor | Monto | Pagos | Saldo Pendiente | Multas Pendientes | Estado |
|---|---|---|---|---|---|---|

- **Pagos:** `realizados / total` (ej. `14/25`)
- **Saldo Pendiente:** calculado en backend (`pagos_restantes × pago_periodico`)
- **Multas Pendientes:** `SUM(multas.monto WHERE cobrada=false AND credito_id=x)` — multas aún no cobradas del crédito
- **Estado:** `Al corriente` → `bg-emerald-100 text-emerald-800` | `En mora` → `bg-red-100 text-red-800`
- **Criterio de mora:** crédito con al menos un `calendario_pagos` en estado `NO_PAGADO` o `PARCIAL` sin cubrir en la fecha actual
- **Paginación:** 50 registros por página
- Fila de totales al pie con `bg-emerald-100 font-semibold`

### Fuente de datos
`creditos` (estado `ACTIVO`) + `calendario_pagos` + `multas`

### Endpoints
```
GET /api/reportes/cartera     ?sucursalId= &asesorId= &estado=
GET /api/reportes/cartera/pdf ?sucursalId= &asesorId= &estado=
```
Valores válidos de `estado`: `TODOS` (default) · `AL_CORRIENTE` · `EN_MORA`

---

## 5. Tab "Por Asesor"

**Propósito:** desempeño de cobranza en un período + cartera activa, agrupado por asesor.

### Filtros
- Desde / Hasta (default = mes actual)
- Asesor — dropdown opcional (todos por defecto)
- Botón "Generar reporte"

### Layout: tarjeta por asesor
Cada asesor tiene su card con dos bloques:

**Bloque A — Cobranza del período** (header `bg-emerald-50`)
| Métrica | Fuente |
|---|---|
| Cobros registrados | `COUNT(pagos)` del período con `asesor_id` |
| Monto cobrado | `SUM(pagos.monto_recibido)` |
| Multas cobradas | `SUM(multas.monto WHERE cobrada=true)` del período |
| Pagos incompletos | `COUNT(pagos WHERE es_completo=false)` |

**Bloque B — Cartera activa** (header `bg-blue-50`)
| Métrica | Fuente |
|---|---|
| Clientes activos | `COUNT(creditos ACTIVO)` del asesor |
| Monto total colocado | `SUM(creditos.monto_capital)` |
| Clientes en mora | `COUNT` con pagos `NO_PAGADO`/`PARCIAL` sin cubrir |
| Monto en riesgo | saldo pendiente de créditos en mora |

Fila de totales globales al final (suma de todos los asesores), fondo `bg-emerald-100 font-semibold`.  
Si se filtra por asesor específico → solo aparece su card.

### Endpoints
```
GET /api/reportes/por-asesor     ?sucursalId= &desde= &hasta= &asesorId=
GET /api/reportes/por-asesor/pdf ?sucursalId= &desde= &hasta= &asesorId=
```

---

## 6. Arquitectura Backend

### Seguridad
```java
@PreAuthorize("hasAnyRole('ADMINISTRADOR', 'SUPERVISOR')")
```
El `SUPERVISOR` solo puede consultar su propia `sucursal_id`. El backend valida que el `sucursalId` del request coincida con el del usuario autenticado.

### Clases
```
ReporteController     → 8 endpoints (4 datos + 4 PDF)
ReporteService        → 4 métodos de datos + 4 de PDF (iText 8)
ReporteRepository     → queries JPQL/nativas por reporte
```

### DTOs de respuesta
| DTO | Contenido |
|---|---|
| `ReporteIngresosEgresosDTO` | `List<FilaDiariaDTO>` + totales del período |
| `ReporteColocacionesDTO` | `List<ColocacionFilaDTO>` + totalDesembolsos + totalCaja |
| `ReporteCarteraDTO` | métricas resumen + `List<CreditoActivoDTO>` (paginado) |
| `ReportePorAsesorDTO` | `List<AsesorResumenDTO>` (cada uno con cobranza + cartera) |

### PDF
Patrón idéntico al PDF de caja existente: generado en `ReporteService` con iText 8, devuelto como `application/pdf` con `Content-Disposition: attachment`. Cada PDF incluye: nombre del sistema, sucursal, filtros aplicados y fecha de generación.

---

## 7. Arquitectura Frontend

### Componentes
```
/pages/ReportesPage.tsx
/pages/reportes/
  TabIngresosEgresos.tsx
  TabColocaciones.tsx
  TabCartera.tsx
  TabPorAsesor.tsx
/services/reporteService.ts         → 4 llamadas de datos + 4 de PDF
/components/reportes/
  SucursalSelector.tsx              → dropdown (solo ADMINISTRADOR)
  FiltroFechas.tsx                  → inputs Desde/Hasta reutilizable
  ExportPdfButton.tsx               → botón con estado loading/disabled
  MetricCard.tsx                    → card de métrica con color configurable
```

### Flujo de datos
1. Usuario selecciona sucursal (o la ve fija si es SUPERVISOR)
2. Ajusta filtros dentro del tab activo
3. Clic "Generar reporte" → llama endpoint de datos → renderiza tabla + cards
4. Clic "Exportar PDF" → llama endpoint PDF con los mismos filtros → descarga directa

### Router
```tsx
<Route path="/reportes" element={<ReportesPage />} />
```
Protegida con el guard de roles existente.

### Estado vacío
Si no hay datos: ilustración + mensaje "No hay datos para el período seleccionado" + botón "Cambiar filtros".
