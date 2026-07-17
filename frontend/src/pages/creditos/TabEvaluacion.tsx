import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Search, CheckCircle, Play, X } from 'lucide-react'
import { creditoService } from '@/services/creditoService'
import { useAuthStore } from '@/hooks/useAuthStore'
import CreditoEstadoBadge from '@/components/CreditoEstadoBadge'
import ProductoCalculoCard from '@/components/ProductoCalculoCard'
import SecurePreviewImage from '@/components/SecurePreviewImage'
import ImagePreviewModal from '@/components/ImagePreviewModal'
import ProcessingOverlay from '@/components/ProcessingOverlay'
import type { CreditoResumen, CreditoDetalle, ProductoCalculo } from '@/types'

// ── Helpers ────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(n)
}

function diasDesde(iso: string): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return '—'
  const now = new Date()
  const diff = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'hace 1 día'
  return `hace ${diff} días`
}

function safeN(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function isVideo(url: string): boolean {
  return /\.(mp4|mov|webm|avi|mkv)/i.test(url)
}

// ── Modals ────────────────────────────────────────────────────────

interface RejectModalProps {
  credito: CreditoDetalle
  onClose: () => void
  onConfirm: (motivo: string) => void
  loading: boolean
}

function RejectModal({ credito, onClose, onConfirm, loading }: RejectModalProps) {
  const [motivo, setMotivo] = useState('')

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl relative z-[2001]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Rechazar solicitud</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-red-50 rounded-lg p-3 text-sm">
            <div className="font-medium text-red-800">{credito.cliente.nombreCompleto}</div>
            <div className="text-red-600">{fmt(safeN(credito.montoCapital))}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo del rechazo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="input w-full resize-none"
              placeholder="Indica el motivo por el que se rechaza esta solicitud..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="btn" disabled={loading}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirm(motivo.trim())}
              disabled={!motivo.trim() || loading}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Rechazando...' : 'Confirmar rechazo'}
            </button>
          </div>
        </div>
      </div>
      <ProcessingOverlay
        visible={loading}
        title="Rechazando solicitud"
        message="Estamos guardando el rechazo y actualizando la información. No hagas clic otra vez."
      />
    </div>
  )
}

interface ApproveModalProps {
  credito: CreditoDetalle
  calculo: ProductoCalculo
  montoAprobado: number
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}

function ApproveModal({ credito, calculo, montoAprobado, onClose, onConfirm, loading }: ApproveModalProps) {
  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl relative z-[2001]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Confirmar aprobación</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-green-50 rounded-lg p-4 space-y-2">
            <div className="font-semibold text-gray-800 text-base">
              {credito.cliente.nombreCompleto}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Monto aprobado</span>
                <div className="font-bold text-[#3d6b35] text-lg">{fmt(montoAprobado)}</div>
              </div>
              <div>
                <span className="text-gray-500">Pago {credito.tipoPago === 'SEMANAL' ? 'semanal' : 'diario'}</span>
                <div className="font-bold text-gray-800 text-lg">{fmt(safeN(calculo.pagoPeriodico))}</div>
              </div>
              <div>
                <span className="text-gray-500">Plazo</span>
                <div className="font-medium">{safeN(calculo.plazo)} {credito.tipoPago === 'SEMANAL' ? 'semanas' : 'días'}</div>
              </div>
              <div>
                <span className="text-gray-500">Tasa de interés</span>
                <div className="font-medium">{(safeN(calculo.tasa) * 100).toFixed(0)}%</div>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            ¿Confirmas la aprobación de este crédito? Se notificará al asesor responsable.
          </p>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="btn" disabled={loading}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Aprobando...' : 'Aprobar crédito'}
            </button>
          </div>
        </div>
      </div>
      <ProcessingOverlay
        visible={loading}
        title="Aprobando crédito"
        message="Estamos procesando la aprobación y generando los cambios necesarios. No hagas clic otra vez."
      />
    </div>
  )
}

