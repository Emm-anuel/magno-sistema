import axios from 'axios'
import type { AuthResponse, ApiError, ClienteDocumentoDTO } from '@/types'
import { useAuthStore } from '@/hooks/useAuthStore'

function normalizeUsuario(raw: any): AuthResponse['usuario'] {
  const sucursal = raw?.sucursal ?? {}

  return {
    id: raw?.id,
    nombre_completo: raw?.nombre_completo ?? raw?.nombreCompleto ?? '',
    email: raw?.email ?? '',
    telefono: raw?.telefono ?? '',
    fecha_nacimiento: raw?.fecha_nacimiento ?? raw?.fechaNacimiento,
    fecha_ingreso: raw?.fecha_ingreso ?? raw?.fechaIngreso,
    rol: raw?.rol,
    sucursal: {
      id: sucursal?.id,
      nombre: sucursal?.nombre ?? '',
      direccion: sucursal?.direccion,
      telefono: sucursal?.telefono,
      activa: sucursal?.activa ?? true,
    },
    sucursales_adicionales: (raw?.sucursales_adicionales ?? raw?.sucursalesAdicionales ?? []).map((s: any) => ({
      id: s?.id,
      nombre: s?.nombre ?? '',
      direccion: s?.direccion,
      telefono: s?.telefono,
      activa: s?.activa ?? true,
    })),
    activo: raw?.activo ?? true,
    ine_numero: raw?.ine_numero ?? raw?.ineNumero,
    ine_imagen_url: raw?.ine_imagen_url ?? raw?.ineImagenUrl,
    ine_imagen_reverso_url: raw?.ine_imagen_reverso_url ?? raw?.ineImagenReversoUrl,
    calle: raw?.calle,
    no_exterior: raw?.no_exterior ?? raw?.noExterior,
    no_interior: raw?.no_interior ?? raw?.noInterior,
    colonia: raw?.colonia,
    municipio: raw?.municipio,
    estado: raw?.estado,
    codigo_postal: raw?.codigo_postal ?? raw?.codigoPostal,
    ref1_nombre: raw?.ref1_nombre ?? raw?.ref1Nombre,
    ref1_telefono: raw?.ref1_telefono ?? raw?.ref1Telefono,
    ref1_parentesco: raw?.ref1_parentesco ?? raw?.ref1Parentesco,
    ref2_nombre: raw?.ref2_nombre ?? raw?.ref2Nombre,
    ref2_telefono: raw?.ref2_telefono ?? raw?.ref2Telefono,
    ref2_parentesco: raw?.ref2_parentesco ?? raw?.ref2Parentesco,
  }
}

function normalizeSucursal(raw: any): import('@/types').Sucursal {
  return {
    id: raw?.id,
    nombre: raw?.nombre ?? '',
    direccion: raw?.direccion,
    telefono: raw?.telefono,
    activa: raw?.activa ?? true,
  }
}

function normalizePage<T>(raw: any, mapItem: (item: any) => T): import('@/types').Page<T> {
  return {
    content: (raw?.content ?? []).map(mapItem),
    total_elements: raw?.total_elements ?? raw?.totalElements ?? 0,
    total_pages: raw?.total_pages ?? raw?.totalPages ?? 0,
    number: raw?.number ?? 0,
    size: raw?.size ?? 0,
    totalElements: raw?.totalElements ?? raw?.total_elements,
    totalPages: raw?.totalPages ?? raw?.total_pages,
  }
}

function normalizeClienteAsesor(raw: any): import('@/types').AsesorInfo | undefined {
  if (!raw) return undefined

  return {
    id: raw?.id,
    nombre_completo: raw?.nombre_completo ?? raw?.nombreCompleto ?? '',
    rol: raw?.rol,
  }
}

function normalizeClienteSucursal(raw: any): import('@/types').SucursalInfo {
  return {
    id: raw?.id,
    nombre: raw?.nombre ?? '',
  }
}

