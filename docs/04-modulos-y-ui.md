# Módulos, UI y Diseño Responsive — MAGNO v3.5

## 5. Módulos del Sistema (14 módulos)

| #   | Módulo (key navegación) | Pestañas internas                                                                                             |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | **dashboard**           | —                                                                                                             |
| 2   | **cobros**              | Ruta del Día · Historial de Cobros                                                                            |
| 3   | **creditos-nuevos**     | Solicitudes · Nueva Solicitud · Evaluación · Tabla de Pagos                                                   |
| 4   | **renovaciones** ✅     | Listos para Renovar · Pendientes de Aprobación · Pendientes de Desembolso · Nueva Solicitud · Mis Solicitudes |
| 5   | **colocaciones** ✅     | (reporte semanal de colocaciones — todos los roles)                                                           |
| 6   | **clientes**            | (listado + modal alta + ficha detalle)                                                                        |
| 7   | **cliente-detalle**     | (pantalla completa por cliente)                                                                               |
| 8   | **historial**           | (filtros por asesor y fecha)                                                                                  |
| 9   | **caja** ✅             | Operativa (apertura + movimientos + cobros) · Historial (tab)                                                 |
| 10  | **gastos**              | Gastos Registrados · Registrar Gasto                                                                          |
| 11  | **reportes**            | Diario Ingresos/Egresos · Colocaciones · Cartera · Por Asesor                                                 |
| 12  | **sucursales**          | (listado + modal crear/editar)                                                                                |
| 13  | **usuarios**            | (listado + modal alta)                                                                                        |
| 14  | **bitacora**            | (log con filtros)                                                                                             |
| —   | **administracion** ✅   | Configuración · Días Inhábiles · Bitácora de Configuración                                                    |

> "Préstamos" fue renombrado a **"Créditos Nuevos"** en toda la aplicación — NUNCA usar "Préstamos".

### Módulo Renovaciones — Pestañas (flujo de dos pasos V13)

Las renovaciones siguen el ciclo: **SOLICITADO → APROBADO → ACTIVO / RECHAZADO**. La aprobación (visto bueno) y el desembolso (entrega del efectivo) son pasos separados.

- **Listos para Renovar** (todos los roles): lista de solo lectura con los clientes elegibles. Umbral: 16 pagos completados (créditos a 25 días) o 19 pagos completados (créditos a 30 días). La lista se filtra por rol (ver `02-roles-y-permisos.md`). Los créditos que ya tienen una solicitud SOLICITADO pendiente **no aparecen** en esta lista. Botón "Renovar →" navega a la pestaña "Nueva Solicitud" con el cliente preseleccionado.

- **Pendientes de Aprobación** (solo Gerente General y Gerente de Sucursal): cola de tarjetas elaboradas, una por solicitud SOLICITADO, ordenadas de más antigua a más reciente. Cada tarjeta tiene:
  - **Header**: nombre del cliente + badge "Renovación"; asesor, sucursal y fecha/hora exacta de la solicitud.
  - **Cuerpo izquierdo**: barra de progreso de pagos, alerta roja con monto si hay multas, garantía material si existe.
  - **Cuerpo derecho**: crédito anterior vs monto solicitado; campo editable **"Monto Aprobado"** (pre-cargado con el monto solicitado, puede modificarse); recálculo en tiempo real del monto a desembolsar (400ms debounce vía `/api/renovaciones/calcular`).
  - **Footer de acciones**: botón "Aprobar" guarda el visto bueno + monto aprobado. **No crea el crédito todavía** — la renovación pasa a APROBADO y queda en cola de desembolso. Botón "Rechazar" abre modal para capturar motivo. Link "Ver historial del cliente".

- **Pendientes de Desembolso** (solo Gerente General y Gerente de Sucursal): cola de renovaciones APROBADAS pendientes de confirmar el desembolso físico. Ordenadas por fecha de aprobación ascendente. Endpoint: `GET /api/renovaciones/pendientes-desembolso`. Cada tarjeta tiene:
  - **Header**: nombre, sucursal, asesor, fecha en que fue aprobada y por quién.
  - **Cuerpo izquierdo**: estado de multas + zona de **FileUpload de video** (opcional, `video-entrega/renovaciones/{id}/`).
  - **Cuerpo derecho**: crédito anterior vs monto aprobado (con nota si fue ajustado respecto al solicitado); pagos restantes; monto a desembolsar.
  - **Botón "Confirmar desembolso"**: ejecuta el flujo real — crédito anterior → RENOVADO, nuevo crédito ACTIVO, calendario generado. Navega al nuevo crédito.

