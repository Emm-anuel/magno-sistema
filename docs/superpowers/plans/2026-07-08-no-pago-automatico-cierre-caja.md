# No pago automático al cerrar caja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al cerrar la caja del día, marcar automáticamente como "no pago" (con su multa) cualquier pago del calendario que ningún asesor haya registrado, y mostrar un aviso previo en el preview de cierre.

**Architecture:** Dos métodos nuevos en `CobrosService` (uno de solo lectura para el preview, uno transaccional que persiste) que encuentran créditos `ACTIVO` de la sucursal con un slot de calendario `PENDIENTE` en la fecha de la caja, generan el `Pago`/`Multa`/actualización de `CalendarioPago` reutilizando el mismo patrón que el flujo manual de "no pagó". `CajaService` los invoca desde `getPreviewCierre` (preview) y `cerrar` (persistencia real), sin tocar el modelo de datos ni los endpoints existentes.

**Tech Stack:** Spring Boot 3 / Java 17 (backend), React 18 + TypeScript (frontend), JUnit 5 + Mockito + AssertJ (tests backend), spec de referencia: `docs/superpowers/specs/2026-07-08-no-pago-automatico-cierre-caja-design.md`.

---

### Task 1: DTO `ClienteNoPagoAutomaticoDTO`

**Files:**
- Create: `backend/src/main/java/com/magno/dto/cobros/ClienteNoPagoAutomaticoDTO.java`

- [ ] **Step 1: Crear el DTO**