function normalizeClienteResumen(raw: any): import('@/types').ClienteResumen {
  return {
    id: raw?.id,
    numero_cliente: raw?.numero_cliente ?? raw?.numeroCliente,
    nombre: raw?.nombre ?? '',
    apellido_paterno: raw?.apellido_paterno ?? raw?.apellidoPaterno ?? '',
    apellido_materno: raw?.apellido_materno ?? raw?.apellidoMaterno,
    nombre_completo: raw?.nombre_completo ?? raw?.nombreCompleto ?? '',
    celular: raw?.celular ?? '',
    curp: raw?.curp ?? '',
    estado_civil: raw?.estado_civil ?? raw?.estadoCivil ?? 'SOLTERO',
    negocio_nombre: raw?.negocio_nombre ?? raw?.negocioNombre ?? '',
    negocio_giro: raw?.negocio_giro ?? raw?.negocioGiro ?? '',
    asesor: normalizeClienteAsesor(raw?.asesor),
    sucursal: normalizeClienteSucursal(raw?.sucursal),
    activo: raw?.activo ?? true,
    tiene_credito_activo: raw?.tiene_credito_activo ?? raw?.tieneCreditoActivo ?? false,
    tiene_credito_diario_en_proceso: raw?.tiene_credito_diario_en_proceso ?? raw?.tieneCreditoDiarioEnProceso ?? false,
    tiene_credito_semanal_en_proceso: raw?.tiene_credito_semanal_en_proceso ?? raw?.tieneCreditoSemanalEnProceso ?? false,
    estado_cliente: raw?.estado_cliente ?? raw?.estadoCliente ?? 'SIN_CREDITO',
    created_at: raw?.created_at ?? raw?.createdAt ?? '',
  }
}

