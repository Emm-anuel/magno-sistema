# Créditos Nuevos Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Créditos Nuevos module frontend (tabs: Solicitudes + Nueva Solicitud) wired to the existing Spring Boot backend at `/api/creditos`.

**Architecture:** A single `CreditosNuevosPage` orchestrates tab state; each tab is a separate component. Types live in `index.ts`, the service in `creditoService.ts`. The existing `FileUpload` component handles media uploads; we build a multi-upload wrapper around it. The existing `useAuthStore` provides role-based visibility.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, React Query (`@tanstack/react-query`), React Router v6, react-hot-toast, lucide-react, axios (via `src/services/api.ts`).

---

## File Map

| Action  | File                                                     | Responsibility                                  |
|---------|----------------------------------------------------------|-------------------------------------------------|
| Modify  | `frontend/src/types/index.ts`                            | Add EstadoCredito variants + credit types       |
| Create  | `frontend/src/services/creditoService.ts`                | All `/api/creditos` calls                       |
| Create  | `frontend/src/components/CreditoEstadoBadge.tsx`         | Colored pill badge for EstadoCredito            |
| Create  | `frontend/src/components/ProductoCalculoCard.tsx`        | Live credit product preview card                |
| Create  | `frontend/src/components/MultiFileUpload.tsx`            | Multi-file upload wrapper (wraps FileUpload)    |
| Create  | `frontend/src/pages/creditos/CreditosNuevosPage.tsx`     | Page shell with 4-tab navigation                |
| Create  | `frontend/src/pages/creditos/TabSolicitudes.tsx`         | Filtered list + desktop table + mobile cards    |
| Create  | `frontend/src/pages/creditos/TabNuevaSolicitud.tsx`      | 2-step form: data entry → confirmation          |
| Create  | `frontend/src/pages/creditos/CreditoDetallePage.tsx`     | Placeholder for `/creditos/:id`                 |
| Modify  | `frontend/src/App.tsx`                                   | Wire real page + add `/creditos/:id` route      |

---

## Task 1: Extend types and create creditoService

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/services/creditoService.ts`

- [ ] **Step 1: Update EstadoCredito in types/index.ts**

The current file has `EstadoCredito = 'ACTIVO' | 'PAGADO' | 'RENOVADO' | 'CANCELADO'` at line 14.
Also, `CreditoResumen` at line 314 has a basic shape that conflicts with what we need (it's used as a nested type inside `Cliente`). We need to keep backward compat. Strategy: rename the existing inline `CreditoResumen` to `CreditoResumenInline` inside the `Cliente` interface, and add the new full-featured types.

Replace lines 14-18 in `frontend/src/types/index.ts`:

```typescript
export type EstadoCredito =
  | 'SOLICITADO'
  | 'APROBADO'
  | 'ACTIVO'
  | 'PAGADO'
  | 'RENOVADO'
  | 'CANCELADO'
export type EstadoPago    = 'PENDIENTE' | 'PAGADO' | 'NO_PAGADO' | 'PARCIAL' | 'ADELANTADO'
export type TipoPago      = 'DIARIO' | 'SEMANAL'
```

- [ ] **Step 2: Replace the old CreditoResumen and Credito interfaces**

The old `CreditoResumen` (lines 314–326) is used only inside `Cliente.credito_activo`. Replace the entire block (lines 314–337) with:

```typescript
// CreditoResumenInline — used inside Cliente.credito_activo
export interface CreditoResumenInline {
  id: number
  monto_capital: number
  total_a_pagar: number
  pago_periodico: number
  plazo_dias: number
  tipo_pago: TipoPago
  fecha_inicio: string
  fecha_vencimiento: string
  estado: EstadoCredito
  pagos_realizados: number
}

export interface Credito extends CreditoResumenInline {
  cliente: Cliente
  asesor: Usuario
  sucursal: Sucursal
  tasa_interes: number
  cargo_financiero: number
  pago_adelantado: number
  garantia_descripcion?: string
  evidencia_urls: string[]
  lugar?: string
}
```

Then update the `Cliente` interface — change `credito_activo?: CreditoResumen` to `credito_activo?: CreditoResumenInline`.

- [ ] **Step 3: Add the new credit module types at the bottom of index.ts**

Append after the `ApiError` interface:

```typescript
// ------------------------------------------------------------------
// Créditos Nuevos
// ------------------------------------------------------------------

export interface ProductoCalculo {
  capital: number
  plazo: number
  tasa: number
  cargoFinanciero: number
  totalAPagar: number
  pagoPeriodico: number
  pagoAdelantado: number
  descripcionProducto?: string
}

export interface CalendarioPagoDetalle {
  id: number
  numeroPago: number
  fechaProgramada: string
  montoEsperado: number
  estado: EstadoPago
}

// Shape returned by GET /api/creditos (list)
export interface CreditoResumen {
  id: number
  cliente: { id: number; nombreCompleto: string; celular: string }
  asesor: { id: number; nombreCompleto: string }
  sucursal: { id: number; nombre: string }
  montoCapital: number
  montoAprobado: number | null
  pagoPeriodico: number
  plazoDias: number
  tipoPago: TipoPago
  estado: EstadoCredito
  fechaInicio: string | null
  fechaVencimiento: string | null
  pagosRealizados: number
  totalPagos: number
  tieneVideoEntrega: boolean
  createdAt: string
}