```java
package com.magno.dto.cobros;

import java.math.BigDecimal;

/**
 * Cliente cuyo pago del día quedó sin registrar y que el sistema
 * marca (o marcará) automáticamente como "no pago" al cerrar la caja.
 */
public record ClienteNoPagoAutomaticoDTO(
        Long clienteId,
        String nombreCompleto,
        Long creditoId,
        Integer numeroPago,
        BigDecimal montoMulta
) {
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd backend && mvn -q compile`
Expected: build sin errores (sin output con `-q`).

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/magno/dto/cobros/ClienteNoPagoAutomaticoDTO.java
git commit -m "feat: agregar DTO ClienteNoPagoAutomaticoDTO"
```

---

### Task 2: `CobrosService` — marcado automático de no pago

**Files:**
- Modify: `backend/src/main/java/com/magno/service/CobrosService.java:207` (justo después del cierre de `getRutaDia`, antes de la sección "Registrar pago")
- Test: `backend/src/test/java/com/magno/service/CobrosServiceTest.java`

- [ ] **Step 1: Agregar imports necesarios al test**

En `backend/src/test/java/com/magno/service/CobrosServiceTest.java`, el import `import com.magno.dto.cobros.RutaDiaDTO;` (línea 4) pasa a:

```java
import com.magno.dto.cobros.ClienteNoPagoAutomaticoDTO;
import com.magno.dto.cobros.ClienteRutaDTO;
import com.magno.dto.cobros.RutaDiaDTO;
```

Y el bloque de imports estáticos/utilidades (líneas 10-17) pasa a:

```java
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;
```

- [ ] **Step 2: Escribir los tests que fallan**

Agregar, antes de la llave de cierre final del archivo (después del test `creditoVencidoSinMultaPeroConPagoPendienteAtrasado_apareceEnRutaDiaComoVencido`, línea 150):

```java

    @Test
    void marcarNoPagoAutomatico_marcaPendienteComoNoPagoYGeneraMulta() {
        CalendarioPago pendienteHoy = CalendarioPago.builder()
                .id(7L)
                .numeroPago(5)
                .fechaProgramada(HOY)
                .montoEsperado(new BigDecimal("156.00"))
                .estado(EstadoCalendarioPago.PENDIENTE)
                .build();

        when(creditoRepo.findRutaDiaCreditosActivos(eq(1L), isNull(), eq(EstadoCredito.ACTIVO)))
                .thenReturn(List.of(credito));
        when(calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(42L)).thenReturn(List.of(pendienteHoy));
        when(configMultaRepo.findBySucursalAndMonto(1L, new BigDecimal("3000.00"))).thenReturn(Optional.empty());
        when(usuarioRepo.findById(10L)).thenReturn(Optional.of(asesor));

        List<ClienteNoPagoAutomaticoDTO> resultado = service.marcarNoPagoAutomatico(1L, HOY, 10L);

        assertThat(resultado).hasSize(1);
        ClienteNoPagoAutomaticoDTO dto = resultado.get(0);
        assertThat(dto.clienteId()).isEqualTo(5L);
        assertThat(dto.creditoId()).isEqualTo(42L);
        assertThat(dto.numeroPago()).isEqualTo(5);
        assertThat(dto.montoMulta()).isEqualByComparingTo(new BigDecimal("50.00"));

        ArgumentCaptor<Pago> pagoCaptor = ArgumentCaptor.forClass(Pago.class);
        verify(pagoRepo).save(pagoCaptor.capture());
        Pago pagoGuardado = pagoCaptor.getValue();
        assertThat(pagoGuardado.getMontoRecibido()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(pagoGuardado.getEsCompleto()).isFalse();
        assertThat(pagoGuardado.getRazonNoPago()).isEqualTo("Cierre de caja — sin registro de pago");
        assertThat(pagoGuardado.getMultaAplicada()).isEqualByComparingTo(new BigDecimal("50.00"));
        assertThat(pagoGuardado.getAsesor()).isEqualTo(asesor);
        assertThat(pagoGuardado.getRegistradoPor()).isEqualTo(asesor);

        ArgumentCaptor<CalendarioPago> cpCaptor = ArgumentCaptor.forClass(CalendarioPago.class);
        verify(calendarioPagoRepo).save(cpCaptor.capture());
        assertThat(cpCaptor.getValue().getEstado()).isEqualTo(EstadoCalendarioPago.NO_PAGADO);

        ArgumentCaptor<Multa> multaCaptor = ArgumentCaptor.forClass(Multa.class);
        verify(multaRepo).save(multaCaptor.capture());
        Multa multaGuardada = multaCaptor.getValue();
        assertThat(multaGuardada.getTipo()).isEqualTo("NO_PAGO");
        assertThat(multaGuardada.getMonto()).isEqualByComparingTo(new BigDecimal("50.00"));
        assertThat(multaGuardada.getCobrada()).isFalse();
    }

    @Test
    void marcarNoPagoAutomatico_sinSlotPendienteEseDia_noGeneraNada() {
        CalendarioPago yaPagado = CalendarioPago.builder()
                .id(7L)
                .numeroPago(5)
                .fechaProgramada(HOY)
                .montoEsperado(new BigDecimal("156.00"))
                .estado(EstadoCalendarioPago.PAGADO)
                .build();

        when(creditoRepo.findRutaDiaCreditosActivos(eq(1L), isNull(), eq(EstadoCredito.ACTIVO)))
                .thenReturn(List.of(credito));
        when(calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(42L)).thenReturn(List.of(yaPagado));

        List<ClienteNoPagoAutomaticoDTO> resultado = service.marcarNoPagoAutomatico(1L, HOY, 10L);

        assertThat(resultado).isEmpty();
        verify(pagoRepo, never()).save(any());
        verify(multaRepo, never()).save(any());
        verify(calendarioPagoRepo, never()).save(any());
        verify(usuarioRepo, never()).findById(any());
    }

    @Test
    void previsualizarNoPagoAutomatico_calculaSinPersistirNada() {
        CalendarioPago pendienteHoy = CalendarioPago.builder()
                .id(7L)
                .numeroPago(5)
                .fechaProgramada(HOY)
                .montoEsperado(new BigDecimal("156.00"))
                .estado(EstadoCalendarioPago.PENDIENTE)
                .build();

        when(creditoRepo.findRutaDiaCreditosActivos(eq(1L), isNull(), eq(EstadoCredito.ACTIVO)))
                .thenReturn(List.of(credito));
        when(calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(42L)).thenReturn(List.of(pendienteHoy));
        when(configMultaRepo.findBySucursalAndMonto(1L, new BigDecimal("3000.00"))).thenReturn(Optional.empty());

        List<ClienteNoPagoAutomaticoDTO> resultado = service.previsualizarNoPagoAutomatico(1L, HOY);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).montoMulta()).isEqualByComparingTo(new BigDecimal("50.00"));
        verify(pagoRepo, never()).save(any());
        verify(multaRepo, never()).save(any());
        verify(calendarioPagoRepo, never()).save(any());
        verify(usuarioRepo, never()).findById(any());
    }
```

También agregar el import de `ArgumentCaptor` junto a los demás imports de Mockito:

```java
import org.mockito.ArgumentCaptor;
```

- [ ] **Step 3: Ejecutar los tests y verificar que fallan**

Run: `cd backend && mvn -q -Dtest=CobrosServiceTest test`
Expected: FAIL — error de compilación, `service.marcarNoPagoAutomatico` y `service.previsualizarNoPagoAutomatico` no existen todavía en `CobrosService`.

- [ ] **Step 4: Implementar `CobrosService.marcarNoPagoAutomatico` y `previsualizarNoPagoAutomatico`**

En `backend/src/main/java/com/magno/service/CobrosService.java`, insertar la siguiente sección completa entre el cierre de `getRutaDia` (línea 207, `    }`) y el comentario `// ── Registrar pago ──` (línea 209):