function normalizeClienteDetalle(raw: any): import('@/types').ClienteDetalle {
  return {
    id: raw?.id,
    numero_cliente: raw?.numero_cliente ?? raw?.numeroCliente,
    nombre: raw?.nombre ?? '',
    apellido_paterno: raw?.apellido_paterno ?? raw?.apellidoPaterno ?? '',
    apellido_materno: raw?.apellido_materno ?? raw?.apellidoMaterno,
    nombre_completo: raw?.nombre_completo ?? raw?.nombreCompleto ?? '',
    fecha_nacimiento: raw?.fecha_nacimiento ?? raw?.fechaNacimiento ?? '',
    genero: raw?.genero,
    estado_civil: raw?.estado_civil ?? raw?.estadoCivil ?? 'SOLTERO',
    nombre_conyuge: raw?.nombre_conyuge ?? raw?.nombreConyuge,
    telefono_fijo: raw?.telefono_fijo ?? raw?.telefonoFijo,
    celular: raw?.celular ?? '',
    ine_tipo: raw?.ine_tipo ?? raw?.ineTipo,
    ine_numero: raw?.ine_numero ?? raw?.ineNumero ?? '',
    curp: raw?.curp ?? '',
    rfc: raw?.rfc,
    dom_calle: raw?.dom_calle ?? raw?.domCalle ?? '',
    dom_no_exterior: raw?.dom_no_exterior ?? raw?.domNoExterior ?? '',
    dom_no_interior: raw?.dom_no_interior ?? raw?.domNoInterior,
    dom_colonia: raw?.dom_colonia ?? raw?.domColonia ?? '',
    dom_municipio: raw?.dom_municipio ?? raw?.domMunicipio ?? '',
    dom_estado: raw?.dom_estado ?? raw?.domEstado ?? '',
    dom_codigo_postal: raw?.dom_codigo_postal ?? raw?.domCodigoPostal ?? '',
    dom_tipo_vivienda: raw?.dom_tipo_vivienda ?? raw?.domTipoVivienda,
    dom_monto_renta: raw?.dom_monto_renta ?? raw?.domMontoRenta,
    negocio_nombre: raw?.negocio_nombre ?? raw?.negocioNombre ?? '',
    negocio_giro: raw?.negocio_giro ?? raw?.negocioGiro ?? '',
    negocio_antiguedad: raw?.negocio_antiguedad ?? raw?.negocioAntiguedad ?? '',
    negocio_direccion: raw?.negocio_direccion ?? raw?.negocioDireccion,
    negocio_calle: raw?.negocio_calle ?? raw?.negocioCalle,
    negocio_no_exterior: raw?.negocio_no_exterior ?? raw?.negocioNoExterior,
    negocio_no_interior: raw?.negocio_no_interior ?? raw?.negocioNoInterior,
    negocio_colonia: raw?.negocio_colonia ?? raw?.negocioColonia,
    negocio_municipio: raw?.negocio_municipio ?? raw?.negocioMunicipio,
    negocio_estado: raw?.negocio_estado ?? raw?.negocioEstado,
    negocio_cp: raw?.negocio_cp ?? raw?.negocioCp,
    negocio_tipo_local: raw?.negocio_tipo_local ?? raw?.negocioTipoLocal,
    negocio_monto_renta: raw?.negocio_monto_renta ?? raw?.negocioMontoRenta,
    negocio_horarios: raw?.negocio_horarios ?? raw?.negocioHorarios,
    negocio_lat: raw?.negocio_lat ?? raw?.negocioLat,
    negocio_lng: raw?.negocio_lng ?? raw?.negocioLng,
    ingresos_semanales: raw?.ingresos_semanales ?? raw?.ingresosSemanales,
    gastos_semanales: raw?.gastos_semanales ?? raw?.gastosSemanales,
    gastos_renta: raw?.gastos_renta ?? raw?.gastosRenta,
    gastos_otros: raw?.gastos_otros ?? raw?.gastosOtros,
    ref1_nombre: raw?.ref1_nombre ?? raw?.ref1Nombre ?? '',
    ref1_telefono: raw?.ref1_telefono ?? raw?.ref1Telefono ?? '',
    ref1_parentesco: raw?.ref1_parentesco ?? raw?.ref1Parentesco ?? '',
    ref2_nombre: raw?.ref2_nombre ?? raw?.ref2Nombre ?? '',
    ref2_telefono: raw?.ref2_telefono ?? raw?.ref2Telefono ?? '',
    ref2_parentesco: raw?.ref2_parentesco ?? raw?.ref2Parentesco ?? '',
    aval_nombre: raw?.aval_nombre ?? raw?.avalNombre,
    aval_telefono: raw?.aval_telefono ?? raw?.avalTelefono,
    aval_direccion: raw?.aval_direccion ?? raw?.avalDireccion,
    aval_identificacion: raw?.aval_identificacion ?? raw?.avalIdentificacion,
    asesor: normalizeClienteAsesor(raw?.asesor),
    sucursal: normalizeClienteSucursal(raw?.sucursal),
    activo: raw?.activo ?? true,
    estado_cliente: raw?.estado_cliente ?? raw?.estadoCliente ?? 'SIN_CREDITO',
    tiene_credito_activo: raw?.tiene_credito_activo ?? raw?.tieneCreditoActivo ?? false,
    created_at: raw?.created_at ?? raw?.createdAt ?? '',
    updated_at: raw?.updated_at ?? raw?.updatedAt ?? '',
  }
}

function toUsuarioRequestPayload(data: any) {
  return {
    nombreCompleto: data?.nombreCompleto ?? data?.nombre_completo,
    email: data?.email,
    password: data?.password,
    telefono: data?.telefono,
    fechaNacimiento: data?.fechaNacimiento ?? data?.fecha_nacimiento,
    fechaIngreso: data?.fechaIngreso ?? data?.fecha_ingreso,
    rol: data?.rol,
    sucursalId: data?.sucursalId ?? data?.sucursal_id,
    calle: data?.calle,
    noExterior: data?.noExterior ?? data?.no_exterior,
    noInterior: data?.noInterior ?? data?.no_interior,
    colonia: data?.colonia,
    municipio: data?.municipio,
    estado: data?.estado,
    codigoPostal: data?.codigoPostal ?? data?.codigo_postal,
    ineNumero: data?.ineNumero ?? data?.ine_numero,
    ineImagenUrl: data?.ineImagenUrl ?? data?.ine_imagen_url,
    ineImagenReversoUrl: data?.ineImagenReversoUrl ?? data?.ine_imagen_reverso_url,
    ref1Nombre: data?.ref1Nombre ?? data?.ref1_nombre,
    ref1Telefono: data?.ref1Telefono ?? data?.ref1_telefono,
    ref1Parentesco: data?.ref1Parentesco ?? data?.ref1_parentesco,
    ref2Nombre: data?.ref2Nombre ?? data?.ref2_nombre,
    ref2Telefono: data?.ref2Telefono ?? data?.ref2_telefono,
    ref2Parentesco: data?.ref2Parentesco ?? data?.ref2_parentesco,
  }
}