- **Mis Solicitudes** (solo Supervisor y Asesor): historial personal de todas las solicitudes de renovación enviadas, ordenadas de más reciente a más antigua. Endpoint: `/api/renovaciones/mis-solicitudes` (filtra por `asesor_id` en backend). Cada tarjeta muestra:
  - **Header**: nombre del cliente, fecha/hora de envío y badge de estado (`SOLICITADO` → ámbar+pulso, `APROBADO` → naranja+pulso, `ACTIVO` → teal, `RECHAZADO` → rojo).
  - **Cuerpo**: cuadro comparativo crédito anterior vs monto aprobado; pagos restantes y multas al momento del envío; monto a desembolsar.
  - **Caso RECHAZADO**: bloque prominente (fondo rojo suave) con motivo y nombre del revisor.
  - **Caso APROBADO**: bloque ámbar con "El gerente aprobó esta renovación", nota si el monto fue ajustado, FileUpload de video (opcional) y botón **"Confirmar desembolso →"** para que el asesor confirme la entrega del efectivo.
  - **Caso ACTIVO**: enlace al nuevo crédito ("Ver crédito activo →"), confirmado por nombre del confirmador y fecha.
  - **Filtro por estado**: chips "Todas / En revisión / Pendiente desembolso / Activas / Rechazadas".
  - **Búsqueda por cliente**: campo de texto con ícono lupa; filtra en tiempo real sobre las solicitudes cargadas.
  - **Filtro por fecha de envío**: preset chips "Todas las fechas / Hoy / Ayer / Esta semana / Este mes / Rango"; cuando se selecciona "Rango" aparecen inputs Desde/Hasta. Filtra sobre `createdAt`. Los tres filtros (estado, búsqueda, fecha) se combinan entre sí.
  - **Estado vacío con filtros activos**: muestra "No hay solicitudes con esos filtros" y botón "Limpiar filtros" que resetea los tres filtros a su valor por defecto.
  - **Estado vacío sin filtros**: mensaje claro con botón "Nueva Renovación".

- **Nueva Solicitud** (solo Supervisor y Asesor): formulario de dos pasos para enviar solicitud de renovación.
  - **Paso 1:** selección de cliente (o preseleccionado desde "Listos para Renovar").
  - **Paso 2:** campos calculados automáticamente (Pagos Restantes, Monto Pagos Restantes, Pago Crédito Nuevo, Monto a Entregar) + campos editables (Monto Nuevo, Forma de Pago).
  - Validación por forma de pago:
    - Diario: $1,000–$50,000
    - Semanal: $2,000–$30,000
  - Banner informativo indica que la solicitud quedará pendiente de aprobación. Al confirmar: toast "Solicitud enviada — pendiente de aprobación del gerente".

#### Badges visuales

- **`TipoCreditoBadge`**: aparece en la columna "Tipo" de TabSolicitudes y en la ficha de detalle.
  - `NUEVO` → badge verde (`bg-emerald-100 text-emerald-800`)
  - `RENOVACION` → badge azul (`bg-blue-100 text-blue-800`)
  - El campo `tipo` viene del backend como string `"NUEVO"` o `"RENOVACION"` en ambos DTOs (`CreditoResumenDTO` y `CreditoDetalleDTO`); el frontend lo mapea en los normalizadores de `creditoService.ts`.
  - **Filtro por tipo** en TabSolicitudes: dropdown "Todos los tipos / Nuevo / Renovación"; filtra client-side sobre los créditos de la página actual. Se combina con los filtros de estado y asesor.
- **`EstadoRenovacionBadge`**: aparece en la cola de pendientes.
  - `SOLICITADO` → azul | `APROBADO` → verde | `RECHAZADO` → rojo

- **`TipoPagoBadge`**: distingue modalidad de pago en listados y detalle.
  - `DIARIO` → gris (`bg-gray-100 text-gray-700`)
  - `SEMANAL` → azul (`bg-blue-100 text-blue-700`)
  - Se muestra en: Créditos Nuevos (tabla de solicitudes), detalle de crédito, Ruta del Día, Historial de Cobros, Listos para Renovar y Colocaciones Semanales.