```java
    // ────────────────────────────────────────────────────────────────────
    // No pago automático (cierre de caja)
    // ────────────────────────────────────────────────────────────────────

    private static final String RAZON_NO_PAGO_AUTOMATICO = "Cierre de caja — sin registro de pago";

    private record CandidatoNoPagoAutomatico(
            Credito credito, Cliente cliente, CalendarioPago calendarioPago, BigDecimal montoMulta) {
    }

    private List<CandidatoNoPagoAutomatico> buscarCandidatosNoPagoAutomatico(Long sucursalId, LocalDate fecha) {
        List<Credito> activos = creditoRepo.findRutaDiaCreditosActivos(sucursalId, null, EstadoCredito.ACTIVO);
        List<CandidatoNoPagoAutomatico> candidatos = new ArrayList<>();
        for (Credito credito : activos) {
            calendarioPagoRepo.findByCreditoIdOrderByNumeroPago(credito.getId()).stream()
                    .filter(cp -> cp.getFechaProgramada().equals(fecha)
                            && cp.getEstado() == EstadoCalendarioPago.PENDIENTE)
                    .findFirst()
                    .ifPresent(cp -> {
                        BigDecimal montoMulta = obtenerMontoMultaNoPago(
                                sucursalId, credito.getMontoCapital(), credito.getTipoPago());
                        candidatos.add(new CandidatoNoPagoAutomatico(
                                credito, credito.getCliente(), cp, montoMulta));
                    });
        }
        return candidatos;
    }

    /**
     * Vista previa de solo lectura: qué clientes se marcarían como no pago si se
     * cerrara la caja ahora mismo, sin persistir nada.
     */
    public List<ClienteNoPagoAutomaticoDTO> previsualizarNoPagoAutomatico(Long sucursalId, LocalDate fecha) {
        return buscarCandidatosNoPagoAutomatico(sucursalId, fecha).stream()
                .map(c -> new ClienteNoPagoAutomaticoDTO(
                        c.cliente().getId(),
                        c.cliente().getNombreCompleto(),
                        c.credito().getId(),
                        c.calendarioPago().getNumeroPago(),
                        c.montoMulta()))
                .toList();
    }

    /**
     * Marca como NO_PAGADO (con multa) cualquier pago del calendario de la
     * sucursal que siga PENDIENTE en la fecha dada — invocado al cerrar la caja.
     */
    @Transactional
    public List<ClienteNoPagoAutomaticoDTO> marcarNoPagoAutomatico(Long sucursalId, LocalDate fecha,
            Long registradorId) {
        List<CandidatoNoPagoAutomatico> candidatos = buscarCandidatosNoPagoAutomatico(sucursalId, fecha);
        if (candidatos.isEmpty()) {
            return List.of();
        }

        Usuario registrador = usuarioRepo.findById(registradorId)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + registradorId));

        List<ClienteNoPagoAutomaticoDTO> resultado = new ArrayList<>();
        for (CandidatoNoPagoAutomatico candidato : candidatos) {
            Pago pago = Pago.builder()
                    .credito(candidato.credito())
                    .cliente(candidato.cliente())
                    .asesor(candidato.credito().getAsesor())
                    .calendarioPago(candidato.calendarioPago())
                    .numeroPago(candidato.calendarioPago().getNumeroPago())
                    .fechaPago(fecha)
                    .montoRecibido(BigDecimal.ZERO)
                    .montoEsperado(candidato.calendarioPago().getMontoEsperado())
                    .esCompleto(false)
                    .razonNoPago(RAZON_NO_PAGO_AUTOMATICO)
                    .multaAplicada(candidato.montoMulta())
                    .registradoPor(registrador)
                    .build();
            pagoRepo.save(pago);

            candidato.calendarioPago().setEstado(EstadoCalendarioPago.NO_PAGADO);
            calendarioPagoRepo.save(candidato.calendarioPago());

            Multa multa = Multa.builder()
                    .pago(pago)
                    .cliente(candidato.cliente())
                    .credito(candidato.credito())
                    .tipo("NO_PAGO")
                    .monto(candidato.montoMulta())
                    .fecha(fecha)
                    .cobrada(false)
                    .build();
            multaRepo.save(multa);

            resultado.add(new ClienteNoPagoAutomaticoDTO(
                    candidato.cliente().getId(),
                    candidato.cliente().getNombreCompleto(),
                    candidato.credito().getId(),
                    candidato.calendarioPago().getNumeroPago(),
                    candidato.montoMulta()));
        }
        return resultado;
    }

```

No se requieren imports nuevos en `CobrosService.java` — `com.magno.dto.cobros.*`, `com.magno.model.*` y `com.magno.repository.*` ya están importados con wildcard.

