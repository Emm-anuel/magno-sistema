import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import MetricCard from '@/components/reportes/MetricCard'
import ExportPdfButton from '@/components/reportes/ExportPdfButton'
import ExportExcelButton from '@/components/reportes/ExportExcelButton'
import { reporteService, type ReporteClientes } from '@/services/reporteService'

const ESTADOS = ['TODOS', 'ACTIVO', 'EN_MORA', 'SIN_CREDITO', 'INACTIVO'] as const
type EstadoFiltro = typeof ESTADOS[number]

const ESTADO_LABELS: Record<EstadoFiltro, string> = {
  TODOS: 'Todos',
  ACTIVO: 'Activo',
  EN_MORA: 'En mora',
  SIN_CREDITO: 'Sin crédito',
  INACTIVO: 'Inactivo',
}

const PAGE_SIZE = 50

const BASE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'

function EstadoBadge({ estado }: { estado: string }) {
  switch (estado) {
    case 'ACTIVO':
      return <span className={`${BASE} bg-emerald-100 text-emerald-800`}>Activo</span>
    case 'EN_MORA':
      return <span className={`${BASE} bg-red-100 text-red-800`}>En mora</span>
    case 'SIN_CREDITO':
      return <span className={`${BASE} bg-gray-100 text-gray-700`}>Sin crédito</span>
    case 'INACTIVO':
      return <span className={`${BASE} bg-zinc-200 text-zinc-600`}>Inactivo</span>
    default:
      return <span className={`${BASE} bg-gray-100 text-gray-600`}>{estado}</span>
  }
}

function fmtFecha(s: string) {
  if (!s || s === '—') return '—'

  const fechaMx = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const fecha = fechaMx
    ? new Date(Number(fechaMx[3]), Number(fechaMx[2]) - 1, Number(fechaMx[1]), 12)
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s)

  if (Number.isNaN(fecha.getTime())) return '—'

  return fecha.toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtMoney(value: number | null | undefined) {
  if (value == null) return '—'
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

function fmtEnum(value: string | null | undefined) {
  if (!value) return '—'
  const text = value.toLowerCase().replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function joinParts(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => Boolean(part?.trim()) && part !== '—')
    .join(' · ') || '—'
}

function domicilio(c: ReporteClientes['clientes'][number]) {
  return joinParts([
    joinParts([c.domCalle, c.domNoExterior, c.domNoInterior ? `Int. ${c.domNoInterior}` : null]),
    c.domColonia, c.domMunicipio, c.domEstado, c.domCodigoPostal ? `CP ${c.domCodigoPostal}` : null,
  ])
}

function direccionNegocio(c: ReporteClientes['clientes'][number]) {
  const separada = joinParts([
    joinParts([c.negocioCalle, c.negocioNoExterior, c.negocioNoInterior ? `Int. ${c.negocioNoInterior}` : null]),
    c.negocioColonia, c.negocioMunicipio, c.negocioEstado, c.negocioCp ? `CP ${c.negocioCp}` : null,
  ])
  return separada !== '—' ? separada : (c.negocioDireccion ?? '—')
}

function InfoLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div><span className="font-medium text-gray-500">{label}:</span> {children || '—'}</div>
  )
}

interface Props { sucursalId: number | null }