// ── Historial crediticio sub-card ─────────────────────────────────

function HistorialCrediticio({ clienteId }: { clienteId: number }) {
  const { data: creditos, isLoading, isError } = useQuery({
    queryKey: ['creditos-cliente', clienteId],
    queryFn: () => creditoService.getCreditosCliente(clienteId),
    enabled: clienteId > 0,
  })

  if (isLoading) {
    return <div className="text-sm text-gray-400 animate-pulse">Cargando historial...</div>
  }

  if (isError) return <p className="text-xs text-red-500">Error al cargar historial</p>

  if (!creditos || creditos.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">Cliente nuevo — sin historial crediticio</p>
    )
  }

  // Exclude current SOLICITADO — show only completed/other
  const anteriores = creditos.filter((c) => c.estado !== 'SOLICITADO')
  const pagados = anteriores.filter((c) => c.estado === 'PAGADO').length
  const cancelados = anteriores.filter((c) => c.estado === 'CANCELADO').length

  return (
    <div className="space-y-2">
      {anteriores.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Cliente nuevo — sin historial crediticio</p>
      ) : (
        <>
          {pagados > 0 && (
            <p className="text-sm text-green-700 font-medium">
              ✓ Pagó correctamente {pagados} crédito{pagados !== 1 ? 's' : ''} anterior{pagados !== 1 ? 'es' : ''}
            </p>
          )}
          {cancelados > 0 && (
            <p className="text-sm text-red-600 font-medium">
              {cancelados} crédito{cancelados !== 1 ? 's' : ''} cancelado{cancelados !== 1 ? 's' : ''}
            </p>
          )}
          <div className="space-y-1 mt-2">
            {anteriores.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs text-gray-600">
                <span>{fmt(safeN(c.montoCapital))}</span>
                <CreditoEstadoBadge estado={c.estado} size="sm" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

interface Props {
  initialCreditoId?: number
}

export default function TabEvaluacion({ initialCreditoId }: Props) {
  const { usuario } = useAuthStore()
  const queryClient = useQueryClient()

  const isAuthorized =
    usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'

  // ── State ──────────────────────────────────────────────────────
  const [buscar, setBuscar] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [montoAprobado, setMontoAprobado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [calculo, setCalculo] = useState<ProductoCalculo | null>(null)
  const [calculoLoading, setCalculoLoading] = useState(false)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Queries ────────────────────────────────────────────────────
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['creditos-solicitados'],
    queryFn: () => creditoService.listar({ estado: 'SOLICITADO', size: 50 }),
    enabled: isAuthorized,
  })

  const solicitudes = listData?.content ?? []

  const filtered = buscar.trim()
    ? solicitudes.filter((c) =>
        c.cliente.nombreCompleto.toLowerCase().includes(buscar.toLowerCase()),
      )
    : solicitudes

  const { data: detalle, isLoading: detalleLoading } = useQuery({
    queryKey: ['credito-detalle', selectedId],
    queryFn: () => creditoService.obtener(selectedId!),
    enabled: selectedId !== null,
  })

  // ── Mutations ──────────────────────────────────────────────────
  const rechazarMutation = useMutation({
    mutationFn: (motivo: string) => creditoService.cancelarCredito(selectedId!, motivo),
    onSuccess: () => {
      toast.success('Solicitud rechazada')
      queryClient.invalidateQueries({ queryKey: ['creditos-solicitados'] })
      queryClient.invalidateQueries({ queryKey: ['creditos'] })
      setShowRejectModal(false)
      setSelectedId(null)
      resetEvaluacion()
    },
    onError: () => {
      toast.error('Error al rechazar la solicitud')
    },
  })

  const aprobarMutation = useMutation({
    mutationFn: () =>
      creditoService.aprobarCredito(selectedId!, {
        montoAprobado: parseFloat(montoAprobado),
        observaciones: observaciones.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Crédito aprobado correctamente')
      queryClient.invalidateQueries({ queryKey: ['creditos-solicitados'] })
      queryClient.invalidateQueries({ queryKey: ['creditos'] })
      setShowApproveModal(false)
      setSelectedId(null)
      resetEvaluacion()
    },
    onError: () => {
      toast.error('Error al aprobar el crédito')
    },
  })

  // ── Helpers ────────────────────────────────────────────────────
  function resetEvaluacion() {
    setMontoAprobado('')
    setObservaciones('')
    setCalculo(null)
  }

  const triggerCalculo = useCallback(
    (monto: string, tipoPago: 'DIARIO' | 'SEMANAL') => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const n = parseFloat(monto)
      if (!Number.isFinite(n) || n <= 0) {
        setCalculo(null)
        return
      }
      debounceRef.current = setTimeout(async () => {
        setCalculoLoading(true)
        try {
          const result = await creditoService.calcularProducto(n, tipoPago)
          setCalculo(result)
        } catch {
          setCalculo(null)
        } finally {
          setCalculoLoading(false)
        }
      }, 400)
    },
    [],
  )

  // ── Effects ────────────────────────────────────────────────────
  // Pre-select initialCreditoId
  useEffect(() => {
    if (initialCreditoId && initialCreditoId > 0) {
      setSelectedId(initialCreditoId)
    }
  }, [initialCreditoId])

  // When a credito detail loads, pre-fill monto and trigger calculo
  useEffect(() => {
    if (detalle) {
      const monto = String(safeN(detalle.montoSolicitado ?? detalle.montoCapital))
      setMontoAprobado(monto)
      setObservaciones(detalle.observaciones ?? '')
      triggerCalculo(monto, detalle.tipoPago)
    }
  }, [detalle, triggerCalculo])


  // ── Role guard ─────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="card p-10 text-center text-gray-500">
        No tienes permisos para evaluar solicitudes.
      </div>
    )
  }

  // ── Derived state ──────────────────────────────────────────────
  const montoNum = parseFloat(montoAprobado)
  const montoValido = Number.isFinite(montoNum) && montoNum > 0
  const canAprobar = montoValido && calculo !== null && !calculoLoading

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[600px]">

      {/* ── Left panel: solicitudes list ── */}
      <div className="lg:w-1/3 space-y-3">
        <h2 className="font-semibold text-gray-800">Solicitudes pendientes</h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>

        {/* List */}
        <div className="card divide-y divide-gray-100 overflow-hidden">
          {listLoading && (
            <div className="p-6 text-center text-gray-400 text-sm">Cargando...</div>
          )}
          {!listLoading && filtered.length === 0 && (
            <div className="p-8 flex flex-col items-center gap-2 text-gray-400">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <span className="text-sm">No hay solicitudes pendientes</span>
            </div>
          )}
          {filtered.map((c) => (
            <SolicitudItem
              key={c.id}
              credito={c}
              isSelected={selectedId === c.id}
              onSelect={() => {
                setSelectedId(c.id)
                resetEvaluacion()
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel: evaluation ── */}
      <div className="lg:w-2/3">
        {!selectedId && (
          <div className="card p-12 h-full flex items-center justify-center text-gray-400 text-center">
            Selecciona una solicitud de la lista para evaluarla
          </div>
        )}

        {selectedId && (
          <div className="space-y-4">
            {detalleLoading && (
              <div className="card p-8 text-center text-gray-400">Cargando detalle...</div>
            )}

            {detalle && !detalleLoading && (
              <>
                {/* Client info card */}
                <div className="card p-5 space-y-4">
                  <h3 className="font-semibold text-gray-800">Información del cliente</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <InfoField label="Nombre" value={detalle.cliente.nombreCompleto} />
                    <InfoField label="Celular" value={detalle.cliente.celular} />
                    <InfoField label="Asesor" value={detalle.asesor.nombreCompleto} />
                    <InfoField label="Sucursal" value={detalle.sucursal.nombre} />
                  </div>

                  {/* Historial crediticio */}
                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Historial crediticio</h4>
                    <HistorialCrediticio clienteId={detalle.cliente.id} />
                  </div>
                </div>

                {/* Evidencia del negocio */}
                {detalle.evidenciaUrls && detalle.evidenciaUrls.length > 0 && (
                  <div className="card p-5 space-y-3">
                    <h3 className="font-semibold text-gray-800">Evidencia del negocio</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {detalle.evidenciaUrls.map((url, i) =>
                        isVideo(url) ? (
                          <button
                            key={url}
                            type="button"
                            onClick={() => window.open(url, '_blank')}
                            className="relative aspect-square rounded-lg overflow-hidden bg-gray-900 flex flex-col items-center justify-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                          >
                            <Play className="w-8 h-8 text-white" />
                            <span className="text-xs text-white/80">Video</span>
                          </button>
                        ) : (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setPreviewUrl(url)}
                            className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-80 transition-opacity cursor-pointer"
                          >
                            <SecurePreviewImage
                              fileUrl={url}
                              alt={`Evidencia ${i + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {/* Evaluación */}
                <div className="card p-5 space-y-4">
                  <h3 className="font-semibold text-gray-800">Evaluación</h3>

                  {/* Monto solicitado (read-only) */}
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
                    Monto solicitado: <strong>{fmt(safeN(detalle.montoSolicitado ?? detalle.montoCapital))}</strong>
                  </div>

                  {/* Monto aprobado input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monto Aprobado <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step={1}
                      value={montoAprobado}
                  onChange={(e) => {
                    setMontoAprobado(e.target.value)
                    triggerCalculo(e.target.value, detalle.tipoPago)
                  }}
                      className="input w-full"
                      placeholder="Ej: 5000"
                    />
                  </div>

                  {/* Calculo card */}
                  <ProductoCalculoCard calculo={calculo} loading={calculoLoading} />

                  {/* Observaciones */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observaciones
                    </label>
                    <textarea
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      rows={3}
                      className="input w-full resize-none"
                      placeholder="Notas o comentarios sobre la evaluación..."
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowRejectModal(true)}
                      className="flex-1 px-4 py-2.5 rounded-lg border-2 border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                      Rechazar solicitud
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowApproveModal(true)}
                      disabled={!canAprobar}
                      className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Aprobar crédito
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Image preview modal ── */}
      {previewUrl && (
        <ImagePreviewModal
          isOpen={true}
          onClose={() => setPreviewUrl(null)}
          imageUrl={previewUrl}
          title="Evidencia del negocio"
        />
      )}

      {/* ── Reject modal ── */}
      {showRejectModal && detalle && (
        <RejectModal
          credito={detalle}
          onClose={() => setShowRejectModal(false)}
          onConfirm={(motivo) => rechazarMutation.mutate(motivo)}
          loading={rechazarMutation.isPending}
        />
      )}

      {/* ── Approve modal ── */}
      {showApproveModal && detalle && calculo && (
        <ApproveModal
          credito={detalle}
          calculo={calculo}
          montoAprobado={montoNum}
          onClose={() => setShowApproveModal(false)}
          onConfirm={() => aprobarMutation.mutate()}
          loading={aprobarMutation.isPending}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium text-gray-800">{value}</div>
    </div>
  )
}

interface SolicitudItemProps {
  credito: CreditoResumen
  isSelected: boolean
  onSelect: () => void
}

function SolicitudItem({ credito: c, isSelected, onSelect }: SolicitudItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
        isSelected ? 'border-l-4 border-l-[#3d6b35] bg-green-50' : 'border-l-4 border-l-transparent',
      ].join(' ')}
    >
      <div className="font-semibold text-gray-800 text-sm">{c.cliente.nombreCompleto}</div>
      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
        <span className="text-sm text-gray-600">{fmt(safeN(c.montoCapital))}</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs text-gray-400">{c.createdAt ? diasDesde(c.createdAt) : '—'}</span>
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{c.asesor.nombreCompleto}</div>
    </button>
  )
}
