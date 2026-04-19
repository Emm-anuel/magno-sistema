# Roles y Permisos — MAGNO v3.5

## 3. Roles y Permisos — 4 ROLES (no 5)

> ⚠️ El sistema tiene exactamente 4 roles. "Cajero" NO existe como rol separado.
> Nombres actualizados en revisión con cliente — Abril 2026.

| Nombre en UI            | Key en BD          | Descripción                                                                                         | Restricciones clave                                                                             |
| ----------------------- | ------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Gerente General**     | `ADMINISTRADOR`    | Acceso total al sistema. Gestión de usuarios, sucursales, configuración, reportes y caja.           | Sin restricciones                                                                               |
| **Gerente de Sucursal** | `SUPERVISOR`       | Operación completa + reportes. Puede ver y aprobar créditos y renovaciones. Acceso a corte de caja. | NO puede gestionar usuarios ni configuración del sistema                                        |
| **Supervisor**          | `SUPERVISOR_CAMPO` | Cobros, créditos nuevos, renovaciones, historial (solo sus clientes), consulta de clientes.         | NO puede aperturar ni cerrar caja. Sin acceso a configuración ni gestión de usuarios            |
| **Asesor**              | `ASESOR_COBRADOR`  | Cobros, créditos nuevos, renovaciones, historial (solo sus clientes), consulta de clientes.         | Solo ve sus propios clientes. Sin caja, sin reportes generales, sin usuarios, sin configuración |

> ⚠️ IMPORTANTE — Las keys en BD (`ADMINISTRADOR`, `SUPERVISOR`, etc.) NO cambian.
> Solo cambia el nombre visible en la UI. Esto evita migraciones de datos en la tabla `roles`
> y mantiene toda la lógica de autorización intacta.

**Nombre abreviado en tablas (cuando el espacio es limitado):**

- Gerente General → "Gte. General"
- Gerente de Sucursal → "Gte. Sucursal"
- Supervisor → "Supervisor"
- Asesor → "Asesor"

**Apertura/cierre de caja permitida:** Gerente General y Gerente de Sucursal únicamente.
**Supervisor y Asesor NO pueden abrir ni cerrar caja.**

**Módulos accesibles por rol (actualizado):**

| Módulo            | Gerente General | Gerente de Sucursal |   Supervisor    |     Asesor      |
| ----------------- | :-------------: | :-----------------: | :-------------: | :-------------: |
| Dashboard         |       ✅        |         ✅          |       ✅        |       ✅        |
| Cobros            |       ❌        |         ❌          |       ✅        |       ✅        |
| Créditos Nuevos   |       ✅        |         ✅          |       ✅        |       ✅        |
| Renovaciones      |       ✅        |         ✅          |       ✅        |       ✅        |
| Clientes          |       ✅        |         ✅          | ✅ (solo suyos) | ✅ (solo suyos) |
| Historial de Pago |  ✅ (puede modificar pagos)  |  ✅ (puede modificar pagos)  | ✅ solo lectura (solo los de sus agentes) | ✅ solo lectura (solo suyos) |
| Caja              |       ✅        |         ✅          |       ❌        |       ❌        |
| Gastos            |       ✅        |         ✅          |       ❌        |       ❌        |
| Reportes          |       ✅        |         ✅          |       ❌        |       ❌        |
| Sucursales        |       ✅        |         ❌          |       ❌        |       ❌        |
| Usuarios          |       ✅        |         ❌          |       ❌        |       ❌        |
| Bitácora          |       ✅        |         ✅          |       ❌        |       ❌        |
| Administración    |       ✅        |         ❌          |       ❌        |       ❌        |
