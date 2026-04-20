# Renovaciones — Mejoras Módulo 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar Colocaciones Semanales como módulo propio de navegación, y agregar una sección "Listos para Renovar" dentro de Renovaciones con acceso escalonado por rol y preselección de cliente.

**Architecture:** Mejora 1 es puramente frontend — mueve `TabColocacionesSemanales` a `pages/colocaciones/`, agrega ruta y entrada en sidebar, y simplifica `RenovacionesPage` a 2 tabs. Mejora 2 agrega un endpoint backend `GET /api/renovaciones/listos` con scoping por rol idéntico al de colocaciones, un nuevo tab `TabListosRenovar` con filtros y navegación hacia `TabNuevaRenovacion` con cliente preseleccionado.

**Tech Stack:** Spring Boot 3 + Java 17 (backend), React 18 + TypeScript + Vite + TanStack Query + Tailwind (frontend), Lucide React icons.

---

## File Map

### Mejora 1 — Colocaciones como módulo independiente

| Acción | Archivo |
|--------|---------|
| **Crear** | `frontend/src/pages/colocaciones/ColocacionesPage.tsx` |
| **Mover** | `frontend/src/pages/renovaciones/TabColocacionesSemanales.tsx` → `frontend/src/pages/colocaciones/TabColocacionesSemanales.tsx` |
| **Modificar** | `frontend/src/App.tsx` — nueva ruta `/colocaciones` |
| **Modificar** | `frontend/src/components/Sidebar.tsx` — nueva entrada en Operación |
| **Modificar** | `frontend/src/pages/renovaciones/RenovacionesPage.tsx` — eliminar tab colocaciones |

### Mejora 2 — Listos para Renovar

| Acción | Archivo |
|--------|---------|
| **Crear** | `backend/src/main/java/com/magno/dto/renovacion/ListoRenovarItemDTO.java` |
| **Modificar** | `backend/src/main/java/com/magno/repository/CreditoRepository.java` — query JPQL |
| **Modificar** | `backend/src/main/java/com/magno/service/RenovacionService.java` — método `getListosParaRenovar` |
| **Modificar** | `backend/src/main/java/com/magno/controller/RenovacionController.java` — endpoint `GET /api/renovaciones/listos` |
| **Modificar** | `frontend/src/types/index.ts` — tipo `ListoRenovarItem` |
| **Modificar** | `frontend/src/services/renovacionService.ts` — método `getListosRenovar` |
| **Crear** | `frontend/src/pages/renovaciones/TabListosRenovar.tsx` |
| **Modificar** | `frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx` — prop `initialCliente` |
| **Modificar** | `frontend/src/pages/renovaciones/RenovacionesPage.tsx` — 2 tabs + estado preselección |

### Docs

| Acción | Archivo |
|--------|---------|
| **Modificar** | `docs/02-roles-y-permisos.md` |
| **Modificar** | `docs/04-modulos-y-ui.md` |
| **Modificar** | `docs/07-decisiones-y-pendientes.md` |

---

## Task 1: Mover TabColocacionesSemanales a su nuevo módulo

**Files:**
- Create: `frontend/src/pages/colocaciones/TabColocacionesSemanales.tsx`
- Delete: `frontend/src/pages/renovaciones/TabColocacionesSemanales.tsx`

- [ ] **Step 1.1: Crear directorio y mover el componente**

Crea `frontend/src/pages/colocaciones/TabColocacionesSemanales.tsx` con exactamente el mismo contenido que el original en `frontend/src/pages/renovaciones/TabColocacionesSemanales.tsx`. No cambiar nada del contenido — solo el destino.

Luego elimina `frontend/src/pages/renovaciones/TabColocacionesSemanales.tsx`.

- [ ] **Step 1.2: Crear ColocacionesPage.tsx**

Crea `frontend/src/pages/colocaciones/ColocacionesPage.tsx`:

```tsx
import TabColocacionesSemanales from './TabColocacionesSemanales'

export default function ColocacionesPage() {
  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Colocaciones Semanales</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Registro semanal de créditos nuevos y renovaciones desembolsados
        </p>
      </div>
      <TabColocacionesSemanales />
    </div>
  )
}
```

- [ ] **Step 1.3: Commit parcial**

