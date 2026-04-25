import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { api } from '@/services/api'
import { addDaysLocal, todayLocalStr } from '@/utils/date'
import TabRutaDia from './TabRutaDia'
import TabHistorialCobros from './TabHistorialCobros'
import { useCajaOperativa } from '@/hooks/useCajaOperativa'
import CajaOperativaBanner from '@/components/caja/CajaOperativaBanner'

type Tab = 'ruta-dia' | 'historial'

function todayStr() {
  return todayLocalStr()
}

function addDays(dateStr: string, n: number) {
  return addDaysLocal(dateStr, n)
}

function formatFechaBonita(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function CobrosPage() {
  const { usuario } = useAuthStore()
  const { bannerVariant, horaLimite } = useCajaOperativa()
  const [activeTab, setActiveTab] = useState<Tab>('ruta-dia')
  const [fecha, setFecha] = useState(todayStr())
  const [asesorId, setAsesorId] = useState<number | undefined>()

  const isAdmin =
    usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERVISOR'
  const isSupervisorCampo = usuario?.rol === 'SUPERVISOR_CAMPO'

  // Asesores para selector (solo roles con visibilidad ampliada)
  const { data: asesores = [] } = useQuery({
    queryKey: ['asesores-cobros'],
    queryFn: () =>
      api
        .get<{ id: number; nombre_completo: string }[]>('/clientes/asesores')
        .then((r) => r.data),
    enabled: isAdmin || isSupervisorCampo,
    staleTime: 300_000,
  })

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ruta-dia', label: 'Ruta del Día' },
    { id: 'historial', label: 'Historial de Cobros' },
  ]

  return (
    <div className="space-y-4">
      <CajaOperativaBanner variant={bannerVariant} horaLimite={horaLimite} />
      {/* ── Encabezado ── */}
      <div>
        <h1 className="text-[22px] font-semibold text-[#212529]">Cobros</h1>
        <p className="text-[13px] text-[#6c757d] mt-0.5">
          Registro de pagos y ruta diaria
        </p>
      </div>

      {/* ── Controles: fecha + asesor ── */}
      {activeTab === 'ruta-dia' && (
        <div className="flex flex-wrap gap-3 items-center">
          {/* Selector de fecha */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setFecha(addDays(fecha, -1))}
              title="Día anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              className="input text-[13px] py-[5px] w-[150px]"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              max={todayStr()}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setFecha(addDays(fecha, 1))}
              disabled={fecha >= todayStr()}
              title="Día siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-[12px] text-[#6c757d] capitalize hidden sm:inline">
            {formatFechaBonita(fecha)}
          </span>

          {/* Selector de asesor (solo admin/supervisor/supervisor_campo) */}
          {(isAdmin || isSupervisorCampo) && asesores.length > 0 && (
            <select
              className="input text-[13px] py-[5px] w-auto"
              value={asesorId ?? ''}
              onChange={(e) =>
                setAsesorId(e.target.value ? Number(e.target.value) : undefined)
              }
            >
              <option value="">{isAdmin ? 'Todos los asesores' : 'Mi ruta'}</option>
              {asesores.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre_completo}
                </option>
              ))}
            </select>
          )}

          {fecha !== todayStr() && (
            <button
              type="button"
              className="btn btn-sm text-[#2d6a4f]"
              onClick={() => setFecha(todayStr())}
            >
              Hoy
            </button>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenido ── */}
      {activeTab === 'ruta-dia' && (
        <TabRutaDia asesorId={asesorId} fecha={fecha} />
      )}
      {activeTab === 'historial' && (
        <TabHistorialCobros />
      )}
    </div>
  )
}