- [ ] **Step 5: Ejecutar los tests y verificar que pasan**

Run: `cd backend && mvn -q -Dtest=CobrosServiceTest test`
Expected: PASS — 6 tests (los 3 existentes de `getRutaDia` + los 3 nuevos).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/magno/service/CobrosService.java backend/src/test/java/com/magno/service/CobrosServiceTest.java
git commit -m "feat: marcar no pago automático con multa al cerrar caja"
```

---

### Task 3: Enganchar en `CajaService` (preview + cierre real)

**Files:**
- Modify: `backend/src/main/java/com/magno/dto/caja/CajaCierrePreviewDTO.java`
- Modify: `backend/src/main/java/com/magno/service/CajaService.java`
- Test: Create `backend/src/test/java/com/magno/service/CajaServiceTest.java`

- [ ] **Step 1: Agregar el campo al DTO del preview**

En `backend/src/main/java/com/magno/dto/caja/CajaCierrePreviewDTO.java`, reemplazar el contenido completo por:

```java
package com.magno.dto.caja;

import com.magno.dto.cobros.ClienteNoPagoAutomaticoDTO;

import java.math.BigDecimal;
import java.util.List;

public record CajaCierrePreviewDTO(
        Long cajaId,
        BigDecimal montoApertura,

        // Inversiones — solo el subtotal; el detalle está en /inversiones
        BigDecimal subtotalInversiones,

        // Cobros por asesor
        List<CobroAsesorItemDTO> cobrosPorAsesor,
        BigDecimal totalIngresoCarteras,

        // Desembolsos desglosados
        BigDecimal desembolsosCreditosNuevos,
        BigDecimal desembolsosRenovaciones,
        BigDecimal totalDesembolsos,

        // Fórmula: apertura + ingresos − desembolsos + inversiones
        BigDecimal subtotalCaja,

        // Libres
        BigDecimal porcentajeAhorro,
        BigDecimal montoLibres,
        BigDecimal ahorroFijo,
        BigDecimal totalGastos,
        BigDecimal totalNomina,
        BigDecimal totalRealLibres,

        // Multas
        List<MultaAsesorItemDTO> multasPorAsesor,
        BigDecimal totalMultasCobradas,
        BigDecimal multasCobrasRenovaciones,
        BigDecimal totalMultasCondonadas,

        // Pagos sin registro que se marcarán automáticamente como no pago al cerrar
        List<ClienteNoPagoAutomaticoDTO> clientesSinRegistro
) {}
```

- [ ] **Step 2: Escribir el test de `CajaServiceTest` que falla**

Crear `backend/src/test/java/com/magno/service/CajaServiceTest.java`:

```java
package com.magno.service;

