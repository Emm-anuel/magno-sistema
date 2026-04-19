// ============================================================
// Tipos base del sistema MAGNO
// ============================================================

export type Rol = 'ADMINISTRADOR' | 'SUPERVISOR' | 'SUPERVISOR_CAMPO' | 'ASESOR_COBRADOR'

export const ROL_LABELS: Record<Rol, string> = {
  ADMINISTRADOR:    'Gerente General',
  SUPERVISOR:       'Gerente de Sucursal',
  SUPERVISOR_CAMPO: 'Supervisor',
  ASESOR_COBRADOR:  'Asesor',
}

export type EstadoCredito =
  | 'SOLICITADO'
  | 'APROBADO'
  | 'ACTIVO'
  | 'PAGADO'
  | 'RENOVADO'
  | 'CANCELADO'
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

export type EstadoCliente = 'ACTIVO' | 'EN_MORA' | 'SIN_CREDITO' | 'INACTIVO'
export type EstadoCivil  = 'SOLTERO' | 'CASADO' | 'UNION_LIBRE'

export const ESTADO_CIVIL_LABELS: Record<EstadoCivil, string> = {
  SOLTERO:     'Soltero(a)',
  CASADO:      'Casado(a)',
  UNION_LIBRE: 'Unión libre',
}

// ── Clientes ──────────────────────────────────────────────────────

export interface AsesorInfo {
  id: number
  nombre_completo: string
  rol?: string
}

export interface SucursalInfo {
  id: number
  nombre: string
}

export interface ClienteResumen {
  id: number
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  nombre_completo: string
  celular: string
  curp: string
  estado_civil: EstadoCivil
  negocio_nombre: string
  negocio_giro: string
  asesor?: AsesorInfo
  sucursal: SucursalInfo
  activo: boolean
  tiene_credito_activo: boolean
  estado_cliente: EstadoCliente
  created_at: string
}

export interface ClienteDetalle {
  id: number
  // Datos personales
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  nombre_completo: string
  fecha_nacimiento: string
  genero?: string
  estado_civil: EstadoCivil
  nombre_conyuge?: string
  telefono_fijo?: string
  celular: string
  // Identificación
  ine_tipo?: string
  ine_numero: string
  curp: string
  rfc?: string
  // Domicilio
  dom_calle: string
  dom_no_exterior: string
  dom_no_interior?: string
  dom_colonia: string
  dom_municipio: string
  dom_estado: string
  dom_codigo_postal: string
  dom_tipo_vivienda?: string
  dom_monto_renta?: number
  // Negocio
  negocio_nombre: string
  negocio_giro: string
  negocio_antiguedad: string
  negocio_direccion?: string
  // Dirección del negocio en campos separados
  negocio_calle?: string
  negocio_no_exterior?: string
  negocio_no_interior?: string
  negocio_colonia?: string
  negocio_municipio?: string
  negocio_estado?: string
  negocio_cp?: string
  negocio_tipo_local?: string
  negocio_monto_renta?: number
  negocio_horarios?: string
  // Finanzas
  ingresos_semanales?: number
  gastos_semanales?: number
  gastos_renta?: number
  gastos_otros?: number
  // Referencias
  ref1_nombre: string
  ref1_telefono: string
  ref1_parentesco: string
  ref2_nombre: string
  ref2_telefono: string
  ref2_parentesco: string
  // Aval
  aval_nombre?: string
  aval_telefono?: string
  aval_direccion?: string
  aval_identificacion?: string
  // Relaciones
  asesor?: AsesorInfo
  sucursal: SucursalInfo
  activo: boolean
  estado_cliente: EstadoCliente
  tiene_credito_activo: boolean
  created_at: string
  updated_at: string
}

export interface ClienteCreateRequest {
  nombre: string
  apellido_paterno: string
  apellido_materno?: string
  fecha_nacimiento: string
  genero?: string
  estado_civil: EstadoCivil
  nombre_conyuge?: string
  telefono_fijo?: string
  celular: string
  ine_tipo?: string
  ine_numero: string
  curp: string
  rfc?: string
  dom_calle: string
  dom_no_exterior: string
  dom_no_interior?: string
  dom_colonia: string
  dom_municipio: string
  dom_estado: string
  dom_codigo_postal: string
  dom_tipo_vivienda?: string
  dom_monto_renta?: number
  negocio_nombre: string
  negocio_giro: string
  negocio_antiguedad: string
  negocio_direccion?: string
  negocio_calle: string
  negocio_no_exterior: string
  negocio_no_interior?: string
  negocio_colonia: string
  negocio_municipio: string
  negocio_estado: string
  negocio_cp: string
  negocio_tipo_local?: string
  negocio_monto_renta?: number
  negocio_horarios?: string
  ingresos_semanales?: number
  gastos_semanales?: number
  gastos_renta?: number
  gastos_otros?: number
  ref1_nombre: string
  ref1_telefono: string
  ref1_parentesco: string
  ref2_nombre: string
  ref2_telefono: string
  ref2_parentesco: string
  aval_nombre?: string
  aval_telefono?: string
  aval_direccion?: string
  aval_identificacion?: string
  asesor_id?: number
  sucursal_id: number
}

export interface ClienteUpdateRequest extends Partial<ClienteCreateRequest> {}

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
  credito_activo?: CreditoResumenInline
}

