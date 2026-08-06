# Diseño: Acceso multi-sucursal para el rol Supervisor (SUPERVISOR_CAMPO)

**Fecha:** 2026-08-06
**Estado:** Aprobado, pendiente de implementación

## 1. Contexto y objetivo

Algunos usuarios con rol **Supervisor** (`SUPERVISOR_CAMPO`) supervisan asesores en más de una sucursal (típicamente 2). Hoy el sistema ata a cada usuario a exactamente una sucursal (`usuarios.sucursal_id`, `@ManyToOne` obligatorio) y esa sucursal se usa para filtrar y forzar todas sus operaciones.

**Objetivo:** permitir que el Gerente General (`ADMINISTRADOR`) asigne sucursales adicionales a un Supervisor, y que ese Supervisor pueda elegir — con un dropdown, igual que ya existe para el Gerente General en algunas pantallas — en cuál de sus sucursales asignadas quiere ver y operar, dentro de los módulos a los que ya tiene acceso hoy. No se otorgan permisos nuevos, solo se amplía el alcance de sucursal de los permisos existentes.

**Hallazgo colateral, fuera de alcance:** `CobrosService.getHistorial` (L500-508) recibe `sucursalIdSolicitante` pero nunca lo usa — para `SUPERVISOR_CAMPO` fuerza `asesorId = usuarioIdSolicitante` (el id del propio Supervisor), lo que en la práctica filtra por "pagos donde el asesor soy yo", no por su sucursal/equipo. Esto no coincide con docs/02-roles-y-permisos.md ("solo los de sus agentes"). Parece un bug preexistente, no relacionado con sucursales múltiples — no se corrige en este diseño, pero se deja anotado porque Historial es uno de los módulos de la Fase 3.

**Fuera de alcance (YAGNI):**
- No se cambia el comportamiento de ADMINISTRADOR, SUPERVISOR (Gerente de Sucursal) ni ASESOR_COBRADOR.
- No se construye UI de asignación para otros roles — el esquema es genérico pero solo se expone en el admin para `SUPERVISOR_CAMPO`.
- No se toca Caja, Gastos, Reportes, Sucursales, Usuarios, Bitácora ni Administración — Supervisor no tiene acceso a esos módulos hoy y eso no cambia.

## 2. Arquitectura

**Decisión central:** el JWT sigue llevando un único `sucursalId` (la sucursal "home"/base del usuario, sin cambios en `JwtService`/`JwtPrincipal`/login). Las sucursales adicionales se resuelven en cada request contra la base de datos, no contra el token — así una reasignación del Gerente General aplica de inmediato, sin esperar a que el usuario vuelva a iniciar sesión ni invalidar tokens.

Cada endpoint que hoy fuerza `principal.sucursalId()` pasa a aceptar un `sucursalId` explícito (igual que ya hace ADMINISTRADOR en varias pantallas), validado contra el conjunto de sucursales permitidas del usuario:

```
efectivo = sucursalId (si viene en el request Y está permitido) : sucursalId home (default)
permitido(sucursalId) = sucursalId == home OR sucursalId ∈ sucursales_adicionales(usuario)
```

23 usuarios en total en el sistema — una consulta a BD por request para resolver el conjunto permitido no representa un problema de rendimiento; no se requiere caché.

## 3. Modelo de datos

Nueva tabla, sin tocar `usuarios.sucursal_id` (se mantiene como sucursal home/default):

```sql
-- V37__usuario_sucursal_adicional.sql
CREATE TABLE usuario_sucursal_adicional (
    usuario_id   BIGINT NOT NULL REFERENCES usuarios(id),
    sucursal_id  BIGINT NOT NULL REFERENCES sucursales(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, sucursal_id)
);

CREATE INDEX idx_usuario_sucursal_adicional_usuario ON usuario_sucursal_adicional(usuario_id);
```

Sin soft delete: es una tabla de asignación pura (no financiera), se reemplaza el conjunto completo en cada `PUT`.