// Shape returned by GET /api/creditos/:id
export interface CreditoDetalle {
  id: number
  cliente: { id: number; nombreCompleto: string; celular: string }
  asesor: { id: number; nombreCompleto: string }
  sucursal: { id: number; nombre: string }
  montoCapital: number
  tasaInteres: number
  cargoFinanciero: number
  totalAPagar: number
  pagoPeriodico: number
  plazoDias: number
  tipoPago: TipoPago
  fechaInicio: string | null
  fechaVencimiento: string | null
  pagoAdelantado: number
  garantiaDescripcion: string | null
  evidenciaUrls: string[]
  lugar: string | null
  estado: EstadoCredito
  montoAprobado: number | null
  observaciones: string | null
  fechaAprobacion: string | null
  aprobadoPor: { id: number; nombreCompleto: string } | null
  fechaDesembolso: string | null
  videoEntregaUrl: string | null
  createdAt: string
  updatedAt: string
  calendario: CalendarioPagoDetalle[]
  estadisticas: {
    pagosRealizados: number
    pagosPendientes: number
    pagosVencidos: number
    multasPendientes: number
    elegibleRenovacion: boolean
  }
}
```

- [ ] **Step 4: Create creditoService.ts**

Create `frontend/src/services/creditoService.ts`:

```typescript
import { api } from './api'
import type { CreditoResumen, CreditoDetalle, CalendarioPagoDetalle, ProductoCalculo, Page } from '@/types'

export const creditoService = {
  listar: (params?: {
    clienteId?: number
    asesorId?: number
    sucursalId?: number
    estado?: string
    page?: number
    size?: number
  }) =>
    api.get<Page<CreditoResumen>>('/creditos', { params }).then((r) => r.data),

  obtener: (id: number) =>
    api.get<CreditoDetalle>(`/creditos/${id}`).then((r) => r.data),

  getCalendario: (id: number) =>
    api.get<CalendarioPagoDetalle[]>(`/creditos/${id}/calendario`).then((r) => r.data),

  calcularProducto: (capital: number) =>
    api.get<ProductoCalculo>('/creditos/calcular', { params: { capital } }).then((r) => r.data),

  crearSolicitud: (data: {
    clienteId: number
    asesorId: number
    sucursalId: number
    montoSolicitado: number
    tipoPago: string
    garantiaDescripcion?: string
    evidenciaUrls?: string[]
    lugar?: string
  }) =>
    api.post<CreditoDetalle>('/creditos', data).then((r) => r.data),

  aprobarCredito: (id: number, data: { montoAprobado: number; observaciones?: string }) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/aprobar`, data).then((r) => r.data),

  activarCredito: (id: number) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/activar`).then((r) => r.data),

  subirVideoEntrega: (id: number, videoEntregaUrl: string) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/video-entrega`, { videoEntregaUrl }).then((r) => r.data),

  cancelarCredito: (id: number, motivo: string) =>
    api.patch<CreditoDetalle>(`/creditos/${id}/cancelar`, { motivo }).then((r) => r.data),

  getCreditosCliente: (clienteId: number) =>
    api.get<CreditoResumen[]>(`/creditos/cliente/${clienteId}`).then((r) => r.data),
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors related to the new types (there may be pre-existing errors unrelated to this task — ignore those, but fix any new ones introduced by the type changes).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/creditoService.ts
git commit -m "feat(creditos): add CreditoResumen/Detalle types and creditoService"
```

---

## Task 2: CreditoEstadoBadge component

**Files:**
- Create: `frontend/src/components/CreditoEstadoBadge.tsx`

- [ ] **Step 1: Create the badge component**

Create `frontend/src/components/CreditoEstadoBadge.tsx`:

```typescript
import type { EstadoCredito } from '@/types'

interface Props {
  estado: EstadoCredito
  size?: 'sm' | 'md'
}

const CONFIG: Record<EstadoCredito, { label: string; cls: string }> = {
  SOLICITADO: {
    label: 'Solicitado',
    cls: 'bg-blue-100 text-blue-800',
  },
  APROBADO: {
    label: 'Aprobado',
    cls: 'bg-yellow-100 text-yellow-800',
  },
  ACTIVO: {
    label: 'Activo',
    cls: 'bg-green-100 text-green-800',
  },
  PAGADO: {
    label: 'Pagado',
    cls: 'bg-gray-100 text-gray-700',
  },
  RENOVADO: {
    label: 'Renovado',
    cls: 'bg-purple-100 text-purple-800',
  },
  CANCELADO: {
    label: 'Cancelado',
    cls: 'bg-red-100 text-red-800',
  },
}

export default function CreditoEstadoBadge({ estado, size = 'md' }: Props) {
  const { label, cls } = CONFIG[estado] ?? { label: estado, cls: 'bg-gray-100 text-gray-700' }
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${sizeClass} ${cls}`}>
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/CreditoEstadoBadge.tsx
git commit -m "feat(creditos): add CreditoEstadoBadge component"
```

---

## Task 3: ProductoCalculoCard component

**Files:**
- Create: `frontend/src/components/ProductoCalculoCard.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/ProductoCalculoCard.tsx`:

```typescript
import type { ProductoCalculo } from '@/types'

