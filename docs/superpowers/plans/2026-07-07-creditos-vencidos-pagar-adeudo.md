# Créditos vencidos deben poder pagar adeudo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Un crédito `ACTIVO` cuya `fechaVencimiento` ya pasó, pero que todavía tiene adeudo pendiente (multas sin cobrar), debe volver a aparecer en Ruta del día con el botón "Pagar adeudo" visible, y ese mismo botón debe estar disponible también desde el detalle del crédito.

**Architecture:** Dos cambios independientes pero relacionados. (1) Backend: quitar el filtro `fechaVencimiento >= hoy` de la query de Ruta del día y agregar una rama en `CobrosService.getRutaDia` que incluye al cliente con un nuevo estado `"VENCIDO"` cuando el crédito está vencido y tiene `multasPendientes > 0`. (2) Frontend: nuevo valor `'VENCIDO'` en el tipo `EstadoCobro` con su badge, y un botón "Pagar adeudo" adicional en `CreditoDetallePage` que reutiliza el `ModalPagarAdeudo` ya existente.

**Tech Stack:** Spring Boot 3 / Java 17 (JUnit 5 + Mockito + AssertJ, sin contexto Spring en los tests de servicio) + React 18 / TypeScript (verificación vía `tsc --noEmit`, no hay suite de tests de frontend en este proyecto).

---

## Contexto de referencia (no modificar, solo consulta)

- Spec: `docs/superpowers/specs/2026-07-07-creditos-vencidos-pagar-adeudo-design.md`
- Spec original de la feature de abonos: `docs/superpowers/specs/2026-07-06-abono-ponerse-corriente-design.md`
- Patrón de test de servicio a seguir: `backend/src/test/java/com/magno/service/AbonoCorrienteServiceTest.java`

---

### Task 1: Backend — test que falla para "crédito vencido con adeudo aparece en ruta del día"

**Files:**
- Create: `backend/src/test/java/com/magno/service/CobrosServiceTest.java`

- [x] **Step 1: Escribir el test que falla**

Crea el archivo con el siguiente contenido completo:

```java
package com.magno.service;

import com.magno.dto.cobros.ClienteRutaDTO;
import com.magno.dto.cobros.RutaDiaDTO;
import com.magno.model.*;
import com.magno.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

class CobrosServiceTest {

    private PagoRepository pagoRepo;
    private MultaRepository multaRepo;
    private CreditoRepository creditoRepo;
    private UsuarioRepository usuarioRepo;
    private CalendarioPagoRepository calendarioPagoRepo;
    private ConfigMultaRepository configMultaRepo;
    private DiaFestivoRepository diaFestivoRepo;

    private CobrosService service;

    private Sucursal sucursal;
    private Cliente cliente;
    private Rol rolAsesor;
    private Usuario asesor;
    private Credito credito;

    private static final LocalDate HOY = LocalDate.of(2026, 7, 8); // miércoles

    @BeforeEach
    void setUp() {
        pagoRepo = mock(PagoRepository.class);
        multaRepo = mock(MultaRepository.class);
        creditoRepo = mock(CreditoRepository.class);
        usuarioRepo = mock(UsuarioRepository.class);
        calendarioPagoRepo = mock(CalendarioPagoRepository.class);
        configMultaRepo = mock(ConfigMultaRepository.class);
        diaFestivoRepo = mock(DiaFestivoRepository.class);

        service = new CobrosService(
                pagoRepo, multaRepo, creditoRepo, usuarioRepo,
                calendarioPagoRepo, configMultaRepo, diaFestivoRepo);

        sucursal = new Sucursal();
        sucursal.setId(1L);

        rolAsesor = new Rol();
        rolAsesor.setNombre("ASESOR_COBRADOR");

        asesor = new Usuario();
        asesor.setId(10L);
        asesor.setRol(rolAsesor);
        asesor.setSucursal(sucursal);

        cliente = new Cliente();
        cliente.setId(5L);
        cliente.setNombre("Juana");
        cliente.setApellidoPaterno("Pérez");
        cliente.setCelular("5512345678");
        cliente.setSucursal(sucursal);

        credito = new Credito();
        credito.setId(42L);
        credito.setEstado(EstadoCredito.ACTIVO);
        credito.setAsesor(asesor);
        credito.setCliente(cliente);
        credito.setSucursal(sucursal);
        credito.setMontoCapital(new BigDecimal("3000.00"));
        credito.setPagoPeriodico(new BigDecimal("156.00"));
        credito.setTipoPago(TipoPago.DIARIO);
        credito.setPlazoDias(25);
        credito.setFechaVencimiento(LocalDate.of(2026, 6, 25)); // vencido respecto a HOY
    }

    private void mockRutaDiaComun(List<Credito> creditosActivos) {
        when(creditoRepo.findRutaDiaCreditosActivos(eq(1L), isNull(), eq(EstadoCredito.ACTIVO)))
                .thenReturn(creditosActivos);
        when(diaFestivoRepo.findFechasBySucursalId(1L)).thenReturn(List.of());
        when(pagoRepo.findBySucursalAndAsesorIdAndFecha(eq(1L), isNull(), eq(HOY)))
                .thenReturn(List.of());
        when(calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(42L)).thenReturn(List.of());
    }

    @Test
    void creditoVencidoConAdeudo_apareceEnRutaDiaComoVencido() {
        mockRutaDiaComun(List.of(credito));
        when(multaRepo.sumMontosPendientesByCreditoId(42L)).thenReturn(new BigDecimal("100.00"));

        RutaDiaDTO result = service.getRutaDia(null, 1L, HOY, "ADMINISTRADOR", 10L, 1L);

        assertThat(result.clientes()).hasSize(1);
        ClienteRutaDTO c = result.clientes().get(0);
        assertThat(c.estadoHoy()).isEqualTo("VENCIDO");
        assertThat(c.multasPendientes()).isEqualByComparingTo(new BigDecimal("100.00"));
        assertThat(c.numeroPagoHoy()).isNull();
        assertThat(c.pagoIdHoy()).isNull();
    }

    @Test
    void creditoVencidoSinAdeudo_noApareceEnRutaDia() {
        mockRutaDiaComun(List.of(credito));
        when(multaRepo.sumMontosPendientesByCreditoId(42L)).thenReturn(BigDecimal.ZERO);

        RutaDiaDTO result = service.getRutaDia(null, 1L, HOY, "ADMINISTRADOR", 10L, 1L);

        assertThat(result.clientes()).isEmpty();
    }
}
```

