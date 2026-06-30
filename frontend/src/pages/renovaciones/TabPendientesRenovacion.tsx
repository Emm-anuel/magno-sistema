import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Building2,
  User,
  Calendar,
  ExternalLink,
} from 'lucide-react'
import { renovacionService } from '@/services/renovacionService'
import type { RenovacionDetalle, MultaItem } from '@/types'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Rechazo modal ─────────────────────────────────────────────────────────────

interface RechazarModalProps {
  cliente: string
  onConfirm: (motivo: string) => void
  onCancel: () => void
  loading: boolean
}

function RechazarModal({ cliente, onConfirm, onCancel, loading }: RechazarModalProps) {
  const [motivo, setMotivo] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Rechazar solicitud</h3>
            <p className="text-sm text-gray-500">{cliente}</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Motivo del rechazo
            <span className="ml-1 text-gray-400 font-normal">(opcional — el asesor lo verá)</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Describe el motivo para que el asesor pueda corregirlo..."
            className="input w-full resize-none"
            autoFocus
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn flex-1" disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(motivo.trim())}
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Rechazando…' : 'Confirmar rechazo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Barra de progreso de pagos ────────────────────────────────────────────────

function BarraProgreso({ cumplidos, total }: { cumplidos: number; total: number }) {
  const pct = total > 0 ? Math.round((cumplidos / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">Pagos cumplidos</span>
        <span className="font-semibold text-gray-700">{cumplidos} de {total}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#3d6b35] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Tarjeta principal ─────────────────────────────────────────────────────────

interface TarjetaProps {
  renovacion: RenovacionDetalle
  dismissing: boolean
  montoAprobadoStr: string
  onMontoAprobadoChange: (val: string) => void
  montoDesembolsoCalculado: number | null
  calculandoMonto: boolean
  onAprobar: () => void
  onRechazar: () => void
  loadingAprobar: boolean
  loadingRechazar: boolean
  multasList: MultaItem[]
  multasSeleccionadas: Set<number>
  onToggleMulta: (multaId: number) => void
  motivoCondonacion: string
  onMotivoChange: (val: string) => void
}

function TarjetaPendiente({
  renovacion: r,
  dismissing,
  montoAprobadoStr,
  onMontoAprobadoChange,
  montoDesembolsoCalculado,
  calculandoMonto,
  onAprobar,
  onRechazar,
  loadingAprobar,
  loadingRechazar,
  multasList,
  multasSeleccionadas,
  onToggleMulta,
  motivoCondonacion,
  onMotivoChange,
}: TarjetaProps) {
  const totalPagos = r.creditoAnterior.plazoDias
  const pagosCumplidos = totalPagos - r.pagosRestantes
  const tieneMultas = Number(r.multasPendientes) > 0

  // Calcular monto a condonar y a descontar
  const aCondonar = multasList
    .filter(m => multasSeleccionadas.has(m.id))
    .reduce((s, m) => s + Number(m.monto), 0)
  const aDescontar = Number(r.multasPendientes) - aCondonar

  return (
    <div
      className={`card overflow-hidden transition-all duration-300 ease-in-out ${
        dismissing ? 'opacity-0 scale-95 -translate-y-1 pointer-events-none' : ''
      }`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-base truncate">{r.cliente.nombreCompleto}</h3>
            <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5">
              Renovación
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 flex-shrink-0" />
              {r.asesor.nombreCompleto}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3 flex-shrink-0" />
              {r.asesor.sucursalNombre}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              Solicitada {fmtDateTime(r.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Cuerpo ─────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Zona izquierda — contexto del crédito actual */}
        <div className="space-y-4">
          <BarraProgreso cumplidos={pagosCumplidos} total={totalPagos} />

          {tieneMultas ? (
            <div className="space-y-2">
              {/* Header alert */}
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-700">Multas pendientes</p>
                  <p className="text-sm font-bold text-red-600">{fmt(r.multasPendientes)}</p>
                </div>
              </div>

              {/* Individual multa checkboxes */}
              {multasList.length > 0 && (
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {multasList.map(m => (
                    <label key={m.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-[#3d6b35]"
                        checked={multasSeleccionadas.has(m.id)}
                        onChange={() => onToggleMulta(m.id)}
                      />
                      <span className="text-xs text-gray-500 flex-1">
                        {m.tipo === 'NO_PAGO' ? 'No pagó' : 'Pago incompleto'} · {m.fecha}
                      </span>
                      <span className={`text-xs font-semibold tabular-nums ${
                        multasSeleccionadas.has(m.id)
                          ? 'line-through text-gray-400' : 'text-red-600'
                      }`}>
                        {fmt(m.monto)}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {/* Motivo field — only shows when ≥1 multa selected */}
              {multasSeleccionadas.size > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Motivo de condonación <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={motivoCondonacion}
                    onChange={e => onMotivoChange(e.target.value)}
                    rows={2}
                    placeholder="Ej: Cliente con historial limpio…"
                    className="input w-full resize-none text-xs"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="text-xs text-gray-500">Sin multas pendientes</p>
            </div>
          )}

          {r.garantiaDescripcion && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Garantía material</p>
              <p className="text-sm text-gray-700">{r.garantiaDescripcion}</p>
            </div>
          )}
        </div>

        {/* Zona derecha — números y monto aprobado editable */}
        <div className="space-y-3">
          {/* Comparación crédito anterior vs solicitado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
              <p className="text-xs text-gray-400 mb-0.5">Crédito anterior</p>
              <p className="text-base font-bold text-gray-700">{fmt(r.creditoAnterior.montoCapital)}</p>
              <p className="text-xs text-gray-400">{r.creditoAnterior.plazoDias} días</p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
              <p className="text-xs text-gray-400 mb-0.5">Monto solicitado</p>
              <p className="text-base font-bold text-gray-500">{fmt(r.montoNuevo)}</p>
              <p className="text-xs text-gray-400">{r.tipoPago === 'DIARIO' ? 'Diario' : 'Semanal'}</p>
            </div>
          </div>

          {/* Monto aprobado — editable inline */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Monto Aprobado
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min={1000}
                step={500}
                value={montoAprobadoStr}
                onChange={(e) => onMontoAprobadoChange(e.target.value)}
                className="input pl-7 w-full text-sm"
                placeholder={String(r.montoNuevo)}
              />
            </div>
          </div>

          {/* Pagos restantes */}
          <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
            <span className="text-gray-500">Pagos restantes</span>
            <span className="font-medium text-gray-700">
              {r.pagosRestantes} pago{r.pagosRestantes !== 1 ? 's' : ''} · {fmt(r.montoPagosRestantes)}
            </span>
          </div>

          {/* Multas — desglose dinámico */}
          {tieneMultas && (
            <div className="space-y-1 border-t border-gray-100 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Multas pendientes</span>
                <span className="font-medium text-red-500">{fmt(r.multasPendientes)}</span>
              </div>
              {multasSeleccionadas.size > 0 ? (
                <>
                  <div className="flex items-center justify-between text-xs pl-3">
                    <span className="text-green-600">└ A condonar</span>
                    <span className="text-green-600 font-medium">−{fmt(aCondonar)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pl-3">
                    <span className="text-gray-500">└ A descontar</span>
                    <span className="font-medium text-gray-700">{fmt(aDescontar)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-xs pl-3">
                  <span className="text-gray-400">└ A descontar</span>
                  <span className="font-semibold text-red-500">{fmt(r.multasPendientes)}</span>
                </div>
              )}
            </div>
          )}

          {/* Monto a desembolsar — recalculado en tiempo real */}
          <div className="rounded-xl bg-white border-2 border-[#3d6b35]/30 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">Monto a desembolsar</span>
            {calculandoMonto ? (
              <span className="w-5 h-5 border-2 border-[#3d6b35] border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className={`text-xl font-extrabold tabular-nums ${
                ((montoDesembolsoCalculado ?? Number(r.montoDesembolso)) + aCondonar) >= 0
                  ? 'text-[#3d6b35]'
                  : 'text-red-600'
              }`}>
                {fmt((montoDesembolsoCalculado ?? Number(r.montoDesembolso)) + aCondonar)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer — acciones ──────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onAprobar}
          disabled={loadingAprobar || loadingRechazar}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          Aprobar
        </button>
        <button
          type="button"
          onClick={onRechazar}
          disabled={loadingAprobar || loadingRechazar}
          className="btn flex items-center gap-2 px-5 py-2.5 text-sm text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" />
          Rechazar
        </button>
        <Link
          to={`/clientes/${r.cliente.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#3d6b35] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Ver historial del cliente
        </Link>
      </div>
    </div>
  )
}

// ── Tab principal ─────────────────────────────────────────────────────────────

export default function TabPendientesRenovacion() {
  const queryClient = useQueryClient()
  const [rechazandoId, setRechazandoId] = useState<number | null>(null)
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(new Set())
  const [montosAprobados, setMontosAprobados] = useState<Record<number, string>>({})
  const [calculos, setCalculos] = useState<Record<number, { desembolso: number; loading: boolean }>>({})
  const calcTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  // ── Estado de condonación por renovación ──────────────────────────────────
  const [multasSeleccionadas, setMultasSeleccionadas] = useState<Map<number, Set<number>>>(new Map())
  const [motivoCondonacion, setMotivoCondonacion] = useState<Map<number, string>>(new Map())

  function handleMontoChange(renovacionId: number, creditoAnteriorId: number, val: string) {
    setMontosAprobados((prev) => ({ ...prev, [renovacionId]: val }))
    if (calcTimers.current[renovacionId]) clearTimeout(calcTimers.current[renovacionId])
    const num = parseFloat(val)
    if (!Number.isFinite(num) || num < 1000) {
      setCalculos((prev) => {
        const next = { ...prev }
        delete next[renovacionId]
        return next
      })
      return
    }
    setCalculos((prev) => ({ ...prev, [renovacionId]: { ...prev[renovacionId], loading: true } }))
    calcTimers.current[renovacionId] = setTimeout(async () => {
      try {
        const result = await renovacionService.calcular(creditoAnteriorId, num)
        setCalculos((prev) => ({
          ...prev,
          [renovacionId]: { desembolso: result.montoDesembolso, loading: false },
        }))
      } catch {
        setCalculos((prev) => ({ ...prev, [renovacionId]: { ...prev[renovacionId], loading: false } }))
      }
    }, 400)
  }

  const { data: pendientes = [], isLoading, isError } = useQuery({
    queryKey: ['renovaciones-pendientes'],
    queryFn: () => renovacionService.getPendientes(),
    select: (data) => [...data].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
  })

  // ── Multas pendientes para todas las renovaciones en cola ─────────────────
  const { data: multasMap = {} } = useQuery({
    queryKey: ['multas-pendientes-renovaciones', pendientes.map(r => r.id)],
    queryFn: async () => {
      if (!pendientes.length) return {}
      const entries = await Promise.all(
        pendientes.map(r =>
          renovacionService.getMultasPendientes(r.id).then(m => [r.id, m] as const)
        )
      )
      return Object.fromEntries(entries) as Record<number, MultaItem[]>
    },
    enabled: pendientes.length > 0,
  })

  function handleToggleMulta(renovacionId: number, multaId: number) {
    setMultasSeleccionadas(prev => {
      const next = new Map(prev)
      const s = new Set(next.get(renovacionId) ?? [])
      if (s.has(multaId)) s.delete(multaId); else s.add(multaId)
      next.set(renovacionId, s)
      return next
    })
  }

  function handleMotivoChange(renovacionId: number, val: string) {
    setMotivoCondonacion(prev => {
      const next = new Map(prev)
      next.set(renovacionId, val)
      return next
    })
  }

  function dismissAndRefresh(id: number, callback?: () => void) {
    setDismissingIds((prev) => new Set([...prev, id]))
    setTimeout(() => {
      callback?.()
      queryClient.invalidateQueries({ queryKey: ['renovaciones-pendientes'] })
      queryClient.invalidateQueries({ queryKey: ['renovaciones-pendientes-desembolso'] })
      queryClient.invalidateQueries({ queryKey: ['creditos'] })
    }, 320)
  }

  const aprobarMutation = useMutation({
    mutationFn: (renovacionId: number) => {
      const montoStr = montosAprobados[renovacionId]
      const monto = montoStr ? parseFloat(montoStr) : undefined
      const seleccionadas = multasSeleccionadas.get(renovacionId)
      const motivo = motivoCondonacion.get(renovacionId)
      return renovacionService.aprobar(renovacionId, {
        montoAprobado: Number.isFinite(monto) ? monto : undefined,
        multasCondonadasIds: seleccionadas && seleccionadas.size > 0 ? Array.from(seleccionadas) : undefined,
        motivoCondonacion: motivo?.trim() || undefined,
      })
    },
    onSuccess: (_data, id) => {
      toast.success('Solicitud aprobada — pendiente de confirmación del desembolso')
      dismissAndRefresh(id)
    },
    onError: (err: any) => toast.error(err?.message ?? 'Error al aprobar'),
  })

  const rechazarMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      renovacionService.rechazar(id, motivo),
    onSuccess: (_, { id }) => {
      toast.success('Solicitud rechazada')
      setRechazandoId(null)
      dismissAndRefresh(id)
    },
    onError: (err: any) => toast.error(err?.message ?? 'Error al rechazar'),
  })

  const renovacionRechazando = pendientes.find((r) => r.id === rechazandoId)

  if (isLoading) {
    return (
      <div className="card p-10 text-center text-gray-500">
        Cargando solicitudes…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card p-10 text-center text-red-600">
        Error al cargar solicitudes. Recarga la página.
      </div>
    )
  }

  if (pendientes.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-green-500" />
        </div>
        <p className="font-semibold text-gray-700">No hay solicitudes pendientes</p>
        <p className="text-sm text-gray-400 mt-1">Todas las renovaciones han sido revisadas</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {pendientes.length} solicitud{pendientes.length !== 1 ? 'es' : ''} pendiente{pendientes.length !== 1 ? 's' : ''} — ordenadas por antigüedad
      </p>

      <div className="space-y-4">
        {pendientes.map((r) => (
          <TarjetaPendiente
            key={r.id}
            renovacion={r}
            dismissing={dismissingIds.has(r.id)}
            montoAprobadoStr={montosAprobados[r.id] ?? String(r.montoNuevo)}
            onMontoAprobadoChange={(val) => handleMontoChange(r.id, r.creditoAnterior.id, val)}
            montoDesembolsoCalculado={calculos[r.id]?.desembolso ?? null}
            calculandoMonto={calculos[r.id]?.loading ?? false}
            onAprobar={() => aprobarMutation.mutate(r.id)}
            onRechazar={() => setRechazandoId(r.id)}
            loadingAprobar={aprobarMutation.isPending}
            loadingRechazar={rechazarMutation.isPending}
            multasList={multasMap[r.id] ?? []}
            multasSeleccionadas={multasSeleccionadas.get(r.id) ?? new Set()}
            onToggleMulta={(multaId) => handleToggleMulta(r.id, multaId)}
            motivoCondonacion={motivoCondonacion.get(r.id) ?? ''}
            onMotivoChange={(val) => handleMotivoChange(r.id, val)}
          />
        ))}
      </div>

      {renovacionRechazando && (
        <RechazarModal
          cliente={renovacionRechazando.cliente.nombreCompleto}
          onConfirm={(motivo) =>
            rechazarMutation.mutate({ id: renovacionRechazando.id, motivo })
          }
          onCancel={() => setRechazandoId(null)}
          loading={rechazarMutation.isPending}
        />
      )}
    </div>
  )
}
