import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import { cobrosService } from '@/services/cobrosService'
import type { PagoCobroDTO } from '@/types'

interface Props {
  pago: PagoCobroDTO
  onClose: () => void
  onSuccess: () => void
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default function ModalModificarPago({ pago, onClose, onSuccess }: Props) {
  const qc = useQueryClient()

  const [monto, setMonto] = useState(String(pago.montoRecibido))
  const [razonNoPago, setRazonNoPago] = useState(pago.razonNoPago ?? '')
  const [condonarMultaDia, setCondonarMultaDia] = useState(false)
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const mutation = useMutation({
    mutationFn: () =>
      cobrosService.modificar(pago.id, {
        montoRecibido: Number(monto) || undefined,
        razonNoPago: razonNoPago || undefined,
        condonarMultaDia,
        motivoModificacion: motivo.trim(),
      }),
    onSuccess: () => {
      toast.success('Pago modificado')
      qc.invalidateQueries({ queryKey: ['ruta-dia'] })
      qc.invalidateQueries({ queryKey: ['historial-cobros'] })
      qc.invalidateQueries({ queryKey: ['multas-credito', pago.creditoId] })
      qc.invalidateQueries({ queryKey: ['preview-multas-abono', pago.creditoId] })
      onSuccess()
      onClose()
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al modificar pago'),
  })

  const canSubmit = motivo.trim().length > 0 && !mutation.isPending

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[2000] flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:w-[480px] sm:max-w-[95vw] rounded-t-2xl sm:rounded-xl max-h-[92dvh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9ecef]">
          <div>
            <h2 className="text-[15px] font-semibold text-[#212529]">Modificar pago</h2>
            <p className="text-[12px] text-[#6c757d] mt-0.5">
              {pago.cliente.nombreCompleto} — Pago #{pago.numeroPago}
            </p>
            <p className="text-[11px] text-[#6c757d] mt-0.5">
              Fecha y hora de registro: {fmtDateTime(pago.createdAt)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#495057] mb-1">
              Monto recibido
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6c757d] text-[13px]">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                className="input pl-7"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
          </div>



          <div>
            <label className="block text-[12px] font-medium text-[#495057] mb-1">
              Razón de no pago (si aplica)
            </label>
            <input
              type="text"
              className="input"
              placeholder="Dejar vacío si sí pagó"
              value={razonNoPago}
              onChange={(e) => setRazonNoPago(e.target.value)}
            />
          </div>

          <div>
            <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-amber-600"
                checked={condonarMultaDia}
                onChange={(e) => setCondonarMultaDia(e.target.checked)}
              />
              <span>
                <span className="block text-[13px] font-semibold text-amber-900">Condonar multa de este día</span>
                <span className="block text-[11px] text-amber-800 mt-0.5">
                  Condonará únicamente las multas pendientes del {pago.fechaPago} asociadas a este crédito.
                </span>
              </span>
            </label>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#495057] mb-1">
              Motivo de la modificación <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Error en monto registrado"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <p className="text-[11px] text-[#adb5bd] mt-1">Requerido para bitácora de auditoría.</p>
          </div>
        </div>

        <div className="border-t border-[#e9ecef] px-5 py-4 flex gap-3">
          <button type="button" onClick={onClose} className="btn flex-1 py-3 text-[14px]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
            className="btn-primary flex-1 py-3 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
