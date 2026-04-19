import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X, AlertTriangle, CheckCircle } from 'lucide-react'
import { cobrosService } from '@/services/cobrosService'


const RAZONES = [
  'No estaba en el negocio',
  'No tenía dinero',
  'Enfermedad',
  'Negocio cerrado',
  'No le alcanzó',
  'Otro',
]

interface Props {
  creditoId: number
  pagoPeriodico: number
  nombreCliente: string
  fecha: string
  numeroPagoHoy?: number | null
  onClose: () => void
  onSuccess: () => void
}

function extractErrorMessage(error: unknown): string {
  if (!error) return ''

  if (typeof error === 'string') return error

  if (error instanceof Error && error.message) {
    return error.message
  }

  const anyError = error as any
  const candidate =
    anyError?.message
    ?? anyError?.response?.data?.message
    ?? anyError?.response?.data?.error
    ?? anyError?.response?.data?.detail

  return typeof candidate === 'string' ? candidate : ''
}

function getRegistrarPagoErrorMessage(error: unknown, fecha: string) {
  const rawMessage = extractErrorMessage(error).trim()
  const message = rawMessage.toLowerCase()

  if (message.includes('no hay pago pendiente para la fecha seleccionada')) {
    const hoy = new Date().toISOString().slice(0, 10)
    if (fecha === hoy) {
      return 'No hay pagos pendientes para hoy en este crédito.'
    }
    return 'No hay pagos pendientes para la fecha seleccionada.'
  }

  return rawMessage || 'Error al registrar pago'
}

export default function ModalRegistrarPago({
  creditoId,
  pagoPeriodico,
  nombreCliente,
  fecha,
  numeroPagoHoy,
  onClose,
  onSuccess,
}: Props) {
  const qc = useQueryClient()

  // ── Estado del form ───────────────────────────────────────────────
  const [noPago, setNoPago] = useState(false)
  const [monto, setMonto] = useState(String(pagoPeriodico))
  const [razon, setRazon] = useState('')
  const [razonCustom, setRazonCustom] = useState('')

  // ── Multas pendientes ─────────────────────────────────────────────
  const { data: multas = [] } = useQuery({
    queryKey: ['multas-credito', creditoId],
    queryFn: () => cobrosService.getMultasPorCredito(creditoId),
    staleTime: 30_000,
  })

  const multasPendientes = multas
    .filter((m) => !m.cobrada)
    .reduce((sum, m) => sum + Number(m.monto), 0)

  // Pre-fill monto al abrir (pagoPeriodico + multas pendientes)
  useEffect(() => {
    const total = Number(pagoPeriodico) + multasPendientes
    setMonto(String(total > 0 ? total : pagoPeriodico))
  }, [pagoPeriodico, multasPendientes])

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Mutación ──────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => {
      const razonFinal = razon === 'Otro' ? razonCustom.trim() : razon
      return cobrosService.registrar({
        creditoId,
        noPago,
        montoRecibido: noPago ? undefined : Number(monto),
        razonNoPago: noPago ? razonFinal : undefined,
        fechaPago: fecha,
      })
    },
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
    onError: (e: unknown) => {
      toast.error(getRegistrarPagoErrorMessage(e, fecha))
    },
  })

  // ── Validación ────────────────────────────────────────────────────
  function canSubmit() {
    if (mutation.isPending) return false
    if (noPago) {
      const r = razon === 'Otro' ? razonCustom.trim() : razon
      return r.length > 0
    }
    const n = Number(monto)
    return Number.isFinite(n) && n > 0
  }

  const montoNum = Number(monto)
  const montoEsperado = Number(pagoPeriodico)
  const esAbono = !noPago && Number.isFinite(montoNum) && montoNum > 0 && montoNum < montoEsperado

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[2000] flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:w-[480px] sm:max-w-[95vw] rounded-t-2xl sm:rounded-xl max-h-[92dvh] overflow-y-auto shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9ecef] sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-[#212529]">Registrar cobro</h2>
            <p className="text-[12px] text-[#6c757d] mt-0.5">{nombreCliente}</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">

          {/* ── Info: pago y multas ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f8f9fa] rounded-lg p-3 text-center">
              <p className="text-[11px] text-[#6c757d] mb-0.5">
                {numeroPagoHoy ? `Pago #${numeroPagoHoy}` : 'Pago diario'}
              </p>
              <p className="text-[18px] font-bold text-[#212529]">
                ${Number(pagoPeriodico).toLocaleString('es-MX')}
              </p>
            </div>
            <div className={`rounded-lg p-3 text-center ${multasPendientes > 0 ? 'bg-[#fef3c7]' : 'bg-[#f8f9fa]'}`}>
              <p className="text-[11px] text-[#6c757d] mb-0.5">Multas pendientes</p>
              <p className={`text-[18px] font-bold ${multasPendientes > 0 ? 'text-[#92400e]' : 'text-[#adb5bd]'}`}>
                {multasPendientes > 0
                  ? `$${multasPendientes.toLocaleString('es-MX')}`
                  : '$0'}
              </p>
            </div>
          </div>

          {/* ── Toggle Pagó / No pagó ── */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setNoPago(false)}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-[14px] transition-colors ${
                !noPago
                  ? 'bg-[#d1fae5] border-[#059669] text-[#065f46]'
                  : 'border-[#dee2e6] text-[#adb5bd] hover:border-[#ced4da]'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              Sí pagó
            </button>
            <button
              type="button"
              onClick={() => setNoPago(true)}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-[14px] transition-colors ${
                noPago
                  ? 'bg-[#fee2e2] border-[#dc2626] text-[#991b1b]'
                  : 'border-[#dee2e6] text-[#adb5bd] hover:border-[#ced4da]'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
              No pagó
            </button>
          </div>

          {/* ── SI PAGÓ: monto ── */}
          {!noPago && (
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#495057] mb-1">
                  Monto recibido <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6c757d] text-[13px]">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    className="input pl-7"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                </div>
                {esAbono && (
                  <p className="text-[11px] text-[#f59e0b] mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Abono parcial — monto menor al pago esperado (${montoEsperado.toLocaleString('es-MX')})
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── SI NO PAGÓ: razón ── */}
          {noPago && (
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#495057] mb-2">
                  Razón del no pago <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {RAZONES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => { setRazon(r); setRazonCustom('') }}
                      className={`px-3 py-1.5 rounded-full border text-[12px] font-medium transition-colors ${
                        razon === r
                          ? 'bg-[#fee2e2] border-[#dc2626] text-[#991b1b]'
                          : 'border-[#dee2e6] text-[#495057] hover:border-[#adb5bd]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {razon === 'Otro' && (
                  <input
                    type="text"
                    className="input mt-2"
                    placeholder="Especificar razón..."
                    value={razonCustom}
                    onChange={(e) => setRazonCustom(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
              <div className="alert alert-warn flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Se aplicará una multa automáticamente al registrar no pago.</span>
              </div>
            </div>
          )}


        </div>

        {/* ── Footer ── */}
        <div className="sticky bottom-0 bg-white border-t border-[#e9ecef] px-5 py-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn flex-1 py-3 text-[14px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSubmit()}
            onClick={() => mutation.mutate()}
            className={`flex-1 py-3 rounded-lg border-2 text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              noPago
                ? 'bg-[#dc2626] border-[#dc2626] text-white hover:bg-[#b91c1c]'
                : 'bg-[#2d6a4f] border-[#2d6a4f] text-white hover:bg-[#1b4332]'
            }`}
          >
            {mutation.isPending
              ? 'Guardando...'
              : noPago
              ? 'Registrar no pago'
              : 'Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}
