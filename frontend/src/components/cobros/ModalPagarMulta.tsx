import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X, AlertTriangle } from 'lucide-react'
import { cobrosService } from '@/services/cobrosService'

interface Props {
  creditoId: number
  nombreCliente: string
  onClose: () => void
  onSuccess: () => void
}

function fmtMoney(v: number) {
  return `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

function fmtDate(v: string) {
  return new Date(v + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function ModalPagarMulta({ creditoId, nombreCliente, onClose, onSuccess }: Props) {
  const qc = useQueryClient()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const { data: multas = [], isLoading } = useQuery({
    queryKey: ['multas-credito', creditoId],
    queryFn: () => cobrosService.getMultasPorCredito(creditoId),
    staleTime: 30_000,
  })

  const pendientes = multas.filter((m) => !m.cobrada && !m.condonada)
  const total = pendientes.reduce((sum, m) => sum + Number(m.monto), 0)

  const mutation = useMutation({
    mutationFn: () => cobrosService.pagarMultas(creditoId),
    onSuccess: () => {
      toast.success('Multas cubiertas correctamente')
      qc.invalidateQueries({ queryKey: ['ruta-dia'] })
      qc.invalidateQueries({ queryKey: ['multas-credito', creditoId] })
      qc.invalidateQueries({ queryKey: ['credito', creditoId] })
      qc.invalidateQueries({ queryKey: ['pagos-cliente-credito'] })
      qc.invalidateQueries({ queryKey: ['historial-cobros'] })
      onSuccess()
      onClose()
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Error al cubrir las multas')
    },
  })

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[2000] flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:w-[440px] sm:max-w-[95vw] rounded-t-2xl sm:rounded-xl max-h-[92dvh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9ecef] sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-[#212529]">Cubrir multas</h2>
            <p className="text-[12px] text-[#6c757d] mt-0.5">{nombreCliente}</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {isLoading ? (
            <p className="text-[13px] text-[#6c757d] text-center py-4">Cargando multas...</p>
          ) : pendientes.length === 0 ? (
            <p className="text-[13px] text-[#6c757d] text-center py-4">Este crédito no tiene multas pendientes.</p>
          ) : (
            <>
              <div className="rounded-lg border border-[#e9ecef] overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#f8f9fa]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#6c757d] font-medium">Fecha</th>
                      <th className="text-left px-3 py-2 text-[#6c757d] font-medium">Tipo</th>
                      <th className="text-right px-3 py-2 text-[#6c757d] font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendientes.map((m) => (
                      <tr key={m.id} className="border-t border-[#f1f3f5]">
                        <td className="px-3 py-2 text-[#212529]">{fmtDate(m.fecha)}</td>
                        <td className="px-3 py-2 text-[#6c757d]">
                          {m.tipo === 'NO_PAGO' ? 'No pagó' : 'Pago incompleto'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#92400e]">{fmtMoney(Number(m.monto))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg bg-[#fef3c7] border border-[#fde68a] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#92400e]" />
                  <span className="text-[13px] font-semibold text-[#92400e]">Total a cubrir</span>
                </div>
                <span className="text-[16px] font-bold text-[#92400e]">{fmtMoney(total)}</span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-[#e9ecef] px-5 py-4 flex gap-3">
          <button type="button" onClick={onClose} className="btn flex-1 py-3 text-[14px]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={pendientes.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="flex-1 py-3 rounded-lg border-2 border-[#dc2626] bg-[#dc2626] text-white text-[14px] font-semibold hover:bg-[#b91c1c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mutation.isPending ? 'Cubriendo...' : `Cubrir ${fmtMoney(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
