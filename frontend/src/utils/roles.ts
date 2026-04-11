import type { Rol } from '@/types'

export const ALL_ROLES: Rol[] = [
  'ADMINISTRADOR',
  'SUPERVISOR',
  'SUPERVISOR_CAMPO',
  'ASESOR_COBRADOR',
]

export const ADMIN_SUPERVISOR_ROLES: Rol[] = [
  'ADMINISTRADOR',
  'SUPERVISOR',
]

export const FIELD_ROLES: Rol[] = [
  'ADMINISTRADOR',
  'SUPERVISOR',
  'SUPERVISOR_CAMPO',
]

export const ADMIN_ONLY_ROLES: Rol[] = ['ADMINISTRADOR']

export const CLIENTES_ROLES: Rol[] = [
  'ADMINISTRADOR',
  'SUPERVISOR',
  'SUPERVISOR_CAMPO',
  'ASESOR_COBRADOR',
]