function toClienteRequestPayload(data: any) {
  return {
    nombre: data?.nombre,
    apellidoPaterno: data?.apellidoPaterno ?? data?.apellido_paterno,
    apellidoMaterno: data?.apellidoMaterno ?? data?.apellido_materno,
    fechaNacimiento: data?.fechaNacimiento ?? data?.fecha_nacimiento,
    genero: data?.genero,
    estadoCivil: data?.estadoCivil ?? data?.estado_civil,
    nombreConyuge: data?.nombreConyuge ?? data?.nombre_conyuge,
    telefonoFijo: data?.telefonoFijo ?? data?.telefono_fijo,
    celular: data?.celular,
    ineTipo: data?.ineTipo ?? data?.ine_tipo,
    ineNumero: data?.ineNumero ?? data?.ine_numero,
    curp: data?.curp,
    rfc: data?.rfc,
    domCalle: data?.domCalle ?? data?.dom_calle,
    domNoExterior: data?.domNoExterior ?? data?.dom_no_exterior,
    domNoInterior: data?.domNoInterior ?? data?.dom_no_interior,
    domColonia: data?.domColonia ?? data?.dom_colonia,
    domMunicipio: data?.domMunicipio ?? data?.dom_municipio,
    domEstado: data?.domEstado ?? data?.dom_estado,
    domCodigoPostal: data?.domCodigoPostal ?? data?.dom_codigo_postal,
    domTipoVivienda: data?.domTipoVivienda ?? data?.dom_tipo_vivienda,
    domMontoRenta: data?.domMontoRenta ?? data?.dom_monto_renta,
    negocioNombre: data?.negocioNombre ?? data?.negocio_nombre,
    negocioGiro: data?.negocioGiro ?? data?.negocio_giro,
    negocioAntiguedad: data?.negocioAntiguedad ?? data?.negocio_antiguedad,
    negocioDireccion: data?.negocioDireccion ?? data?.negocio_direccion,
    negocioCalle: data?.negocioCalle ?? data?.negocio_calle,
    negocioNoExterior: data?.negocioNoExterior ?? data?.negocio_no_exterior,
    negocioNoInterior: data?.negocioNoInterior ?? data?.negocio_no_interior,
    negocioColonia: data?.negocioColonia ?? data?.negocio_colonia,
    negocioMunicipio: data?.negocioMunicipio ?? data?.negocio_municipio,
    negocioEstado: data?.negocioEstado ?? data?.negocio_estado,
    negocioCp: data?.negocioCp ?? data?.negocio_cp,
    negocioTipoLocal: data?.negocioTipoLocal ?? data?.negocio_tipo_local,
    negocioMontoRenta: data?.negocioMontoRenta ?? data?.negocio_monto_renta,
    negocioHorarios: data?.negocioHorarios ?? data?.negocio_horarios,
    negocioLat: data?.negocioLat ?? data?.negocio_lat,
    negocioLng: data?.negocioLng ?? data?.negocio_lng,
    ingresosSemanales: data?.ingresosSemanales ?? data?.ingresos_semanales,
    gastosSemanales: data?.gastosSemanales ?? data?.gastos_semanales,
    gastosRenta: data?.gastosRenta ?? data?.gastos_renta,
    gastosOtros: data?.gastosOtros ?? data?.gastos_otros,
    ref1Nombre: data?.ref1Nombre ?? data?.ref1_nombre,
    ref1Telefono: data?.ref1Telefono ?? data?.ref1_telefono,
    ref1Parentesco: data?.ref1Parentesco ?? data?.ref1_parentesco,
    ref2Nombre: data?.ref2Nombre ?? data?.ref2_nombre,
    ref2Telefono: data?.ref2Telefono ?? data?.ref2_telefono,
    ref2Parentesco: data?.ref2Parentesco ?? data?.ref2_parentesco,
    avalNombre: data?.avalNombre ?? data?.aval_nombre,
    avalTelefono: data?.avalTelefono ?? data?.aval_telefono,
    avalDireccion: data?.avalDireccion ?? data?.aval_direccion,
    avalIdentificacion: data?.avalIdentificacion ?? data?.aval_identificacion,
    asesorId: data?.asesorId ?? data?.asesor_id,
    sucursalId: data?.sucursalId ?? data?.sucursal_id,
  }
}