```bash
git add frontend/src/pages/colocaciones/
git add frontend/src/pages/renovaciones/TabColocacionesSemanales.tsx
git commit -m "refactor(colocaciones): mover TabColocacionesSemanales a pages/colocaciones"
```

---

## Task 2: Registrar la ruta y el sidebar de Colocaciones

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 2.1: Agregar import y ruta en App.tsx**

En `frontend/src/App.tsx`, agregar import después de la línea `import RenovacionesPage`:

```tsx
import ColocacionesPage from '@/pages/colocaciones/ColocacionesPage'
```

Dentro del bloque `<Route element={<ProtectedRoute allowedRoles={ALL_ROLES} />}>` (el que contiene `/renovaciones`), agregar la ruta nueva justo debajo de `/renovaciones`:

```tsx
<Route path="/colocaciones" element={<ColocacionesPage />} />
```

El bloque queda así:

```tsx
<Route element={<ProtectedRoute allowedRoles={ALL_ROLES} />}>
  <Route path="/creditos-nuevos" element={<CreditosNuevosPage />} />
  <Route path="/creditos/:id" element={<CreditoDetallePage />} />
  <Route path="/renovaciones" element={<RenovacionesPage />} />
  <Route path="/colocaciones" element={<ColocacionesPage />} />
  <Route path="/historial" element={<HistorialPage />} />
</Route>
```

- [ ] **Step 2.2: Agregar icono CalendarDays al import del sidebar**

En `frontend/src/components/Sidebar.tsx`, agregar `CalendarDays` al import de lucide-react:

```tsx
import {
  LayoutDashboard, CreditCard, Wallet, RefreshCw, Users, History,
  Archive, Receipt, BarChart2, Building2, UserCog, ScrollText, Settings, X,
  CalendarDays,
} from 'lucide-react'
```

- [ ] **Step 2.3: Agregar entrada de navegación en Sidebar**

En `frontend/src/components/Sidebar.tsx`, dentro del array `NAV_SECTIONS`, en la sección `'Operación'`, agregar el item de Colocaciones **después** de Renovaciones:

```tsx
{
  label: 'Operación',
  items: [
    { label: 'Cobros',                to: '/cobros',        icon: Wallet,        roles: ['SUPERVISOR_CAMPO','ASESOR_COBRADOR'] },
    { label: 'Créditos Nuevos',       to: '/creditos-nuevos', icon: CreditCard,  roles: ['ADMINISTRADOR','SUPERVISOR','SUPERVISOR_CAMPO','ASESOR_COBRADOR'] },
    { label: 'Renovaciones',          to: '/renovaciones',  icon: RefreshCw,     roles: ['ADMINISTRADOR','SUPERVISOR','SUPERVISOR_CAMPO','ASESOR_COBRADOR'] },
    { label: 'Colocaciones',          to: '/colocaciones',  icon: CalendarDays,  roles: ['ADMINISTRADOR','SUPERVISOR','SUPERVISOR_CAMPO','ASESOR_COBRADOR'] },
  ],
},
```

- [ ] **Step 2.4: Verificar que el app compila**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 2.5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat(colocaciones): nueva ruta /colocaciones y entrada en sidebar"
```

---

## Task 3: Simplificar RenovacionesPage — eliminar tab Colocaciones

**Files:**
- Modify: `frontend/src/pages/renovaciones/RenovacionesPage.tsx`

- [ ] **Step 3.1: Reescribir RenovacionesPage.tsx**

Reemplaza el contenido completo de `frontend/src/pages/renovaciones/RenovacionesPage.tsx` con:

```tsx
import { useState } from 'react'
import TabNuevaRenovacion from './TabNuevaRenovacion'
import type { ClienteResumen } from '@/types'

type Tab = 'nueva'

export default function RenovacionesPage() {
  const [clientePreseleccionado, setClientePreseleccionado] = useState<ClienteResumen | null>(null)

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Renovaciones</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Procesa renovaciones de crédito para clientes elegibles
        </p>
      </div>
      <TabNuevaRenovacion
        initialCliente={clientePreseleccionado}
        onClearInitial={() => setClientePreseleccionado(null)}
      />
    </div>
  )
}
```

> Nota: el tab "Listos para Renovar" se agrega en Task 8. Por ahora dejamos `RenovacionesPage` sin tabs para que el módulo funcione mientras tanto.

- [ ] **Step 3.2: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit
```