export default function TabClientes({ sucursalId }: Props) {
  const [estado, setEstado] = useState<EstadoFiltro>('TODOS')
  const [asesorId, setAsesorId] = useState<number | undefined>()
  const [data, setData] = useState<ReporteClientes | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [lastFilters, setLastFilters] = useState<{ estado: EstadoFiltro; asesorId?: number } | null>(null)

  const { data: asesores = [] } = useQuery({
    queryKey: ['asesores-reportes', sucursalId],
    queryFn: () => api.get<{ id: number; nombre_completo: string }[]>(
      '/clientes/asesores',
      { params: sucursalId ? { sucursalId } : undefined },
    ).then(r => r.data),
    staleTime: 300_000,
  })

  useEffect(() => {
    setData(null)
    setPage(0)
    setLastFilters(null)
  }, [sucursalId])

  async function generar(nuevoEstado?: EstadoFiltro, overrideAsesor?: number | null) {
    if (!sucursalId) return
    const est = nuevoEstado ?? estado
    const asesor = overrideAsesor !== undefined ? (overrideAsesor ?? undefined) : asesorId
    setLoading(true)
    try {
      const result = await reporteService.getClientes(sucursalId, asesor, est)
      setData(result)
      setPage(0)
      setLastFilters({ estado: est, asesorId: asesor })
    } finally {
      setLoading(false)
    }
  }

  function handleEstado(est: EstadoFiltro) {
    setEstado(est)
    generar(est)
  }

  function handleAsesor(id?: number) {
    setAsesorId(id)
    generar(undefined, id ?? null)
  }

  const paginated = useMemo(() => {
    if (!data) return []
    const start = page * PAGE_SIZE
    return data.clientes.slice(start, start + PAGE_SIZE)
  }, [data, page])

  const totalPages = data ? Math.ceil(data.clientes.length / PAGE_SIZE) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {ESTADOS.map(est => (
              <button
                key={est}
                onClick={() => handleEstado(est)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  estado === est
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {ESTADO_LABELS[est]}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Asesor</label>
            <select
              value={asesorId ?? ''}
              onChange={(e) => handleAsesor(e.target.value ? Number(e.target.value) : undefined)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos los asesores</option>
              {asesores.map((a) => (
                <option key={a.id} value={a.id}>{a.nombre_completo}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => generar()}
            disabled={loading || !sucursalId}
            className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Generar reporte'}
          </button>
        </div>
        {data && (
          <div className="flex gap-2">
            <ExportPdfButton
              onExport={() => reporteService.exportClientesPdf(
                sucursalId!,
                lastFilters?.asesorId,
                lastFilters?.estado ?? estado,
              )}
              disabled={loading || !lastFilters}
            />
            <ExportExcelButton
              onExport={() => reporteService.exportClientesExcel(
                sucursalId!,
                lastFilters?.asesorId,
                lastFilters?.estado ?? estado,
              )}
              disabled={loading || !lastFilters}
            />
          </div>
        )}
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard label="Total Clientes" value={String(data.total)}
              colorClass="bg-gray-50 border-gray-300 text-gray-800" />
            <MetricCard label="Activos" value={String(data.totalActivos)}
              colorClass="bg-emerald-50 border-emerald-300 text-emerald-800" />
            <MetricCard label="En Mora" value={String(data.totalEnMora)}
              colorClass="bg-red-50 border-red-300 text-red-800" />
            <MetricCard label="Sin Crédito" value={String(data.totalSinCredito)}
              colorClass="bg-amber-50 border-amber-300 text-amber-800" />
            <MetricCard label="Inactivos" value={String(data.totalInactivos)}
              colorClass="bg-zinc-50 border-zinc-300 text-zinc-700" />
          </div>

          {data.clientes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No hay clientes con ese filtro</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-[2400px] text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left w-[90px]">No.</th>
                    <th className="px-4 py-3 text-left w-[250px]">Datos personales</th>
                    <th className="px-4 py-3 text-left w-[280px]">Contacto e identificación</th>
                    <th className="px-4 py-3 text-left w-[300px]">Domicilio</th>
                    <th className="px-4 py-3 text-left w-[340px]">Negocio y finanzas</th>
                    <th className="px-4 py-3 text-left w-[320px]">Referencias y aval</th>
                    <th className="px-4 py-3 text-left w-[340px]">Crédito actual o reciente</th>
                    <th className="px-4 py-3 text-left w-[220px]">Gestión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 font-mono text-gray-500 text-xs whitespace-nowrap">
                        {c.numeroCliente ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 space-y-1">
                        <div className="font-semibold text-sm text-gray-900">{c.nombreCompleto}</div>
                        <InfoLine label="Nacimiento">{fmtFecha(c.fechaNacimiento ?? '')}</InfoLine>
                        <InfoLine label="Género">{fmtEnum(c.genero)}</InfoLine>
                        <InfoLine label="Estado civil">{fmtEnum(c.estadoCivil)}</InfoLine>
                        <InfoLine label="Cónyuge">{c.nombreConyuge ?? '—'}</InfoLine>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 space-y-1">
                        <InfoLine label="Celular">{c.celular}</InfoLine>
                        <InfoLine label="Tel. fijo">{c.telefonoFijo ?? '—'}</InfoLine>
                        <InfoLine label="CURP"><span className="font-mono">{c.curp}</span></InfoLine>
                        <InfoLine label="RFC"><span className="font-mono">{c.rfc ?? '—'}</span></InfoLine>
                        <InfoLine label="Identificación">{joinParts([c.ineTipo, c.ineNumero])}</InfoLine>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 space-y-1">
                        <div>{domicilio(c)}</div>
                        <InfoLine label="Vivienda">{fmtEnum(c.domTipoVivienda)}</InfoLine>
                        <InfoLine label="Renta">{fmtMoney(c.domMontoRenta)}</InfoLine>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 space-y-1">
                        <div className="font-semibold text-gray-900">{c.negocioNombre ?? '—'}</div>
                        <InfoLine label="Giro">{c.negocioGiro ?? '—'}</InfoLine>
                        <InfoLine label="Antigüedad">{c.negocioAntiguedad ?? '—'}</InfoLine>
                        <InfoLine label="Dirección">{direccionNegocio(c)}</InfoLine>
                        <InfoLine label="Local">{joinParts([fmtEnum(c.negocioTipoLocal), fmtMoney(c.negocioMontoRenta)])}</InfoLine>
                        <InfoLine label="Horario">{c.negocioHorarios ?? '—'}</InfoLine>
                        <InfoLine label="Ubicación">{c.negocioLat != null && c.negocioLng != null ? `${c.negocioLat}, ${c.negocioLng}` : '—'}</InfoLine>
                        <InfoLine label="Ingresos semanales">{fmtMoney(c.ingresosSemanales)}</InfoLine>
                        <InfoLine label="Gastos semanales">{fmtMoney(c.gastosSemanales)}</InfoLine>
                        <InfoLine label="Renta / otros">{joinParts([fmtMoney(c.gastosRenta), fmtMoney(c.gastosOtros)])}</InfoLine>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 space-y-1">
                        <InfoLine label="Referencia 1">{joinParts([c.ref1Nombre, c.ref1Telefono, c.ref1Parentesco])}</InfoLine>
                        <InfoLine label="Referencia 2">{joinParts([c.ref2Nombre, c.ref2Telefono, c.ref2Parentesco])}</InfoLine>
                        <InfoLine label="Aval">{joinParts([c.avalNombre, c.avalTelefono])}</InfoLine>
                        <InfoLine label="Dirección aval">{c.avalDireccion ?? '—'}</InfoLine>
                        <InfoLine label="Identificación aval">{c.avalIdentificacion ?? '—'}</InfoLine>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 space-y-1">
                        {c.creditoId == null ? (
                          <span className="text-gray-400">Sin crédito registrado</span>
                        ) : (
                          <>
                            <InfoLine label="Crédito">#{c.creditoId} · {fmtEnum(c.tipoCredito)}</InfoLine>
                            <InfoLine label="Modalidad">{fmtEnum(c.tipoPago)}</InfoLine>
                            <InfoLine label="Monto">{fmtMoney(c.montoCredito)}</InfoLine>
                            <InfoLine label="Solicitado">{fmtMoney(c.montoSolicitado)}</InfoLine>
                            <InfoLine label="Tasa">{c.tasaInteres != null ? `${c.tasaInteres * 100}%` : '—'}</InfoLine>
                            <InfoLine label="Cargo financiero">{fmtMoney(c.cargoFinanciero)}</InfoLine>
                            <InfoLine label="Total a pagar">{fmtMoney(c.totalAPagar)}</InfoLine>
                            <InfoLine label="Pago periódico">{fmtMoney(c.pagoPeriodico)}</InfoLine>
                            <InfoLine label="Plazo">{c.plazoDias != null ? `${c.plazoDias} días` : '—'}</InfoLine>
                            <InfoLine label="Vigencia">{joinParts([c.fechaInicio ? fmtFecha(c.fechaInicio) : null, c.fechaVencimiento ? fmtFecha(c.fechaVencimiento) : null])}</InfoLine>
                            <InfoLine label="Estado">{fmtEnum(c.estadoCredito)}</InfoLine>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 space-y-1">
                        <div><EstadoBadge estado={c.estadoCliente} /></div>
                        <InfoLine label="Asesor">{c.asesorNombre}</InfoLine>
                        <InfoLine label="Sucursal">{c.sucursalNombre}</InfoLine>
                        <InfoLine label="Alta">{fmtFecha(c.fechaAlta)}</InfoLine>
                        <InfoLine label="Actualización">{fmtFecha(c.fechaActualizacion)}</InfoLine>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-100 font-semibold text-emerald-900 text-sm">
                  <tr>
                    <td colSpan={7} className="px-4 py-3">TOTAL ({data.clientes.length} clientes)</td>
                    <td className="px-4 py-3 text-xs">
                      {data.totalActivos} activos · {data.totalEnMora} mora
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Página {page + 1} de {totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
