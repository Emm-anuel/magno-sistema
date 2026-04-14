# Créditos — Evaluación, Desembolso, Ficha e Integración con Cliente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement tabs Evaluación and Desembolso in CreditosNuevosPage, a full CreditoDetallePage (/creditos/:id), and update ClienteDetallePage to show real credit data.

**Architecture:** Pure frontend work — all backend endpoints already exist (PATCH /aprobar, /activar, /cancelar, /video-entrega, GET /calendario, /cliente/{id}). Five files total: 2 new components, 3 modified. No new services or types needed — creditoService and types/index.ts already have everything required.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, React Query, React Router v6, react-hot-toast, lucide-react. Existing components: CreditoEstadoBadge, ProductoCalculoCard, FileUpload, SecurePreviewImage, ImagePreviewModal.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| CREATE | `frontend/src/pages/creditos/TabEvaluacion.tsx` | Split-panel evaluación: list of SOLICITADO creditos on left, review/approve/reject on right |
| CREATE | `frontend/src/pages/creditos/TabDesembolso.tsx` | Split-panel desembolso: list of APROBADO creditos on left, calendar preview + activate on right |
| MODIFY | `frontend/src/pages/creditos/CreditoDetallePage.tsx` | Full credit detail page with 4 tabs: Info, Calendario, Evidencia, Video |
| MODIFY | `frontend/src/pages/creditos/CreditosNuevosPage.tsx` | Wire up TabEvaluacion and TabDesembolso, pass initialCreditoId |
| MODIFY | `frontend/src/pages/clientes/ClienteDetallePage.tsx` | Real credit card with progress bar + historial tab from creditoService |

---

## Task 1: TabEvaluacion.tsx

**Files:**
- Create: `frontend/src/pages/creditos/TabEvaluacion.tsx`

### Key data shapes (from existing types/index.ts and creditoService.ts)

```typescript
// GET /creditos?estado=SOLICITADO → Page<CreditoResumen>
// CreditoResumen: { id, cliente: {id, nombreCompleto, celular}, asesor: {id, nombreCompleto}, montoCapital, montoAprobado, pagoPeriodico, plazoDias, estado, createdAt, ... }

// GET /creditos/:id → CreditoDetalle
// CreditoDetalle.estadisticas: { pagosRealizados, pagosPendientes, pagosVencidos, multasPendientes, elegibleRenovacion }
// CreditoDetalle.evidenciaUrls: string[]

// GET /creditos/cliente/:clienteId → CreditoResumen[] (historial del cliente)

// PATCH /creditos/:id/aprobar body: { montoAprobado, observaciones }
// PATCH /creditos/:id/cancelar body: { motivo }
// GET /creditos/calcular?capital=X → ProductoCalculo
```

- [ ] **Step 1: Create the file with imports, helpers and role guard**

```tsx
// frontend/src/pages/creditos/TabEvaluacion.tsx
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Search, CheckCircle, XCircle, ChevronRight, Image as ImageIcon, Play } from 'lucide-react'
import { creditoService } from '@/services/creditoService'
import { useAuthStore } from '@/hooks/useAuthStore'
import ProductoCalculoCard from '@/components/ProductoCalculoCard'
import SecurePreviewImage from '@/components/SecurePreviewImage'
import ImagePreviewModal from '@/components/ImagePreviewModal'
import CreditoEstadoBadge from '@/components/CreditoEstadoBadge'
import type { CreditoResumen, ProductoCalculo } from '@/types'

interface Props {
  initialCreditoId?: number
}

// ── Helpers ────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n)
}

function diasDesde(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'hace 1 día'
  return `hace ${days} días`
}

function safeN(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
```

- [ ] **Step 2: Add the main component with role guard and layout shell**

```tsx
export default function TabEvaluacion({ initialCreditoId }: Props) {
  const { usuario } = useAuthStore()
  const qc = useQueryClient()

  const isAdminOrSup = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'

  const [buscar, setBuscar] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(initialCreditoId ?? null)
  const [montoAprobado, setMontoAprobado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [calculo, setCalculo] = useState<ProductoCalculo | null>(null)
  const [calculoLoading, setCalculoLoading] = useState(false)
  const calcRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')

  // Role guard
  if (!isAdminOrSup) {
    return (
      <div className="card p-8 text-center text-gray-500">
        No tienes permisos para evaluar solicitudes.
      </div>
    )
  }

  // ... (queries and handlers below)
}
```

- [ ] **Step 3: Add queries and mutations inside the component**

Add after the state declarations (before the return) but inside the component:

```tsx
  // ── Queries ────────────────────────────────────────────────────────

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['creditos-solicitados'],
    queryFn: () => creditoService.listar({ estado: 'SOLICITADO', size: 50 }),
  })

  const solicitudes = (listData?.content ?? []).filter((c) => {
    if (!buscar.trim()) return true
    const name = c.cliente.nombreCompleto ?? ''
    return name.toLowerCase().includes(buscar.toLowerCase())
  })

  const { data: detalle } = useQuery({
    queryKey: ['credito', selectedId],
    queryFn: () => creditoService.obtener(selectedId!),
    enabled: selectedId !== null,
  })

  const { data: historialCliente } = useQuery({
    queryKey: ['creditos-cliente', detalle?.cliente.id],
    queryFn: () => creditoService.getCreditosCliente(detalle!.cliente.id),
    enabled: !!detalle?.cliente.id,
  })

  // ── Calculo debounce ───────────────────────────────────────────────

  function handleMontoChange(val: string) {
    const clean = val.replace(/[^0-9.]/g, '')
    setMontoAprobado(clean)
    setCalculo(null)
    if (calcRef.current) clearTimeout(calcRef.current)
    const num = parseFloat(clean)
    if (!clean || isNaN(num) || num < 1000 || num > 50000) { setCalculoLoading(false); return }
    setCalculoLoading(true)
    calcRef.current = setTimeout(async () => {
      try { setCalculo(await creditoService.calcularProducto(num)) }
      catch { setCalculo(null) }
      finally { setCalculoLoading(false) }
    }, 400)
  }

  // Pre-fill monto when a new credito is selected
  function handleSelectCredito(id: number) {
    setSelectedId(id)
    const c = (listData?.content ?? []).find((x) => x.id === id)
    if (c) {
      const monto = String(safeN(c.montoCapital))
      setMontoAprobado(monto)
      setCalculo(null)
      setCalculoLoading(true)
      creditoService.calcularProducto(safeN(c.montoCapital))
        .then(setCalculo).catch(() => setCalculo(null)).finally(() => setCalculoLoading(false))
    }
  }

  // ── Mutations ─────────────────────────────────────────────────────

  const aprobarMut = useMutation({
    mutationFn: () => creditoService.aprobarCredito(selectedId!, {
      montoAprobado: parseFloat(montoAprobado),
      observaciones: observaciones.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Crédito aprobado correctamente')
      qc.invalidateQueries({ queryKey: ['creditos-solicitados'] })
      qc.invalidateQueries({ queryKey: ['creditos'] })
      setSelectedId(null)
      setShowApproveModal(false)
      setMontoAprobado('')
      setCalculo(null)
      setObservaciones('')
    },
    onError: (e: any) => { toast.error(e.message ?? 'Error al aprobar'); setShowApproveModal(false) },
  })

  const rechazarMut = useMutation({
    mutationFn: () => creditoService.cancelarCredito(selectedId!, motivoRechazo),
    onSuccess: () => {
      toast.success('Solicitud rechazada')
      qc.invalidateQueries({ queryKey: ['creditos-solicitados'] })
      qc.invalidateQueries({ queryKey: ['creditos'] })
      setSelectedId(null)
      setShowRejectModal(false)
      setMotivoRechazo('')
    },
    onError: (e: any) => { toast.error(e.message ?? 'Error al rechazar'); setShowRejectModal(false) },
  })
```

