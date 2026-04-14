import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, ChevronRight, Play, ExternalLink, X } from 'lucide-react'
import { creditoService } from '@/services/creditoService'
import { useAuthStore } from '@/hooks/useAuthStore'
import CreditoEstadoBadge from '@/components/CreditoEstadoBadge'
import FileUpload from '@/components/FileUpload'
import SecurePreviewImage from '@/components/SecurePreviewImage'
import ImagePreviewModal from '@/components/ImagePreviewModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(v?: number | null): string {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

function fmtDate(v?: string | null): string {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function fmtPct(v?: number | null): string {
  if (v == null) return '—'
  return `${(Number(v) * 100).toFixed(0)}%`
}

function Row({ label, value, valueClass }: { label: string; value?: string | number | null; valueClass?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-1.5 border-b border-[#f1f3f5] last:border-0">
      <span className="text-[11px] font-medium text-[#adb5bd] sm:w-44 shrink-0 uppercase tracking-wide">{label}</span>
      <span className={`text-[13px] text-[#212529] ${valueClass ?? ''}`}>{value ?? '—'}</span>
    </div>
  )
}

// ── Estado labels ────────────────────────────────────────────────────────────

const ESTADO_LABELS: Record<string, string> = {
  SOLICITADO: 'Solicitado',
  APROBADO: 'Aprobado',
  ACTIVO: 'Activo',
  PAGADO: 'Pagado',
  RENOVADO: 'Renovado',
  CANCELADO: 'Cancelado',
}

// ── Tipo de pestaña ───────────────────────────────────────────────────────────

type Tab = 'informacion' | 'calendario' | 'evidencia' | 'video'

// ── Componente principal ──────────────────────────────────────────────────────

export default function CreditoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuthStore()
  const qc = useQueryClient()

  const [tab, setTab] = useState<Tab>('informacion')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')
  const [cambiandoVideo, setCambiandoVideo] = useState(false)

  const hoy = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const numId = Number(id)

  const { data: credito, isLoading, isError } = useQuery({
    queryKey: ['credito', numId],
    queryFn: () => creditoService.obtener(numId),
    enabled: !isNaN(numId),
  })

  const subirVideoMut = useMutation({
    mutationFn: (url: string) => creditoService.subirVideoEntrega(numId, url),
    onSuccess: () => {
      toast.success('Video de entrega guardado')
      setCambiandoVideo(false)
      qc.invalidateQueries({ queryKey: ['credito', numId] })
    },
    onError: () => {
      toast.error('Error al guardar el video')
    },
  })

  // ── Loading / error ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500">
        Cargando crédito...
      </div>
    )
  }

  if (isError || !credito) {
    return (
      <div className="card p-8 text-center text-gray-500">
        <p className="mb-4 font-semibold">Crédito no encontrado</p>
        <button className="btn btn-sm" onClick={() => navigate('/creditos-nuevos')}>
          ← Volver
        </button>
      </div>
    )
  }

  // ── Permisos ──────────────────────────────────────────────────────

  const rol = usuario?.rol
  const esAdminSupervisor = rol === 'ADMINISTRADOR' || rol === 'SUPERVISOR'

  // ── Helpers de estado de calendario ──────────────────────────────

  function esVencido(fechaProgramada: string, estado: string) {
    return estado === 'PENDIENTE' && new Date(fechaProgramada) < hoy
  }

  // ── Stats ─────────────────────────────────────────────────────────

  const { estadisticas: stats } = credito
  const calendario = credito.calendario ?? []
  const evidenciaUrls = credito.evidenciaUrls ?? []
  const totalAPagarCredito =
    credito.totalAPagar ??
    ((credito.montoCapital ?? 0) + (credito.cargoFinanciero ?? 0))
  // Uses montoEsperado as approximation for PARCIAL (montoRecibido not available in list view)
  const totalPagado = calendario
    .filter((p) => ['PAGADO', 'ADELANTADO', 'PARCIAL'].includes(p.estado))
    .reduce((sum, p) => sum + p.montoEsperado, 0)
  const saldoRestante = totalAPagarCredito - totalPagado

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            className="btn btn-sm mt-0.5 shrink-0"
            onClick={() => navigate('/creditos-nuevos')}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Volver
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-[#212529]">
                Crédito #{credito.id} — {credito.cliente.nombreCompleto}
              </h1>
              <CreditoEstadoBadge estado={credito.estado} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {credito.sucursal.nombre} · {credito.asesor.nombreCompleto}
            </p>
          </div>
        </div>

        {/* Botones de acción por estado */}
        <div className="flex gap-2 shrink-0">
          {credito.estado === 'SOLICITADO' && esAdminSupervisor && (
            <button
              className="btn-primary btn btn-sm"
              onClick={() => navigate('/creditos-nuevos', { state: { initialTab: 'evaluacion', initialCreditoId: credito.id } })}
            >
              Evaluar
            </button>
          )}
          {credito.estado === 'APROBADO' && esAdminSupervisor && (
            <button
              className="btn-primary btn btn-sm"
              onClick={() => navigate('/creditos-nuevos', { state: { initialTab: 'desembolso', initialCreditoId: credito.id } })}
            >
              Desembolsar
            </button>
          )}
          {credito.estado === 'ACTIVO' && (
            <button
              className="btn-primary btn btn-sm"
              onClick={() => navigate('/cobros')}
            >
              Registrar Pago
            </button>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="metric-card">
          <span className="metric-label">Monto aprobado</span>
          <span className="metric-val">{fmtMoney(credito.montoAprobado ?? credito.montoCapital)}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Pago diario</span>
          <span className="metric-val">{fmtMoney(credito.pagoPeriodico)}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Progreso</span>
          <span className="metric-val">
            {stats.pagosRealizados} / {credito.plazoDias} pagos
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Vencimiento</span>
          <span className="metric-val text-sm">{fmtDate(credito.fechaVencimiento)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        {/* Tab nav */}
        <div className="flex border-b border-[#e9ecef] overflow-x-auto">
          {(
            [
              { key: 'informacion', label: 'Información' },
              { key: 'calendario', label: 'Calendario' },
              { key: 'evidencia', label: 'Evidencia' },
              { key: 'video', label: 'Video de entrega' },
            ] as { key: Tab; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === key
                  ? 'border-[#3d6b35] text-[#3d6b35]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4 sm:p-6">
          {/* ── Tab 1: Información ─────────────────────────────────── */}
          {tab === 'informacion' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Datos del crédito */}
                <section>
                  <h2 className="text-sm font-semibold text-[#3d6b35] uppercase tracking-wide mb-3">
                    Datos del crédito
                  </h2>
                  <div className="space-y-0.5">
                    <Row label="Capital solicitado" value={fmtMoney(credito.montoCapital)} />
                    <Row label="Monto aprobado" value={fmtMoney(credito.montoAprobado)} />
                    <Row label="Tasa de interés" value={fmtPct(credito.tasaInteres)} />
                    <Row label="Cargo financiero" value={fmtMoney(credito.cargoFinanciero)} />
                    <Row label="Total a pagar" value={fmtMoney(totalAPagarCredito)} />
                    <Row label="Pago diario" value={fmtMoney(credito.pagoPeriodico)} />
                    <Row label="Pago adelantado" value={fmtMoney(credito.pagoAdelantado)} />
                    <Row
                      label="Forma de pago"
                      value={credito.tipoPago === 'DIARIO' ? 'Diario' : 'Semanal'}
                    />
                    <Row label="Plazo" value={`${credito.plazoDias} días`} />
                    <Row label="Fecha inicio" value={fmtDate(credito.fechaInicio)} />
                    <Row label="Fecha vencimiento" value={fmtDate(credito.fechaVencimiento)} />
                    {credito.garantiaDescripcion && (
                      <Row label="Garantía material" value={credito.garantiaDescripcion} />
                    )}
                  </div>
                </section>

                {/* Proceso */}
                <section>
                  <h2 className="text-sm font-semibold text-[#3d6b35] uppercase tracking-wide mb-3">
                    Proceso
                  </h2>
                  <div className="space-y-0.5">
                    <Row label="Estado" value={ESTADO_LABELS[credito.estado] ?? credito.estado} />
                    <Row label="Asesor" value={credito.asesor.nombreCompleto} />
                    <Row label="Sucursal" value={credito.sucursal.nombre} />
                    <Row label="Fecha solicitud" value={fmtDate(credito.createdAt)} />
                    <Row label="Aprobado por" value={credito.aprobadoPor?.nombreCompleto} />
                    <Row label="Fecha aprobación" value={fmtDate(credito.fechaAprobacion)} />
                    <Row label="Fecha desembolso" value={fmtDate(credito.fechaDesembolso)} />
                    {credito.observaciones && (
                      <Row label="Observaciones" value={credito.observaciones} />
                    )}
                  </div>
                </section>
              </div>

              {/* Estadísticas */}
              <section>
                <h2 className="text-sm font-semibold text-[#3d6b35] uppercase tracking-wide mb-3">
                  Estadísticas
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-[#16a34a]">{stats.pagosRealizados}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Pagos realizados</div>
                  </div>
                  <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-[#212529]">{stats.pagosPendientes}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Pendientes</div>
                  </div>
                  <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                    <div className={`text-xl font-bold ${stats.pagosVencidos > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
                      {stats.pagosVencidos}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Vencidos</div>
                  </div>
                  <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                    <div className={`text-xl font-bold ${stats.multasPendientes > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
                      {fmtMoney(stats.multasPendientes)}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Multas pendientes</div>
                  </div>
                  <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                    <div className={`text-xl font-bold ${stats.elegibleRenovacion ? 'text-[#16a34a]' : 'text-gray-400'}`}>
                      {stats.elegibleRenovacion ? 'Sí' : 'No'}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Elegible renovación</div>
                  </div>
                </div>
              </section>

              {/* Cliente card */}
              <section>
                <h2 className="text-sm font-semibold text-[#3d6b35] uppercase tracking-wide mb-3">
                  Cliente
                </h2>
                <button
                  onClick={() => navigate(`/clientes/${credito.cliente.id}`)}
                  className="w-full flex items-center justify-between p-4 bg-[#f8f9fa] hover:bg-[#eef3ee] rounded-lg border border-[#e9ecef] transition-colors text-left"
                >
                  <div>
                    <div className="font-semibold text-[#212529]">{credito.cliente.nombreCompleto}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{credito.cliente.celular}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                </button>
              </section>
            </div>
          )}

          {/* ── Tab 2: Calendario ──────────────────────────────────── */}
          {tab === 'calendario' && (
            <div className="space-y-4">
              <div className="overflow-x-auto -mx-4 sm:-mx-6">
                <table className="tabla min-w-full">
                  <thead>
                    <tr>
                      <th className="w-12 text-center">#</th>
                      <th>Fecha</th>
                      <th className="text-right">Monto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calendario.map((pago) => {
                      const vencido = esVencido(pago.fechaProgramada, pago.estado)

                      let rowClass = ''
                      if (pago.estado === 'ADELANTADO') rowClass = 'bg-green-50'
                      else if (pago.estado === 'PAGADO') rowClass = 'bg-green-50/60'
                      else if (pago.estado === 'PARCIAL') rowClass = 'bg-amber-50'
                      else if (pago.estado === 'NO_PAGADO') rowClass = 'bg-red-50'
                      else if (vencido) rowClass = 'bg-red-50'

                      let badgeCls = ''
                      let badgeLabel = ''
                      if (pago.estado === 'ADELANTADO') {
                        badgeCls = 'bg-green-100 text-green-800'
                        badgeLabel = 'Adelantado'
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
                      } else {
                        badgeCls = 'bg-gray-100 text-gray-600'
                        badgeLabel = 'Pendiente'
                      }

                      return (
                        <tr key={pago.id} className={rowClass}>
                          <td className="text-center font-mono text-sm">{pago.numeroPago}</td>
                          <td className="text-sm">{fmtDate(pago.fechaProgramada)}</td>
                          <td className="text-right font-mono text-sm">{fmtMoney(pago.montoEsperado)}</td>
                          <td>
                            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${badgeCls}`}>
                              {badgeLabel}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer del calendario */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-[#16a34a]">{stats.pagosRealizados}</div>
                  <div className="text-[11px] text-gray-500">Pagados</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-[#212529]">{stats.pagosPendientes}</div>
                  <div className="text-[11px] text-gray-500">Pendientes</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div className={`text-lg font-bold ${stats.pagosVencidos > 0 ? 'text-red-600' : 'text-[#212529]'}`}>
                    {stats.pagosVencidos}
                  </div>
                  <div className="text-[11px] text-gray-500">Vencidos</div>
                </div>
                <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-[#16a34a]">{fmtMoney(totalPagado)}</div>
                  <div className="text-[11px] text-gray-500">Total pagado</div>
                </div>
              </div>
              <div className="text-right text-sm font-semibold text-gray-700">
                Saldo restante: <span className="text-[#212529]">{fmtMoney(saldoRestante)}</span>
              </div>
            </div>
          )}

          {/* ── Tab 3: Evidencia ───────────────────────────────────── */}
          {tab === 'evidencia' && (
            <div>
              {evidenciaUrls.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <p className="text-sm">Sin evidencia adjunta</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {evidenciaUrls.map((url, idx) => {
                    const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url)
                    if (isVideo) {
                      return (
                        <button
                          key={idx}
                          type="button"
                          aria-label={`Abrir video de evidencia ${idx + 1}`}
                          onClick={() => window.open(url, '_blank')}
                          className="relative aspect-square bg-gray-900 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
                        >
                          <Play className="w-10 h-10 text-white opacity-80" />
                          <span className="absolute bottom-2 left-2 text-[10px] text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
                            Video
                          </span>
                        </button>
                      )
                    }
                    return (
                      <button
                        key={idx}
                        type="button"
                        aria-label={`Ver imagen de evidencia ${idx + 1}`}
                        onClick={() => {
                          setPreviewUrl(url)
                          setPreviewTitle(`Evidencia ${idx + 1}`)
                        }}
                        className="aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                      >
                        <SecurePreviewImage
                          fileUrl={url}
                          alt={`Evidencia ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Tab 4: Video de entrega ───────────────────────────── */}
          {tab === 'video' && (
            <div className="space-y-4">
              {credito.videoEntregaUrl && !cambiandoVideo ? (
                <div className="space-y-3">
                  <video
                    src={credito.videoEntregaUrl}
                    controls
                    className="w-full rounded-xl"
                    style={{ maxHeight: '400px' }}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={credito.videoEntregaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver en tamaño completo
                    </a>
                    <button
                      className="btn btn-sm"
                      onClick={() => setCambiandoVideo(true)}
                    >
                      Cambiar video
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {cambiandoVideo && (
                    <button
                      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                      onClick={() => setCambiandoVideo(false)}
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                  )}
                  <FileUpload
                    accept="video/mp4,video/quicktime,video/mov"
                    compress={true}
                    folder={`video-entrega/creditos/${numId}`}
                    label="Video de entrega de dinero"
                    onUploadComplete={(url) => subirVideoMut.mutate(url)}
                    disabled={subirVideoMut.isPending}
                  />
                  <p className="text-xs text-gray-400">
                    El video no es obligatorio para activar el crédito. Puede subirse después del desembolso
                    desde esta misma pantalla.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de previsualización de imagen */}
      <ImagePreviewModal
        isOpen={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        imageUrl={previewUrl ?? ''}
        title={previewTitle}
      />
    </div>
  )
}
