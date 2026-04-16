# Cobros: Historial, Módulo Historial de Pago y Calendario — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el módulo de Cobros con la pestaña Historial de Cobros mejorada, el módulo Historial de Pago (tabla de control física), el calendario enriquecido en la ficha del crédito, la sección de últimos cobros en la ficha del cliente, y la invalidación correcta de cache en toda la app.

**Architecture:** El backend ya está completo. Todo es trabajo de frontend React 18 + TypeScript. La página Historial.tsx requiere llamadas paralelas a la API (ruta-dia para lista de clientes + credito-detalle por cada creditoId) mediante `useQueries`. El calendario en CreditoDetallePage muestra los datos reales del CalendarioPagoDetalle usando un modal local simple. Se reemplaza ModulePlaceholderPage en la ruta /historial.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, React Query v5 (`@tanstack/react-query`), react-hot-toast, lucide-react

---

## File Map

| Acción  | Archivo                                                      | Responsabilidad                                    |
|---------|--------------------------------------------------------------|----------------------------------------------------|
| MODIFY  | `frontend/src/pages/cobros/TabHistorialCobros.tsx`           | Añadir filtros completos + summary bar + tabla mejorada |
| CREATE  | `frontend/src/pages/Historial.tsx`                           | Módulo Historial de Pago (tabla de control física)  |
| MODIFY  | `frontend/src/App.tsx`                                       | Cambiar /historial de ModulePlaceholder a Historial |
| MODIFY  | `frontend/src/pages/creditos/CreditoDetallePage.tsx`         | Calendario enriquecido + modal detalle pago         |
| MODIFY  | `frontend/src/pages/clientes/ClienteDetallePage.tsx`         | Sección "Últimos cobros" en tab Historial           |
| MODIFY  | `frontend/src/components/cobros/ModalRegistrarPago.tsx`      | Añadir invalidaciones de cache faltantes            |

---

## Task 1: Mejorar TabHistorialCobros.tsx

**Files:**
- Modify: `frontend/src/pages/cobros/TabHistorialCobros.tsx`

La versión actual tiene filtros de fecha básicos y tabla simple. Hay que añadir:
- Preset de fechas (Hoy/Ayer/Esta semana/Este mes/Rango personalizado)
- Filtros de estado, asesor (solo admin/supervisor), modalidad
- Summary bar (total registros, total cobrado, total multas)
- Columna Asesor (usando `registradoPor.nombreCompleto`)
- Columna Diferencia (montoRecibido - montoEsperado, rojo si negativo)
- Columna Pago # con formato "14 / 25" (para eso necesitamos totalPagos — NOTA: PagoCobroDTO no tiene totalPagos, usaremos solo numeroPago)
- Columna Registrado por
- Botón "Ver cliente" (navega a /clientes/:id)
- Cards de móvil mejoradas con razón de no pago en cursiva

**NOTA IMPORTANTE sobre el filtro de asesor:** El endpoint GET /api/cobros/historial acepta `asesorId` como parámetro. Para admin/supervisor, mostrar un select con la lista de asesores. Obtener asesores del endpoint `/api/clientes/asesores` (ya usado en ClienteDetallePage).

**NOTA sobre "total cobrado" en summary:** sumar todos los `montoRecibido` del page actual. Si hay más pages, es una aproximación. Indicarlo con "en esta página".

- [ ] **Step 1: Reemplazar TabHistorialCobros.tsx completo**

