import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { X, AlertTriangle, CheckCircle, Minus } from 'lucide-react'
import { cobrosService } from '@/services/cobrosService'
import { creditoService } from '@/services/creditoService'
import { todayLocalStr } from '@/utils/date'
import type { AbonoCoberturaDTO } from '@/types'

interface Props {
  creditoId: number
  nombreCliente: string
  onClose: () => void
  onSuccess: () => void
}

function fmtMoney(v: number) {
  return `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
  })
}

interface DistribucionRow extends AbonoCoberturaDTO {
  noAlcanza: boolean
}

function computeDistribucion(
  monto: number,
  slots: Array<{ id: number; numeroPago: number; fechaProgramada: string; montoEsperado: number; estado: string }>,
  multasPendientes: Array<{ fecha: string; monto: number; cobrada: boolean }>,
  abonosExistentes: Array<{ coberturas: AbonoCoberturaDTO[] }>,
  hoy: string,
): DistribucionRow[] {
  const eligibles = slots.filter((p) => {
    if (p.estado === 'NO_PAGADO' || p.estado === 'RECUPERADO_PARCIAL') return true
    if (p.estado === 'PENDIENTE' && p.fechaProgramada <= hoy) return true
    return false
  }).sort((a, b) => a.numeroPago - b.numeroPago)

  const yaAbonado: Record<number, number> = {}
  const multaYaAbonada: Record<number, number> = {}
  for (const abono of abonosExistentes) {
    for (const c of abono.coberturas) {
      const slot = slots.find((s) => s.numeroPago === c.numeroPago)
      if (slot) {
        yaAbonado[slot.id] = (yaAbonado[slot.id] ?? 0) + c.totalAplicado
        multaYaAbonada[slot.id] = (multaYaAbonada[slot.id] ?? 0) + c.montoMulta
      }
    }
  }

  let saldo = monto
  const rows: DistribucionRow[] = []

  for (const slot of eligibles) {
    const multasDia = multasPendientes.filter(
      (m) => m.fecha === slot.fechaProgramada && !m.cobrada,
    )
    const totalMultasDia = multasDia.reduce((s, m) => s + Number(m.monto), 0)
    const costoRestante =
      Number(slot.montoEsperado) +
      totalMultasDia -
      (yaAbonado[slot.id] ?? 0)

    if (costoRestante <= 0) continue

    if (saldo <= 0) {
      rows.push({
        numeroPago: slot.numeroPago,
        fechaProgramada: slot.fechaProgramada,
        montoCuota: 0,
        montoMulta: 0,
        totalAplicado: 0,
        esParcial: false,
        noAlcanza: true,
      })
      continue
    }

    const aplicar = Math.min(saldo, costoRestante)
    saldo -= aplicar
    const esParcial = aplicar < costoRestante

    const multaRestante = Math.max(0, totalMultasDia - (multaYaAbonada[slot.id] ?? 0))
    const montoMultaAplicado = Math.min(aplicar, multaRestante)
    const montoCuotaAplicado = aplicar - montoMultaAplicado

    rows.push({
      numeroPago: slot.numeroPago,
      fechaProgramada: slot.fechaProgramada,
      montoCuota: montoCuotaAplicado,
      montoMulta: montoMultaAplicado,
      totalAplicado: aplicar,
      esParcial,
      noAlcanza: false,
    })
  }

  return rows
}

export default function ModalPagarAdeudo({ creditoId, nombreCliente, onClose, onSuccess }: Props) {
  const qc = useQueryClient()
  const hoy = useMemo(() => todayLocalStr(), [])
  const [monto, setMonto] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const { data: credito } = useQuery({
    queryKey: ['credito', creditoId],
    queryFn: () => creditoService.obtener(creditoId),
    staleTime: 30_000,
  })

  const { data: multas = [] } = useQuery({
    queryKey: ['multas-credito', creditoId],
    queryFn: () => cobrosService.getMultasPorCredito(creditoId),
    staleTime: 30_000,
  })

  const { data: abonosExistentes = [] } = useQuery({
    queryKey: ['abonos-credito', creditoId],
    queryFn: () => cobrosService.getAbonosPorCredito(creditoId),
    staleTime: 30_000,
  })

  const calendario = credito?.calendario ?? []
  const montoNum = Number(monto)
  const montoValido = Number.isFinite(montoNum) && montoNum > 0

  const distribucion = useMemo(() => {
    if (!montoValido) return []
    return computeDistribucion(montoNum, calendario, multas, abonosExistentes, hoy)
  }, [montoNum, calendario, multas, abonosExistentes, hoy, montoValido])

  const montoParaCorriente = useMemo(() => {
    const eligibles = calendario.filter((p) => {
      if (p.estado === 'NO_PAGADO' || p.estado === 'RECUPERADO_PARCIAL') return true
      if (p.estado === 'PENDIENTE' && p.fechaProgramada <= hoy) return true
      return false
    })
    return eligibles.reduce((sum, slot) => {
      const multasDia = multas
        .filter((m) => m.fecha === slot.fechaProgramada && !m.cobrada)
        .reduce((s, m) => s + Number(m.monto), 0)
      return sum + Number(slot.montoEsperado) + multasDia
    }, 0)
  }, [calendario, multas, hoy])

  const diasAtrasados = useMemo(() =>
    calendario.filter((p) => {
      if (p.estado === 'NO_PAGADO' || p.estado === 'RECUPERADO_PARCIAL') return true
      if (p.estado === 'PENDIENTE' && p.fechaProgramada <= hoy) return true
      return false
    }).length,
    [calendario, hoy],
  )

  const mutation = useMutation({
    mutationFn: () =>
      cobrosService.registrarAbonoCorrente({
        creditoId,
        montoRecibido: montoNum,
      }),
    onSuccess: () => {
      toast.success('Abono registrado correctamente')
      qc.invalidateQueries({ queryKey: ['ruta-dia'] })
      qc.invalidateQueries({ queryKey: ['credito', creditoId] })
      qc.invalidateQueries({ queryKey: ['multas-credito', creditoId] })
      qc.invalidateQueries({ queryKey: ['abonos-credito', creditoId] })
      qc.invalidateQueries({ queryKey: ['pagos-cliente-credito'] })
      onSuccess()
      onClose()
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } }; message?: string }
      const msg = err?.response?.data?.message ?? err?.message ?? 'Error al registrar abono'
      toast.error(msg)
    },
  })

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[2000] flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:w-[520px] sm:max-w-[95vw] rounded-t-2xl sm:rounded-xl max-h-[92dvh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9ecef] sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-[#212529]">Pagar adeudo</h2>
            <p className="text-[12px] text-[#6c757d] mt-0.5">{nombreCliente}</p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* Resumen de adeudo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-[11px] text-[#6c757d] mb-0.5">Días atrasados</p>
              <p className="text-[20px] font-bold text-red-600">{diasAtrasados}</p>
            </div>
            <div className="bg-[#fef3c7] rounded-lg p-3 text-center">
              <p className="text-[11px] text-[#6c757d] mb-0.5">Para ponerse al corriente</p>
              <p className="text-[16px] font-bold text-[#92400e]">{fmtMoney(montoParaCorriente)}</p>
            </div>
          </div>

          {/* Input monto */}
          <div>
            <label className="block text-[12px] font-medium text-[#495057] mb-1">
              Monto a recibir <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6c757d] text-[13px]">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                className="input pl-7"
                placeholder="0.00"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Tabla de distribución */}
          {montoValido && distribucion.length > 0 && (
            <div>
              <p className="text-[12px] font-medium text-[#495057] mb-2">Distribución:</p>
              <div className="rounded-lg border border-[#e9ecef] overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#f8f9fa]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#6c757d] font-medium"># / Fecha</th>
                      <th className="text-right px-3 py-2 text-[#6c757d] font-medium">Aplicado</th>
                      <th className="text-center px-3 py-2 text-[#6c757d] font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distribucion.map((row) => (
                      <tr key={row.numeroPago} className="border-t border-[#f1f3f5]">
                        <td className="px-3 py-2">
                          <span className="font-medium text-[#212529]">#{row.numeroPago}</span>
                          <span className="text-[#adb5bd] ml-1">— {fmtDate(row.fechaProgramada)}</span>
                        </td>
                        <td className="text-right px-3 py-2 font-mono text-[#212529]">
                          {row.noAlcanza ? <span className="text-[#adb5bd]">—</span> : fmtMoney(row.totalAplicado)}
                        </td>
                        <td className="text-center px-3 py-2">
                          {row.noAlcanza ? (
                            <span className="inline-flex items-center gap-1 text-[#adb5bd]">
                              <Minus className="w-3 h-3" /> no alcanza
                            </span>
                          ) : row.esParcial ? (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <AlertTriangle className="w-3 h-3" /> parcial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-3 h-3" /> completo
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-[#e9ecef] px-5 py-4 flex gap-3">
          <button type="button" onClick={onClose} className="btn flex-1 py-3 text-[14px]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!montoValido || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="flex-1 py-3 rounded-lg border-2 border-[#d97706] bg-[#d97706] text-white text-[14px] font-semibold hover:bg-[#b45309] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mutation.isPending ? 'Registrando...' : 'Confirmar abono'}
          </button>
        </div>
      </div>
    </div>
  )
}
