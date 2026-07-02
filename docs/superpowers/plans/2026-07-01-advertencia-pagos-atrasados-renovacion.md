# Advertencia de Pagos Atrasados en Renovación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar un banner ámbar de advertencia en el Paso 1 de la solicitud de renovación cuando el cliente tiene 2 o más pagos vencidos, sin bloquear el flujo.

**Architecture:** Cambio puramente de UI en un solo archivo. El dato `pagosVencidos` ya existe en `creditoActivo.estadisticas.pagosVencidos` — no hay cambios en backend ni en servicios. El banner sigue el patrón visual del aviso azul que ya existe en el Paso 2 del mismo componente.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, lucide-react

---

### Task 1: Agregar banner de advertencia en TabNuevaRenovacion

**Files:**
- Modify: `frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx:5-12` (import)
- Modify: `frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx:329-332` (JSX — entre card cliente y Forma de Pago)

---

- [ ] **Step 1: Agregar `AlertTriangle` al import de lucide-react**

En `frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx`, líneas 5-12, cambiar:

```tsx
import {
  Search,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Send,
  Clock,
} from 'lucide-react'
```

Por:

```tsx
import {
  Search,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Send,
  Clock,
  AlertTriangle,
} from 'lucide-react'
```

- [ ] **Step 2: Insertar el banner ámbar entre el card del cliente y "Forma de Pago"**

En `frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx`, después del bloque `{/* Buscar cliente */}` (que cierra alrededor de la línea 329) y antes de `{/* Monto nuevo */}` (línea ~331), agregar:

```tsx
          {/* Advertencia: pagos atrasados */}
          {creditoActivo && elegible && (creditoActivo.estadisticas?.pagosVencidos ?? 0) >= 2 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-800 mb-0.5">Cliente con pagos atrasados</p>
                <p className="text-amber-700">
                  Este cliente registra {creditoActivo.estadisticas.pagosVencidos} pagos vencidos.
                  Solicitudes con historial de atrasos podrían no ser aprobadas por el sistema.
                  La solicitud se enviará a revisión para su validación.
                </p>
              </div>
            </div>
          )}
```

El bloque queda así en contexto (extracto del JSX del Paso 1):

```tsx
          {/* Buscar cliente */}
          <div>
            {/* ... card del cliente seleccionado o buscador ... */}
          </div>

          {/* Advertencia: pagos atrasados */}
          {creditoActivo && elegible && (creditoActivo.estadisticas?.pagosVencidos ?? 0) >= 2 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-800 mb-0.5">Cliente con pagos atrasados</p>
                <p className="text-amber-700">
                  Este cliente registra {creditoActivo.estadisticas.pagosVencidos} pagos vencidos.
                  Solicitudes con historial de atrasos podrían no ser aprobadas por el sistema.
                  La solicitud se enviará a revisión para su validación.
                </p>
              </div>
            </div>
          )}

          {/* Monto nuevo */}
          {creditoActivo && elegible && (
            <>
              {/* Forma de Pago ... */}
```

- [ ] **Step 3: Verificar que el tipo `pagosVencidos` existe en los tipos del frontend**

Confirmar que en `frontend/src/types/index.ts` la interfaz de estadísticas de crédito incluye `pagosVencidos: number`. Buscar con:

```bash
grep -n "pagosVencidos" frontend/src/types/index.ts
```

Resultado esperado: una línea con `pagosVencidos: number` dentro de la definición de estadísticas del `CreditoDetalle`.

Si no existiera (improbable — ya está mapeado en `creditoService.ts`), agregar el campo al tipo correspondiente. No debería ser necesario.

- [ ] **Step 4: Verificar compilación TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Resultado esperado: sin errores. Si hay error de tipo, revisar que `creditoActivo.estadisticas` no sea `undefined` — el operador `?.` y `?? 0` ya lo protegen.

- [ ] **Step 5: Verificar visualmente en el navegador**

Iniciar el servidor de desarrollo:

```bash
cd frontend && npm run dev
```

1. Ir a **Renovaciones → Nueva Renovación**
2. Buscar y seleccionar un cliente que tenga 2 o más pagos vencidos en su crédito activo
3. Confirmar que el banner ámbar aparece entre el card del cliente y la sección "Forma de Pago"
4. Confirmar que el número de pagos vencidos es correcto (ej. "3 pagos vencidos")
5. Confirmar que el formulario sigue funcionando: se puede llenar monto, garantía y llegar al Paso 2
6. Seleccionar un cliente sin pagos vencidos (o con 1) → confirmar que el banner NO aparece

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx
git commit -m "feat: mostrar advertencia en renovación cuando cliente tiene pagos atrasados"
```