- [x] **Step 2: Verificar que compila pero falla**

Run: `cd backend && mvn test -Dtest=CobrosServiceTest`

Expected: el primer test (`creditoVencidoConAdeudo_apareceEnRutaDiaComoVencido`) falla porque `result.clientes()` está vacío (el código actual hace `continue` sin agregar nada). El segundo test pasa porque ya no se agrega nada (comportamiento actual coincide por accidente).

- [x] **Step 3: Commit**

```bash
git add backend/src/test/java/com/magno/service/CobrosServiceTest.java
git commit -m "test: crédito vencido con adeudo debe aparecer en ruta del día"
```

---

### Task 2: Backend — implementar el fix en CreditoRepository y CobrosService

**Files:**
- Modify: `backend/src/main/java/com/magno/repository/CreditoRepository.java:34-43`
- Modify: `backend/src/main/java/com/magno/service/CobrosService.java:78-121` (query call + branch nueva)
- Modify: `backend/src/main/java/com/magno/service/CobrosService.java:618-636` (nuevo helper `buildClienteRutaVencido`)
- Modify: `backend/src/main/java/com/magno/service/CobrosService.java:666-675` (`ordenEstado`)

- [x] **Step 1: Quitar el filtro de vencimiento en el repositorio**

En `CreditoRepository.java`, reemplaza:

```java
        @Query("SELECT cr FROM Credito cr " +
                        "WHERE cr.estado = :estado " +
                        "AND cr.deletedAt IS NULL " +
                        "AND cr.sucursal.id = :sucursalId " +
                        "AND (:asesorId IS NULL OR cr.asesor.id = :asesorId) " +
                        "AND cr.fechaVencimiento >= :fechaMin")
        List<Credito> findRutaDiaCreditosActivos(@Param("sucursalId") Long sucursalId,
                        @Param("asesorId") Long asesorId,
                        @Param("estado") EstadoCredito estado,
                        @Param("fechaMin") java.time.LocalDate fechaMin);
```

por:

```java
        @Query("SELECT cr FROM Credito cr " +
                        "WHERE cr.estado = :estado " +
                        "AND cr.deletedAt IS NULL " +
                        "AND cr.sucursal.id = :sucursalId " +
                        "AND (:asesorId IS NULL OR cr.asesor.id = :asesorId)")
        List<Credito> findRutaDiaCreditosActivos(@Param("sucursalId") Long sucursalId,
                        @Param("asesorId") Long asesorId,
                        @Param("estado") EstadoCredito estado);
```

