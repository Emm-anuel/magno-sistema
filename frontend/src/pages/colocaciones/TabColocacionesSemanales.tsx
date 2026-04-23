import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { renovacionService } from '@/services/renovacionService'
import { useAuthStore } from '@/hooks/useAuthStore'
import { api } from '@/services/api'
import TipoPagoBadge from '@/components/TipoPagoBadge'
import type { ColocacionItem, TipoPago } from '@/types'

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function lunesDe(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function toIso(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addWeeks(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + n * 7)
  return result
}

function formatWeek(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const end = new Date(d)
  end.setDate(end.getDate() + 4)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    + ' – '
    + end.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function TipoBadge({ tipo }: { tipo: ColocacionItem['tipo'] }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'
  return tipo === 'RENOVACION'
    ? <span className={`${base} bg-blue-100 text-blue-700`}>Renovación</span>
    : <span className={`${base} bg-green-100 text-green-700`}>Crédito Nuevo</span>
}

export default function TabColocacionesSemanales() {
  const { usuario } = useAuthStore()
  const [semana, setSemana] = useState(() => toIso(lunesDe(new Date())))

  const { data, isLoading, isError } = useQuery({
    queryKey: ['colocaciones', semana, usuario?.id],
    queryFn: () => renovacionService.getColocaciones({ semanaInicio: semana }),
    staleTime: 60_000,
  })

  function navigate(n: number) {
    const d = new Date(semana + 'T12:00:00')
    setSemana(toIso(addWeeks(d, n)))
  }

  async function handleExportPdf() {
    try {
      const response = await api.get('/renovaciones/colocaciones/pdf', {
        params: { semanaInicio: semana },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `colocaciones-${semana}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // toast handled by axios interceptor
    }
  }

  return (
    <div className="w-full space-y-4">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Week selector */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn p-2"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
            {formatWeek(semana)}
          </span>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="btn p-2"
            aria-label="Semana siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Export */}
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={!data || data.items.length === 0}
          className="btn flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Exportar PDF
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="card p-8 text-center text-gray-400 animate-pulse">
          Cargando colocaciones...
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="card p-8 text-center text-red-500">
          Error al cargar las colocaciones.
        </div>
      )}

      {/* Table — desktop */}
      {data && !isLoading && (
        <>
          {data.items.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              No hay colocaciones registradas esta semana.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="py-3 pr-4 font-medium">Fecha</th>
                      <th className="py-3 pr-4 font-medium">Cliente</th>
                      <th className="py-3 pr-4 font-medium text-right">Créd. Anterior</th>
                      <th className="py-3 pr-4 font-medium text-right">Créd. Nuevo</th>
                      <th className="py-3 pr-4 font-medium text-right">Desembolso</th>
                      <th className="py-3 pr-4 font-medium">Forma de Pago</th>
                      <th className="py-3 pr-4 font-medium">Asesor</th>
                      <th className="py-3 font-medium">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.items.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                          {new Date(item.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
                            weekday: 'short', day: '2-digit', month: 'short',
                          })}
                        </td>
                        <td className="py-3 pr-4 font-medium text-gray-800">{item.clienteNombre}</td>
                        <td className="py-3 pr-4 text-gray-600 text-right">{fmt(item.creditoAnterior)}</td>
                        <td className="py-3 pr-4 text-gray-800 font-medium text-right">{fmt(item.creditoNuevo)}</td>
                        <td className="py-3 pr-4 text-[#3d6b35] font-semibold text-right">{fmt(item.desembolso)}</td>
                        <td className="py-3 pr-4">
                          <TipoPagoBadge tipo={item.tipoPago as TipoPago} size="sm" />
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{item.asesorNombre}</td>
                        <td className="py-3">
                          <TipoBadge tipo={item.tipo} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td colSpan={5} className="py-3 pr-4 text-right text-sm font-semibold text-gray-700">
                        Total Desembolsos
                      </td>
                      <td className="py-3 pr-4 text-right text-sm font-bold text-[#3d6b35]">
                        {fmt(data.totalDesembolsos)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {data.items.map((item, i) => (
                  <div key={i} className="card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-gray-800">{item.clienteNombre}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(item.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
                            weekday: 'long', day: '2-digit', month: 'long',
                          })}
                        </div>
                      </div>
                      <TipoBadge tipo={item.tipo} />
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      {item.creditoAnterior != null && (
                        <>
                          <span className="text-gray-500">Créd. anterior</span>
                          <span className="text-right font-medium">{fmt(item.creditoAnterior)}</span>
                        </>
                      )}
                      <span className="text-gray-500">Créd. nuevo</span>
                      <span className="text-right font-medium">{fmt(item.creditoNuevo)}</span>
                      <span className="text-gray-500">Desembolso</span>
                      <span className="text-right font-bold text-[#3d6b35]">{fmt(item.desembolso)}</span>
                      <span className="text-gray-500">Forma de pago</span>
                      <span className="text-right">
                        <TipoPagoBadge tipo={item.tipoPago as TipoPago} size="sm" />
                      </span>
                      <span className="text-gray-500">Asesor</span>
                      <span className="text-right text-gray-700">{item.asesorNombre}</span>
                    </div>
                  </div>
                ))}

                {/* Mobile totals */}
                <div className="card p-4 bg-gray-50 border-2 border-gray-200 space-y-2">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-700">Total Desembolsos</span>
                    <span className="text-[#3d6b35]">{fmt(data.totalDesembolsos)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
