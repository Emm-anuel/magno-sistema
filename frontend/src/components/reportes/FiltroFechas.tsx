interface FiltroFechasProps {
  desde: string
  hasta: string
  onDesdeChange: (v: string) => void
  onHastaChange: (v: string) => void
  onGenerar: () => void
  loading?: boolean
  disabled?: boolean
}

export default function FiltroFechas({
  desde, hasta, onDesdeChange, onHastaChange, onGenerar, loading, disabled,
}: FiltroFechasProps) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
        <input
          type="date"
          value={desde}
          onChange={e => onDesdeChange(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
        <input
          type="date"
          value={hasta}
          onChange={e => onHastaChange(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <button
        onClick={onGenerar}
        disabled={loading || disabled}
        className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? 'Cargando...' : 'Generar reporte'}
      </button>
    </div>
  )
}