- [x] **Step 2: Actualizar el call site en `getRutaDia`**

En `CobrosService.java`, reemplaza:

```java
        List<Credito> creditosActivos = creditoRepo.findRutaDiaCreditosActivos(
                sucursalIdEfectiva,
                asesorIdEfectivo,
                EstadoCredito.ACTIVO,
                hoyNegocio());
```

por:

```java
        List<Credito> creditosActivos = creditoRepo.findRutaDiaCreditosActivos(
                sucursalIdEfectiva,
                asesorIdEfectivo,
                EstadoCredito.ACTIVO);
```

- [x] **Step 3: Agregar la rama de crédito vencido con adeudo**

En `CobrosService.java`, dentro del loop de `getRutaDia`, reemplaza:

```java
            if (cpOpt.isEmpty()) {
                // Fecha no programada (podría ser fin de semana)
                if (fecha.getDayOfWeek() == DayOfWeek.SATURDAY
                        || fecha.getDayOfWeek() == DayOfWeek.SUNDAY) {
                    clientesRuta.add(buildClienteRutaInhabil(cliente, credito));
                    continue;
                }
                // No tiene pago programado ese día (ya completó todos)
                continue;
            }
```

por:

```java
            if (cpOpt.isEmpty()) {
                // Fecha no programada (podría ser fin de semana)
                if (fecha.getDayOfWeek() == DayOfWeek.SATURDAY
                        || fecha.getDayOfWeek() == DayOfWeek.SUNDAY) {
                    clientesRuta.add(buildClienteRutaInhabil(cliente, credito));
                    continue;
                }
                // Puede ser que (a) ya completó todos los pagos, o (b) el crédito
                // está vencido y todavía tiene adeudo pendiente (multas sin cobrar)
                if (credito.getFechaVencimiento() != null
                        && credito.getFechaVencimiento().isBefore(fecha)) {
                    BigDecimal multasPendientesVencido = Optional.ofNullable(
                            multaRepo.sumMontosPendientesByCreditoId(credito.getId()))
                            .orElse(BigDecimal.ZERO);
                    if (multasPendientesVencido.compareTo(BigDecimal.ZERO) > 0) {
                        clientesRuta.add(buildClienteRutaVencido(cliente, credito, multasPendientesVencido));
                    }
                }
                continue;
            }
```

- [x] **Step 4: Agregar el helper `buildClienteRutaVencido`**

Justo después del método `buildClienteRutaInhabil` (que termina en la línea con el `);` de su `return`), agrega:

```java
    private ClienteRutaDTO buildClienteRutaVencido(Cliente cliente, Credito credito, BigDecimal multasPendientes) {
        return new ClienteRutaDTO(
                cliente.getId(),
                cliente.getNombreCompleto(),
                cliente.getCelular(),
                cliente.getNegocioNombre(),
                credito.getAsesor().getNombreCompleto(),
                credito.getId(),
                credito.getMontoCapital(),
                credito.getPagoPeriodico(),
                credito.getTipoPago().toString(),
                null,
                credito.getPlazoDias(),
                "VENCIDO",
                null,
                multasPendientes,
                null,
                null);
    }
```

- [x] **Step 5: Actualizar `ordenEstado` para priorizar VENCIDO**

Reemplaza:

```java
    private int ordenEstado(String estado) {
        return switch (estado) {
            case "SIN_REGISTRO" -> 0;
            case "NO_PAGADO" -> 1;
            case "PARCIAL" -> 2;
            case "INHABIL" -> 3;
            case "PAGADO" -> 4;
            default -> 5;
        };
    }
```

por:

```java
    private int ordenEstado(String estado) {
        return switch (estado) {
            case "SIN_REGISTRO" -> 0;
            case "NO_PAGADO", "VENCIDO" -> 1;
            case "PARCIAL" -> 2;
            case "INHABIL" -> 3;
            case "PAGADO" -> 4;
            default -> 5;
        };
    }
```

- [x] **Step 6: Verificar que los tests pasan**

Run: `cd backend && mvn test -Dtest=CobrosServiceTest`
Expected: `Tests run: 2, Failures: 0, Errors: 0`

- [x] **Step 7: Correr toda la suite de backend para descartar regresiones**

