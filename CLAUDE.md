# MAGNO Sistema de Cobros — Contexto del Proyecto v3.2

> Fuentes: Arquitectura v3.0 (docx) + Mock v3 (HTML) + Documentación física del cliente
> Última revisión: Abril 2026

---

## 1. Descripción General

Sistema de gestión financiera a la medida para **MAGNO Financiera** (microfinanciera).
Digitaliza el ciclo completo: alta de cliente → colocación de crédito → cobro diario → renovación → corte de caja.

| Campo                  | Detalle                                                       |
| ---------------------- | ------------------------------------------------------------- |
| Usuarios concurrentes  | ~23                                                           |
| Sucursales             | 1 a 3                                                         |
| Plazo de desarrollo    | 24 semanas                                                    |
| Costo total            | $50,000 MXN sin IVA                                           |
| Estructura de pago     | 30% anticipo / 40% al 60% funcional / 30% entrega final       |
| Despliegue recomendado | Cloud VPS Hetzner/Contabo (~$20 USD/mes)                      |
| Opción futura          | Servidor on-premise cliente (Intel i5, 16 GB RAM, 250 GB SSD) |

---

## 2. Stack Tecnológico

| Capa                       | Tecnología                                                |
| -------------------------- | --------------------------------------------------------- |
| Frontend                   | React 18 + TypeScript + Vite + Tailwind CSS               |
| Estado servidor            | React Query                                               |
| HTTP client                | Axios con interceptor JWT                                 |
| Routing                    | React Router v6                                           |
| Backend                    | Spring Boot 3 + Java 17                                   |
| Autenticación              | Spring Security + JWT                                     |
| ORM                        | JPA / Hibernate                                           |
| Base de datos              | PostgreSQL                                                |
| Migraciones                | Liquibase                                                 |
| Caché                      | Redis (sesiones + tokens + datos frecuentes)              |
| PDF                        | iText                                                     |
| Email                      | JavaMailSender                                            |
| Contenedores               | Docker Compose                                            |
| Proxy                      | Nginx (reverse proxy + SSL termination)                   |
| Almacenamiento de archivos | S3-compatible (Hetzner Object Storage o MinIO on-premise) |
| Cloud VPS                  | Hetzner o Contabo (~$20 USD/mes) / Ubuntu 24 LTS          |

### Estructura del Repositorio (Monorepo)

```
magno-sistema/
├── backend/
│   ├── src/main/java/com/magno/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   ├── model/
│   │   ├── dto/
│   │   ├── security/
│   │   └── config/
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── db/changelog/   ← migraciones Liquibase
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       ├── types/
│       └── utils/
├── docker-compose.yml
└── CLAUDE.md
```

---

## 3. Roles y Permisos — 4 ROLES (no 5)

> ⚠️ El sistema tiene exactamente 4 roles. "Cajero" NO existe como rol separado.
> El mock y la arquitectura v3 documentan: Administrador, Supervisor, Supervisor de Campo, Asesor/Cobrador.

| Rol                     | Key en BD          | Descripción                                                                                                 | Restricciones clave                                                                                      |
| ----------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Administrador**       | `ADMINISTRADOR`    | Acceso total al sistema. Gestión de usuarios, sucursales, configuración, reportes y caja.                   | Sin restricciones                                                                                        |
| **Supervisor**          | `SUPERVISOR`       | Operación completa + reportes. Puede ver y aprobar créditos y renovaciones. Acceso a corte de caja.         | NO puede gestionar usuarios ni configuración del sistema                                                 |
| **Supervisor de Campo** | `SUPERVISOR_CAMPO` | Cobros, registro de pagos, historial, colocaciones. Similar a Supervisor pero sin acceso a admin ni dinero. | NO puede aperturar ni cerrar caja. Sin acceso a configuración ni gestión de usuarios                     |
| **Asesor / Cobrador**   | `ASESOR_COBRADOR`  | Solo su ruta de cobros, registro de pagos de sus clientes y consulta de historial                           | Solo ve sus propios clientes y cobros. Sin caja, sin reportes generales, sin usuarios, sin configuración |

