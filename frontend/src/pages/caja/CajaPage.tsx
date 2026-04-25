import { useState, useEffect, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { CheckCircle, Plus, Trash2, ArrowRight, History, Download, RotateCcw } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { cajaService } from '@/services/cajaService'
import { adminService } from '@/services/adminService'
import { cobrosService } from '@/services/cobrosService'
import { api } from '@/services/api'
import { todayLocalStr } from '@/utils/date'

// ── Helpers ────────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

// ── Schemas ────────────────────────────────────────────────────────────

const abrirSchema = z.object({
  montoApertura:    z.coerce.number().min(0, 'Ingresa el monto de apertura'),
  conceptoApertura: z.string().optional(),
})

const movSchema = z.object({
  conceptoInversionId: z.coerce.number().min(1, 'Selecciona un concepto'),
  descripcion:         z.string().optional(),
  monto:               z.coerce.number().refine(v => v !== 0, 'El monto no puede ser cero'),
})

type AbrirForm = z.infer<typeof abrirSchema>
type MovForm   = z.infer<typeof movSchema>

// ── Component ──────────────────────────────────────────────────────────

export default function CajaPage() {
  const { usuario } = useAuthStore()
  const queryClient = useQueryClient()
  const navigate    = useNavigate()
  const isAdmin     = usuario?.rol === 'ADMINISTRADOR'

  // Sucursal efectiva
  const [adminSucursalId, setAdminSucursalId] = useState<number | null>(null)
  const efectivaSucursalId: number | undefined = isAdmin
    ? (adminSucursalId ?? undefined)
    : usuario?.sucursal?.id

  // Fetch lista de sucursales (solo admin)
  const { data: sucursales = [] } = useQuery({
    queryKey: ['sucursales-lista'],
    queryFn: () => api.get<{ id: number; nombre: string }[]>('/sucursales').then(r => r.data),
    enabled: isAdmin,
    staleTime: 300_000,
  })

  useEffect(() => {
    if (isAdmin && sucursales.length > 0 && adminSucursalId === null) {
      setAdminSucursalId(sucursales[0].id)
    }
  }, [isAdmin, sucursales, adminSucursalId])

  // Fetch estado de caja
  const { data: estado, isLoading: loadingEstado } = useQuery({
    queryKey: ['caja-estado', efectivaSucursalId],
    queryFn: () => cajaService.getEstado(efectivaSucursalId),
    enabled: efectivaSucursalId !== undefined,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const cajaId      = estado?.cajaId ?? null
  const cajaAbierta = estado?.estado === 'ABIERTA' && cajaId != null

  // Fetch inversiones (solo cuando hay caja abierta)
  const { data: inversiones = [], isLoading: loadingInv } = useQuery({
    queryKey: ['caja-inversiones', cajaId],
    queryFn: () => cajaService.getInversiones(cajaId!),
    enabled: cajaAbierta,
  })

  // Fetch conceptos de inversión
  const { data: conceptos = [] } = useQuery({
    queryKey: ['conceptos-inversion', efectivaSucursalId],
    queryFn: () => adminService.getConceptos(efectivaSucursalId!),
    enabled: efectivaSucursalId !== undefined,
    staleTime: 300_000,
  })

  // Fetch cobros del día (resumen por asesor)
  const { data: rutaDia } = useQuery({
    queryKey: ['caja-ruta-dia', efectivaSucursalId],
    queryFn: () => cobrosService.getRutaDia({ sucursalId: efectivaSucursalId, fecha: todayLocalStr() }),
    enabled: cajaAbierta,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  // Cobros agrupados por asesor
  const cobrosPorAsesor = useMemo(() => {
    const clientes = rutaDia?.clientes ?? []
    const map = new Map<string, { pagados: number; monto: number }>()
    for (const c of clientes) {
      const nombre = c.asesorNombre ?? 'Sin asesor'
      const entry  = map.get(nombre) ?? { pagados: 0, monto: 0 }
      if (c.estadoHoy === 'PAGADO' || c.estadoHoy === 'PARCIAL') {
        entry.pagados++
        entry.monto += c.montoRecibidoHoy ?? 0
      }
      map.set(nombre, entry)
    }
    return Array.from(map.entries())
      .map(([nombre, data]) => ({ nombre, ...data }))
      .sort((a, b) => b.monto - a.monto)
  }, [rutaDia])

  // ── Mutations ──────────────────────────────────────────────────────────

  const abrirMut = useMutation({
    mutationFn: (data: AbrirForm) =>
      cajaService.abrir({
        montoApertura:    data.montoApertura,
        conceptoApertura: data.conceptoApertura || undefined,
        sucursalId:       efectivaSucursalId,
      }),
    onSuccess: () => {
      toast.success('Caja abierta correctamente')
      queryClient.invalidateQueries({ queryKey: ['caja-estado'] })
      queryClient.invalidateQueries({ queryKey: ['caja-estado-operativa'] })
    },
    onError: (err: any) => toast.error(err.message ?? 'Error al abrir la caja'),
  })

  const agregarMut = useMutation({
    mutationFn: (data: MovForm) =>
      cajaService.agregarInversion(cajaId!, {
        conceptoInversionId: data.conceptoInversionId,
        descripcion:         data.descripcion || undefined,
        monto:               data.monto,
      }),
    onSuccess: () => {
      toast.success('Movimiento registrado')
      queryClient.invalidateQueries({ queryKey: ['caja-inversiones', cajaId] })
      movForm.reset()
      setShowMovForm(false)
    },
    onError: (err: any) => toast.error(err.message ?? 'Error al agregar movimiento'),
  })

  const eliminarMut = useMutation({
    mutationFn: (movimientoId: number) =>
      cajaService.eliminarInversion(cajaId!, movimientoId),
    onSuccess: () => {
      toast.success('Movimiento eliminado')
      queryClient.invalidateQueries({ queryKey: ['caja-inversiones', cajaId] })
    },
    onError: (err: any) => toast.error(err.message ?? 'Error al eliminar movimiento'),
  })

  const cancelarCorteMut = useMutation({
    mutationFn: (targetCajaId: number) => cajaService.cancelarCorte(targetCajaId),
    onSuccess: (_, targetCajaId) => {
      if (selectedCajaId === targetCajaId) {
        setSelectedCajaId(null)
      }
      toast.success('Corte de caja cancelado correctamente')
      queryClient.invalidateQueries({ queryKey: ['caja-historial-lista'] })
      queryClient.invalidateQueries({ queryKey: ['caja-historial-detalle'] })
      queryClient.invalidateQueries({ queryKey: ['caja-estado'] })
      queryClient.invalidateQueries({ queryKey: ['caja-estado-operativa'] })
    },
    onError: (err: any) => toast.error(err.message ?? 'No se pudo cancelar el corte de caja'),
  })

  // ── Forms ──────────────────────────────────────────────────────────────

  const abrirForm = useForm<AbrirForm>({ resolver: zodResolver(abrirSchema) })
  const movForm   = useForm<MovForm>({ resolver: zodResolver(movSchema) })
  const [showMovForm, setShowMovForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'operativa' | 'historial'>('operativa')

  // ── Historial state ────────────────────────────────────────────────────

  const [histDesde, setHistDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [histHasta, setHistHasta] = useState(todayLocalStr())
  const [selectedCajaId, setSelectedCajaId] = useState<number | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  const { data: historialLista = [], isLoading: loadingHist } = useQuery({
    queryKey: ['caja-historial-lista', efectivaSucursalId, histDesde, histHasta],
    queryFn: () => cajaService.getHistorialLista({
      sucursalId: efectivaSucursalId,
      desde: histDesde,
      hasta: histHasta,
    }),
    enabled: activeTab === 'historial' && efectivaSucursalId !== undefined,
    staleTime: 60_000,
  })

  const { data: histDetalle } = useQuery({
    queryKey: ['caja-historial-detalle', selectedCajaId],
    queryFn: () => {
      const found = historialLista.find(h => h.id === selectedCajaId)
      return found ? cajaService.getHistorial(found.fecha, efectivaSucursalId) : null
    },
    enabled: selectedCajaId !== null && historialLista.length > 0,
    staleTime: 300_000,
  })

  async function handleExportHistPdf(cajaId: number, fecha: string) {
    setExportingPdf(true)
    try {
      await cajaService.exportarPdf(cajaId, fecha)
    } catch {
      toast.error('Error al generar el PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  function fmtDate(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  const hoy = todayLocalStr()

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-10">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#212529]">Caja</h1>
          <p className="text-[13px] text-[#6c757d] mt-0.5">Apertura y cierre de caja diaria</p>
        </div>
        {isAdmin && sucursales.length > 0 && (
          <select
            className="input text-sm py-1.5 w-52"
            value={adminSucursalId ?? ''}
            onChange={e => setAdminSucursalId(Number(e.target.value))}
          >
            {sucursales.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#dee2e6]">
        {(['operativa', 'historial'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-[#0d6efd] text-[#0d6efd]'
                : 'border-transparent text-[#6c757d] hover:text-[#495057]'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'operativa' ? 'Operativa' : (
              <span className="flex items-center gap-1">
                <History className="w-3.5 h-3.5" />
                Historial
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB HISTORIAL ─────────────────────────────────────────── */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[12px] font-medium text-[#495057] mb-1">Desde</label>
              <input
                type="date"
                className="input text-sm py-1.5"
                value={histDesde}
                onChange={e => { setHistDesde(e.target.value); setSelectedCajaId(null) }}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#495057] mb-1">Hasta</label>
              <input
                type="date"
                className="input text-sm py-1.5"
                value={histHasta}
                onChange={e => { setHistHasta(e.target.value); setSelectedCajaId(null) }}
              />
            </div>
          </div>

          {/* Lista de cierres */}
          {loadingHist ? (
            <p className="text-[13px] text-[#6c757d]">Cargando historial…</p>
          ) : historialLista.length === 0 ? (
            <p className="text-[13px] text-[#adb5bd] text-center py-6">
              Sin cajas registradas en el período seleccionado
            </p>
          ) : (
            <div className="card">
              <div className="card-body p-0">
                <div className="overflow-x-auto">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Estado</th>
                        <th>Cerrada por</th>
                        <th className="text-right">Subtotal</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialLista.map(h => {
                        const puedeCancelarCorte =
                          isAdmin && h.estado === 'CERRADA' && h.fecha === hoy

                        return (
                        <Fragment key={h.id}>
                          <tr
                            className={`cursor-pointer hover:bg-[#f8f9fa] ${selectedCajaId === h.id ? 'bg-[#f0f7ff]' : ''}`}
                            onClick={() => setSelectedCajaId(selectedCajaId === h.id ? null : h.id)}
                          >
                            <td className="font-medium">{fmtDate(h.fecha)}</td>
                            <td>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                h.estado === 'CERRADA'
                                  ? 'bg-[#f8d7da] text-[#842029]'
                                  : h.estado === 'ABIERTA'
                                  ? 'bg-[#d1fae5] text-[#065f46]'
                                  : 'bg-[#fef3c7] text-[#92400e]'
                              }`}>
                                {h.estado === 'CERRADA' ? 'Cerrada' : h.estado === 'ABIERTA' ? 'Abierta' : 'Cancelada'}
                              </span>
                            </td>
                            <td className="text-[#6c757d]">{h.cerradaPorNombre ?? '—'}</td>
                            <td className="text-right font-mono">{fmtMoney(h.subtotalCaja)}</td>
                            <td>
                              <div className="flex items-center justify-end gap-2">
                                {h.estado === 'CERRADA' && (
                                  <button
                                    type="button"
                                    title="Exportar PDF"
                                    className="text-[#adb5bd] hover:text-[#0d6efd] transition-colors"
                                    onClick={e => { e.stopPropagation(); handleExportHistPdf(h.id, h.fecha) }}
                                    disabled={exportingPdf}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                )}
                                {puedeCancelarCorte && (
                                  <button
                                    type="button"
                                    title="Cancelar corte"
                                    className="text-[#adb5bd] hover:text-[#dc2626] transition-colors"
                                    onClick={e => {
                                      e.stopPropagation()
                                      if (window.confirm('¿Cancelar el corte de caja de hoy? La caja volverá a estado abierta.')) {
                                        cancelarCorteMut.mutate(h.id)
                                      }
                                    }}
                                    disabled={cancelarCorteMut.isPending}
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {/* Detalle inline al hacer clic */}
                          {selectedCajaId === h.id && histDetalle && (
                            <tr>
                              <td colSpan={5} className="bg-[#f8f9fa] px-4 py-3">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12px]">
                                  <div>
                                    <span className="text-[#6c757d]">Ingreso carteras</span>
                                    <div className="font-mono font-medium">{fmtMoney(histDetalle.ingresoCarteras)}</div>
                                  </div>
                                  <div>
                                    <span className="text-[#6c757d]">Desembolsos</span>
                                    <div className="font-mono font-medium">{fmtMoney(histDetalle.desembolsos)}</div>
                                  </div>
                                  <div>
                                    <span className="text-[#6c757d]">Subtotal caja</span>
                                    <div className="font-mono font-semibold">{fmtMoney(histDetalle.subtotalCaja)}</div>
                                  </div>
                                  <div>
                                    <span className="text-[#6c757d]">Monto Libres</span>
                                    <div className="font-mono font-medium">{fmtMoney(histDetalle.montoLibres)}</div>
                                  </div>
                                  <div>
                                    <span className="text-[#6c757d]">Ahorro fijo</span>
                                    <div className="font-mono font-medium">{fmtMoney(histDetalle.ahorroFijo)}</div>
                                  </div>
                                  <div>
                                    <span className="text-[#6c757d]">Total Real Libres</span>
                                    <div className="font-mono font-semibold">{fmtMoney(histDetalle.totalRealLibres)}</div>
                                  </div>
                                </div>
                                {histDetalle.inversiones.length > 0 && (
                                  <div className="mt-3">
                                    <p className="text-[11px] font-semibold text-[#495057] mb-1">Movimientos de inversión</p>
                                    <table className="tabla text-[11px]">
                                      <thead>
                                        <tr>
                                          <th>Concepto</th>
                                          <th>Descripción</th>
                                          <th className="text-right">Monto</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {histDetalle.inversiones.map(m => (
                                          <tr key={m.id}>
                                            <td>{m.conceptoNombre}</td>
                                            <td className="text-[#6c757d]">{m.descripcion ?? '—'}</td>
                                            <td className={`text-right font-mono ${m.monto < 0 ? 'text-[#dc2626]' : ''}`}>
                                              {fmtMoney(m.monto)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB OPERATIVA ─────────────────────────────────────────── */}
      {activeTab === 'operativa' && (
        <>
      {/* Loading */}
      {loadingEstado && efectivaSucursalId !== undefined && (
        <p className="text-[13px] text-[#6c757d]">Cargando estado de caja...</p>
      )}

      {/* Sin sucursal seleccionada (admin) */}
      {isAdmin && efectivaSucursalId === undefined && !loadingEstado && (
        <p className="text-[13px] text-[#6c757d]">Cargando sucursales...</p>
      )}

      {/* ── ESTADO 1: Sin caja hoy — formulario de apertura ─────────── */}
      {!loadingEstado && efectivaSucursalId !== undefined && estado && estado.cajaId === null && (
        <div className="max-w-md">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Abrir Caja del Día</h2>
            </div>
            <div className="card-body">
              <p className="text-[12px] text-[#6c757d] mb-4">
                No hay caja registrada para hoy. Registra el fondo de apertura para habilitar las operaciones del día.
              </p>
              <form
                onSubmit={abrirForm.handleSubmit(d => abrirMut.mutate(d))}
                className="space-y-4"
              >
                <div>
                  <label className="block text-[12px] font-medium text-[#495057] mb-1">
                    Monto de apertura <span className="text-[#dc2626]">*</span>
                  </label>
                  <input
                    {...abrirForm.register('montoApertura')}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="input"
                  />
                  {abrirForm.formState.errors.montoApertura && (
                    <p className="mt-1 text-[11px] text-[#dc2626]">
                      {abrirForm.formState.errors.montoApertura.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#495057] mb-1">
                    Concepto
                  </label>
                  <input
                    {...abrirForm.register('conceptoApertura')}
                    type="text"
                    placeholder="Ej. Fondo inicial, efectivo en caja…"
                    className="input"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={abrirMut.isPending}
                >
                  {abrirMut.isPending ? 'Abriendo…' : 'Abrir Caja'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── ESTADO 2: Caja abierta ───────────────────────────────────── */}
      {cajaAbierta && estado && (
        <>
          {/* Status bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg">
            <CheckCircle className="w-5 h-5 text-[#16a34a] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#15803d]">Caja Abierta</p>
              <p className="text-[11px] text-[#166534]">
                Abierta por {estado.abiertaPorNombre ?? '—'}
                {estado.fechaHoraApertura ? ` · ${fmtTime(estado.fechaHoraApertura)}` : ''}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-danger flex items-center gap-1.5"
              onClick={() => navigate('/caja/cierre')}
            >
              Cerrar Caja
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Movimientos de inversión */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Movimientos de Inversión</h2>
              {!showMovForm && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowMovForm(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              )}
            </div>

            <div className="card-body space-y-4">
              {/* Formulario inline de nuevo movimiento */}
              {showMovForm && (
                <form
                  onSubmit={movForm.handleSubmit(d => agregarMut.mutate(d))}
                  className="p-3 bg-[#f8f9fa] rounded-lg border border-[#dee2e6] space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-[#495057] mb-1">
                        Concepto <span className="text-[#dc2626]">*</span>
                      </label>
                      <select {...movForm.register('conceptoInversionId')} className="input">
                        <option value="">Selecciona…</option>
                        {conceptos.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                      {movForm.formState.errors.conceptoInversionId && (
                        <p className="mt-1 text-[11px] text-[#dc2626]">
                          {movForm.formState.errors.conceptoInversionId.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#495057] mb-1">
                        Descripción
                      </label>
                      <input
                        {...movForm.register('descripcion')}
                        type="text"
                        placeholder="Opcional"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#495057] mb-1">
                        Monto <span className="text-[#dc2626]">*</span>
                      </label>
                      <input
                        {...movForm.register('monto')}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="input"
                      />
                      {movForm.formState.errors.monto && (
                        <p className="mt-1 text-[11px] text-[#dc2626]">
                          {movForm.formState.errors.monto.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => { setShowMovForm(false); movForm.reset() }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-sm btn-primary"
                      disabled={agregarMut.isPending}
                    >
                      {agregarMut.isPending ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </form>
              )}

              {/* Tabla de movimientos */}
              {loadingInv ? (
                <p className="text-[13px] text-[#6c757d]">Cargando…</p>
              ) : inversiones.length === 0 ? (
                <p className="text-[13px] text-[#adb5bd] text-center py-4">
                  Sin movimientos registrados
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Concepto</th>
                        <th>Descripción</th>
                        <th className="text-right">Monto</th>
                        <th>Registrado por</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {inversiones.map(m => (
                        <tr key={m.id}>
                          <td className="font-medium">{m.conceptoNombre}</td>
                          <td className="text-[#6c757d]">{m.descripcion ?? '—'}</td>
                          <td className={`text-right font-mono ${m.monto < 0 ? 'text-[#dc2626]' : ''}`}>
                            {fmtMoney(m.monto)}
                          </td>
                          <td className="text-[#6c757d]">{m.registradoPorNombre}</td>
                          <td>
                            <button
                              type="button"
                              className="text-[#adb5bd] hover:text-[#dc2626] transition-colors"
                              onClick={() => {
                                if (window.confirm('¿Eliminar este movimiento?')) {
                                  eliminarMut.mutate(m.id)
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Cobros del día */}
          {cobrosPorAsesor.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Cobros del Día</h2>
                <span className="text-[12px] text-[#6c757d]">
                  Total: {fmtMoney(cobrosPorAsesor.reduce((s, r) => s + r.monto, 0))}
                </span>
              </div>
              <div className="card-body">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th className="!text-center">Asesor</th>
                      <th className="!text-center">Cobrados</th>
                      <th className="!text-center">Total recibido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobrosPorAsesor.map(row => (
                      <tr key={row.nombre}>
                        <td className="text-center">{row.nombre}</td>
                        <td className="text-center">{row.pagados}</td>
                        <td className="text-center font-mono">{fmtMoney(row.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
        </>
      )}
    </div>
  )
}
