# Rediseño del Calendario de Pagos (tab "Calendario") — Diseño

**Fecha:** 2026-08-06
**Módulo:** Créditos Nuevos (Módulo 3) / Cobros (Módulo 4)
**Estado:** Aprobado

---

## Contexto

En `CreditoDetallePage`, el tab "Calendario" muestra una tabla con una fila por pago programado. El usuario reportó que le cuesta trabajo leer esta tabla: no distingue de un vistazo cuándo un pago fue cubierto por un abono extraordinario, cuándo una multa fue condonada o sigue pendiente, y tiene que abrir el modal "Ver pago"/"Ver abono" fila por fila para entender qué pasó. Esto complica la decisión de aceptar renovaciones, donde se necesita evaluar rápido el historial de cumplimiento del cliente.

Durante la investigación de código se encontraron dos causas raíz adicionales, no reportadas explícitamente por el usuario pero confirmadas con él:

1. **El frontend descarta el estado de condonación de multas.** El backend (`MultaDTO`) ya expone `condonada`, `condonadaEnRenovacionId`, `condonadaPorNombre`, `fechaCondonacion`, `motivoCondonacion` y `cobradaEnAbonoId` vía `GET /api/cobros/multas/{creditoId}`, pero `normalizeMulta()` en `cobrosService.ts` y el tipo `MultaCobroDTO` en `types/index.ts` no los mapean. Por eso hoy es imposible ver en el calendario si una multa fue condonada — el dato llega del servidor y se tira en el cliente.
2. **Los pagos saldados al aprobar una renovación se ven idénticos a un pago real del día.** `RenovacionService.confirmarDesembolso()` marca en bloque `estado = PAGADO` a todos los pagos pendientes del crédito anterior (línea ~388), sin que el cliente haya pagado día por día. La tabla actual no distingue esto de un pago real: ambos se pintan igual ("Pagado", verde), aunque el "Monto recibido" quede vacío en el caso de renovación. Esto contribuye directamente a la confusión reportada.

---

## Decisiones confirmadas

| Pregunta | Decisión |
|---|---|
| ¿Alcance del rediseño? | Solo el tab "Calendario" (tabla + resumen) de `CreditoDetallePage`. No se toca el modal "Ver abono", la pantalla de aprobar renovaciones, ni `ClienteDetallePage`. |
| ¿Incluir el estado de multas condonadas? | Sí — es requisito del rediseño, no opcional. |
| ¿Distinguir "pagado por el cliente" de "saldado por renovación"? | Sí — deben verse como estados distintos. |
| ¿Se pueden agrupar/colapsar filas para reducir ruido visual? | Sí, pero **solo** rachas de pagos ya resueltos sin problema (pasado). Los pagos **pendientes/futuros siempre se listan individualmente**, sin colapsar — el usuario valoró explícitamente poder ver de un vistazo todo lo que falta por cobrar. |
| ¿Cambios de backend/API? | Ninguno. Todo el dato necesario ya existe en las respuestas actuales; el problema es de mapeo y presentación en el frontend. |

---

## Sección 1: Clasificación de cada fila del calendario

Cada entrada de `calendario` (`CalendarioPagoDetalle`) se clasifica cruzando su `estado` con la presencia (o ausencia) de un registro real en `pagosHistorial` (pagos) o `abonosCredito` (coberturas de abono):

| Clasificación | Cómo se detecta | ¿Agrupable? |
|---|---|---|
| **Pendiente** | `estado === 'PENDIENTE'` y `fechaProgramada >= hoy` | No — siempre individual |
| **Vencido / sin registrar** | `estado === 'PENDIENTE'` y `fechaProgramada < hoy` | No — siempre individual (excepción, rojo) |
| **Pagado a tiempo (limpio)** | `estado` en `PAGADO`/`ADELANTADO`, existe un `PagoCobroDTO` con el mismo `numeroPago` en `pagosHistorial`, y no hay multa asociada a esa fecha/pago | Sí |
| **Cubierto por abono** | `estado` en `RECUPERADO`/`RECUPERADO_PARCIAL`, o `ADELANTADO`/`PAGADO` con cobertura encontrada en `abonosCredito[].coberturas` | No — siempre individual (excepción) |
| **Pago parcial directo** | `estado === 'PARCIAL'` (registrado directo, no vía abono) | No — siempre individual (excepción) |
| **No pagó** | `estado === 'NO_PAGADO'` | No — siempre individual (excepción) |
| **Cubierto por renovación** | `estado` en `PAGADO`/`ADELANTADO`/`RECUPERADO`, **sin** `PagoCobroDTO` en `pagosHistorial` **ni** cobertura en `abonosCredito`, y `credito.liquidadoPorRenovacion` existe | Sí (grupo propio, separado de "limpio") |

