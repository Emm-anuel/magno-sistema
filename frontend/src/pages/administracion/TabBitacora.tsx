import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminService } from '@/services/adminService'
import { useAuthStore } from '@/hooks/useAuthStore'
import { api } from '@/services/api'

interface Sucursal {
  id: number
  nombre: string
}

const SECCIONES = [
  'CONFIG_GENERAL',
  'MULTAS',
  'RANGOS_CREDITO',
  'UMBRALES_RENOVACION',
  'AHORRO',
  'NOMINA',
  'CONCEPTOS',
  'DIAS_INHABILES',
] as const

function fmtDateTime(iso: string) {
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

function seccionLabel(s: string) {
  const MAP: Record<string, string> = {
    CONFIG_GENERAL:       'Config general',
    MULTAS:               'Multas',
    RANGOS_CREDITO:       'Rangos crédito',
    UMBRALES_RENOVACION:  'Umbrales renovación',
    AHORRO:               'Ahorro',
    NOMINA:               'Nómina',
    CONCEPTOS:            'Conceptos',
    DIAS_INHABILES:       'Días inhábiles',
  }
  return MAP[s] ?? s
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgoStr(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TabBitacora() {
  const { usuario } = useAuthStore()
  const esSupervisor = usuario?.rol === 'SUPERVISOR'

  // SUPERVISOR: su sucursal fija, no editable. ADMINISTRADOR: selector libre.
  const [sucursalFiltro, setSucursalFiltro] = useState<number | ''>('')
  const [seccionFiltro, setSeccionFiltro]   = useState<string>('')
  const [desde, setDesde]                   = useState(daysAgoStr(60))
  const [hasta, setHasta]                   = useState(todayStr())
  const [page, setPage]                     = useState(0)

  // Solo ADMINISTRADOR carga la lista completa de sucursales
  const { data: sucursales = [] } = useQuery<Sucursal[]>({
    queryKey: ['sucursales-list'],
    queryFn: () => api.get<Sucursal[]>('/sucursales').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    enabled: !esSupervisor,
  })

  // Para SUPERVISOR el filtro de sucursal es siempre su propia (el backend también lo fuerza)
  const sucursalEfectiva: number | '' = esSupervisor
    ? (usuario?.sucursal?.id ?? '')
    : sucursalFiltro

  const { data, isLoading } = useQuery({
    queryKey: ['bitacora-config', sucursalEfectiva, seccionFiltro, desde, hasta, page],
    queryFn: () => adminService.getBitacora({
      sucursalId: sucursalEfectiva !== '' ? sucursalEfectiva : undefined,
      seccion:    seccionFiltro || undefined,
      desde,
      hasta,
      page,
      size: 30,
    }),
    staleTime: 30_000,
  })

  const registros    = data?.content ?? []
  const totalPages   = data?.totalPages ?? 1
  const totalItems   = data?.totalElements ?? 0

  function resetPage() { setPage(0) }

  return (
    <div className="space-y-4">
      {/* ── Filtros ── */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Selector de sucursal solo para ADMINISTRADOR */}
          {!esSupervisor && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide">
                Sucursal
              </label>
              <select
                className="input text-[13px] py-[5px] w-auto"
                value={sucursalFiltro}
                onChange={e => { setSucursalFiltro(e.target.value !== '' ? Number(e.target.value) : ''); resetPage() }}
              >
                <option value="">Todas</option>
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide">
              Sección
            </label>
            <select
              className="input text-[13px] py-[5px] w-auto"
              value={seccionFiltro}
              onChange={e => { setSeccionFiltro(e.target.value); resetPage() }}
            >
              <option value="">Todas las secciones</option>
              {SECCIONES.map(s => (
                <option key={s} value={s}>{seccionLabel(s)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide">
              Desde
            </label>
            <input
              type="date"
              className="input text-[13px] py-[5px]"
              value={desde}
              max={hasta}
              onChange={e => { setDesde(e.target.value); resetPage() }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide">
              Hasta
            </label>
            <input
              type="date"
              className="input text-[13px] py-[5px]"
              value={hasta}
              min={desde}
              max={todayStr()}
              onChange={e => { setHasta(e.target.value); resetPage() }}
            />
          </div>
        </div>

        {totalItems > 0 && (
          <p className="text-[12px] text-[#6c757d]">
            {totalItems} registro{totalItems !== 1 ? 's' : ''} encontrado{totalItems !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Mobile: cards ── */}
      <div className="lg:hidden space-y-3">
        {isLoading && (
          <p className="text-[#adb5bd] text-[13px] text-center py-10">Cargando...</p>
        )}
        {!isLoading && registros.length === 0 && (
          <p className="text-[#adb5bd] text-[13px] text-center py-10">Sin registros en el período.</p>
        )}
        {registros.map(r => (
          <div key={r.id} className="card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-[#212529]">{r.usuarioNombre ?? '—'}</p>
                <p className="text-[11px] text-[#adb5bd]">{fmtDateTime(r.createdAt)}</p>
              </div>
              <span className="badge badge-gris shrink-0">{seccionLabel(r.seccion)}</span>
            </div>
            {r.sucursalNombre && (
              <p className="text-[12px] text-[#6c757d]">Sucursal: {r.sucursalNombre}</p>
            )}
            <p className="text-[13px] text-[#495057]">
              Campo: <span className="font-medium">{r.campo}</span>
            </p>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="bg-[#fff3cd] rounded px-2 py-1">
                <p className="text-[10px] text-[#856404] font-semibold uppercase mb-0.5">Antes</p>
                <p className="text-[#212529] break-all">{r.valorAnterior ?? '—'}</p>
              </div>
              <div className="bg-[#d1fae5] rounded px-2 py-1">
                <p className="text-[10px] text-[#2d6a4f] font-semibold uppercase mb-0.5">Después</p>
                <p className="text-[#212529] break-all">{r.valorNuevo ?? '—'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop: tabla ── */}
      <div className="hidden lg:block card overflow-hidden">
        {isLoading ? (
          <p className="text-[#adb5bd] text-[13px] text-center py-10">Cargando...</p>
        ) : registros.length === 0 ? (
          <p className="text-[#adb5bd] text-[13px] text-center py-10">Sin registros en el período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Usuario</th>
                  <th>Sucursal</th>
                  <th>Sección</th>
                  <th>Campo</th>
                  <th>Valor anterior</th>
                  <th>Valor nuevo</th>
                </tr>
              </thead>
              <tbody>
                {registros.map(r => (
                  <tr key={r.id}>
                    <td className="text-[12px] text-[#6c757d] whitespace-nowrap">
                      {fmtDateTime(r.createdAt)}
                    </td>
                    <td className="text-[13px]">{r.usuarioNombre ?? '—'}</td>
                    <td className="text-[13px] text-[#6c757d]">{r.sucursalNombre ?? <span className="italic text-[#adb5bd]">Global</span>}</td>
                    <td>
                      <span className="badge badge-gris">{seccionLabel(r.seccion)}</span>
                    </td>
                    <td className="font-medium text-[13px]">{r.campo}</td>
                    <td className="text-[12px] text-[#dc2626] max-w-[180px] truncate" title={r.valorAnterior ?? undefined}>
                      {r.valorAnterior ?? <span className="italic text-[#adb5bd]">—</span>}
                    </td>
                    <td className="text-[12px] text-[#16a34a] max-w-[180px] truncate" title={r.valorNuevo ?? undefined}>
                      {r.valorNuevo ?? <span className="italic text-[#adb5bd]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            className="btn btn-sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            Anterior
          </button>
          <span className="text-[12px] text-[#6c757d]">
            Página {page + 1} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