El error esperado (si existe): `initialCliente` no existe en `TabNuevaRenovacion` todavía — lo corregimos en Task 6.

- [ ] **Step 3.3: Commit**

```bash
git add frontend/src/pages/renovaciones/RenovacionesPage.tsx
git commit -m "refactor(renovaciones): eliminar tab colocaciones — ahora módulo propio"
```

---

## Task 4: Backend — DTO y query para Listos para Renovar

**Files:**
- Create: `backend/src/main/java/com/magno/dto/renovacion/ListoRenovarItemDTO.java`
- Modify: `backend/src/main/java/com/magno/repository/CreditoRepository.java`

- [ ] **Step 4.1: Crear ListoRenovarItemDTO.java**

```java
package com.magno.dto.renovacion;

import java.math.BigDecimal;

public record ListoRenovarItemDTO(
        Long clienteId,
        String clienteNombre,
        Long creditoId,
        BigDecimal montoCapital,
        Integer plazoDias,
        BigDecimal pagoPeriodico,
        Long asesorId,
        String asesorNombre,
        Long sucursalId,
        String sucursalNombre,
        long pagosRealizados,
        int pagosRestantes,
        BigDecimal multasPendientes
) {}
```

- [ ] **Step 4.2: Agregar query en CreditoRepository.java**

En `backend/src/main/java/com/magno/repository/CreditoRepository.java`, agregar el siguiente método al final de la interfaz (antes del cierre `}`):

```java
@Query("SELECT c FROM Credito c WHERE c.estado = com.magno.model.EstadoCredito.ACTIVO " +
       "AND c.deletedAt IS NULL " +
       "AND (:asesorId IS NULL OR c.asesor.id = :asesorId) " +
       "AND (:sucursalId IS NULL OR c.sucursal.id = :sucursalId) " +
       "AND (SELECT COUNT(cp) FROM CalendarioPago cp WHERE cp.credito = c " +
       "     AND cp.estado IN :realizados) >= " +
       "    CASE WHEN c.plazoDias = 30 THEN 19L ELSE 16L END " +
       "ORDER BY c.cliente.apellidoPaterno ASC, c.cliente.nombre ASC")
List<Credito> findListosParaRenovar(
        @Param("asesorId") Long asesorId,
        @Param("sucursalId") Long sucursalId,
        @Param("realizados") List<EstadoCalendarioPago> realizados);
```

Agrega los imports necesarios en `CreditoRepository.java` si no existen:

```java
import com.magno.model.EstadoCalendarioPago;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
```

- [ ] **Step 4.3: Verificar que el proyecto backend compila**