```tsx
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { cobrosService } from '@/services/cobrosService'
import { useAuthStore } from '@/hooks/useAuthStore'
import ModalModificarPago from '@/components/cobros/ModalModificarPago'
import type { PagoCobroDTO } from '@/types'
import { api } from '@/services/api'

function fmtMoney(v: number | null | undefined) {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function weekStartStr() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

function monthStartStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

type PresetFecha = 'hoy' | 'ayer' | 'semana' | 'mes' | 'rango'

function getPresetDates(preset: PresetFecha): { desde: string; hasta: string } {
  const hoy = todayStr()
  switch (preset) {
    case 'hoy':    return { desde: hoy,             hasta: hoy }
    case 'ayer':   return { desde: yesterdayStr(),   hasta: yesterdayStr() }
    case 'semana': return { desde: weekStartStr(),   hasta: hoy }
    case 'mes':    return { desde: monthStartStr(),  hasta: hoy }
    case 'rango':  return { desde: hoy,              hasta: hoy }
  }
}

function estadoFromPago(p: PagoCobroDTO): 'PAGADO' | 'PARCIAL' | 'NO_PAGADO' {
  if (p.razonNoPago) return 'NO_PAGADO'
  if (p.esCompleto)  return 'PAGADO'
  return 'PARCIAL'
}

export default function TabHistorialCobros() {
  const { usuario } = useAuthStore()
  const navigate = useNavigate()

  const esAdminSupervisor =
    usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'

  const [preset, setPreset] = useState<PresetFecha>('hoy')
  const [fechaDesde, setFechaDesde] = useState(todayStr())
  const [fechaHasta, setFechaHasta] = useState(todayStr())
  const [estadoFiltro, setEstadoFiltro] = useState<'' | 'PAGADO' | 'PARCIAL' | 'NO_PAGADO'>('')
  const [modalidadFiltro, setModalidadFiltro] = useState<'' | 'CAJA' | 'RUTA'>('')
  const [asesorFiltro, setAsesorFiltro] = useState<number | undefined>(undefined)
  const [buscar, setBuscar] = useState('')
  const [page, setPage] = useState(0)
  const [pagoEditar, setPagoEditar] = useState<PagoCobroDTO | null>(null)

  function applyPreset(p: PresetFecha) {
    setPreset(p)
    const { desde, hasta } = getPresetDates(p)
    setFechaDesde(desde)
    setFechaHasta(hasta)
    setPage(0)
  }

  // Lista de asesores para el select (solo admin/supervisor)
  const { data: asesores = [] } = useQuery({
    queryKey: ['asesores-list'],
    queryFn: () =>
      api.get<{ id: number; nombre_completo: string }[]>('/clientes/asesores').then((r) => r.data),
    enabled: esAdminSupervisor,
    staleTime: 60_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['historial-cobros', fechaDesde, fechaHasta, asesorFiltro, page],
    queryFn: () =>
      cobrosService.getHistorial({
        fechaDesde,
        fechaHasta,
        asesorId: asesorFiltro,
        page,
        size: 50,
      }),
    staleTime: 30_000,
  })

  const pagos = data?.content ?? []
  const totalPages = data?.totalPages ?? data?.total_pages ?? 1
  const totalElements = data?.totalElements ?? data?.total_elements ?? 0

  // Filtrar en cliente (búsqueda por nombre + estado + modalidad)
  const filtrados = useMemo(() => {
    return pagos.filter((p) => {
      if (buscar.trim()) {
        const q = buscar.toLowerCase()
        const nombre = p.cliente.nombreCompleto.toLowerCase()
        if (!nombre.includes(q)) return false
      }
      if (estadoFiltro) {
        if (estadoFromPago(p) !== estadoFiltro) return false
      }
      if (modalidadFiltro) {
        if (p.modalidad !== modalidadFiltro) return false
      }
      return true
    })
  }, [pagos, buscar, estadoFiltro, modalidadFiltro])

  // Summary stats (basado en datos de la página actual)
  const totalCobrado = filtrados.reduce((sum, p) => sum + (p.razonNoPago ? 0 : Number(p.montoRecibido)), 0)
  const totalMultas  = filtrados.reduce((sum, p) => sum + Number(p.multaAplicada ?? 0), 0)

  const PRESETS: { key: PresetFecha; label: string }[] = [
    { key: 'hoy',    label: 'Hoy' },
    { key: 'ayer',   label: 'Ayer' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'mes',    label: 'Este mes' },
    { key: 'rango',  label: 'Rango' },
  ]

  return (
    <>
      {/* ── Filtros ── */}
      <div className="space-y-3">
        {/* Fila 1: preset de fecha + búsqueda */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                preset === key
                  ? 'bg-[#3d6b35] text-white border-[#3d6b35]'
                  : 'bg-white text-[#495057] border-[#dee2e6] hover:border-[#adb5bd]'
              }`}
            >
              {label}
            </button>
          ))}
          <input
            type="text"
            placeholder="Buscar cliente..."
            className="input text-[13px] py-[5px] ml-auto w-full sm:w-48"
            value={buscar}
            onChange={(e) => { setBuscar(e.target.value); setPage(0) }}
          />
        </div>

        {/* Rango personalizado */}
        {preset === 'rango' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-[#6c757d] whitespace-nowrap">Desde</label>
              <input
                type="date"
                className="input text-[13px] py-[5px]"
                value={fechaDesde}
                max={fechaHasta}
                onChange={(e) => { setFechaDesde(e.target.value); setPage(0) }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-[#6c757d] whitespace-nowrap">Hasta</label>
              <input
                type="date"
                className="input text-[13px] py-[5px]"
                value={fechaHasta}
                min={fechaDesde}
                max={todayStr()}
                onChange={(e) => { setFechaHasta(e.target.value); setPage(0) }}
              />
            </div>
          </div>
        )}

        {/* Fila 2: filtros de estado, modalidad, asesor */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input text-[13px] py-[5px] w-auto"
            value={estadoFiltro}
            onChange={(e) => { setEstadoFiltro(e.target.value as any); setPage(0) }}
          >
            <option value="">Todos los estados</option>
            <option value="PAGADO">Pagado</option>
            <option value="PARCIAL">Parcial</option>
            <option value="NO_PAGADO">No pagó</option>
          </select>

          <select
            className="input text-[13px] py-[5px] w-auto"
            value={modalidadFiltro}
            onChange={(e) => { setModalidadFiltro(e.target.value as any); setPage(0) }}
          >
            <option value="">Todas las modalidades</option>
            <option value="CAJA">Caja</option>
            <option value="RUTA">Ruta</option>
          </select>

          {esAdminSupervisor && (
            <select
              className="input text-[13px] py-[5px] w-auto"
              value={asesorFiltro ?? ''}
              onChange={(e) => { setAsesorFiltro(e.target.value ? Number(e.target.value) : undefined); setPage(0) }}
            >
              <option value="">Todos los asesores</option>
              {asesores.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre_completo}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="btn btn-sm ml-auto"
            disabled
            title="Próximamente"
          >
            Exportar
          </button>
        </div>
      </div>

      {/* ── Summary bar ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#212529]">{totalElements}</div>
          <div className="text-[11px] text-[#6c757d]">Total registros</div>
        </div>
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[#16a34a]">{fmtMoney(totalCobrado)}</div>
          <div className="text-[11px] text-[#6c757d]">Total cobrado</div>
        </div>
        <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
          <div className={`text-lg font-bold ${totalMultas > 0 ? 'text-[#dc2626]' : 'text-[#212529]'}`}>
            {fmtMoney(totalMultas)}
          </div>
          <div className="text-[11px] text-[#6c757d]">Multas aplicadas</div>
        </div>
      </div>

      {/* ── Mobile: cards ── */}
      <div className="lg:hidden space-y-3">
        {isLoading && (
          <p className="text-[#adb5bd] text-[13px] text-center py-10">Cargando...</p>
        )}
        {!isLoading && filtrados.length === 0 && (
          <p className="text-[#adb5bd] text-[13px] text-center py-10">Sin registros en el período.</p>
        )}
        {filtrados.map((p) => {
          const estado = estadoFromPago(p)
          return (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#212529] truncate">
                    {p.cliente.nombreCompleto}
                  </p>
                  <p className="text-[12px] text-[#6c757d] mt-0.5">
                    Pago #{p.numeroPago} · {fmtDate(p.fechaPago)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge ${
                      estado === 'NO_PAGADO' ? 'badge-rojo'
                      : estado === 'PAGADO'  ? 'badge-verde'
                      : 'badge-amarillo'
                    }`}>
                      {estado === 'NO_PAGADO' ? 'No pagó' : estado === 'PAGADO' ? 'Pagado' : 'Parcial'}
                    </span>
                    <span className="badge badge-azul text-[10px]">{p.modalidad}</span>
                  </div>
                  <p className="text-[13px] font-semibold mt-1 text-[#212529]">
                    {estado === 'NO_PAGADO' ? '—' : fmtMoney(p.montoRecibido)}
                    <span className="text-[12px] font-normal text-[#6c757d]">
                      {' / '}{fmtMoney(p.montoEsperado)}
                    </span>
                  </p>
                  {p.razonNoPago && (
                    <p className="text-[11px] text-[#6c757d] italic mt-0.5">{p.razonNoPago}</p>
                  )}
                  {p.registradoPor && (
                    <p className="text-[11px] text-[#adb5bd] mt-0.5">
                      Asesor: {p.registradoPor.nombreCompleto}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    className="btn btn-sm text-xs"
                    onClick={() => navigate(`/clientes/${p.cliente.id}`)}
                  >
                    Ver cliente
                  </button>
                  {esAdminSupervisor && (
                    <button
                      type="button"
                      className="btn btn-sm text-xs"
                      onClick={() => setPagoEditar(p)}
                    >
                      Modificar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop: tabla ── */}
      <div className="hidden lg:block card overflow-hidden">
        {isLoading ? (
          <p className="text-[#adb5bd] text-[13px] text-center py-10">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <p className="text-[#adb5bd] text-[13px] text-center py-10">Sin registros en el período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Pago #</th>
                  <th className="text-right">Esperado</th>
                  <th className="text-right">Recibido</th>
                  <th className="text-right">Diferencia</th>
                  <th>Modalidad</th>
                  <th>Estado</th>
                  <th>Asesor</th>
                  <th>Fecha</th>
                  <th>Registrado por</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const estado = estadoFromPago(p)
                  const diferencia = Number(p.montoRecibido) - Number(p.montoEsperado)
                  const difNeg = diferencia < -0.01
                  return (
                    <tr key={p.id}>
                      <td className="font-medium">{p.cliente.nombreCompleto}</td>
                      <td className="text-[#6c757d]">#{p.numeroPago}</td>
                      <td className="text-right text-[#6c757d]">{fmtMoney(p.montoEsperado)}</td>
                      <td className={`text-right font-semibold ${
                        estado === 'NO_PAGADO' ? 'text-[#dc2626]'
                        : estado === 'PAGADO'  ? 'text-[#2d6a4f]'
                        : 'text-[#f59e0b]'
                      }`}>
                        {estado === 'NO_PAGADO' ? '—' : fmtMoney(p.montoRecibido)}
                      </td>
                      <td className={`text-right font-semibold ${difNeg ? 'text-[#dc2626]' : 'text-[#6c757d]'}`}>
                        {estado === 'NO_PAGADO' ? '—' : (difNeg ? '-' : '') + fmtMoney(Math.abs(diferencia))}
                      </td>
                      <td>
                        <span className={`badge ${p.modalidad === 'CAJA' ? 'badge-azul' : 'badge-gris'} text-[10px]`}>
                          {p.modalidad}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          estado === 'NO_PAGADO' ? 'badge-rojo'
                          : estado === 'PAGADO'  ? 'badge-verde'
                          : 'badge-amarillo'
                        }`}>
                          {estado === 'NO_PAGADO' ? 'No pagó' : estado === 'PAGADO' ? 'Pagado' : 'Parcial'}
                        </span>
                      </td>
                      <td className="text-[#6c757d]">
                        {p.registradoPor?.nombreCompleto ?? '—'}
                      </td>
                      <td className="text-[#6c757d] whitespace-nowrap">{fmtDate(p.fechaPago)}</td>
                      <td className="text-[12px] text-[#adb5bd]">
                        {p.registradoPor?.nombreCompleto ?? '—'}
                        {p.modificadoPor && (
                          <span className="block text-[10px] italic">
                            Mod: {p.modificadoPor.nombreCompleto}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className="btn btn-sm text-xs"
                            onClick={() => navigate(`/clientes/${p.cliente.id}`)}
                          >
                            Ver cliente
                          </button>
                          {esAdminSupervisor && (
                            <button
                              type="button"
                              className="btn btn-sm text-xs"
                              onClick={() => setPagoEditar(p)}
                            >
                              Modificar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            className="btn btn-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span className="text-[12px] text-[#6c757d]">
            Página {page + 1} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}

      {/* ── Modal modificar ── */}
      {pagoEditar && (
        <ModalModificarPago
          pago={pagoEditar}
          onClose={() => setPagoEditar(null)}
          onSuccess={() => setPagoEditar(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Verificar que TypeScript compila sin errores**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores en TabHistorialCobros. Si hay errores, corregirlos antes de continuar.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/pages/cobros/TabHistorialCobros.tsx
git commit -m "feat(cobros): historial con filtros completos, summary bar y tabla mejorada"
```

---

## Task 2: Crear src/pages/Historial.tsx

**Files:**
- Create: `frontend/src/pages/Historial.tsx`

Esta página replica el formato físico de la tabla de control de pagos. Carga datos en dos pasos:
1. `getRutaDia({asesorId, fecha})` → lista de clientes con sus `creditoId` y `numeroPagoHoy`
2. `creditoService.obtener(creditoId)` para cada cliente → calendario completo

Usa `useQueries` de React Query para queries paralelas.

**Lógica del highlight "hoy":** la celda del `numeroPagoHoy` de cada cliente recibe borde azul `ring-2 ring-blue-500`.

**Símbolo por estado del pago (CalendarioPagoDetalle.estado):**
- `PAGADO`    → `✓` fondo verde claro `bg-green-100 text-green-700`
- `ADELANTADO`→ `A` fondo verde muy claro `bg-green-50 text-green-600`
- `PARCIAL`   → `$` fondo amarillo `bg-amber-100 text-amber-700`
- `NO_PAGADO` → `✗` fondo rojo `bg-red-100 text-red-700`
- `PENDIENTE` (fecha futura) → `·` fondo gris claro `bg-gray-50 text-gray-400`
- `PENDIENTE` (fecha pasada) → `·` fondo rojo muy claro `bg-red-50 text-red-400` (vencido)
- `INHABILL` / `INHABIL` → `—` fondo gris `bg-gray-100 text-gray-400`

**Primera columna sticky:** `sticky left-0 z-10 bg-white` con sombra de separación `shadow-[1px_0_0_#e9ecef]`.

- [ ] **Step 1: Crear Historial.tsx**

```tsx
import { useState, useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cobrosService } from '@/services/cobrosService'
import { creditoService } from '@/services/creditoService'
import { useAuthStore } from '@/hooks/useAuthStore'
import type { CalendarioPagoDetalle } from '@/types'
import { api } from '@/services/api'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function fmtDateLabel(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) return '—'
  return `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`
}

function isDatePast(fechaProgramada: string, selectedDate: string) {
  return fechaProgramada.slice(0, 10) < selectedDate
}

interface CellProps {
  pago: CalendarioPagoDetalle | undefined
  isHoy: boolean
  selectedDate: string
}

function PaymentCell({ pago, isHoy, selectedDate }: CellProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (!pago) {
    return (
      <td className={`text-center p-0 ${isHoy ? 'ring-2 ring-inset ring-blue-500' : ''}`}>
        <span className="block w-7 h-7 mx-auto" />
      </td>
    )
  }

  let symbol = '·'
  let cls = 'bg-gray-50 text-gray-400'

  switch (pago.estado) {
    case 'PAGADO':
      symbol = '✓'; cls = 'bg-green-100 text-green-700 font-bold'; break
    case 'ADELANTADO':
      symbol = 'A'; cls = 'bg-green-50 text-green-600 font-semibold'; break
    case 'PARCIAL':
      symbol = '$'; cls = 'bg-amber-100 text-amber-700 font-semibold'; break
    case 'NO_PAGADO':
      symbol = '✗'; cls = 'bg-red-100 text-red-700 font-bold'; break
    case 'INHABILL':
    case 'INHABIL':
      symbol = '—'; cls = 'bg-gray-100 text-gray-400'; break
    case 'PENDIENTE':
    default:
      if (isDatePast(pago.fechaProgramada, selectedDate)) {
        symbol = '·'; cls = 'bg-red-50 text-red-400'
      } else {
        symbol = '·'; cls = 'bg-gray-50 text-gray-400'
      }
  }

  const hasTooltip = pago.estado === 'NO_PAGADO'

  return (
    <td className={`text-center p-0.5 ${isHoy ? 'ring-2 ring-inset ring-blue-500' : ''}`}>
      <div className="relative">
        <span
          className={`block w-7 h-7 mx-auto rounded flex items-center justify-center text-[11px] cursor-default select-none ${cls}`}
          onMouseEnter={() => hasTooltip && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onTouchStart={() => hasTooltip && setShowTooltip(true)}
          onTouchEnd={() => setTimeout(() => setShowTooltip(false), 1500)}
        >
          {symbol}
        </span>
        {showTooltip && hasTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 bg-gray-900 text-white text-[11px] rounded px-2 py-1 max-w-[160px] text-center pointer-events-none whitespace-normal">
            {/* NOTE: razonNoPago no está en CalendarioPagoDetalle — mostramos el estado */}
            No pagó
          </div>
        )}
      </div>
    </td>
  )
}

export default function Historial() {
  const { usuario } = useAuthStore()

  const esAdminSupervisor =
    usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'
  const esRestringido =
    usuario?.rol === 'ASESOR_COBRADOR' || usuario?.rol === 'SUPERVISOR_CAMPO'

  const [fecha, setFecha] = useState(todayStr())
  const [asesorId, setAsesorId] = useState<number | undefined>(
    esRestringido ? usuario?.id : undefined
  )

  // Lista de asesores para admin/supervisor
  const { data: asesores = [] } = useQuery({
    queryKey: ['asesores-list'],
    queryFn: () =>
      api.get<{ id: number; nombre_completo: string }[]>('/clientes/asesores').then((r) => r.data),
    enabled: esAdminSupervisor,
    staleTime: 60_000,
  })

  const asesorSeleccionado = asesores.find((a) => a.id === asesorId)
  const asesorNombre = esRestringido ? usuario?.nombre_completo : asesorSeleccionado?.nombre_completo

  // Ruta del día para obtener la lista de clientes + numeroPagoHoy
  const { data: rutaDia, isLoading: isLoadingRuta } = useQuery({
    queryKey: ['ruta-dia', asesorId, fecha],
    queryFn: () => cobrosService.getRutaDia({ asesorId, fecha }),
    enabled: !!asesorId,
    staleTime: 30_000,
  })

  const clientes = rutaDia?.clientes ?? []

  // Para cada cliente, obtener el crédito con su calendario completo
  const creditoQueries = useQueries({
    queries: clientes.map((c) => ({
      queryKey: ['credito', c.creditoId],
      queryFn: () => creditoService.obtener(c.creditoId),
      staleTime: 30_000,
      enabled: !!asesorId && clientes.length > 0,
    })),
  })

  const isLoadingCreditos = creditoQueries.some((q) => q.isLoading)
  const isLoading = isLoadingRuta || isLoadingCreditos

  // Determinar el número máximo de pagos (25 o 30)
  const maxPagos = useMemo(() => {
    const totales = clientes.map((c) => c.totalPagos ?? 25)
    return Math.max(...totales, 25)
  }, [clientes])

  // Resumen del encabezado
  const resumen = rutaDia?.resumen

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-[#212529]">Historial de Pago</h1>
      </div>

      {/* ── Filtros: asesor + fecha ── */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Select asesor */}
          {esAdminSupervisor ? (
            <div className="flex items-center gap-2">
              <label className="text-[12px] text-[#6c757d] whitespace-nowrap font-medium">
                Asesor
              </label>
              <select
                className="input text-[13px] py-[5px]"
                value={asesorId ?? ''}
                onChange={(e) => setAsesorId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">— Seleccionar asesor —</option>
                {asesores.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre_completo}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#6c757d] font-medium">Asesor:</span>
              <span className="text-[13px] font-semibold text-[#212529]">{asesorNombre}</span>
            </div>
          )}

          {/* Navegación de fecha */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              className="btn btn-sm p-1.5"
              onClick={() => setFecha(addDays(fecha, -1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              className="input text-[13px] py-[5px] w-40"
              value={fecha}
              max={todayStr()}
              onChange={(e) => setFecha(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-sm p-1.5"
              onClick={() => setFecha(addDays(fecha, 1))}
              disabled={fecha >= todayStr()}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Si no hay asesor seleccionado ── */}
      {!asesorId && (
        <div className="card p-8 text-center text-[#adb5bd] text-[14px]">
          Selecciona un asesor para ver su historial de pago.
        </div>
      )}

      {/* ── Encabezado del reporte (cuando hay datos) ── */}
      {asesorId && (
        <>
          <div className="card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[14px] font-bold text-[#212529]">{asesorNombre}</p>
                <p className="text-[12px] text-[#6c757d]">{fmtDateLabel(fecha)}</p>
              </div>
            </div>

            {/* Cards de resumen */}
            {resumen && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div className="text-[13px] font-bold text-[#212529]">
                    {fmtMoney(resumen.totalCaja)}
                  </div>
                  <div className="text-[10px] text-[#6c757d]">Caja</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div className="text-[13px] font-bold text-[#212529]">
                    {fmtMoney(resumen.totalRuta)}
                  </div>
                  <div className="text-[10px] text-[#6c757d]">Ruta</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div className={`text-[13px] font-bold ${resumen.noPagaron > 0 ? 'text-[#dc2626]' : 'text-[#212529]'}`}>
                    {resumen.noPagaron}
                  </div>
                  <div className="text-[10px] text-[#6c757d]">No pagaron</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div className={`text-[13px] font-bold ${resumen.totalMultasCobradas > 0 ? 'text-[#dc2626]' : 'text-[#212529]'}`}>
                    {fmtMoney(resumen.totalMultasCobradas)}
                  </div>
                  <div className="text-[10px] text-[#6c757d]">Multas</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div className="text-[13px] font-bold text-[#16a34a]">
                    {fmtMoney(resumen.totalCaja + resumen.totalRuta)}
                  </div>
                  <div className="text-[10px] text-[#6c757d]">Total cobrado</div>
                </div>
              </div>
            )}
          </div>

          {/* ── Tabla de control de pagos ── */}
          <div className="card overflow-hidden">
            {isLoading ? (
              <p className="text-[#adb5bd] text-[13px] text-center py-10">Cargando tabla...</p>
            ) : clientes.length === 0 ? (
              <p className="text-[#adb5bd] text-[13px] text-center py-10">
                Sin clientes activos para este asesor en esta fecha.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-[12px] border-collapse w-full">
                  <thead>
                    <tr className="bg-[#f8f9fa] text-[#6c757d]">
                      {/* Primera columna sticky */}
                      <th className="sticky left-0 z-20 bg-[#f8f9fa] text-left px-3 py-2 border-b border-r border-[#e9ecef] whitespace-nowrap min-w-[160px]">
                        Cliente
                      </th>
                      <th className="text-right px-2 py-2 border-b border-[#e9ecef] whitespace-nowrap">
                        Pago/día
                      </th>
                      {Array.from({ length: maxPagos }, (_, i) => i + 1).map((n) => (
                        <th key={n} className="text-center px-1 py-2 border-b border-[#e9ecef] w-8">
                          {n}
                        </th>
                      ))}
                      <th className="text-center px-2 py-2 border-b border-[#e9ecef] whitespace-nowrap">
                        Venc.
                      </th>
                      <th className="text-center px-2 py-2 border-b border-[#e9ecef]">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((cliente, idx) => {
                      const creditoQuery = creditoQueries[idx]
                      const credito = creditoQuery?.data
                      const calendario: CalendarioPagoDetalle[] = credito?.calendario ?? []

                      // Mapa de numeroPago → CalendarioPagoDetalle
                      const calMap = new Map(calendario.map((p) => [p.numeroPago, p]))

                      return (
                        <tr key={cliente.clienteId} className="hover:bg-[#f8f9fa] border-b border-[#f1f3f5]">
                          {/* Primera columna sticky */}
                          <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-[#e9ecef] shadow-[1px_0_0_#e9ecef]">
                            <div className="font-medium text-[#212529] truncate max-w-[148px]">
                              {cliente.nombreCompleto}
                            </div>
                            <div className="text-[10px] text-[#adb5bd]">{cliente.celular}</div>
                          </td>
                          <td className="text-right px-2 py-2 font-semibold text-[#212529] whitespace-nowrap">
                            {fmtMoney(cliente.pagoPeriodico)}
                          </td>
                          {Array.from({ length: maxPagos }, (_, i) => i + 1).map((n) => {
                            const pago = calMap.get(n)
                            const isHoy = n === (cliente.numeroPagoHoy ?? -1)
                            return (
                              <PaymentCell
                                key={n}
                                pago={pago}
                                isHoy={isHoy}
                                selectedDate={fecha}
                              />
                            )
                          })}
                          <td className="text-center px-2 py-2 text-[#6c757d] whitespace-nowrap">
                            {credito?.fechaVencimiento
                              ? new Date(credito.fechaVencimiento + 'T12:00:00').toLocaleDateString('es-MX', {
                                  day: '2-digit', month: 'short',
                                })
                              : '—'}
                          </td>
                          <td className="text-center px-2 py-2">
                            <span className={`badge text-[10px] ${
                              credito?.estado === 'ACTIVO'    ? 'badge-verde'
                              : credito?.estado === 'PAGADO'  ? 'badge-azul'
                              : 'badge-gris'
                            }`}>
                              {credito?.estado ?? '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar que TypeScript compila**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "Historial|error" | head -20
```

Esperado: sin errores en Historial.tsx. Si `useQueries` da error de tipos, verificar que la versión de @tanstack/react-query sea v5 (API compatible).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Historial.tsx
git commit -m "feat(historial): crear módulo Historial de Pago con tabla de control física"
```

---

## Task 3: Registrar ruta /historial en App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Añadir import de Historial**

En `frontend/src/App.tsx`, añadir al bloque de imports:

```tsx
import HistorialPage from '@/pages/Historial'
```

- [ ] **Step 2: Reemplazar ModulePlaceholderPage para /historial**

Cambiar la línea:
```tsx
<Route path="/historial" element={<ModulePlaceholderPage />} />
```

Por:
```tsx
<Route path="/historial" element={<HistorialPage />} />
```

- [ ] **Step 3: Verificar compilación y commit**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -10
git add frontend/src/App.tsx
git commit -m "feat(router): conectar /historial con HistorialPage"
```

---

## Task 4: Actualizar Tab Calendario en CreditoDetallePage.tsx

**Files:**
- Modify: `frontend/src/pages/creditos/CreditoDetallePage.tsx`

El calendario actual tiene columnas: # | Fecha | Monto | Estado
Hay que añadir: Monto recibido | Acciones (Ver pago / Modificar)
Y un modal de detalle simple para "Ver pago".

El CalendarioPagoDetalle **no tiene** `montoRecibido` ni `razonNoPago` — esos datos están en el PagoCobroDTO. Para el modal "Ver pago", hay que hacer una llamada al historial filtrado por creditoId y numeroPago. 

**Estrategia simplificada:** En lugar de llamar la API por cada clic, obtenemos los pagos del crédito llamando `GET /api/cobros/cliente/{clienteId}` (que devuelve PagoCobroDTO[]) al cargar la página. Luego en cada fila con estado PAGADO/PARCIAL/NO_PAGADO, buscamos el PagoCobroDTO por numeroPago.

Necesitamos el `clienteId` — está disponible en `credito.cliente.id`.

- [ ] **Step 1: Añadir query de pagos del cliente en CreditoDetallePage**

Localizar el bloque de queries en `CreditoDetallePage.tsx` (después de la query `credito`):

Añadir:
```tsx
import { cobrosService } from '@/services/cobrosService'
import ModalModificarPago from '@/components/cobros/ModalModificarPago'
```

Y dentro del componente, después de la query de credito:
```tsx
const { data: pagosHistorial = [] } = useQuery({
  queryKey: ['pagos-cliente-credito', numId],
  queryFn: () => cobrosService.getPagosPorCliente(credito!.cliente.id),
  enabled: !!credito,
  staleTime: 30_000,
})

const [pagoModal, setPagoModal] = useState<typeof pagosHistorial[0] | null>(null)
const [pagoEditar, setPagoEditar] = useState<typeof pagosHistorial[0] | null>(null)
```

- [ ] **Step 2: Reemplazar el contenido del Tab Calendario**

Reemplazar el bloque `{tab === 'calendario' && (` completo con esta versión enriquecida:

```tsx
{tab === 'calendario' && (
  <div className="space-y-4">
    <div className="overflow-x-auto -mx-4 sm:-mx-6">
      <table className="tabla min-w-full">
        <thead>
          <tr>
            <th className="w-12 text-center">#</th>
            <th>Fecha</th>
            <th className="text-right">Esperado</th>
            <th className="text-right">Recibido</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {calendario.map((pago) => {
            const vencido = esVencido(pago.fechaProgramada, pago.estado)
            const pagoRegistrado = pagosHistorial.find(
              (p) => p.numeroPago === pago.numeroPago
            )

            let rowClass = ''
            if (pago.estado === 'ADELANTADO')    rowClass = 'bg-green-50'
            else if (pago.estado === 'PAGADO')   rowClass = 'bg-green-50/60'
            else if (pago.estado === 'PARCIAL')  rowClass = 'bg-amber-50'
            else if (pago.estado === 'NO_PAGADO') rowClass = 'bg-red-50'
            else if (vencido)                   rowClass = 'bg-red-50'

            let badgeCls = ''
            let badgeLabel = ''
            if (pago.estado === 'ADELANTADO') {
              badgeCls = 'bg-green-100 text-green-800'
              badgeLabel = 'Adelantado ✓'
            } else if (pago.estado === 'PAGADO') {
              badgeCls = 'bg-green-100 text-green-700'
              badgeLabel = 'Pagado'
            } else if (pago.estado === 'PARCIAL') {
              badgeCls = 'bg-amber-100 text-amber-800'
              badgeLabel = 'Parcial'
            } else if (pago.estado === 'NO_PAGADO') {
              badgeCls = 'bg-red-100 text-red-800'
              badgeLabel = 'No pagó'
            } else if (vencido) {
              badgeCls = 'bg-red-100 text-red-800'
              badgeLabel = 'Vencido'
            } else if (pago.estado === 'INHABILL' || pago.estado === 'INHABIL') {
              badgeCls = 'bg-gray-100 text-gray-500'
              badgeLabel = 'Inhábil'
            } else {
              badgeCls = 'bg-gray-100 text-gray-600'
              badgeLabel = 'Pendiente'
            }

            const tieneRegistro = ['PAGADO', 'PARCIAL', 'NO_PAGADO', 'ADELANTADO'].includes(pago.estado)

            return (
              <tr key={pago.id} className={rowClass}>
                <td className="text-center font-mono text-sm">{pago.numeroPago}</td>
                <td className="text-sm">{fmtDate(pago.fechaProgramada)}</td>
                <td className="text-right font-mono text-sm">{fmtMoney(pago.montoEsperado)}</td>
                <td className="text-right font-mono text-sm">
                  {pagoRegistrado
                    ? pagoRegistrado.razonNoPago
                      ? <span className="text-[#dc2626] italic text-xs">No pagó</span>
                      : fmtMoney(pagoRegistrado.montoRecibido)
                    : <span className="text-gray-400">—</span>
                  }
                </td>
                <td>
                  <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${badgeCls}`}>
                    {badgeLabel}
                  </span>
                </td>
                <td>
                  <div className="flex gap-1.5">
                    {tieneRegistro && pagoRegistrado && (
                      <button
                        type="button"
                        className="btn btn-sm text-xs py-0.5 px-2"
                        onClick={() => setPagoModal(pagoRegistrado)}
                      >
                        Ver pago
                      </button>
                    )}
                    {tieneRegistro && pagoRegistrado && esAdminSupervisor && (
                      <button
                        type="button"
                        className="btn btn-sm text-xs py-0.5 px-2"
                        onClick={() => setPagoEditar(pagoRegistrado)}
                      >
                        Modificar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>

    {/* Footer del calendario — estadísticas enriquecidas */}
    {(() => {
      const pagadosCount = calendario.filter(
        (p) => p.estado === 'PAGADO' || p.estado === 'ADELANTADO'
      ).length
      const parcialesCount = calendario.filter((p) => p.estado === 'PARCIAL').length
      const noPagaronCount = calendario.filter((p) => p.estado === 'NO_PAGADO').length
      const vencidosCount  = calendario.filter(
        (p) => p.estado === 'PENDIENTE' && p.fechaProgramada != null && new Date(p.fechaProgramada) < hoy
      ).length
      const pendientesCount = calendario.filter(
        (p) => p.estado === 'PENDIENTE' && p.fechaProgramada != null && new Date(p.fechaProgramada) >= hoy
      ).length
      const totalCobrado2 = pagosHistorial.reduce(
        (sum, p) => sum + (p.razonNoPago ? 0 : Number(p.montoRecibido)), 0
      )
      const multasPend = stats.multasPendientes

      return (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
            <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-[#16a34a]">{pagadosCount}</div>
              <div className="text-[11px] text-gray-500">Pagados</div>
            </div>
            <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-amber-600">{parcialesCount}</div>
              <div className="text-[11px] text-gray-500">Parciales</div>
            </div>
            <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${noPagaronCount > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
                {noPagaronCount}
              </div>
              <div className="text-[11px] text-gray-500">No pagaron</div>
            </div>
            <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${vencidosCount > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
                {vencidosCount}
              </div>
              <div className="text-[11px] text-gray-500">Vencidos</div>
            </div>
            <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-[#212529]">{pendientesCount}</div>
              <div className="text-[11px] text-gray-500">Pendientes</div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 pt-1 text-sm">
            <span className="text-[#16a34a] font-semibold">
              Total cobrado: {fmtMoney(totalCobrado2)}
            </span>
            {multasPend > 0 && (
              <span className="text-[#dc2626] font-semibold">
                Multas pendientes: {fmtMoney(multasPend)}
              </span>
            )}
            <span className="text-gray-700 font-semibold">
              Saldo restante: {fmtMoney(saldoRestante)}
            </span>
          </div>
        </>
      )
    })()}
  </div>
)}
```

- [ ] **Step 3: Añadir Modal de detalle de pago al final del componente**

Justo antes del `</div>` final del return (antes del `<ImagePreviewModal>`), añadir:

```tsx
{/* Modal Ver pago */}
{pagoModal && (
  <div
    className="fixed inset-0 bg-black/50 z-[2000] flex items-end sm:items-center justify-center"
    onClick={(e) => { if (e.target === e.currentTarget) setPagoModal(null) }}
  >
    <div className="bg-white w-full sm:w-[440px] sm:max-w-[95vw] rounded-t-2xl sm:rounded-xl shadow-2xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9ecef]">
        <div>
          <h2 className="text-[15px] font-semibold text-[#212529]">
            Detalle del pago #{pagoModal.numeroPago}
          </h2>
          <p className="text-[12px] text-[#6c757d] mt-0.5">{pagoModal.cliente.nombreCompleto}</p>
        </div>
        <button type="button" className="btn btn-sm p-1.5" onClick={() => setPagoModal(null)}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-5 py-5 space-y-3">
        {[
          ['Fecha',            fmtDate(pagoModal.fechaPago)],
          ['Monto esperado',   fmtMoney(pagoModal.montoEsperado)],
          ['Monto recibido',   pagoModal.razonNoPago ? 'No pagó' : fmtMoney(pagoModal.montoRecibido)],
          ['Modalidad',        pagoModal.modalidad],
          ['Razón no pago',    pagoModal.razonNoPago ?? '—'],
          ['Registrado por',   pagoModal.registradoPor?.nombreCompleto ?? '—'],
          ['Fecha de registro',fmtDate(pagoModal.createdAt)],
        ].map(([label, value]) => (
          <div key={label as string} className="flex justify-between text-[13px]">
            <span className="text-[#6c757d]">{label}</span>
            <span className="font-medium text-[#212529]">{value}</span>
          </div>
        ))}
        {pagoModal.modificadoPor && (
          <div className="pt-2 border-t border-[#f1f3f5]">
            <p className="text-[11px] text-[#adb5bd] italic">
              Modificado por {pagoModal.modificadoPor.nombreCompleto}
              {pagoModal.fechaModificacion
                ? ` el ${fmtDate(pagoModal.fechaModificacion.slice(0, 10))}`
                : ''}
            </p>
          </div>
        )}
      </div>
      <div className="border-t border-[#e9ecef] px-5 py-4">
        <button
          type="button"
          className="btn w-full py-2.5"
          onClick={() => setPagoModal(null)}
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
)}

{/* Modal Modificar pago */}
{pagoEditar && (
  <ModalModificarPago
    pago={pagoEditar}
    onClose={() => setPagoEditar(null)}
    onSuccess={() => {
      setPagoEditar(null)
      qc.invalidateQueries({ queryKey: ['pagos-cliente-credito', numId] })
      qc.invalidateQueries({ queryKey: ['credito', numId] })
    }}
  />
)}
```

**NOTA:** El import de `X` ya está en el archivo. Verificar que `ModalModificarPago` también esté importado.

- [ ] **Step 4: Verificar TypeScript y commit**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "CreditoDetallePage\|error" | head -20
git add frontend/src/pages/creditos/CreditoDetallePage.tsx
git commit -m "feat(credito): calendario enriquecido con monto recibido, acciones y modal de detalle"
```

---

## Task 5: Añadir "Últimos cobros" en ClienteDetallePage.tsx

**Files:**
- Modify: `frontend/src/pages/clientes/ClienteDetallePage.tsx`

En el tab `historial`, debajo de la tabla de créditos, añadir una sección con los últimos 10 pagos del cliente. Los datos vienen de `GET /api/cobros/cliente/{clienteId}` (ya existe en cobrosService como `getPagosPorCliente`).

- [ ] **Step 1: Añadir imports en ClienteDetallePage.tsx**

Añadir al bloque de imports:
```tsx
import { cobrosService } from '@/services/cobrosService'
```

- [ ] **Step 2: Añadir query de últimos cobros dentro del componente**

Dentro de `ClienteDetallePage`, después de la query `creditosData`, añadir:

```tsx
const { data: ultimosCobros = [] } = useQuery({
  queryKey: ['pagos-cliente', Number(id)],
  queryFn: () => cobrosService.getPagosPorCliente(Number(id)),
  enabled: !!id && tab === 'historial',
  staleTime: 30_000,
})
```

- [ ] **Step 3: Añadir sección "Últimos cobros" al final del tab historial**

En el tab `historial`, después del cierre de la tabla de créditos (`</div>`), añadir:

```tsx
{/* ── Últimos cobros ── */}
{ultimosCobros.length > 0 && (
  <div className="mt-5">
    <div className="flex items-center justify-between mb-2">
      <p className="text-[12px] font-semibold text-[#adb5bd] uppercase tracking-wide">
        Últimos cobros
      </p>
      <button
        type="button"
        className="btn btn-sm text-xs"
        onClick={() => navigate('/historial')}
      >
        Ver historial completo
      </button>
    </div>
    <div className="overflow-x-auto">
      <table className="tabla text-[12px]">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Pago #</th>
            <th className="text-right">Monto</th>
            <th>Estado</th>
            <th>Asesor</th>
          </tr>
        </thead>
        <tbody>
          {ultimosCobros.slice(0, 10).map((p) => {
            const estado = p.razonNoPago ? 'NO_PAGADO' : p.esCompleto ? 'PAGADO' : 'PARCIAL'
            return (
              <tr key={p.id}>
                <td className="text-[#6c757d]">
                  {new Date(p.fechaPago + 'T12:00:00').toLocaleDateString('es-MX', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </td>
                <td className="text-[#6c757d]">#{p.numeroPago}</td>
                <td className={`text-right font-semibold ${
                  estado === 'NO_PAGADO' ? 'text-[#dc2626]'
                  : estado === 'PAGADO'  ? 'text-[#2d6a4f]'
                  : 'text-[#f59e0b]'
                }`}>
                  {estado === 'NO_PAGADO' ? '—' : fmtMoney(p.montoRecibido)}
                </td>
                <td>
                  <span className={`badge ${
                    estado === 'NO_PAGADO' ? 'badge-rojo'
                    : estado === 'PAGADO'  ? 'badge-verde'
                    : 'badge-amarillo'
                  }`}>
                    {estado === 'NO_PAGADO' ? 'No pagó' : estado === 'PAGADO' ? 'Pagado' : 'Parcial'}
                  </span>
                </td>
                <td className="text-[#6c757d]">
                  {p.registradoPor?.nombreCompleto ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </div>
)}
```

**NOTA:** La función `fmtMoney` ya existe en el componente. Verificar que `navigate` también esté disponible (ya está importado via `useNavigate()`).

- [ ] **Step 4: Verificar y commit**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "ClienteDetallePage\|error" | head -20
git add frontend/src/pages/clientes/ClienteDetallePage.tsx
git commit -m "feat(clientes): añadir sección últimos cobros en tab historial"
```

---

## Task 6: Completar invalidaciones de cache en ModalRegistrarPago.tsx

**Files:**
- Modify: `frontend/src/components/cobros/ModalRegistrarPago.tsx`

Actualmente invalida: `ruta-dia`, `historial-cobros`, `multas-credito`.
Falta invalidar: `['credito', creditoId]` (para que CreditoDetallePage actualice su calendario) y `['creditos-cliente']` (para que ClienteDetallePage actualice la card del crédito activo) y `['pagos-cliente-credito']` y `['pagos-cliente']`.

- [ ] **Step 1: Actualizar el bloque onSuccess en ModalRegistrarPago.tsx**

Localizar el `onSuccess` en la mutación (línea ~82):

```tsx
onSuccess: () => {
  toast.success(noPago ? 'No pago registrado' : 'Pago registrado')
  qc.invalidateQueries({ queryKey: ['ruta-dia'] })
  qc.invalidateQueries({ queryKey: ['historial-cobros'] })
  qc.invalidateQueries({ queryKey: ['multas-credito', creditoId] })
  onSuccess()
  onClose()
},
```

Reemplazarlo por:

```tsx
onSuccess: () => {
  toast.success(noPago ? 'No pago registrado' : 'Pago registrado')
  qc.invalidateQueries({ queryKey: ['ruta-dia'] })
  qc.invalidateQueries({ queryKey: ['historial-cobros'] })
  qc.invalidateQueries({ queryKey: ['multas-credito', creditoId] })
  qc.invalidateQueries({ queryKey: ['credito', creditoId] })
  qc.invalidateQueries({ queryKey: ['creditos-cliente'] })
  qc.invalidateQueries({ queryKey: ['pagos-cliente-credito'] })
  qc.invalidateQueries({ queryKey: ['pagos-cliente'] })
  onSuccess()
  onClose()
},
```

- [ ] **Step 2: Verificar y commit**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -10
git add frontend/src/components/cobros/ModalRegistrarPago.tsx
git commit -m "fix(cobros): invalidar cache de credito, creditos-cliente y pagos al registrar pago"
```

---

## Task 7: Build final sin errores TypeScript

- [ ] **Step 1: Build completo**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Esperado: `✓ built in X.Xs` sin errores de TypeScript ni de módulos faltantes.

- [ ] **Step 2: Si hay errores, corregirlos**

Errores comunes:
- `'X' is possibly undefined` → añadir null checks o optional chaining
- `Property 'X' does not exist on type 'Y'` → verificar que el tipo importado sea el correcto
- `Cannot find module '@/pages/Historial'` → verificar que el archivo fue creado con el nombre correcto

- [ ] **Step 3: Commit final si se hicieron correcciones**

```bash
git add -p  # revisar qué se modificó
git commit -m "fix(ts): corregir errores de TypeScript en build"
```

---

## Self-Review

### 1. Spec coverage

| Requisito | Tarea que lo implementa |
|-----------|------------------------|
| TabHistorialCobros: filtros completos | Task 1 |
| TabHistorialCobros: summary bar | Task 1 |
| TabHistorialCobros: tabla con Diferencia, Asesor, Registrado por | Task 1 |
| TabHistorialCobros: Ver cliente + Modificar (solo admin/sup) | Task 1 |
| TabHistorialCobros: mobile cards mejoradas | Task 1 |
| Historial.tsx: asesor selector + date nav | Task 2 |
| Historial.tsx: resumen header | Task 2 |
| Historial.tsx: tabla control con sticky col | Task 2 |
| Historial.tsx: símbolos ✓/✗/$/./-/A | Task 2 |
| Historial.tsx: celda del día con borde azul | Task 2 |
| Historial.tsx: tooltip NO_PAGADO | Task 2 (parcial — ver nota abajo) |
| App.tsx: ruta /historial | Task 3 |
| CreditoDetallePage: col Monto recibido | Task 4 |
| CreditoDetallePage: col Acciones | Task 4 |
| CreditoDetallePage: modal Ver pago | Task 4 |
| CreditoDetallePage: Modificar (solo admin/sup) | Task 4 |
| CreditoDetallePage: summary enriquecido | Task 4 |
| ClienteDetallePage: sección Últimos cobros | Task 5 |
| ClienteDetallePage: btn Ver historial completo | Task 5 |
| Cache invalidation completa | Task 6 |

**Nota sobre tooltip de NO_PAGADO en Historial.tsx:** El CalendarioPagoDetalle no incluye `razonNoPago`. Para mostrar la razón real, se necesitaría cruzar con los PagoCobroDTO. En la implementación actual, el tooltip muestra "No pagó" genérico. Esto es aceptable para MVP — si en el futuro se quiere la razón exacta, se añade un endpoint específico o se enriquece el CalendarioPagoDetalle en el backend.

### 2. Placeholder scan

- Todos los pasos tienen código completo — sin "TBD" ni "implementar después".
- Los comandos son exactos.
- Los tipos referenciados (`PagoCobroDTO`, `CalendarioPagoDetalle`, `CreditoDetalle`) están definidos en `@/types`.

### 3. Type consistency

- `pagosHistorial` en Task 4 es `PagoCobroDTO[]` — los métodos usados (`.numeroPago`, `.montoRecibido`, `.razonNoPago`, `.modificadoPor`, `.fechaModificacion`) coinciden con la interfaz `PagoCobroDTO` en `@/types/index.ts`.
- `CalendarioPagoDetalle.estado` es `EstadoPago` — los casos INHABILL/INHABIL están cubiertos.
- `useQueries` en Task 2 es la API de React Query v5.
- `creditoService.obtener(creditoId)` devuelve `CreditoDetalle` que tiene `calendario: CalendarioPagoDetalle[]` — confirmado en los tipos.
