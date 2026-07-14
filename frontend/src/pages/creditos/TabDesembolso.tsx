import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Calendar, X, AlertTriangle } from 'lucide-react'
import { creditoService } from '@/services/creditoService'
import { useAuthStore } from '@/hooks/useAuthStore'
import type { CreditoResumen, CreditoDetalle } from '@/types'
import type { ApiError } from '@/types'

// ── Helpers ────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(safeN(n))
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function fmtDateFull(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function safeN(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Generate N business dates starting from tomorrow (skip Sat=6, Sun=0)
function generarFechasEstimadas(n: number): Date[] {
  const fechas: Date[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  cursor.setDate(cursor.getDate() + 1) // start tomorrow
  while (fechas.length < n) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) fechas.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return fechas
}

// ── Sub-components ────────────────────────────────────────────────

interface CreditoItemProps {
  credito: CreditoResumen
  isSelected: boolean
  onSelect: () => void
}

function CreditoItem({ credito: c, isSelected, onSelect }: CreditoItemProps) {
  const monto = safeN(c.montoAprobado ?? c.montoCapital)
  const fechaAprobacion = c.createdAt
    ? new Date(c.createdAt).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
        isSelected
          ? 'border-l-4 border-l-[#3d6b35] bg-green-50'
          : 'border-l-4 border-l-transparent',
      ].join(' ')}
    >
      <div className="font-semibold text-gray-800 text-sm">{c.cliente.nombreCompleto}</div>
      <div className="text-sm font-medium text-[#3d6b35] mt-0.5">{fmt(monto)}</div>
      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
        <span className="text-xs text-gray-500">Pago diario: {fmt(c.pagoPeriodico)}</span>
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{c.asesor.nombreCompleto}</div>
      <div className="text-xs text-gray-400">Aprobado: {fechaAprobacion}</div>
    </button>
  )
}

// ── Confirmation modal ────────────────────────────────────────────

interface ConfirmModalProps {
  detalle: CreditoDetalle
  fechas: Date[]
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}