```bash
cd backend && ./mvnw compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 4.4: Commit**

```bash
git add backend/src/main/java/com/magno/dto/renovacion/ListoRenovarItemDTO.java
git add backend/src/main/java/com/magno/repository/CreditoRepository.java
git commit -m "feat(renovaciones): DTO y query JPQL para créditos listos para renovar"
```

---

## Task 5: Backend — servicio y endpoint /listos

**Files:**
- Modify: `backend/src/main/java/com/magno/service/RenovacionService.java`
- Modify: `backend/src/main/java/com/magno/controller/RenovacionController.java`

- [ ] **Step 5.1: Agregar método getListosParaRenovar en RenovacionService.java**

En `RenovacionService.java`, agrega el siguiente método público después del método `getColocaciones`. Usa `multaRepo` que ya está inyectado:

```java
public List<ListoRenovarItemDTO> getListosParaRenovar(Long asesorId, Long sucursalId) {
    List<EstadoCalendarioPago> realizados = List.of(
            EstadoCalendarioPago.PAGADO,
            EstadoCalendarioPago.PARCIAL,
            EstadoCalendarioPago.ADELANTADO);

    return creditoRepo.findListosParaRenovar(asesorId, sucursalId, realizados)
            .stream()
            .map(c -> {
                long pagosRealizados = calendarioPagoRepo
                        .countByCreditoIdAndEstadoIn(c.getId(), realizados);
                int pagosRestantes = c.getPlazoDias() - (int) pagosRealizados;
                BigDecimal multas = multaRepo.sumMontosPendientesByCreditoId(c.getId());

                return new ListoRenovarItemDTO(
                        c.getCliente().getId(),
                        c.getCliente().getNombreCompleto(),
                        c.getId(),
                        c.getMontoCapital(),
                        c.getPlazoDias(),
                        c.getPagoPeriodico(),
                        c.getAsesor().getId(),
                        c.getAsesor().getNombreCompleto(),
                        c.getSucursal().getId(),
                        c.getSucursal().getNombre(),
                        pagosRealizados,
                        Math.max(0, pagosRestantes),
                        multas);
            })
            .toList();
}
```

Agrega el import de `ListoRenovarItemDTO` en `RenovacionService.java`:

```java
import com.magno.dto.renovacion.ListoRenovarItemDTO;
```

> Nota: `MultaRepository.sumMontosPendientesByCreditoId` ya existe. `CalendarioPagoRepository.countByCreditoIdAndEstadoIn` ya existe.

- [ ] **Step 5.2: Agregar endpoint en RenovacionController.java**

En `RenovacionController.java`, agrega el endpoint después del endpoint de `/colocaciones/pdf`:

```java
@GetMapping("/listos")
public ResponseEntity<List<ListoRenovarItemDTO>> getListos(
        @RequestParam(required = false) Long asesorId,
        @RequestParam(required = false) Long sucursalId,
        @AuthenticationPrincipal JwtPrincipal p) {

    Long effectiveAsesorId = asesorId;
    Long effectiveSucursalId = sucursalId;

    switch (p.rol()) {
        case "ASESOR_COBRADOR" -> effectiveAsesorId = p.userId();
        case "SUPERVISOR_CAMPO" -> effectiveSucursalId = p.sucursalId();
    }

    return ResponseEntity.ok(renovacionService.getListosParaRenovar(effectiveAsesorId, effectiveSucursalId));
}
```

Agrega el import si falta:

```java
import com.magno.dto.renovacion.ListoRenovarItemDTO;
import java.util.List;
```

- [ ] **Step 5.3: Compilar backend**

```bash
cd backend && ./mvnw compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 5.4: Probar el endpoint manualmente**

Arranca el backend y ejecuta:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/renovaciones/listos
```

Expected: array JSON (puede ser vacío `[]` si no hay datos de prueba aún).

- [ ] **Step 5.5: Commit**

```bash
git add backend/src/main/java/com/magno/service/RenovacionService.java
git add backend/src/main/java/com/magno/controller/RenovacionController.java
git commit -m "feat(renovaciones): endpoint GET /api/renovaciones/listos con scoping por rol"
```

---

## Task 6: Frontend — tipo y servicio para Listos para Renovar

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/renovacionService.ts`

- [ ] **Step 6.1: Agregar tipo ListoRenovarItem en types/index.ts**

En `frontend/src/types/index.ts`, agrega esta interfaz al final del archivo (antes del último export si hay, o al final):

```ts
export interface ListoRenovarItem {
  clienteId: number
  clienteNombre: string
  creditoId: number
  montoCapital: number
  plazoDias: number
  pagoPeriodico: number
  asesorId: number
  asesorNombre: string
  sucursalId: number
  sucursalNombre: string
  pagosRealizados: number
  pagosRestantes: number
  multasPendientes: number
}
```

- [ ] **Step 6.2: Agregar getListosRenovar en renovacionService.ts**

En `frontend/src/services/renovacionService.ts`, agrega el import del tipo nuevo en la primera línea:

```ts
import type { RenovacionCalculo, RenovacionDetalle, ColocacionesSemana, ListoRenovarItem } from '@/types'
```

Agrega la función `normalizeListoItem` antes del objeto `renovacionService`:

```ts
function normalizeListoItem(raw: any): ListoRenovarItem {
  return {
    clienteId: raw.clienteId ?? raw.cliente_id,
    clienteNombre: raw.clienteNombre ?? raw.cliente_nombre,
    creditoId: raw.creditoId ?? raw.credito_id,
    montoCapital: raw.montoCapital ?? raw.monto_capital,
    plazoDias: raw.plazoDias ?? raw.plazo_dias,
    pagoPeriodico: raw.pagoPeriodico ?? raw.pago_periodico,
    asesorId: raw.asesorId ?? raw.asesor_id,
    asesorNombre: raw.asesorNombre ?? raw.asesor_nombre,
    sucursalId: raw.sucursalId ?? raw.sucursal_id,
    sucursalNombre: raw.sucursalNombre ?? raw.sucursal_nombre,
    pagosRealizados: raw.pagosRealizados ?? raw.pagos_realizados,
    pagosRestantes: raw.pagosRestantes ?? raw.pagos_restantes,
    multasPendientes: raw.multasPendientes ?? raw.multas_pendientes ?? 0,
  }
}
```

