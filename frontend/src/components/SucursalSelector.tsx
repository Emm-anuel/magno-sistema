import type { Sucursal } from '@/types'

interface SucursalSelectorProps {
  opciones: Sucursal[]
  value: number | undefined
  onChange: (sucursalId: number) => void
}

/** Dropdown de sucursal — no renderiza nada si hay 0 o 1 opciones (nada que elegir). */
export default function SucursalSelector({ opciones, value, onChange }: SucursalSelectorProps) {
  if (opciones.length <= 1) return null

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      className="input w-auto"
    >
      {opciones.map((s) => (
        <option key={s.id} value={s.id}>{s.nombre}</option>
      ))}
    </select>
  )
}
