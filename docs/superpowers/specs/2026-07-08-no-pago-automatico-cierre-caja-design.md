# Diseño — No pago automático al cerrar caja

**Fecha:** 2026-07-08
**Estado:** Aprobado — listo para implementación

---

## Contexto

Hoy, si un asesor no registra el cobro de un cliente en un día dado, el pago del calendario se queda indefinidamente en `PENDIENTE` — nadie marca "no pagó" a menos que alguien lo haga manualmente desde Ruta del día. Esto significa que no se genera la multa correspondiente (tipo `NO_PAGO`) hasta que alguien lo registre a mano, lo cual en la práctica casi nunca ocurre retroactivamente.

El Módulo 6 (Corte de Caja) **ya está implementado** (`CajaService`, `CajaController`, `CajaCierrePage.tsx`) — el checklist de `CLAUDE.md` está desactualizado en ese punto. Solo Administrador y Supervisor pueden abrir/cerrar caja, una por sucursal por día. El cierre (`CajaService.cerrar()`) ya calcula multas por asesor, ingresos, desembolsos, etc. leyendo el estado real de la BD en el momento del cierre — es el punto natural para resolver los pagos sin registrar del día.

---

## Decisiones de diseño confirmadas

| # | Pregunta | Decisión |
|---|----------|----------|
| 1 | ¿Disparador? | Al confirmar el cierre de caja (`CajaService.cerrar()`), no un cron job independiente. Se procesa la fecha propia de esa caja (`caja.getFecha()`), no necesariamente "hoy" (una caja abierta de un día anterior también dispara el marcado para su propia fecha). |
| 2 | ¿Alcance? | Todos los créditos `ACTIVO` de la sucursal de esa caja (cualquier asesor) cuyo slot de `calendario_pagos` para esa fecha siga `PENDIENTE`. Días inhábiles no requieren manejo especial — nunca tienen slot programado. |
| 3 | ¿Aviso previo? | Sí. El preview de cierre (`GET` que alimenta `CajaCierrePage.tsx`, servido por `CajaService.getPreviewCierre`) se extiende con la lista de clientes que se marcarán como no pago + la multa que se les generará. Cálculo de solo lectura, sin persistir nada. |
| 4 | ¿Quién queda como `registradoPor`? | El Administrador/Supervisor que cierra la caja. El campo `asesor` del `Pago` (usado para reportes "multas por asesor") sigue siendo el asesor dueño del crédito — igual que en el flujo manual de "no pagó". |
| 5 | ¿Texto de la razón? | Fijo: `"Cierre de caja — sin registro de pago"`, para distinguirlo en el tooltip de historial de un no-pago capturado a mano por el asesor. |
| 6 | ¿Cómo se corrige un error (el asesor sí cobró pero no le dio tiempo de registrar)? | Con "Modificar pago" (ya existe, restringido a Admin/Supervisor) — ya soporta convertir un registro `NO_PAGADO` en un pago real. No se construye un mecanismo de deshacer nuevo. Si además se canceló el cierre el mismo día (`cancelarCierre`, ya existe), la corrección se hace de la misma forma. |
| 7 | ¿Multa duplicada o doble conteo? | No. La multa Tipo 2 (2 pagos incompletos acumulados) se calcula sobre pagos con `razonNoPago` vacío (`countPagosIncompletosByCreditoId` los excluye explícitamente) — un no-pago automático nunca cuenta para ese contador, igual que uno manual. |

---

## Cambios — Backend

### Nuevo DTO: `dto/cobros/ClienteNoPagoAutomaticoDTO.java`

```java
public record ClienteNoPagoAutomaticoDTO(
        Long clienteId,
        String nombreCompleto,
        Long creditoId,
        Integer numeroPago,
        BigDecimal montoMulta
) {}
```

### `CobrosService` — dos métodos nuevos + helper compartido

Constante: `RAZON_NO_PAGO_AUTOMATICO = "Cierre de caja — sin registro de pago"`.

Helper privado `buscarCandidatosNoPagoAutomatico(Long sucursalId, LocalDate fecha)`: reutiliza `creditoRepo.findRutaDiaCreditosActivos(sucursalId, null, EstadoCredito.ACTIVO)` y, por cada crédito, busca en su calendario (`calendarioPagoRepo.findByCreditoIdOrderByNumeroPago`) el slot con `fechaProgramada == fecha && estado == PENDIENTE`. Calcula la multa con el `obtenerMontoMultaNoPago` ya existente (mismo helper que usa el flujo manual). Devuelve una lista de candidatos (crédito, cliente, calendarioPago, montoMulta) — sin persistir nada.

