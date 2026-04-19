# Decisiones Confirmadas y Pendientes — MAGNO v3.5

## 13. Ítems Confirmados con Cliente

| #   | Ítem                                     | Decisión                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅  | **Calendario de pagos — días inhábiles** | Opción C: el calendario genera exactamente 25 (o 30) días hábiles corridos desde la fecha de inicio. Sábados, domingos y festivos se omiten automáticamente. El crédito siempre tiene el número exacto de pagos.                                                           |
| ✅  | **Créditos simultáneos por cliente**     | Un solo crédito activo a la vez. El sistema debe bloquear una nueva solicitud si el cliente ya tiene uno en estado ACTIVO. Después del último pago se puede hacer una renovación.                                                                                          |
| ✅  | **Zona $15k–$20k**                       | Sí hay montos intermedios (ej: $17,000, $18,000). Aplica la misma tabla y tasa del rango $15,000 (24% interés, 25 días). La tabla de referencia del cliente solo muestra ejemplos, no todos los montos posibles. La fórmula es la misma para cualquier monto en ese rango. |
| ✅  | **Cobros — CAJA vs RUTA**                | Mismo flujo de registro. El asesor registra desde su celular en campo. Solo cambia el campo origen: CAJA (cliente vino a pagar a sucursal) o RUTA (cobrador fue al negocio del cliente).                                                                                   |
| ✅  | **Cobros — Multas**                      | Las multas generadas por no pago se cobran junto con el siguiente pago del cliente. El cobrador las registra en el mismo acto del cobro. También se descuentan del desembolso en renovaciones.                                                                             |
| ✅  | **Cobros — Quién registra**              | El asesor asignado registra los cobros de sus propios clientes. Supervisor y Admin pueden intervenir y registrar cobros de cualquier cliente de su sucursal.                                                                                                               |
| ✅  | **Cobros — Corrección de pagos**         | Solo Supervisor o Admin pueden modificar un pago ya registrado. El asesor no puede editar sus propios registros una vez guardados.                                                                                                                                         |
| ✅  | **Cobros — Clientes por asesor**         | Se asume entre 20 y 50 clientes por asesor. La grilla debe tener paginación y búsqueda para escalar sin problema.                                                                                                                                                          |
| ✅  | **Colocaciones Semanales — módulo independiente** | Extraído del módulo de Renovaciones y promovido a módulo propio en el sidebar (ruta `/colocaciones`). Accesible por los 4 roles. No es una sub-pestaña de Renovaciones. |
| ✅  | **Listos para Renovar — umbral y filtrado por rol** | Pestaña de solo lectura dentro de Renovaciones. Umbral: 16 pagos (plazo 25 días) o 19 pagos (plazo 30 días). Filtrado por rol: Asesor ve sus clientes, Supervisor de campo ve clientes de su sucursal, Gerente de Sucursal ve todos en su sucursal, Gerente General ve todos. |

## 13b. Ítems Pendientes de Confirmar con Cliente

> ⚠️ NO asumir — preguntar antes de implementar.

1. **Colocaciones**: ¿tabla almacenada en BD o reporte calculado?
2. **Base del 24%**: ¿sobre Ingreso Carteras solamente o sobre Subtotal Caja?
3. **Pagos semanales**: tasa y forma de cálculo exacta.
4. **Mora Activa vs Mora Parada**: criterio exacto de clasificación.
5. **Aval**: ¿obligatorio para todos los créditos o solo ciertos montos?
6. **Tamaño máximo de archivos**: ¿límite de MB para videos de evidencia?
7. **INE del cliente**: ¿se agrega upload de imagen en el alta de cliente?

---

## 13c. Reglas Confirmadas — Pendientes de Implementar

| #   | Regla                                        | Módulo de implementación |
| --- | -------------------------------------------- | ------------------------ |
| 🔜  | **Bloqueo operativo después de las 5:00 PM** | Módulo 6 — Caja          |

### Detalle — Bloqueo operativo por cierre de caja

**Regla confirmada por cliente (Abril 2026):** Después de las 5:00 PM (hora local, `America/Mexico_City`), los roles `ASESOR_COBRADOR` y `SUPERVISOR_CAMPO` no pueden registrar ni modificar pagos, ni editar operaciones en ninguna sección.

**Diseño conceptual:**
- Esta restricción está **conceptualmente ligada al cierre de caja del día**, no es una validación de horario independiente.
- Debe implementarse dentro del **Módulo 6 (Caja)**, donde el estado `abierta/cerrada` de la caja será la fuente de verdad.
- La hora límite (5:00 PM) **podría ser configurable por sucursal** en el futuro.
- El **mensaje de error al usuario** debe ser: `"No es posible registrar operaciones después de las 5:00 PM"`.
- Roles que NO se bloquean: `ADMINISTRADOR` y `SUPERVISOR` (Gerente de Sucursal) pueden operar sin restricción de horario.

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
