import { useEffect, useState } from 'react'
import { reporteService, type Sucursal } from '@/services/reporteService'

interface SucursalSelectorProps {
  sucursalId: number | null
  onChange: (id: number) => void
  readonly?: boolean
  readonlyNombre?: string
}

export default function SucursalSelector({
  sucursalId, onChange, readonly, readonlyNombre,
}: SucursalSelectorProps) {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])

  useEffect(() => {
    if (readonly) return
    let alive = true
    reporteService.getSucursales().then(list => {
      if (!alive) return
      setSucursales(list)
      if (list.length > 0 && sucursalId === null) {
        onChange(list[0].id)
      }
    })
    return () => {
      alive = false
    }
  }, [readonly, onChange, sucursalId])

  if (readonly) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span className="font-medium">Sucursal:</span>
        <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-medium">
          {readonlyNombre ?? '—'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700">Sucursal:</label>
      <select
        value={sucursalId ?? ''}
        onChange={e => onChange(Number(e.target.value))}
        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {sucursales.map(s => (
          <option key={s.id} value={s.id}>{s.nombre}</option>
        ))}
      </select>
    </div>
  )
}
