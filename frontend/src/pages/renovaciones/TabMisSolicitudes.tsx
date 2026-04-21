import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  User,
  ClipboardList,
} from 'lucide-react'
import { renovacionService } from '@/services/renovacionService'
import FileUpload from '@/components/FileUpload'
import type { EstadoRenovacion, RenovacionDetalle } from '@/types'

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

// ── Estado badge ──────────────────────────────────────────────────────────────

type FiltroEstado = 'TODOS' | EstadoRenovacion

const ESTADO_CONFIG: Record<EstadoRenovacion, {
  label: string
  chip: string
  dot: string
  pulse: boolean
}> = {
  SOLICITADO: {
    label: 'En revisión',
    chip: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    dot: 'bg-amber-400',
    pulse: true,
  },
  APROBADO: {
    label: 'Pendiente desembolso',
    chip: 'bg-orange-100 text-orange-800 ring-1 ring-orange-200',
    dot: 'bg-orange-400',
    pulse: true,
  },
  RECHAZADO: {
    label: 'Rechazada',
    chip: 'bg-red-100 text-red-800 ring-1 ring-red-200',
    dot: 'bg-red-500',
    pulse: false,
  },
  ACTIVO: {
    label: 'Activa',
    chip: 'bg-teal-100 text-teal-800 ring-1 ring-teal-200',
    dot: 'bg-teal-500',
    pulse: false,
  },
}

function EstadoBadge({ estado }: { estado: EstadoRenovacion }) {
  const cfg = ESTADO_CONFIG[estado]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.chip}`}>
      <span className="relative flex h-2 w-2">
        {cfg.pulse && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${cfg.dot}`} />
      </span>
      {cfg.label}
    </span>
  )
}

// ── Tarjeta de solicitud ──────────────────────────────────────────────────────