function ConfirmModal({ detalle, fechas, onClose, onConfirm, loading }: ConfirmModalProps) {
  const monto = safeN(detalle.montoAprobado ?? detalle.montoCapital)
  const pagoAdelantado = safeN(detalle.pagoAdelantado)
  const montoAEntregar = monto - pagoAdelantado
  const primerPago = fechas[0]
  const ultimoPago = fechas[fechas.length - 1]

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-gray-800">Confirmar desembolso</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-red-600 font-medium">Esta acción no puede deshacerse.</p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Cliente</span>
              <div className="font-semibold text-gray-800">{detalle.cliente.nombreCompleto}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">Monto aprobado</span>
                <div className="font-bold text-[#3d6b35] text-base">{fmt(monto)}</div>
              </div>
              <div>
                <span className="text-gray-500">Pago adelantado</span>
                <div className="font-medium text-orange-600">− {fmt(pagoAdelantado)}</div>
              </div>
            </div>
            <div className="border-t border-green-200 pt-2">
              <span className="text-gray-500">A entregar al cliente</span>
              <div className="font-extrabold text-[#3d6b35] text-xl">{fmt(montoAEntregar)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-green-200 pt-2">
              <div>
                <span className="text-gray-500">Primer pago</span>
                <div className="font-medium">{primerPago ? fmtDate(primerPago) : '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Último pago</span>
                <div className="font-medium">{ultimoPago ? fmtDate(ultimoPago) : '—'}</div>
              </div>
            </div>
          </div>

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
              {loading ? 'Activando...' : 'Confirmar desembolso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Calendar preview card ─────────────────────────────────────────

interface CalendarioPreviewProps {
  plazoDias: number
  pagoPeriodico: number
  pagoAdelantado: number
}

function CalendarioPreview({ plazoDias, pagoPeriodico, pagoAdelantado }: CalendarioPreviewProps) {
  const n = safeN(plazoDias)
  const pago = safeN(pagoPeriodico)
  const fechas = generarFechasEstimadas(n)
  const hoy = new Date().toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [n])

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-[#3d6b35]" />
        <h3 className="font-semibold text-gray-800">Calendario que se generará</h3>
      </div>
      <p className="text-sm text-gray-600">
        El calendario se generará con{' '}
        <strong>{n} días hábiles</strong> a partir de hoy ({hoy}). Los sábados,
        domingos y días festivos se omiten automáticamente.
      </p>

      {/* Scrollable table — muestra el último pago (adelantado) por defecto */}
      <div ref={scrollRef} className="overflow-auto max-h-52 rounded-lg border border-gray-200">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Fecha estimada</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Monto</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fechas.map((fecha, idx) => {
              const isLast = idx === fechas.length - 1
              const nota = isLast ? 'Pago adelantado' : ''
              const montoFila = isLast ? (safeN(pagoAdelantado) > 0 ? safeN(pagoAdelantado) : pago) : pago

              return (
                <tr key={fecha.toISOString()} className={isLast ? 'bg-green-50' : ''}>
                  <td className="px-3 py-1.5 text-gray-700">{idx + 1}</td>
                  <td className="px-3 py-1.5 text-gray-700">{fmtDate(fecha)}</td>
                  <td className="px-3 py-1.5 text-right text-gray-700">{fmt(montoFila)}</td>
                  <td className="px-3 py-1.5 text-gray-500 italic">{nota}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        * Fechas estimadas. Las fechas exactas consideran días festivos configurados.
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

interface Props {
  initialCreditoId?: number
}

export default function TabDesembolso({ initialCreditoId }: Props) {
  const { usuario } = useAuthStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const isAuthorized =
    usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'

  // ── State ──────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<number | null>(initialCreditoId ?? null)
  const [showModal, setShowModal] = useState(false)

  // ── Queries ────────────────────────────────────────────────────
  const { data: listData, isLoading: listLoading, isError: listError } = useQuery({
    queryKey: ['creditos-aprobados'],
    queryFn: () => creditoService.listar({ estado: 'APROBADO', size: 50 }),
    enabled: isAuthorized,
  })

  const aprobados = listData?.content ?? []

  const { data: detalle, isLoading: detalleLoading, isError: detalleError } = useQuery({
    queryKey: ['credito-detalle', selectedId],
    queryFn: () => creditoService.obtener(selectedId!),
    enabled: selectedId !== null,
  })

  // ── Mutation ───────────────────────────────────────────────────
  const activarMutation = useMutation({
    mutationFn: () => creditoService.activarCredito(selectedId!),
    onSuccess: (result) => {
      toast.success('Crédito activado correctamente')
      queryClient.invalidateQueries({ queryKey: ['creditos-aprobados'] })
      queryClient.invalidateQueries({ queryKey: ['creditos'] })
      setShowModal(false)
      navigate(`/creditos/${result.id}`)
    },
    onError: (err: ApiError) => {
      toast.error(err.message ?? 'Error al activar el crédito')
    },
  })

  // ── Role guard ─────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="card p-10 text-center text-gray-500">
        No tienes permisos para realizar desembolsos.
      </div>
    )
  }

  // ── Derived state ──────────────────────────────────────────────
  const fechasEstimadas =
    detalle ? generarFechasEstimadas(safeN(detalle.plazoDias)) : []

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[600px]">

      {/* ── Left panel: approved credits list ── */}
      <div className="lg:w-1/3 space-y-3">
        <h2 className="font-semibold text-gray-800">Créditos listos para desembolsar</h2>

        <div className="card divide-y divide-gray-100 overflow-hidden">
          {listLoading && (
            <div className="p-6 text-center text-gray-400 text-sm">Cargando...</div>
          )}
          {listError && (
            <div className="p-6 text-center text-sm text-red-600">Error al cargar créditos</div>
          )}
          {!listLoading && aprobados.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">
              No hay créditos pendientes de desembolso
            </div>
          )}
          {aprobados.map((c) => (
            <CreditoItem
              key={c.id}
              credito={c}
              isSelected={selectedId === c.id}
              onSelect={() => setSelectedId(c.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel: desembolso detail ── */}
      <div className="lg:w-2/3">
        {!selectedId && (
          <div className="card p-12 h-full flex items-center justify-center text-gray-400 text-center">
            Selecciona un crédito para desembolsar
          </div>
        )}

        {selectedId && (
          <div className="space-y-4">
            {detalleLoading && (
              <div className="card p-8 text-center text-gray-400">Cargando detalle...</div>
            )}
            {selectedId && detalleError && (
              <div className="card p-8 text-center text-red-600 text-sm">Error al cargar detalle del crédito</div>
            )}

            {detalle && !detalleLoading && (
              <>
                {/* 1. Summary card */}
                <div className="card p-5 space-y-4 border border-green-200 bg-green-50/40">
                  <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                    <span>✓</span>
                    <span>Crédito aprobado — listo para desembolsar</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Cliente</div>
                      <div className="font-semibold text-gray-800">
                        {detalle.cliente.nombreCompleto}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Monto aprobado</div>
                      <div className="font-bold text-[#3d6b35] text-xl">
                        {fmt(detalle.montoAprobado ?? detalle.montoCapital)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Pago diario</div>
                      <div className="font-semibold text-gray-800">
                        {fmt(detalle.pagoPeriodico)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Plazo</div>
                      <div className="font-semibold text-gray-800">
                        {safeN(detalle.plazoDias)} días
                      </div>
                    </div>
                  </div>

                  {(detalle.aprobadoPor || detalle.fechaAprobacion) && (
                    <div className="border-t border-green-200 pt-3 text-sm text-gray-600">
                      {detalle.aprobadoPor && (
                        <span>Aprobado por: <strong>{detalle.aprobadoPor.nombreCompleto}</strong></span>
                      )}
                      {detalle.fechaAprobacion && (
                        <span className="ml-3">{fmtDateFull(detalle.fechaAprobacion)}</span>
                      )}
                    </div>
                  )}

                  {detalle.observaciones && (
                    <div className="border-t border-green-200 pt-3 text-sm text-gray-600">
                      <span className="font-medium">Observaciones:</span>{' '}
                      {detalle.observaciones}
                    </div>
                  )}
                </div>

                {/* 2. Calendar preview */}
                <CalendarioPreview
                  plazoDias={detalle.plazoDias}
                  pagoPeriodico={detalle.pagoPeriodico}
                  pagoAdelantado={detalle.pagoAdelantado}
                />

                {/* 3. Activate button */}
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  disabled={activarMutation.isPending}
                  className="w-full py-3 px-4 rounded-lg bg-[#3d6b35] text-white font-semibold text-base hover:bg-[#5a8f50] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirmar desembolso y activar crédito
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Confirmation modal ── */}
      {showModal && detalle && (
        <ConfirmModal
          detalle={detalle}
          fechas={fechasEstimadas}
          onClose={() => setShowModal(false)}
          onConfirm={() => activarMutation.mutate()}
          loading={activarMutation.isPending}
        />
      )}
    </div>
  )
}
