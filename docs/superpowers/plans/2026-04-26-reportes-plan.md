# Módulo 8 — Reportes: Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo de Reportes completo con 4 pestañas (Ingresos/Egresos, Colocaciones, Cartera, Por Asesor), 8 endpoints REST + 4 endpoints PDF, y UI en React con paleta emerald/blue/amber/red.

**Architecture:** Backend-heavy — Spring Boot genera datos pre-agregados y PDFs server-side con iText 8. El frontend solo renderiza lo que recibe. Seguridad con `@PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")` en todos los endpoints.

**Tech Stack:** Spring Boot 3 · Java 17 · JPA/JPQL · iText 8 · PostgreSQL · React 18 · TypeScript · Tailwind CSS · TanStack Query

---

## Mapa de archivos

**Backend — crear:**
- `backend/src/main/java/com/magno/dto/reporte/FilaDiariaDTO.java`
- `backend/src/main/java/com/magno/dto/reporte/ReporteIngresosEgresosDTO.java`
- `backend/src/main/java/com/magno/dto/reporte/ReporteColocacionesDTO.java`
- `backend/src/main/java/com/magno/dto/reporte/CreditoActivoDTO.java`
- `backend/src/main/java/com/magno/dto/reporte/ReporteCarteraDTO.java`
- `backend/src/main/java/com/magno/dto/reporte/AsesorResumenDTO.java`
- `backend/src/main/java/com/magno/dto/reporte/ReportePorAsesorDTO.java`
- `backend/src/main/java/com/magno/service/ReporteService.java`
- `backend/src/main/java/com/magno/controller/ReporteController.java`
- `backend/src/test/java/com/magno/service/ReporteServiceTest.java`

**Backend — modificar:**
- `backend/src/main/java/com/magno/repository/CajaDiaRepository.java`
- `backend/src/main/java/com/magno/repository/CreditoRepository.java`
- `backend/src/main/java/com/magno/repository/PagoRepository.java`
- `backend/src/main/java/com/magno/repository/MultaRepository.java`
- `backend/src/main/java/com/magno/repository/CalendarioPagoRepository.java`

**Frontend — crear:**
- `frontend/src/services/reporteService.ts`
- `frontend/src/components/reportes/MetricCard.tsx`
- `frontend/src/components/reportes/FiltroFechas.tsx`
- `frontend/src/components/reportes/ExportPdfButton.tsx`
- `frontend/src/components/reportes/SucursalSelector.tsx`
- `frontend/src/pages/reportes/TabIngresosEgresos.tsx`
- `frontend/src/pages/reportes/TabColocaciones.tsx`
- `frontend/src/pages/reportes/TabCartera.tsx`
- `frontend/src/pages/reportes/TabPorAsesor.tsx`
- `frontend/src/pages/reportes/ReportesPage.tsx`

**Frontend — modificar:**
- `frontend/src/App.tsx` (reemplazar `ModulePlaceholderPage` en `/reportes`)

---

## Task 1: DTOs del módulo Reportes

**Files:**
- Create: `backend/src/main/java/com/magno/dto/reporte/FilaDiariaDTO.java`
- Create: `backend/src/main/java/com/magno/dto/reporte/ReporteIngresosEgresosDTO.java`
- Create: `backend/src/main/java/com/magno/dto/reporte/ReporteColocacionesDTO.java`
- Create: `backend/src/main/java/com/magno/dto/reporte/CreditoActivoDTO.java`
- Create: `backend/src/main/java/com/magno/dto/reporte/ReporteCarteraDTO.java`
- Create: `backend/src/main/java/com/magno/dto/reporte/AsesorResumenDTO.java`
- Create: `backend/src/main/java/com/magno/dto/reporte/ReportePorAsesorDTO.java`

- [ ] **Step 1: Crear FilaDiariaDTO y ReporteIngresosEgresosDTO**

`backend/src/main/java/com/magno/dto/reporte/FilaDiariaDTO.java`:
```java
package com.magno.dto.reporte;

import java.math.BigDecimal;
import java.time.LocalDate;

public record FilaDiariaDTO(
    LocalDate fecha,
    BigDecimal ingresoCarteras,
    BigDecimal desembolsos,
    BigDecimal gastos,
    BigDecimal inversiones,
    BigDecimal subtotalCaja
) {}
```

`backend/src/main/java/com/magno/dto/reporte/ReporteIngresosEgresosDTO.java`:
```java
package com.magno.dto.reporte;

import java.math.BigDecimal;
import java.util.List;

public record ReporteIngresosEgresosDTO(
    List<FilaDiariaDTO> filas,
    BigDecimal totalIngresoCarteras,
    BigDecimal totalDesembolsos,
    BigDecimal totalGastos,
    BigDecimal subtotalNeto
) {}
```

- [ ] **Step 2: Crear ReporteColocacionesDTO**

`backend/src/main/java/com/magno/dto/reporte/ReporteColocacionesDTO.java`:
```java
package com.magno.dto.reporte;

import com.magno.dto.renovacion.ColocacionItemDTO;
import java.math.BigDecimal;
import java.util.List;

public record ReporteColocacionesDTO(
    List<ColocacionItemDTO> items,
    BigDecimal totalDesembolsos,
    BigDecimal totalCaja
) {}
```

- [ ] **Step 3: Crear CreditoActivoDTO y ReporteCarteraDTO**

`backend/src/main/java/com/magno/dto/reporte/CreditoActivoDTO.java`:
```java
package com.magno.dto.reporte;

import java.math.BigDecimal;

public record CreditoActivoDTO(
    Long creditoId,
    String clienteNombre,
    String asesorNombre,
    BigDecimal montoCapital,
    int pagosRealizados,
    int pagosTotal,
    BigDecimal saldoPendiente,
    BigDecimal multasPendientes,
    boolean enMora
) {}
```

`backend/src/main/java/com/magno/dto/reporte/ReporteCarteraDTO.java`:
```java
package com.magno.dto.reporte;

import java.math.BigDecimal;
import java.util.List;

public record ReporteCarteraDTO(
    int totalCreditosActivos,
    BigDecimal montoTotalColocado,
    int creditosEnMora,
    BigDecimal montoEnRiesgo,
    List<CreditoActivoDTO> creditos
) {}
```

- [ ] **Step 4: Crear AsesorResumenDTO y ReportePorAsesorDTO**

`backend/src/main/java/com/magno/dto/reporte/AsesorResumenDTO.java`:
```java
package com.magno.dto.reporte;

import java.math.BigDecimal;

public record AsesorResumenDTO(
    Long asesorId,
    String asesorNombre,
    // Cobranza del período
    long cobrosRegistrados,
    BigDecimal montoCobrado,
    BigDecimal multasCobradas,
    long pagosIncompletos,
    // Cartera activa
    int clientesActivos,
    BigDecimal montoTotalColocado,
    int clientesEnMora,
    BigDecimal montoEnRiesgo
) {}
```

`backend/src/main/java/com/magno/dto/reporte/ReportePorAsesorDTO.java`:
```java
package com.magno.dto.reporte;

import java.math.BigDecimal;
import java.util.List;

public record ReportePorAsesorDTO(
    List<AsesorResumenDTO> asesores,
    // Totales globales
    long totalCobrosRegistrados,
    BigDecimal totalMontoCobrado,
    BigDecimal totalMultasCobradas,
    int totalClientesActivos,
    BigDecimal totalMontoColocado,
    int totalClientesEnMora
) {}
```

- [ ] **Step 5: Compilar para verificar que los records compilan**

```bash
cd backend && ./mvnw compile -q
```
Esperado: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/magno/dto/reporte/
git commit -m "feat(reportes): add DTOs for Reportes module"
```

---

## Task 2: Queries en repositorios existentes

**Files:**
- Modify: `backend/src/main/java/com/magno/repository/CajaDiaRepository.java`
- Modify: `backend/src/main/java/com/magno/repository/CreditoRepository.java`
- Modify: `backend/src/main/java/com/magno/repository/PagoRepository.java`
- Modify: `backend/src/main/java/com/magno/repository/MultaRepository.java`
- Modify: `backend/src/main/java/com/magno/repository/CalendarioPagoRepository.java`

- [ ] **Step 1: Agregar query a CajaDiaRepository**

Agregar al final de `CajaDiaRepository.java`, antes del `}` de cierre:

```java
    @Query("SELECT cd FROM CajaDia cd WHERE cd.sucursal.id = :sucursalId " +
           "AND cd.fecha >= :desde AND cd.fecha <= :hasta " +
           "AND cd.estado = com.magno.model.EstadoCaja.CERRADA " +
           "ORDER BY cd.fecha ASC")
    List<CajaDia> findCerradasBySucursalAndFechaRange(
            @Param("sucursalId") Long sucursalId,
            @Param("desde") LocalDate desde,
            @Param("hasta") LocalDate hasta);
```

- [ ] **Step 2: Agregar query a CreditoRepository**

Agregar al final de `CreditoRepository.java`, antes del `}` de cierre:

```java
    @Query("SELECT c FROM Credito c WHERE c.estado = com.magno.model.EstadoCredito.ACTIVO " +
           "AND c.deletedAt IS NULL " +
           "AND c.sucursal.id = :sucursalId " +
           "AND (:asesorId IS NULL OR c.asesor.id = :asesorId) " +
           "ORDER BY c.cliente.apellidoPaterno ASC, c.cliente.nombre ASC")
    List<Credito> findActivosBySucursalAndAsesor(
            @Param("sucursalId") Long sucursalId,
            @Param("asesorId") Long asesorId);