**En la UI el rol se muestra como:**

- "Administrador"
- "Supervisor"
- "Supervisor de Campo" (abreviado "Sup. de Campo" en la tabla de usuarios)
- "Asesor/Cobrador"

**Apertura/cierre de caja permitida:** Administrador y Supervisor únicamente.
**Supervisor de Campo y Asesor/Cobrador NO pueden abrir ni cerrar caja.**

---

## 4. Almacenamiento de Archivos — Mapa Completo

> ⚠️ NUNCA almacenar archivos binarios en PostgreSQL.
> SIEMPRE usar almacenamiento externo S3-compatible. La BD guarda únicamente la URL/ruta del archivo.

### 4.1 Todos los puntos de upload en el sistema

| Módulo              | Sección         | Campo                    | Tipo de archivo                                                                          | Obligatorio | Columna en BD                             |
| ------------------- | --------------- | ------------------------ | ---------------------------------------------------------------------------------------- | ----------- | ----------------------------------------- |
| **Créditos Nuevos** | Nueva Solicitud | Evidencia del Negocio    | Fotos y/o videos del negocio                                                             | ✅ Sí       | `creditos.evidencia_urls` (array)         |
| **Usuarios**        | Alta de Usuario | Imagen INE               | Foto o escaneo de INE (imagen)                                                           | ✅ Sí       | `usuarios.ine_imagen_url`                 |
| **Gastos**          | Registrar Gasto | Comprobante / Referencia | ⚠️ Campo de TEXTO libre (no es upload de archivo) — folio, número de ticket, descripción | ❌ No       | `gastos.comprobante_referencia` (VARCHAR) |

> **Nota importante sobre Gastos:** El mock implementa el comprobante como `<input type="text" placeholder="Folio, foto, o referencia del comprobante">`. Es un campo de texto, NO una zona de upload. Captura el folio o descripción del comprobante físico, no el archivo en sí.

> **Nota importante sobre Alta de Cliente:** El modal de Alta de Cliente en el mock NO incluye upload de imagen de INE ni fotos de evidencia — estos campos están simplificados. El upload de evidencia del negocio y el INE-imagen se capturan en el flujo de **Créditos Nuevos** (solicitud) y **Usuarios** respectivamente. Si en el futuro se decide agregar INE-imagen al alta de cliente, seguiría el mismo patrón S3.

### 4.2 Detalles por punto de upload

#### Evidencia del Negocio (Créditos Nuevos → Nueva Solicitud)

- **Qué sube:** fotos y/o videos del local, instalaciones del negocio del cliente
- **Propósito:** comprobante visual de ingresos del cliente
- **UI:** zona de drag & drop con texto "Arrastra fotos/videos del negocio o haz clic para seleccionar"
- **Tipos aceptados:** imágenes (jpg, png, webp) y videos (mp4, mov) — definir tamaño máximo
- **Cardinalidad:** múltiples archivos por solicitud (array de URLs)
- **Almacenamiento:** S3 → `magno/evidencia-negocio/{cliente_id}/{credito_id}/`
- **BD:** `creditos.evidencia_urls TEXT[]` — array de URLs S3
- **Ciclo de vida:** persiste mientras el crédito/cliente esté activo; archivar al dar de baja

#### Imagen INE de Usuario (Usuarios → Alta de Usuario)

- **Qué sube:** foto o escaneo del INE/credencial del empleado
- **Propósito:** verificación de identidad del usuario del sistema
- **UI:** zona de upload con texto "Foto/escaneo de INE" (obligatoria en el mock con \*)
- **Tipos aceptados:** imágenes (jpg, png, pdf del escaneo)
- **Cardinalidad:** un archivo por usuario
- **Almacenamiento:** S3 → `magno/usuarios-ine/{usuario_id}/`
- **BD:** `usuarios.ine_imagen_url VARCHAR` — URL única S3
- **Ciclo de vida:** persiste mientras el usuario esté activo en el sistema

