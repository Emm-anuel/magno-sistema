// ============================================================
// Tipos base del sistema MAGNO
// ============================================================

export type Rol = 'ADMINISTRADOR' | 'SUPERVISOR' | 'SUPERVISOR_CAMPO' | 'ASESOR_COBRADOR'

export const ROL_LABELS: Record<Rol, string> = {
  ADMINISTRADOR:    'Administrador',
  SUPERVISOR:       'Supervisor',
  SUPERVISOR_CAMPO: 'Supervisor de Campo',
  ASESOR_COBRADOR:  'Asesor/Cobrador',
}

export type EstadoCredito = 'ACTIVO' | 'PAGADO' | 'RENOVADO' | 'CANCELADO'
export type EstadoPago    = 'PENDIENTE' | 'PAGADO' | 'NO_PAGADO' | 'PARCIAL' | 'ADELANTADO'
export type TipoPago      = 'DIARIO' | 'SEMANAL'
export type Modalidad     = 'CAJA' | 'RUTA'
export type TipoMulta     = 'NO_PAGO' | 'INCOMPLETO'
export type TipoColocacion= 'NUEVO' | 'RENOVACION'
export type CategoriaGasto= 'GASOLINA' | 'MOTOS' | 'RECARGAS' | 'SOLICITUD_DUENO' | 'VARIOS'

export const CATEGORIA_GASTO_LABELS: Record<CategoriaGasto, string> = {
  GASOLINA:         'Gasolina',
  MOTOS:            'Servicio motos',
  RECARGAS:         'Recargas',
  SOLICITUD_DUENO:  'Solicitud dinero dueño',
  VARIOS:           'Gastos varios',
}

// ------------------------------------------------------------------
// Auth
// ------------------------------------------------------------------
export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  usuario: Usuario
}

// ------------------------------------------------------------------
// Entidades
// ------------------------------------------------------------------
export interface Sucursal {
  id: number
  nombre: string
  direccion?: string
  telefono?: string
  multa_base: number
  ahorro_diario: number
  activa: boolean
}

export interface Usuario {
  id: number
  nombre_completo: string
  email: string
  telefono: string
  rol: Rol
  sucursal: Sucursal
  activo: boolean
  // Campos adicionales (presentes en detalle)
  ine_numero?: string
  ine_imagen_url?: string
  calle?: string
  no_exterior?: string
  no_interior?: string
  colonia?: string
  municipio?: string
  estado?: string
  codigo_postal?: string
  ref1_nombre?: string
  ref1_telefono?: string
  ref1_parentesco?: string
  ref2_nombre?: string
  ref2_telefono?: string
  ref2_parentesco?: string
}

// ------------------------------------------------------------------
// Requests de usuario
// ------------------------------------------------------------------
export interface UsuarioCreateRequest {
  nombre_completo: string
  email: string
  password: string
  telefono: string
  rol: Rol
  sucursal_id: number
  calle: string
  no_exterior: string
  no_interior?: string
  colonia: string
  municipio: string
  estado: string
  codigo_postal: string
  ine_numero: string
  ine_imagen_url?: string
  ref1_nombre: string
  ref1_telefono: string
  ref1_parentesco: string
  ref2_nombre: string
  ref2_telefono: string
  ref2_parentesco: string
}

export interface UsuarioUpdateRequest {
  nombre_completo: string
  telefono: string
  rol: Rol
  sucursal_id: number
  calle: string
  no_exterior: string
  no_interior?: string
  colonia: string
  municipio: string
  estado: string
  codigo_postal: string
  ine_numero: string
  ine_imagen_url?: string
  ref1_nombre: string
  ref1_telefono: string
  ref1_parentesco: string
  ref2_nombre: string
  ref2_telefono: string
  ref2_parentesco: string
  password?: string
}

export interface Cliente {
  id: number
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  nombre_completo: string   // derivado del backend
  celular: string
  asesor?: Usuario
  sucursal: Sucursal
  activo: boolean
  credito_activo?: CreditoResumen
}

export interface CreditoResumen {
  id: number
  monto_capital: number
  total_a_pagar: number
  pago_periodico: number
  plazo_dias: number
  tipo_pago: TipoPago
  fecha_inicio: string
  fecha_vencimiento: string
  estado: EstadoCredito
  pagos_realizados: number
}

export interface Credito extends CreditoResumen {
  cliente: Cliente
  asesor: Usuario
  sucursal: Sucursal
  tasa_interes: number
  cargo_financiero: number
  pago_adelantado: number
  garantia_descripcion?: string
  evidencia_urls: string[]
  lugar?: string
}

export interface CalendarioPago {
  id: number
  credito_id: number
  numero_pago: number
  fecha_programada: string
  monto_esperado: number
  estado: EstadoPago
}

export interface Pago {
  id: number
  credito_id: number
  cliente: Cliente
  asesor: Usuario
  numero_pago: number
  fecha_pago: string
  monto_recibido: number
  monto_esperado: number
  es_completo: boolean
  razon_no_pago?: string
  multa_aplicada: number
  modalidad: Modalidad
}

export interface Multa {
  id: number
  cliente: Cliente
  credito_id: number
  tipo: TipoMulta
  monto: number
  fecha: string
  cobrada: boolean
}

export interface Gasto {
  id: number
  fecha: string
  categoria: CategoriaGasto
  descripcion?: string
  monto: number
  responsable: Usuario
  sucursal: Sucursal
  comprobante_referencia?: string
}

// ------------------------------------------------------------------
// Respuestas paginadas
// ------------------------------------------------------------------
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

// ------------------------------------------------------------------
// API Error
// ------------------------------------------------------------------
export interface ApiError {
  status: number
  message: string
  timestamp: string
}