```

- [ ] **Step 3: Agregar queries a PagoRepository**

Agregar al final de `PagoRepository.java`, antes del `}` de cierre:

```java
    @Query("SELECT COUNT(p) FROM Pago p " +
           "WHERE p.asesor.id = :asesorId " +
           "AND p.fechaPago >= :desde AND p.fechaPago <= :hasta " +
           "AND p.deletedAt IS NULL")
    long countByAsesorAndFechaRange(
            @Param("asesorId") Long asesorId,
            @Param("desde") LocalDate desde,
            @Param("hasta") LocalDate hasta);

    @Query("SELECT COALESCE(SUM(p.montoRecibido), 0) FROM Pago p " +
           "WHERE p.asesor.id = :asesorId " +
           "AND p.fechaPago >= :desde AND p.fechaPago <= :hasta " +
           "AND p.deletedAt IS NULL")
    java.math.BigDecimal sumMontoCobradoByAsesorAndFechaRange(
            @Param("asesorId") Long asesorId,
            @Param("desde") LocalDate desde,
            @Param("hasta") LocalDate hasta);

    @Query("SELECT COUNT(p) FROM Pago p " +
           "WHERE p.asesor.id = :asesorId " +
           "AND p.fechaPago >= :desde AND p.fechaPago <= :hasta " +
           "AND p.esCompleto = false " +
           "AND p.deletedAt IS NULL")
    long countIncompletosByAsesorAndFechaRange(
            @Param("asesorId") Long asesorId,
            @Param("desde") LocalDate desde,
            @Param("hasta") LocalDate hasta);
```

- [ ] **Step 4: Agregar query a MultaRepository**

Agregar al final de `MultaRepository.java`, antes del `}` de cierre:

```java
    @Query("SELECT COALESCE(SUM(m.monto), 0) FROM Multa m " +
           "WHERE m.credito.asesor.id = :asesorId " +
           "AND m.cobrada = true " +
           "AND m.fecha >= :desde AND m.fecha <= :hasta " +
           "AND m.deletedAt IS NULL")
    java.math.BigDecimal sumMultasCobradaByAsesorAndFechaRange(
            @Param("asesorId") Long asesorId,
            @Param("desde") LocalDate desde,
            @Param("hasta") LocalDate hasta);
```

- [ ] **Step 5: Agregar query a CalendarioPagoRepository**

Agregar al final de `CalendarioPagoRepository.java`, antes del `}` de cierre.

Necesita import: `import java.time.LocalDate;`

```java
    @Query("SELECT COUNT(cp) FROM CalendarioPago cp " +
           "WHERE cp.credito.id = :creditoId " +
           "AND cp.estado IN ('NO_PAGADO', 'PARCIAL') " +
           "AND cp.fechaProgramada <= :hoy")
    long countAtrasadosByCreditoId(
            @Param("creditoId") Long creditoId,
            @Param("hoy") LocalDate hoy);

    @Query("SELECT COUNT(cp) FROM CalendarioPago cp " +
           "WHERE cp.credito.id = :creditoId " +
           "AND cp.estado IN ('PAGADO', 'ADELANTADO')")
    long countRealizadosByCreditoId(@Param("creditoId") Long creditoId);
```

- [ ] **Step 6: Compilar para verificar**

```bash
cd backend && ./mvnw compile -q
```
Esperado: BUILD SUCCESS

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/magno/repository/
git commit -m "feat(reportes): add repository queries for Reportes module"
```

---

## Task 3: Tests de ReporteService (TDD — escribir antes de implementar)

**Files:**
- Create: `backend/src/test/java/com/magno/service/ReporteServiceTest.java`

- [ ] **Step 1: Crear el archivo de test**

`backend/src/test/java/com/magno/service/ReporteServiceTest.java`:

```java
package com.magno.service;

import com.magno.dto.reporte.*;
import com.magno.model.*;
import com.magno.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ReporteServiceTest {

    private CajaDiaRepository cajaDiaRepo;
    private CajaMovimientoInversionRepository movimientoRepo;
    private CreditoRepository creditoRepo;
    private PagoRepository pagoRepo;
    private MultaRepository multaRepo;
    private CalendarioPagoRepository calendarioRepo;
    private RenovacionRepository renovacionRepo;
    private UsuarioRepository usuarioRepo;
    private ReporteService service;

    @BeforeEach
    void setUp() {
        cajaDiaRepo = mock(CajaDiaRepository.class);
        movimientoRepo = mock(CajaMovimientoInversionRepository.class);
        creditoRepo = mock(CreditoRepository.class);
        pagoRepo = mock(PagoRepository.class);
        multaRepo = mock(MultaRepository.class);
        calendarioRepo = mock(CalendarioPagoRepository.class);
        renovacionRepo = mock(RenovacionRepository.class);
        usuarioRepo = mock(UsuarioRepository.class);
        service = new ReporteService(
                cajaDiaRepo, movimientoRepo, creditoRepo,
                pagoRepo, multaRepo, calendarioRepo,
                renovacionRepo, usuarioRepo);
    }

    // ── getIngresosEgresos ────────────────────────────────────────────────

    @Test
    void getIngresosEgresos_sinDias_retornaDTO_conCeros() {
        when(cajaDiaRepo.findCerradasBySucursalAndFechaRange(1L,
                LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30)))
                .thenReturn(List.of());

        ReporteIngresosEgresosDTO result =
                service.getIngresosEgresos(1L,
                        LocalDate.of(2026, 4, 1),
                        LocalDate.of(2026, 4, 30));

        assertThat(result.filas()).isEmpty();
        assertThat(result.totalIngresoCarteras()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.totalDesembolsos()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.totalGastos()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.subtotalNeto()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void getIngresosEgresos_conDias_sumaCorrectamente() {
        CajaDia dia1 = cajaDia(1L, LocalDate.of(2026, 4, 7),
                new BigDecimal("1000.00"), new BigDecimal("500.00"),
                new BigDecimal("100.00"), new BigDecimal("800.00"));
        CajaDia dia2 = cajaDia(2L, LocalDate.of(2026, 4, 8),
                new BigDecimal("2000.00"), new BigDecimal("800.00"),
                new BigDecimal("150.00"), new BigDecimal("1100.00"));

        when(cajaDiaRepo.findCerradasBySucursalAndFechaRange(1L,
                LocalDate.of(2026, 4, 7), LocalDate.of(2026, 4, 8)))
                .thenReturn(List.of(dia1, dia2));
        when(movimientoRepo.sumMontoByCajaDiaId(1L)).thenReturn(BigDecimal.ZERO);
        when(movimientoRepo.sumMontoByCajaDiaId(2L)).thenReturn(BigDecimal.ZERO);

        ReporteIngresosEgresosDTO result =
                service.getIngresosEgresos(1L,
                        LocalDate.of(2026, 4, 7),
                        LocalDate.of(2026, 4, 8));

        assertThat(result.filas()).hasSize(2);
        assertThat(result.totalIngresoCarteras()).isEqualByComparingTo("3000.00");
        assertThat(result.totalDesembolsos()).isEqualByComparingTo("1300.00");
        assertThat(result.totalGastos()).isEqualByComparingTo("250.00");
        // subtotalNeto = totalIngresos − totalDesembolsos − totalGastos
        assertThat(result.subtotalNeto()).isEqualByComparingTo("1450.00");
    }

    // ── getCartera ────────────────────────────────────────────────────────

    @Test
    void getCartera_enMora_filtraCorrectamente() {
        Credito creditoSano = credito(10L, new BigDecimal("5000.00"), new BigDecimal("260.00"), 25);
        Credito creditoMora = credito(11L, new BigDecimal("3000.00"), new BigDecimal("156.00"), 25);

        when(creditoRepo.findActivosBySucursalAndAsesor(1L, null))
                .thenReturn(List.of(creditoSano, creditoMora));

        LocalDate hoy = LocalDate.now();

        // creditoSano: sin atrasos
        when(calendarioRepo.countAtrasadosByCreditoId(10L, hoy)).thenReturn(0L);
        when(calendarioRepo.countRealizadosByCreditoId(10L)).thenReturn(10L);
        when(multaRepo.sumMontosPendientesByCreditoId(10L)).thenReturn(BigDecimal.ZERO);

        // creditoMora: con atrasos
        when(calendarioRepo.countAtrasadosByCreditoId(11L, hoy)).thenReturn(2L);
        when(calendarioRepo.countRealizadosByCreditoId(11L)).thenReturn(8L);
        when(multaRepo.sumMontosPendientesByCreditoId(11L)).thenReturn(new BigDecimal("100.00"));

        ReporteCarteraDTO result = service.getCartera(1L, null, "EN_MORA");

        // Solo debe aparecer el crédito en mora
        assertThat(result.creditos()).hasSize(1);
        assertThat(result.creditos().get(0).creditoId()).isEqualTo(11L);
        assertThat(result.creditos().get(0).enMora()).isTrue();
        // Métricas totales incluyen ambos (sin filtro de mora en las tarjetas de resumen)
        assertThat(result.creditosEnMora()).isEqualTo(1);
        assertThat(result.totalCreditosActivos()).isEqualTo(2);
    }

    // ── getPorAsesor ─────────────────────────────────────────────────────

    @Test
    void getPorAsesor_conUnAsesor_retornaResumenCorrecto() {
        Usuario asesor = usuario(5L, "ASESOR_COBRADOR", "Juan Pérez");
        Credito credito = credito(20L, new BigDecimal("4000.00"), new BigDecimal("208.00"), 25);

        when(usuarioRepo.findBySucursalId(1L)).thenReturn(List.of(asesor));
        when(creditoRepo.findActivosBySucursalAndAsesor(1L, 5L))
                .thenReturn(List.of(credito));

        LocalDate desde = LocalDate.of(2026, 4, 1);
        LocalDate hasta = LocalDate.of(2026, 4, 30);
        LocalDate hoy = LocalDate.now();

        when(pagoRepo.countByAsesorAndFechaRange(5L, desde, hasta)).thenReturn(15L);
        when(pagoRepo.sumMontoCobradoByAsesorAndFechaRange(5L, desde, hasta))
                .thenReturn(new BigDecimal("3120.00"));
        when(multaRepo.sumMultasCobradaByAsesorAndFechaRange(5L, desde, hasta))
                .thenReturn(BigDecimal.ZERO);
        when(pagoRepo.countIncompletosByAsesorAndFechaRange(5L, desde, hasta)).thenReturn(1L);

        when(calendarioRepo.countAtrasadosByCreditoId(20L, hoy)).thenReturn(0L);
        when(calendarioRepo.countRealizadosByCreditoId(20L)).thenReturn(10L);
        when(multaRepo.sumMontosPendientesByCreditoId(20L)).thenReturn(BigDecimal.ZERO);

        ReportePorAsesorDTO result = service.getPorAsesor(1L, desde, hasta, null);

        assertThat(result.asesores()).hasSize(1);
        AsesorResumenDTO resumen = result.asesores().get(0);
        assertThat(resumen.asesorNombre()).isEqualTo("Juan Pérez");
        assertThat(resumen.cobrosRegistrados()).isEqualTo(15L);
        assertThat(resumen.montoCobrado()).isEqualByComparingTo("3120.00");
        assertThat(resumen.clientesActivos()).isEqualTo(1);
        assertThat(result.totalClientesActivos()).isEqualTo(1);
    }

    // ── helpers privados ─────────────────────────────────────────────────

    private CajaDia cajaDia(Long id, LocalDate fecha,
                             BigDecimal ingresoCarteras, BigDecimal desembolsos,
                             BigDecimal totalGastos, BigDecimal subtotalCaja) {
        CajaDia cd = new CajaDia();
        cd.setId(id);
        cd.setFecha(fecha);
        cd.setIngresoCarteras(ingresoCarteras);
        cd.setDesembolsos(desembolsos);
        cd.setTotalGastos(totalGastos);
        cd.setSubtotalCaja(subtotalCaja);
        cd.setEstado(EstadoCaja.CERRADA);
        return cd;
    }

    private Credito credito(Long id, BigDecimal montoCapital,
                             BigDecimal pagoPeriodico, int plazoDias) {
        Cliente cliente = new Cliente();
        cliente.setNombre("Test");
        cliente.setApellidoPaterno("Cliente");

        Usuario asesor = new Usuario();
        asesor.setNombreCompleto("Asesor Test");

        Credito c = new Credito();
        c.setId(id);
        c.setMontoCapital(montoCapital);
        c.setPagoPeriodico(pagoPeriodico);
        c.setPlazoDias(plazoDias);
        c.setEstado(EstadoCredito.ACTIVO);
        c.setCliente(cliente);
        c.setAsesor(asesor);
        return c;
    }

    private Usuario usuario(Long id, String rol, String nombre) {
        Rol rolObj = new Rol();
        rolObj.setNombre(rol);

        Usuario u = new Usuario();
        u.setId(id);
        u.setNombreCompleto(nombre);
        u.setRol(rolObj);
        return u;
    }
}
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

```bash
cd backend && ./mvnw test -pl . -Dtest=ReporteServiceTest -q 2>&1 | tail -20
```
Esperado: `COMPILATION ERROR` o `NoSuchMethodError` porque `ReporteService` aún no existe.

- [ ] **Step 3: Commit del test**

```bash
git add backend/src/test/java/com/magno/service/ReporteServiceTest.java
git commit -m "test(reportes): add failing tests for ReporteService (TDD)"
```

---

## Task 4: ReporteService — métodos de datos

**Files:**
- Create: `backend/src/main/java/com/magno/service/ReporteService.java`

- [ ] **Step 1: Crear ReporteService con los 4 métodos de datos**

`backend/src/main/java/com/magno/service/ReporteService.java`:

```java
package com.magno.service;