### 4.3 Estrategia de almacenamiento S3

```
Bucket: magno-files/
├── evidencia-negocio/
│   └── {cliente_id}/
│       └── {credito_id}/
│           ├── foto_01.jpg
│           ├── foto_02.jpg
│           └── video_01.mp4
└── usuarios-ine/
    └── {usuario_id}/
        └── ine.jpg
```

**Consideraciones técnicas:**

- En Hetzner (cloud recomendado): usar **Hetzner Object Storage** (~$6 USD/mes por 1 TB) — compatible con API S3
- En on-premise: usar **MinIO** (S3-compatible, self-hosted, gratis)
- El backend expone un endpoint `/api/files/upload` que recibe el archivo, lo sube a S3 y devuelve la URL
- Las URLs se almacenan en la BD como strings; nunca los bytes del archivo
- Definir tamaño máximo por archivo (sugerido: 50 MB para videos, 10 MB para imágenes)
- Los archivos de video pueden ser grandes — considerar compresión en frontend antes de upload o límite de duración

**Dependencia Java para S3:**

```xml
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>s3</artifactId>
</dependency>
```

---

## 5. Módulos del Sistema (13 módulos)

| #   | Módulo (key navegación) | Pestañas internas                                             |
| --- | ----------------------- | ------------------------------------------------------------- |
| 1   | **dashboard**           | —                                                             |
| 2   | **cobros**              | Ruta del Día · Historial de Cobros                            |
| 3   | **creditos-nuevos**     | Solicitudes · Nueva Solicitud · Evaluación · Tabla de Pagos   |
| 4   | **renovaciones**        | Colocaciones Semanales · Nueva Renovación                     |
| 5   | **clientes**            | (listado + modal alta + ficha detalle)                        |
| 6   | **cliente-detalle**     | (pantalla completa por cliente)                               |
| 7   | **historial**           | (filtros por asesor y fecha)                                  |
| 8   | **caja**                | Apertura · Cierre / Corte · Histórico                         |
| 9   | **gastos**              | Gastos Registrados · Registrar Gasto                          |
| 10  | **reportes**            | Diario Ingresos/Egresos · Colocaciones · Cartera · Por Asesor |
| 11  | **sucursales**          | (listado + modal crear/editar)                                |
| 12  | **usuarios**            | (listado + modal alta)                                        |
| 13  | **bitacora**            | (log con filtros)                                             |
| —   | **administracion**      | Config. Multas · Config. Créditos · Días Festivos             |

> "Préstamos" fue renombrado a **"Créditos Nuevos"** en toda la aplicación — NUNCA usar "Préstamos".

---

## 6. Reglas de Negocio

### 6.1 Productos de Crédito

| Rango de monto    | Plazo   | Tasa |
| ----------------- | ------- | ---- |
| $1,000 – $14,000  | 25 días | 30%  |
| $15,000           | 25 días | 24%  |
| $20,000 – $50,000 | 30 días | 24%  |

- Sistema **autodetecta** plazo y tasa según monto: < $20k → 25 días, ≥ $20k → 30 días.
- Fórmula: `pago_diario = (Capital + Intereses) / plazo_dias`
- Cobros de **lunes a viernes**.
- Días festivos → **INHÁBIL**: no se cobra, no genera multa, no cuenta como día de pago. Configurables por sucursal.
- Modalidad: **diario** (más común) o **semanal** (tasa menor, casos especiales). ⚠️ Confirmar cálculo semanal.
- IVA = $0.00

### Tabla de Pagos Diarios Completa

#### 25 días — 30% interés