Una fila **siempre** se marca como excepción individual (nunca se agrupa) si tiene una multa asociada (`monto > 0` en `multasPorFecha`/`multasPagoPorNumero`), sin importar su clasificación base — así el usuario nunca pierde de vista una multa, esté condonada, cubierta o pendiente.

### Estado de la multa (independiente del estado del pago)

Para cada multa relacionada (usando los nuevos campos de `MultaDTO`):

- `condonada === true` → **"Multa condonada"** (morado). Texto: *"Condonada por {condonadaPorNombre} el {fechaCondonacion} — {motivoCondonacion}"*.
- `condonada === false && cobrada === true && cobradaEnAbonoId` → **"cubierta con abono"** (azul) — comportamiento ya existente, se conserva.
- `condonada === false && cobrada === true && cobradaEnPagoId` → **"cobrada con el siguiente pago"** (comportamiento ya existente).
- `condonada === false && cobrada === false` → **"Multa pendiente"** (rojo) — comportamiento ya existente, ahora explícito en el texto de la fila en vez de solo en la columna de Multa.

---

## Sección 2: Agrupación de rachas (solo historial)

Se recorre `calendario` en orden. Se acumulan filas consecutivas de la **misma** clasificación agrupable (`Pagado a tiempo` o `Cubierto por renovación` — no se mezclan entre sí). Cualquier fila no agrupable corta la racha.

- **Umbral mínimo: 2 filas.** Una racha de tamaño 1 se muestra como fila normal (sin envoltorio de grupo) — colapsar un solo pago es ruido, no ahorro.
- Al alcanzar el umbral, el grupo se renderiza **colapsado por defecto** como una sola fila resumen: `▸ N pagos a tiempo · {fecha inicio}–{fecha fin} · {suma de montoEsperado}` (o el texto equivalente "saldados por renovación" para ese grupo).
- Un clic expande el grupo mostrando cada fila individual con su formato normal (sin explicación extendida, ya que son pagos sin incidentes). Cada grupo mantiene su propio estado de expansión de forma independiente — no hace falta colapsar otros grupos al abrir uno.
- **Los pagos "Pendiente" nunca entran en esta lógica.** Se listan siempre, uno por uno, en su propia sección al final ("Próximos pagos"), igual que hoy.

Estado de expansión: `useState<Set<string>>` en memoria (clave = índice del grupo), sin persistencia — se resetea al recargar la página, igual que cualquier estado de UI transitorio en esta pantalla.

---

## Sección 3: Contenido de cada fila

Reemplaza la tabla rígida (`table-fixed`) actual por una lista de filas tipo "card" (`div` con flex/grid), **no** un `<table>` HTML. Motivo: las explicaciones de las excepciones son texto de longitud variable (una oración), que no cabe bien en celdas de ancho fijo ni se adapta bien a pantallas angostas — un layout flex que apila verticalmente en móvil es más mobile-first que una tabla con scroll horizontal.

Cada fila individual (no colapsada) muestra:
- Fecha + número de pago (`# pago`)
- Badge de estado con color (ver paleta abajo) + una oración de explicación cuando es una excepción (qué pasó, quién intervino, cuánto). Los pagos "limpios" y "pendientes" no llevan oración, solo el badge — no hace falta explicar un pago normal.
- Monto (esperado y/o recibido según aplique)
- Acciones existentes sin cambios: "Ver pago" / "Modificar" (Admin/Supervisor) / "Ver abono", con la misma lógica de permisos que hoy.

### Paleta de estados (consistente con los mockups aprobados)