- [ ] **Step 4: Add the JSX return — split panel layout**

```tsx
  const selected = (listData?.content ?? []).find((c) => c.id === selectedId) ?? null

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[600px]">
      {/* ── Left panel: list ── */}
      <div className="lg:w-1/3 flex flex-col gap-3">
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Solicitudes pendientes</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por cliente..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="input pl-9 w-full text-sm"
            />
          </div>
        </div>

        {listLoading && <div className="card p-4 text-center text-gray-400 text-sm">Cargando...</div>}

        {!listLoading && solicitudes.length === 0 && (
          <div className="card p-8 text-center">
            <CheckCircle className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No hay solicitudes pendientes</p>
          </div>
        )}

        <div className="space-y-2">
          {solicitudes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelectCredito(c.id)}
              className={[
                'w-full text-left card p-3 transition-colors',
                selectedId === c.id
                  ? 'border-l-4 border-l-[#3d6b35] bg-green-50'
                  : 'hover:bg-gray-50',
              ].join(' ')}
            >
              <div className="font-semibold text-sm text-gray-800">{c.cliente.nombreCompleto}</div>
              <div className="text-xs text-gray-500 mt-0.5">{fmt(safeN(c.montoCapital))} · {diasDesde(c.createdAt)}</div>
              <div className="text-xs text-gray-400">{c.asesor.nombreCompleto}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right panel: detail ── */}
      <div className="lg:w-2/3">
        {!selectedId && (
          <div className="card p-8 flex flex-col items-center justify-center h-full text-center text-gray-400 min-h-[300px]">
            <ChevronRight className="w-8 h-8 mb-2" />
            <p className="text-sm">Selecciona una solicitud de la lista para evaluarla</p>
          </div>
        )}

        {selectedId && detalle && (
          <div className="space-y-4">

            {/* Client info */}
            <div className="card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Información del cliente</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {[
                  ['Nombre', detalle.cliente.nombreCompleto],
                  ['Celular', detalle.cliente.celular],
                  ['Asesor', detalle.asesor.nombreCompleto],
                  ['Sucursal', detalle.sucursal.nombre],
                ].map(([l, v]) => (
                  <div key={l}>
                    <span className="text-gray-400 text-xs">{l}</span>
                    <div className="text-gray-800 font-medium">{v ?? '—'}</div>
                  </div>
                ))}
              </div>

              {/* Historial crediticio */}
              <div className="rounded-lg border border-gray-100 p-3 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Historial crediticio</p>
                {historialCliente === undefined && <p className="text-xs text-gray-400">Cargando...</p>}
                {historialCliente !== undefined && (() => {
                  const anteriores = historialCliente.filter((h) => h.id !== selectedId && h.estado !== 'CANCELADO')
                  const pagados = historialCliente.filter((h) => h.estado === 'PAGADO')
                  const conProblemas = historialCliente.filter((h) => h.estado === 'CANCELADO')
                  if (anteriores.length === 0) return <p className="text-xs text-gray-400">Cliente nuevo — sin historial crediticio</p>
                  return (
                    <div className="space-y-1">
                      {pagados.length > 0 && (
                        <p className="text-xs text-green-700 font-medium">✓ Pagó correctamente {pagados.length} crédito{pagados.length !== 1 ? 's' : ''} anterior{pagados.length !== 1 ? 'es' : ''}</p>
                      )}
                      {conProblemas.length > 0 && (
                        <p className="text-xs text-red-600">{conProblemas.length} crédito{conProblemas.length !== 1 ? 's' : ''} cancelado{conProblemas.length !== 1 ? 's' : ''}</p>
                      )}
                      {anteriores.slice(0, 3).map((h) => (
                        <div key={h.id} className="flex justify-between text-xs text-gray-600">
                          <span>{fmt(safeN(h.montoCapital ?? h.montoAprobado))}</span>
                          <CreditoEstadoBadge estado={h.estado} size="sm" />
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Evidencia */}
            {detalle.evidenciaUrls && detalle.evidenciaUrls.length > 0 && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Evidencia del negocio</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {detalle.evidenciaUrls.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => /\.(mp4|mov|webm)/i.test(url) ? window.open(url, '_blank') : setPreviewUrl(url)}
                      className="aspect-square rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center hover:opacity-80 transition-opacity"
                    >
                      {/\.(mp4|mov|webm)/i.test(url) ? (
                        <div className="flex flex-col items-center gap-1">
                          <Play className="w-6 h-6 text-gray-500" />
                          <span className="text-xs text-gray-400">Video</span>
                        </div>
                      ) : (
                        <SecurePreviewImage fileUrl={url} alt={`Evidencia ${i + 1}`} className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Evaluación */}
            <div className="card p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Evaluación</h3>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
                <span className="text-blue-700 font-medium">Monto solicitado: </span>
                <span className="text-blue-800 font-bold">{fmt(safeN(detalle.montoCapital))}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto Aprobado <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    min={1000}
                    max={50000}
                    step={500}
                    value={montoAprobado}
                    onChange={(e) => handleMontoChange(e.target.value)}
                    className="input pl-7 w-full"
                    placeholder="Monto a aprobar..."
                  />
                </div>
                {montoAprobado && (isNaN(parseFloat(montoAprobado)) || parseFloat(montoAprobado) < 1000) && (
                  <p className="text-xs text-red-500 mt-1">El monto debe ser entre $1,000 y $50,000</p>
                )}
                <div className="mt-3">
                  <ProductoCalculoCard calculo={calculo} loading={calculoLoading} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                  placeholder="Motivo de aprobación, condiciones especiales, observaciones..."
                  className="input w-full resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  className="btn flex items-center gap-2 justify-center py-3 border-red-200 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4" /> Rechazar solicitud
                </button>
                <button
                  type="button"
                  onClick={() => setShowApproveModal(true)}
                  disabled={!montoAprobado || isNaN(parseFloat(montoAprobado)) || parseFloat(montoAprobado) < 1000 || !calculo}
                  className="btn-primary flex-1 flex items-center gap-2 justify-center py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" /> Aprobar crédito
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Image preview modal ── */}
      <ImagePreviewModal
        isOpen={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        imageUrl={previewUrl ?? ''}
        title="Evidencia del negocio"
      />

      {/* ── Reject modal ── */}
      {showRejectModal && selected && (
        <div className="fixed inset-0 z-[2500] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-800">¿Rechazar esta solicitud?</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div><span className="text-gray-400">Cliente:</span> {selected.cliente.nombreCompleto}</div>
              <div><span className="text-gray-400">Monto:</span> {fmt(safeN(selected.montoCapital))}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del rechazo <span className="text-red-500">*</span></label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={3}
                className="input w-full resize-none"
                placeholder="Indica el motivo..."
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowRejectModal(false)} className="btn flex-1 py-2.5">Cancelar</button>
              <button
                type="button"
                onClick={() => rechazarMut.mutate()}
                disabled={!motivoRechazo.trim() || rechazarMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {rechazarMut.isPending ? 'Rechazando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve modal ── */}
      {showApproveModal && selected && calculo && (
        <div className="fixed inset-0 z-[2500] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#3d6b35]" />
              <h3 className="font-semibold text-gray-800">Confirmar aprobación</h3>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div><span className="text-gray-400">Cliente:</span> {selected.cliente.nombreCompleto}</div>
              <div><span className="text-gray-400">Monto aprobado:</span> <strong>{fmt(parseFloat(montoAprobado))}</strong></div>
              <div><span className="text-gray-400">Pago diario:</span> {fmt(safeN(calculo.pagoPeriodico))}</div>
              <div><span className="text-gray-400">Plazo:</span> {safeN(calculo.plazo)} días</div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowApproveModal(false)} className="btn flex-1 py-2.5">Cancelar</button>
              <button
                type="button"
                onClick={() => aprobarMut.mutate()}
                disabled={aprobarMut.isPending}
                className="btn-primary flex-1 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aprobarMut.isPending ? 'Aprobando...' : 'Aprobar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
```