import com.magno.dto.reporte.*;
import com.magno.dto.renovacion.ColocacionItemDTO;
import com.magno.model.*;
import com.magno.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class ReporteService {

    private static final ZoneId MAGNO_ZONE = ZoneId.of("America/Mexico_City");
    private static final List<String> ROLES_CAMPO = List.of("ASESOR_COBRADOR", "SUPERVISOR_CAMPO");

    private final CajaDiaRepository cajaDiaRepo;
    private final CajaMovimientoInversionRepository movimientoRepo;
    private final CreditoRepository creditoRepo;
    private final PagoRepository pagoRepo;
    private final MultaRepository multaRepo;
    private final CalendarioPagoRepository calendarioRepo;
    private final RenovacionRepository renovacionRepo;
    private final UsuarioRepository usuarioRepo;

    public ReporteService(CajaDiaRepository cajaDiaRepo,
                          CajaMovimientoInversionRepository movimientoRepo,
                          CreditoRepository creditoRepo,
                          PagoRepository pagoRepo,
                          MultaRepository multaRepo,
                          CalendarioPagoRepository calendarioRepo,
                          RenovacionRepository renovacionRepo,
                          UsuarioRepository usuarioRepo) {
        this.cajaDiaRepo = cajaDiaRepo;
        this.movimientoRepo = movimientoRepo;
        this.creditoRepo = creditoRepo;
        this.pagoRepo = pagoRepo;
        this.multaRepo = multaRepo;
        this.calendarioRepo = calendarioRepo;
        this.renovacionRepo = renovacionRepo;
        this.usuarioRepo = usuarioRepo;
    }

    // ── Ingresos/Egresos ─────────────────────────────────────────────────

    public ReporteIngresosEgresosDTO getIngresosEgresos(Long sucursalId,
                                                         LocalDate desde,
                                                         LocalDate hasta) {
        List<CajaDia> dias = cajaDiaRepo.findCerradasBySucursalAndFechaRange(sucursalId, desde, hasta);

        BigDecimal totalIngresos = BigDecimal.ZERO;
        BigDecimal totalDesembolsos = BigDecimal.ZERO;
        BigDecimal totalGastos = BigDecimal.ZERO;

        List<FilaDiariaDTO> filas = new ArrayList<>();
        for (CajaDia dia : dias) {
            BigDecimal inversiones = movimientoRepo.sumMontoByCajaDiaId(dia.getId());
            BigDecimal ingresos = coalesce(dia.getIngresoCarteras());
            BigDecimal desembolsos = coalesce(dia.getDesembolsos());
            BigDecimal gastos = coalesce(dia.getTotalGastos());
            BigDecimal subtotal = coalesce(dia.getSubtotalCaja());

            filas.add(new FilaDiariaDTO(dia.getFecha(), ingresos, desembolsos, gastos, inversiones, subtotal));

            totalIngresos = totalIngresos.add(ingresos);
            totalDesembolsos = totalDesembolsos.add(desembolsos);
            totalGastos = totalGastos.add(gastos);
        }

        BigDecimal subtotalNeto = totalIngresos.subtract(totalDesembolsos).subtract(totalGastos);

        return new ReporteIngresosEgresosDTO(filas, totalIngresos, totalDesembolsos, totalGastos, subtotalNeto);
    }

    // ── Colocaciones ─────────────────────────────────────────────────────

    public ReporteColocacionesDTO getColocaciones(Long sucursalId,
                                                   LocalDate desde,
                                                   LocalDate hasta,
                                                   Long asesorId) {
        OffsetDateTime inicioTs = desde.atStartOfDay(MAGNO_ZONE).toOffsetDateTime();
        OffsetDateTime finTs = hasta.plusDays(1).atStartOfDay(MAGNO_ZONE).toOffsetDateTime();

        // Créditos nuevos ACTIVOS desembolsados en el rango
        List<Credito> nuevos = creditoRepo.findColocacionesNuevos(
                EstadoCredito.ACTIVO, inicioTs, finTs, asesorId, sucursalId);

        // Renovaciones APROBADAS/ACTIVAS en el rango (reutiliza lógica existente)
        List<Renovacion> renovaciones = renovacionRepo.findColocaciones(desde, hasta, asesorId, sucursalId);

        List<ColocacionItemDTO> items = new ArrayList<>();

        for (Credito c : nuevos) {
            LocalDate fecha = c.getFechaDesembolso() != null
                    ? c.getFechaDesembolso().toLocalDate()
                    : c.getFechaInicio();
            String clienteNombre = c.getCliente().getNombreCompleto() != null
                    ? c.getCliente().getNombreCompleto()
                    : c.getCliente().getNombre() + " " + c.getCliente().getApellidoPaterno();
            items.add(new ColocacionItemDTO(
                    fecha,
                    clienteNombre,
                    c.getCliente().getId(),
                    null,
                    c.getMontoCapital(),
                    c.getMontoCapital(),
                    c.getAsesor().getNombreCompleto(),
                    c.getTipoPago().name(),
                    "NUEVO",
                    c.getId()));
        }

        for (Renovacion r : renovaciones) {
            if (r.getCreditoNuevo() == null) continue;
            String clienteNombre = r.getCliente().getNombreCompleto() != null
                    ? r.getCliente().getNombreCompleto()
                    : r.getCliente().getNombre() + " " + r.getCliente().getApellidoPaterno();
            items.add(new ColocacionItemDTO(
                    r.getFecha(),
                    clienteNombre,
                    r.getCliente().getId(),
                    r.getCreditoAnterior().getMontoCapital(),
                    r.getCreditoNuevo().getMontoCapital(),
                    coalesce(r.getMontoDesembolso()),
                    r.getAsesor().getNombreCompleto(),
                    r.getTipoPago().name(),
                    "RENOVACION",
                    r.getId()));
        }

        items.sort(Comparator.comparing(ColocacionItemDTO::fecha));

        BigDecimal totalDesembolsos = items.stream()
                .map(ColocacionItemDTO::desembolso)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCaja = renovaciones.stream()
                .filter(r -> r.getCreditoNuevo() != null)
                .map(r -> coalesce(r.getMontoDesembolso()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new ReporteColocacionesDTO(items, totalDesembolsos, totalCaja);
    }

    // ── Cartera ──────────────────────────────────────────────────────────

    public ReporteCarteraDTO getCartera(Long sucursalId, Long asesorId, String estado) {
        List<Credito> activos = creditoRepo.findActivosBySucursalAndAsesor(sucursalId, asesorId);
        LocalDate hoy = LocalDate.now(MAGNO_ZONE);

        List<CreditoActivoDTO> dtos = new ArrayList<>();
        int totalEnMora = 0;
        BigDecimal montoEnRiesgo = BigDecimal.ZERO;
        BigDecimal montoTotalColocado = BigDecimal.ZERO;

        for (Credito c : activos) {
            long atrasados = calendarioRepo.countAtrasadosByCreditoId(c.getId(), hoy);
            boolean enMora = atrasados > 0;
            long realizados = calendarioRepo.countRealizadosByCreditoId(c.getId());
            BigDecimal multasPendientes = multaRepo.sumMontosPendientesByCreditoId(c.getId());
            int pagosRestantes = c.getPlazoDias() - (int) realizados;
            BigDecimal saldoPendiente = c.getPagoPeriodico()
                    .multiply(BigDecimal.valueOf(Math.max(pagosRestantes, 0)))
                    .setScale(2, RoundingMode.HALF_UP);

            montoTotalColocado = montoTotalColocado.add(c.getMontoCapital());

            if (enMora) {
                totalEnMora++;
                montoEnRiesgo = montoEnRiesgo.add(saldoPendiente);
            }

            String clienteNombre = c.getCliente().getNombreCompleto() != null
                    ? c.getCliente().getNombreCompleto()
                    : c.getCliente().getNombre() + " " + c.getCliente().getApellidoPaterno();

            dtos.add(new CreditoActivoDTO(
                    c.getId(),
                    clienteNombre,
                    c.getAsesor().getNombreCompleto(),
                    c.getMontoCapital(),
                    (int) realizados,
                    c.getPlazoDias(),
                    saldoPendiente,
                    coalesce(multasPendientes),
                    enMora));
        }

        // Filtrar por estado de mora si se especificó
        List<CreditoActivoDTO> filtrados = switch (estado) {
            case "EN_MORA" -> dtos.stream().filter(CreditoActivoDTO::enMora).toList();
            case "AL_CORRIENTE" -> dtos.stream().filter(d -> !d.enMora()).toList();
            default -> dtos;
        };

        return new ReporteCarteraDTO(
                activos.size(),
                montoTotalColocado,
                totalEnMora,
                montoEnRiesgo,
                filtrados);
    }

    // ── Por Asesor ───────────────────────────────────────────────────────

    public ReportePorAsesorDTO getPorAsesor(Long sucursalId,
                                             LocalDate desde,
                                             LocalDate hasta,
                                             Long asesorId) {
        LocalDate hoy = LocalDate.now(MAGNO_ZONE);

        List<Usuario> usuarios = usuarioRepo.findBySucursalId(sucursalId).stream()
                .filter(u -> u.getRol() != null && ROLES_CAMPO.contains(u.getRol().getNombre()))
                .filter(u -> asesorId == null || u.getId().equals(asesorId))
                .toList();

        List<AsesorResumenDTO> resúmenes = new ArrayList<>();

        long totalCobrosRegistrados = 0;
        BigDecimal totalMontoCobrado = BigDecimal.ZERO;
        BigDecimal totalMultasCobradas = BigDecimal.ZERO;
        int totalClientesActivos = 0;
        BigDecimal totalMontoColocado = BigDecimal.ZERO;
        int totalClientesEnMora = 0;

        for (Usuario u : usuarios) {
            // Cobranza del período
            long cobros = pagoRepo.countByAsesorAndFechaRange(u.getId(), desde, hasta);
            BigDecimal montoCobrado = pagoRepo.sumMontoCobradoByAsesorAndFechaRange(u.getId(), desde, hasta);
            BigDecimal multasCobradas = multaRepo.sumMultasCobradaByAsesorAndFechaRange(u.getId(), desde, hasta);
            long pagosIncompletos = pagoRepo.countIncompletosByAsesorAndFechaRange(u.getId(), desde, hasta);

            // Cartera activa
            List<Credito> creditosActivos = creditoRepo.findActivosBySucursalAndAsesor(sucursalId, u.getId());
            int enMoraCount = 0;
            BigDecimal riesgo = BigDecimal.ZERO;
            BigDecimal colocado = BigDecimal.ZERO;

            for (Credito c : creditosActivos) {
                colocado = colocado.add(c.getMontoCapital());
                long atrasados = calendarioRepo.countAtrasadosByCreditoId(c.getId(), hoy);
                if (atrasados > 0) {
                    enMoraCount++;
                    long realizados = calendarioRepo.countRealizadosByCreditoId(c.getId());
                    int restantes = c.getPlazoDias() - (int) realizados;
                    riesgo = riesgo.add(c.getPagoPeriodico()
                            .multiply(BigDecimal.valueOf(Math.max(restantes, 0)))
                            .setScale(2, RoundingMode.HALF_UP));
                }
            }

            resúmenes.add(new AsesorResumenDTO(
                    u.getId(), u.getNombreCompleto(),
                    cobros, coalesce(montoCobrado), coalesce(multasCobradas), pagosIncompletos,
                    creditosActivos.size(), colocado, enMoraCount, riesgo));

            totalCobrosRegistrados += cobros;
            totalMontoCobrado = totalMontoCobrado.add(coalesce(montoCobrado));
            totalMultasCobradas = totalMultasCobradas.add(coalesce(multasCobradas));
            totalClientesActivos += creditosActivos.size();
            totalMontoColocado = totalMontoColocado.add(colocado);
            totalClientesEnMora += enMoraCount;
        }

        return new ReportePorAsesorDTO(
                resúmenes,
                totalCobrosRegistrados,
                totalMontoCobrado,
                totalMultasCobradas,
                totalClientesActivos,
                totalMontoColocado,
                totalClientesEnMora);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private BigDecimal coalesce(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}
```

- [ ] **Step 2: Correr los tests para verificar que pasan**

```bash
cd backend && ./mvnw test -pl . -Dtest=ReporteServiceTest -q 2>&1 | tail -20
```
Esperado: `Tests run: 4, Failures: 0, Errors: 0`

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/magno/service/ReporteService.java
git commit -m "feat(reportes): implement ReporteService data methods"
```

---

## Task 5: ReporteService — métodos PDF

**Files:**
- Modify: `backend/src/main/java/com/magno/service/ReporteService.java`

- [ ] **Step 1: Agregar imports de iText 8 al inicio de ReporteService**

Agregar estos imports (después del `package` y antes de los imports actuales):

```java
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.magno.dto.renovacion.ColocacionItemDTO;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
```

- [ ] **Step 2: Agregar los 4 métodos PDF + helpers al final de ReporteService (antes del `}` de cierre de la clase)**

```java
    // ── PDF Ingresos/Egresos ─────────────────────────────────────────────

    public byte[] exportarIngresosEgresosPdf(Long sucursalId, LocalDate desde, LocalDate hasta) {
        ReporteIngresosEgresosDTO datos = getIngresosEgresos(sucursalId, desde, hasta);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdf = new PdfDocument(writer);
        Document doc = new Document(pdf);

        doc.add(pdfHeader("MAGNO — Reporte de Ingresos y Egresos"));
        doc.add(pdfSubtitle("Período: " + desde.format(fmt) + " al " + hasta.format(fmt)));
        doc.add(new Paragraph(" "));

        // Cards de totales
        doc.add(new Paragraph("Total Ingresos Carteras: " + fmtMonto(datos.totalIngresoCarteras())).setFontSize(10));
        doc.add(new Paragraph("Total Desembolsos: " + fmtMonto(datos.totalDesembolsos())).setFontSize(10));
        doc.add(new Paragraph("Total Gastos: " + fmtMonto(datos.totalGastos())).setFontSize(10));
        doc.add(new Paragraph("Subtotal Neto: " + fmtMonto(datos.subtotalNeto())).setBold().setFontSize(11));
        doc.add(new Paragraph(" "));

        doc.add(sectionHeader("DETALLE POR DÍA"));
        Table t = new Table(UnitValue.createPercentArray(new float[]{70, 80, 80, 60, 70, 80}))
                .setWidth(UnitValue.createPercentValue(100));
        t.addHeaderCell(hCell("Fecha"));
        t.addHeaderCell(hCell("Ing. Carteras").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Desembolsos").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Gastos").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Inversiones").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Subtotal").setTextAlignment(TextAlignment.RIGHT));

        for (FilaDiariaDTO f : datos.filas()) {
            t.addCell(cell(f.fecha().format(fmt)));
            t.addCell(cell(fmtMonto(f.ingresoCarteras())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.desembolsos())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.gastos())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.inversiones())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(f.subtotalCaja())).setTextAlignment(TextAlignment.RIGHT));
        }
        doc.add(t);

        doc.close();
        return baos.toByteArray();
    }

    // ── PDF Colocaciones ─────────────────────────────────────────────────

    public byte[] exportarColocacionesPdf(Long sucursalId, LocalDate desde, LocalDate hasta, Long asesorId) {
        ReporteColocacionesDTO datos = getColocaciones(sucursalId, desde, hasta, asesorId);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(new PdfDocument(new PdfWriter(baos)));

        doc.add(pdfHeader("MAGNO — Reporte de Colocaciones"));
        doc.add(pdfSubtitle("Período: " + desde.format(fmt) + " al " + hasta.format(fmt)));
        doc.add(new Paragraph(" "));

        Table t = new Table(UnitValue.createPercentArray(new float[]{55, 110, 70, 70, 70, 70, 80, 50}))
                .setWidth(UnitValue.createPercentValue(100));
        t.addHeaderCell(hCell("Fecha"));
        t.addHeaderCell(hCell("Cliente"));
        t.addHeaderCell(hCell("Cto. Anterior").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Cto. Nuevo").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Desembolso").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Pago"));
        t.addHeaderCell(hCell("Asesor"));
        t.addHeaderCell(hCell("Tipo"));

        for (ColocacionItemDTO item : datos.items()) {
            t.addCell(cell(item.fecha().format(fmt)));
            t.addCell(cell(item.clienteNombre()));
            t.addCell(cell(item.creditoAnterior() != null ? fmtMonto(item.creditoAnterior()) : "—").setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(item.creditoNuevo())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(item.desembolso())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(item.tipoPago()));
            t.addCell(cell(item.asesorNombre()));
            t.addCell(cell(item.tipo()));
        }
        doc.add(t);

        doc.add(new Paragraph(" "));
        doc.add(new Paragraph("Total Desembolsos: " + fmtMonto(datos.totalDesembolsos())).setBold().setFontSize(10));
        doc.add(new Paragraph("Total Caja: " + fmtMonto(datos.totalCaja())).setBold().setFontSize(10));

        doc.close();
        return baos.toByteArray();
    }

    // ── PDF Cartera ──────────────────────────────────────────────────────

    public byte[] exportarCarteraPdf(Long sucursalId, Long asesorId, String estado) {
        ReporteCarteraDTO datos = getCartera(sucursalId, asesorId, estado);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(new PdfDocument(new PdfWriter(baos)));

        doc.add(pdfHeader("MAGNO — Reporte de Cartera"));
        doc.add(new Paragraph(" "));

        doc.add(new Paragraph("Total créditos activos: " + datos.totalCreditosActivos()).setFontSize(10));
        doc.add(new Paragraph("Monto total colocado: " + fmtMonto(datos.montoTotalColocado())).setFontSize(10));
        doc.add(new Paragraph("Créditos en mora: " + datos.creditosEnMora()).setFontSize(10));
        doc.add(new Paragraph("Monto en riesgo: " + fmtMonto(datos.montoEnRiesgo())).setFontSize(10));
        doc.add(new Paragraph(" "));

        doc.add(sectionHeader("DETALLE DE CRÉDITOS"));
        Table t = new Table(UnitValue.createPercentArray(new float[]{120, 90, 70, 50, 70, 60, 55}))
                .setWidth(UnitValue.createPercentValue(100));
        t.addHeaderCell(hCell("Cliente"));
        t.addHeaderCell(hCell("Asesor"));
        t.addHeaderCell(hCell("Monto").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Pagos"));
        t.addHeaderCell(hCell("Saldo Pend.").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Multas").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Estado"));

        for (CreditoActivoDTO c : datos.creditos()) {
            t.addCell(cell(c.clienteNombre()));
            t.addCell(cell(c.asesorNombre()));
            t.addCell(cell(fmtMonto(c.montoCapital())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(c.pagosRealizados() + "/" + c.pagosTotal()));
            t.addCell(cell(fmtMonto(c.saldoPendiente())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(c.multasPendientes())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(c.enMora() ? "En mora" : "Al corriente"));
        }
        doc.add(t);

        doc.close();
        return baos.toByteArray();
    }

    // ── PDF Por Asesor ───────────────────────────────────────────────────

    public byte[] exportarPorAsesorPdf(Long sucursalId, LocalDate desde, LocalDate hasta, Long asesorId) {
        ReportePorAsesorDTO datos = getPorAsesor(sucursalId, desde, hasta, asesorId);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Document doc = new Document(new PdfDocument(new PdfWriter(baos)));

        doc.add(pdfHeader("MAGNO — Reporte Por Asesor"));
        doc.add(pdfSubtitle("Período: " + desde.format(fmt) + " al " + hasta.format(fmt)));
        doc.add(new Paragraph(" "));

        Table t = new Table(UnitValue.createPercentArray(new float[]{90, 50, 75, 75, 45, 50, 75, 45, 75}))
                .setWidth(UnitValue.createPercentValue(100));
        t.addHeaderCell(hCell("Asesor"));
        t.addHeaderCell(hCell("Cobros").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Mto. Cobrado").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Multas Cob.").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Incompletos").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Cli. Activos").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("Colocado").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("En Mora").setTextAlignment(TextAlignment.RIGHT));
        t.addHeaderCell(hCell("En Riesgo").setTextAlignment(TextAlignment.RIGHT));

        for (AsesorResumenDTO a : datos.asesores()) {
            t.addCell(cell(a.asesorNombre()));
            t.addCell(cell(String.valueOf(a.cobrosRegistrados())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(a.montoCobrado())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(a.multasCobradas())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(String.valueOf(a.pagosIncompletos())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(String.valueOf(a.clientesActivos())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(a.montoTotalColocado())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(String.valueOf(a.clientesEnMora())).setTextAlignment(TextAlignment.RIGHT));
            t.addCell(cell(fmtMonto(a.montoEnRiesgo())).setTextAlignment(TextAlignment.RIGHT));
        }
        doc.add(t);

        doc.add(new Paragraph(" "));
        doc.add(new Paragraph("Totales — Cobros: " + datos.totalCobrosRegistrados()
                + " | Cobrado: " + fmtMonto(datos.totalMontoCobrado())
                + " | Clientes activos: " + datos.totalClientesActivos()
                + " | En mora: " + datos.totalClientesEnMora())
                .setBold().setFontSize(9));

        doc.close();
        return baos.toByteArray();
    }

    // ── Helpers PDF ──────────────────────────────────────────────────────

    private Paragraph pdfHeader(String text) {
        return new Paragraph(text).setBold().setFontSize(14).setTextAlignment(TextAlignment.CENTER);
    }

    private Paragraph pdfSubtitle(String text) {
        return new Paragraph(text).setFontSize(10).setTextAlignment(TextAlignment.CENTER);
    }

    private Paragraph sectionHeader(String text) {
        return new Paragraph(text).setBold().setFontSize(10)
                .setBackgroundColor(ColorConstants.LIGHT_GRAY).setMarginTop(8);
    }

    private Cell hCell(String text) {
        return new Cell().add(new Paragraph(text).setBold().setFontSize(8))
                .setBackgroundColor(ColorConstants.LIGHT_GRAY);
    }

    private Cell cell(String text) {
        return new Cell().add(new Paragraph(text != null ? text : "—").setFontSize(8));
    }

    private String fmtMonto(BigDecimal value) {
        if (value == null) return "$0.00";
        return "$" + String.format("%,.2f", value);
    }
```

- [ ] **Step 2: Compilar**

```bash
cd backend && ./mvnw compile -q
```
Esperado: BUILD SUCCESS

- [ ] **Step 3: Correr todos los tests**

```bash
cd backend && ./mvnw test -pl . -Dtest=ReporteServiceTest -q 2>&1 | tail -10
```
Esperado: `Tests run: 4, Failures: 0, Errors: 0`

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/service/ReporteService.java
git commit -m "feat(reportes): implement ReporteService PDF methods with iText 8"
```

---

## Task 6: ReporteController

**Files:**
- Create: `backend/src/main/java/com/magno/controller/ReporteController.java`

- [ ] **Step 1: Crear el controller**

`backend/src/main/java/com/magno/controller/ReporteController.java`:

```java
package com.magno.controller;

import com.magno.dto.reporte.*;
import com.magno.security.JwtPrincipal;
import com.magno.service.ReporteService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/reportes")
@PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
public class ReporteController {

    private final ReporteService reporteService;

    public ReporteController(ReporteService reporteService) {
        this.reporteService = reporteService;
    }

    // ── Ingresos/Egresos ─────────────────────────────────────────────────

    @GetMapping("/ingresos-egresos")
    public ResponseEntity<ReporteIngresosEgresosDTO> ingresosEgresos(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        return ResponseEntity.ok(reporteService.getIngresosEgresos(sid, desde, hasta));
    }

    @GetMapping("/ingresos-egresos/pdf")
    public ResponseEntity<byte[]> ingresosEgresosPdf(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        byte[] pdf = reporteService.exportarIngresosEgresosPdf(sid, desde, hasta);
        return pdfResponse(pdf, "ingresos-egresos-" + desde + "-" + hasta + ".pdf");
    }

    // ── Colocaciones ─────────────────────────────────────────────────────

    @GetMapping("/colocaciones")
    public ResponseEntity<ReporteColocacionesDTO> colocaciones(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) Long asesorId,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        return ResponseEntity.ok(reporteService.getColocaciones(sid, desde, hasta, asesorId));
    }

    @GetMapping("/colocaciones/pdf")
    public ResponseEntity<byte[]> colocacionesPdf(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) Long asesorId,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        byte[] pdf = reporteService.exportarColocacionesPdf(sid, desde, hasta, asesorId);
        return pdfResponse(pdf, "colocaciones-" + desde + "-" + hasta + ".pdf");
    }

    // ── Cartera ──────────────────────────────────────────────────────────

    @GetMapping("/cartera")
    public ResponseEntity<ReporteCarteraDTO> cartera(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(defaultValue = "TODOS") String estado,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        return ResponseEntity.ok(reporteService.getCartera(sid, asesorId, estado));
    }

    @GetMapping("/cartera/pdf")
    public ResponseEntity<byte[]> carteraPdf(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam(required = false) Long asesorId,
            @RequestParam(defaultValue = "TODOS") String estado,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        byte[] pdf = reporteService.exportarCarteraPdf(sid, asesorId, estado);
        return pdfResponse(pdf, "cartera.pdf");
    }

    // ── Por Asesor ───────────────────────────────────────────────────────

    @GetMapping("/por-asesor")
    public ResponseEntity<ReportePorAsesorDTO> porAsesor(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) Long asesorId,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        return ResponseEntity.ok(reporteService.getPorAsesor(sid, desde, hasta, asesorId));
    }

    @GetMapping("/por-asesor/pdf")
    public ResponseEntity<byte[]> porAsesorPdf(
            @RequestParam(required = false) Long sucursalId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) Long asesorId,
            Authentication auth) {
        Long sid = effectiveSucursalId(sucursalId, principal(auth));
        byte[] pdf = reporteService.exportarPorAsesorPdf(sid, desde, hasta, asesorId);
        return pdfResponse(pdf, "por-asesor-" + desde + "-" + hasta + ".pdf");
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private Long effectiveSucursalId(Long requestId, JwtPrincipal principal) {
        if ("ADMINISTRADOR".equals(principal.rol()) && requestId != null) {
            return requestId;
        }
        return principal.sucursalId();
    }

    private JwtPrincipal principal(Authentication auth) {
        return (JwtPrincipal) auth.getPrincipal();
    }

    private ResponseEntity<byte[]> pdfResponse(byte[] pdf, String filename) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        return ResponseEntity.ok().headers(headers).body(pdf);
    }
}
```

- [ ] **Step 2: Compilar**

```bash
cd backend && ./mvnw compile -q
```
Esperado: BUILD SUCCESS

- [ ] **Step 3: Correr todos los tests del proyecto**

```bash
cd backend && ./mvnw test -q 2>&1 | tail -10
```
Esperado: BUILD SUCCESS sin nuevos failures

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/controller/ReporteController.java
git commit -m "feat(reportes): add ReporteController with 8 endpoints"
```