import com.magno.dto.caja.CajaCierrePreviewDTO;
import com.magno.dto.caja.CajaDiaDetalleDTO;
import com.magno.dto.caja.CerrarCajaRequest;
import com.magno.dto.cobros.ClienteNoPagoAutomaticoDTO;
import com.magno.model.*;
import com.magno.repository.*;
import com.magno.security.JwtPrincipal;
import com.magno.util.DateTimeUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class CajaServiceTest {

    private CajaDiaRepository cajaDiaRepo;
    private CajaMovimientoInversionRepository movimientoRepo;
    private ConfigSucursalRepository configSucursalRepo;
    private PagoRepository pagoRepo;
    private CreditoRepository creditoRepo;
    private RenovacionRepository renovacionRepo;
    private UsuarioRepository usuarioRepo;
    private SucursalRepository sucursalRepo;
    private GastoRepository gastoRepo;
    private NominaPagoRepository nominaPagoRepo;
    private MultaRepository multaRepo;
    private CobrosService cobrosService;

    private CajaService service;

    private Sucursal sucursal;
    private Usuario admin;
    private CajaDia caja;
    private ConfigSucursal config;
    private JwtPrincipal principal;
    private LocalDate hoy;

    @BeforeEach
    void setUp() {
        cajaDiaRepo = mock(CajaDiaRepository.class);
        movimientoRepo = mock(CajaMovimientoInversionRepository.class);
        configSucursalRepo = mock(ConfigSucursalRepository.class);
        pagoRepo = mock(PagoRepository.class);
        creditoRepo = mock(CreditoRepository.class);
        renovacionRepo = mock(RenovacionRepository.class);
        usuarioRepo = mock(UsuarioRepository.class);
        sucursalRepo = mock(SucursalRepository.class);
        gastoRepo = mock(GastoRepository.class);
        nominaPagoRepo = mock(NominaPagoRepository.class);
        multaRepo = mock(MultaRepository.class);
        cobrosService = mock(CobrosService.class);

        service = new CajaService(cajaDiaRepo, movimientoRepo, configSucursalRepo, pagoRepo,
                creditoRepo, renovacionRepo, usuarioRepo, sucursalRepo, gastoRepo, nominaPagoRepo,
                multaRepo, cobrosService);

        hoy = DateTimeUtils.hoyEnMagno();

        sucursal = new Sucursal();
        sucursal.setId(1L);
        sucursal.setNombre("Sucursal Centro");

        admin = new Usuario();
        admin.setId(99L);
        admin.setNombreCompleto("Laura Gerente");

        principal = new JwtPrincipal(99L, "laura@magno.mx", "SUPERVISOR", 1L);

        caja = CajaDia.builder()
                .id(500L)
                .sucursal(sucursal)
                .fecha(hoy)
                .estado(EstadoCaja.ABIERTA)
                .montoApertura(new BigDecimal("1000.00"))
                .abiertaPor(admin)
                .fechaHoraApertura(DateTimeUtils.ahoraEnMagno())
                .build();

        config = new ConfigSucursal();
        config.setSucursalId(1L);
        config.setPorcentajeAhorro(new BigDecimal("0.10"));
        config.setMontoAhorroFijo(new BigDecimal("0"));
    }

    @Test
    void cerrar_marcaNoPagoAutomaticoAntesDeCalcularElResumen() {
        when(cajaDiaRepo.findById(500L)).thenReturn(Optional.of(caja));
        when(cajaDiaRepo.save(any(CajaDia.class))).thenAnswer(inv -> inv.getArgument(0));
        when(cobrosService.marcarNoPagoAutomatico(1L, hoy, 99L)).thenReturn(List.of());
        when(pagoRepo.sumIngresoBySucursalAndFecha(1L, hoy)).thenReturn(BigDecimal.ZERO);
        when(creditoRepo.sumDesembolsosBySucursalAndFecha(eq(1L), any(), any())).thenReturn(BigDecimal.ZERO);
        when(renovacionRepo.sumDesembolsosByScopeAndFecha(1L, null, hoy, hoy)).thenReturn(BigDecimal.ZERO);
        when(movimientoRepo.sumMontoByCajaDiaId(500L)).thenReturn(BigDecimal.ZERO);
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));
        when(gastoRepo.sumMontoByCajaDiaId(500L)).thenReturn(BigDecimal.ZERO);
        when(nominaPagoRepo.findByCajaDiaIdAndDeletedAtIsNull(500L)).thenReturn(Optional.empty());
        when(usuarioRepo.getReferenceById(99L)).thenReturn(admin);
        when(movimientoRepo.findByCajaDiaIdOrderByCreatedAtAsc(500L)).thenReturn(List.of());

        CajaDiaDetalleDTO result = service.cerrar(new CerrarCajaRequest(null, 500L), principal);

        assertThat(result.estado()).isEqualTo("CERRADA");

        InOrder inOrder = inOrder(cobrosService, pagoRepo);
        inOrder.verify(cobrosService).marcarNoPagoAutomatico(1L, hoy, 99L);
        inOrder.verify(pagoRepo).sumIngresoBySucursalAndFecha(1L, hoy);
    }

    @Test
    void getPreviewCierre_incluyeClientesSinRegistro() {
        when(cajaDiaRepo.findBySucursalIdAndFechaAndEstado(1L, hoy, EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(caja));
        when(movimientoRepo.sumMontoByCajaDiaId(500L)).thenReturn(BigDecimal.ZERO);
        when(pagoRepo.sumIngresoBySucursalAndFecha(1L, hoy)).thenReturn(BigDecimal.ZERO);
        when(pagoRepo.findCobrosPorAsesorBySucursalAndFecha(1L, hoy)).thenReturn(List.of());
        when(creditoRepo.sumDesembolsosByTipoAndSucursalAndFecha(eq(1L), eq(TipoCredito.NUEVO), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(renovacionRepo.sumDesembolsosByScopeAndFecha(1L, null, hoy, hoy)).thenReturn(BigDecimal.ZERO);
        when(configSucursalRepo.findBySucursalId(1L)).thenReturn(Optional.of(config));
        when(gastoRepo.sumMontoByCajaDiaId(500L)).thenReturn(BigDecimal.ZERO);
        when(nominaPagoRepo.findByCajaDiaIdAndDeletedAtIsNull(500L)).thenReturn(Optional.empty());
        when(pagoRepo.findMultasPorAsesorBySucursalAndFecha(1L, hoy)).thenReturn(List.of());
        when(multaRepo.sumMultasCobrasViaRenovacionBySucursalAndFecha(1L, hoy)).thenReturn(BigDecimal.ZERO);
        when(multaRepo.sumMultasCondonadasBySucursalAndFecha(1L, hoy)).thenReturn(BigDecimal.ZERO);

        List<ClienteNoPagoAutomaticoDTO> esperado = List.of(
                new ClienteNoPagoAutomaticoDTO(5L, "Juana Pérez", 42L, 5, new BigDecimal("50.00")));
        when(cobrosService.previsualizarNoPagoAutomatico(1L, hoy)).thenReturn(esperado);

        CajaCierrePreviewDTO preview = service.getPreviewCierre(1L, principal);

        assertThat(preview.clientesSinRegistro()).isEqualTo(esperado);
    }
}
```

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `cd backend && mvn -q -Dtest=CajaServiceTest test`
Expected: FAIL — error de compilación (`CajaService` no tiene un constructor de 12 parámetros ni usa `cobrosService`, `CajaCierrePreviewDTO` no tiene `clientesSinRegistro()` en el DTO todavía porque `CajaService` no lo pasa).

- [ ] **Step 4: Inyectar `CobrosService` en `CajaService`**

En `backend/src/main/java/com/magno/service/CajaService.java`, reemplazar el bloque de campos + constructor (líneas 37-71):

```java
        private final CajaDiaRepository cajaDiaRepo;
        private final CajaMovimientoInversionRepository movimientoRepo;
        private final ConfigSucursalRepository configSucursalRepo;
        private final PagoRepository pagoRepo;
        private final CreditoRepository creditoRepo;
        private final RenovacionRepository renovacionRepo;
        private final UsuarioRepository usuarioRepo;
        private final SucursalRepository sucursalRepo;
        private final GastoRepository gastoRepo;
        private final NominaPagoRepository nominaPagoRepo;
        private final MultaRepository multaRepo;
        private final CobrosService cobrosService;

        public CajaService(CajaDiaRepository cajaDiaRepo,
                        CajaMovimientoInversionRepository movimientoRepo,
                        ConfigSucursalRepository configSucursalRepo,
                        PagoRepository pagoRepo,
                        CreditoRepository creditoRepo,
                        RenovacionRepository renovacionRepo,
                        UsuarioRepository usuarioRepo,
                        SucursalRepository sucursalRepo,
                        GastoRepository gastoRepo,
                        NominaPagoRepository nominaPagoRepo,
                        MultaRepository multaRepo,
                        CobrosService cobrosService) {
                this.cajaDiaRepo = cajaDiaRepo;
                this.movimientoRepo = movimientoRepo;
                this.configSucursalRepo = configSucursalRepo;
                this.pagoRepo = pagoRepo;
                this.creditoRepo = creditoRepo;
                this.renovacionRepo = renovacionRepo;
                this.usuarioRepo = usuarioRepo;
                this.sucursalRepo = sucursalRepo;
                this.gastoRepo = gastoRepo;
                this.nominaPagoRepo = nominaPagoRepo;
                this.multaRepo = multaRepo;
                this.cobrosService = cobrosService;
        }
```

Y agregar el import (junto a los demás `import com.magno...` al inicio del archivo, después de `import com.magno.dto.caja.*;`):

```java
import com.magno.dto.cobros.ClienteNoPagoAutomaticoDTO;
```

- [ ] **Step 5: Invocar el marcado real dentro de `cerrar`**

En el método `cerrar` (busca `fechaCaja = caja.getFecha();`), reemplazar:

```java
                fechaCaja = caja.getFecha();
                OffsetDateTime inicioTs = fechaCaja.atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();
                OffsetDateTime finTs = fechaCaja.plusDays(1).atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();

                BigDecimal ingresoCarteras = pagoRepo.sumIngresoBySucursalAndFecha(sucursalId, fechaCaja);
```

por:

```java
                fechaCaja = caja.getFecha();
                OffsetDateTime inicioTs = fechaCaja.atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();
                OffsetDateTime finTs = fechaCaja.plusDays(1).atStartOfDay(DateTimeUtils.MAGNO_ZONE).toOffsetDateTime();

                cobrosService.marcarNoPagoAutomatico(sucursalId, fechaCaja, principal.userId());

                BigDecimal ingresoCarteras = pagoRepo.sumIngresoBySucursalAndFecha(sucursalId, fechaCaja);
```

- [ ] **Step 6: Incluir el preview en `getPreviewCierre`**

En el método `getPreviewCierre`, reemplazar:

```java
                BigDecimal multasCobrasRenovaciones = multaRepo
                                .sumMultasCobrasViaRenovacionBySucursalAndFecha(effectiveId, hoy);
                BigDecimal totalMultasCondonadas = multaRepo
                                .sumMultasCondonadasBySucursalAndFecha(effectiveId, hoy);

                return new CajaCierrePreviewDTO(
                                caja.getId(),
                                caja.getMontoApertura(),
                                subtotalInversiones,
                                cobrosPorAsesor,
                                totalIngresoCarteras,
                                desembolsosNuevos,
                                desembolsosRenovaciones,
                                totalDesembolsos,
                                subtotalCaja,
                                config.getPorcentajeAhorro(),
                                montoLibres,
                                ahorroFijo,
                                totalGastos,
                                totalNomina,
                                totalRealLibres,
                                multasPorAsesor,
                                totalMultas,
                                multasCobrasRenovaciones,
                                totalMultasCondonadas);
        }
```

por:

```java
                BigDecimal multasCobrasRenovaciones = multaRepo
                                .sumMultasCobrasViaRenovacionBySucursalAndFecha(effectiveId, hoy);
                BigDecimal totalMultasCondonadas = multaRepo
                                .sumMultasCondonadasBySucursalAndFecha(effectiveId, hoy);

                List<ClienteNoPagoAutomaticoDTO> clientesSinRegistro = cobrosService
                                .previsualizarNoPagoAutomatico(effectiveId, hoy);

                return new CajaCierrePreviewDTO(
                                caja.getId(),
                                caja.getMontoApertura(),
                                subtotalInversiones,
                                cobrosPorAsesor,
                                totalIngresoCarteras,
                                desembolsosNuevos,
                                desembolsosRenovaciones,
                                totalDesembolsos,
                                subtotalCaja,
                                config.getPorcentajeAhorro(),
                                montoLibres,
                                ahorroFijo,
                                totalGastos,
                                totalNomina,
                                totalRealLibres,
                                multasPorAsesor,
                                totalMultas,
                                multasCobrasRenovaciones,
                                totalMultasCondonadas,
                                clientesSinRegistro);
        }
