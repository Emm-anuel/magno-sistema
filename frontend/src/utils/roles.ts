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

export const COBROS_ROLES: Rol[] = [
  'SUPERVISOR_CAMPO',
  'ASESOR_COBRADOR',
]

// ── Etiquetas de roles ─────────────────────────────────────────────
// Fuente centralizada — NO duplicar en componentes individuales.

export const ROL_LABELS: Record<string, string> = {
  ADMINISTRADOR:    'Gerente General',
  SUPERVISOR:       'Gerente de Sucursal',
  SUPERVISOR_CAMPO: 'Supervisor',
  ASESOR_COBRADOR:  'Asesor',
}

export const ROL_LABELS_CORTO: Record<string, string> = {
  ADMINISTRADOR:    'Gte. General',
  SUPERVISOR:       'Gte. Sucursal',
  SUPERVISOR_CAMPO: 'Supervisor',
  ASESOR_COBRADOR:  'Asesor',
}
