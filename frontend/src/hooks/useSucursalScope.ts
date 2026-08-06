import { useMemo, useState } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'
import type { Sucursal } from '@/types'

/**
 * Sucursales entre las que un usuario puede alternar dentro de un módulo, y cuál
 * está seleccionada actualmente.
 *
 * Solo devuelve opciones para SUPERVISOR_CAMPO con sucursales adicionales asignadas.
 * ADMINISTRADOR no pasa por aquí — cada página ya tiene su propio patrón (filtro con
 * "todas las sucursales" por defecto) que este hook no debe reemplazar ni interferir.
 */
export function useSucursalScope() {
  const { usuario } = useAuthStore()

  const opciones: Sucursal[] = useMemo(() => {
    if (usuario?.rol === 'SUPERVISOR_CAMPO' && usuario.sucursales_adicionales?.length) {
      return [usuario.sucursal, ...usuario.sucursales_adicionales]
    }
    return []
  }, [usuario])

  const [seleccionManual, setSeleccionManual] = useState<number | undefined>(undefined)

  const sucursalId = opciones.length > 1
    ? (seleccionManual ?? usuario?.sucursal?.id)
    : undefined

  return { opciones, sucursalId, setSucursalId: setSeleccionManual }
}