// CreditoResumenInline — lightweight type used inside Cliente.credito_activo
export interface CreditoResumenInline {
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

export interface Credito extends CreditoResumenInline {
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
  total_elements: number
  total_pages: number
  number: number
  size: number
  // camelCase aliases (backwards compat)
  totalElements?: number
  totalPages?: number
}

// ------------------------------------------------------------------
// API Error
// ------------------------------------------------------------------
export interface ApiError {
  status: number
  message: string
  timestamp: string
}

// ------------------------------------------------------------------
// Cobros
// ------------------------------------------------------------------

export type EstadoCobro = 'SIN_REGISTRO' | 'PAGADO' | 'PARCIAL' | 'NO_PAGADO' | 'INHABIL' | 'INHABILL'

export interface ClienteRuta {
  clienteId: number
  nombreCompleto: string
  celular: string
  negocioNombre: string
  asesorId?: number | null
  asesorNombre?: string | null
  creditoId: number
  montoCapital: number
  pagoPeriodico: number
  numeroPagoHoy: number | null
  totalPagos: number
  estadoHoy: EstadoCobro
  montoRecibidoHoy: number | null
  multasPendientes: number
  razonNoPago: string | null
  pagoIdHoy: number | null
}

export interface RutaDia {
  asesor: { id: number; nombreCompleto: string }
  fecha: string
  clientes: ClienteRuta[]
  resumen: {
    totalClientes: number
    cobrados: number
    noPagaron: number
    sinRegistrar: number
    inhabiles: number
    totalCaja: number
    totalRuta: number
    totalMultasCobradas: number
  }
}

export interface PagoRegistrarRequest {
  creditoId: number
  modalidad: Modalidad
  noPago: boolean
  montoRecibido?: number
  razonNoPago?: string
  fechaPago?: string
}

export interface PagoModificarRequest {
  montoRecibido?: number
  modalidad?: Modalidad
  razonNoPago?: string
  motivoModificacion: string
}

/** Pago tal como lo devuelve GET /api/cobros/* (camelCase desde Spring Boot) */
export interface PagoCobroDTO {
  id: number
  creditoId: number
  cliente: { id: number; nombreCompleto: string }
  numeroPago: number
  fechaPago: string
  montoRecibido: number
  montoEsperado: number
  esCompleto: boolean
  modalidad: Modalidad
  razonNoPago: string | null
  multaAplicada: number
  registradoPor: { id: number; nombreCompleto: string } | null
  modificadoPor: { id: number; nombreCompleto: string } | null
  fechaModificacion: string | null
  createdAt: string
}

export interface MultaCobroDTO {
  id: number
  creditoId: number
  clienteId: number
  pagoId: number | null
  tipo: TipoMulta
  monto: number
  fecha: string
  cobrada: boolean
  cobradaEnPagoId: number | null
}

// ------------------------------------------------------------------
// Créditos Nuevos
// ------------------------------------------------------------------

export interface ProductoCalculo {
  capital: number
  plazo: number
  tasa: number
  cargoFinanciero: number
  totalAPagar: number
  pagoPeriodico: number
  pagoAdelantado: number
  descripcionProducto?: string
}

export interface CalendarioPagoDetalle {
  id: number
  numeroPago: number
  fechaProgramada: string
  montoEsperado: number
  estado: EstadoPago | 'INHABIL' | 'INHABILL'
}

// Shape returned by GET /api/creditos (list) — camelCase from Spring Boot
export interface CreditoResumen {
  id: number
  cliente: { id: number; nombreCompleto: string; celular: string }
  asesor: { id: number; nombreCompleto: string }
  sucursal: { id: number; nombre: string }
  montoSolicitado: number
  montoCapital: number
  montoAprobado: number | null
  pagoPeriodico: number
  plazoDias: number
  tipoPago: TipoPago
  estado: EstadoCredito
  fechaInicio: string | null
  fechaVencimiento: string | null
  pagosRealizados: number
  totalPagos: number
  tieneVideoEntrega: boolean
  createdAt: string
}

// Shape returned by GET /api/creditos/:id
export interface CreditoDetalle {
  id: number
  cliente: { id: number; nombreCompleto: string; celular: string }
  asesor: { id: number; nombreCompleto: string }
  sucursal: { id: number; nombre: string }
  montoSolicitado: number
  montoCapital: number
  tasaInteres: number
  cargoFinanciero: number
  totalAPagar: number
  pagoPeriodico: number
  plazoDias: number
  tipoPago: TipoPago
  fechaInicio: string | null
  fechaVencimiento: string | null
  pagoAdelantado: number
  garantiaDescripcion: string | null
  evidenciaUrls: string[]
  lugar: string | null
  estado: EstadoCredito
  montoAprobado: number | null
  observaciones: string | null
  fechaAprobacion: string | null
  aprobadoPor: { id: number; nombreCompleto: string } | null
  fechaDesembolso: string | null
  videoEntregaUrl: string | null
  createdAt: string
  updatedAt: string
  calendario: CalendarioPagoDetalle[]
  estadisticas: {
    pagosRealizados: number
    pagosPendientes: number
    pagosVencidos: number
    multasPendientes: number
    elegibleRenovacion: boolean
  }
}