| Estado | Color |
|---|---|
| Pagado / Adelantado (limpio) | Verde `#dcfce7` / `#15803d` |
| Cubierto por abono | Azul `#dbeafe` / `#1d4ed8` |
| Atrasado / No pagó / Parcial directo | Rojo `#fee2e2` / `#b91c1c` (o ámbar para parcial, como hoy) |
| Multa condonada | Morado `#f3e8ff` / `#7e22ce` |
| Cubierto por renovación | Violeta `#ede9fe` / `#6d28d9` |
| Pendiente (futuro) | Gris `#f1f5f9` / `#475569` |

### Leyenda

Se agrega una fila de chips de leyenda (los 6 colores de la tabla anterior) fija arriba del calendario, siempre visible, para que cualquier usuario nuevo entienda el código de colores sin tener que preguntarlo.

---

## Sección 4: Resumen inferior

Se conserva el bloque de tarjetas de resumen existente (Pagados / Parciales / No pagaron / Vencidos / Pendientes + totales de cobrado/multas pendientes/adeudo/saldo). Único cambio: se agrega una tarjeta **"Multas condonadas"** (monto total, mismo estilo que "Multas pendientes" pero en morado) cuando `multasCondonadas > 0`, usando el nuevo campo `condonada` ahora disponible.

---

## Sección 5: Estructura de componentes

La lógica de clasificación + agrupación + render es sustancial y hoy vive inline dentro de `CreditoDetallePage.tsx` (ya tiene ~1270 líneas). Se extrae a un componente dedicado:

```
frontend/src/components/creditos/CalendarioPagos.tsx
```

Recibe como props los datos ya cargados por `CreditoDetallePage` (no hace fetch propio): `credito`, `calendario`, `pagosHistorial`, `abonosCredito`, `multasCalendario` (ya combinadas), `hoyIso`, más los callbacks/handlers que hoy abren los modales (`onVerPago`, `onModificarPago`, `onVerAbono`) y el flag `esAdminSupervisor`. `CreditoDetallePage` solo lo monta dentro del tab "Calendario" y sigue siendo dueño de los modales y las queries.

---

## Fuera de alcance (explícito)

- Modal "Ver abono" — sin cambios.
- Pantalla de aprobar renovaciones (`TabPendientesRenovacion`) — sin cambios.
- `ClienteDetallePage` — sin cambios, aunque comparte el mismo vacío de datos de condonación (documentado aquí para referencia futura, no se corrige en esta tarea).
- Cambios de backend/API — ninguno necesario.

---

## Archivos afectados

### Frontend
| Archivo | Cambio |
|---|---|
| `frontend/src/types/index.ts` | `MultaCobroDTO` +`condonada`, `condonadaEnRenovacionId`, `condonadaPorNombre`, `fechaCondonacion`, `motivoCondonacion`, `cobradaEnAbonoId` |
| `frontend/src/services/cobrosService.ts` | `normalizeMulta()` mapea los campos nuevos |
| `frontend/src/components/creditos/CalendarioPagos.tsx` | **Nuevo.** Clasificación, agrupación de rachas, leyenda, render de filas/grupos, resumen inferior |
| `frontend/src/pages/creditos/CreditoDetallePage.tsx` | El tab "Calendario" pasa a montar `<CalendarioPagos />`; se retira el `<table>` y la lógica de cálculo de multas/estado que se mueve al nuevo componente (se conservan los `useQuery` y modales tal cual) |

---

## Cómo se verifica

- Con datos reales tipo "Crédito #30" (abonos que cubren atrasos + multa, y cola liquidada por renovación): confirmar que la tabla muestra grupos colapsados solo en rachas limpias, cada excepción con su oración explicativa, y el bloque de renovación etiquetado distinto de un pago real.
- Un crédito activo con pagos pendientes futuros: confirmar que **todos** se listan individualmente, sin agrupar, con fecha y monto visibles.
- Un crédito con una multa marcada `condonada = true` en BD (vía el flujo de aprobación de renovación ya existente): confirmar que el badge morado y la oración con nombre/fecha/motivo aparecen correctamente.
- Revisar en viewport móvil (375px) que las filas se apilan sin scroll horizontal.
