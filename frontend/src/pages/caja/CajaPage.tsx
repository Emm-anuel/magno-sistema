import { useState, useEffect, Fragment, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  History,
  RotateCcw,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { cajaService, type CajaCierrePreview, type CajaDiaDetalle, type NominaEstado } from '@/services/cajaService'
import { gastoService } from '@/services/gastoService'
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

function fmtPct(n: number) {
  return (n * 100).toFixed(1) + '%'
}

function extractIsoDate(message: string | undefined) {
  return message?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null
}

// ── Schemas ────────────────────────────────────────────────────────────

const abrirSchema = z.object({
  montoApertura:    z.coerce.number().min(0, 'Ingresa el monto de apertura'),
  conceptoApertura: z.string().optional(),
})

type AbrirForm = z.infer<typeof abrirSchema>
type TipoApertura = 'ANTERIOR' | 'MANUAL'

// ── Collapsible section ────────────────────────────────────────────────

function Section({
  title,
  badge,
  children,
  defaultOpen = true,
}: {
  title: string
  badge?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card">
      <button
        type="button"
        className="card-header w-full text-left flex items-center justify-between cursor-pointer"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          <h2 className="card-title">{title}</h2>
          {badge && <span className="text-[12px] text-[#6c757d] font-mono">{badge}</span>}
        </span>
        {open
          ? <ChevronUp className="w-4 h-4 text-[#6c757d] shrink-0" />
          : <ChevronDown className="w-4 h-4 text-[#6c757d] shrink-0" />
        }
      </button>
      {open && <div className="card-body">{children}</div>}
    </div>
  )
}

// ── Modal: confirmar cierre ────────────────────────────────────────────

function ConfirmCierreModal({
  preview,
  onConfirm,
  onCancel,
  isPending,
}: {
  preview: CajaCierrePreview | undefined
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold text-[#212529]">Confirmar cierre de caja</h2>
            <p className="text-[12px] text-[#6c757d] mt-1">Esta acción es irreversible.</p>
          </div>
          <button
            type="button"
            className="text-[#adb5bd] hover:text-[#495057] transition-colors"
            onClick={onCancel}
            disabled={isPending}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {preview && (
          <div className="bg-[#f8f9fa] rounded-lg p-3 space-y-1.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-[#6c757d]">Subtotal caja</span>
              <span className="font-mono">{fmtMoney(preview.subtotalCaja)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6c757d]">Monto Libres</span>
              <span className="font-mono">{fmtMoney(preview.montoLibres)}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-[#dee2e6]">
              <span className="font-semibold text-[#0d6efd]">Total</span>
              <span className="font-mono font-semibold text-[#0d6efd]">{fmtMoney(preview.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6c757d]">− Ahorro fijo</span>
              <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.ahorroFijo)}</span>
            </div>
            {preview.totalGastos > 0 && (
              <div className="flex justify-between">
                <span className="text-[#6c757d]">− Gastos operativos</span>
                <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.totalGastos)}</span>
              </div>
            )}
            {(preview.totalNomina ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-[#6c757d]">− Nómina</span>
                <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.totalNomina)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t border-[#dee2e6]">
              <span className="font-semibold text-[#15803d]">Total Real Libres</span>
              <span className="font-mono font-semibold text-[#15803d]">{fmtMoney(preview.totalRealLibres)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-sm" onClick={onCancel} disabled={isPending}>
            Cancelar
          </button>
          <button type="button" className="btn btn-sm btn-danger" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Cerrando…' : 'Sí, cerrar caja'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: confirmar cancelar corte ───────────────────────────────────

function ConfirmCancelCorteModal({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#f59e0b] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold text-[#212529]">Reabrir caja</h2>
            <p className="text-[12px] text-[#6c757d] mt-1">
              La caja volverá al estado abierta. Solo disponible el mismo día del cierre.
            </p>
          </div>
          <button
            type="button"
            className="text-[#adb5bd] hover:text-[#495057] transition-colors"
            onClick={onCancel}
            disabled={isPending}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-sm" onClick={onCancel} disabled={isPending}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{ backgroundColor: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Reabriendo...' : 'Si, reabrir caja'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Post-cierre: vista de éxito ────────────────────────────────────────

function CajaCerradaView({
  caja,
  onExportPdf,
  onBack,
  exporting,
}: {
  caja: CajaDiaDetalle
  onExportPdf: () => void
  onBack: () => void
  exporting: boolean
}) {
  const items: [string, number | null, boolean?][] = [
    ['Ingreso carteras',  caja.ingresoCarteras,  false],
    ['Desembolsos',       caja.desembolsos,       false],
    ['Subtotal caja',     caja.subtotalCaja,      true],
    ['Monto Libres',      caja.montoLibres,       false],
    ['Total',             caja.total,             true],
    ['Ahorro fijo',       caja.ahorroFijo,        false],
    ...((caja.totalGastos ?? 0) > 0
      ? [['Gastos operativos', caja.totalGastos, false] as [string, number | null, boolean]]
      : []),
    ...((caja.totalNomina ?? 0) > 0
      ? [['Nómina', caja.totalNomina, false] as [string, number | null, boolean]]
      : []),
    ['Total Real Libres', caja.totalRealLibres,   true],
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg">
        <CheckCircle2 className="w-5 h-5 text-[#16a34a] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#15803d]">Caja cerrada correctamente</p>
          <p className="text-[11px] text-[#166534]">
            {caja.sucursalNombre} · {caja.fecha}
            {caja.cerradaPorNombre ? ` · Cerrada por ${caja.cerradaPorNombre}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm flex items-center gap-1.5"
          onClick={onBack}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary flex items-center gap-1.5"
          onClick={onExportPdf}
          disabled={exporting}
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Generando…' : 'Exportar PDF'}
        </button>
      </div>

      <div className="card">
        <div className="card-header"><h2 className="card-title">Resumen final</h2></div>
        <div className="card-body">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map(([label, value, bold]) => (
              <div key={label} className="bg-[#f8f9fa] rounded-lg px-3 py-2">
                <dt className="text-[11px] text-[#6c757d]">{label}</dt>
                <dd className={`text-[14px] font-mono ${bold ? 'font-semibold text-[#212529]' : ''}`}>
                  {fmtMoney(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}

// ── Sección Nómina ─────────────────────────────────────────────────────

function SeccionNomina({ cajaDiaId }: { cajaDiaId: number }) {
  const qc = useQueryClient()
  const [confirmando, setConfirmando] = useState(false)

  const { data: estado, isLoading } = useQuery<NominaEstado>({
    queryKey: ['caja-nomina', cajaDiaId],
    queryFn:  () => cajaService.getNominaEstado(cajaDiaId),
    staleTime: 60_000,
  })

  const registrarMut = useMutation({
    mutationFn: () => cajaService.registrarNomina(cajaDiaId),
    onSuccess: () => {
      toast.success('Nómina registrada')
      qc.invalidateQueries({ queryKey: ['caja-nomina', cajaDiaId] })
      qc.invalidateQueries({ queryKey: ['caja-cierre-preview'] })
      setConfirmando(false)
    },
    onError: () => toast.error('Error al registrar la nómina'),
  })

  const anularMut = useMutation({
    mutationFn: () => cajaService.anularNomina(cajaDiaId),
    onSuccess: () => {
      toast.success('Nómina anulada')
      qc.invalidateQueries({ queryKey: ['caja-nomina', cajaDiaId] })
      qc.invalidateQueries({ queryKey: ['caja-cierre-preview'] })
    },
    onError: () => toast.error('Error al anular la nómina'),
  })

  if (isLoading || !estado) return null

  return (
    <Section title="Nómina" defaultOpen={false}>
      {!estado.esDiaEfectivo ? (
        <p className="text-[13px] text-[#6c757d]">
          El próximo pago de nómina es el{' '}
          <span className="font-medium text-[#212529]">
            {new Date(estado.diaEfectivo + 'T12:00:00').toLocaleDateString('es-MX', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </span>
          .
        </p>
      ) : estado.pago ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
            <span className="text-[13px] font-medium text-[#15803d]">
              Nómina pagada — {fmtMoney(estado.pago.totalPagado)}
            </span>
          </div>
          <p className="text-[12px] text-[#6c757d]">
            Registrado por {estado.pago.registradoPorNombre}
          </p>
          <button
            type="button"
            className="btn btn-sm btn-ghost text-[#dc2626] text-[12px]"
            onClick={() => anularMut.mutate()}
            disabled={anularMut.isPending}
          >
            {anularMut.isPending ? 'Anulando…' : 'Anular pago'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] text-[#6c757d] uppercase tracking-wide">
                <th className="text-left font-medium pb-1">Nombre</th>
                <th className="text-left font-medium pb-1">Puesto</th>
                <th className="text-right font-medium pb-1">Monto semanal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f5]">
              {estado.personal.map(p => (
                <tr key={p.id}>
                  <td className="py-1">{p.nombre}</td>
                  <td className="py-1 text-[#6c757d]">{p.puesto}</td>
                  <td className="py-1 text-right font-mono">{fmtMoney(p.montoSemanal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#dee2e6] font-semibold">
                <td colSpan={2} className="pt-1.5 text-right text-[12px] text-[#6c757d]">Total</td>
                <td className="pt-1.5 text-right font-mono">{fmtMoney(estado.totalCalculado)}</td>
              </tr>
            </tfoot>
          </table>

          {!confirmando ? (
            <button
              type="button"
              className="btn btn-sm btn-primary w-full"
              onClick={() => setConfirmando(true)}
              disabled={estado.personal.length === 0}
            >
              Registrar pago de nómina
            </button>
          ) : (
            <div className="border border-[#fca5a5] rounded-lg p-3 bg-[#fef2f2] space-y-2">
              <p className="text-[13px] font-medium text-[#991b1b]">
                ¿Confirmar pago de nómina por {fmtMoney(estado.totalCalculado)}?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-ghost flex-1"
                  onClick={() => setConfirmando(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary flex-1"
                  onClick={() => registrarMut.mutate()}
                  disabled={registrarMut.isPending}
                >
                  {registrarMut.isPending ? 'Registrando…' : 'Confirmar pago'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

// ── Main component ─────────────────────────────────────────────────────

export default function CajaPage() {
  const { usuario } = useAuthStore()
  const queryClient = useQueryClient()
  const isAdmin     = usuario?.rol === 'ADMINISTRADOR'
  const puedeReabrirCaja = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'
  const [tipoApertura, setTipoApertura] = useState<TipoApertura>('MANUAL')

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
  const cajaCerradaHoy = estado?.estado === 'CERRADA' && cajaId != null

  // Resumen del día (preview cierre, refresca cada minuto)
  const { data: preview } = useQuery({
    queryKey: ['caja-cierre-preview', efectivaSucursalId],
    queryFn: () => cajaService.getPreviewCierre(efectivaSucursalId),
    enabled: cajaAbierta,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  // ── UI state ──────────────────────────────────────────────────────────

  const [showCierreModal,    setShowCierreModal]    = useState(false)
  const [cajaIdParaCerrar,   setCajaIdParaCerrar]   = useState<number | null>(null)
  const [showCancelCorteId,  setShowCancelCorteId]  = useState<number | null>(null)
  const [closedCaja,         setClosedCaja]         = useState<CajaDiaDetalle | null>(null)
  const [exportingPdf,       setExportingPdf]       = useState(false)
  const [activeTab,          setActiveTab]          = useState<'operativa' | 'historial'>('operativa')

  // ── Historial state ───────────────────────────────────────────────────

  const [histDesde, setHistDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [histHasta,       setHistHasta]       = useState(todayLocalStr())
  const [selectedCajaId,  setSelectedCajaId]  = useState<number | null>(null)

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

  const { data: histGastos } = useQuery({
    queryKey: ['caja-gastos', selectedCajaId],
    queryFn: () => gastoService.getGastos(selectedCajaId!),
    enabled: selectedCajaId !== null,
    staleTime: 300_000,
  })

  // ── Mutations ─────────────────────────────────────────────────────────

  const abrirMut = useMutation({
    mutationFn: (data: AbrirForm) =>
      cajaService.abrir({
        montoApertura:    data.montoApertura,
        conceptoApertura: tipoApertura === 'ANTERIOR'
          ? `Saldo a favor del corte anterior (${saldoAnterior?.fecha ?? ''})`
          : data.conceptoApertura || undefined,
        sucursalId:       efectivaSucursalId,
      }),
    onSuccess: () => {
      toast.success('Caja abierta correctamente')
      queryClient.invalidateQueries({ queryKey: ['caja-estado'] })
      queryClient.invalidateQueries({ queryKey: ['caja-estado-operativa'] })
    },
    onError: (err: any) => {
      const message = err.message ?? 'Error al abrir la caja'
      const pendingDate = extractIsoDate(message)
      if (pendingDate) {
        setHistDesde(pendingDate)
        setHistHasta(todayLocalStr())
        setSelectedCajaId(null)
        setActiveTab('historial')
      }
      toast.error(message)
    },
  })

  const cerrarMut = useMutation({
    mutationFn: (targetCajaId?: number) =>
      cajaService.cerrar({
        ...(efectivaSucursalId ? { sucursalId: efectivaSucursalId } : {}),
        ...(targetCajaId ? { cajaId: targetCajaId } : {}),
      }),
    onSuccess: (data) => {
      setShowCierreModal(false)
      setCajaIdParaCerrar(null)
      if (selectedCajaId === data.id) setSelectedCajaId(null)
      setClosedCaja(data)
      queryClient.invalidateQueries({ queryKey: ['caja-estado'] })
      queryClient.invalidateQueries({ queryKey: ['caja-estado-operativa'] })
      queryClient.invalidateQueries({ queryKey: ['caja-historial-lista'] })
      queryClient.invalidateQueries({ queryKey: ['caja-historial-detalle'] })
      toast.success('Caja cerrada correctamente')
    },
    onError: (err: any) => {
      setShowCierreModal(false)
      setCajaIdParaCerrar(null)
      toast.error(err.message ?? 'Error al cerrar la caja')
    },
  })

  const cancelarCorteMut = useMutation({
    mutationFn: (targetCajaId: number) => cajaService.cancelarCorte(targetCajaId),
    onSuccess: (_, targetCajaId) => {
      setShowCancelCorteId(null)
      if (selectedCajaId === targetCajaId) setSelectedCajaId(null)
      toast.success('Caja reabierta correctamente')
      queryClient.invalidateQueries({ queryKey: ['caja-historial-lista'] })
      queryClient.invalidateQueries({ queryKey: ['caja-historial-detalle'] })
      queryClient.invalidateQueries({ queryKey: ['caja-estado'] })
      queryClient.invalidateQueries({ queryKey: ['caja-estado-operativa'] })
    },
    onError: (err: any) => {
      setShowCancelCorteId(null)
      toast.error(err.message ?? 'No se pudo reabrir la caja')
    },
  })

  // ── Forms ─────────────────────────────────────────────────────────────

  const abrirForm = useForm<AbrirForm>({ resolver: zodResolver(abrirSchema) })
  const { data: saldoAnterior } = useQuery({
    queryKey: ['caja-saldo-anterior', efectivaSucursalId],
    queryFn: () => cajaService.getSaldoAnterior(efectivaSucursalId),
    enabled: Boolean(usuario && puedeReabrirCaja && efectivaSucursalId !== undefined),
  })

  useEffect(() => {
    if (saldoAnterior?.disponible) {
      setTipoApertura('ANTERIOR')
      abrirForm.setValue('montoApertura', saldoAnterior.monto, { shouldValidate: true })
    }
  }, [saldoAnterior, abrirForm])

  // ── Handlers ─────────────────────────────────────────────────────────

  async function handleExportPdf(id: number, fecha: string) {
    setExportingPdf(true)
    try {
      await cajaService.exportarPdf(id, fecha)
    } catch {
      toast.error('Error al generar el PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  function handleBackFromClosedCaja(caja: CajaDiaDetalle) {
    setClosedCaja(null)
    setActiveTab('historial')
    setHistDesde(caja.fecha)
    setHistHasta(todayLocalStr())
    setSelectedCajaId(caja.id)
    queryClient.invalidateQueries({ queryKey: ['caja-historial-lista'] })
    queryClient.invalidateQueries({ queryKey: ['caja-historial-detalle'] })
  }

  function fmtDate(iso: string) {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  const hoy = todayLocalStr()

  // ── Post-cierre ───────────────────────────────────────────────────────

  if (closedCaja) {
    return (
      <div className="space-y-5 pb-10">
        <div>
          <h1 className="text-[22px] font-semibold text-[#212529]">Caja</h1>
          <p className="text-[13px] text-[#6c757d] mt-0.5">Apertura y cierre de caja diaria</p>
        </div>
        <CajaCerradaView
          caja={closedCaja}
          onExportPdf={() => handleExportPdf(closedCaja.id, closedCaja.fecha)}
          onBack={() => handleBackFromClosedCaja(closedCaja)}
          exporting={exportingPdf}
        />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-10">

      {/* Modals */}
      {showCierreModal && (
        <ConfirmCierreModal
          preview={cajaIdParaCerrar === null ? preview : undefined}
          onConfirm={() => cerrarMut.mutate(cajaIdParaCerrar ?? undefined)}
          onCancel={() => {
            setShowCierreModal(false)
            setCajaIdParaCerrar(null)
          }}
          isPending={cerrarMut.isPending}
        />
      )}
      {showCancelCorteId !== null && (
        <ConfirmCancelCorteModal
          onConfirm={() => cancelarCorteMut.mutate(showCancelCorteId)}
          onCancel={() => setShowCancelCorteId(null)}
          isPending={cancelarCorteMut.isPending}
        />
      )}

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
                        <th className="text-right">Apertura</th>
                        <th className="text-right">Subtotal</th>
                        <th className="text-right">Total</th>
                        <th className="w-28"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialLista.map(h => {
                        const puedeCancelarCorte = puedeReabrirCaja && h.estado === 'CERRADA' && h.fecha === hoy
                        const puedeCerrarCaja = h.estado === 'ABIERTA'
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
                              <td className="text-right font-mono">{fmtMoney(h.montoApertura)}</td>
                              <td className="text-right font-mono">{fmtMoney(h.subtotalCaja)}</td>
                              <td className="text-right font-mono font-semibold">{fmtMoney(h.total)}</td>
                              <td>
                                <div className="flex items-center justify-end gap-2">
                                  {h.estado === 'CERRADA' && (
                                    <button
                                      type="button"
                                      title="Exportar PDF"
                                      className="text-[#adb5bd] hover:text-[#0d6efd] transition-colors"
                                      onClick={e => { e.stopPropagation(); handleExportPdf(h.id, h.fecha) }}
                                      disabled={exportingPdf}
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                  )}
                                  {puedeCerrarCaja && (
                                    <button
                                      type="button"
                                      title="Cerrar caja"
                                      className="btn btn-sm btn-danger flex items-center gap-1.5"
                                      onClick={e => {
                                        e.stopPropagation()
                                        setCajaIdParaCerrar(h.id)
                                        setShowCierreModal(true)
                                      }}
                                      disabled={cerrarMut.isPending}
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Cerrar
                                    </button>
                                  )}
                                  {puedeCancelarCorte && (
                                    <button
                                      type="button"
                                      title="Reabrir caja"
                                      className="text-[#adb5bd] hover:text-[#dc2626] transition-colors"
                                      onClick={e => { e.stopPropagation(); setShowCancelCorteId(h.id) }}
                                      disabled={cancelarCorteMut.isPending}
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {selectedCajaId === h.id && histDetalle && (
                              <tr>
                                <td colSpan={7} className="bg-[#f8f9fa] px-4 py-3">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[12px]">
                                    <div>
                                      <span className="text-[#6c757d]">Apertura</span>
                                      <div className="font-mono font-medium">{fmtMoney(histDetalle.montoApertura)}</div>
                                    </div>
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
                                      <span className="text-[#6c757d]">Total</span>
                                      <div className="font-mono font-semibold text-[#0d6efd]">{fmtMoney(histDetalle.total)}</div>
                                    </div>
                                    <div>
                                      <span className="text-[#6c757d]">Ahorro fijo</span>
                                      <div className="font-mono font-medium">{fmtMoney(histDetalle.ahorroFijo)}</div>
                                    </div>
                                    {(histDetalle.totalGastos ?? 0) > 0 && (
                                      <div>
                                        <span className="text-[#6c757d]">Gastos operativos</span>
                                        <div className="font-mono font-medium text-[#dc2626]">{fmtMoney(histDetalle.totalGastos)}</div>
                                      </div>
                                    )}
                                    {(histDetalle.totalNomina ?? 0) > 0 && (
                                      <div>
                                        <span className="text-[#6c757d]">Nómina</span>
                                        <div className="font-mono font-medium text-[#dc2626]">{fmtMoney(histDetalle.totalNomina)}</div>
                                      </div>
                                    )}
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
                                              <td>{m.conceptoNombre ?? '—'}</td>
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

                                  {histGastos && histGastos.grupos.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-[11px] font-semibold text-[#495057] mb-1">
                                        Gastos operativos · {fmtMoney(histGastos.total)}
                                      </p>
                                      {histGastos.grupos.map(grupo => (
                                        <div key={grupo.categoriaId} className="mb-2">
                                          <p className="text-[10px] font-medium text-[#6c757d] uppercase tracking-wide mb-0.5">
                                            {grupo.categoriaNombre} · {fmtMoney(grupo.subtotal)}
                                          </p>
                                          <table className="tabla text-[11px]">
                                            <thead>
                                              <tr>
                                                <th>Concepto</th>
                                                <th className="text-right">Monto</th>
                                                <th>Registrado por</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {grupo.gastos.map(g => (
                                                <tr key={g.id}>
                                                  <td>{g.concepto}</td>
                                                  <td className="text-right font-mono text-[#dc2626]">{fmtMoney(g.monto)}</td>
                                                  <td className="text-[#6c757d]">{g.registradoPorNombre}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      ))}
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
          {loadingEstado && efectivaSucursalId !== undefined && (
            <p className="text-[13px] text-[#6c757d]">Cargando estado de caja...</p>
          )}
          {isAdmin && efectivaSucursalId === undefined && !loadingEstado && (
            <p className="text-[13px] text-[#6c757d]">Cargando sucursales...</p>
          )}

          {/* ── Sin caja hoy: formulario apertura ──────────────────── */}
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
                      <p className="block text-[12px] font-medium text-[#495057] mb-2">
                        Fondo para abrir la caja
                      </p>
                      <div className="space-y-2">
                        <label className={`flex items-start gap-2 rounded border p-3 ${saldoAnterior?.disponible ? 'cursor-pointer' : 'opacity-60'}`}>
                          <input
                            type="radio"
                            name="tipoApertura"
                            checked={tipoApertura === 'ANTERIOR'}
                            disabled={!saldoAnterior?.disponible}
                            onChange={() => {
                              setTipoApertura('ANTERIOR')
                              abrirForm.setValue('montoApertura', saldoAnterior?.monto ?? 0, { shouldValidate: true })
                            }}
                          />
                          <span className="text-[12px]">
                            <span className="block font-medium">Usar saldo a favor anterior</span>
                            <span className="text-[#6c757d]">
                              {saldoAnterior?.disponible
                                ? `${fmtMoney(saldoAnterior.monto)} del ${saldoAnterior.fecha}`
                                : 'No hay un saldo positivo de un corte anterior.'}
                            </span>
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-2 rounded border p-3">
                          <input
                            type="radio"
                            name="tipoApertura"
                            checked={tipoApertura === 'MANUAL'}
                            onChange={() => {
                              setTipoApertura('MANUAL')
                              abrirForm.setValue('montoApertura', 0, { shouldValidate: true })
                            }}
                          />
                          <span className="text-[12px] font-medium">Ingresar monto manualmente</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#495057] mb-1">
                        Monto de apertura <span className="text-[#dc2626]">*</span>
                      </label>
                      <input
                        {...abrirForm.register('montoApertura')}
                        type="number" step="0.01" min="0" placeholder="0.00"
                        readOnly={tipoApertura === 'ANTERIOR'}
                        className="input"
                      />
                      {abrirForm.formState.errors.montoApertura && (
                        <p className="mt-1 text-[11px] text-[#dc2626]">
                          {abrirForm.formState.errors.montoApertura.message}
                        </p>
                      )}
                    </div>
                    {tipoApertura === 'MANUAL' && <div>
                      <label className="block text-[12px] font-medium text-[#495057] mb-1">Concepto</label>
                      <input
                        {...abrirForm.register('conceptoApertura')}
                        type="text"
                        placeholder="Ej. Fondo inicial, efectivo en caja…"
                        className="input"
                      />
                    </div>}
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

          {/* ── Caja abierta ───────────────────────────────────────── */}
          {cajaCerradaHoy && (
            <div className="card max-w-2xl border-[#f8d7da]">
              <div className="card-body">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[15px] font-semibold text-[#842029]">
                      El corte del dia de hoy ha sido cerrado
                    </h2>
                    <p className="text-[12px] text-[#6c757d] mt-1">
                      Ya existe una caja cerrada para esta sucursal. Para continuar operando hoy,
                      reabre la caja desde el tab Historial.
                    </p>
                    <button
                      type="button"
                      className="btn btn-sm mt-3"
                      onClick={() => setActiveTab('historial')}
                    >
                      Ir a historial
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    setCajaIdParaCerrar(null)
                    setShowCierreModal(true)
                  }}
                >
                  Cerrar Caja
                </button>
              </div>

              {/* ── Resumen del día ─────────────────────────────────── */}
              {preview && (
                <>
                  {/* Ingresos de carteras */}
                  <Section title="Ingresos de Carteras" badge={fmtMoney(preview.totalIngresoCarteras)}>
                    {preview.cobrosPorAsesor.length === 0 ? (
                      <p className="text-[13px] text-[#adb5bd] text-center py-3">Sin cobros registrados hoy</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="tabla">
                          <thead>
                            <tr>
                              <th className="!text-center">Asesor</th>
                              <th className="!text-center">Origen</th>
                              <th className="!text-center">Cobros</th>
                              <th className="!text-center">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.cobrosPorAsesor.map(row => (
                              <tr key={`${row.asesorNombre}-${row.origen}`}>
                                <td className="text-center">{row.asesorNombre}</td>
                                <td className="text-center">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.origen === 'ABONO' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {row.origen === 'ABONO' ? 'Abono' : 'Cobro en ruta'}
                                  </span>
                                </td>
                                <td className="text-center">{row.cantidadCobros}</td>
                                <td className="text-center font-mono">{fmtMoney(row.montoCobrado)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Section>

                  {/* Desembolsos */}
                  <Section
                    title="Desembolsos"
                    badge={fmtMoney(preview.totalDesembolsos)}
                    defaultOpen={false}
                  >
                    <dl className="space-y-1.5 text-[13px]">
                      <div className="flex justify-between">
                        <dt className="text-[#6c757d]">Créditos nuevos</dt>
                        <dd className="font-mono">{fmtMoney(preview.desembolsosCreditosNuevos)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-[#6c757d]">Renovaciones</dt>
                        <dd className="font-mono">{fmtMoney(preview.desembolsosRenovaciones)}</dd>
                      </div>
                    </dl>
                  </Section>

                  {/* Subtotal caja */}
                  <div className="card border-[#0d6efd] border-2">
                    <div className="card-body">
                      <div className="space-y-1.5 text-[13px]">
                        <div className="flex justify-between">
                          <span className="text-[#6c757d]">Apertura</span>
                          <span className="font-mono">{fmtMoney(preview.montoApertura)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6c757d]">+ Ingresos carteras</span>
                          <span className="font-mono">{fmtMoney(preview.totalIngresoCarteras)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6c757d]">− Desembolsos</span>
                          <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.totalDesembolsos)}</span>
                        </div>
                        {preview.subtotalInversiones !== 0 && (
                          <div className="flex justify-between">
                            <span className="text-[#6c757d]">
                              {preview.subtotalInversiones >= 0 ? '+' : '−'} Inversiones
                            </span>
                            <span className={`font-mono ${preview.subtotalInversiones < 0 ? 'text-[#dc2626]' : ''}`}>
                              {fmtMoney(preview.subtotalInversiones)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1.5 border-t border-[#dee2e6]">
                          <span className="font-bold text-[#0d6efd]">Subtotal Caja</span>
                          <span className="font-bold font-mono text-[#0d6efd]">{fmtMoney(preview.subtotalCaja)}</span>
                        </div>
                        <div className="flex justify-between pt-1.5 border-t border-[#dee2e6]">
                          <span className="font-bold text-[#15803d]">Total</span>
                          <span className="font-bold font-mono text-[#15803d]">{fmtMoney(preview.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Libres */}
                  <div className="card border-[#16a34a] border-2">
                    <div className="card-body">
                      <div className="space-y-1.5 text-[13px]">
                        <div className="flex justify-between">
                          <span className="text-[#6c757d]">
                            Monto Libres ({fmtPct(preview.porcentajeAhorro)} × ingresos)
                          </span>
                          <span className="font-mono">{fmtMoney(preview.montoLibres)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6c757d]">− Ahorro fijo</span>
                          <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.ahorroFijo)}</span>
                        </div>
                        {preview.totalGastos > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[#6c757d]">− Gastos operativos</span>
                            <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.totalGastos)}</span>
                          </div>
                        )}
                        {(preview.totalNomina ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[#6c757d]">− Nómina</span>
                            <span className="font-mono text-[#dc2626]">−{fmtMoney(preview.totalNomina)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1.5 border-t border-[#dee2e6]">
                          <span className="font-bold text-[#15803d]">Total Real Libres</span>
                          <span className="font-bold font-mono text-[#15803d]">{fmtMoney(preview.totalRealLibres)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {isAdmin && cajaAbierta && cajaId != null && (
                <SeccionNomina cajaDiaId={cajaId} />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