`CategoriaGasto`/`Gasto` no se tocan — la tabla es agnóstica de rol, cualquier usuario podría en teoría tener sucursales adicionales, aunque por ahora solo se expone en el admin para `SUPERVISOR_CAMPO`.

## 4. Backend

### 4.1 Entidad y repositorio

- `UsuarioSucursalAdicional` — entidad simple con `@EmbeddedId` (usuarioId, sucursalId) o `@IdClass`, siguiendo el patrón de otras entidades de asociación del proyecto.
- `UsuarioSucursalAdicionalRepository` — `findByUsuarioId(Long usuarioId)`, `deleteByUsuarioId(Long usuarioId)`.

### 4.2 `SecurityHelper` — nuevo método central

```java
public boolean tieneAccesoSucursal(JwtPrincipal principal, Long sucursalId) {
    if (sucursalId == null) return false;
    if ("ADMINISTRADOR".equals(principal.rol())) return true; // el único rol sin restricción de sucursal
    if (sucursalId.equals(principal.sucursalId())) return true; // su home (incluye a SUPERVISOR, sin cambio de comportamiento)
    return usuarioSucursalAdicionalRepo.findByUsuarioId(principal.userId())
            .stream().anyMatch(a -> a.getSucursalId().equals(sucursalId));
}
```

> ⚠️ Ojo: `SUPERVISOR` (Gerente de Sucursal) **no** debe tratarse como "ve todo" — hoy está restringido a su propia sucursal igual que `SUPERVISOR_CAMPO` (ver `ClienteController.obtener` L94-98). Solo `ADMINISTRADOR` tiene bypass total. Como `SUPERVISOR` nunca tendrá filas en `usuario_sucursal_adicional` (fuera de alcance), el método se comporta igual que hoy para ese rol: solo pasa su propio home.

Reemplaza las comparaciones repetidas `dto.sucursal().id().equals(principal.sucursalId())` en:
- `ClienteController`: `obtener` (L94-98), `listarDocumentos`/`agregarDocumento` (L315-319, L336-340), `obtenerConAcceso` (L287-288).
- `CreditoController`: chequeo de acceso a detalle (L346-347).

### 4.3 Resolución de sucursal efectiva por endpoint

Mismo cambio puntual en cada uno de estos sitios — donde hoy se fuerza `p.sucursalId()` sin mirar el request, pasa a respetar un `sucursalId` explícito si está permitido:

| Archivo | Ubicación actual | Cambio |
|---|---|---|
| `ClienteController.listar` | L69-73 `case "SUPERVISOR","SUPERVISOR_CAMPO" -> if (sucursalId==null) sucursalId = principal.sucursalId()` | Si `sucursalId != null`, validar con `tieneAccesoSucursal` (403 si no es válido); si no viene, default al home. Nota: hoy este endpoint no valida el `sucursalId` explícito ni para `SUPERVISOR` — al introducir `tieneAccesoSucursal` aquí se cierra ese hueco preexistente como efecto colateral natural del cambio, sin tocar nada fuera de esta línea |
| `ClienteController.normalizarCreate`/`normalizarUpdate` | L225-245, L384-404 forzando `p.sucursalId()` | Aceptar `sucursalId` del propio `req` para `SUPERVISOR_CAMPO` si está permitido; default al home si no viene |
| `CreditoController` | L74-77, L320-323 | Mismo patrón |
| `CreditoController.calcular` (preview de producto de crédito, L267-284) | L277 `Long sucursalId = principal(auth).sucursalId()` | Aceptar `sucursalId` como `@RequestParam` opcional; para `SUPERVISOR_CAMPO` validar con `tieneAccesoSucursal` (las reglas de producto — plazo/tasa — varían por sucursal, así que el preview debe reflejar la sucursal que el Supervisor tiene seleccionada) |
| `CobrosController.getRutaDia` → `CobrosService.resolverSucursalIdEfectiva` (`CobrosService.java` L883-892) | `boolean puedeElegirSucursal = "ADMINISTRADOR".equals(rol) \|\| "SUPERVISOR".equals(rol)` | Añadir `SUPERVISOR_CAMPO` a `puedeElegirSucursal`, con el `sucursalId` ya validado por `tieneAccesoSucursal` en el controller antes de llamar al service (el service no tiene acceso a `SecurityHelper` hoy) |
| `RenovacionController.colocaciones` / `.colocacionesPdf` / `.getListos` (L205-208, L231-234, L260-263 — únicos endpoints de este controller donde `SUPERVISOR_CAMPO` llega al `switch`; `pendientes` y `pendientes-desembolso` son solo `ADMINISTRADOR`/`SUPERVISOR` vía `@PreAuthorize`, no aplica) | `case "SUPERVISOR","SUPERVISOR_CAMPO" -> effectiveSucursalId = p.sucursalId()` | Extender a validar `sucursalId` explícito para `SUPERVISOR_CAMPO` |
| `RenovacionController.crear` (L59-69) | `cajaGuard.validarCajaAbierta(p)` usa siempre el home | La sucursal efectiva aquí depende del cliente/crédito que se renueva, no de un `sucursalId` explícito en el request — al implementar esta fase, resolver la sucursal desde el crédito antes de validar la caja (mismo cuidado aplica a cualquier flujo de Créditos/Cobros donde la sucursal se derive de un recurso, no de un parámetro) |
| `DashboardController.resolveSucursalId` | L54-65 | Extender el `if` de ADMINISTRADOR para incluir `SUPERVISOR_CAMPO` con `sucursalId` permitido; el resto de roles cae al home igual que hoy |

### 4.4 `CajaGuard`

`validarCajaAbierta` (usado desde `ClienteController.crear`/`actualizar`, y desde Créditos/Cobros donde aplique) pasa a recibir el `sucursalId` efectivo de la operación como segundo parámetro, en vez de leer siempre `principal.sucursalId()` internamente. Así valida la caja de la sucursal donde el Supervisor realmente está operando en ese momento.

### 4.5 Endpoints de asignación (nuevo, en `UsuarioController`)

```
GET  /api/usuarios/{id}/sucursales-adicionales   → List<SucursalDTO>   (ADMINISTRADOR)
PUT  /api/usuarios/{id}/sucursales-adicionales   → reemplaza el conjunto completo (ADMINISTRADOR)
     body: { sucursalIds: number[] }
```

Validación: rechazar (400) si `sucursalIds` contiene el propio `sucursal_id` home del usuario (redundante) o si el usuario destino no es `SUPERVISOR_CAMPO` — evita asignaciones inconsistentes desde el API aunque el frontend ya lo restrinja.

### 4.6 `UsuarioDTO` / `/api/auth/me` / login

`UsuarioDTO` se extiende con `sucursalesAdicionales: List<SucursalResumen>` (id + nombre), poblado en `UsuarioDTO.from(u)` vía el nuevo repositorio. Así el frontend recibe de entrada, en login y en `/auth/me`, todo lo que necesita para armar el dropdown sin una llamada extra.

## 5. Frontend

### 5.1 Hook `useSucursalScope()` (nuevo, `frontend/src/hooks/`)

Centraliza el patrón que hoy está duplicado inline (visto en `GastosPage.tsx` para ADMINISTRADOR):

```ts
function useSucursalScope() {
  const { usuario } = useAuthStore()
  const opciones = useMemo(() => {
    if (usuario?.rol === 'ADMINISTRADOR') return todasLasSucursales // ya se piden hoy donde aplica
    if (usuario?.rol === 'SUPERVISOR_CAMPO' && usuario.sucursalesAdicionales?.length) {
      return [usuario.sucursal, ...usuario.sucursalesAdicionales]
    }
    return [] // sin dropdown — comportamiento actual sin cambios
  }, [usuario])

  const [sucursalId, setSucursalId] = useState(usuario?.sucursal?.id)
  return { opciones, sucursalId, setSucursalId }
}
```