Run: `cd backend && mvn test`
Expected: `BUILD SUCCESS`, sin fallos nuevos (en particular `AbonoCorrienteServiceTest` y cualquier test que use `findRutaDiaCreditosActivos` o `CobrosService`).

- [x] **Step 8: Commit**

```bash
git add backend/src/main/java/com/magno/repository/CreditoRepository.java backend/src/main/java/com/magno/service/CobrosService.java
git commit -m "fix: créditos vencidos con adeudo pendiente vuelven a aparecer en ruta del día"
```

---

### Task 3: Frontend — nuevo estado `VENCIDO` en tipos y badge

**Files:**
- Modify: `frontend/src/types/index.ts:441`
- Modify: `frontend/src/components/cobros/EstadoCobroBadge.tsx:3-10`

- [x] **Step 1: Agregar `'VENCIDO'` al tipo `EstadoCobro`**

En `types/index.ts`, reemplaza:

```ts
export type EstadoCobro = 'SIN_REGISTRO' | 'PAGADO' | 'PARCIAL' | 'NO_PAGADO' | 'INHABIL' | 'INHABILL'
```

por:

```ts
export type EstadoCobro = 'SIN_REGISTRO' | 'PAGADO' | 'PARCIAL' | 'NO_PAGADO' | 'INHABIL' | 'INHABILL' | 'VENCIDO'
```

- [x] **Step 2: Agregar el badge para VENCIDO**

En `EstadoCobroBadge.tsx`, reemplaza:

```ts
const CONFIG: Record<EstadoCobro, { label: string; cls: string }> = {
  PAGADO:        { label: 'Pagó',          cls: 'badge-verde' },
  PARCIAL:       { label: 'Abono',         cls: 'badge-amarillo' },
  NO_PAGADO:     { label: 'No pagó',       cls: 'badge-rojo' },
  INHABIL:       { label: 'Inhábil',       cls: 'badge-gris' },
  INHABILL:      { label: 'Inhábil',       cls: 'badge-gris' },
  SIN_REGISTRO:  { label: 'Sin registrar', cls: 'badge-azul' },
}
```

por:

```ts
const CONFIG: Record<EstadoCobro, { label: string; cls: string }> = {
  PAGADO:        { label: 'Pagó',          cls: 'badge-verde' },
  PARCIAL:       { label: 'Abono',         cls: 'badge-amarillo' },
  NO_PAGADO:     { label: 'No pagó',       cls: 'badge-rojo' },
  INHABIL:       { label: 'Inhábil',       cls: 'badge-gris' },
  INHABILL:      { label: 'Inhábil',       cls: 'badge-gris' },
  SIN_REGISTRO:  { label: 'Sin registrar', cls: 'badge-azul' },
  VENCIDO:       { label: 'Vencido',       cls: 'badge-rojo' },
}
```

- [x] **Step 3: Verificar tipos**

Run: `cd frontend && npm run type-check`
Expected: sin errores.

- [x] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/cobros/EstadoCobroBadge.tsx
git commit -m "feat: badge y tipo VENCIDO para créditos vencidos con adeudo en ruta del día"
```

---

### Task 4: Frontend — botón "Pagar adeudo" en el detalle del crédito

**Files:**
- Modify: `frontend/src/pages/creditos/CreditoDetallePage.tsx`

- [x] **Step 1: Importar `ModalPagarAdeudo`**

En el bloque de imports (línea 15-16), agrega después de `ModalModificarPago`:

```tsx
import ModalModificarPago from '@/components/cobros/ModalModificarPago'
import ModalPagarAdeudo from '@/components/cobros/ModalPagarAdeudo'
```

- [x] **Step 2: Agregar el estado local del modal**

Junto a los demás `useState` de modales (línea 106-107), agrega:

```tsx
  const [registrarPagoOpen, setRegistrarPagoOpen] = useState(false)
  const [adeudoOpen, setAdeudoOpen] = useState(false)
  const [abonoDetalleModal, setAbonoDetalleModal] = useState<AbonoCorrienteDTO | null>(null)
```

- [x] **Step 3: Agregar el botón junto a "Registrar Pago"**

Reemplaza:

```tsx
          {credito.estado === 'ACTIVO' && puedeRegistrarCobro && (
            <button
              className="btn-primary btn btn-sm"
              onClick={() => setRegistrarPagoOpen(true)}
            >
              Registrar Pago
            </button>
          )}