Agrega el método `getListosRenovar` dentro del objeto `renovacionService`, después de `exportarPdfUrl`:

```ts
  getListosRenovar: (params?: {
    asesorId?: number
    sucursalId?: number
  }): Promise<ListoRenovarItem[]> =>
    api.get('/renovaciones/listos', { params })
      .then((r) => (r.data as any[]).map(normalizeListoItem)),
```

- [ ] **Step 6.3: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 6.4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/renovacionService.ts
git commit -m "feat(renovaciones): tipo ListoRenovarItem y método getListosRenovar"
```

---

## Task 7: TabNuevaRenovacion — soporte para cliente preseleccionado

**Files:**
- Modify: `frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx`

- [ ] **Step 7.1: Agregar props y lógica de preselección**

En `frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx`, modifica la firma de la función para aceptar dos props:

```tsx
interface Props {
  initialCliente?: ClienteResumen | null
  onClearInitial?: () => void
}

export default function TabNuevaRenovacion({ initialCliente, onClearInitial }: Props) {
```

Agrega un `useEffect` justo después de la declaración de los estados existentes (después de `const calcDebounceRef = useRef...`). Este efecto dispara la selección automática cuando llega un cliente externo:

```tsx
useEffect(() => {
  if (initialCliente && !clienteSeleccionado) {
    handleSelectCliente(initialCliente)
    onClearInitial?.()
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [initialCliente])
```

> `handleSelectCliente` ya existe en el componente — carga el crédito activo del cliente seleccionado. El `eslint-disable` es necesario para evitar el ciclo (no incluir `handleSelectCliente` ni `clienteSeleccionado` como dependencias porque reiniciaría el efecto).

- [ ] **Step 7.2: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 7.3: Commit**

```bash
git add frontend/src/pages/renovaciones/TabNuevaRenovacion.tsx
git commit -m "feat(renovaciones): TabNuevaRenovacion acepta cliente preseleccionado desde Listos"
```

---

## Task 8: Crear TabListosRenovar.tsx

**Files:**
- Create: `frontend/src/pages/renovaciones/TabListosRenovar.tsx`

- [ ] **Step 8.1: Crear el componente completo**

Crea `frontend/src/pages/renovaciones/TabListosRenovar.tsx`:

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react'
import { renovacionService } from '@/services/renovacionService'
import { useAuthStore } from '@/hooks/useAuthStore'
import { api } from '@/services/api'
import type { ListoRenovarItem, ClienteResumen } from '@/types'

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

interface Props {
  onRenovar: (cliente: ClienteResumen) => void
}

export default function TabListosRenovar({ onRenovar }: Props) {
  const { usuario } = useAuthStore()
  const rol = usuario?.rol

  const esAdmin = rol === 'ADMINISTRADOR' || rol === 'SUPERVISOR'
  const esSupervisorCampo = rol === 'SUPERVISOR_CAMPO'
  const puedeVerFiltros = esAdmin || esSupervisorCampo

  const [asesorFiltro, setAsesorFiltro] = useState<number | undefined>(undefined)
  const [sucursalFiltro, setSucursalFiltro] = useState<number | undefined>(undefined)
  const [pagosRestantesMax, setPagosRestantesMax] = useState<number | undefined>(undefined)

  // Asesores para filtro — mismo endpoint que TabHistorialCobros
  const { data: asesores = [] } = useQuery<{ id: number; nombre_completo: string }[]>({
    queryKey: ['asesores-list'],
    queryFn: () => api.get('/clientes/asesores').then((r) => r.data),
    enabled: puedeVerFiltros,
    staleTime: 60_000,
  })

  // Sucursales para filtro — solo Admin/Gerente
  const { data: sucursales = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['sucursales-list'],
    queryFn: () => api.get('/sucursales').then((r) => r.data),
    enabled: esAdmin,
    staleTime: 60_000,
  })

  const { data: items = [], isLoading, isError } = useQuery<ListoRenovarItem[]>({
    queryKey: ['listos-renovar', asesorFiltro, sucursalFiltro],
    queryFn: () => renovacionService.getListosRenovar({
      asesorId: asesorFiltro,
      sucursalId: sucursalFiltro,
    }),
    staleTime: 60_000,
  })

  // Filtro de pagos restantes aplicado en frontend (sobre datos ya cargados)
  const filtrados = pagosRestantesMax != null
    ? items.filter((i) => i.pagosRestantes <= pagosRestantesMax)
    : items

  function handleRenovar(item: ListoRenovarItem) {
    const cliente: ClienteResumen = {
      id: item.clienteId,
      nombre_completo: item.clienteNombre,
      celular: '',
      negocio_nombre: '',
      tiene_credito_activo: true,
    }
    onRenovar(cliente)
  }

  return (
    <div className="space-y-4">

      {/* Filtros */}
      {puedeVerFiltros && (
        <div className="flex flex-wrap gap-3">
          {/* Asesor */}
          <select
            value={asesorFiltro ?? ''}
            onChange={(e) => setAsesorFiltro(e.target.value ? Number(e.target.value) : undefined)}
            className="input text-sm py-1.5 pr-8 min-w-[160px]"
          >
            <option value="">Todos los asesores</option>
            {asesores.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre_completo}</option>
            ))}
          </select>

          {/* Sucursal — solo admin/supervisor */}
          {esAdmin && (
            <select
              value={sucursalFiltro ?? ''}
              onChange={(e) => setSucursalFiltro(e.target.value ? Number(e.target.value) : undefined)}
              className="input text-sm py-1.5 pr-8 min-w-[160px]"
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}

          {/* Pagos restantes máximo */}
          <select
            value={pagosRestantesMax ?? ''}
            onChange={(e) => setPagosRestantesMax(e.target.value ? Number(e.target.value) : undefined)}
            className="input text-sm py-1.5 pr-8 min-w-[180px]"
          >
            <option value="">Todos (pagos restantes)</option>
            <option value="2">Máx. 2 pagos restantes</option>
            <option value="5">Máx. 5 pagos restantes</option>
            <option value="9">Máx. 9 pagos restantes</option>
          </select>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="card p-8 flex items-center justify-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Cargando clientes listos para renovar...</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="card p-8 text-center text-red-500">
          Error al cargar el listado.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && filtrados.length === 0 && (
        <div className="card p-8 text-center text-gray-400">
          No hay clientes elegibles para renovación con los filtros actuales.
        </div>
      )}

      {/* Tabla desktop */}
      {!isLoading && filtrados.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="py-3 pr-4 font-medium">Cliente</th>
                  <th className="py-3 pr-4 font-medium">Asesor</th>
                  {esAdmin && <th className="py-3 pr-4 font-medium">Sucursal</th>}
                  <th className="py-3 pr-4 font-medium text-right">Monto crédito</th>
                  <th className="py-3 pr-4 font-medium text-center">Progreso</th>
                  <th className="py-3 pr-4 font-medium text-center">Restantes</th>
                  <th className="py-3 pr-4 font-medium text-right">Multas</th>
                  <th className="py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map((item) => (
                  <tr key={item.creditoId} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-800">{item.clienteNombre}</td>
                    <td className="py-3 pr-4 text-gray-600">{item.asesorNombre}</td>
                    {esAdmin && <td className="py-3 pr-4 text-gray-500 text-xs">{item.sucursalNombre}</td>}
                    <td className="py-3 pr-4 text-right text-gray-700">{fmt(item.montoCapital)}</td>
                    <td className="py-3 pr-4 text-center text-gray-600 whitespace-nowrap">
                      Pago {item.pagosRealizados} de {item.plazoDias}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span className={[
                        'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold',
                        item.pagosRestantes <= 2
                          ? 'bg-green-100 text-green-700'
                          : item.pagosRestantes <= 5
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600',
                      ].join(' ')}>
                        {item.pagosRestantes}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {item.multasPendientes > 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium text-xs">
                          <AlertCircle className="w-3 h-3" />
                          {fmt(item.multasPendientes)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => handleRenovar(item)}
                        className="btn flex items-center gap-1 text-xs py-1.5 px-3"
                      >
                        Renovar <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="md:hidden space-y-3">
            {filtrados.map((item) => (
              <div key={item.creditoId} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-800">{item.clienteNombre}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.asesorNombre}</div>
                    {esAdmin && <div className="text-xs text-gray-400">{item.sucursalNombre}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRenovar(item)}
                    className="btn flex items-center gap-1 text-xs py-1.5 px-3 flex-shrink-0"
                  >
                    Renovar <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-gray-500">Monto</span>
                  <span className="text-right font-medium">{fmt(item.montoCapital)}</span>
                  <span className="text-gray-500">Progreso</span>
                  <span className="text-right text-gray-700">
                    Pago {item.pagosRealizados} de {item.plazoDias}
                  </span>
                  <span className="text-gray-500">Restantes</span>
                  <span className={[
                    'text-right font-semibold',
                    item.pagosRestantes <= 2 ? 'text-green-600'
                      : item.pagosRestantes <= 5 ? 'text-amber-600'
                      : 'text-gray-700',
                  ].join(' ')}>
                    {item.pagosRestantes}
                  </span>
                  {item.multasPendientes > 0 && (
                    <>
                      <span className="text-gray-500">Multas</span>
                      <span className="text-right text-red-600 font-medium">
                        {fmt(item.multasPendientes)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 8.2: Verificar compilación**

```bash
cd frontend && npx tsc --noEmit
```

Expected: posible error en `ClienteResumen` si el tipo no tiene exactamente esos campos opcionales. Si el tipo real tiene campos requeridos adicionales, completarlos con valores vacíos en `handleRenovar`. Verificar `frontend/src/types/index.ts` para la forma exacta de `ClienteResumen`.

- [ ] **Step 8.3: Commit**

```bash
git add frontend/src/pages/renovaciones/TabListosRenovar.tsx
git commit -m "feat(renovaciones): TabListosRenovar — listado de clientes elegibles con filtros"
```

---

## Task 9: Conectar los tabs en RenovacionesPage

**Files:**
- Modify: `frontend/src/pages/renovaciones/RenovacionesPage.tsx`

- [ ] **Step 9.1: Reescribir RenovacionesPage con los 2 tabs finales**

Reemplaza el contenido completo de `frontend/src/pages/renovaciones/RenovacionesPage.tsx` con:

```tsx
import { useState } from 'react'
import TabListosRenovar from './TabListosRenovar'
import TabNuevaRenovacion from './TabNuevaRenovacion'
import type { ClienteResumen } from '@/types'

type Tab = 'listos' | 'nueva'

export default function RenovacionesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('listos')
  const [clientePreseleccionado, setClientePreseleccionado] = useState<ClienteResumen | null>(null)

  function handleRenovar(cliente: ClienteResumen) {
    setClientePreseleccionado(cliente)
    setActiveTab('nueva')
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'listos', label: 'Listos para Renovar' },
    { id: 'nueva',  label: 'Nueva Renovación' },
  ]

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Renovaciones</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Clientes elegibles y procesamiento de renovaciones de crédito
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-[#3d6b35] text-[#3d6b35]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'listos' && (
          <TabListosRenovar onRenovar={handleRenovar} />
        )}
        {activeTab === 'nueva' && (
          <TabNuevaRenovacion
            initialCliente={clientePreseleccionado}
            onClearInitial={() => setClientePreseleccionado(null)}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 9.2: Verificar compilación completa**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 9.3: Verificar que el backend levanta**

```bash
cd backend && ./mvnw spring-boot:run
```

Prueba los endpoints:
- `GET /api/renovaciones/listos` → array JSON
- `GET /api/renovaciones/colocaciones` → funciona igual que antes
- `GET /colocaciones` en el browser → página de Colocaciones funciona
- `GET /renovaciones` en el browser → tabs "Listos para Renovar" y "Nueva Renovación"

- [ ] **Step 9.4: Commit**

```bash
git add frontend/src/pages/renovaciones/RenovacionesPage.tsx
git commit -m "feat(renovaciones): tabs Listos para Renovar + Nueva Renovación con preselección"
```

---

## Task 10: Actualizar documentación

**Files:**
- Modify: `docs/02-roles-y-permisos.md`
- Modify: `docs/04-modulos-y-ui.md`
- Modify: `docs/07-decisiones-y-pendientes.md`

- [ ] **Step 10.1: Actualizar docs/04-modulos-y-ui.md**

En la tabla de módulos (sección "5. Módulos del Sistema"), actualiza las filas de Renovaciones y agrega Colocaciones como módulo nuevo:

Reemplaza la fila `| 4   | **renovaciones** ✅`:
```markdown
| 4   | **renovaciones** ✅     | Listos para Renovar · Nueva Renovación                        |
| 4b  | **colocaciones** ✅     | (semana actual, navegación por semanas, exportar PDF)         |
```

- [ ] **Step 10.2: Actualizar docs/02-roles-y-permisos.md**

En la sección de acceso por módulo, agrega Colocaciones como módulo separado con acceso a los 4 roles (mismo acceso que Renovaciones). Especifica que en "Listos para Renovar":
- Asesor → solo sus clientes
- Supervisor (SUPERVISOR_CAMPO) → clientes de su sucursal
- Gerente de Sucursal (SUPERVISOR) → clientes de su sucursal
- Gerente General (ADMINISTRADOR) → todos

- [ ] **Step 10.3: Actualizar docs/07-decisiones-y-pendientes.md**

Agrega entrada en la sección de decisiones aplicadas:

```markdown
### Módulo 5 — Renovaciones (actualización abril 2026)
- Colocaciones Semanales extraído a módulo propio `/colocaciones` — mismo backend, nueva ruta en sidebar
- Agregado tab "Listos para Renovar" en Renovaciones: listado readonly de créditos ACTIVO elegibles
  - Umbral 25d: 16+ pagos realizados / Umbral 30d: 19+ pagos realizados
  - Scoping por rol: ASESOR ve solo los suyos, SUPERVISOR_CAMPO su sucursal, SUPERVISOR/ADMIN configurable
  - Click en cliente → navega a "Nueva Renovación" con cliente preseleccionado
```

- [ ] **Step 10.4: Commit final**

```bash
git add docs/
git commit -m "docs: actualizar módulos y permisos — Colocaciones separado, tab Listos para Renovar"
```

---

## Self-Review

### Spec coverage

| Requisito | Tarea |
|-----------|-------|
| Colocaciones como módulo independiente en sidebar | Task 1–3 |
| Ruta propia `/colocaciones` | Task 2 |
| Permisos conservados (4 roles) | Task 2.3 — mismo `roles` array |
| Eliminar tab colocaciones de Renovaciones | Task 3 |
| Endpoint backend `GET /listos` con scoping por rol | Task 4–5 |
| Criterio: 25d → pago 16, 30d → pago 19 | Task 4.2 — CASE WHEN en JPQL |
| Datos mostrados: nombre, asesor, sucursal, monto, progreso, restantes, multas | Task 8.1 |
| Filtros: asesor, sucursal, pagos restantes | Task 8.1 |
| Acceso escalonado por rol (scoping backend + filtros ocultos en frontend) | Task 5.2 + Task 8.1 |
| Click → ir a Nueva Renovación con cliente preseleccionado | Task 7 + 9 |
| Docs actualizadas | Task 10 |

### Sin placeholders

Verificado: todos los pasos tienen código completo y comandos exactos.

### Consistencia de tipos

- `ListoRenovarItem` definido en Task 6.1, usado en Task 8.1 — campos coinciden
- `ClienteResumen` pasado desde `handleRenovar` en Task 8.1, recibido en `TabNuevaRenovacion` en Task 7 — `initialCliente?: ClienteResumen | null` coincide con `ClienteResumen | null` en Task 9
- `onRenovar: (cliente: ClienteResumen) => void` en `TabListosRenovar` Props coincide con `handleRenovar(cliente: ClienteResumen)` en `RenovacionesPage`
- `normalizeListoItem` en Task 6.2 mapea exactamente los campos de `ListoRenovarItemDTO.java` de Task 4.1

### ⚠️ Verificación pendiente para el ejecutor

1. El tipo `ClienteResumen` en `types/index.ts` puede tener campos requeridos adicionales más allá de `{id, nombre_completo, celular, negocio_nombre, tiene_credito_activo}`. Verificar la definición exacta antes de construir el objeto en `handleRenovar` de `TabListosRenovar`.

2. El endpoint `GET /api/sucursales` puede no existir todavía (el módulo Sucursales es placeholder). Si falla, mover la query `sucursales` a `enabled: false` temporalmente y ocultar ese filtro hasta que el módulo exista.

3. La ruta de `MultaRepository.sumMontosPendientesByCreditoId` — verificar que existe con ese nombre exacto en `MultaRepository.java` antes de usarla en el servicio.
