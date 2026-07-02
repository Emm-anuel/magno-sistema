# Diseño: Advertencia de Pagos Atrasados en Solicitud de Renovación

**Fecha:** 2026-07-01
**Estado:** Aprobado
**Módulo:** Módulo 5 — Renovaciones

---

## Objetivo

Mostrar una advertencia visible al agente cuando el cliente tiene 2 o más pagos vencidos al momento de crear una solicitud de renovación. La advertencia no bloquea el flujo — el agente puede continuar y enviar la solicitud — pero deja claro que el sistema podría no aprobarla, y que pasará a revisión.

El tono del mensaje es deliberadamente neutral respecto al gerente: la restricción la presenta el sistema, y el gerente aparece como validador, no como el que rechaza.

---

## Contexto y Motivación

Los agentes (ASESOR_COBRADOR y SUPERVISOR_CAMPO) no deben asumir que cualquier cliente elegible tiene garantizada la aprobación de su renovación. Si un cliente tiene historial de atrasos repetidos, la renovación es de mayor riesgo y el gerente puede rechazarla. Sin esta advertencia, los agentes podrían sorprenderse al recibir rechazos, o intentar renovar clientes con mal historial sin entender las consecuencias.

El gerente prefiere que el sistema comunique la restricción, no él directamente.

---

## Datos disponibles

El campo `creditoActivo.estadisticas.pagosVencidos` ya existe en el frontend a través de `CreditoDetalleDTO.Estadisticas.pagosVencidos` (backend) y está mapeado en `creditoService.ts`. **No se requieren cambios en el backend.**

---

## Especificación

### Archivo afectado

`frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx`

### Condición de aparición

```
creditoActivo !== null
  AND elegible === true
  AND creditoActivo.estadisticas.pagosVencidos >= 2
```

- Solo se muestra cuando el formulario de monto ya es visible (cliente elegible).
- Si el cliente no es elegible, el agente ya ve un mensaje de bloqueo distinto; no se acumula advertencias.

### Posición

Entre el card del cliente seleccionado y el selector de "Forma de Pago". Ocupa el mismo espacio visual que el aviso azul de revisión que ya existe en el Paso 2.

### Visual

Banner ámbar independiente, siguiendo el mismo patrón del aviso azul del Paso 2:

```
┌──────────────────────────────────────────────────────────┐
│ ⚠  Cliente con pagos atrasados                           │
│    Este cliente registra N pagos vencidos. Solicitudes   │
│    con historial de atrasos podrían no ser aprobadas     │
│    por el sistema. La solicitud se enviará a revisión    │
│    para su validación.                                   │
└──────────────────────────────────────────────────────────┘
```

**Estilos:**
- Contenedor: `rounded-xl border border-amber-200 bg-amber-50 p-4`
- Flex layout: `flex items-start gap-3`
- Ícono: `AlertTriangle` (lucide-react, ya disponible), clase `w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5`
- Título: `font-semibold text-amber-800`
- Cuerpo: `text-sm text-amber-700`
- El número de pagos vencidos se muestra dinámicamente (ej. "3 pagos vencidos")

### Comportamiento

- La advertencia es puramente informativa — no deshabilita ningún campo ni botón.
- El agente puede completar el formulario (monto, garantía, evidencias) y enviar la solicitud con normalidad.
- El `toast.success` al enviar ya dice "pendiente de aprobación del gerente" — no se modifica.

---

## Lo que NO cambia

- Lógica de negocio del backend
- Condición de elegibilidad existente
- Flujo de aprobación/rechazo del gerente
- Paso 2 (confirmación) — no se agrega advertencia ahí

---

## Umbral decidido

**2 o más** pagos vencidos (`pagosVencidos >= 2`). Un solo retraso no activa la advertencia.