```

por:

```tsx
          {credito.estado === 'ACTIVO' && puedeRegistrarCobro && (
            <button
              className="btn-primary btn btn-sm"
              onClick={() => setRegistrarPagoOpen(true)}
            >
              Registrar Pago
            </button>
          )}
          {credito.estado === 'ACTIVO' && (puedeRegistrarCobro || esAdminSupervisor) && stats.multasPendientes > 0 && (
            <button
              className="btn btn-sm border-[#d97706] text-[#d97706] hover:bg-[#fef3c7]"
              onClick={() => setAdeudoOpen(true)}
            >
              Pagar adeudo
            </button>
          )}
```

- [x] **Step 4: Renderizar el modal**

Justo después del bloque `{/* Modal Modificar pago */}` (línea 918-929, termina con `)}`), agrega:

```tsx
      {/* Modal Pagar adeudo */}
      {adeudoOpen && (
        <ModalPagarAdeudo
          creditoId={numId}
          nombreCliente={credito.cliente.nombreCompleto}
          onClose={() => setAdeudoOpen(false)}
          onSuccess={() => {
            setAdeudoOpen(false)
            qc.invalidateQueries({ queryKey: ['credito', numId] })
            qc.invalidateQueries({ queryKey: ['pagos-cliente-credito', numId] })
            qc.invalidateQueries({ queryKey: ['abonos-credito', numId] })
          }}
        />
      )}
```

- [x] **Step 5: Verificar tipos**

Run: `cd frontend && npm run type-check`
Expected: sin errores.

- [x] **Step 6: Commit**

```bash
git add frontend/src/pages/creditos/CreditoDetallePage.tsx
git commit -m "feat: botón 'Pagar adeudo' en el detalle del crédito"
```

---

### Task 5: Verificación manual en navegador

**Files:** ninguno (solo verificación, sin cambios de código)

- [x] **Step 1: Levantar backend y frontend**

Run backend: `cd backend && mvn spring-boot:run`
Run frontend (otra terminal): `cd frontend && npm run dev`

- [x] **Step 2: Preparar un crédito vencido con adeudo de prueba**

En la base de datos de desarrollo, localiza o crea un crédito `ACTIVO` cuya `fecha_vencimiento` sea anterior a hoy y que tenga al menos una multa con `cobrada = false`. Si no existe uno, la forma más simple es tomar un crédito activo existente y, vía SQL directo en la BD de desarrollo, actualizar `creditos.fecha_vencimiento` a una fecha pasada (ej. hace 10 días) dejando intactos sus `calendario_pagos` y `multas` pendientes.

- [x] **Step 3: Verificar en Ruta del día**

Inicia sesión como Asesor (o el rol correspondiente al crédito de prueba), entra a Ruta del día en la fecha de hoy, y confirma:
- El cliente aparece en la lista con el badge "Vencido" (rojo).
- El botón naranja "Pagar adeudo" está visible.
- Al hacer clic, se abre el modal con la distribución calculada correctamente.

- [x] **Step 4: Verificar en el detalle del crédito**

Navega al detalle de ese mismo crédito (`/creditos-nuevos/:id` o la ruta correspondiente) y confirma:
- El botón "Pagar adeudo" aparece junto a "Registrar Pago" (o solo él, si el rol no puede registrar pago normal).
- Al confirmar un abono desde ahí, el calendario y "Abonos extraordinarios" se actualizan sin recargar la página.

- [x] **Step 5: Verificar que un crédito vencido SIN adeudo no aparece**

Con otro crédito vencido cuyas multas ya estén todas `cobrada = true` (o sin multas), confirma que NO aparece en Ruta del día.

---

## Self-review checklist (ya aplicado al escribir este plan)

- **Cobertura del spec:** Task 2 cubre los cambios de `CreditoRepository`/`CobrosService` de la sección "Cambios — Backend"; Tasks 3-4 cubren la sección "Cambios — Frontend" completa (tipo, badge, botón, modal); Task 5 cubre la verificación manual pedida por CLAUDE.md para cambios de UI.
- **Sin placeholders:** todos los steps incluyen código completo, no hay "TBD" ni "similar a Task N".
- **Consistencia de tipos:** `estadoHoy = "VENCIDO"` (backend) coincide exactamente con `'VENCIDO'` (frontend `EstadoCobro` y `EstadoCobroBadge`). `buildClienteRutaVencido` usa el mismo orden y tipos de campos que `ClienteRutaDTO` y que el helper existente `buildClienteRutaInhabil`.