function toSucursalRequestPayload(data: any) {
  return {
    nombre: data?.nombre,
    direccion: data?.direccion,
    telefono: data?.telefono,
  }
}

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

// ── Interceptor de request: adjuntar JWT ─────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('magno_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Interceptor de response: manejo de errores ───────────────────
// Guard para evitar llamar logout() múltiples veces cuando varias peticiones
// paralelas devuelven 401 antes de que React desmonte las páginas protegidas.
// Se resetea cuando el usuario vuelve a autenticarse (ver subscriber abajo).
let sessionExpired = false

useAuthStore.subscribe((state) => {
  if (state.isAuthenticated) {
    sessionExpired = false
  }
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLoginEndpoint = error.config?.url?.includes('/auth/login')

    if (error.response?.status === 401 && !isLoginEndpoint && !sessionExpired) {
      sessionExpired = true
      // Limpiar sesión en Zustand (actualiza magno-auth en localStorage y
      // setea isAuthenticated=false). ProtectedRoute detecta el cambio y
      // navega a /login via React Router sin recargar la página, evitando
      // el loop que causaba window.location.href = '/login'.
      useAuthStore.getState().logout()
    }

    // Spring Boot puede devolver el error en varios formatos
    const data = error.response?.data
    const status = error.response?.status ?? 0
    const rawMessage =
      (typeof data === 'object' && data !== null)
        ? (data.message ?? data.error ?? data.detail ?? '')
        : (typeof data === 'string' ? data : '')

    const normalizedMessage =
      typeof rawMessage === 'string' ? rawMessage.trim() : ''

    const fallbackByStatus =
      status === 403
        ? 'No tienes permiso para realizar esta acción'
        : status === 404
        ? 'No se encontró el recurso solicitado'
        : status >= 500
        ? 'Error interno del servidor'
        : 'Error de conexión'

    const message = normalizedMessage || fallbackByStatus

    const apiError: ApiError = {
      status,
      message,
      timestamp: new Date().toISOString(),
    }
    return Promise.reject(apiError)
  },
)

// ── Auth ──────────────────────────────────────────────────────────
export const authService = {
  login: (email: string, password: string) =>
    api.post<any>('/auth/login', { email, password }).then((r) => ({
      token: r.data?.token,
      usuario: normalizeUsuario(r.data?.usuario),
    })),

  logout: () =>
    api.post('/auth/logout').catch(() => {}),
}

// ── Usuarios ──────────────────────────────────────────────────────
export const usuarioService = {
  listar: (params?: { rol?: string; sucursalId?: number; activo?: boolean; page?: number; size?: number }) =>
    api
      .get<any>('/usuarios', { params })
      .then((r) => normalizePage(r.data, normalizeUsuario)),

  obtener: (id: number) =>
    api.get<any>(`/usuarios/${id}`).then((r) => normalizeUsuario(r.data)),

  crear: (data: import('@/types').UsuarioCreateRequest) =>
    api
      .post<any>('/usuarios', toUsuarioRequestPayload(data))
      .then((r) => normalizeUsuario(r.data)),

  actualizar: (id: number, data: import('@/types').UsuarioUpdateRequest) =>
    api
      .put<any>(`/usuarios/${id}`, toUsuarioRequestPayload(data))
      .then((r) => normalizeUsuario(r.data)),

  cambiarEstado: (id: number, activo: boolean) =>
    api.patch<any>(`/usuarios/${id}/estado`, { activo }).then((r) => normalizeUsuario(r.data)),

  getSucursalesAdicionales: (id: number) =>
    api.get<any[]>(`/usuarios/${id}/sucursales-adicionales`).then((r) => r.data.map(normalizeSucursal)),

  setSucursalesAdicionales: (id: number, sucursalIds: number[]) =>
    api.put<any[]>(`/usuarios/${id}/sucursales-adicionales`, { sucursalIds }).then((r) => r.data.map(normalizeSucursal)),

  cambiarMiPassword: (passwordActual: string, passwordNuevo: string) =>
    api.patch('/usuarios/me/password', { passwordActual, passwordNuevo }),
}

