import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react'
import { renovacionService } from '@/services/renovacionService'
import { useAuthStore } from '@/hooks/useAuthStore'
import TipoPagoBadge from '@/components/TipoPagoBadge'
import { api } from '@/services/api'
import type { ListoRenovarItem, ClienteResumen, TipoPago } from '@/types'

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

interface Props {
  onRenovar: (cliente: ClienteResumen) => void
}

export default function TabListosRenovar({ onRenovar }: Props) {
  const { usuario } = useAuthStore()
  const rol = usuario?.rol

  const esAdmin = rol === 'ADMINISTRADOR'
  const esGerente = rol === 'ADMINISTRADOR' || rol === 'SUPERVISOR'
  const esSupervisorCampo = rol === 'SUPERVISOR_CAMPO'
  const puedeCrearRenovacion = rol === 'SUPERVISOR_CAMPO' || rol === 'ASESOR_COBRADOR'
  const puedeVerFiltros = esGerente || esSupervisorCampo

  const [asesorFiltro, setAsesorFiltro] = useState<number | undefined>(undefined)
  const [sucursalFiltro, setSucursalFiltro] = useState<number | undefined>(undefined)
  const [pagosRestantesMax, setPagosRestantesMax] = useState<number | undefined>(undefined)

  const { data: asesores = [] } = useQuery<{ id: number; nombre_completo: string }[]>({
    queryKey: ['asesores-list'],
    queryFn: () => api.get('/clientes/asesores').then((r) => r.data),
    enabled: puedeVerFiltros,
    staleTime: 60_000,
  })

  const { data: sucursales = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['sucursales-list'],
    queryFn: () => api.get('/sucursales').then((r) => r.data),
    enabled: esAdmin,
    staleTime: 60_000,
  })

  const { data: items = [], isLoading, isError } = useQuery<ListoRenovarItem[]>({
    queryKey: ['listos-renovar', asesorFiltro, sucursalFiltro],
    queryFn: () => renovacionService.getListosRenovar({
      asesorId: asesorFiltro,
      sucursalId: sucursalFiltro,
    }),
    staleTime: 60_000,
  })

  const filtrados = pagosRestantesMax != null
    ? items.filter((i) => i.pagosRestantes <= pagosRestantesMax)
    : items

  function handleRenovar(item: ListoRenovarItem) {
    // Build a ClienteResumen-compatible object with data available from ListoRenovarItem.
    // Required fields without equivalents are given safe defaults so the
    // RenovacionWizard can open; the wizard will re-fetch full client data.
    const cliente: ClienteResumen = {
      id: item.clienteId,
      nombre: item.clienteNombre,
      apellido_paterno: '',
      nombre_completo: item.clienteNombre,
      celular: '',
      curp: '',
      estado_civil: 'SOLTERO',
      negocio_nombre: '',
      negocio_giro: '',
      sucursal: { id: item.sucursalId, nombre: item.sucursalNombre },
      activo: true,
      tiene_credito_activo: true,
      estado_cliente: 'ACTIVO',
      created_at: '',
    }
    onRenovar(cliente)
  }

  return (
    <div className="space-y-4">

      {/* Filtros */}
      {puedeVerFiltros && (
        <div className="flex flex-wrap gap-3">
          <select
            value={asesorFiltro ?? ''}
            onChange={(e) => setAsesorFiltro(e.target.value ? Number(e.target.value) : undefined)}
            className="input text-sm py-1.5 pr-8 min-w-[160px]"
          >
            <option value="">Todos los asesores</option>
            {asesores.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre_completo}</option>
            ))}
          </select>

          {esAdmin && sucursales.length > 0 && (
            <select
              value={sucursalFiltro ?? ''}
              onChange={(e) => setSucursalFiltro(e.target.value ? Number(e.target.value) : undefined)}
              className="input text-sm py-1.5 pr-8 min-w-[160px]"
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}

          <select
            value={pagosRestantesMax ?? ''}
            onChange={(e) => setPagosRestantesMax(e.target.value ? Number(e.target.value) : undefined)}
            className="input text-sm py-1.5 pr-8 min-w-[180px]"
          >
            <option value="">Todos (pagos restantes)</option>
            <option value="2">Máx. 2 pagos restantes</option>
            <option value="5">Máx. 5 pagos restantes</option>
            <option value="9">Máx. 9 pagos restantes</option>
          </select>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="card p-8 flex items-center justify-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Cargando clientes listos para renovar...</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="card p-8 text-center text-red-500">
          Error al cargar el listado.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && filtrados.length === 0 && (
        <div className="card p-8 text-center text-gray-400">
          No hay clientes elegibles para renovación con los filtros actuales.
        </div>
      )}

      {/* Tabla desktop */}
      {!isLoading && filtrados.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="py-3 pr-4 font-medium">Cliente</th>
                  <th className="py-3 pr-4 font-medium">Asesor</th>
                  {esAdmin && <th className="py-3 pr-4 font-medium">Sucursal</th>}
                  <th className="py-3 pr-4 font-medium text-right">Monto crédito</th>
                  <th className="py-3 pr-4 font-medium">Forma de Pago</th>
                  <th className="py-3 pr-4 font-medium text-center">Progreso</th>
                  <th className="py-3 pr-4 font-medium text-center">Restantes</th>
                  <th className="py-3 pr-4 font-medium text-right">Multas</th>
                  {puedeCrearRenovacion && <th className="py-3 font-medium" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtrados.map((item) => (
                  <tr key={item.creditoId} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-800">{item.clienteNombre}</td>
                    <td className="py-3 pr-4 text-gray-600">{item.asesorNombre}</td>
                    {esAdmin && <td className="py-3 pr-4 text-gray-500 text-xs">{item.sucursalNombre}</td>}
                    <td className="py-3 pr-4 text-right text-gray-700">{fmt(item.montoCapital)}</td>
                    <td className="py-3 pr-4">
                      <TipoPagoBadge tipo={item.tipoPago as TipoPago} size="sm" />
                    </td>
                    <td className="py-3 pr-4 text-center text-gray-600 whitespace-nowrap">
                      Pago {item.pagosRealizados} de {item.plazoDias}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span className={[
                        'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold',
                        item.pagosRestantes <= 2
                          ? 'bg-green-100 text-green-700'
                          : item.pagosRestantes <= 5
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600',
                      ].join(' ')}>
                        {item.pagosRestantes}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {item.multasPendientes > 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium text-xs">
                          <AlertCircle className="w-3 h-3" />
                          {fmt(item.multasPendientes)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    {puedeCrearRenovacion && (
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => handleRenovar(item)}
                          className="btn flex items-center gap-1 text-xs py-1.5 px-3"
                        >
                          Renovar <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="md:hidden space-y-3">
            {filtrados.map((item) => (
              <div key={item.creditoId} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-800">{item.clienteNombre}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.asesorNombre}</div>
                    <div className="mt-1">
                      <TipoPagoBadge tipo={item.tipoPago as TipoPago} size="sm" />
                    </div>
                    {esAdmin && <div className="text-xs text-gray-400">{item.sucursalNombre}</div>}
                  </div>
                  {puedeCrearRenovacion && (
                    <button
                      type="button"
                      onClick={() => handleRenovar(item)}
                      className="btn flex items-center gap-1 text-xs py-1.5 px-3 flex-shrink-0"
                    >
                      Renovar <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-gray-500">Monto</span>
                  <span className="text-right font-medium">{fmt(item.montoCapital)}</span>
                  <span className="text-gray-500">Progreso</span>
                  <span className="text-right text-gray-700">
                    Pago {item.pagosRealizados} de {item.plazoDias}
                  </span>
                  <span className="text-gray-500">Restantes</span>
                  <span className={[
                    'text-right font-semibold',
                    item.pagosRestantes <= 2 ? 'text-green-600'
                      : item.pagosRestantes <= 5 ? 'text-amber-600'
                      : 'text-gray-700',
                  ].join(' ')}>
                    {item.pagosRestantes}
                  </span>
                  {item.multasPendientes > 0 && (
                    <>
                      <span className="text-gray-500">Multas</span>
                      <span className="text-right text-red-600 font-medium">
                        {fmt(item.multasPendientes)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