interface Props {
  calculo: ProductoCalculo | null
  loading: boolean
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(n)
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className={`text-sm text-gray-600 ${bold ? 'font-semibold text-gray-800' : ''}`}>
        {label}
      </span>
      <span className={`text-sm ${bold ? 'font-bold text-[#3d6b35]' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  )
}

export default function ProductoCalculoCard({ calculo, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 p-4 animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mt-2" />
      </div>
    )
  }

  if (!calculo) return null

  return (
    <div className="rounded-xl border border-[#3d6b35] bg-green-50 p-4 space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🧮</span>
        <span className="text-sm font-semibold text-[#3d6b35]">Producto detectado</span>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        Plazo: <strong>{calculo.plazo} días</strong> &nbsp;|&nbsp; Tasa:{' '}
        <strong>{(calculo.tasa * 100).toFixed(0)}%</strong>
      </div>
      <Row label="Capital:" value={fmt(calculo.capital)} />
      <Row label="Intereses:" value={fmt(calculo.cargoFinanciero)} />
      <Row label="Total a pagar:" value={fmt(calculo.totalAPagar)} />
      <hr className="border-green-200 my-1" />
      <Row label="Pago diario:" value={fmt(calculo.pagoPeriodico)} bold />
      <Row label="Pago adelantado:" value={fmt(calculo.pagoAdelantado)} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ProductoCalculoCard.tsx
git commit -m "feat(creditos): add ProductoCalculoCard component"
```

---

## Task 4: MultiFileUpload component

The existing `FileUpload` handles one file at a time with its own upload state. For evidence upload we need multiple files. We wrap it with list management.

**Files:**
- Create: `frontend/src/components/MultiFileUpload.tsx`

- [ ] **Step 1: Create MultiFileUpload**

Create `frontend/src/components/MultiFileUpload.tsx`:

```typescript
import { useState, useCallback } from 'react'
import { X, FileImage, FileVideo } from 'lucide-react'
import FileUpload from './FileUpload'

interface Props {
  value: string[]
  onChange: (urls: string[]) => void
  folder?: string
  accept?: string
  label?: string
  disabled?: boolean
  required?: boolean
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm|avi)(\?|$)/i.test(url)
}

function Thumbnail({ url, onRemove }: { url: string; onRemove: () => void }) {
  const isVideo = isVideoUrl(url)
  return (
    <div className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
      {isVideo ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <FileVideo className="w-6 h-6 text-gray-400" />
        </div>
      ) : (
        <img
          src={url}
          alt="Evidencia"
          className="w-full h-full object-cover"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Eliminar archivo"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

export default function MultiFileUpload({
  value,
  onChange,
  folder,
  accept = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime',
  label = 'Arrastra fotos/videos del negocio o haz clic para seleccionar',
  disabled = false,
  required = false,
}: Props) {
  const [uploaderKey, setUploaderKey] = useState(0)

  const handleUploadComplete = useCallback(
    (url: string) => {
      onChange([...value, url])
      // Reset the FileUpload component to idle state so user can add more
      setUploaderKey((k) => k + 1)
    },
    [value, onChange],
  )

  const handleRemove = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index))
    },
    [value, onChange],
  )

  return (
    <div className="space-y-3">
      {/* Existing files */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url, i) => (
            <Thumbnail key={url} url={url} onRemove={() => handleRemove(i)} />
          ))}
          <div className="text-xs text-gray-500 self-end pb-1">
            {value.length} archivo{value.length !== 1 ? 's' : ''} adjunto
            {value.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Upload zone — always visible so more files can be added */}
      <FileUpload
        key={uploaderKey}
        onUploadComplete={handleUploadComplete}
        accept={accept}
        folder={folder}
        compress
        label={
          value.length > 0
            ? 'Agregar otro archivo (opcional)'
            : label
        }
        disabled={disabled}
      />

      {required && value.length === 0 && (
        <p className="text-xs text-red-500">Se requiere al menos 1 archivo de evidencia</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/MultiFileUpload.tsx
git commit -m "feat(creditos): add MultiFileUpload wrapper component"
```

---

## Task 5: CreditosNuevosPage shell with tabs

**Files:**
- Create: `frontend/src/pages/creditos/CreditosNuevosPage.tsx`

- [ ] **Step 1: Create the page shell**

Create `frontend/src/pages/creditos/CreditosNuevosPage.tsx`:

```typescript
import { useState } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'

type Tab = 'solicitudes' | 'nueva' | 'evaluacion' | 'desembolso'

const ALL_TABS: { id: Tab; label: string }[] = [
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'nueva', label: 'Nueva Solicitud' },
  { id: 'evaluacion', label: 'Evaluación' },
  { id: 'desembolso', label: 'Desembolso' },
]

// Tabs visible for field roles (Supervisor de Campo, Asesor)
const FIELD_TABS: Tab[] = ['solicitudes', 'nueva']

export default function CreditosNuevosPage() {
  const { usuario } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('solicitudes')

  const isFieldRole =
    usuario?.rol === 'SUPERVISOR_CAMPO' || usuario?.rol === 'ASESOR_COBRADOR'

  const visibleTabs = ALL_TABS.filter(
    (t) => !isFieldRole || FIELD_TABS.includes(t.id),
  )

  return (
    <div>
      {/* Page title */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">Créditos Nuevos</h1>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 overflow-x-auto -mb-px scrollbar-hide" aria-label="Pestañas">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex-shrink-0',
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

      {/* Tab content — lazy import to keep initial bundle small */}
      <TabContent activeTab={activeTab} />
    </div>
  )
}

// Separate component so we can swap in real tabs once built
function TabContent({ activeTab }: { activeTab: Tab }) {
  if (activeTab === 'evaluacion') {
    return (
      <div className="card p-8 text-center text-gray-500">
        En construcción — Evaluación
      </div>
    )
  }
  if (activeTab === 'desembolso') {
    return (
      <div className="card p-8 text-center text-gray-500">
        En construcción — Desembolso
      </div>
    )
  }
  // solicitudes and nueva are imported lazily in later tasks
  return (
    <div className="card p-8 text-center text-gray-500">
      Cargando...
    </div>
  )
}
```

Note: We'll replace the lazy stubs in Tasks 6 and 7. We use a simple synchronous import pattern (not React.lazy) to keep complexity low.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/creditos/CreditosNuevosPage.tsx
git commit -m "feat(creditos): add CreditosNuevosPage shell with tab navigation"
```

---

## Task 6: TabSolicitudes component

**Files:**
- Create: `frontend/src/pages/creditos/TabSolicitudes.tsx`

- [ ] **Step 1: Create TabSolicitudes**

Create `frontend/src/pages/creditos/TabSolicitudes.tsx`:

```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Eye, CheckCircle, Banknote } from 'lucide-react'
import { creditoService } from '@/services/creditoService'
import { usuarioService } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'
import CreditoEstadoBadge from '@/components/CreditoEstadoBadge'
import type { CreditoResumen, EstadoCredito } from '@/types'

const ESTADOS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'SOLICITADO', label: 'Solicitado' },
  { value: 'APROBADO', label: 'Aprobado' },
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'PAGADO', label: 'Pagado' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(n)
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface Props {
  onEvaluar: (creditoId: number) => void
  onDesembolsar: (creditoId: number) => void
}