```

- [ ] **Step 7: Ejecutar el test y verificar que pasa**

Run: `cd backend && mvn -q -Dtest=CajaServiceTest test`
Expected: PASS — 2 tests.

- [ ] **Step 8: Correr toda la suite backend para detectar otros usos de los constructores tocados**

Run: `cd backend && mvn -q test`
Expected: BUILD exitoso, sin fallos ni errores (revisar `target/surefire-reports/*.txt` si el `-q` no imprime nada).

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/com/magno/dto/caja/CajaCierrePreviewDTO.java backend/src/main/java/com/magno/service/CajaService.java backend/src/test/java/com/magno/service/CajaServiceTest.java
git commit -m "feat: enganchar no pago automático al preview y cierre de caja"
```

---

### Task 4: Frontend — aviso en el preview de cierre

**Files:**
- Modify: `frontend/src/services/cajaService.ts`
- Modify: `frontend/src/pages/caja/CajaCierrePage.tsx`

- [ ] **Step 1: Agregar el tipo y el campo del preview**

En `frontend/src/services/cajaService.ts`, después de la interfaz `MultaAsesorItem` (línea 11-14), agregar:

```ts
export interface ClienteNoPagoAutomatico {
  clienteId: number
  nombreCompleto: string
  creditoId: number
  numeroPago: number
  montoMulta: number
}
```

Y en la interfaz `CajaCierrePreview` (línea 16-36), agregar el campo al final, antes del `}`:

```ts
export interface CajaCierrePreview {
  cajaId: number
  montoApertura: number
  subtotalInversiones: number
  cobrosPorAsesor: CobroAsesorItem[]
  totalIngresoCarteras: number
  desembolsosCreditosNuevos: number
  desembolsosRenovaciones: number
  totalDesembolsos: number
  subtotalCaja: number
  porcentajeAhorro: number
  montoLibres: number
  ahorroFijo: number
  totalGastos: number
  totalNomina: number
  totalRealLibres: number
  multasPorAsesor: MultaAsesorItem[]
  totalMultasCobradas: number
  multasCobrasRenovaciones: number
  totalMultasCondonadas: number
  clientesSinRegistro: ClienteNoPagoAutomatico[]
}
```

- [ ] **Step 2: Normalizar el campo en `getPreviewCierre`**

En el mismo archivo, dentro de `cajaService.getPreviewCierre`, reemplazar:

```ts
           totalMultasCobradas:       Number(d.totalMultasCobradas ?? 0),
           multasCobrasRenovaciones:  Number(d.multasCobrasRenovaciones ?? d.multas_cobras_renovaciones ?? 0),
           totalMultasCondonadas:     Number(d.totalMultasCondonadas ?? d.total_multas_condonadas ?? 0),
         }
       }),
```

por:

```ts
           totalMultasCobradas:       Number(d.totalMultasCobradas ?? 0),
           multasCobrasRenovaciones:  Number(d.multasCobrasRenovaciones ?? d.multas_cobras_renovaciones ?? 0),
           totalMultasCondonadas:     Number(d.totalMultasCondonadas ?? d.total_multas_condonadas ?? 0),
           clientesSinRegistro:       (d.clientesSinRegistro ?? []).map((x: any) => ({
             clienteId:     x.clienteId,
             nombreCompleto: x.nombreCompleto,
             creditoId:     x.creditoId,
             numeroPago:    x.numeroPago,
             montoMulta:    Number(x.montoMulta ?? 0),
           })),
         }
       }),
```

- [ ] **Step 3: Agregar la sección de aviso en `CajaCierrePage.tsx`**

En `frontend/src/pages/caja/CajaCierrePage.tsx`, entre el cierre de la sección "Multas Cobradas" y la barra de acciones, reemplazar:

```tsx
          </Section>

          {/* ── Action bar ───────────────────────────────────────────── */}