- [ ] **Step 5: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors related to TabEvaluacion.tsx

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Emm-a/Documents/github/magno-sistema
git add frontend/src/pages/creditos/TabEvaluacion.tsx
git commit -m "feat(creditos): add TabEvaluacion with approve/reject workflow"
```

---

## Task 2: TabDesembolso.tsx

**Files:**
- Create: `frontend/src/pages/creditos/TabDesembolso.tsx`

### Calendar preview helper

The frontend estimates dates by advancing one day at a time, skipping weekends. Festivos are excluded since we can't query them without knowing the sucursal; we note dates are estimated.

```typescript
// Generates N estimated business dates starting from tomorrow
function generarFechasEstimadas(desde: Date, n: number): Date[] {
  const fechas: Date[] = []
  const cursor = new Date(desde)
  cursor.setDate(cursor.getDate() + 1) // start from tomorrow
  while (fechas.length < n) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) fechas.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return fechas
}
```

- [ ] **Step 1: Create the file with imports, helpers, and role guard**

```tsx
// frontend/src/pages/creditos/TabDesembolso.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ChevronRight, AlertTriangle, Calendar } from 'lucide-react'
import { creditoService } from '@/services/creditoService'
import { useAuthStore } from '@/hooks/useAuthStore'
import FileUpload from '@/components/FileUpload'

interface Props {
  initialCreditoId?: number
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n)
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })
}

function fmtDateFull(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

function safeN(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function generarFechasEstimadas(n: number): Date[] {
  const fechas: Date[] = []
  const cursor = new Date()
  cursor.setDate(cursor.getDate() + 1) // start tomorrow
  while (fechas.length < n) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) fechas.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return fechas
}

export default function TabDesembolso({ initialCreditoId }: Props) {
  const { usuario } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const isAdminOrSup = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'

  const [selectedId, setSelectedId] = useState<number | null>(initialCreditoId ?? null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  if (!isAdminOrSup) {
    return (
      <div className="card p-8 text-center text-gray-500">
        No tienes permisos para realizar desembolsos.
      </div>
    )
  }
  // ... (continue below)
}
```

- [ ] **Step 2: Add queries and mutation**

Inside the component, after state declarations:

```tsx
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['creditos-aprobados'],
    queryFn: () => creditoService.listar({ estado: 'APROBADO', size: 50 }),
  })

  const aprobados = listData?.content ?? []

  const { data: detalle } = useQuery({
    queryKey: ['credito', selectedId],
    queryFn: () => creditoService.obtener(selectedId!),
    enabled: selectedId !== null,
  })

  const activarMut = useMutation({
    mutationFn: async () => {
      const result = await creditoService.activarCredito(selectedId!)
      if (videoUrl) {
        await creditoService.subirVideoEntrega(result.id, videoUrl)
      }
      return result
    },
    onSuccess: (data) => {
      toast.success('Crédito activado correctamente')
      qc.invalidateQueries({ queryKey: ['creditos-aprobados'] })
      qc.invalidateQueries({ queryKey: ['creditos'] })
      setShowConfirmModal(false)
      navigate(`/creditos/${data.id}`)
    },
    onError: (e: any) => {
      toast.error(e.message ?? 'Error al activar el crédito')
      setShowConfirmModal(false)
    },
  })