---

## Task 7: Frontend — tipos y reporteService.ts

**Files:**
- Create: `frontend/src/services/reporteService.ts`

- [ ] **Step 1: Crear reporteService.ts**

`frontend/src/services/reporteService.ts`:

```typescript
import { api } from '@/services/api'

// ── Tipos ────────────────────────────────────────────────────────────────

export interface FilaDiaria {
  fecha: string
  ingresoCarteras: number
  desembolsos: number
  gastos: number
  inversiones: number
  subtotalCaja: number
}

export interface ReporteIngresosEgresos {
  filas: FilaDiaria[]
  totalIngresoCarteras: number
  totalDesembolsos: number
  totalGastos: number
  subtotalNeto: number
}

export interface ColocacionFila {
  fecha: string
  clienteNombre: string
  clienteId: number
  creditoAnterior: number | null
  creditoNuevo: number
  desembolso: number
  asesorNombre: string
  tipoPago: string
  tipo: string
  refId: number
}

export interface ReporteColocaciones {
  items: ColocacionFila[]
  totalDesembolsos: number
  totalCaja: number
}

export interface CreditoActivo {
  creditoId: number
  clienteNombre: string
  asesorNombre: string
  montoCapital: number
  pagosRealizados: number
  pagosTotal: number
  saldoPendiente: number
  multasPendientes: number
  enMora: boolean
}

export interface ReporteCartera {
  totalCreditosActivos: number
  montoTotalColocado: number
  creditosEnMora: number
  montoEnRiesgo: number
  creditos: CreditoActivo[]
}

export interface AsesorResumen {
  asesorId: number
  asesorNombre: string
  cobrosRegistrados: number
  montoCobrado: number
  multasCobradas: number
  pagosIncompletos: number
  clientesActivos: number
  montoTotalColocado: number
  clientesEnMora: number
  montoEnRiesgo: number
}

export interface ReportePorAsesor {
  asesores: AsesorResumen[]
  totalCobrosRegistrados: number
  totalMontoCobrado: number
  totalMultasCobradas: number
  totalClientesActivos: number
  totalMontoColocado: number
  totalClientesEnMora: number
}

export interface Sucursal {
  id: number
  nombre: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

function norm(raw: any): any {
  if (Array.isArray(raw)) return raw.map(norm)
  if (raw && typeof raw === 'object') {
    const out: any = {}
    for (const [k, v] of Object.entries(raw)) {
      const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      out[camel] = norm(v)
    }
    return out
  }
  return raw
}

async function downloadPdf(url: string, params: Record<string, any>, filename: string) {
  const response = await api.get(url, { params, responseType: 'blob' })
  const href = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

// ── Servicio ──────────────────────────────────────────────────────────────

export const reporteService = {
  getSucursales: (): Promise<Sucursal[]> =>
    api.get<any[]>('/sucursales').then(r => r.data.map((s: any) => ({ id: s.id, nombre: s.nombre }))),

  getIngresosEgresos: (sucursalId: number, desde: string, hasta: string): Promise<ReporteIngresosEgresos> =>
    api.get<any>('/reportes/ingresos-egresos', { params: { sucursalId, desde, hasta } })
      .then(r => norm(r.data) as ReporteIngresosEgresos),

  exportIngresosEgresosPdf: (sucursalId: number, desde: string, hasta: string) =>
    downloadPdf('/reportes/ingresos-egresos/pdf', { sucursalId, desde, hasta },
      `ingresos-egresos-${desde}-${hasta}.pdf`),

  getColocaciones: (sucursalId: number, desde: string, hasta: string, asesorId?: number): Promise<ReporteColocaciones> =>
    api.get<any>('/reportes/colocaciones', { params: { sucursalId, desde, hasta, asesorId } })
      .then(r => norm(r.data) as ReporteColocaciones),

  exportColocacionesPdf: (sucursalId: number, desde: string, hasta: string, asesorId?: number) =>
    downloadPdf('/reportes/colocaciones/pdf', { sucursalId, desde, hasta, asesorId },
      `colocaciones-${desde}-${hasta}.pdf`),

  getCartera: (sucursalId: number, asesorId?: number, estado = 'TODOS'): Promise<ReporteCartera> =>
    api.get<any>('/reportes/cartera', { params: { sucursalId, asesorId, estado } })
      .then(r => norm(r.data) as ReporteCartera),

  exportCarteraPdf: (sucursalId: number, asesorId?: number, estado = 'TODOS') =>
    downloadPdf('/reportes/cartera/pdf', { sucursalId, asesorId, estado }, 'cartera.pdf'),

  getPorAsesor: (sucursalId: number, desde: string, hasta: string, asesorId?: number): Promise<ReportePorAsesor> =>
    api.get<any>('/reportes/por-asesor', { params: { sucursalId, desde, hasta, asesorId } })
      .then(r => norm(r.data) as ReportePorAsesor),

  exportPorAsesorPdf: (sucursalId: number, desde: string, hasta: string, asesorId?: number) =>
    downloadPdf('/reportes/por-asesor/pdf', { sucursalId, desde, hasta, asesorId },
      `por-asesor-${desde}-${hasta}.pdf`),
}
```