Para un Supervisor sin sucursales adicionales asignadas, `opciones` queda vacío y no aparece ningún dropdown — cero cambio visible, tal como hoy.

### 5.2 Componente `<SucursalSelector />` (nuevo, `frontend/src/components/`)

`<select>` que solo se renderiza si `opciones.length > 1`, mismo estilo visual que el selector ya usado en `GastosPage.tsx` (L278-288).

### 5.3 Módulos a actualizar (reemplazar uso implícito de `usuario.sucursal.id` por el `sucursalId` del hook, mandado explícito en cada query/mutation)

Dashboard, Cobros, Créditos Nuevos, Renovaciones, Colocaciones, Clientes, Historial — los mismos 7 módulos a los que Supervisor ya tiene acceso hoy (tabla de docs/02-roles-y-permisos.md).

### 5.4 UI de asignación (`UsuariosPage.tsx`)

Junto al campo "Sucursal \*" (L589-590), nuevo multi-select "Sucursales adicionales" visible solo cuando `rol === 'SUPERVISOR_CAMPO'` en el formulario. Al guardar el usuario, llamada aparte a `PUT /api/usuarios/{id}/sucursales-adicionales`; si falla, toast de error pero no revierte el guardado del usuario (son operaciones independientes).

## 6. Plan de implementación por fases

Cada fase es verificable de forma independiente antes de seguir a la siguiente:

1. **Fundación** — migración V37, entidad/repo, `SecurityHelper.tieneAccesoSucursal`, endpoints de asignación, `UsuarioDTO` extendido, UI de asignación en `UsuariosPage.tsx`. Resultado verificable: el Gerente General asigna sucursales adicionales a un Supervisor y las ve reflejadas en el detalle del usuario.
2. **Clientes como módulo de referencia** — `useSucursalScope`, `<SucursalSelector />`, cambios en `ClienteController`/`ClientesPage.tsx`/`ClienteDetallePage.tsx`. Resultado verificable: un Supervisor con 2 sucursales asignadas ve el dropdown en Clientes, cambia de sucursal, ve/da de alta clientes de la otra sucursal, y `CajaGuard` valida la caja correcta.
3. **Rollout al resto de módulos** — mismo patrón ya probado en Cobros, Créditos Nuevos, Renovaciones, Colocaciones, Historial y Dashboard.

## 7. Casos borde y validaciones

- **Sucursal desasignada mientras el usuario tiene sesión activa con esa sucursal seleccionada:** la siguiente request con ese `sucursalId` falla la validación de `tieneAccesoSucursal` → 403. El frontend debe manejar ese 403 recargando el hook (vuelve a home) y mostrando un toast.
- **Sucursal inactiva (`activa = false`)** entre las adicionales: se excluye de las `opciones` del dropdown igual que ya se filtra `sucursales` para ADMINISTRADOR en otros lados (verificar patrón existente, ej. `SucursalService.listarActivas()`).
- **Un Supervisor sin sucursales adicionales** no ve ningún dropdown nuevo — comportamiento actual intacto.
- **Desactivar un usuario Supervisor:** `usuarios` usa soft delete vía el flag `activo` (no hay borrado físico ni `deleted_at`), así que la fila nunca se elimina y no hace falta limpiar `usuario_sucursal_adicional` — las asignaciones simplemente quedan sin efecto porque el usuario inactivo no puede iniciar sesión.

## 8. Testing

- Backend: pruebas de `SecurityHelper.tieneAccesoSucursal` (home permitido, adicional permitido, sucursal ajena rechazada, ADMINISTRADOR/SUPERVISOR siempre permitido).
- Backend: prueba de integración en `ClienteController` — Supervisor con sucursal adicional puede listar/crear clientes en ella; sin la asignación, 403.
- Frontend: `useSucursalScope` — sin adicionales no expone opciones; con adicionales expone home + adicionales.