| Crédito | Ganancia | Total   | Pago/día |
| ------- | -------- | ------- | -------- |
| $1,000  | $300     | $1,300  | $52      |
| $2,000  | $600     | $2,600  | $104     |
| $3,000  | $900     | $3,900  | $156     |
| $4,000  | $1,200   | $5,200  | $208     |
| $5,000  | $1,500   | $6,500  | $260     |
| $6,000  | $1,800   | $7,800  | $312     |
| $7,000  | $2,100   | $9,100  | $364     |
| $8,000  | $2,400   | $10,400 | $416     |
| $9,000  | $2,700   | $11,700 | $468     |
| $10,000 | $3,000   | $13,000 | $520     |
| $11,000 | $3,300   | $14,300 | $572     |
| $12,000 | $3,600   | $15,600 | $624     |
| $13,000 | $3,900   | $16,900 | $676     |
| $14,000 | $4,200   | $18,200 | $728     |

#### 25 días — 24% interés

| Crédito | Ganancia | Total   | Pago/día |
| ------- | -------- | ------- | -------- |
| $15,000 | $3,600   | $18,600 | $744     |

#### 30 días — 24% interés

| Crédito | Ganancia | Total   | Pago/día |
| ------- | -------- | ------- | -------- |
| $20,000 | $4,810   | $24,810 | $827     |
| $25,000 | $6,000   | —       | $1,033   |
| $30,000 | $7,200   | —       | $1,240   |
| $35,000 | $8,400   | —       | $1,447   |
| $40,000 | $9,600   | —       | $1,653   |
| $45,000 | $10,800  | —       | $1,860   |
| $50,000 | $12,000  | —       | $2,067   |

### 6.2 Cobros y Pagos