- [ ] **Step 2: Verificar que TypeScript compila**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/reporteService.ts
git commit -m "feat(reportes): add reporteService.ts with types and API calls"
```

---

## Task 8: Frontend — componentes compartidos

**Files:**
- Create: `frontend/src/components/reportes/MetricCard.tsx`
- Create: `frontend/src/components/reportes/FiltroFechas.tsx`
- Create: `frontend/src/components/reportes/ExportPdfButton.tsx`
- Create: `frontend/src/components/reportes/SucursalSelector.tsx`

- [ ] **Step 1: Crear MetricCard.tsx**

`frontend/src/components/reportes/MetricCard.tsx`:

```tsx
interface MetricCardProps {
  label: string
  value: string
  colorClass: string // e.g. 'bg-emerald-50 border-emerald-300 text-emerald-800'
}

export default function MetricCard({ label, value, colorClass }: MetricCardProps) {
  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}
```

- [ ] **Step 2: Crear FiltroFechas.tsx**

`frontend/src/components/reportes/FiltroFechas.tsx`:

```tsx
interface FiltroFechasProps {
  desde: string
  hasta: string
  onDesdeChange: (v: string) => void
  onHastaChange: (v: string) => void
  onGenerar: () => void
  loading?: boolean
}

export default function FiltroFechas({
  desde, hasta, onDesdeChange, onHastaChange, onGenerar, loading
}: FiltroFechasProps) {
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
        <input
          type="date"
          value={desde}
          onChange={e => onDesdeChange(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
        <input
          type="date"
          value={hasta}
          onChange={e => onHastaChange(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <button
        onClick={onGenerar}
        disabled={loading}
        className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? 'Cargando...' : 'Generar reporte'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Crear ExportPdfButton.tsx**

`frontend/src/components/reportes/ExportPdfButton.tsx`:

```tsx
import { useState } from 'react'
import { Download } from 'lucide-react'

interface ExportPdfButtonProps {
  onExport: () => Promise<void>
  disabled?: boolean
}

export default function ExportPdfButton({ onExport, disabled }: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      await onExport()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-2 px-4 py-2 border border-emerald-600 text-emerald-700 rounded text-sm font-medium hover:bg-emerald-50 disabled:opacity-40"
    >
      <Download className="w-4 h-4" />
      {loading ? 'Exportando...' : 'Exportar PDF'}
    </button>
  )
}
```

- [ ] **Step 4: Crear SucursalSelector.tsx**

`frontend/src/components/reportes/SucursalSelector.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { reporteService, type Sucursal } from '@/services/reporteService'

interface SucursalSelectorProps {
  sucursalId: number | null
  onChange: (id: number) => void
  readonly?: boolean
  readonlyNombre?: string
}

export default function SucursalSelector({
  sucursalId, onChange, readonly, readonlyNombre
}: SucursalSelectorProps) {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])

  useEffect(() => {
    if (!readonly) {
      reporteService.getSucursales().then(list => {
        setSucursales(list)
        if (list.length > 0 && sucursalId === null) {
          onChange(list[0].id)
        }
      })
    }
  }, [readonly])

  if (readonly) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span className="font-medium">Sucursal:</span>
        <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-medium">
          {readonlyNombre ?? '—'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700">Sucursal:</label>
      <select
        value={sucursalId ?? ''}
        onChange={e => onChange(Number(e.target.value))}
        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {sucursales.map(s => (
          <option key={s.id} value={s.id}>{s.nombre}</option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/reportes/
git commit -m "feat(reportes): add shared components MetricCard, FiltroFechas, ExportPdfButton, SucursalSelector"
```

---

## Task 9: Frontend — TabIngresosEgresos

**Files:**
- Create: `frontend/src/pages/reportes/TabIngresosEgresos.tsx`

- [ ] **Step 1: Crear TabIngresosEgresos.tsx**

`frontend/src/pages/reportes/TabIngresosEgresos.tsx`:

```tsx
import { useState } from 'react'
import MetricCard from '@/components/reportes/MetricCard'
import FiltroFechas from '@/components/reportes/FiltroFechas'
import ExportPdfButton from '@/components/reportes/ExportPdfButton'
import { reporteService, type ReporteIngresosEgresos } from '@/services/reporteService'

function mesActual() {
  const hoy = new Date()
  const y = hoy.getFullYear()
  const m = String(hoy.getMonth() + 1).padStart(2, '0')
  return { desde: `${y}-${m}-01`, hasta: hoy.toISOString().split('T')[0] }
}

function fmt(n: number | null | undefined) {
  if (n == null) return '$0'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface Props { sucursalId: number | null }

export default function TabIngresosEgresos({ sucursalId }: Props) {
  const { desde: d0, hasta: h0 } = mesActual()
  const [desde, setDesde] = useState(d0)
  const [hasta, setHasta] = useState(h0)
  const [data, setData] = useState<ReporteIngresosEgresos | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  async function generar() {
    if (!sucursalId) return
    setLoading(true)
    try {
      const result = await reporteService.getIngresosEgresos(sucursalId, desde, hasta)
      setData(result)
      setGenerated(true)
    } finally {
      setLoading(false)
    }
  }

  const neto = data?.subtotalNeto ?? 0
  const netoColor = neto >= 0
    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
    : 'bg-red-50 border-red-300 text-red-800'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FiltroFechas
          desde={desde} hasta={hasta}
          onDesdeChange={setDesde} onHastaChange={setHasta}
          onGenerar={generar} loading={loading}
        />
        {generated && (
          <ExportPdfButton
            onExport={() => reporteService.exportIngresosEgresosPdf(sucursalId!, desde, hasta)}
            disabled={!data}
          />
        )}
      </div>

      {generated && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Total Ingresos Carteras" value={fmt(data.totalIngresoCarteras)}
              colorClass="bg-emerald-50 border-emerald-300 text-emerald-800" />
            <MetricCard label="Total Desembolsos" value={fmt(data.totalDesembolsos)}
              colorClass="bg-blue-50 border-blue-300 text-blue-800" />
            <MetricCard label="Total Gastos" value={fmt(data.totalGastos)}
              colorClass="bg-amber-50 border-amber-300 text-amber-800" />
            <MetricCard label="Subtotal Neto" value={fmt(neto)} colorClass={netoColor} />
          </div>

          {data.filas.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No hay datos para el período seleccionado</p>
              <button onClick={generar} className="mt-2 text-emerald-600 text-sm underline">Cambiar filtros</button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-right">Ing. Carteras</th>
                    <th className="px-4 py-3 text-right">Desembolsos</th>
                    <th className="px-4 py-3 text-right">Gastos</th>
                    <th className="px-4 py-3 text-right">Inversiones</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.filas.map((f, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{fmt(f.ingresoCarteras)}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{fmt(f.desembolsos)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{fmt(f.gastos)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmt(f.inversiones)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmt(f.subtotalCaja)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-100 font-semibold text-emerald-900 text-sm">
                  <tr>
                    <td className="px-4 py-3">TOTALES</td>
                    <td className="px-4 py-3 text-right">{fmt(data.totalIngresoCarteras)}</td>
                    <td className="px-4 py-3 text-right">{fmt(data.totalDesembolsos)}</td>
                    <td className="px-4 py-3 text-right">{fmt(data.totalGastos)}</td>
                    <td className="px-4 py-3 text-right">—</td>
                    <td className={`px-4 py-3 text-right ${neto < 0 ? 'text-red-700' : ''}`}>{fmt(neto)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/reportes/TabIngresosEgresos.tsx
git commit -m "feat(reportes): add TabIngresosEgresos component"
```

---

## Task 10: Frontend — TabColocaciones

**Files:**
- Create: `frontend/src/pages/reportes/TabColocaciones.tsx`

- [ ] **Step 1: Crear TabColocaciones.tsx**

`frontend/src/pages/reportes/TabColocaciones.tsx`:

```tsx
import { useState } from 'react'
import FiltroFechas from '@/components/reportes/FiltroFechas'
import ExportPdfButton from '@/components/reportes/ExportPdfButton'
import { reporteService, type ReporteColocaciones } from '@/services/reporteService'

function lunesDeHoy() {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const BASE = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'

function TipoBadge({ tipo }: { tipo: string }) {
  return tipo === 'RENOVACION'
    ? <span className={`${BASE} bg-blue-100 text-blue-700`}>Renovación</span>
    : <span className={`${BASE} bg-emerald-100 text-emerald-800`}>Crédito Nuevo</span>
}

function PagoBadge({ tipoPago }: { tipoPago: string }) {
  return tipoPago === 'SEMANAL'
    ? <span className={`${BASE} bg-blue-100 text-blue-700`}>Semanal</span>
    : <span className={`${BASE} bg-gray-100 text-gray-700`}>Diario</span>
}

interface Props { sucursalId: number | null }

export default function TabColocaciones({ sucursalId }: Props) {
  const [desde, setDesde] = useState(lunesDeHoy)
  const [hasta, setHasta] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData] = useState<ReporteColocaciones | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  async function generar() {
    if (!sucursalId) return
    setLoading(true)
    try {
      const result = await reporteService.getColocaciones(sucursalId, desde, hasta)
      setData(result)
      setGenerated(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FiltroFechas
          desde={desde} hasta={hasta}
          onDesdeChange={setDesde} onHastaChange={setHasta}
          onGenerar={generar} loading={loading}
        />
        {generated && (
          <ExportPdfButton
            onExport={() => reporteService.exportColocacionesPdf(sucursalId!, desde, hasta)}
            disabled={!data}
          />
        )}
      </div>

      {generated && data && (
        data.items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay colocaciones en ese período</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-right">Cto. Anterior</th>
                  <th className="px-4 py-3 text-right">Cto. Nuevo</th>
                  <th className="px-4 py-3 text-right">Desembolso</th>
                  <th className="px-4 py-3 text-left">Pago</th>
                  <th className="px-4 py-3 text-left">Asesor</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(item.fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</td>
                    <td className="px-4 py-3 font-medium">{item.clienteNombre}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(item.creditoAnterior)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(item.creditoNuevo)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-semibold">{fmt(item.desembolso)}</td>
                    <td className="px-4 py-3"><PagoBadge tipoPago={item.tipoPago} /></td>
                    <td className="px-4 py-3 text-gray-600">{item.asesorNombre}</td>
                    <td className="px-4 py-3"><TipoBadge tipo={item.tipo} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-emerald-100 font-semibold text-emerald-900 text-sm">
                <tr>
                  <td colSpan={4} className="px-4 py-3">Total Desembolsos</td>
                  <td className="px-4 py-3 text-right">{fmt(data.totalDesembolsos)}</td>
                  <td colSpan={3} />
                </tr>
                <tr>
                  <td colSpan={4} className="px-4 py-3">Total Caja (Renovaciones)</td>
                  <td className="px-4 py-3 text-right">{fmt(data.totalCaja)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/reportes/TabColocaciones.tsx
git commit -m "feat(reportes): add TabColocaciones component"
```

---

## Task 11: Frontend — TabCartera

**Files:**
- Create: `frontend/src/pages/reportes/TabCartera.tsx`

- [ ] **Step 1: Crear TabCartera.tsx**

`frontend/src/pages/reportes/TabCartera.tsx`:

```tsx
import { useState } from 'react'
import MetricCard from '@/components/reportes/MetricCard'
import ExportPdfButton from '@/components/reportes/ExportPdfButton'
import { reporteService, type ReporteCartera } from '@/services/reporteService'

function fmt(n: number | null | undefined) {
  if (n == null) return '$0'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const ESTADOS = ['TODOS', 'AL_CORRIENTE', 'EN_MORA'] as const
type Estado = typeof ESTADOS[number]

const ESTADO_LABELS: Record<Estado, string> = {
  TODOS: 'Todos',
  AL_CORRIENTE: 'Al corriente',
  EN_MORA: 'En mora',
}

interface Props { sucursalId: number | null }

export default function TabCartera({ sucursalId }: Props) {
  const [estado, setEstado] = useState<Estado>('TODOS')
  const [data, setData] = useState<ReporteCartera | null>(null)
  const [loading, setLoading] = useState(false)

  async function generar(nuevoEstado?: Estado) {
    if (!sucursalId) return
    const est = nuevoEstado ?? estado
    setLoading(true)
    try {
      const result = await reporteService.getCartera(sucursalId, undefined, est)
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  function handleEstado(est: Estado) {
    setEstado(est)
    generar(est)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {ESTADOS.map(est => (
              <button
                key={est}
                onClick={() => handleEstado(est)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  estado === est
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {ESTADO_LABELS[est]}
              </button>
            ))}
          </div>
          <button
            onClick={() => generar()}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Generar reporte'}
          </button>
        </div>
        {data && (
          <ExportPdfButton
            onExport={() => reporteService.exportCarteraPdf(sucursalId!, undefined, estado)}
          />
        )}
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Total Créditos Activos" value={String(data.totalCreditosActivos)}
              colorClass="bg-emerald-50 border-emerald-300 text-emerald-800" />
            <MetricCard label="Monto Total Colocado" value={fmt(data.montoTotalColocado)}
              colorClass="bg-blue-50 border-blue-300 text-blue-800" />
            <MetricCard label="Créditos en Mora" value={String(data.creditosEnMora)}
              colorClass="bg-red-50 border-red-300 text-red-800" />
            <MetricCard label="Monto en Riesgo" value={fmt(data.montoEnRiesgo)}
              colorClass="bg-amber-50 border-amber-300 text-amber-800" />
          </div>

          {data.creditos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No hay créditos con ese filtro</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-left">Asesor</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-center">Pagos</th>
                    <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                    <th className="px-4 py-3 text-right">Multas Pend.</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.creditos.map(c => (
                    <tr key={c.creditoId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.clienteNombre}</td>
                      <td className="px-4 py-3 text-gray-600">{c.asesorNombre}</td>
                      <td className="px-4 py-3 text-right">{fmt(c.montoCapital)}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{c.pagosRealizados}/{c.pagosTotal}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmt(c.saldoPendiente)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{fmt(c.multasPendientes)}</td>
                      <td className="px-4 py-3 text-center">
                        {c.enMora
                          ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">En mora</span>
                          : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Al corriente</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-100 font-semibold text-emerald-900 text-sm">
                  <tr>
                    <td colSpan={2} className="px-4 py-3">TOTALES ({data.creditos.length} créditos)</td>
                    <td className="px-4 py-3 text-right">{fmt(data.montoTotalColocado)}</td>
                    <td />
                    <td className="px-4 py-3 text-right">{fmt(data.creditos.reduce((s, c) => s + c.saldoPendiente, 0))}</td>
                    <td className="px-4 py-3 text-right">{fmt(data.creditos.reduce((s, c) => s + c.multasPendientes, 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/reportes/TabCartera.tsx
git commit -m "feat(reportes): add TabCartera component"
```

---

## Task 12: Frontend — TabPorAsesor

**Files:**
- Create: `frontend/src/pages/reportes/TabPorAsesor.tsx`

- [ ] **Step 1: Crear TabPorAsesor.tsx**

`frontend/src/pages/reportes/TabPorAsesor.tsx`:

```tsx
import { useState } from 'react'
import FiltroFechas from '@/components/reportes/FiltroFechas'
import ExportPdfButton from '@/components/reportes/ExportPdfButton'
import { reporteService, type ReportePorAsesor, type AsesorResumen } from '@/services/reporteService'

function mesActual() {
  const hoy = new Date()
  const y = hoy.getFullYear()
  const m = String(hoy.getMonth() + 1).padStart(2, '0')
  return { desde: `${y}-${m}-01`, hasta: hoy.toISOString().split('T')[0] }
}

function fmt(n: number | null | undefined) {
  if (n == null) return '$0'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function AsesorCard({ a }: { a: AsesorResumen }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">{a.asesorNombre}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Bloque A — Cobranza */}
        <div className="p-4 bg-emerald-50 border-r border-gray-100">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-3">Cobranza del período</p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Cobros registrados</dt>
              <dd className="font-medium">{a.cobrosRegistrados}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Monto cobrado</dt>
              <dd className="font-semibold text-emerald-700">{fmt(a.montoCobrado)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Multas cobradas</dt>
              <dd className="font-medium">{fmt(a.multasCobradas)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Pagos incompletos</dt>
              <dd className={a.pagosIncompletos > 0 ? 'font-medium text-amber-700' : 'font-medium'}>{a.pagosIncompletos}</dd>
            </div>
          </dl>
        </div>
        {/* Bloque B — Cartera */}
        <div className="p-4 bg-blue-50">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Cartera activa</p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Clientes activos</dt>
              <dd className="font-medium">{a.clientesActivos}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Monto colocado</dt>
              <dd className="font-semibold text-blue-700">{fmt(a.montoTotalColocado)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Clientes en mora</dt>
              <dd className={a.clientesEnMora > 0 ? 'font-medium text-red-700' : 'font-medium'}>{a.clientesEnMora}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Monto en riesgo</dt>
              <dd className={a.montoEnRiesgo > 0 ? 'font-medium text-red-700' : 'font-medium'}>{fmt(a.montoEnRiesgo)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}

interface Props { sucursalId: number | null }

export default function TabPorAsesor({ sucursalId }: Props) {
  const { desde: d0, hasta: h0 } = mesActual()
  const [desde, setDesde] = useState(d0)
  const [hasta, setHasta] = useState(h0)
  const [data, setData] = useState<ReportePorAsesor | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  async function generar() {
    if (!sucursalId) return
    setLoading(true)
    try {
      const result = await reporteService.getPorAsesor(sucursalId, desde, hasta)
      setData(result)
      setGenerated(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FiltroFechas
          desde={desde} hasta={hasta}
          onDesdeChange={setDesde} onHastaChange={setHasta}
          onGenerar={generar} loading={loading}
        />
        {generated && (
          <ExportPdfButton
            onExport={() => reporteService.exportPorAsesorPdf(sucursalId!, desde, hasta)}
            disabled={!data}
          />
        )}
      </div>

      {generated && data && (
        <>
          <div className="space-y-4">
            {data.asesores.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No hay asesores con datos en ese período</div>
            ) : (
              data.asesores.map(a => <AsesorCard key={a.asesorId} a={a} />)
            )}
          </div>

          {data.asesores.length > 0 && (
            <div className="rounded-lg bg-emerald-100 border border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-900">
              <span className="mr-4">Total cobros: {data.totalCobrosRegistrados}</span>
              <span className="mr-4">Total cobrado: {fmt(data.totalMontoCobrado)}</span>
              <span className="mr-4">Clientes activos: {data.totalClientesActivos}</span>
              <span>En mora: {data.totalClientesEnMora}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/reportes/TabPorAsesor.tsx
git commit -m "feat(reportes): add TabPorAsesor component"
```

---

## Task 13: Frontend — ReportesPage y wire-up del router

**Files:**
- Create: `frontend/src/pages/reportes/ReportesPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Crear ReportesPage.tsx**

`frontend/src/pages/reportes/ReportesPage.tsx`:

```tsx
import { useState } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'
import SucursalSelector from '@/components/reportes/SucursalSelector'
import TabIngresosEgresos from '@/pages/reportes/TabIngresosEgresos'
import TabColocaciones from '@/pages/reportes/TabColocaciones'
import TabCartera from '@/pages/reportes/TabCartera'
import TabPorAsesor from '@/pages/reportes/TabPorAsesor'

type Tab = 'ingresos-egresos' | 'colocaciones' | 'cartera' | 'por-asesor'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ingresos-egresos', label: 'Ingresos/Egresos' },
  { id: 'colocaciones', label: 'Colocaciones' },
  { id: 'cartera', label: 'Cartera' },
  { id: 'por-asesor', label: 'Por Asesor' },
]

export default function ReportesPage() {
  const { usuario } = useAuthStore()
  const isAdmin = usuario?.rol === 'ADMINISTRADOR'
  const [activeTab, setActiveTab] = useState<Tab>('ingresos-egresos')
  const [sucursalId, setSucursalId] = useState<number | null>(
    isAdmin ? null : (usuario?.sucursal?.id ?? null)
  )

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <SucursalSelector
          sucursalId={sucursalId}
          onChange={setSucursalId}
          readonly={!isAdmin}
          readonlyNombre={usuario?.sucursal?.nombre}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido del tab activo */}
      <div className="min-h-[400px]">
        {activeTab === 'ingresos-egresos' && <TabIngresosEgresos sucursalId={sucursalId} />}
        {activeTab === 'colocaciones' && <TabColocaciones sucursalId={sucursalId} />}
        {activeTab === 'cartera' && <TabCartera sucursalId={sucursalId} />}
        {activeTab === 'por-asesor' && <TabPorAsesor sucursalId={sucursalId} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Registrar ReportesPage en App.tsx**

En `frontend/src/App.tsx`, agregar el import al inicio (junto al resto de imports de páginas):

```tsx
import ReportesPage from '@/pages/reportes/ReportesPage'
```

Reemplazar la línea existente:
```tsx
<Route path="/reportes" element={<ModulePlaceholderPage />} />
```
Por:
```tsx
<Route path="/reportes" element={<ReportesPage />} />
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Esperado: sin errores

- [ ] **Step 4: Levantar el frontend y verificar que la ruta carga**

```bash
cd frontend && npm run dev
```
Navegar a `http://localhost:5173/reportes`. Verificar:
- Las 4 pestañas aparecen y se pueden cambiar
- El selector de sucursal aparece para ADMINISTRADOR, fijo para SUPERVISOR
- Cada pestaña muestra el área de filtros
- "Generar reporte" activa el loading state

- [ ] **Step 5: Commit final**

```bash
git add frontend/src/pages/reportes/ReportesPage.tsx frontend/src/App.tsx
git commit -m "feat(reportes): add ReportesPage and wire up /reportes route"
```

---

## Checklist de verificación final

Antes de declarar el módulo completo, verificar:

- [ ] `GET /api/reportes/ingresos-egresos?sucursalId=1&desde=2026-04-01&hasta=2026-04-30` responde 200 con JSON
- [ ] `GET /api/reportes/ingresos-egresos/pdf?sucursalId=1&desde=2026-04-01&hasta=2026-04-30` devuelve un PDF descargable
- [ ] `GET /api/reportes/cartera?sucursalId=1` responde 200 con `totalCreditosActivos > 0`
- [ ] `GET /api/reportes/cartera?sucursalId=1&estado=EN_MORA` solo devuelve créditos en mora
- [ ] `GET /api/reportes/colocaciones?sucursalId=1&desde=2026-04-01&hasta=2026-04-30` responde 200
- [ ] `GET /api/reportes/por-asesor?sucursalId=1&desde=2026-04-01&hasta=2026-04-30` responde 200
- [ ] Un SUPERVISOR solo puede consultar su propia sucursal (401/403 si pasa sucursalId distinto)
- [ ] En la UI, "Exportar PDF" descarga el archivo con nombre correcto
- [ ] Estado vacío muestra mensaje apropiado (no pantalla en blanco)
- [ ] `./mvnw test` pasa sin errores