```

por:

```tsx
          </Section>

          {/* ── Pagos sin registro ──────────────────────────────────── */}
          {preview.clientesSinRegistro.length > 0 && (
            <Section
              title={`Pagos sin registro (${preview.clientesSinRegistro.length})`}
              defaultOpen
            >
              <p className="text-[13px] text-[#92400e] bg-[#fef3c7] rounded-lg px-3 py-2 mb-3">
                Estos clientes no tienen un cobro registrado hoy. Al cerrar la caja se
                marcarán automáticamente como &ldquo;no pagó&rdquo; y se les generará la
                multa correspondiente.
              </p>
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th className="text-right">Multa a generar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.clientesSinRegistro.map(row => (
                      <tr key={row.creditoId}>
                        <td className="text-[13px]">{row.nombreCompleto}</td>
                        <td className="text-right font-mono">{fmtMoney(row.montoMulta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-right text-[13px]">
                <span className="text-[#6c757d]">Total multas nuevas: </span>
                <span className="font-semibold font-mono">
                  {fmtMoney(preview.clientesSinRegistro.reduce((sum, r) => sum + r.montoMulta, 0))}
                </span>
              </div>
            </Section>
          )}

          {/* ── Action bar ───────────────────────────────────────────── */}
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores (sin output).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/cajaService.ts frontend/src/pages/caja/CajaCierrePage.tsx
git commit -m "feat: mostrar aviso de pagos sin registro en preview de cierre de caja"
```

---

### Task 5: Documentar la regla de negocio

**Files:**
- Modify: `docs/03-reglas-de-negocio.md`

- [ ] **Step 1: Agregar la regla a la sección 6.3 (Multas)**

En `docs/03-reglas-de-negocio.md`, dentro de "**Tipo 1 — Por día no pagado:**" (después de la línea `- Días INHÁBIL NO generan multa.`), agregar:

```markdown
- Al cerrar la caja del día, cualquier pago que ningún asesor haya registrado se
  marca automáticamente como "No pagó" (razón: "Cierre de caja — sin registro de
  pago") y genera su multa igual que un no-pago manual. El preview de cierre
  muestra estos clientes antes de confirmar.
```

- [ ] **Step 2: Commit**

```bash
git add docs/03-reglas-de-negocio.md
git commit -m "docs: documentar no pago automático al cerrar caja"
```

---

### Task 6: Verificación final

- [ ] **Step 1: Suite completa backend**

Run: `cd backend && mvn -q test`
Expected: BUILD exitoso. Confirmar con: `grep -rh "Tests run" backend/target/surefire-reports/*.txt | awk -F'[,:]' '{fail+=$4; err+=$6} END {print "Total failures:", fail, "Total errors:", err}'` → `Total failures: 0 Total errors: 0`.

- [ ] **Step 2: Typecheck frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Revisar diff completo antes de dar por terminado**

Run: `git log --oneline -8`
Expected: 5 commits nuevos de este plan, en orden (DTO → CobrosService → CajaService → frontend → docs).

---

## Notas para quien ejecute el plan

- No hay cambios de modelo de datos ni migraciones — se reutilizan las tablas `pagos`, `multas` y `calendario_pagos` tal cual.
- No hay cambios de endpoints — mismos `GET /api/caja/cierre-preview` y `POST /api/caja/cerrar`, solo cambia el payload de respuesta (campo nuevo, no rompe consumidores existentes que ignoren campos desconocidos).
- El flujo manual de "no pagó" (`registrarNoPago`, `ModalRegistrarPago.tsx`) no se toca.
- Corrección de un no-pago automático incorrecto: usar "Modificar pago" (ya existe, Admin/Supervisor), no requiere trabajo nuevo.
