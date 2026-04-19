# Archivos y Almacenamiento S3 — MAGNO v3.5

## 4. Almacenamiento de Archivos — Mapa Completo

> ⚠️ NUNCA almacenar archivos binarios en PostgreSQL.
> SIEMPRE usar almacenamiento externo S3-compatible. La BD guarda únicamente la URL/ruta del archivo.

### 4.1 Todos los puntos de upload en el sistema

| Módulo              | Sección               | Campo                      | Tipo de archivo                                        | Obligatorio | Columna en BD                            |
| ------------------- | --------------------- | -------------------------- | ------------------------------------------------------ | ----------- | ---------------------------------------- |
| **Créditos Nuevos** | Nueva Solicitud       | Evidencia del Negocio      | Fotos y/o videos del negocio                           | ✅ Sí       | `creditos.evidencia_urls TEXT[]`         |
| **Créditos Nuevos** | Aprobación/Desembolso | Video de entrega de dinero | Video grabado al entregar el efectivo al cliente       | ✅ Sí       | `creditos.video_entrega_url VARCHAR`     |
| **Renovaciones**    | Nueva Renovación      | Video de entrega de dinero | Video grabado al entregar el efectivo en la renovación | ✅ Sí       | `renovaciones.video_entrega_url VARCHAR` |
| **Usuarios**        | Alta de Usuario       | Imagen INE                 | Foto o escaneo de INE (imagen)                         | ✅ Sí       | `usuarios.ine_imagen_url VARCHAR`        |
| **Gastos**          | Registrar Gasto       | Comprobante / Referencia   | ⚠️ Campo de TEXTO libre — folio, número de ticket      | ❌ No       | `gastos.comprobante_referencia VARCHAR`  |
| **Clientes** | Alta/Edición de Cliente | Documentos del cliente | Imágenes (jpg, png) y PDF | ❌ No | `cliente_documentos.url VARCHAR` |

> **Nota importante sobre Gastos:** El mock implementa el comprobante como `<input type="text" placeholder="Folio, foto, o referencia del comprobante">`. Es un campo de texto, NO una zona de upload. Captura el folio o descripción del comprobante físico, no el archivo en sí.

> **Nota importante sobre Alta de Cliente:** El modal de Alta de Cliente no incluye upload de documentos directamente durante el registro inicial. Los documentos del cliente (INE, comprobante de domicilio, etc.) se gestionan desde el tab "Documentos" en la ficha de detalle del cliente. El upload de evidencia del negocio y el INE-imagen de empleados se capturan en el flujo de **Créditos Nuevos** (solicitud) y **Usuarios** respectivamente.

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

#### Documentos del Cliente (Clientes → Tab Documentos)

- **Qué sube:** INE del cliente (frente y reverso), comprobante de domicilio, otros documentos requeridos para la solicitud de crédito
- **Propósito:** acervo documental del cliente para solicitudes de crédito
- **UI:** tab "Documentos" en la ficha del cliente; zona de upload con selector de tipo y descripción opcional
- **Tipos aceptados:** imágenes (jpg, png, webp) y PDF
- **Cardinalidad:** múltiples documentos por cliente (tabla `cliente_documentos`)
- **Almacenamiento:** S3 → `magno/clientes-documentos/{cliente_id}/{tipo}/`
- **BD:** `cliente_documentos.url VARCHAR` — URL S3 por documento
- **Tipos de documento:** `INE_FRENTE`, `INE_REVERSO`, `COMPROBANTE_DOMICILIO`, `OTRO`
- **Ciclo de vida:** soft delete con `deleted_at`

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
├── usuarios-ine/
│   └── {usuario_id}/
│       └── ine.jpg
└── clientes-documentos/
    └── {cliente_id}/
        └── {tipo}/
            └── documento.jpg
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