// ── Sucursales ───────────────────────────────────────────────────
export const sucursalService = {
  listarActivas: () =>
    api.get<any[]>('/sucursales').then((r) => r.data.map(normalizeSucursal)),

  listarTodas: () =>
    api.get<any[]>('/sucursales/admin').then((r) => r.data.map(normalizeSucursal)),

  obtener: (id: number) =>
    api.get<any>(`/sucursales/${id}`).then((r) => normalizeSucursal(r.data)),

  crear: (data: import('@/types').Sucursal) =>
    api.post<any>('/sucursales', toSucursalRequestPayload(data)).then((r) => normalizeSucursal(r.data)),

  actualizar: (id: number, data: import('@/types').Sucursal) =>
    api.put<any>(`/sucursales/${id}`, toSucursalRequestPayload(data)).then((r) => normalizeSucursal(r.data)),

  cambiarEstado: (id: number, activa: boolean) =>
    api.patch<any>(`/sucursales/${id}/estado`, { activa }).then((r) => normalizeSucursal(r.data)),
}

// ── Clientes ─────────────────────────────────────────────────────
export const clienteService = {
  listar: (params?: {
    buscar?: string
    estado?: string
    asesorId?: number
    sucursalId?: number
    activo?: boolean
    page?: number
    size?: number
  }) =>
    api
      .get<any>('/clientes', { params })
      .then((r) => normalizePage(r.data, normalizeClienteResumen)),

  obtener: (id: number) =>
    api.get<any>(`/clientes/${id}`).then((r) => normalizeClienteDetalle(r.data)),

  crear: (data: import('@/types').ClienteCreateRequest) =>
    api.post<any>('/clientes', toClienteRequestPayload(data)).then((r) => normalizeClienteDetalle(r.data)),

  actualizar: (id: number, data: import('@/types').ClienteUpdateRequest) =>
    api.put<any>(`/clientes/${id}`, toClienteRequestPayload(data)).then((r) => normalizeClienteDetalle(r.data)),

  cambiarEstado: (id: number, activo: boolean, motivo?: string) =>
    api.patch<any>(`/clientes/${id}/estado`, { activo, motivo }).then((r) => normalizeClienteResumen(r.data)),

  verificarCurp: (curp: string, excludeId?: number) =>
    api.get<{ disponible: boolean }>('/clientes/verificar-curp', { params: { curp, excludeId } })
       .then((r) => r.data.disponible),

  verificarCelular: (celular: string, excludeId?: number) =>
    api.get<{ disponible: boolean }>('/clientes/verificar-celular', { params: { celular, excludeId } })
       .then((r) => r.data.disponible),

  historial: (id: number) =>
    api.get<any[]>(`/clientes/${id}/historial`).then((r) => r.data),

  listarDocumentos: (clienteId: number) =>
    api.get<ClienteDocumentoDTO[]>(`/clientes/${clienteId}/documentos`).then((r) => r.data),

  agregarDocumento: (clienteId: number, tipo: string, url: string, nombre?: string) =>
    api.post<ClienteDocumentoDTO>(`/clientes/${clienteId}/documentos`, { tipo, url, nombre }).then((r) => r.data),

  eliminarDocumento: (clienteId: number, docId: number) =>
    api.delete(`/clientes/${clienteId}/documentos/${docId}`),
}

// ── Files ─────────────────────────────────────────────────────────
export const fileService = {
  upload: (file: File, folder?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (folder) form.append('folder', folder)
    return api
      .post<{ data: { url: string } }>('/files/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data.url)
  },
}
