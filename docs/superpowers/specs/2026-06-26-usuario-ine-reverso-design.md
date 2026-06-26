# Spec: INE Frente y Reverso para Usuarios
**Fecha:** 2026-06-26
**Estado:** Aprobado

---

## Contexto

Al dar de alta o editar un usuario del sistema (no cliente), hoy solo se pide **una** imagen de INE (`ine_imagen_url`). Para clientes ya existe el patrón de subir frente y reverso (tabla `cliente_documentos` con tipos `INE_FRENTE`/`INE_REVERSO`). Se requiere que el alta de **usuarios** también pida ambos lados de la INE, y que el detalle del usuario permita visualizar las dos imágenes.

`Usuario` no usa una tabla de documentos genérica como `Cliente`: guarda la INE como un campo plano en la propia entidad. Para mantener consistencia con el diseño actual (y evitar la complejidad de migrar a una tabla de documentos que nadie pidió), se replica el mismo patrón: un segundo campo plano `ine_imagen_reverso_url`, espejo de `ine_imagen_url`.

---

## Decisiones confirmadas

- **Enfoque:** campo simple espejo (`ine_imagen_reverso_url`), no tabla de documentos genérica. `ine_imagen_url` se conserva como está (representa el frente) — no se renombra, para no afectar datos existentes ni referencias en el código.
- **Validación:** tanto `ine_imagen_url` (frente) como `ine_imagen_reverso_url` (reverso) pasan a ser **obligatorios estrictos** — bloquean el guardado si falta cualquiera de los dos. Esto es un cambio de comportamiento respecto a hoy, donde el frente se marca con `*` visualmente pero no se valida de forma estricta.
- **Usuarios existentes sin reverso:** no se hace backfill. La columna es nullable a nivel de BD. La próxima vez que alguien edite a un usuario que no tiene reverso (o frente) cargado, el formulario lo pedirá y no dejará guardar hasta completarlo — incluso si la edición es por otro motivo (ej. cambiar el teléfono).
- **Almacenamiento S3:** el reverso se sube a la carpeta `usuarios-ine-reverso`, paralela a la carpeta existente `usuarios-ine` del frente.
- Al editar un usuario y reemplazar el reverso, se borra el archivo viejo de S3 (mismo patrón que ya existe para el frente en `UsuarioService.actualizar()`).

---

## Modelo de datos

### Tabla `usuarios` — nueva columna

| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `ine_imagen_reverso_url` | VARCHAR(500) | nullable | URL S3, espejo de `ine_imagen_url`. Nullable a nivel BD porque usuarios existentes no la tienen; la obligatoriedad se aplica en la capa de API (DTOs), no en BD. |

Migración: `V26__usuarios_ine_reverso.sql`
```sql
ALTER TABLE usuarios ADD COLUMN ine_imagen_reverso_url VARCHAR(500);
```

---

## Backend

### `Usuario.java`
Nuevo campo `ineImagenReversoUrl` (mapea a `ine_imagen_reverso_url`), junto a `ineImagenUrl`.

### `UsuarioCreateRequest` / `UsuarioUpdateRequest`
- Se agrega `String ineImagenReversoUrl` con `@NotBlank`.
- `ineImagenUrl` pasa de sin anotación a `@NotBlank` (antes no se validaba en backend, solo el frontend lo marcaba como requerido visualmente).

### `UsuarioDTO`
Se agrega `ineImagenReversoUrl` al record y a `UsuarioDTO.from()`.

### `UsuarioService`
- `crear()`: incluye `.ineImagenReversoUrl(req.ineImagenReversoUrl())` en el builder.
- `actualizar()`: misma lógica de borrado de S3 que ya existe para `ineImagenUrl`, duplicada para `ineImagenReversoUrl`:
  ```java
  String oldIneReversoUrl = u.getIneImagenReversoUrl();
  String newIneReversoUrl = req.ineImagenReversoUrl();
  if (newIneReversoUrl != null && !newIneReversoUrl.isBlank()
          && !newIneReversoUrl.equals(oldIneReversoUrl)) {
      fileService.deleteFile(oldIneReversoUrl);
  }
  ...
  u.setIneImagenReversoUrl(req.ineImagenReversoUrl());
  ```

No cambia el controller (`@Valid` ya está presente en ambos endpoints).

---

## Frontend

### `types/index.ts`
Se agrega `ine_imagen_reverso_url?: string` a `Usuario`, y `ine_imagen_reverso_url?: string` (luego requerido a nivel de validación, opcional a nivel de tipo TS por simplicidad con el patrón existente) a `UsuarioCreateRequest` y `UsuarioUpdateRequest`.

### `UsuariosPage.tsx`
- Zod: `ine_imagen_url` y `ine_imagen_reverso_url` cambian de `.optional()` a `.min(1, 'Requerido')` en `baseSchema` (afecta create y edit).
- Estado nuevo en `UsuarioModal`, paralelo al existente del frente:
  - `ineReversoFile`, `ineReversoPreview`, `ineReversoImgSrc`, `ineReversoFullPreview`, `fileInputRefReverso`.
- La sección "Identificación" pasa de un input de imagen a dos, en grid (frente y reverso), cada uno con su propio file input oculto, preview, botón "Cambiar", y su propio `ImagePreviewModal`.
- `handleFileChange` se generaliza o se duplica como `handleReversoFileChange` (mismo patrón, otro estado).
- `onSubmit`: sube el reverso a S3 igual que el frente (carpeta `usuarios-ine-reverso`) si hay archivo nuevo, antes de armar el payload.

### `UsuarioDetallePage.tsx`
- La columna derecha (hoy una sola card "Imagen INE") pasa a mostrar dos cards: "INE — Frente" e "INE — Reverso", cada una con su propio `IneViewer` (componente ya existente, reutilizado sin cambios) y su botón de descarga independiente.
- Si falta una de las dos (usuario viejo sin reverso), esa card muestra el mismo estado vacío que ya existe ("Sin imagen INE").

---

## Errores y casos límite

- Falta subir frente o reverso al crear/editar → error de validación en el formulario (zod), no llega a pegarle al backend. Si de alguna forma llega (ej. llamada directa a la API), el backend rechaza con 400 por `@NotBlank`.
- Falla la subida a S3 de cualquiera de los dos lados → mismo manejo de error que ya existe hoy para el frente (`toast.error('Error al subir imagen INE')`), aplicado también al reverso.
- Usuario viejo sin reverso, visto en detalle → card de reverso muestra estado vacío, no rompe la página.

---

## Fuera de alcance

- No se migra el modelo de `Usuario` a una tabla de documentos genérica tipo `cliente_documentos`.
- No se hace backfill de reverso para usuarios existentes.
- No se renombra `ine_imagen_url` ni se cambia su significado (sigue siendo "frente").