function TarjetaSolicitud({
  r,
  onConfirmadoExitoso,
}: {
  r: RenovacionDetalle
  onConfirmadoExitoso: (data: RenovacionDetalle) => void
}) {
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined)
  const tieneMultas = Number(r.multasPendientes) > 0
  const montoAprobado = r.montoAprobado ?? r.montoNuevo
  const montoModificado = r.montoAprobado != null && Number(r.montoAprobado) !== Number(r.montoNuevo)

  const confirmarMutation = useMutation({
    mutationFn: () => renovacionService.confirmarDesembolso(r.id, videoUrl),
    onSuccess: (data) => {
      toast.success('Desembolso confirmado — nuevo crédito activado')
      onConfirmadoExitoso(data)
    },
    onError: (err: any) => toast.error(err?.message ?? 'Error al confirmar'),
  })

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 text-base truncate">{r.cliente.nombreCompleto}</h3>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 flex-shrink-0" />
            Enviada {fmtDateTime(r.createdAt)}
          </p>
        </div>
        <EstadoBadge estado={r.estado} />
      </div>

      {/* Cuerpo */}
      <div className="px-5 py-4 space-y-4">
        {/* Resumen de montos */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
            <p className="text-xs text-gray-400 mb-0.5">Crédito anterior</p>
            <p className="text-base font-bold text-gray-700">{fmt(r.creditoAnterior.montoCapital)}</p>
            <p className="text-xs text-gray-400">{r.creditoAnterior.plazoDias} días</p>
          </div>
          <div className="rounded-lg bg-[#3d6b35]/5 border border-[#3d6b35]/20 px-3 py-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="w-3 h-3 text-[#3d6b35]" />
              <p className="text-xs text-[#3d6b35] font-medium">
                {r.estado === 'SOLICITADO' ? 'Crédito nuevo' : 'Monto aprobado'}
              </p>
            </div>
            <p className="text-base font-bold text-[#3d6b35]">{fmt(montoAprobado)}</p>
            {montoModificado && r.estado !== 'SOLICITADO' && (
              <p className="text-xs text-gray-400">Solicitado: {fmt(r.montoNuevo)}</p>
            )}
            {r.estado === 'SOLICITADO' && (
              <p className="text-xs text-gray-400">{r.tipoPago === 'DIARIO' ? 'Diario' : 'Semanal'}</p>
            )}
          </div>
        </div>

        {/* Detalle */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="text-gray-500">Pagos restantes al enviar</span>
            <span className="font-medium text-gray-700">
              {r.pagosRestantes} pago{r.pagosRestantes !== 1 ? 's' : ''} · {fmt(r.montoPagosRestantes)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="text-gray-500">Multas pendientes</span>
            <span className={tieneMultas ? 'font-semibold text-red-600' : 'text-gray-400'}>
              {tieneMultas ? fmt(r.multasPendientes) : 'Sin multas'}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-2 rounded-xl bg-white border-2 border-[#3d6b35]/20 px-3 py-2">
            <span className="text-sm font-semibold text-gray-600">Monto a desembolsar</span>
            <span className={`text-lg font-extrabold tabular-nums ${Number(r.montoDesembolso) >= 0 ? 'text-[#3d6b35]' : 'text-red-600'}`}>
              {fmt(r.montoDesembolso)}
            </span>
          </div>
        </div>

        {/* Caso RECHAZADO */}
        {r.estado === 'RECHAZADO' && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-700 mb-0.5">Motivo del rechazo</p>
              <p className="text-sm text-red-600">
                {r.motivoRechazo && r.motivoRechazo.trim().length > 0
                  ? r.motivoRechazo
                  : 'No se especificó un motivo.'}
              </p>
              {r.aprobadoPor && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Rechazada por {r.aprobadoPor.nombreCompleto} · {fmtDateTime(r.fechaAprobacion)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Caso APROBADO — pendiente de desembolso */}
        {r.estado === 'APROBADO' && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-0.5">
                ✓ El gerente aprobó esta renovación
              </p>
              {montoModificado && (
                <p className="text-xs text-amber-700">
                  Monto ajustado: <strong>{fmt(montoAprobado)}</strong> (solicitado: {fmt(r.montoNuevo)})
                </p>
              )}
              {r.aprobadoPor && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                  <User className="w-3 h-3" />
                  Aprobada por {r.aprobadoPor.nombreCompleto} · {fmtDateTime(r.fechaAprobacion)}
                </p>
              )}
              <p className="text-xs text-amber-600 mt-1.5">
                Confirma cuando hayas entregado el efectivo al cliente.
              </p>
            </div>

            {videoUrl ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <span className="text-green-700 text-xs font-medium">✓ Video listo para adjuntar</span>
                <button
                  type="button"
                  onClick={() => setVideoUrl(undefined)}
                  className="ml-auto text-xs text-gray-400 underline hover:text-gray-600"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <FileUpload
                accept="video/mp4,video/quicktime,video/mov"
                compress={false}
                folder={`video-entrega/renovaciones/${r.id}`}
                label="Video de entrega (opcional)"
                onUploadComplete={(url) => setVideoUrl(url)}
              />
            )}

            <button
              type="button"
              onClick={() => confirmarMutation.mutate()}
              disabled={confirmarMutation.isPending}
              className="w-full btn-primary text-sm py-2.5 disabled:opacity-50"
            >
              {confirmarMutation.isPending ? 'Confirmando…' : 'Confirmar desembolso →'}
            </button>
          </div>
        )}

        {/* Caso ACTIVO — crédito generado */}
        {r.estado === 'ACTIVO' && r.creditoNuevo && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 space-y-2">
            <Link
              to={`/creditos/${r.creditoNuevo.id}`}
              className="flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-800 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ver crédito activo →
            </Link>
            {r.confirmadoPor && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <User className="w-3 h-3" />
                Desembolsado por {r.confirmadoPor.nombreCompleto} · {fmtDateTime(r.fechaConfirmacion)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab principal ─────────────────────────────────────────────────────────────

const FILTROS: { value: FiltroEstado; label: string }[] = [
  { value: 'TODOS', label: 'Todas' },
  { value: 'SOLICITADO', label: 'En revisión' },
  { value: 'APROBADO', label: 'Pendiente desembolso' },
  { value: 'ACTIVO', label: 'Activas' },
  { value: 'RECHAZADO', label: 'Rechazadas' },
]

export default function TabMisSolicitudes() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<FiltroEstado>('TODOS')

  const { data: solicitudes = [], isLoading, isError } = useQuery({
    queryKey: ['mis-solicitudes-renovacion'],
    queryFn: () => renovacionService.getMisSolicitudes(),
  })

  function handleConfirmadoExitoso(data: RenovacionDetalle) {
    queryClient.invalidateQueries({ queryKey: ['mis-solicitudes-renovacion'] })
    queryClient.invalidateQueries({ queryKey: ['creditos'] })
    if (data.creditoNuevo) {
      navigate(`/creditos/${data.creditoNuevo.id}`)
    }
  }

  const visibles = filtro === 'TODOS' ? solicitudes : solicitudes.filter((r) => r.estado === filtro)

  if (isLoading) {
    return <div className="card p-10 text-center text-gray-500">Cargando solicitudes…</div>
  }

  if (isError) {
    return <div className="card p-10 text-center text-red-600">Error al cargar solicitudes. Recarga la página.</div>
  }

  if (solicitudes.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <ClipboardList className="w-7 h-7 text-gray-400" />
        </div>
        <p className="font-semibold text-gray-700">Aún no tienes solicitudes</p>
        <p className="text-sm text-gray-400 mt-1 mb-5">Cuando envíes una renovación aparecerá aquí</p>
        <button
          type="button"
          onClick={() => navigate('.', { state: { tab: 'nueva' } })}
          className="btn-primary text-sm px-5 py-2.5"
        >
          Nueva Renovación
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtro por estado */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const count = f.value === 'TODOS' ? solicitudes.length : solicitudes.filter((r) => r.estado === f.value).length
          if (f.value !== 'TODOS' && count === 0) return null
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltro(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                filtro === f.value
                  ? 'bg-[#3d6b35] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      {visibles.length === 0 ? (
        <div className="card p-10 text-center text-gray-500 text-sm">
          No tienes solicitudes con ese estado
        </div>
      ) : (
        <div className="space-y-4">
          {visibles.map((r) => (
            <TarjetaSolicitud key={r.id} r={r} onConfirmadoExitoso={handleConfirmadoExitoso} />
          ))}
        </div>
      )}
    </div>
  )
}