export default function TabSolicitudes({ onEvaluar, onDesembolsar }: Props) {
  const navigate = useNavigate()
  const { usuario } = useAuthStore()
  const isAdminOrSup =
    usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'

  const [buscar, setBuscar] = useState('')
  const [estado, setEstado] = useState('')
  const [asesorId, setAsesorId] = useState<number | undefined>()
  const [page, setPage] = useState(0)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['creditos', { estado, asesorId, page }],
    queryFn: () =>
      creditoService.listar({ estado: estado || undefined, asesorId, page, size: 20 }),
  })

  const { data: asesores } = useQuery({
    queryKey: ['usuarios-asesores'],
    queryFn: () => usuarioService.listar({ activo: true }),
    enabled: isAdminOrSup,
  })

  const creditos = data?.content ?? []

  // Filter client-side by search string (name)
  const filtered = buscar.trim()
    ? creditos.filter((c) =>
        c.cliente.nombreCompleto.toLowerCase().includes(buscar.toLowerCase()),
      )
    : creditos

  // Metrics
  const total = data?.total_elements ?? 0
  const counts = creditos.reduce(
    (acc, c) => {
      acc[c.estado] = (acc[c.estado] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total créditos', value: total, color: 'text-gray-800' },
          { label: 'Solicitados', value: counts['SOLICITADO'] ?? 0, color: 'text-blue-700' },
          { label: 'Aprobados', value: counts['APROBADO'] ?? 0, color: 'text-yellow-700' },
          { label: 'Activos', value: counts['ACTIVO'] ?? 0, color: 'text-green-700' },
        ].map((m) => (
          <div key={m.label} className="metric-card">
            <p className="metric-label">{m.label}</p>
            <p className={`metric-val ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre de cliente..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="input pl-9 w-full"
            />
          </div>
          <select
            value={estado}
            onChange={(e) => { setEstado(e.target.value); setPage(0) }}
            className="input w-full sm:w-40"
          >
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
          {isAdminOrSup && asesores && (
            <select
              value={asesorId ?? ''}
              onChange={(e) => {
                setAsesorId(e.target.value ? Number(e.target.value) : undefined)
                setPage(0)
              }}
              className="input w-full sm:w-44"
            >
              <option value="">Todos los asesores</option>
              {asesores.content.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre_completo}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="card p-8 text-center text-gray-500">Cargando créditos...</div>
      )}
      {isError && (
        <div className="card p-8 text-center text-red-600">Error al cargar créditos.</div>
      )}

      {/* Desktop table */}
      {!isLoading && !isError && (
        <>
          <div className="card hidden lg:block overflow-x-auto">
            <table className="tabla w-full">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Pago/día</th>
                  <th>Plazo</th>
                  <th>Estado</th>
                  <th>Asesor</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-400 py-8">
                      Sin registros
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="font-medium text-gray-800">{c.cliente.nombreCompleto}</div>
                        <div className="text-xs text-gray-500">{c.cliente.celular}</div>
                      </td>
                      <td>
                        <div>{fmt(c.montoCapital)}</div>
                        {c.montoAprobado && c.montoAprobado !== c.montoCapital && (
                          <div className="text-xs text-green-700">
                            Aprobado: {fmt(c.montoAprobado)}
                          </div>
                        )}
                      </td>
                      <td>{fmt(c.pagoPeriodico)}</td>
                      <td>{c.plazoDias} días</td>
                      <td>
                        <CreditoEstadoBadge estado={c.estado as EstadoCredito} size="sm" />
                      </td>
                      <td className="text-sm">{c.asesor.nombreCompleto}</td>
                      <td className="text-sm text-gray-500">{fmtDate(c.createdAt)}</td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/creditos/${c.id}`)}
                            className="btn btn-sm btn"
                            title="Ver detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isAdminOrSup && c.estado === 'SOLICITADO' && (
                            <button
                              type="button"
                              onClick={() => onEvaluar(c.id)}
                              className="btn btn-sm"
                              title="Evaluar"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isAdminOrSup && c.estado === 'APROBADO' && (
                            <button
                              type="button"
                              onClick={() => onDesembolsar(c.id)}
                              className="btn btn-sm btn-primary"
                              title="Desembolsar"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {filtered.length === 0 && (
              <div className="card p-6 text-center text-gray-400">Sin registros</div>
            )}
            {filtered.map((c) => (
              <MobileCard
                key={c.id}
                credito={c}
                isAdminOrSup={isAdminOrSup}
                onVer={() => navigate(`/creditos/${c.id}`)}
                onEvaluar={() => onEvaluar(c.id)}
                onDesembolsar={() => onDesembolsar(c.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {(data?.total_pages ?? 0) > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn btn-sm btn"
              >
                ← Anterior
              </button>
              <span className="text-sm text-gray-600 self-center">
                Página {page + 1} de {data?.total_pages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data?.total_pages ?? 1) - 1}
                className="btn btn-sm btn"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface MobileCardProps {
  credito: CreditoResumen
  isAdminOrSup: boolean
  onVer: () => void
  onEvaluar: () => void
  onDesembolsar: () => void
}

function MobileCard({ credito: c, isAdminOrSup, onVer, onEvaluar, onDesembolsar }: MobileCardProps) {
  function fmt(n: number) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(n)
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-gray-800">{c.cliente.nombreCompleto}</div>
          <div className="text-sm text-gray-500">{c.cliente.celular}</div>
        </div>
        <CreditoEstadoBadge estado={c.estado as EstadoCredito} size="sm" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-gray-500 text-xs">Monto</div>
          <div className="font-medium">{fmt(c.montoCapital)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Pago/día</div>
          <div className="font-medium">{fmt(c.pagoPeriodico)}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Plazo</div>
          <div className="font-medium">{c.plazoDias}d</div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Asesor: {c.asesor.nombreCompleto}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onVer}
          className="btn btn-sm btn flex-1 py-2"
        >
          Ver detalle
        </button>
        {isAdminOrSup && c.estado === 'SOLICITADO' && (
          <button
            type="button"
            onClick={onEvaluar}
            className="btn btn-sm flex-1 py-2"
          >
            Evaluar
          </button>
        )}
        {isAdminOrSup && c.estado === 'APROBADO' && (
          <button
            type="button"
            onClick={onDesembolsar}
            className="btn btn-sm btn-primary flex-1 py-2"
          >
            Desembolsar
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire TabSolicitudes into CreditosNuevosPage**

Update `frontend/src/pages/creditos/CreditosNuevosPage.tsx`. Replace the full file with:

```typescript
import { useState } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'
import TabSolicitudes from './TabSolicitudes'
import TabNuevaSolicitud from './TabNuevaSolicitud'

type Tab = 'solicitudes' | 'nueva' | 'evaluacion' | 'desembolso'

const ALL_TABS: { id: Tab; label: string }[] = [
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'nueva', label: 'Nueva Solicitud' },
  { id: 'evaluacion', label: 'Evaluación' },
  { id: 'desembolso', label: 'Desembolso' },
]

const FIELD_TABS: Tab[] = ['solicitudes', 'nueva']

export default function CreditosNuevosPage() {
  const { usuario } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('solicitudes')

  const isFieldRole =
    usuario?.rol === 'SUPERVISOR_CAMPO' || usuario?.rol === 'ASESOR_COBRADOR'

  const visibleTabs = ALL_TABS.filter(
    (t) => !isFieldRole || FIELD_TABS.includes(t.id),
  )

  function handleEvaluar(_id: number) {
    setActiveTab('evaluacion')
  }

  function handleDesembolsar(_id: number) {
    setActiveTab('desembolso')
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">Créditos Nuevos</h1>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 overflow-x-auto -mb-px" aria-label="Pestañas">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex-shrink-0',
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

      {activeTab === 'solicitudes' && (
        <TabSolicitudes onEvaluar={handleEvaluar} onDesembolsar={handleDesembolsar} />
      )}
      {activeTab === 'nueva' && <TabNuevaSolicitud onSuccess={() => setActiveTab('solicitudes')} />}
      {activeTab === 'evaluacion' && (
        <div className="card p-8 text-center text-gray-500">En construcción — Evaluación</div>
      )}
      {activeTab === 'desembolso' && (
        <div className="card p-8 text-center text-gray-500">En construcción — Desembolso</div>
      )}
    </div>
  )
}
```

Note: `TabNuevaSolicitud` is created in Task 7. The file will have a compilation error until then — that's fine, we'll fix it next task.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/creditos/TabSolicitudes.tsx frontend/src/pages/creditos/CreditosNuevosPage.tsx
git commit -m "feat(creditos): add TabSolicitudes with desktop table and mobile cards"
```

---

## Task 7: TabNuevaSolicitud — Step 1 (form fields)

**Files:**
- Create: `frontend/src/pages/creditos/TabNuevaSolicitud.tsx`

This is the most complex component. We build it in one file using local state.

- [ ] **Step 1: Create TabNuevaSolicitud.tsx**

Create `frontend/src/pages/creditos/TabNuevaSolicitud.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Search, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft, Send } from 'lucide-react'
import { creditoService } from '@/services/creditoService'
import { clienteService, usuarioService } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'
import ProductoCalculoCard from '@/components/ProductoCalculoCard'
import MultiFileUpload from '@/components/MultiFileUpload'
import type { ClienteResumen, ProductoCalculo } from '@/types'

interface Props {
  onSuccess?: () => void
}

type Step = 1 | 2

// ── Stepper ────────────────────────────────────────────────────────

function Stepper({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: 'Datos del crédito' },
    { n: 2, label: 'Confirmación' },
  ]
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div
            className={[
              'flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold transition-colors',
              current === s.n
                ? 'bg-[#3d6b35] text-white'
                : current > s.n
                ? 'bg-green-200 text-green-800'
                : 'bg-gray-200 text-gray-500',
            ].join(' ')}
          >
            {current > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
          </div>
          <span
            className={`text-sm hidden sm:inline ${
              current === s.n ? 'font-semibold text-gray-800' : 'text-gray-400'
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────

export default function TabNuevaSolicitud({ onSuccess }: Props) {
  const navigate = useNavigate()
  const { usuario } = useAuthStore()
  const queryClient = useQueryClient()

  const [step, setStep] = useState<Step>(1)

  // Form state
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteResumen | null>(null)
  const [montoStr, setMontoStr] = useState('')
  const [tipoPago, setTipoPago] = useState<'DIARIO' | 'SEMANAL'>('DIARIO')
  const [asesorId, setAsesorId] = useState<number | ''>('')
  const [garantiaDescripcion, setGarantiaDescripcion] = useState('')
  const [evidenciaUrls, setEvidenciaUrls] = useState<string[]>([])

  // Calc state
  const [calculo, setCalculo] = useState<ProductoCalculo | null>(null)
  const [calculoLoading, setCalculoLoading] = useState(false)
  const calcDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<ClienteResumen[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const isAdminOrSup =
    usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'
  const isFieldUser =
    usuario?.rol === 'ASESOR_COBRADOR' || usuario?.rol === 'SUPERVISOR_CAMPO'

  // Pre-fill asesorId for field users
  useEffect(() => {
    if (isFieldUser && usuario) {
      setAsesorId(usuario.id)
    }
  }, [isFieldUser, usuario])

  // Asesores for admin/supervisor dropdown
  const { data: asesoresData } = useQuery({
    queryKey: ['usuarios-asesores'],
    queryFn: () => usuarioService.listar({ activo: true }),
    enabled: isAdminOrSup,
  })

  // ── Client search ────────────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await clienteService.listar({ buscar: searchQuery, size: 8 })
        setSearchResults(res.content)
        setSearchOpen(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelectCliente(c: ClienteResumen) {
    setClienteSeleccionado(c)
    setSearchQuery('')
    setSearchOpen(false)
  }

  // ── Monto / calculo ──────────────────────────────────────────────

  function handleMontoChange(val: string) {
    // Strip non-numeric except decimal
    const clean = val.replace(/[^0-9.]/g, '')
    setMontoStr(clean)
    setCalculo(null)

    if (calcDebounceRef.current) clearTimeout(calcDebounceRef.current)

    const num = parseFloat(clean)
    if (!clean || isNaN(num) || num < 1000 || num > 50000) {
      setCalculoLoading(false)
      return
    }

    setCalculoLoading(true)
    calcDebounceRef.current = setTimeout(async () => {
      try {
        const result = await creditoService.calcularProducto(num)
        setCalculo(result)
      } catch {
        setCalculo(null)
      } finally {
        setCalculoLoading(false)
      }
    }, 500)
  }

  // ── Validation ───────────────────────────────────────────────────

  const monto = parseFloat(montoStr)
  const montoValido = !isNaN(monto) && monto >= 1000 && monto <= 50000
  const tieneCredito = clienteSeleccionado?.tiene_credito_activo ?? false

  const canContinue =
    clienteSeleccionado !== null &&
    !tieneCredito &&
    montoValido &&
    calculo !== null &&
    evidenciaUrls.length > 0 &&
    asesorId !== ''

  // ── Submit ───────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: () =>
      creditoService.crearSolicitud({
        clienteId: clienteSeleccionado!.id,
        asesorId: Number(asesorId),
        sucursalId: usuario!.sucursal.id,
        montoSolicitado: monto,
        tipoPago,
        garantiaDescripcion: garantiaDescripcion.trim() || undefined,
        evidenciaUrls,
      }),
    onSuccess: (data) => {
      toast.success('Solicitud enviada correctamente')
      queryClient.invalidateQueries({ queryKey: ['creditos'] })
      navigate(`/creditos/${data.id}`)
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Error al enviar la solicitud')
    },
  })

  // ── Step 1 render ────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="max-w-2xl">
        <Stepper current={1} />

        <div className="card p-6 space-y-6">

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>

            {clienteSeleccionado ? (
              <div className="rounded-xl border border-green-300 bg-green-50 p-3 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="font-semibold text-gray-800">
                      {clienteSeleccionado.nombre_completo}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 pl-5.5">
                    📱 {clienteSeleccionado.celular}
                  </div>
                  <div className="text-sm text-gray-500 pl-5.5">
                    🏪 {clienteSeleccionado.negocio_nombre}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClienteSeleccionado(null)
                    setSearchQuery('')
                  }}
                  className="text-xs text-gray-500 underline hover:text-gray-700 flex-shrink-0"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input pl-9 w-full"
                    autoComplete="off"
                  />
                  {searchLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#3d6b35] border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => handleSelectCliente(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-800">{c.nombre_completo}</div>
                        <div className="text-xs text-gray-500">
                          {c.celular} · {c.negocio_nombre}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchOpen && searchResults.length === 0 && !searchLoading && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm text-gray-500 text-center">
                    No se encontraron clientes
                  </div>
                )}
              </div>
            )}

            {/* Active credit warning */}
            {tieneCredito && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  Este cliente ya tiene un crédito activo o en proceso. No puede solicitar uno
                  nuevo hasta completarlo.
                </p>
              </div>
            )}
          </div>

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto Solicitado <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                $
              </span>
              <input
                type="number"
                min={1000}
                max={50000}
                step={500}
                placeholder="2000"
                value={montoStr}
                onChange={(e) => handleMontoChange(e.target.value)}
                className="input pl-7 w-full"
              />
            </div>
            {montoStr && !montoValido && (
              <p className="text-xs text-red-500 mt-1">El monto debe estar entre $1,000 y $50,000</p>
            )}
            {/* Calculo card */}
            <div className="mt-3">
              <ProductoCalculoCard calculo={calculo} loading={calculoLoading} />
            </div>
          </div>

          {/* Forma de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forma de Pago <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              {(['DIARIO', 'SEMANAL'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tipoPago"
                    value={v}
                    checked={tipoPago === v}
                    onChange={() => setTipoPago(v)}
                    className="w-4 h-4 accent-[#3d6b35]"
                  />
                  <span className="text-sm">{v === 'DIARIO' ? 'Diario' : 'Semanal'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Asesor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Asesor <span className="text-red-500">*</span>
            </label>
            {isFieldUser ? (
              <input
                type="text"
                value={usuario?.nombre_completo ?? ''}
                disabled
                className="input w-full bg-gray-50 text-gray-500"
              />
            ) : (
              <select
                value={asesorId}
                onChange={(e) => setAsesorId(e.target.value ? Number(e.target.value) : '')}
                className="input w-full"
              >
                <option value="">Seleccionar asesor...</option>
                {asesoresData?.content.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre_completo}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Garantía */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Garantía Material{' '}
              <span className="text-xs text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={garantiaDescripcion}
              onChange={(e) => setGarantiaDescripcion(e.target.value)}
              rows={2}
              placeholder="Describe el objeto dado en garantía (solo para préstamos grandes)"
              className="input w-full resize-none"
            />
          </div>

          {/* Evidencia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Evidencia del Negocio <span className="text-red-500">*</span>
            </label>
            <MultiFileUpload
              value={evidenciaUrls}
              onChange={setEvidenciaUrls}
              folder={
                clienteSeleccionado
                  ? `evidencia-negocio/${clienteSeleccionado.id}`
                  : 'evidencia-negocio'
              }
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              label="Arrastra fotos/videos del negocio o haz clic para seleccionar"
              required
            />
          </div>

          {/* Continue button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canContinue}
              className="btn btn-primary flex items-center gap-2 px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: Confirmation ─────────────────────────────────────────

  return (
    <div className="max-w-2xl">
      <Stepper current={2} />

      <div className="space-y-4">
        {/* Cliente card */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Cliente</h3>
          <div className="space-y-1 text-sm">
            <div className="font-medium text-gray-800">{clienteSeleccionado?.nombre_completo}</div>
            <div className="text-gray-500">📱 {clienteSeleccionado?.celular}</div>
            <div className="text-gray-500">🏪 {clienteSeleccionado?.negocio_nombre}</div>
          </div>
        </div>

        {/* Credit conditions card */}
        {calculo && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Condiciones del crédito</h3>
            <div className="space-y-1.5 text-sm">
              {[
                ['Monto solicitado', `$${monto.toLocaleString('es-MX')}`],
                ['Plazo', `${calculo.plazo} días`],
                ['Tasa de interés', `${(calculo.tasa * 100).toFixed(0)}%`],
                ['Cargo financiero', `$${calculo.cargoFinanciero.toLocaleString('es-MX')}`],
                ['Total a pagar', `$${calculo.totalAPagar.toLocaleString('es-MX')}`],
                ['Pago diario', `$${calculo.pagoPeriodico.toLocaleString('es-MX')}`],
                ['Pago adelantado', `$${calculo.pagoAdelantado.toLocaleString('es-MX')} (se cobra al desembolsar)`],
                ['Forma de pago', tipoPago === 'DIARIO' ? 'Diario' : 'Semanal'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Files card */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Archivos adjuntos</h3>
          <div className="flex flex-wrap gap-2">
            {evidenciaUrls.map((url, i) => (
              <div
                key={url}
                className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-gray-50"
              >
                {/\.(mp4|mov|webm)/i.test(url) ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                    🎥
                  </div>
                ) : (
                  <img src={url} alt={`Evidencia ${i + 1}`} className="w-full h-full object-cover" />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {evidenciaUrls.length} archivo{evidenciaUrls.length !== 1 ? 's' : ''} adjunto
            {evidenciaUrls.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Asesor card */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Asesor</h3>
          <div className="text-sm">
            <div className="font-medium text-gray-800">
              {isFieldUser
                ? usuario?.nombre_completo
                : asesoresData?.content.find((u) => u.id === asesorId)?.nombre_completo ?? '—'}
            </div>
            <div className="text-gray-500">{usuario?.sucursal?.nombre}</div>
          </div>
        </div>

        {/* Garantia */}
        {garantiaDescripcion.trim() && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Garantía material</h3>
            <p className="text-sm text-gray-700">{garantiaDescripcion}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="btn btn flex items-center gap-2 justify-center py-3"
          >
            <ChevronLeft className="w-4 h-4" /> Volver
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn btn-primary flex items-center gap-2 justify-center flex-1 py-3 disabled:opacity-50"
          >
            {mutation.isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Enviar Solicitud
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/creditos/TabNuevaSolicitud.tsx
git commit -m "feat(creditos): add TabNuevaSolicitud with 2-step form and live product preview"
```

---

## Task 8: CreditoDetallePage placeholder + wire routes

**Files:**
- Create: `frontend/src/pages/creditos/CreditoDetallePage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create placeholder CreditoDetallePage**

Create `frontend/src/pages/creditos/CreditoDetallePage.tsx`:

```typescript
import { useParams } from 'react-router-dom'

export default function CreditoDetallePage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="card p-8 text-center text-gray-500">
      <h2 className="text-lg font-semibold mb-2">Detalle de Crédito #{id}</h2>
      <p>En construcción</p>
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx routes**

In `frontend/src/App.tsx`:

1. Add import at the top:
```typescript
import CreditosNuevosPage from '@/pages/creditos/CreditosNuevosPage'
import CreditoDetallePage from '@/pages/creditos/CreditoDetallePage'
```

2. Replace:
```typescript
<Route path="/creditos-nuevos" element={<ModulePlaceholderPage />} />
```
With:
```typescript
<Route path="/creditos-nuevos" element={<CreditosNuevosPage />} />
<Route path="/creditos/:id" element={<CreditoDetallePage />} />
```

The `/creditos/:id` route needs to be accessible to all roles (CLIENTES_ROLES or ALL_ROLES). Place it inside the existing `<Route element={<ProtectedRoute allowedRoles={ALL_ROLES} />}>` block alongside `creditos-nuevos`.

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/creditos/CreditoDetallePage.tsx frontend/src/App.tsx
git commit -m "feat(creditos): wire CreditosNuevosPage and add /creditos/:id placeholder route"
```

---

## Task 9: Final verification

- [ ] **Step 1: Build check**

```bash
cd frontend && npm run build
```

Expected: Build succeeds with 0 TypeScript errors.

- [ ] **Step 2: Dev server smoke test**

```bash
cd frontend && npm run dev
```

Open browser at http://localhost:5173 and verify:

1. `/creditos-nuevos` loads without errors
2. Tab "Solicitudes" shows metric cards
3. Badge colors: SOLICITADO=blue, ACTIVO=green, etc.
4. Switch to "Nueva Solicitud" tab
5. Type 3+ chars in client search → dropdown appears
6. Select a client → mini-card with name, phone, business appears
7. Type `2000` in monto → after ~500ms see ProductoCalculoCard with pago=$104
8. Type `15000` → tasa=24%, pago=$744
9. Type `20000` → plazo=30 días, pago=$827
10. Select a client with active credit → red alert appears, "Continuar" is disabled
11. Complete all fields + upload evidence → "Continuar" enables
12. Step 2 shows full summary
13. `/creditos/1` shows "En construcción"

- [ ] **Step 3: Mobile check**

In browser DevTools, set viewport to 375px width. Verify:
- Tab bar scrolls horizontally if needed
- Solicitudes shows cards (not table)
- Cards have large touch targets (py-2+ buttons)
- Nueva Solicitud form is single-column

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(creditos): complete Créditos Nuevos frontend — Solicitudes + Nueva Solicitud tabs"
```

---

## Notes

### Tailwind classes used from existing CSS
The codebase uses utility classes defined in global CSS (seen in DashboardPage and ClientesPage):
- `metric-card`, `metric-label`, `metric-val`, `metric-sub` — metric card block
- `card`, `card-header`, `card-title` — card block
- `tabla` — table styling
- `btn`, `btn-sm`, `btn-primary`, `btn-danger` — button variants (`btn` = white outline style, `btn-primary` = green filled)
- `input` — form input base style
- `badge`, `badge-verde`, `badge-rojo`, `badge-amarillo`, `badge-gris` — badge variants

These must be used as-is (not recreated with inline Tailwind) to maintain visual consistency.

### API field casing
The backend returns camelCase JSON (Spring Boot default with Jackson). The frontend `CreditoResumen` interface uses camelCase (`montoCapital`, `pagoPeriodico`, etc.). The existing `ClienteResumen` uses snake_case (`nombre_completo`, `negocio_nombre`). Do not mix these up — each type matches its actual backend DTO.

### Video endpoint field name
The backend reads `videoEntregaUrl` (camelCase) from the request body:
```java
String url = body.get("videoEntregaUrl");
```
The service sends `{ videoEntregaUrl: url }` — correct.