### Módulo Colocaciones Semanales — Descripción

Módulo independiente en la navegación lateral (sidebar), accesible por los 4 roles. Muestra el reporte de colocaciones de la semana actual: créditos nuevos y renovaciones desembolsados, agrupados por asesor. Extraído de Renovaciones en Abril 2026 para darle visibilidad directa a todos los roles sin necesidad de entrar al flujo de renovación.

---

## 7. Alta de Cliente — Campos Completos (actualizado en revisión cliente Abril 2026)

### Sección 1: Datos del Solicitante

- Nombre(s) _, Apellido Paterno _, Apellido Materno \*
- Fecha de Nacimiento _, Celular _, **Teléfono fijo** (opcional)
  > ⚠️ Teléfono fijo va DESPUÉS del celular y ANTES del estado civil
  > para que quede claro que es del cliente y no del cónyuge
- Estado Civil \* (Soltero(a) / Casado(a) / Unión libre)
- Nombre del cónyuge (opcional, visible siempre al final de la sección)

### Sección 2: Identificación

- No. de INE _, CURP _
- RFC (opcional), Tipo de identificación

### Sección 3: Domicilio del Cliente

- Calle _, No. Exterior _, No. Interior (opcional)
- Colonia _, Municipio _, Estado _, C.P. _
- Tipo de vivienda (Propia / Rentada), Monto de renta si aplica

### Sección 4: Datos del Negocio

- Nombre del Negocio _, Giro _, Antigüedad \*
- **Dirección del negocio — OBLIGATORIA y dividida en campos separados:**
  - Calle _, No. Exterior _, No. Interior (opcional)
  - Colonia _, Municipio _, Estado _, C.P. _
- Tipo de local (Propio / Rentado), Monto de renta si aplica
- Horarios del negocio
- **Mapa interactivo (Leaflet / OpenStreetMap):** el asesor puede marcar la ubicación exacta del negocio haciendo clic en el mapa o usando el botón "Mi ubicación" (geolocalización del dispositivo). Las coordenadas se guardan en `negocio_lat DECIMAL(10,7)` y `negocio_lng DECIMAL(10,7)`. El pin es opcional — no bloquea el guardado del cliente.

### Sección 5: Ingresos y Gastos del Negocio

- Ingresos promedio semanales
- Gastos: Renta | Servicios | Empleados | Proveedores

### Sección 6: Referencias Personales (2 obligatorias)

- Nombre Ref. 1 _, Teléfono _, Parentesco \*
- Dirección (de la referencia), Años de conocerlo
- Nombre Ref. 2 _, Teléfono _, Parentesco \*
- Dirección (de la referencia), Años de conocerlo

### Sección Aval (colapsable, opcional)

- Nombre, Teléfono, Dirección, No. de identificación

### Tab "Documentos" (ficha de detalle del cliente)

La página de detalle del cliente incluye un tab **"Documentos"** para gestionar el acervo documental del cliente:

- **Documentos soportados:** INE Frente (`INE_FRENTE`), INE Reverso (`INE_REVERSO`), Comprobante de Domicilio (`COMPROBANTE_DOMICILIO`), Otro (`OTRO`)
- **UI:** zona de upload con selector de tipo de documento y descripción opcional; listado de documentos existentes con opción de eliminar (soft delete)
- **Tipos de archivo aceptados:** imágenes (jpg, png, webp) y PDF
- **Cardinalidad:** múltiples documentos por cliente
- Los documentos se almacenan en S3 — ver `06-archivos-y-storage.md` para detalles

---

## 8. Solicitud de Crédito — Campos (módulo Créditos Nuevos)

- Cliente _, Lugar _, Fecha, Asesor \*
- Monto Solicitado _, Forma de Pago _ (Diario/Semanal)
- Validación del monto según forma de pago:
  - Diario: $1,000–$50,000
  - Semanal: $2,000–$30,000
- Plazo (autocalculado y deshabilitado)
- Garantía Material (texto opcional)
- **Evidencia del Negocio \*** → upload de fotos/videos (ver `06-archivos-y-storage.md`)
- Monto Aprobado \* (en pestaña Evaluación)
- Observaciones (en pestaña Evaluación)
- **Video de Entrega de Dinero** → upload de video grabado al momento
  de entregar el efectivo al cliente. Se sube en el paso de desembolso
  o posteriormente desde la ficha del crédito.
  **NO es obligatorio para activar el crédito** — el crédito pasa a ACTIVO
  al ser aprobado y desembolsado. El video puede subirse después.
  Ver `06-archivos-y-storage.md` para detalles de almacenamiento.