- Al aprobar un crédito el sistema genera automáticamente el **calendario de pagos**, saltando sábados, domingos y días festivos. ⚠️ Confirmar lógica exacta de salto.
- Al momento del desembolso se cobra **1 pago adelantado** → se aplica al último pago (#25 o #30).
- Cada pago reduce el saldo del total (capital + intereses), no solo el capital.
- Se permiten **pagos incompletos** (abonos).
- Al marcar "No pagó" → campo de razón **obligatorio** → multa se aplica automáticamente.
- Las razones de no pago quedan en historial del cliente y se ven como tooltip sobre ✗.

### 6.3 Multas — DOS tipos independientes

**Tipo 1 — Por día no pagado:**

- Multa fija por cada día sin pago. Base: $50. Configurable por sucursal y rango de monto.
- Ejemplo: créditos $1k–$14k → $50/día; créditos $15k+ → $100/día.
- Se aplica automáticamente al registrar "No pagó".
- Días INHÁBIL NO generan multa.

**Tipo 2 — Por pagos incompletos acumulados:**

- Por cada **2 pagos incompletos acumulados** → multa adicional (configurable, base $50).
- Contador independiente del Tipo 1.

- Las multas pendientes **se descuentan del desembolso en renovaciones**.
- Configuración en módulo Administración → Config. Multas: Sucursal | Rango Mín | Rango Máx | Multa/Día | Multa por 2 Incompletos.

### 6.4 Renovaciones

- Elegibilidad: pago **#16** (25 días) / pago **#19** (30 días). El sistema bloquea antes.
- 0–1 pagos pendientes → puede aumentar monto. 2–3 pendientes → igual o menor.
- **Fórmula del desembolso (confirmada):**
  ```
  Desembolso = Crédito Nuevo − Pagos Restantes − Multas Pendientes − Pago Adelantado nuevo
  ```
  Ejemplo: $8,000 − (8 × $416 = $3,328) − $0 − $416 = **$4,256**
- Pago adelantado → se aplica al último pago del nuevo crédito.
- Salida de: **CAJA** o **RUTA** (campo requerido).
- Campos calculados automáticamente: Pagos Restantes, Monto Pagos Restantes, Pago Crédito Nuevo, Monto a Entregar.

### 6.5 Colocaciones

- Tabla semanal (Lunes–Viernes) por asesor. Incluye créditos nuevos + renovaciones.
- Columnas: Día | Cliente | Crédito Actual | Crédito Solicitado | Desembolso | Asesor | Tipo (Nuevo/Renovación).
- Totales al pie: Total Caja y Total Desembolsos.
- Vive en módulo **Renovaciones** → pestaña "Colocaciones Semanales".
- ⚠️ Confirmar: ¿tabla almacenada o reporte calculado?

### 6.6 Corte de Caja

```
+ Inversión inicial
+ Ingreso Carteras (cobros del día por todos los asesores)
− Desembolsos del día
= Subtotal Caja
− Apartado 24% del ingreso  ⚠️ confirmar base exacta
= Total Caja Libres
− Gastos del día
− Créditos nuevos colocados
− Ahorro fijo ($2,000/día hábil, configurable)
= Total Real Libres
```

- Solo pueden aperturar/cerrar: **Administrador y Supervisor**.
- Columnas de la tabla de cierre: Asesor | Inversión | Ingresos | Desembolsos | Apartado 24% | Libres | Multas.
- Exporta a PDF y envía por correo a gerencia.

### 6.7 Gastos Operativos

Categorías (exactas del sistema):

- Gasolina | Servicio motos | Recargas | Solicitud dinero dueño | Gastos varios

Campos por gasto: fecha, categoría, descripción, monto, responsable, sucursal, **comprobante/referencia (texto libre)**.

> El comprobante es un campo de texto (folio, número, descripción) — NO es upload de archivo.

Nómina: **NO es módulo del sistema** — excluida por el cliente.

### 6.8 Garantías

- Descripción textual del objeto únicamente — no se gestiona recuperación.
- Aplica en créditos nuevos y renovaciones de monto grande.
- Visible en ficha del cliente.

---

## 7. Alta de Cliente — Campos Completos (según mock)

El modal en el mock tiene estas secciones con estos campos exactos:

### Sección 1: Datos del Solicitante

- Nombre(s) _, Apellido Paterno _, Apellido Materno \*
- Fecha de Nacimiento _, Celular _
- Estado Civil \* (Soltero(a) / Casado(a) / Unión libre)
- Teléfono fijo, Nombre del cónyuge (opcionales)

### Sección 2: Identificación

- No. de INE _, CURP _
- RFC (opcional)
- Tipo de identificación
  > ⚠️ El mock de Alta de Cliente NO incluye upload de imagen de INE en este modal simplificado. La imagen de INE del cliente podría agregarse en una iteración futura — por ahora solo texto.

### Sección 3: Domicilio

- Calle _, No. Exterior _, No. Interior (opcional)
- Colonia _, Municipio _, Estado _, C.P. _
- Tipo de vivienda, Monto de renta si aplica

### Sección 4: Datos del Negocio

- Nombre del Negocio _, Giro _, Antigüedad \*
- Dirección del negocio, Tipo de local, Monto de renta, Horarios

### Sección 5: Referencias Personales (2 obligatorias)

- Nombre Ref. 1 _, Teléfono _, Parentesco \*
- Nombre Ref. 2 _, Teléfono _, Parentesco \*
- (Dirección de la referencia y años de conocerlo — del formulario físico, confirmar si va en el sistema)

### Sección adicional: Aval (opcional en arquitectura)

- Nombre, Teléfono, Dirección, No. de identificación

---

## 8. Solicitud de Crédito — Campos (módulo Créditos Nuevos)

- Cliente _, Lugar _, Fecha, Asesor \*
- Monto Solicitado _, Forma de Pago _ (Diario/Semanal)
- Plazo (autocalculado y deshabilitado)
- Garantía Material (texto opcional)
- **Evidencia del Negocio \*** → upload de fotos/videos (ver sección 4.2)
- Monto Aprobado \* (en pestaña Evaluación)
- Observaciones (en pestaña Evaluación)

---

## 9. Alta de Usuario — Campos Completos (según mock)

- Nombre Completo _, Correo Electrónico _, Contraseña _, Teléfono _
- Rol _, Sucursal _
- Calle _, No. Exterior _, Colonia _, Municipio _, Estado _, C.P. _
- No. de INE \*
- **Imagen INE \*** → upload de foto/escaneo (ver sección 4.2)
- Referencia 1: Nombre _, Teléfono _, Parentesco \*
- Referencia 2: Nombre _, Teléfono _, Parentesco \*

---

## 10. Módulo de Cobros — Comportamiento Detallado

### Pestaña "Ruta del Día"

**Métricas en encabezado:** Caja | Ruta | Desembolso | Multas | No Pagaron

**Tabla de control de pagos:**

- Columnas: Cliente | Pago | 1 | 2 | 3 | … | N | Venc. | Acción
- ✓ verde = pagó | ✗ rojo = no pagó (tooltip con razón) | número amarillo = monto de multa ese día
- Columna "Fin" = crédito completado

**Modal "Cobrar":**

- Monto Recibido \* (acepta abonos)
- ¿Pago completo? (toggle Sí/No)
- Razón de falta de pago \* (obligatorio si no pagó)
- Al marcar "No pagó" → multa aplicada automáticamente

**Modalidades:** CAJA (pago en sucursal) | RUTA (cobrador va al cliente)
**Días INHÁBIL:** celda bloqueada, sin multa.

**Sub-encabezado de cuadre:** DIARIO 1-14 | DIARIO 15-20 | SEMANAL | TOTAL | MULTAS | Firma Cajero

### Pestaña "Historial de Cobros"

Filtros: fecha (Hoy/Ayer), asesor, estado.
Columnas: Cliente | Asesor | Pago # | Monto | Estado | Fecha.

---

## 11. Modelo de Datos — Tablas Principales

Convenciones:

- Todas las tablas: `id BIGSERIAL PK`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`, `created_by FK usuarios`
- Tablas financieras: `deleted_at TIMESTAMPTZ` (soft delete — NUNCA borrar registros financieros)
- Todos los montos: `DECIMAL(12,2)` — NUNCA `FLOAT`
- Archivos: guardar solo URL en BD, nunca bytes

| Tabla              | Campos principales                                                                                                                                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sucursales`       | nombre, direccion, telefono, responsable_id, multa_base, activa                                                                                                                                                                                                                                                                   |
| `roles`            | nombre (`ADMINISTRADOR`\|`SUPERVISOR`\|`SUPERVISOR_CAMPO`\|`ASESOR_COBRADOR`)                                                                                                                                                                                                                                                     |
| `usuarios`         | nombre*completo, email, password_hash, telefono, rol_id, sucursal_id, domicilio*_, ine*numero, **ine_imagen_url** (S3), ref1*_, ref2\_\*, activo                                                                                                                                                                                  |
| `clientes`         | nombre*completo, apellido_paterno, apellido_materno, fecha_nacimiento, genero, estado_civil, nombre_conyuge, telefono_fijo, celular, ine_tipo, ine_numero, curp, rfc, domicilio*\_, negocio\__, ingresos*semanales, gastos*_, ref1\_\_, ref2*\*, aval*\*, asesor_id, sucursal_id, activo                                          |
| `creditos`         | cliente_id, asesor_id, sucursal_id, monto_capital, tasa_interes, cargo_financiero, total_a_pagar, pago_periodico, plazo_dias, tipo_pago (`DIARIO`\|`SEMANAL`), fecha_inicio, fecha_vencimiento, pago_adelantado, garantia_descripcion, **evidencia_urls TEXT[]** (S3 array), estado (`ACTIVO`\|`PAGADO`\|`RENOVADO`\|`CANCELADO`) |
| `calendario_pagos` | credito_id, numero_pago, fecha_programada, monto_esperado, estado (`PENDIENTE`\|`PAGADO`\|`NO_PAGADO`\|`PARCIAL`\|`ADELANTADO`)                                                                                                                                                                                                   |
| `pagos`            | credito_id, cliente_id, asesor_id, numero_pago, fecha_pago, monto_recibido, monto_esperado, es_completo, razon_no_pago, multa_aplicada, registrado_por                                                                                                                                                                            |
| `multas`           | pago_id, cliente_id, credito_id, tipo (`NO_PAGO`\|`INCOMPLETO`), monto, fecha, cobrada, cobrada_en_pago_id                                                                                                                                                                                                                        |
| `renovaciones`     | credito_anterior_id, credito_nuevo_id, cliente_id, asesor_id, fecha, pagos_restantes, monto_pagos_restantes, multas_pendientes, pago_adelantado, monto_desembolso, salida_de (`CAJA`\|`RUTA`), garantia_descripcion                                                                                                               |
| `colocaciones`     | semana_inicio, semana_fin, credito_id, tipo (`NUEVO`\|`RENOVACION`), monto, desembolso, asesor_id, sucursal_id, dia_semana, fecha                                                                                                                                                                                                 |
| `aperturas_caja`   | fecha, usuario_id, sucursal_id, monto_apertura, concepto_inversion, monto_inversion, observaciones, abierta, cerrada_at                                                                                                                                                                                                           |
| `cortes_caja`      | apertura_id, fecha, sucursal_id, inversion, ingreso_carteras, desembolsos, subtotal, apartado_24pct, total_libres, gastos_total, creditos_nuevos, ahorro, total_real_libres, cerrado_por, pdf_url                                                                                                                                 |
| `gastos`           | fecha, categoria (`GASOLINA`\|`MOTOS`\|`RECARGAS`\|`SOLICITUD_DUENO`\|`VARIOS`), descripcion, monto, responsable_id, sucursal_id, **comprobante_referencia VARCHAR** (texto, NO archivo), corte_id                                                                                                                                |
| `config_multas`    | sucursal_id, rango_min, rango_max, multa_no_pago, multa_incompletos                                                                                                                                                                                                                                                               |
| `dias_festivos`    | fecha, descripcion, aplica_sucursal_id (NULL = todas)                                                                                                                                                                                                                                                                             |
| `bitacora`         | usuario_id, accion (`LOGIN`\|`CREAR`\|`MODIFICAR`\|`ELIMINAR`\|`APROBAR`\|`CERRAR`), modulo, detalle, ip_address                                                                                                                                                                                                                  |

---

## 12. Seguridad

- JWT con expiración configurable.
- Contraseñas con hash **BCrypt** — nunca en texto plano ni en logs.
- Autorización RBAC con Spring Security.
- Todas las rutas de API protegidas excepto `/api/auth/login`.
- HTTPS obligatorio en producción (SSL vía Nginx).
- Redis para invalidación rápida de tokens (logout).
- Bitácora automática de todas las operaciones sensibles.

---

## 13. Ítems Pendientes de Confirmar con Cliente

> ⚠️ NO asumir — preguntar antes de implementar.

1. **Colocaciones**: ¿tabla almacenada en BD o reporte calculado?
2. **Calendario de pagos**: lógica exacta de salto de festivos/fines de semana.
3. **Base del 24%**: ¿sobre Ingreso Carteras solamente o sobre Subtotal Caja?
4. **Pagos semanales**: tasa y forma de cálculo exacta.
5. **Mora Activa vs Mora Parada**: criterio exacto de clasificación.
6. **Aval**: ¿obligatorio para todos los créditos o solo ciertos montos?
7. **Límite de créditos activos**: ¿puede un cliente tener más de uno simultáneo?
8. **Zona $15k–$20k**: si alguien pide $17,000 ó $18,000 ¿qué producto aplica?
9. **Tamaño máximo de archivos**: ¿límite de MB para videos de evidencia y fotos de INE?
10. **INE del cliente**: ¿se agregará upload de imagen de INE del cliente en el alta, o solo se captura el número?

---

## 14. Plan de Desarrollo (24 semanas)

| Fase              | Módulos                                                                    | Semanas |
| ----------------- | -------------------------------------------------------------------------- | ------- |
| 1 — Fundamentos   | Usuarios + Roles + Auth JWT + S3 config                                    | 1–3     |
| 2 — Clientes      | Alta, edición, ficha de cliente                                            | 4–6     |
| 3 — Créditos      | Créditos Nuevos (solicitud + upload evidencia, evaluación, tabla de pagos) | 7–10    |
| 4 — Cobros        | Cobros diarios, registro de pagos, no pagos, multas                        | 11–14   |
| 5 — Renovaciones  | Renovaciones + Colocaciones semanales                                      | 15–17   |
| 6 — Caja y Gastos | Apertura/cierre de caja, gastos, corte diario                              | 18–20   |
| 7 — Reportes      | PDF, envío por correo, historial de pago                                   | 21–22   |
| 8 — Admin y QA    | Administración del sistema, bitácora, pruebas, capacitación                | 23–24   |

---

## 15. Convenciones de Código

### Backend (Java)

- Paquete base: `com.magno`
- Estructura: `controller / service / repository / model / dto / security / config`
- DTOs para todas las respuestas — nunca exponer entidades directamente
- Endpoints: `/api/auth`, `/api/clientes`, `/api/creditos`, `/api/cobros`, `/api/renovaciones`, `/api/caja`, `/api/gastos`, `/api/reportes`, `/api/usuarios`, `/api/sucursales`, `/api/bitacora`, `/api/admin`, `/api/files`

### Base de Datos

- Nombres en español, snake_case
- Montos: `DECIMAL(12,2)` siempre
- Archivos: solo URLs (`VARCHAR`), nunca bytes en BD
- Soft delete con `deleted_at`

### Frontend

- Estructura: `pages / components / hooks / services / types / utils`
- Montos de multa, ahorro, configs: siempre desde API, nunca hardcodeados
- Subida de archivos: multipart/form-data al endpoint `/api/files/upload`

---

## 16. Paleta de Colores (mockups aprobados)

| Color              | Hex       | Uso                                     |
| ------------------ | --------- | --------------------------------------- |
| Verde oscuro Magno | `#3d6b35` | Cabeceras, botones primarios, nav       |
| Verde medio        | `#5a8f50` | Hover, secundario                       |
| Blanco             | `#ffffff` | Fondos de contenido                     |
| Gris claro         | `#f5f5f5` | Fondos secundarios                      |
| Rojo               | `#dc2626` | ✗ no pagó, mora, alertas críticas       |
| Amarillo/ámbar     | `#f59e0b` | Multas, advertencias, pagos incompletos |
| Verde pago         | `#16a34a` | ✓ pagó, estados positivos               |

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
- Es una PWA opcional en el futuro (no en el alcance actual), pero el diseño responsive ya la prepara para eso.

---

## 18. Notas Técnicas

- HTML standalone: NO usar Cloudflare email-decode.min.js — rompe scripts inline.
- El sistema debe funcionar en red local (intranet) sin internet constante — los archivos S3 deben ser accesibles desde la intranet si se usa MinIO.
- **4 roles exactos**, no 5 — no crear lógica ni permisos para un rol "Cajero" que no existe.
- Multas, ahorro diario, días festivos: siempre desde configuración de la API, nunca hardcodeados.
- Nómina: NO es módulo del sistema.
- Comprobante de gastos: campo de texto VARCHAR, no upload.
- `evidencia_urls` en créditos: array de URLs S3 (`TEXT[]` en PostgreSQL).
- `ine_imagen_url` en usuarios: string único URL S3 (`VARCHAR`).
- **Diseño mobile first obligatorio** — los asesores usan la app desde el celular en campo. La grilla de cobros se convierte en cards en móvil. Ver sección 17 completa.
- Área de toque mínima en botones: 44×44px para uso táctil en campo.