- `previsualizarNoPagoAutomatico(Long sucursalId, LocalDate fecha)` — de solo lectura, mapea los candidatos a `ClienteNoPagoAutomaticoDTO`. Usado por el preview.
- `@Transactional marcarNoPagoAutomatico(Long sucursalId, LocalDate fecha, Long registradorId)` — por cada candidato: crea `Pago` (`montoRecibido=0`, `esCompleto=false`, `razonNoPago=RAZON_NO_PAGO_AUTOMATICO`, `multaAplicada=montoMulta`, `asesor=credito.getAsesor()`, `registradoPor=registrador`), actualiza el `CalendarioPago` a `NO_PAGADO`, crea el `Multa` (`tipo="NO_PAGO"`, `cobrada=false`) — exactamente el mismo patrón que el método privado `registrarNoPago` ya usa para el flujo manual. Devuelve la misma lista de DTOs ya persistida.

### `CajaCierrePreviewDTO`

Nuevo campo al final: `List<ClienteNoPagoAutomaticoDTO> clientesSinRegistro`.

### `CajaService`

- Nueva dependencia inyectada: `CobrosService cobrosService`.
- `getPreviewCierre`: después de calcular `multasPorAsesor`, llama `cobrosService.previsualizarNoPagoAutomatico(effectiveId, hoy)` y lo agrega al DTO devuelto.
- `cerrar`: justo después de resolver `caja`/`fechaCaja` (antes de calcular `ingresoCarteras`), llama `cobrosService.marcarNoPagoAutomatico(sucursalId, fechaCaja, principal.userId())`. Como `montoRecibido=0` en los pagos creados, no altera `ingresoCarteras` ni `desembolsos`; el resto de la fórmula de cierre no cambia. Los nuevos registros quedan dentro de la misma transacción que el cierre.

**Sin cambios en:** modelo de datos/migraciones (reutiliza tablas `pagos`, `multas`, `calendario_pagos` existentes), endpoints (mismos `GET /preview` y `POST /cerrar` ya existentes, solo cambia el payload de respuesta), `registrarNoPago` (flujo manual intacto).

---

## Cambios — Frontend

### `types/index.ts`

Nuevo tipo `ClienteNoPagoAutomatico` y campo `clientesSinRegistro: ClienteNoPagoAutomatico[]` en el tipo del preview de cierre.

### `CajaCierrePage.tsx`

Nueva sección de advertencia entre el resumen de multas y el botón de confirmar cierre: "N clientes se marcarán como no pago" con tabla (cliente, crédito, multa) cuando `clientesSinRegistro.length > 0`. Informativa — no bloquea el flujo de confirmación existente, sigue siendo un solo clic de "Confirmar cierre" como hoy.

---

## Archivos afectados

### Backend
- `dto/cobros/ClienteNoPagoAutomaticoDTO.java` — nuevo
- `dto/caja/CajaCierrePreviewDTO.java` — nuevo campo `clientesSinRegistro`
- `service/CobrosService.java` — constante, helper de candidatos, `previsualizarNoPagoAutomatico`, `marcarNoPagoAutomatico`
- `service/CajaService.java` — nueva dependencia `CobrosService`, llamadas en `getPreviewCierre` y `cerrar`

### Frontend
- `types/index.ts` — `ClienteNoPagoAutomatico` + campo en tipo de preview
- `pages/caja/CajaCierrePage.tsx` — sección de advertencia antes de confirmar

### Tests
- `CobrosServiceTest` (o nueva clase dedicada) — casos: candidato encontrado y marcado correctamente (pago, calendario, multa), crédito sin slot pendiente ese día no genera nada, multa calculada según config de sucursal/rango, preview no persiste nada.
- Nueva `CajaServiceTest` — verifica que `cerrar()` invoca `cobrosService.marcarNoPagoAutomatico` con la fecha propia de la caja (no necesariamente "hoy") antes de calcular el resumen financiero, y que `getPreviewCierre` incluye `clientesSinRegistro`.

**Sin cambios en:** `ModalRegistrarPago.tsx`, `TabRutaDia.tsx`, `ModalModificarPago.tsx`, modelo de datos.
