# Diseño — Créditos vencidos deben poder pagar adeudo
**Fecha:** 2026-07-07
**Estado:** Aprobado — listo para implementación

---

## Contexto

La feature "Abono ponerse al corriente" (`docs/superpowers/specs/2026-07-06-abono-ponerse-corriente-design.md`) agregó el botón "Pagar adeudo" en Ruta del día. Pero un asesor reportó que, para un crédito cuya `fechaVencimiento` ya pasó y que sigue teniendo adeudo (multas pendientes), el cliente ni siquiera aparece en la Ruta del día — por lo tanto el botón nunca se muestra.

Causa raíz (dos partes):

1. `CreditoRepository.findRutaDiaCreditosActivos` filtra `fechaVencimiento >= hoy`, excluyendo del query cualquier crédito vencido aunque siga `ACTIVO` y con adeudo.
2. Aun si se quita ese filtro, `CobrosService.getRutaDia` hace `continue` cuando no encuentra un `CalendarioPago` programado exactamente para la fecha consultada — y un crédito vencido nunca tiene un slot programado "hoy", así que el cliente se sigue perdiendo.

Además, el botón "Pagar adeudo" solo existe en Ruta del día. No hay forma de registrar un abono extraordinario desde el detalle del crédito, así que si el cliente no aparece ahí, no hay ningún punto de entrada alternativo.

---

## Decisiones de diseño confirmadas

| # | Pregunta | Decisión |
|---|----------|----------|
| 1 | ¿Qué créditos vencidos deben reaparecer en Ruta del día? | Solo los que tienen adeudo pendiente (`multasPendientes > 0`), usando el mismo criterio que ya determina si se muestra el botón "Pagar adeudo". Un crédito vencido sin adeudo pendiente no vuelve a aparecer. |
| 2 | ¿Nuevo punto de entrada para registrar abono? | Sí — botón "Pagar adeudo" también en `CreditoDetallePage`, junto a "Registrar Pago", reutilizando el `ModalPagarAdeudo` existente sin cambios. |
| 3 | ¿Roles que pueden ver el botón en el detalle del crédito? | Los mismos 4 roles autorizados por el endpoint: ASESOR_COBRADOR, SUPERVISOR_CAMPO, SUPERVISOR, ADMINISTRADOR. |
| 4 | ¿El abono desde el detalle del crédito respeta fecha histórica? | No aplica — siempre registra con la fecha de hoy (el `ModalPagarAdeudo` ya no envía `fechaPago`, igual que su uso actual en Ruta del día). |

---

## Cambios — Backend

### `CreditoRepository.findRutaDiaCreditosActivos`

Quitar la condición `AND cr.fechaVencimiento >= :fechaMin`. La query sigue filtrando por `estado`, `deletedAt IS NULL`, `sucursal`, `asesor` opcional. El parámetro `fechaMin` deja de ser necesario en esta query (revisar si `hoyNegocio()` se sigue usando en otro lado de la llamada antes de quitar el parámetro del método).

### `CobrosService.getRutaDia`

En el branch donde `cpOpt.isEmpty()` y no es fin de semana ni día inhábil (línea ~113-121, comentario actual "No tiene pago programado ese día — ya completó todos"):

```java
if (cpOpt.isEmpty()) {
    if (esFinDeSemana) {
        clientesRuta.add(buildClienteRutaInhabil(cliente, credito));
        continue;
    }
    // Puede ser: (a) ya completó todos los pagos, o (b) crédito vencido con adeudo pendiente
    if (credito.getFechaVencimiento().isBefore(fecha)) {
        BigDecimal multasPendientes = Optional.ofNullable(
                multaRepo.sumMontosPendientesByCreditoId(credito.getId()))
                .orElse(BigDecimal.ZERO);
        if (multasPendientes.compareTo(BigDecimal.ZERO) > 0) {
            clientesRuta.add(buildClienteRutaVencido(cliente, credito, multasPendientes));
        }
    }
    continue;
}
```

Nuevo helper `buildClienteRutaVencido`, siguiendo el patrón de `buildClienteRutaInhabil`: mismos campos base del crédito, `numeroPagoHoy=null`, `estadoHoy="VENCIDO"`, `montoRecibidoHoy=null`, `multasPendientes` calculado, `razonNoPago=null`, `pagoIdHoy=null`.

### `ordenEstado`

Agregar `case "VENCIDO" -> 1;` (misma prioridad que NO_PAGADO, ambos requieren atención inmediata) y recorrer el resto de los índices sin cambiarlos.

**Sin cambios en:** modelo de datos, endpoints, `ModalPagarAdeudo`, `AbonoCorrienteService`.

---

## Cambios — Frontend

### `types/index.ts`

```ts
export type EstadoCobro = 'SIN_REGISTRO' | 'PAGADO' | 'PARCIAL' | 'NO_PAGADO' | 'INHABIL' | 'INHABILL' | 'VENCIDO'
```

### `EstadoCobroBadge.tsx`

```ts
VENCIDO: { label: 'Vencido', cls: 'badge-rojo' },
```

### `TabRutaDia.tsx`

Sin cambios de lógica: `puedeCobrar` (requiere `estadoHoy === 'SIN_REGISTRO'`) y `puedeModificar` (requiere `pagoIdHoy` truthy) ya devuelven `false` para `VENCIDO` de forma natural. El botón "Pagar adeudo" ya depende solo de `c.multasPendientes > 0 && !esFechaHistorica`, así que aparece sin cambios adicionales.

### `CreditoDetallePage.tsx`

Junto al botón "Registrar Pago" (línea ~258-265):

```tsx
{credito.estado === 'ACTIVO' && (puedeRegistrarCobro || esAdminSupervisor) && stats.multasPendientes > 0 && (
  <button
    className="btn btn-sm border-[#d97706] text-[#d97706] hover:bg-[#fef3c7]"
    onClick={() => setAdeudoOpen(true)}
  >
    Pagar adeudo
  </button>
)}
```

Nuevo estado local `adeudoOpen` (boolean) y render condicional de `<ModalPagarAdeudo creditoId={credito.id} nombreCliente={credito.cliente.nombreCompleto} onClose={...} onSuccess={...} />` al final del componente, junto a los demás modales existentes. Al cerrar/tener éxito, invalidar la query del crédito (`['credito', credito.id]`) para refrescar `stats.multasPendientes` y el calendario.

---

## Archivos afectados

### Backend
- `repository/CreditoRepository.java` — quitar filtro `fechaVencimiento` de `findRutaDiaCreditosActivos`
- `service/CobrosService.java` — nuevo branch para créditos vencidos con adeudo, helper `buildClienteRutaVencido`, actualizar `ordenEstado`

### Frontend
- `types/index.ts` — agregar `'VENCIDO'` a `EstadoCobro`
- `components/cobros/EstadoCobroBadge.tsx` — nuevo caso en `CONFIG`
- `pages/creditos/CreditoDetallePage.tsx` — botón "Pagar adeudo" + estado `adeudoOpen` + render de `ModalPagarAdeudo`

**Sin cambios en:** `ModalPagarAdeudo.tsx`, `AbonoCorrienteService.java`, modelo de datos, migraciones.