---

## 8.1. Detalle de Crédito — Bloques de Vínculo de Renovación (CreditoDetallePage)

Aparecen al final del detalle de crédito, después del card de tabs, como tarjetas independientes:

#### "Liquidado por Renovación" (borde/fondo azul)

Visible únicamente cuando el crédito tiene estado `RENOVADO`. Muestra:

- Fecha y hora de la renovación
- Pagos cubiertos y su monto total
- Monto del crédito nuevo generado
- Desembolso entregado al cliente
- Botón "Ver crédito #N →" que navega al crédito nuevo

#### "Originado por Renovación" (borde/fondo ámbar)

Visible cuando el crédito fue generado a partir de una renovación (es el crédito nuevo en la cadena). Muestra:

- ID y monto del crédito anterior
- Pagos del anterior que fueron cubiertos
- Botón "← Ver crédito anterior #N" para navegar al crédito predecesor

**Cadena completa de renovaciones:** ambos bloques permiten navegar la cadena completa de créditos de un cliente (crédito #1 → renovado → crédito #2 → renovado → crédito #3). No se muestran en créditos ACTIVOS, PAGADOS ni CANCELADOS sin vínculo de renovación.

---

## 9. Alta de Usuario — Campos Completos (según mock)

- Nombre Completo _, Correo Electrónico _, Contraseña _, Teléfono _
- Rol _, Sucursal _
- Calle _, No. Exterior _, Colonia _, Municipio _, Estado _, C.P. _
- No. de INE \*
- **Imagen INE \*** → upload de foto/escaneo (ver `06-archivos-y-storage.md` sección 4.2)
- Referencia 1: Nombre _, Teléfono _, Parentesco \*
- Referencia 2: Nombre _, Teléfono _, Parentesco \*

---

## 10. Módulo de Cobros — Comportamiento Detallado

### Pestaña "Ruta del Día"

**Métricas en encabezado:** Multas | No Pagaron

**Tabla de control de pagos:**

- Columnas: Cliente | Pago | 1 | 2 | 3 | … | N | Venc. | Acción
- ✓ verde = pagó | ✗ rojo = no pagó (tooltip con razón) | número amarillo = monto de multa ese día
- Columna "Fin" = crédito completado

**Modal "Cobrar":**

- Monto Recibido \* (acepta abonos)
- ¿Pago completo? (toggle Sí/No)
- Razón de falta de pago \* (obligatorio si no pagó)
- Al marcar "No pagó" → multa aplicada automáticamente

**Días INHÁBIL:** celda bloqueada, sin multa.

**Sub-encabezado de cuadre:** DIARIO 1-14 | DIARIO 15-20 | SEMANAL | TOTAL | MULTAS | Firma Cajero

### Pestaña "Historial de Cobros"

Filtros: fecha (Hoy/Ayer), asesor, estado.
Columnas: Cliente | Asesor | Pago # | Monto | Estado | Fecha.

---

## 17. Diseño Responsive — Mobile First

El sistema es **100% responsive**. Los asesores/cobradores usan la aplicación desde su teléfono celular mientras están en ruta cobrando a los clientes. Esto es un requerimiento crítico, no opcional.

### Enfoque: Mobile First

Todo componente y pantalla debe diseñarse **primero para móvil**, luego escalar a tablet y desktop con los breakpoints de Tailwind:

```
sin prefijo → móvil    (< 640px)   ← DISEÑAR AQUÍ PRIMERO
sm:         → 640px+
md:         → 768px+   ← tablet
lg:         → 1024px+  ← desktop
xl:         → 1280px+
```

**Regla:** Si un componente se ve bien en móvil y se rompe en desktop, es aceptable corregirlo. Si se ve bien en desktop y se rompe en móvil, es un bug crítico.

### Prioridad de responsive por módulo

| Módulo                         | Usado en móvil por                        | Prioridad  |
| ------------------------------ | ----------------------------------------- | ---------- |
| **Cobros** — Ruta del Día      | Asesor/Cobrador en campo                  | 🔴 Crítica |
| **Clientes** — ficha y listado | Asesor consultando en negocio del cliente | 🔴 Crítica |
| **Cobros** — Modal de pago     | Asesor registrando cobro en campo         | 🔴 Crítica |
| **Renovaciones**               | Asesor en negocio del cliente             | 🟡 Alta    |
| **Dashboard**                  | Supervisor revisando desde campo          | 🟡 Alta    |
| **Créditos Nuevos**            | Asesor capturando solicitud en campo      | 🟡 Alta    |
| **Historial de Pago**          | Consulta en campo                         | 🟡 Alta    |
| **Corte de Caja**              | Solo en sucursal (desktop/tablet)         | 🟢 Media   |
| **Reportes**                   | Solo en oficina                           | 🟢 Baja    |
| **Administración**             | Solo admin en oficina                     | 🟢 Baja    |

### Patrones de UI obligatorios para móvil

**Navegación:**

- En móvil: menú lateral colapsado, accesible con botón hamburger (☰)
- En desktop: menú lateral siempre visible
- Ejemplo Tailwind: `hidden lg:flex` para sidebar, `flex lg:hidden` para hamburger

**Tablas (el caso más crítico — la grilla de cobros):**

- En móvil: las tablas anchas (grilla de pagos con 25+ columnas) se convierten en **cards por cliente**
- Cada card muestra: nombre, monto de pago, estado del día actual, botón "Cobrar"
- El historial completo de pagos se accede en una vista de detalle separada
- En desktop: tabla completa con todas las columnas como en el mock

```
Móvil — Card por cliente:        Desktop — Tabla completa:
┌─────────────────────────┐      Cliente | Pago | 1|2|3|...|25 | Acción
│ Rosa Garcés Santana     │      ────────────────────────────────────────
│ $104/día  • Pago #14   │      Rosa G.  | $104 | ✓|✓|✓|...|  | [Cobrar]
│ ✓ Al corriente          │
│            [Cobrar]     │
└─────────────────────────┘
```

**Formularios:**

- En móvil: una columna, campos a full width
- En desktop: dos o tres columnas (como en el mock)
- Ejemplo: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

**Botones de acción:**

- En móvil: botones grandes con área de toque mínima de 44×44px (accesibilidad táctil)
- El botón "Cobrar" en la ruta del día debe ser prominente y fácil de tocar con el pulgar
- Usar `py-3 px-4 text-base` como mínimo en móvil

**Modales:**

- En móvil: ocupan pantalla completa (100vw, 100vh) o casi completa
- En desktop: centrados con ancho máximo como en el mock
- Ejemplo: `w-full h-full md:w-auto md:h-auto md:max-w-lg`

**Métricas del dashboard y cobros:**

- En móvil: 2 columnas de cards apiladas
- En desktop: fila horizontal como en el mock
- Ejemplo: `grid grid-cols-2 lg:grid-cols-4`

### Consideraciones específicas para cobradores en campo

- **Conectividad limitada:** los cobradores pueden tener señal débil. Las pantallas deben cargar rápido — evitar imágenes pesadas en la vista de ruta, paginar listas largas.
- **Uso con una mano:** los botones principales (Cobrar, confirmar pago) deben estar en la zona inferior de la pantalla (zona del pulgar).
- **Legibilidad al sol:** usar suficiente contraste. Los colores del mock (verde oscuro `#3d6b35`, texto oscuro sobre fondo claro) ya son adecuados.
- **El modal de cobro es la acción más frecuente** — debe ser la pantalla más optimizada para móvil de todo el sistema.
- **Feedback inmediato:** después de registrar un cobro, mostrar confirmación visual clara (toast/snackbar) antes de volver a la lista.

### Lo que NO cambia con responsive

- El stack tecnológico es el mismo: React 18 + Tailwind CSS es suficiente, no se necesita React Native ni app nativa.
- La API REST es la misma para móvil y desktop.
- Los datos y reglas de negocio son idénticos.

---

## Módulo 9: Administración ✅

Ruta: `/administracion` · Solo rol `ADMINISTRADOR`

El módulo tiene un selector de sucursal visible en todas las pestañas (el tab "Días Inhábiles" no lo requiere porque los días son globales, pero el selector se mantiene para consistencia visual).

### Pestaña 1 — Configuración por Sucursal

6 secciones colapsables, cada una con su propio botón "Guardar cambios":

| Sección              | Campos editables                                                                    | Endpoint                                             |
| -------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Multas**           | rangoMin, rangoMax, multaNoPago, multaIncompletos, multaSemanalNoPago, multaSemanalIncompletos | `PUT /admin/sucursales/{id}/multas/{multaId}`         |
| **Rangos de Crédito**| Tablas DIARIO / SEMANAL: rangoMin, rangoMax, plazo, tasaInteres                    | `PUT /admin/sucursales/{id}/rangos`                  |
| **Hora Límite**      | horaLimiteOperacion (HH:mm)                                                         | `PUT /admin/sucursales/{id}/config`                  |
| **Ahorro Diario**    | porcentajeAhorro (%), montoAhorroFijo ($)                                            | `PUT /admin/sucursales/{id}/config`                  |
| **Nómina**           | Tabla de personal con alta/edición/baja. Campo extra: diaPagoNomina                 | `POST/PUT/DELETE /admin/sucursales/{id}/nomina`       |
| **Conceptos**        | Lista de etiquetas para inversiones de caja. Alta/edición/baja                     | `POST/PUT/DELETE /admin/sucursales/{id}/conceptos`   |

Las secciones Hora Límite, Ahorro y Nómina (día de pago) comparten el mismo endpoint `PUT config`. Al guardar, cada sección fusiona sus campos con el estado actual del query `['admin-config', sucursalId]` para no pisar los demás campos.

### Pestaña 2 — Días Inhábiles

- Calendario anual (grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`) con navegación por año.
- Cada mes como `MonthCard`: lunes a domingo, color por tipo:
  - Fin de semana: `#ced4da` (gris)
  - Día inhábil registrado: `#fef3c7` (ámbar)
  - Día normal: `#495057` texto, fondo blanco
- Lista de días registrados con edición inline y eliminación.
- Formulario de alta con campo fecha + descripción.
- Los días son globales (`aplica_sucursal_id = NULL`).
- Endpoints: `GET/POST /admin/dias-inhabiles`, `PUT/DELETE /admin/dias-inhabiles/{id}`

### Pestaña 3 — Bitácora de Configuración

Tabla de solo lectura. Columnas: Fecha/Hora · Usuario · Sucursal · Sección · Campo · Valor anterior · Valor nuevo.

Filtros: sucursal, sección (enum), rango de fechas (desde/hasta con date inputs, default = mes actual).

Paginación: Anterior/Siguiente, 30 registros por página.

Mobile: cards con colores diferenciales (valor anterior en ámbar, valor nuevo en verde).

Endpoint: `GET /api/admin/bitacora?sucursalId=&seccion=&desde=&hasta=&page=&size=`

Secciones válidas: `CONFIG_GENERAL` · `MULTAS` · `RANGOS_CREDITO` · `UMBRALES_RENOVACION` · `AHORRO` · `NOMINA` · `CONCEPTOS` · `DIAS_INHABILES`
- Es una PWA opcional en el futuro (no en el alcance actual), pero el diseño responsive ya la prepara para eso.

---

## Módulo Caja — Pantallas implementadas (V16)

### Pantalla principal `/caja` — Tabs

**Tab "Operativa"** (default):
- Si no hay caja hoy: formulario de apertura (monto + concepto).
- Si hay caja ABIERTA: status bar verde + botón "Cerrar Caja" → navega a `/caja/cierre` · tabla de movimientos de inversión (agregar/eliminar inline) · tabla de cobros del día agrupados por asesor.
- Si hay caja CERRADA: solo el status bar con el mensaje de cierre.

**Tab "Historial"**:
- Filtros: rango de fechas (desde/hasta) con date inputs.
- Tabla: Fecha · Estado · Cerrada por · Subtotal · Botón PDF.
- Clic en fila → expande detalle inline: ingreso carteras, desembolsos, subtotal, libres, inversiones del día.
- Botón PDF por fila (llama `GET /api/caja/{cajaId}/pdf`).

### Pantalla de cierre `/caja/cierre`

Accesible solo para ADMINISTRADOR y SUPERVISOR.

**Pre-cierre (vista de revisión)**:
- Header con botón "Volver a Caja" + botón "Cerrar Caja".
- Secciones (collapsibles en mobile con toggle):
  - **Inversiones**: tabla conceptoNombre / descripción / monto, subtotal al pie.
  - **Ingresos de Carteras**: tabla asesor / cantidad cobros / monto, total al pie.
  - **Desembolsos**: lista créditos nuevos / renovaciones / total.
  - **Subtotal Caja** (destacado, borde verde): fórmula visible apertura + ingresos − desembolsos ± inversiones = subtotal.
  - **Libres**: monto libres, ahorro fijo, total real libres, placeholders con fondo `dashed` para Gastos y Nómina.
  - **Multas**: tabla asesor / total multas (colapsado por defecto si no hay multas).
- Botón "Cerrar Caja" también al final de la página.

**Modal de confirmación**:
- Texto: "¿Confirmas el cierre de caja? Esta acción es irreversible."
- Botones: Cancelar · Sí, cerrar caja.

**Post-cierre (vista de éxito, misma ruta)**:
- Banner verde con datos de la caja cerrada.
- Resumen final en tarjetas (6 métricas).
- Botón "Exportar PDF".

### Reglas mobile-first para Caja

- En pantallas < 640px cada sección del resumen de cierre es **collapsible** (toggle de ChevronDown/ChevronUp).
- Todas las tablas usan `overflow-x-auto` para scroll horizontal.
- El detalle expandido en historial usa `grid-cols-2` en mobile, `grid-cols-3` en sm+.

### Placeholders (pendientes de conectar)

| Placeholder | Cuándo se conectará |
|-------------|---------------------|
| ~~Gastos operativos~~ | ✅ Conectado — Módulo 7 implementado |
| Nómina | Configuración de nómina en Administración |

---

## Módulo Gastos — Pantallas implementadas (V18/V19/V20/V21)

### Ruta: `/gastos`

Accesible únicamente por **Administrador** y **Supervisor** (Gerente de Sucursal). Los roles `SUPERVISOR_CAMPO` y `ASESOR_COBRADOR` no tienen acceso.

### Selector de fecha y modo de edición

- **Selector de fecha** visible en la parte superior (default = hoy).
- El sistema **autodetecta el modo** según la fecha seleccionada y el estado de la caja:
  - **Modo edición**: fecha = hoy + caja del día en estado `ABIERTA`.
  - **Modo lectura**: fecha pasada O caja en estado `CERRADA`.
- En modo lectura: los controles de agregar/editar/eliminar se ocultan o deshabilitan. Se muestra un banner informativo ("Caja cerrada — solo lectura").
- En modo edición: se muestra el formulario/botón para registrar nuevo gasto.

### Tabla de gastos agrupada por categoría

- Los gastos del día seleccionado se muestran **agrupados por categoría** con subtotales por grupo.
- Columnas por fila de gasto: Categoría · Concepto · Monto · Acciones (editar / eliminar — solo en modo edición).
- Fila de subtotal al final de cada grupo: "Subtotal Gasolina: $XXX".
- Fila de total general al pie de la tabla: "Total gastos del día: $XXX".

### Modal de alta / edición de gasto

- Se abre con el botón "Agregar gasto" (solo en modo edición).
- Campos:
  - **Categoría** — dropdown con las categorías activas de la sucursal.
  - **Concepto** — campo de texto libre (obligatorio).
  - **Monto** — numérico DECIMAL(12,2), debe ser mayor a $0 (obligatorio).
- Al guardar, la tabla se recarga y el total del día se actualiza en tiempo real.
- El modal cierra automáticamente al confirmar.

### Responsive

- En móvil: tabla se convierte en cards por gasto (categoría + concepto + monto + acciones).
- Botón "Agregar gasto" fijo al pie de la pantalla en móvil (zona del pulgar).
- Modal: pantalla completa en móvil (`w-full h-full`), centrado con max-width en desktop.

### Configuración de categorías — módulo Administración

En la pestaña **Configuración** del módulo Administración (sección "Categorías de Gastos"):

- Lista de categorías activas e inactivas por sucursal.
- Alta de nueva categoría: nombre + descripción (opcional).
- Edición inline: nombre y descripción.
- Desactivar categoría: toggle `activo = false` (soft delete — no se eliminan registros para preservar FK de gastos históricos).
- Las categorías inactivas no aparecen en el dropdown del modal de gastos, pero sus gastos históricos siguen visibles en el historial.
- Endpoint: `POST/PUT /api/admin/sucursales/{id}/categorias-gasto`