```

- [ ] **Step 3: Add the JSX return**

```tsx
  const selected = aprobados.find((c) => c.id === selectedId) ?? null
  const plazo = detalle ? safeN(detalle.plazoDias) : 0
  const fechasEstimadas = plazo > 0 ? generarFechasEstimadas(plazo) : []
  const primerFecha = fechasEstimadas[0]
  const ultimaFecha = fechasEstimadas[fechasEstimadas.length - 1]
  const pagoPeriodico = detalle ? safeN(detalle.pagoPeriodico) : 0
  const montoAprobado = detalle ? safeN(detalle.montoAprobado ?? detalle.montoCapital) : 0

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[600px]">
      {/* ── Left panel ── */}
      <div className="lg:w-1/3 space-y-3">
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Créditos listos para desembolsar</h2>
          {listLoading && <p className="text-sm text-gray-400 mt-2">Cargando...</p>}
          {!listLoading && aprobados.length === 0 && (
            <p className="text-sm text-gray-400 mt-2">No hay créditos pendientes de desembolso</p>
          )}
        </div>

        {aprobados.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { setSelectedId(c.id); setVideoUrl(null) }}
            className={[
              'w-full text-left card p-3 transition-colors',
              selectedId === c.id ? 'border-l-4 border-l-[#3d6b35] bg-green-50' : 'hover:bg-gray-50',
            ].join(' ')}
          >
            <div className="font-semibold text-sm text-gray-800">{c.cliente.nombreCompleto}</div>
            <div className="text-xs font-medium text-[#3d6b35] mt-0.5">
              {fmt(safeN(c.montoAprobado ?? c.montoCapital))}
            </div>
            <div className="text-xs text-gray-500">
              Pago/día: {fmt(safeN(c.pagoPeriodico))} · {c.asesor.nombreCompleto}
            </div>
            <div className="text-xs text-gray-400">
              Aprobado: {fmtDateFull(c.createdAt)}
            </div>
          </button>
        ))}
      </div>

      {/* ── Right panel ── */}
      <div className="lg:w-2/3">
        {!selectedId && (
          <div className="card p-8 flex flex-col items-center justify-center min-h-[300px] text-center text-gray-400">
            <ChevronRight className="w-8 h-8 mb-2" />
            <p className="text-sm">Selecciona un crédito para desembolsar</p>
          </div>
        )}

        {selectedId && detalle && (
          <div className="space-y-4">
            {/* Summary card */}
            <div className="card p-4 border border-green-300 bg-green-50 space-y-2">
              <div className="flex items-center gap-2 text-[#3d6b35] font-semibold text-sm">
                <span>✓</span> Crédito aprobado — listo para desembolsar
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div>
                  <span className="text-gray-400 text-xs">Cliente</span>
                  <div className="font-semibold text-gray-800">{detalle.cliente.nombreCompleto}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Monto aprobado</span>
                  <div className="text-2xl font-bold text-[#3d6b35]">{fmt(montoAprobado)}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Pago diario</span>
                  <div className="font-medium text-gray-800">{fmt(pagoPeriodico)}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Plazo</span>
                  <div className="font-medium text-gray-800">{plazo} días</div>
                </div>
                {detalle.aprobadoPor && (
                  <div className="col-span-2">
                    <span className="text-gray-400 text-xs">Aprobado por</span>
                    <div className="text-sm text-gray-700">{detalle.aprobadoPor.nombreCompleto} el {fmtDateFull(detalle.fechaAprobacion)}</div>
                  </div>
                )}
                {detalle.observaciones && (
                  <div className="col-span-2">
                    <span className="text-gray-400 text-xs">Observaciones</span>
                    <div className="text-sm text-gray-700">{detalle.observaciones}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Calendar preview */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700">Calendario que se generará</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                El calendario se generará con {plazo} días hábiles a partir de hoy ({new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}).
                Los sábados, domingos y días festivos se omiten automáticamente.
              </p>
              <div className="overflow-x-auto max-h-52 overflow-y-auto border border-gray-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Fecha estimada</th>
                      <th className="px-3 py-2 text-right text-gray-500 font-medium">Monto</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fechasEstimadas.map((f, i) => (
                      <tr key={i} className={i === 0 ? 'bg-green-50' : 'border-t border-gray-50'}>
                        <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                        <td className="px-3 py-1.5 text-gray-700">{fmtDate(f)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-800">{fmt(pagoPeriodico)}</td>
                        <td className="px-3 py-1.5 text-gray-400 italic">
                          {i === 0 ? 'Pago adelantado' : i === fechasEstimadas.length - 1 ? 'Último pago' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2 italic">* Fechas estimadas. Las fechas exactas consideran días festivos configurados.</p>
            </div>

            {/* Video upload (optional) */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Video de entrega de dinero</h3>
              <p className="text-xs text-gray-500 mb-3">
                Puedes grabar un video al momento de entregar el efectivo al cliente.
                También puedes subirlo después desde la ficha del crédito.
              </p>
              {!videoUrl && (
                <FileUpload
                  accept="video/mp4,video/quicktime,video/mov"
                  compress={true}
                  folder={`video-entrega/creditos/${selectedId}`}
                  label="Video de entrega (opcional)"
                  onUploadComplete={(url) => setVideoUrl(url)}
                />
              )}
              {videoUrl && (
                <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 p-3">
                  <span className="text-sm text-green-700">✓ Video listo para adjuntar</span>
                  <button type="button" onClick={() => setVideoUrl(null)} className="text-xs text-gray-400 underline">Quitar</button>
                </div>
              )}
            </div>

            {/* Activate button */}
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="btn-primary w-full py-4 text-base font-semibold"
            >
              Confirmar desembolso y activar crédito
            </button>
          </div>
        )}
      </div>

      {/* ── Confirm modal ── */}
      {showConfirmModal && detalle && (
        <div className="fixed inset-0 z-[2500] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-gray-800">Confirmar desembolso</h3>
            </div>
            <p className="text-xs text-gray-500">Esta acción no puede deshacerse.</p>
            <div className="text-sm text-gray-700 space-y-1">
              <div><span className="text-gray-400">Cliente:</span> {detalle.cliente.nombreCompleto}</div>
              <div><span className="text-gray-400">Monto:</span> <strong>{fmt(safeN(detalle.montoAprobado ?? detalle.montoCapital))}</strong></div>
              {primerFecha && <div><span className="text-gray-400">Primer pago:</span> {fmtDate(primerFecha)}</div>}
              {ultimaFecha && <div><span className="text-gray-400">Último pago:</span> {fmtDate(ultimaFecha)}</div>}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowConfirmModal(false)} className="btn flex-1 py-2.5">Cancelar</button>
              <button
                type="button"
                onClick={() => activarMut.mutate()}
                disabled={activarMut.isPending}
                className="btn-primary flex-1 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {activarMut.isPending ? 'Activando...' : 'Confirmar desembolso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/creditos/TabDesembolso.tsx
git commit -m "feat(creditos): add TabDesembolso with calendar preview and activate workflow"
```

---

## Task 3: Update CreditosNuevosPage.tsx

**Files:**
- Modify: `frontend/src/pages/creditos/CreditosNuevosPage.tsx`

- [ ] **Step 1: Replace the tab content section**

The file already imports TabSolicitudes and TabNuevaSolicitud. Add imports for the new tabs:

Find and replace in `CreditosNuevosPage.tsx`:

Old imports block (lines 1-6):
```tsx
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuthStore'
import TabSolicitudes from './TabSolicitudes'
import TabNuevaSolicitud from './TabNuevaSolicitud'
```

New:
```tsx
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuthStore'
import TabSolicitudes from './TabSolicitudes'
import TabNuevaSolicitud from './TabNuevaSolicitud'
import TabEvaluacion from './TabEvaluacion'
import TabDesembolso from './TabDesembolso'
```

- [ ] **Step 2: Add selectedCreditoId state and update handler functions**

After the existing `const [nuevaSolicitudOpen, setNuevaSolicitudOpen] = useState(false)` line, add:

```tsx
  const [selectedCreditoId, setSelectedCreditoId] = useState<number | undefined>()
```

Replace the existing handler functions:

Old:
```tsx
  function handleEvaluar(_id: number) {
    setActiveTab('evaluacion')
  }

  function handleDesembolsar(_id: number) {
    setActiveTab('desembolso')
  }
```

New:
```tsx
  function handleEvaluar(id: number) {
    setSelectedCreditoId(id)
    setActiveTab('evaluacion')
  }

  function handleDesembolsar(id: number) {
    setSelectedCreditoId(id)
    setActiveTab('desembolso')
  }
```

- [ ] **Step 3: Replace the placeholder tab content**

Old:
```tsx
      {activeTab === 'evaluacion' && (
        <div className="card p-8 text-center text-gray-500">
          En construcción — Evaluación
        </div>
      )}
      {activeTab === 'desembolso' && (
        <div className="card p-8 text-center text-gray-500">
          En construcción — Desembolso
        </div>
      )}
```

New:
```tsx
      {activeTab === 'evaluacion' && (
        <TabEvaluacion initialCreditoId={selectedCreditoId} />
      )}
      {activeTab === 'desembolso' && (
        <TabDesembolso initialCreditoId={selectedCreditoId} />
      )}
```

- [ ] **Step 4: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/creditos/CreditosNuevosPage.tsx
git commit -m "feat(creditos): wire TabEvaluacion and TabDesembolso into CreditosNuevosPage"
```

---

## Task 4: Implement CreditoDetallePage.tsx

**Files:**
- Modify: `frontend/src/pages/creditos/CreditoDetallePage.tsx`

This replaces the placeholder stub completely.

- [ ] **Step 1: Write the full implementation**

```tsx
// frontend/src/pages/creditos/CreditoDetallePage.tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, Play } from 'lucide-react'
import { creditoService } from '@/services/creditoService'
import { useAuthStore } from '@/hooks/useAuthStore'
import CreditoEstadoBadge from '@/components/CreditoEstadoBadge'
import FileUpload from '@/components/FileUpload'
import SecurePreviewImage from '@/components/SecurePreviewImage'
import ImagePreviewModal from '@/components/ImagePreviewModal'
import type { CalendarioPagoDetalle, EstadoPago } from '@/types'

// ── Helpers ────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(n)
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

function safeN(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

type PageTab = 'info' | 'calendario' | 'evidencia' | 'video'

// ── Row helper ─────────────────────────────────────────────────────
function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs font-medium text-gray-400 sm:w-40 shrink-0">{label}</span>
      <span className="text-sm text-gray-800">{value ?? '—'}</span>
    </div>
  )
}

// ── Estado color map for calendar rows ────────────────────────────
const ESTADO_ROW_CLS: Record<EstadoPago, string> = {
  ADELANTADO: 'bg-green-50',
  PAGADO:     'bg-green-50/60',
  PARCIAL:    'bg-amber-50',
  PENDIENTE:  '',
  NO_PAGADO:  'bg-red-50',
}

const ESTADO_BADGE_CLS: Record<EstadoPago, string> = {
  ADELANTADO: 'bg-green-100 text-green-800',
  PAGADO:     'bg-green-100 text-green-700',
  PARCIAL:    'bg-amber-100 text-amber-800',
  PENDIENTE:  'bg-gray-100 text-gray-600',
  NO_PAGADO:  'bg-red-100 text-red-800',
}

const ESTADO_PAGO_LABELS: Record<EstadoPago, string> = {
  ADELANTADO: 'Adelantado',
  PAGADO:     'Pagado',
  PARCIAL:    'Parcial',
  PENDIENTE:  'Pendiente',
  NO_PAGADO:  'No pagó',
}

function isVencido(pago: CalendarioPagoDetalle): boolean {
  if (pago.estado !== 'PENDIENTE') return false
  return new Date(pago.fechaProgramada) < new Date()
}

// ── Main ──────────────────────────────────────────────────────────

export default function CreditoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const creditoId = Number(id)
  const navigate = useNavigate()
  const { usuario } = useAuthStore()
  const qc = useQueryClient()

  const [tab, setTab] = useState<PageTab>('info')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showVideoUpload, setShowVideoUpload] = useState(false)

  const isAdminOrSup = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'

  const { data: credito, isLoading, error } = useQuery({
    queryKey: ['credito', creditoId],
    queryFn: () => creditoService.obtener(creditoId),
    enabled: !!creditoId,
  })

  const videoMut = useMutation({
    mutationFn: (url: string) => creditoService.subirVideoEntrega(creditoId, url),
    onSuccess: () => {
      toast.success('Video guardado correctamente')
      qc.invalidateQueries({ queryKey: ['credito', creditoId] })
      setShowVideoUpload(false)
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al guardar el video'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-gray-400 text-sm">Cargando crédito...</span>
      </div>
    )
  }

  if (error || !credito) {
    return (
      <div className="text-center py-20">
        <p className="text-red-600 text-sm mb-4">Crédito no encontrado</p>
        <button className="btn" onClick={() => navigate('/creditos-nuevos')}>
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
      </div>
    )
  }

  const stats = credito.estadisticas
  const calendario = credito.calendario ?? []
  const totalPagos = credito.plazoDias
  const pagosRealizados = stats.pagosRealizados
  const totalPagado = calendario
    .filter((p) => ['PAGADO', 'PARCIAL', 'ADELANTADO'].includes(p.estado))
    .reduce((sum, p) => sum + safeN(p.montoEsperado), 0)
  const saldo = safeN(credito.totalAPagar) - totalPagado
  const vencidosCount = calendario.filter(isVencido).length

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start gap-3">
        <button onClick={() => navigate('/creditos-nuevos')} className="btn btn-sm mt-0.5 shrink-0">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Volver</span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-800">
              Crédito #{credito.id} — {credito.cliente.nombreCompleto}
            </h1>
            <CreditoEstadoBadge estado={credito.estado} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {credito.cliente.celular} · {credito.asesor.nombreCompleto} · {credito.sucursal.nombre}
          </p>
        </div>

        {/* Action buttons by state */}
        <div className="flex gap-2 shrink-0">
          {credito.estado === 'SOLICITADO' && isAdminOrSup && (
            <button
              className="btn-primary btn-sm"
              onClick={() => navigate('/creditos-nuevos?tab=evaluacion')}
            >
              Evaluar
            </button>
          )}
          {credito.estado === 'APROBADO' && isAdminOrSup && (
            <button
              className="btn-primary btn-sm"
              onClick={() => navigate('/creditos-nuevos?tab=desembolso')}
            >
              Desembolsar
            </button>
          )}
          {credito.estado === 'ACTIVO' && (
            <button className="btn-primary btn-sm" onClick={() => navigate('/cobros')}>
              Registrar Pago
            </button>
          )}
        </div>
      </div>

      {/* ── Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Monto aprobado',
            value: fmt(credito.montoAprobado ?? credito.montoCapital),
            color: 'text-gray-800',
          },
          {
            label: 'Pago diario',
            value: fmt(credito.pagoPeriodico),
            color: 'text-[#3d6b35]',
          },
          {
            label: 'Progreso',
            value: `${pagosRealizados} / ${totalPagos} pagos`,
            color: 'text-blue-700',
          },
          {
            label: 'Vencimiento',
            value: fmtDate(credito.fechaVencimiento),
            color: 'text-gray-700',
          },
        ].map((m) => (
          <div key={m.label} className="metric-card">
            <p className="metric-label">{m.label}</p>
            <p className={`metric-val text-base ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="card">
        <div className="flex overflow-x-auto border-b border-gray-100" style={{ scrollbarWidth: 'none' }}>
          {([
            { key: 'info', label: 'Información' },
            { key: 'calendario', label: 'Calendario' },
            { key: 'evidencia', label: 'Evidencia' },
            { key: 'video', label: 'Video de entrega' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                'whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0',
                tab === key
                  ? 'border-[#3d6b35] text-[#3d6b35]'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">

          {/* ── Tab: Info ── */}
          {tab === 'info' && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Datos del crédito</p>
                <div>
                  <Row label="Capital solicitado" value={fmt(credito.montoCapital)} />
                  <Row label="Monto aprobado" value={fmt(credito.montoAprobado)} />
                  <Row label="Tasa de interés" value={`${(safeN(credito.tasaInteres) * 100).toFixed(0)}%`} />
                  <Row label="Cargo financiero" value={fmt(credito.cargoFinanciero)} />
                  <Row label="Total a pagar" value={fmt(credito.totalAPagar)} />
                  <Row label="Pago diario" value={fmt(credito.pagoPeriodico)} />
                  <Row label="Pago adelantado" value={fmt(credito.pagoAdelantado)} />
                  <Row label="Forma de pago" value={credito.tipoPago === 'DIARIO' ? 'Diario' : 'Semanal'} />
                  <Row label="Plazo" value={`${credito.plazoDias} días`} />
                  <Row label="Fecha inicio" value={fmtDate(credito.fechaInicio)} />
                  <Row label="Fecha vencimiento" value={fmtDate(credito.fechaVencimiento)} />
                  {credito.garantiaDescripcion && (
                    <Row label="Garantía material" value={credito.garantiaDescripcion} />
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Proceso</p>
                <div>
                  <Row label="Estado" value={credito.estado} />
                  <Row label="Asesor" value={credito.asesor.nombreCompleto} />
                  <Row label="Sucursal" value={credito.sucursal.nombre} />
                  <Row label="Fecha solicitud" value={fmtDate(credito.createdAt)} />
                  <Row label="Aprobado por" value={credito.aprobadoPor?.nombreCompleto} />
                  <Row label="Fecha aprobación" value={fmtDate(credito.fechaAprobacion)} />
                  <Row label="Fecha desembolso" value={fmtDate(credito.fechaDesembolso)} />
                  {credito.observaciones && <Row label="Observaciones" value={credito.observaciones} />}
                </div>
              </div>

              {/* Client summary card */}
              <button
                type="button"
                onClick={() => navigate(`/clientes/${credito.cliente.id}`)}
                className="w-full text-left card p-3 hover:bg-gray-50 transition-colors border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-0.5">Cliente</p>
                    <p className="text-sm font-semibold text-gray-800">{credito.cliente.nombreCompleto}</p>
                    <p className="text-xs text-gray-500">{credito.cliente.celular}</p>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-gray-300 rotate-180" />
                </div>
              </button>

              {/* Statistics */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Estadísticas</p>
                <div>
                  <Row label="Pagos realizados" value={stats.pagosRealizados} />
                  <Row label="Pagos pendientes" value={stats.pagosPendientes} />
                  <Row
                    label="Pagos vencidos"
                    value={vencidosCount > 0 ? `⚠ ${vencidosCount}` : '0'}
                  />
                  <Row
                    label="Multas pendientes"
                    value={safeN(stats.multasPendientes) > 0 ? fmt(safeN(stats.multasPendientes)) : '$0'}
                  />
                  <Row
                    label="Elegible para renovación"
                    value={stats.elegibleRenovacion ? 'Sí' : 'No'}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Calendario ── */}
          {tab === 'calendario' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="tabla w-full text-sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Fecha</th>
                      <th>Monto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendario.map((pago) => {
                      const vencido = isVencido(pago)
                      const rowCls = vencido ? 'bg-red-50' : (ESTADO_ROW_CLS[pago.estado] ?? '')
                      const estadoLabel = vencido ? 'Vencido' : ESTADO_PAGO_LABELS[pago.estado]
                      const badgeCls = vencido ? 'bg-red-100 text-red-800' : (ESTADO_BADGE_CLS[pago.estado] ?? 'bg-gray-100 text-gray-600')
                      return (
                        <tr key={pago.id} className={rowCls}>
                          <td className="font-medium">{pago.numeroPago}</td>
                          <td>{fmtDate(pago.fechaProgramada)}</td>
                          <td>{fmt(pago.montoEsperado)}</td>
                          <td>
                            <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${badgeCls}`}>
                              {estadoLabel}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
                  <div className="text-xs text-gray-500 mb-0.5">Pagados</div>
                  <div className="font-semibold text-green-700">{stats.pagosRealizados}</div>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                  <div className="text-xs text-gray-500 mb-0.5">Pendientes</div>
                  <div className="font-semibold text-gray-700">{stats.pagosPendientes}</div>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
                  <div className="text-xs text-gray-500 mb-0.5">Vencidos</div>
                  <div className="font-semibold text-red-700">{vencidosCount}</div>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
                  <div className="text-xs text-gray-500 mb-0.5">Total pagado</div>
                  <div className="font-semibold text-gray-700">{fmt(totalPagado)}</div>
                </div>
              </div>

              <div className="flex justify-between text-sm text-gray-600 pt-1 border-t border-gray-100">
                <span>Saldo restante:</span>
                <span className="font-semibold text-gray-800">{fmt(Math.max(0, saldo))}</span>
              </div>
            </div>
          )}

          {/* ── Tab: Evidencia ── */}
          {tab === 'evidencia' && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Evidencia del negocio</p>
              {(!credito.evidenciaUrls || credito.evidenciaUrls.length === 0) ? (
                <p className="text-sm text-gray-400">Sin evidencia adjunta</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {credito.evidenciaUrls.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => /\.(mp4|mov|webm)/i.test(url) ? window.open(url, '_blank') : setPreviewUrl(url)}
                      className="aspect-square rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center hover:opacity-80 transition-opacity"
                    >
                      {/\.(mp4|mov|webm)/i.test(url) ? (
                        <div className="flex flex-col items-center gap-1">
                          <Play className="w-8 h-8 text-gray-500" />
                          <span className="text-xs text-gray-400">Video {i + 1}</span>
                        </div>
                      ) : (
                        <SecurePreviewImage
                          fileUrl={url}
                          alt={`Evidencia ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Video ── */}
          {tab === 'video' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-gray-700">Video de entrega de dinero</p>

              {credito.videoEntregaUrl && !showVideoUpload && (
                <div className="space-y-3">
                  <video
                    src={credito.videoEntregaUrl}
                    controls
                    className="w-full rounded-xl border border-gray-200"
                    style={{ maxHeight: '400px' }}
                  />
                  <div className="flex gap-3">
                    <a
                      href={credito.videoEntregaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm"
                    >
                      Ver en tamaño completo
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowVideoUpload(true)}
                      className="btn btn-sm"
                    >
                      Cambiar video
                    </button>
                  </div>
                </div>
              )}

              {(!credito.videoEntregaUrl || showVideoUpload) && (
                <div className="space-y-3">
                  {showVideoUpload && (
                    <button
                      type="button"
                      onClick={() => setShowVideoUpload(false)}
                      className="text-xs text-gray-400 underline"
                    >
                      Cancelar
                    </button>
                  )}
                  <FileUpload
                    accept="video/mp4,video/quicktime,video/mov"
                    compress={true}
                    folder={`video-entrega/creditos/${creditoId}`}
                    label="Video de entrega de dinero"
                    onUploadComplete={(url) => videoMut.mutate(url)}
                  />
                  <p className="text-xs text-gray-400">
                    El video no es obligatorio para que el crédito esté activo. Puedes subirlo en cualquier momento.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Image preview modal ── */}
      <ImagePreviewModal
        isOpen={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        imageUrl={previewUrl ?? ''}
        title="Evidencia del negocio"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -40`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/creditos/CreditoDetallePage.tsx
git commit -m "feat(creditos): implement full CreditoDetallePage with 4 tabs"
```

---

## Task 5: Update ClienteDetallePage.tsx

**Files:**
- Modify: `frontend/src/pages/clientes/ClienteDetallePage.tsx`

Two changes:
1. Replace the placeholder credit card (lines 172–204) with a real card that fetches `creditoService.getCreditosCliente(clienteId)`
2. Replace the historial tab content to use credit data from the same query instead of the custom `/clientes/:id/historial` endpoint

- [ ] **Step 1: Add the import for creditoService**

At the top of the file, after the existing imports, add:

```tsx
import { creditoService } from '@/services/creditoService'
import CreditoEstadoBadge from '@/components/CreditoEstadoBadge'
import type { CreditoResumen, EstadoCredito } from '@/types'
```

- [ ] **Step 2: Add the credit query inside the component**

After the existing `historial` query (around line 75), add:

```tsx
  const clienteId = Number(id)

  const { data: creditosData } = useQuery({
    queryKey: ['creditos-cliente', clienteId],
    queryFn: () => creditoService.getCreditosCliente(clienteId),
    enabled: !!id && !!usuario?.id,
  })

  const creditoActivo = creditosData?.find((c) => c.estado === 'ACTIVO') ?? null
  const creditoEnProceso = creditosData?.find((c) => c.estado === 'SOLICITADO' || c.estado === 'APROBADO') ?? null
```

Note: `clienteId` is already used as `Number(id)` in existing code — just add the creditosData query.

- [ ] **Step 3: Replace the credit card section**

The existing credit card block starts at the `{/* ── Card: Crédito Activo ── */}` comment (around line 171). Replace the entire block from `{/* ── Card: Crédito Activo ── */}` through the closing `)}` of the else branch:

Old block (lines ~172-204):
```tsx
      {/* ── Card: Crédito Activo ── */}
      {cliente.tiene_credito_activo ? (
        <div className="card border-l-4 border-l-[#3d6b35]">
          <div className="p-4">
            <p className="text-[12px] font-medium text-[#3d6b35] uppercase tracking-wide mb-1">
              Crédito Activo
            </p>
            <p className="text-[13px] text-[#495057]">
              Información del crédito disponible al implementar el Módulo 3 de Créditos.
            </p>
            <button
              className="btn-primary mt-3"
              onClick={() => navigate('/cobros')}
            >
              Registrar pago
            </button>
          </div>
        </div>
      ) : (
        <div className="card bg-[#f8f9fa]">
          <div className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[13px] font-medium text-[#495057]">Sin crédito activo</p>
              <p className="text-[12px] text-[#adb5bd] mt-0.5">Este cliente no tiene un crédito vigente.</p>
            </div>
            <button
              className="btn-primary"
              onClick={() => navigate('/creditos-nuevos')}
            >
              Nueva solicitud de crédito
            </button>
          </div>
        </div>
      )}
```

New block:
```tsx
      {/* ── Card: Crédito ── */}
      {creditoActivo ? (
        <CreditoActivoCard credito={creditoActivo} onNavigate={navigate} />
      ) : creditoEnProceso ? (
        <div className="card border-l-4 border-l-amber-400 p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-0.5">
              Crédito en proceso
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">
                {fmtMoney(creditoEnProceso.montoCapital ?? (creditoEnProceso as any).montoCapital)}
              </span>
              <CreditoEstadoBadge estado={creditoEnProceso.estado as EstadoCredito} size="sm" />
            </div>
          </div>
          <button className="btn btn-sm" onClick={() => navigate(`/creditos/${creditoEnProceso.id}`)}>
            Ver solicitud
          </button>
        </div>
      ) : (
        <div className="card bg-[#f8f9fa]">
          <div className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-[13px] font-medium text-[#495057]">Sin crédito activo</p>
              <p className="text-[12px] text-[#adb5bd] mt-0.5">Este cliente no tiene un crédito vigente.</p>
            </div>
            <button className="btn-primary" onClick={() => navigate('/creditos-nuevos')}>
              Nueva solicitud de crédito
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Add the CreditoActivoCard sub-component**

Add this before the `export default function ClienteDetallePage()` line:

```tsx
// ── CreditoActivoCard ────────────────────────────────────────────
interface CreditoActivoCardProps {
  credito: CreditoResumen
  onNavigate: (path: string) => void
}

function CreditoActivoCard({ credito, onNavigate }: CreditoActivoCardProps) {
  function safeN(v: unknown): number {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  function fmtC(n: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n)
  }
  function fmtD(iso: string | null | undefined) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const monto = safeN(credito.montoAprobado ?? credito.montoCapital)
  const pagoPeriodico = safeN(credito.pagoPeriodico)
  const totalPagos = safeN(credito.totalPagos ?? credito.plazoDias)
  const pagosRealizados = safeN(credito.pagosRealizados)
  const progreso = totalPagos > 0 ? (pagosRealizados / totalPagos) * 100 : 0

  return (
    <div className="card border-l-4 border-l-[#3d6b35]">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-medium text-[#3d6b35] uppercase tracking-wide">Crédito Activo</p>
          <CreditoEstadoBadge estado="ACTIVO" size="sm" />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div>
            <span className="text-xs text-gray-400">Monto</span>
            <div className="font-semibold text-gray-800">{fmtC(monto)}</div>
          </div>
          <div>
            <span className="text-xs text-gray-400">Pago diario</span>
            <div className="font-semibold text-gray-800">{fmtC(pagoPeriodico)}</div>
          </div>
          <div>
            <span className="text-xs text-gray-400">Progreso</span>
            <div className="font-medium text-gray-700">Pago {pagosRealizados} de {totalPagos}</div>
          </div>
          <div>
            <span className="text-xs text-gray-400">Vence</span>
            <div className="font-medium text-gray-700">{fmtD(credito.fechaVencimiento)}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full bg-[#3d6b35] transition-all"
              style={{ width: `${Math.min(100, progreso)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{pagosRealizados} de {totalPagos} pagos completados</p>
        </div>

        {credito.estadisticas?.elegibleRenovacion && (
          <div className="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
            ✓ Elegible para renovación
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            className="btn flex-1 py-2 text-sm"
            onClick={() => onNavigate('/cobros')}
          >
            Registrar Pago
          </button>
          <button
            className="btn-primary flex-1 py-2 text-sm"
            onClick={() => onNavigate(`/creditos/${credito.id}`)}
          >
            Ver crédito
          </button>
        </div>
      </div>
    </div>
  )
}
```

Note: `credito.estadisticas` is a CreditoResumen field that may not exist. The type `CreditoResumen` doesn't have estadisticas. Use optional chaining and cast as needed. Actually, looking at the type, `CreditoResumen` doesn't have `estadisticas`. The `elegibleRenovacion` badge can be shown only for `CreditoDetalle`. For the card, skip the badge or fetch detalle separately. The simplest solution: skip the badge from the card (use `creditoActivo.pagosRealizados >= 16` as a heuristic, but that's not in spec). Simpler: just remove the elegibility badge from the card since `CreditoResumen` lacks `estadisticas`.

Corrected: Remove the `{credito.estadisticas?.elegibleRenovacion && ...}` block from `CreditoActivoCard` since `CreditoResumen` doesn't have that field. The badge will appear in the full credit detail page.

- [ ] **Step 5: Replace the historial tab content**

Find the historial tab content block (around line 343-376):

Old:
```tsx
          {/* ── Tab: Historial de Créditos ── */}
          {tab === 'historial' && (
            <div>
              {historial.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-[#dee2e6] mx-auto mb-2" />
                  <p className="text-[13px] text-[#adb5bd]">Sin historial de créditos anteriores.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Estado</th>
                        <th>Pagos cumplidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((h: any) => (
                        <tr key={h.id}>
                          <td>{fmtDate(h.fecha_inicio)}</td>
                          <td>{fmtMoney(h.monto_capital)}</td>
                          <td>{h.estado}</td>
                          <td>{h.pagos_realizados ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
```

New:
```tsx
          {/* ── Tab: Historial de Créditos ── */}
          {tab === 'historial' && (
            <div>
              {!creditosData || creditosData.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-[#dee2e6] mx-auto mb-2" />
                  <p className="text-[13px] text-[#adb5bd]">Sin historial de créditos anteriores.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Estado</th>
                        <th>Pagos cumplidos</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditosData.map((c) => (
                        <tr key={c.id}>
                          <td>{c.fechaInicio ? new Date(c.fechaInicio).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td>{fmtMoney(c.montoAprobado ?? c.montoCapital)}</td>
                          <td><CreditoEstadoBadge estado={c.estado as EstadoCredito} size="sm" /></td>
                          <td>{c.pagosRealizados ?? '—'} / {c.totalPagos ?? c.plazoDias}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => navigate(`/creditos/${c.id}`)}
                              className="btn btn-sm text-xs"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
```

- [ ] **Step 6: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -40`
Expected: No errors. Fix any type errors by checking exact field names against `CreditoResumen` in types/index.ts.

Note on field names: `CreditoResumen` uses camelCase (`montoCapital`, `montoAprobado`, `pagoPeriodico`, `plazoDias`, `pagosRealizados`, `totalPagos`, `fechaInicio`, `fechaVencimiento`). Use these directly, not snake_case.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/clientes/ClienteDetallePage.tsx
git commit -m "feat(clientes): show real credit data in ClienteDetallePage with progress bar and historial"
```

---

## Task 6: Final TypeScript build verification

**Files:** None

- [ ] **Step 1: Run full build**

```bash
cd /c/Users/Emm-a/Documents/github/magno-sistema/frontend && npm run build 2>&1 | tail -20
```

Expected output ending with:
```
✓ built in Xs
```

If there are TypeScript errors:
- Check exact field names against types/index.ts
- Most common issue: `CreditoResumen` uses camelCase, not snake_case
- `c.montoCapital` not `c.monto_capital`
- `c.pagoPeriodico` not `c.pago_periodico`
- `c.cliente.nombreCompleto` not `c.cliente.nombre_completo`

- [ ] **Step 2: Final commit if any minor fixes applied**

```bash
git add -p
git commit -m "fix(creditos): resolve TypeScript build errors"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|-------------|------|
| Tab Evaluación — role guard for ADMIN/SUPERVISOR | Task 1 |
| Tab Evaluación — split panel list/detail | Task 1 |
| Tab Evaluación — historial crediticio del cliente | Task 1 |
| Tab Evaluación — evidencia grid con preview | Task 1 |
| Tab Evaluación — monto aprobado recalcula con ProductoCalculoCard | Task 1 |
| Tab Evaluación — modal rechazo con motivo | Task 1 |
| Tab Evaluación — modal aprobación con resumen | Task 1 |
| Tab Desembolso — lista de créditos APROBADOS | Task 2 |
| Tab Desembolso — card resumen del crédito aprobado | Task 2 |
| Tab Desembolso — preview calendario (fechas estimadas, skip sat/sun) | Task 2 |
| Tab Desembolso — video upload opcional | Task 2 |
| Tab Desembolso — modal confirmación final | Task 2 |
| Tab Desembolso — navegar a /creditos/:id al activar | Task 2 |
| CreditosNuevosPage — wiring tabs con initialCreditoId | Task 3 |
| CreditoDetallePage — header con botones por estado | Task 4 |
| CreditoDetallePage — 4 métricas | Task 4 |
| CreditoDetallePage — tab Información | Task 4 |
| CreditoDetallePage — tab Calendario con colores por estado | Task 4 |
| CreditoDetallePage — tab Evidencia con preview | Task 4 |
| CreditoDetallePage — tab Video con player + upload | Task 4 |
| ClienteDetallePage — card crédito activo con barra de progreso | Task 5 |
| ClienteDetallePage — card crédito en proceso (SOLICITADO/APROBADO) | Task 5 |
| ClienteDetallePage — historial tab con creditoService real | Task 5 |

**Gaps found and addressed:**
- `CreditoResumen` doesn't have `estadisticas` field — removed eligibility badge from CreditoActivoCard (it appears in full detail page)
- Need to keep `historial` query in ClienteDetallePage or it will break if still referenced — check if it's used elsewhere; the query is assigned to `historial` variable used only in the historial tab — replacing tab content is sufficient; keep the query import but it becomes unused. Actually, remove the `historial` query to avoid dead code warning. Or keep it — TypeScript won't error on unused `const data`. Keep it to avoid scope of change creep.

**Type consistency check:**
- `CreditoResumen.montoCapital` ✓ (camelCase throughout)
- `CreditoResumen.cliente.nombreCompleto` ✓
- `CreditoResumen.asesor.nombreCompleto` ✓
- `CreditoDetalle.estadisticas.pagosRealizados` ✓
- `CalendarioPagoDetalle.numeroPago`, `.fechaProgramada`, `.montoEsperado`, `.estado` ✓
- `FileUpload` prop: `onUploadComplete` (not `onChange`) ✓
- `ImagePreviewModal` props: `isOpen`, `onClose`, `imageUrl`, `title` ✓

**Placeholder scan:** None found — all steps have complete code.
