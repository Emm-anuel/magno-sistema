import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  CheckCircle,
  Building2,
  User,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Video,
} from 'lucide-react'
import { renovacionService } from '@/services/renovacionService'
import FileUpload from '@/components/FileUpload'
import type { RenovacionDetalle } from '@/types'

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

interface TarjetaDesembolsoProps {
  renovacion: RenovacionDetalle
  dismissing: boolean
  onConfirmar: (videoUrl: string | undefined) => void
  loading: boolean
}

function TarjetaDesembolso({ renovacion: r, dismissing, onConfirmar, loading }: TarjetaDesembolsoProps) {
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined)
  const tieneMultas = Number(r.multasPendientes) > 0
  const montoAprobado = r.montoAprobado ?? r.montoNuevo
  const montoModificado = r.montoAprobado != null && Number(r.montoAprobado) !== Number(r.montoNuevo)

  return (
    <div className={`card overflow-hidden transition-all duration-300 ease-in-out ${
      dismissing ? 'opacity-0 scale-95 -translate-y-1 pointer-events-none' : ''
    }`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-amber-50/60 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 text-base truncate">{r.cliente.nombreCompleto}</h3>
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5">
              Listo para desembolsar
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 flex-shrink-0" />{r.asesor.nombreCompleto}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3 flex-shrink-0" />{r.asesor.sucursalNombre}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              Aprobada {fmtDateTime(r.fechaAprobacion)}
            </span>
          </div>
          {r.aprobadoPor && (
            <p className="text-xs text-gray-400 mt-1">Aprobada por: {r.aprobadoPor.nombreCompleto}</p>
          )}
        </div>
      </div>

      {/* Cuerpo */}
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Izquierda: multas y video */}
        <div className="space-y-4">
          {tieneMultas ? (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-700">Multas a descontar</p>
                <p className="text-sm font-bold text-red-600">{fmt(r.multasPendientes)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="text-xs text-gray-500">Sin multas pendientes</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" />
              Video de entrega <span className="font-normal text-gray-400">(opcional)</span>
            </p>
            {videoUrl ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <span className="text-green-700 text-xs font-medium">✓ Video listo</span>
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
          </div>
        </div>

        {/* Derecha: montos */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
              <p className="text-xs text-gray-400 mb-0.5">Crédito anterior</p>
              <p className="text-base font-bold text-gray-700">{fmt(r.creditoAnterior.montoCapital)}</p>
            </div>
            <div className="rounded-lg bg-[#3d6b35]/5 border border-[#3d6b35]/20 px-3 py-2.5">
              <div className="flex items-center gap-1 mb-0.5">
                <TrendingUp className="w-3 h-3 text-[#3d6b35]" />
                <p className="text-xs text-[#3d6b35] font-medium">Monto aprobado</p>
              </div>
              <p className="text-base font-bold text-[#3d6b35]">{fmt(montoAprobado)}</p>
              {montoModificado && (
                <p className="text-xs text-gray-400">Solicitado: {fmt(r.montoNuevo)}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
            <span className="text-gray-500">Pagos restantes</span>
            <span className="font-medium text-gray-700">
              {r.pagosRestantes} · {fmt(r.montoPagosRestantes)}
            </span>
          </div>

          <div className="rounded-xl bg-white border-2 border-[#3d6b35]/30 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-600">A entregar al cliente</span>
            <span className={`text-xl font-extrabold tabular-nums ${
              Number(r.montoDesembolso) >= 0 ? 'text-[#3d6b35]' : 'text-red-600'
            }`}>
              {fmt(r.montoDesembolso)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 bg-amber-50/40">
        <button
          type="button"
          onClick={() => onConfirmar(videoUrl)}
          disabled={loading}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          {loading ? 'Confirmando…' : 'Confirmar desembolso'}
        </button>
      </div>
    </div>
  )
}

export default function TabPendientesDesembolso() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(new Set())

  const { data: pendientes = [], isLoading, isError } = useQuery({
    queryKey: ['renovaciones-pendientes-desembolso'],
    queryFn: () => renovacionService.getPendientesDesembolso(),
    select: (data) => [...data].sort(
      (a, b) =>
        new Date(a.fechaAprobacion ?? '').getTime() -
        new Date(b.fechaAprobacion ?? '').getTime()
    ),
  })

  function dismissAndRefresh(id: number, callback?: () => void) {
    setDismissingIds((prev) => new Set([...prev, id]))
    setTimeout(() => {
      callback?.()
      queryClient.invalidateQueries({ queryKey: ['renovaciones-pendientes-desembolso'] })
      queryClient.invalidateQueries({ queryKey: ['creditos'] })
    }, 320)
  }

  const confirmarMutation = useMutation({
    mutationFn: ({ id, videoUrl }: { id: number; videoUrl?: string }) =>
      renovacionService.confirmarDesembolso(id, videoUrl),
    onSuccess: (data, { id }) => {
      toast.success('Desembolso confirmado — nuevo crédito activado')
      dismissAndRefresh(id, () => {
        if (data.creditoNuevo) navigate(`/creditos/${data.creditoNuevo.id}`)
      })
    },
    onError: (err: any) => toast.error(err?.message ?? 'Error al confirmar'),
  })

  if (isLoading) return <div className="card p-10 text-center text-gray-500">Cargando…</div>
  if (isError) return <div className="card p-10 text-center text-red-600">Error al cargar. Recarga la página.</div>

  if (pendientes.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-amber-500" />
        </div>
        <p className="font-semibold text-gray-700">No hay desembolsos pendientes</p>
        <p className="text-sm text-gray-400 mt-1">Todas las renovaciones aprobadas han sido desembolsadas</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {pendientes.length} renovación{pendientes.length !== 1 ? 'es' : ''} aprobada{pendientes.length !== 1 ? 's' : ''} — confirma la entrega del efectivo al cliente
      </p>
      <div className="space-y-4">
        {pendientes.map((r) => (
          <TarjetaDesembolso
            key={r.id}
            renovacion={r}
            dismissing={dismissingIds.has(r.id)}
            onConfirmar={(videoUrl) => confirmarMutation.mutate({ id: r.id, videoUrl })}
            loading={confirmarMutation.isPending}
          />
        ))}
      </div>
    </div>
  )
}
