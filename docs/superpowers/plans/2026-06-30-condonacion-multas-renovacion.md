# Condonación de Multas en Renovaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que Gerentes condonen multas individuales al aprobar una renovación, reflejando el impacto en el desembolso y en el corte de caja con trazabilidad completa.

**Architecture:** Se agregan 5 columnas a `multas` y 1 a `renovaciones` para registrar condonaciones por multa. El endpoint de aprobación acepta los IDs de multas a condonar + motivo; el servicio las marca antes de procesar el desembolso. La caja muestra multas cobradas (diarias) y condonadas como renglones separados.

**Tech Stack:** Spring Boot 3 / Java 17 / JPA / Flyway SQL, React 18 / TypeScript / TanStack Query / Tailwind CSS

---

## File Map

| Archivo | Acción |
|---|---|
| `backend/src/main/resources/db/changelog/V26__multas_condonacion.sql` | Crear |
| `backend/src/main/java/com/magno/model/Multa.java` | Modificar (+5 campos) |
| `backend/src/main/java/com/magno/model/Renovacion.java` | Modificar (+1 campo) |
| `backend/src/main/java/com/magno/dto/renovacion/MultaCondonadaDTO.java` | Crear |
| `backend/src/main/java/com/magno/dto/cobros/MultaDTO.java` | Modificar (+condonación fields) |
| `backend/src/main/java/com/magno/dto/renovacion/RenovacionAprobarRequest.java` | Modificar |
| `backend/src/main/java/com/magno/dto/renovacion/RenovacionDetalleDTO.java` | Modificar |
| `backend/src/main/java/com/magno/dto/caja/CajaCierrePreviewDTO.java` | Modificar |
| `backend/src/main/java/com/magno/repository/MultaRepository.java` | Modificar |
| `backend/src/main/java/com/magno/repository/RenovacionRepository.java` | Modificar |
| `backend/src/main/java/com/magno/service/RenovacionService.java` | Modificar |
| `backend/src/main/java/com/magno/service/CajaService.java` | Modificar |
| `backend/src/main/java/com/magno/controller/RenovacionController.java` | Modificar |
| `backend/src/test/java/com/magno/service/RenovacionCondonacionTest.java` | Crear |
| `frontend/src/types/index.ts` | Modificar |
| `frontend/src/services/renovacionService.ts` | Modificar |
| `frontend/src/services/cajaService.ts` | Modificar |
| `frontend/src/pages/renovaciones/TabPendientesRenovacion.tsx` | Modificar |
| `frontend/src/pages/renovaciones/TabPendientesDesembolso.tsx` | Modificar |
| `frontend/src/pages/caja/CajaCierrePage.tsx` | Modificar |

---

## Task 1: DB Migration V26

**Files:**
- Create: `backend/src/main/resources/db/changelog/V26__multas_condonacion.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- =============================================================
-- MAGNO — V26: Condonación de multas en renovaciones
--
-- Agrega campos de condonación a la tabla multas y un campo
-- de resumen multas_condonadas a la tabla renovaciones.
-- Una multa no puede ser cobrada Y condonada al mismo tiempo
-- (constraint de negocio, validado en servicio).
-- =============================================================

-- Columnas de condonación en multas
ALTER TABLE multas ADD COLUMN condonada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE multas ADD COLUMN condonada_en_renovacion_id BIGINT REFERENCES renovaciones(id);
ALTER TABLE multas ADD COLUMN condonada_por_id BIGINT REFERENCES usuarios(id);
ALTER TABLE multas ADD COLUMN fecha_condonacion TIMESTAMPTZ;
ALTER TABLE multas ADD COLUMN motivo_condonacion TEXT;

-- Índices para queries de auditoría y caja
CREATE INDEX idx_multas_condonada ON multas(condonada) WHERE condonada = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_multas_condonada_por_renovacion ON multas(condonada_en_renovacion_id) WHERE condonada_en_renovacion_id IS NOT NULL;

-- Resumen de condonadas en renovaciones (para queries eficientes en caja)
ALTER TABLE renovaciones ADD COLUMN multas_condonadas DECIMAL(12,2) NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Verificar que el backend arranque con la migración aplicada**

```bash
cd backend && mvn spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=dev" 2>&1 | grep -E "V26|Flyway|ERROR" | head -20
```

Expected: línea con `V26__multas_condonacion.sql` aplicada sin errores.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/changelog/V26__multas_condonacion.sql
git commit -m "feat: migration V26 - campos de condonación en multas y renovaciones"
```

---

## Task 2: Backend Models — `Multa` y `Renovacion`

**Files:**
- Modify: `backend/src/main/java/com/magno/model/Multa.java`
- Modify: `backend/src/main/java/com/magno/model/Renovacion.java`

- [ ] **Step 1: Actualizar `Multa.java`**

Agregar los 5 campos nuevos después de `cobradaEnPago` (línea 56) y antes de `deletedAt`:

```java
/** Renovación en la que se condonó esta multa */
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "condonada_en_renovacion_id")
private Renovacion condonadaEnRenovacion;

/** Usuario que autorizó la condonación */
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "condonada_por_id")
private Usuario condonadaPor;

@Column(name = "condonada", nullable = false)
private Boolean condonada;

@Column(name = "fecha_condonacion")
private OffsetDateTime fechaCondonacion;

@Column(name = "motivo_condonacion", columnDefinition = "TEXT")
private String motivoCondonacion;
```

Actualizar `@ToString` para excluir las nuevas relaciones lazy:
```java
@ToString(exclude = {"pago", "cliente", "credito", "cobradaEnPago", "condonadaEnRenovacion", "condonadaPor"})
```

Actualizar `prePersist()` para inicializar `condonada`:
```java
@PrePersist
void prePersist() {
    OffsetDateTime now = OffsetDateTime.now();
    createdAt = now;
    updatedAt = now;
    if (cobrada == null) cobrada = false;
    if (condonada == null) condonada = false;
}
```

- [ ] **Step 2: Actualizar `Renovacion.java`**

Agregar después de `multasPendientes` (línea 81):

```java
@Column(name = "multas_condonadas", nullable = false, precision = 12, scale = 2)
private BigDecimal multasCondonadas;
```

Actualizar `prePersist()` para inicializar `multasCondonadas`:
```java
@PrePersist
void prePersist() {
    OffsetDateTime now = OffsetDateTime.now();
    createdAt = now;
    updatedAt = now;
    if (estado == null) estado = EstadoRenovacion.SOLICITADO;
    if (multasCondonadas == null) multasCondonadas = BigDecimal.ZERO;
}
```

- [ ] **Step 3: Verificar compilación**

```bash
cd backend && mvn compile -q 2>&1 | grep -E "ERROR|WARNING" | head -20
```

Expected: sin errores de compilación.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/model/Multa.java \
        backend/src/main/java/com/magno/model/Renovacion.java
git commit -m "feat: agregar campos de condonación a entidades Multa y Renovacion"
```

---

## Task 3: DTOs — `MultaCondonadaDTO` y `MultaDTO`

**Files:**
- Create: `backend/src/main/java/com/magno/dto/renovacion/MultaCondonadaDTO.java`
- Modify: `backend/src/main/java/com/magno/dto/cobros/MultaDTO.java`

- [ ] **Step 1: Crear `MultaCondonadaDTO.java`**

```java
package com.magno.dto.renovacion;

import com.magno.model.Multa;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record MultaCondonadaDTO(
        Long id,
        BigDecimal monto,
        String tipo,
        LocalDate fecha,
        String motivoCondonacion,
        String condonadaPorNombre,
        OffsetDateTime fechaCondonacion
) {
    public static MultaCondonadaDTO from(Multa m) {
        return new MultaCondonadaDTO(
                m.getId(),
                m.getMonto(),
                m.getTipo(),
                m.getFecha(),
                m.getMotivoCondonacion(),
                m.getCondonadaPor() != null ? m.getCondonadaPor().getNombreCompleto() : null,
                m.getFechaCondonacion()
        );
    }
}
```

- [ ] **Step 2: Actualizar `MultaDTO.java`**

Reemplazar el record completo para agregar campos de condonación:

```java
package com.magno.dto.cobros;

import com.magno.model.Multa;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record MultaDTO(
        Long id,
        Long creditoId,
        Long clienteId,
        Long pagoId,
        String tipo,
        BigDecimal monto,
        LocalDate fecha,
        Boolean cobrada,
        Long cobradaEnPagoId,
        Boolean condonada,
        Long condonadaEnRenovacionId,
        String condonadaPorNombre,
        OffsetDateTime fechaCondonacion,
        String motivoCondonacion
) {
    public static MultaDTO from(Multa m) {
        return new MultaDTO(
                m.getId(),
                m.getCredito().getId(),
                m.getCliente().getId(),
                m.getPago() != null ? m.getPago().getId() : null,
                m.getTipo(),
                m.getMonto(),
                m.getFecha(),
                m.getCobrada(),
                m.getCobradaEnPago() != null ? m.getCobradaEnPago().getId() : null,
                m.getCondonada(),
                m.getCondonadaEnRenovacion() != null ? m.getCondonadaEnRenovacion().getId() : null,
                m.getCondonadaPor() != null ? m.getCondonadaPor().getNombreCompleto() : null,
                m.getFechaCondonacion(),
                m.getMotivoCondonacion()
        );
    }
}
```

- [ ] **Step 3: Verificar compilación**

```bash
cd backend && mvn compile -q 2>&1 | grep "ERROR" | head -20
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/dto/renovacion/MultaCondonadaDTO.java \
        backend/src/main/java/com/magno/dto/cobros/MultaDTO.java
git commit -m "feat: agregar DTOs de condonación (MultaCondonadaDTO, MultaDTO ampliado)"
```

---

## Task 4: DTOs — `RenovacionAprobarRequest` y `RenovacionDetalleDTO`

**Files:**
- Modify: `backend/src/main/java/com/magno/dto/renovacion/RenovacionAprobarRequest.java`
- Modify: `backend/src/main/java/com/magno/dto/renovacion/RenovacionDetalleDTO.java`

- [ ] **Step 1: Actualizar `RenovacionAprobarRequest.java`**

```java
package com.magno.dto.renovacion;

import java.math.BigDecimal;
import java.util.List;

public record RenovacionAprobarRequest(
        BigDecimal montoAprobado,         // null → se usa montoNuevo sin cambios
        List<Long> multasCondonadasIds,   // IDs de multas a condonar; null o vacío = sin condonaciones
        String motivoCondonacion          // obligatorio si multasCondonadasIds no está vacío
) {}
```

- [ ] **Step 2: Actualizar `RenovacionDetalleDTO.java`**

Agregar campos nuevos al record (después de `multasPendientes`):

```java
public record RenovacionDetalleDTO(
        Long id,
        ClienteInfo cliente,
        AsesorInfo asesor,
        CreditoInfo creditoAnterior,
        CreditoInfo creditoNuevo,
        LocalDate fecha,
        String estado,
        AsesorInfo aprobadoPor,
        OffsetDateTime fechaAprobacion,
        String motivoRechazo,
        BigDecimal montoNuevo,
        BigDecimal montoAprobado,
        AsesorInfo confirmadoPor,
        OffsetDateTime fechaConfirmacion,
        String tipoPago,
        int pagosRestantes,
        BigDecimal montoPagosRestantes,
        BigDecimal multasPendientes,
        BigDecimal multasCondonadas,              // NUEVO
        String motivoCondonacion,                 // NUEVO
        List<MultaCondonadaDTO> multasCondonadasDetalle, // NUEVO
        BigDecimal pagoAdelantado,
        BigDecimal montoDesembolso,
        String garantiaDescripcion,
        String videoEntregaUrl,
        List<String> evidenciaUrls,
        OffsetDateTime createdAt) {

    public record ClienteInfo(Long id, String nombreCompleto, String celular) {}
    public record AsesorInfo(Long id, String nombreCompleto, String sucursalNombre) {}
    public record CreditoInfo(Long id, BigDecimal montoCapital, Integer plazoDias,
                    BigDecimal pagoPeriodico, String estado) {}

    public static RenovacionDetalleDTO from(Renovacion r) {
        return from(r, List.of());
    }

    public static RenovacionDetalleDTO from(Renovacion r, List<MultaCondonadaDTO> condonadasDetalle) {
        CreditoInfo creditoNuevoInfo = null;
        if (r.getCreditoNuevo() != null) {
            creditoNuevoInfo = new CreditoInfo(
                    r.getCreditoNuevo().getId(),
                    r.getCreditoNuevo().getMontoCapital(),
                    r.getCreditoNuevo().getPlazoDias(),
                    r.getCreditoNuevo().getPagoPeriodico(),
                    r.getCreditoNuevo().getEstado().name());
        }

        AsesorInfo aprobadoPorInfo = null;
        if (r.getAprobadoPor() != null) {
            aprobadoPorInfo = new AsesorInfo(
                    r.getAprobadoPor().getId(),
                    r.getAprobadoPor().getNombreCompleto(),
                    r.getAprobadoPor().getSucursal().getNombre());
        }

        AsesorInfo confirmadoPorInfo = null;
        if (r.getConfirmadoPor() != null) {
            confirmadoPorInfo = new AsesorInfo(
                    r.getConfirmadoPor().getId(),
                    r.getConfirmadoPor().getNombreCompleto(),
                    r.getConfirmadoPor().getSucursal().getNombre());
        }

        String motivoCond = null;
        if (!condonadasDetalle.isEmpty()) {
            motivoCond = condonadasDetalle.get(0).motivoCondonacion();
        }

        return new RenovacionDetalleDTO(
                r.getId(),
                new ClienteInfo(
                        r.getCliente().getId(),
                        r.getCliente().getNombreCompleto(),
                        r.getCliente().getCelular()),
                new AsesorInfo(r.getAsesor().getId(), r.getAsesor().getNombreCompleto(),
                        r.getAsesor().getSucursal().getNombre()),
                new CreditoInfo(
                        r.getCreditoAnterior().getId(),
                        r.getCreditoAnterior().getMontoCapital(),
                        r.getCreditoAnterior().getPlazoDias(),
                        r.getCreditoAnterior().getPagoPeriodico(),
                        r.getCreditoAnterior().getEstado().name()),
                creditoNuevoInfo,
                r.getFecha(),
                r.getEstado().name(),
                aprobadoPorInfo,
                r.getFechaAprobacion(),
                r.getMotivoRechazo(),
                r.getMontoNuevo(),
                r.getMontoAprobado(),
                confirmadoPorInfo,
                r.getFechaConfirmacion(),
                r.getTipoPago().name(),
                r.getPagosRestantes(),
                r.getMontoPagosRestantes(),
                r.getMultasPendientes(),
                r.getMultasCondonadas(),
                motivoCond,
                condonadasDetalle,
                r.getPagoAdelantado(),
                r.getMontoDesembolso(),
                r.getGarantiaDescripcion(),
                r.getVideoEntregaUrl(),
                r.getEvidenciaUrls() != null ? Arrays.asList(r.getEvidenciaUrls()) : List.of(),
                r.getCreatedAt());
    }
}
```

Nota: el import de `MultaCondonadaDTO` va arriba:
```java
import com.magno.dto.renovacion.MultaCondonadaDTO;
```

- [ ] **Step 3: Verificar compilación**

```bash
cd backend && mvn compile -q 2>&1 | grep "ERROR" | head -20
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/dto/renovacion/RenovacionAprobarRequest.java \
        backend/src/main/java/com/magno/dto/renovacion/RenovacionDetalleDTO.java
git commit -m "feat: ampliar DTOs de renovación para soportar condonación de multas"
```

---

## Task 5: DTO — `CajaCierrePreviewDTO`

**Files:**
- Modify: `backend/src/main/java/com/magno/dto/caja/CajaCierrePreviewDTO.java`

- [ ] **Step 1: Agregar campos de multas condonadas**

```java
package com.magno.dto.caja;

import java.math.BigDecimal;
import java.util.List;

public record CajaCierrePreviewDTO(
        Long cajaId,
        BigDecimal montoApertura,

        // Inversiones
        BigDecimal subtotalInversiones,

        // Cobros
        List<CobroAsesorItemDTO> cobrosPorAsesor,
        BigDecimal totalIngresoCarteras,

        // Desembolsos
        BigDecimal desembolsosCreditosNuevos,
        BigDecimal desembolsosRenovaciones,
        BigDecimal totalDesembolsos,

        // Subtotal
        BigDecimal subtotalCaja,

        // Libres
        BigDecimal porcentajeAhorro,
        BigDecimal montoLibres,
        BigDecimal ahorroFijo,
        BigDecimal totalGastos,
        BigDecimal totalNomina,
        BigDecimal totalRealLibres,

        // Multas — cobradas (diarias) + condonadas (renovaciones)
        List<MultaAsesorItemDTO> multasPorAsesor,
        BigDecimal totalMultasCobradas,
        BigDecimal multasCobrasRenovaciones,      // NUEVO
        BigDecimal totalMultasCondonadas          // NUEVO
) {}
```

- [ ] **Step 2: Compilar**

```bash
cd backend && mvn compile -q 2>&1 | grep "ERROR" | head -20
```

Expected: errores de compilación en `CajaService` porque el constructor cambió — se resolverán en Task 9.

- [ ] **Step 3: Commit parcial (solo el DTO)**

```bash
git add backend/src/main/java/com/magno/dto/caja/CajaCierrePreviewDTO.java
git commit -m "feat: agregar campos de multas condonadas a CajaCierrePreviewDTO"
```

---

## Task 6: Repositories — `MultaRepository` y `RenovacionRepository`

**Files:**
- Modify: `backend/src/main/java/com/magno/repository/MultaRepository.java`
- Modify: `backend/src/main/java/com/magno/repository/RenovacionRepository.java`

- [ ] **Step 1: Actualizar `MultaRepository.java`**

Reemplazar el archivo completo:

```java
package com.magno.repository;

import com.magno.model.Multa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface MultaRepository extends JpaRepository<Multa, Long> {

    List<Multa> findByCreditoIdAndCobradaFalseAndDeletedAtIsNull(Long creditoId);

    List<Multa> findByClienteIdAndCobradaFalseAndDeletedAtIsNull(Long clienteId);

    List<Multa> findByCreditoIdAndDeletedAtIsNullOrderByFechaDesc(Long creditoId);

    /** Multas no cobradas y no condonadas de un crédito — para confirmarDesembolso */
    List<Multa> findByCreditoIdAndCobradaFalseAndCondonadaFalseAndDeletedAtIsNull(Long creditoId);

    /** Multas pendientes (no cobradas, no condonadas) — para mostrar en solicitud y calcular desembolso */
    @Query("SELECT COALESCE(SUM(m.monto), 0) FROM Multa m " +
            "WHERE m.credito.id = :creditoId " +
            "AND m.cobrada = false " +
            "AND m.condonada = false " +
            "AND m.deletedAt IS NULL")
    BigDecimal sumMontosPendientesByCreditoId(@Param("creditoId") Long creditoId);

    @Query("SELECT COALESCE(SUM(m.monto), 0) FROM Multa m " +
            "WHERE m.credito.asesor.id = :asesorId " +
            "AND m.cobrada = true " +
            "AND m.fecha >= :desde AND m.fecha <= :hasta " +
            "AND m.deletedAt IS NULL")
    BigDecimal sumMultasCobradaByAsesorAndFechaRange(
            @Param("asesorId") Long asesorId,
            @Param("desde") LocalDate desde,
            @Param("hasta") LocalDate hasta);

    @Query("SELECT COUNT(m) FROM Multa m " +
            "WHERE m.credito.id = :creditoId " +
            "AND m.tipo = 'INCOMPLETO' " +
            "AND m.deletedAt IS NULL")
    long countIncompletosByCreditoId(@Param("creditoId") Long creditoId);

    /** Multas pendientes individuales de un crédito (para mostrar al gerente en aprobación) */
    @Query("SELECT m FROM Multa m " +
            "WHERE m.credito.id = :creditoId " +
            "AND m.cobrada = false " +
            "AND m.condonada = false " +
            "AND m.deletedAt IS NULL " +
            "ORDER BY m.fecha ASC")
    List<Multa> findPendientesByCreditoId(@Param("creditoId") Long creditoId);

    /**
     * Multas condonadas hoy en una sucursal (para el cierre de caja).
     * Usa fechaCondonacion para determinar el día.
     */
    @Query("SELECT COALESCE(SUM(m.monto), 0) FROM Multa m " +
            "WHERE m.credito.sucursal.id = :sucursalId " +
            "AND m.condonada = true " +
            "AND CAST(m.fechaCondonacion AS java.time.LocalDate) = :fecha " +
            "AND m.deletedAt IS NULL")
    BigDecimal sumMultasCondonadasBySucursalAndFecha(
            @Param("sucursalId") Long sucursalId,
            @Param("fecha") LocalDate fecha);

    /**
     * Multas cobradas vía renovación hoy en una sucursal.
     * Las multas cobradas vía renovación tienen cobrada=true, condonada=false
     * y cobradaEnPago IS NULL (no se cobran en un pago diario).
     * Se detectan por updatedAt del día (momento en que confirmarDesembolso las marca).
     */
    @Query("SELECT COALESCE(SUM(m.monto), 0) FROM Multa m " +
            "WHERE m.credito.sucursal.id = :sucursalId " +
            "AND m.cobrada = true " +
            "AND m.condonada = false " +
            "AND m.cobradaEnPago IS NULL " +
            "AND CAST(m.updatedAt AS java.time.LocalDate) = :fecha " +
            "AND m.deletedAt IS NULL")
    BigDecimal sumMultasCobrasViaRenovacionBySucursalAndFecha(
            @Param("sucursalId") Long sucursalId,
            @Param("fecha") LocalDate fecha);
}
```

- [ ] **Step 2: Actualizar `RenovacionRepository.java`**

Agregar el método `sumMultasCondonadasBySucursalAndFecha` (no es necesario — ya está en `MultaRepository`). Sin cambios necesarios en este archivo.

- [ ] **Step 3: Compilar**

```bash
cd backend && mvn compile -q 2>&1 | grep "ERROR" | head -20
```

Expected: errores en servicios que usan el DTO de caja actualizado — se resuelven en Tasks 8 y 9.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/repository/MultaRepository.java
git commit -m "feat: agregar queries de condonación a MultaRepository"
```

---

## Task 7: Service — `RenovacionService`

**Files:**
- Modify: `backend/src/main/java/com/magno/service/RenovacionService.java`

- [ ] **Step 1: Actualizar `aprobarRenovacion()` — agregar lógica de condonación**

Reemplazar el método `aprobarRenovacion` completo (líneas 240–271):

```java
@Transactional
public RenovacionDetalleDTO aprobarRenovacion(Long renovacionId, BigDecimal montoAprobadoParam,
        List<Long> multasCondonadasIds, String motivoCondonacion, Long aprobadorId) {
    Renovacion renovacion = findRenovacion(renovacionId);

    if (renovacion.getEstado() != EstadoRenovacion.SOLICITADO) {
        throw new IllegalArgumentException(
                "Solo se puede aprobar una renovación en estado SOLICITADO. Estado actual: "
                        + renovacion.getEstado());
    }

    Usuario aprobador = usuarioRepo.findById(aprobadorId)
            .orElseThrow(() -> new EntityNotFoundException(
                    "Usuario no encontrado: " + aprobadorId));

    BigDecimal montoAprobado = (montoAprobadoParam != null
            && montoAprobadoParam.compareTo(BigDecimal.ZERO) > 0)
                    ? montoAprobadoParam
                    : renovacion.getMontoNuevo();

    // ── Procesar condonaciones ───────────────────────────────────────
    List<Multa> multasCondonadas = List.of();
    BigDecimal totalCondonado = BigDecimal.ZERO;

    if (multasCondonadasIds != null && !multasCondonadasIds.isEmpty()) {
        if (motivoCondonacion == null || motivoCondonacion.isBlank()) {
            throw new IllegalArgumentException(
                    "El motivo de condonación es obligatorio cuando se condonan multas.");
        }

        Long creditoAnteriorId = renovacion.getCreditoAnterior().getId();
        OffsetDateTime ahora = DateTimeUtils.ahoraEnMagno();
        List<Multa> multas = new java.util.ArrayList<>();

        for (Long multaId : multasCondonadasIds) {
            Multa multa = multaRepo.findById(multaId)
                    .orElseThrow(() -> new EntityNotFoundException("Multa no encontrada: " + multaId));

            if (!multa.getCredito().getId().equals(creditoAnteriorId)) {
                throw new IllegalArgumentException(
                        "La multa " + multaId + " no pertenece al crédito anterior de esta renovación.");
            }
            if (Boolean.TRUE.equals(multa.getCobrada())) {
                throw new IllegalArgumentException("La multa " + multaId + " ya fue cobrada.");
            }
            if (Boolean.TRUE.equals(multa.getCondonada())) {
                throw new IllegalArgumentException("La multa " + multaId + " ya fue condonada.");
            }

            multa.setCondonada(true);
            multa.setCondonadaEnRenovacion(renovacion);
            multa.setCondonadaPor(aprobador);
            multa.setFechaCondonacion(ahora);
            multa.setMotivoCondonacion(motivoCondonacion.trim());
            multas.add(multaRepo.save(multa));
        }

        totalCondonado = multas.stream()
                .map(Multa::getMonto)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        multasCondonadas = multas;
    }

    // ── Recalcular desembolso con multas condonadas ──────────────────
    BigDecimal multasPendientesAmt = multaRepo.sumMontosPendientesByCreditoId(
            renovacion.getCreditoAnterior().getId());
    TipoPago tipoPago = renovacion.getTipoPago();
    Long sucursalId = renovacion.getCreditoAnterior().getSucursal().getId();
    ResumenCalculo calculoNuevo = tipoPago == TipoPago.SEMANAL
            ? calculoService.calcularCreditoSemanal(montoAprobado, sucursalId)
            : calculoService.calcularCredito(montoAprobado, sucursalId);
    BigDecimal montoDesembolso = montoAprobado
            .subtract(renovacion.getMontoPagosRestantes())
            .subtract(multasPendientesAmt)
            .subtract(calculoNuevo.pagoAdelantado());

    // ── Guardar estado aprobado ──────────────────────────────────────
    renovacion.setEstado(EstadoRenovacion.APROBADO);
    renovacion.setMontoAprobado(montoAprobado);
    renovacion.setAprobadoPor(aprobador);
    renovacion.setFechaAprobacion(DateTimeUtils.ahoraEnMagno());
    renovacion.setMultasCondonadas(totalCondonado);
    renovacion.setMontoDesembolso(montoDesembolso);
    renovacionRepo.save(renovacion);

    log.info("Renovación APROBADA — renovacion.id=" + renovacion.getId()
            + " monto_aprobado=" + montoAprobado
            + " multas_condonadas=" + totalCondonado
            + " aprobado_por=" + aprobador.getNombreCompleto());

    List<MultaCondonadaDTO> condonadasDTO = multasCondonadas.stream()
            .map(MultaCondonadaDTO::from)
            .toList();
    return RenovacionDetalleDTO.from(renovacion, condonadasDTO);
}
```

Nota: agregar los imports necesarios al inicio del archivo:
```java
import com.magno.dto.renovacion.MultaCondonadaDTO;
import com.magno.model.Multa;
```

- [ ] **Step 2: Actualizar `confirmarDesembolso()` — excluir multas condonadas**

En el paso 2 del método (líneas 324–329), reemplazar:
```java
// ANTES:
multaRepo.findByCreditoIdAndCobradaFalseAndDeletedAtIsNull(creditoAnterior.getId())
        .forEach(m -> {
            m.setCobrada(true);
            multaRepo.save(m);
        });

// DESPUÉS:
multaRepo.findByCreditoIdAndCobradaFalseAndCondonadaFalseAndDeletedAtIsNull(creditoAnterior.getId())
        .forEach(m -> {
            m.setCobrada(true);
            multaRepo.save(m);
        });
```

- [ ] **Step 3: Actualizar llamadas a `RenovacionDetalleDTO.from()` en el resto del servicio**

Los métodos `crearSolicitud()`, `rechazarRenovacion()`, y `confirmarDesembolso()` usan `RenovacionDetalleDTO.from(renovacion)` — esto sigue funcionando porque el método sin parámetros de condonadas retorna `List.of()`.

No se requieren cambios adicionales en esos métodos.

- [ ] **Step 4: Actualizar los métodos que devuelven listas (getPendientes, getMisSolicitudes, getPendientesDesembolso)**

Para las renovaciones que ya tienen multas condonadas, necesitamos cargar el detalle desde la BD. Agregar un helper privado:

```java
private List<MultaCondonadaDTO> cargarCondonadasDetalle(Renovacion r) {
    if (r.getMultasCondonadas() == null || r.getMultasCondonadas().compareTo(BigDecimal.ZERO) == 0) {
        return List.of();
    }
    return multaRepo.findByCreditoIdAndDeletedAtIsNullOrderByFechaDesc(r.getCreditoAnterior().getId())
            .stream()
            .filter(m -> Boolean.TRUE.equals(m.getCondonada())
                    && m.getCondonadaEnRenovacion() != null
                    && m.getCondonadaEnRenovacion().getId().equals(r.getId()))
            .map(MultaCondonadaDTO::from)
            .toList();
}
```

Y actualizar los streams de los métodos de lista:

```java
// getPendientes():
.map(r -> RenovacionDetalleDTO.from(r, cargarCondonadasDetalle(r)))

// getMisSolicitudes():
.map(r -> RenovacionDetalleDTO.from(r, cargarCondonadasDetalle(r)))

// getPendientesDesembolso():
.map(r -> RenovacionDetalleDTO.from(r, cargarCondonadasDetalle(r)))
```

- [ ] **Step 5: Agregar método público `getMultasPendientes(Long renovacionId)`**

```java
public List<MultaDTO> getMultasPendientesByRenovacion(Long renovacionId) {
    Renovacion renovacion = findRenovacion(renovacionId);
    Long creditoAnteriorId = renovacion.getCreditoAnterior().getId();
    return multaRepo.findPendientesByCreditoId(creditoAnteriorId)
            .stream()
            .map(MultaDTO::from)
            .toList();
}
```

Agregar import: `import com.magno.dto.cobros.MultaDTO;`

- [ ] **Step 6: Compilar**

```bash
cd backend && mvn compile -q 2>&1 | grep "ERROR" | head -20
```

Expected: errores en `RenovacionController` por firma cambiada de `aprobarRenovacion` — se resuelven en Task 8.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/magno/service/RenovacionService.java
git commit -m "feat: lógica de condonación en aprobarRenovacion y confirmarDesembolso"
```

---

## Task 8: Controller — `RenovacionController`

**Files:**
- Modify: `backend/src/main/java/com/magno/controller/RenovacionController.java`

- [ ] **Step 1: Actualizar el endpoint `aprobar`**

Reemplazar el método `aprobar` (líneas 76–86):

```java
@PatchMapping("/{id}/aprobar")
@PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
public ResponseEntity<RenovacionDetalleDTO> aprobar(
        @PathVariable Long id,
        @RequestBody(required = false) RenovacionAprobarRequest req,
        Authentication auth) {

    JwtPrincipal p = principal(auth);
    BigDecimal montoAprobado = req != null ? req.montoAprobado() : null;
    List<Long> multasCondonadas = req != null ? req.multasCondonadasIds() : null;
    String motivo = req != null ? req.motivoCondonacion() : null;
    return ResponseEntity.ok(
            renovacionService.aprobarRenovacion(id, montoAprobado, multasCondonadas, motivo, p.userId()));
}
```

Agregar import al inicio: `import java.util.List;` (ya puede estar presente).

- [ ] **Step 2: Agregar endpoint `GET /{id}/multas-pendientes`**

Agregar después del endpoint `aprobar`:

```java
// ────────────────────────────────────────────────────────────────────
// GET /api/renovaciones/{id}/multas-pendientes
// Multas individuales pendientes del crédito anterior, para selección
// de condonación en la pantalla de aprobación.
// Solo ADMINISTRADOR y SUPERVISOR
// ────────────────────────────────────────────────────────────────────

@GetMapping("/{id}/multas-pendientes")
@PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR')")
public ResponseEntity<List<com.magno.dto.cobros.MultaDTO>> multasPendientes(
        @PathVariable Long id) {
    return ResponseEntity.ok(renovacionService.getMultasPendientesByRenovacion(id));
}
```

- [ ] **Step 3: Compilar y verificar que todo el backend compila**

```bash
cd backend && mvn compile -q 2>&1 | grep "ERROR" | head -20
```

Expected: solo errores en `CajaService` por el constructor del DTO actualizado.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/controller/RenovacionController.java
git commit -m "feat: actualizar controller — aprobar con condonación + endpoint multas-pendientes"
```

---

## Task 9: Service — `CajaService`

**Files:**
- Modify: `backend/src/main/java/com/magno/service/CajaService.java`

- [ ] **Step 1: Inyectar `MultaRepository` en el constructor**

En el constructor de `CajaService`, agregar `MultaRepository multaRepo`:

```java
// Agregar el campo:
private final MultaRepository multaRepo;

// Actualizar el constructor para incluirlo:
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
        MultaRepository multaRepo) {  // NUEVO
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
    this.multaRepo = multaRepo;  // NUEVO
}
```

Agregar import: `import com.magno.repository.MultaRepository;`

- [ ] **Step 2: Actualizar `getPreviewCierre()` para incluir multas de renovaciones**

Después del bloque existente de multas (líneas 335–344), agregar las dos nuevas queries:

```java
// Ya existente:
List<MultaAsesorItemDTO> multasPorAsesor = pagoRepo
        .findMultasPorAsesorBySucursalAndFecha(effectiveId, hoy)
        .stream()
        .map(row -> new MultaAsesorItemDTO(
                (String) row[0],
                (BigDecimal) row[1]))
        .toList();
BigDecimal totalMultas = multasPorAsesor.stream()
        .map(MultaAsesorItemDTO::totalMultas)
        .reduce(BigDecimal.ZERO, BigDecimal::add);

// NUEVAS queries:
BigDecimal multasCobrasRenovaciones = multaRepo
        .sumMultasCobrasViaRenovacionBySucursalAndFecha(effectiveId, hoy);
BigDecimal totalMultasCondonadas = multaRepo
        .sumMultasCondonadasBySucursalAndFecha(effectiveId, hoy);
```

Actualizar el `return` para incluir los nuevos campos:

```java
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
        multasCobrasRenovaciones,    // NUEVO
        totalMultasCondonadas);      // NUEVO
```

- [ ] **Step 3: Compilar — debe compilar limpio**

```bash
cd backend && mvn compile -q 2>&1 | grep "ERROR" | head -20
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/service/CajaService.java
git commit -m "feat: incluir multas cobradas/condonadas en renovaciones en el preview de caja"
```

---

## Task 10: Unit Tests — `RenovacionCondonacionTest`

**Files:**
- Create: `backend/src/test/java/com/magno/service/RenovacionCondonacionTest.java`

- [ ] **Step 1: Crear el test**

```java
package com.magno.service;

import com.magno.model.*;
import com.magno.repository.*;
import com.magno.util.DateTimeUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RenovacionCondonacionTest {

    private MultaRepository multaRepo;
    private RenovacionRepository renovacionRepo;
    private UsuarioRepository usuarioRepo;
    private CreditoRepository creditoRepo;
    private CalendarioPagoRepository calendarioPagoRepo;
    private CreditoCalculoService calculoService;
    private ConfigUmbralRenovacionRepository configUmbralRepo;
    private RenovacionService service;

    // Objetos reutilizables
    private Sucursal sucursal;
    private Cliente cliente;
    private Usuario asesor;
    private Usuario gerente;
    private Credito creditoAnterior;
    private Renovacion renovacion;
    private Multa multa1;
    private Multa multa2;

    @BeforeEach
    void setUp() {
        multaRepo = mock(MultaRepository.class);
        renovacionRepo = mock(RenovacionRepository.class);
        usuarioRepo = mock(UsuarioRepository.class);
        creditoRepo = mock(CreditoRepository.class);
        calendarioPagoRepo = mock(CalendarioPagoRepository.class);
        calculoService = mock(CreditoCalculoService.class);
        configUmbralRepo = mock(ConfigUmbralRenovacionRepository.class);

        service = new RenovacionService(
                renovacionRepo, creditoRepo, calendarioPagoRepo,
                multaRepo, usuarioRepo, calculoService, configUmbralRepo);

        sucursal = new Sucursal();
        sucursal.setId(1L);
        sucursal.setNombre("Sucursal Test");

        cliente = new Cliente();
        cliente.setId(10L);
        cliente.setNombreCompleto("Juan Test");

        asesor = new Usuario();
        asesor.setId(20L);
        asesor.setNombreCompleto("Asesor Test");
        asesor.setSucursal(sucursal);

        gerente = new Usuario();
        gerente.setId(30L);
        gerente.setNombreCompleto("Gerente Test");
        gerente.setSucursal(sucursal);

        creditoAnterior = new Credito();
        creditoAnterior.setId(100L);
        creditoAnterior.setCliente(cliente);
        creditoAnterior.setAsesor(asesor);
        creditoAnterior.setSucursal(sucursal);
        creditoAnterior.setEstado(EstadoCredito.ACTIVO);
        creditoAnterior.setTipoPago(TipoPago.DIARIO);
        creditoAnterior.setPlazoDias(25);
        creditoAnterior.setPagoPeriodico(new BigDecimal("416.00"));
        creditoAnterior.setMontoCapital(new BigDecimal("8000.00"));

        renovacion = new Renovacion();
        renovacion.setId(1L);
        renovacion.setCreditoAnterior(creditoAnterior);
        renovacion.setCliente(cliente);
        renovacion.setAsesor(asesor);
        renovacion.setEstado(EstadoRenovacion.SOLICITADO);
        renovacion.setMontoNuevo(new BigDecimal("10000.00"));
        renovacion.setTipoPago(TipoPago.DIARIO);
        renovacion.setFecha(LocalDate.now());
        renovacion.setPagosRestantes(8);
        renovacion.setMontoPagosRestantes(new BigDecimal("3328.00"));
        renovacion.setMultasPendientes(new BigDecimal("150.00"));
        renovacion.setMultasCondonadas(BigDecimal.ZERO);
        renovacion.setPagoAdelantado(new BigDecimal("416.00"));
        renovacion.setMontoDesembolso(new BigDecimal("5856.00"));

        multa1 = new Multa();
        multa1.setId(201L);
        multa1.setCredito(creditoAnterior);
        multa1.setCliente(cliente);
        multa1.setTipo("NO_PAGO");
        multa1.setMonto(new BigDecimal("100.00"));
        multa1.setFecha(LocalDate.now().minusDays(3));
        multa1.setCobrada(false);
        multa1.setCondonada(false);

        multa2 = new Multa();
        multa2.setId(202L);
        multa2.setCredito(creditoAnterior);
        multa2.setCliente(cliente);
        multa2.setTipo("INCOMPLETO");
        multa2.setMonto(new BigDecimal("50.00"));
        multa2.setFecha(LocalDate.now().minusDays(1));
        multa2.setCobrada(false);
        multa2.setCondonada(false);

        // Mocks comunes
        when(renovacionRepo.findById(1L)).thenReturn(Optional.of(renovacion));
        when(usuarioRepo.findById(30L)).thenReturn(Optional.of(gerente));
        when(multaRepo.findById(201L)).thenReturn(Optional.of(multa1));
        when(multaRepo.findById(202L)).thenReturn(Optional.of(multa2));
        when(multaRepo.save(any(Multa.class))).thenAnswer(inv -> inv.getArgument(0));
        when(renovacionRepo.save(any(Renovacion.class))).thenAnswer(inv -> inv.getArgument(0));

        // Calculo mock para desembolso
        var resumen = mock(CreditoCalculoService.ResumenCalculo.class);
        when(resumen.pagoAdelantado()).thenReturn(new BigDecimal("400.00"));
        when(resumen.tasa()).thenReturn(new BigDecimal("0.30"));
        when(resumen.cargoFinanciero()).thenReturn(new BigDecimal("3000.00"));
        when(resumen.totalAPagar()).thenReturn(new BigDecimal("13000.00"));
        when(resumen.pagoPeriodico()).thenReturn(new BigDecimal("520.00"));
        when(resumen.plazo()).thenReturn(25);
        when(resumen.capital()).thenReturn(new BigDecimal("10000.00"));
        when(calculoService.calcularCredito(any(), any())).thenReturn(resumen);
    }

    @Test
    void aprobar_sinCondonaciones_funciona() {
        when(multaRepo.sumMontosPendientesByCreditoId(100L))
                .thenReturn(new BigDecimal("150.00"));

        var dto = service.aprobarRenovacion(1L, null, null, null, 30L);

        assertThat(dto.estado()).isEqualTo("APROBADO");
        assertThat(dto.multasCondonadas()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(dto.multasCondonadasDetalle()).isEmpty();
        verify(multaRepo, never()).save(any());
    }

    @Test
    void aprobar_conCondonacionParcial_marcaMultasYRecalculaDesembolso() {
        // Solo condona multa1 ($100), deja multa2 ($50) para descontar
        when(multaRepo.sumMontosPendientesByCreditoId(100L))
                .thenReturn(new BigDecimal("50.00")); // post-condonación solo queda multa2

        var dto = service.aprobarRenovacion(
                1L,
                new BigDecimal("10000.00"),
                List.of(201L),
                "Cliente tiene historial limpio",
                30L);

        assertThat(dto.estado()).isEqualTo("APROBADO");
        assertThat(dto.multasCondonadas()).isEqualByComparingTo(new BigDecimal("100.00"));
        assertThat(dto.multasCondonadasDetalle()).hasSize(1);
        assertThat(dto.multasCondonadasDetalle().get(0).id()).isEqualTo(201L);
        assertThat(multa1.getCondonada()).isTrue();
        assertThat(multa1.getCondonadaPor().getId()).isEqualTo(30L);
        assertThat(multa1.getMotivoCondonacion()).isEqualTo("Cliente tiene historial limpio");
    }

    @Test
    void aprobar_conCondonacionSinMotivo_lanzaExcepcion() {
        assertThatThrownBy(() ->
                service.aprobarRenovacion(1L, null, List.of(201L), null, 30L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("motivo");
    }

    @Test
    void aprobar_multaDeOtroCredito_lanzaExcepcion() {
        Credito otroCredito = new Credito();
        otroCredito.setId(999L);
        multa1.setCredito(otroCredito);

        assertThatThrownBy(() ->
                service.aprobarRenovacion(1L, null, List.of(201L), "motivo", 30L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no pertenece");
    }

    @Test
    void aprobar_multaYaCobrada_lanzaExcepcion() {
        multa1.setCobrada(true);

        assertThatThrownBy(() ->
                service.aprobarRenovacion(1L, null, List.of(201L), "motivo", 30L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ya fue cobrada");
    }

    @Test
    void aprobar_multaYaCondonada_lanzaExcepcion() {
        multa1.setCondonada(true);

        assertThatThrownBy(() ->
                service.aprobarRenovacion(1L, null, List.of(201L), "motivo", 30L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ya fue condonada");
    }
}
```

- [ ] **Step 2: Ejecutar los tests**

```bash
cd backend && mvn test -pl . -Dtest=RenovacionCondonacionTest -q 2>&1 | tail -20
```

Expected:
```
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/com/magno/service/RenovacionCondonacionTest.java
git commit -m "test: agregar tests unitarios para condonación de multas en renovaciones"
```

---

## Task 11: Frontend — Types (`index.ts`)

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Agregar tipo `MultaCondonada`**

Insertar después de `RenovacionCalculo` (antes de `RenovacionDetalle`, cerca de línea 588):

```typescript
export interface MultaItem {
  id: number
  creditoId: number
  clienteId: number
  pagoId: number | null
  tipo: 'NO_PAGO' | 'INCOMPLETO'
  monto: number
  fecha: string
  cobrada: boolean
  cobradaEnPagoId: number | null
  condonada: boolean
  condonadaEnRenovacionId: number | null
  condonadaPorNombre: string | null
  fechaCondonacion: string | null
  motivoCondonacion: string | null
}

export interface MultaCondonada {
  id: number
  monto: number
  tipo: 'NO_PAGO' | 'INCOMPLETO'
  fecha: string
  motivoCondonacion: string | null
  condonadaPorNombre: string | null
  fechaCondonacion: string | null
}
```

- [ ] **Step 2: Actualizar `RenovacionDetalle`**

Agregar campos nuevos después de `multasPendientes`:

```typescript
export interface RenovacionDetalle {
  id: number
  cliente: { id: number; nombreCompleto: string; celular: string }
  asesor: { id: number; nombreCompleto: string; sucursalNombre: string }
  creditoAnterior: { id: number; montoCapital: number; plazoDias: number; pagoPeriodico: number; estado: string }
  creditoNuevo: { id: number; montoCapital: number; plazoDias: number; pagoPeriodico: number; estado: string } | null
  fecha: string
  estado: EstadoRenovacion
  aprobadoPor: { id: number; nombreCompleto: string } | null
  fechaAprobacion: string | null
  motivoRechazo: string | null
  montoNuevo: number
  montoAprobado: number | null
  confirmadoPor: { id: number; nombreCompleto: string } | null
  fechaConfirmacion: string | null
  tipoPago: TipoPago
  pagosRestantes: number
  montoPagosRestantes: number
  multasPendientes: number
  multasCondonadas: number           // NUEVO
  motivoCondonacion: string | null   // NUEVO
  multasCondonadasDetalle: MultaCondonada[]  // NUEVO
  pagoAdelantado: number
  montoDesembolso: number
  garantiaDescripcion: string | null
  videoEntregaUrl: string | null
  evidenciaUrls: string[]
  createdAt: string
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat: agregar tipos MultaItem, MultaCondonada y actualizar RenovacionDetalle"
```

---

## Task 12: Frontend — `renovacionService.ts`

**Files:**
- Modify: `frontend/src/services/renovacionService.ts`

- [ ] **Step 1: Actualizar `normalizeDetalle` para mapear los nuevos campos**

En la función `normalizeDetalle` (después de `multasPendientes`), agregar:

```typescript
multasCondonadas: Number(raw.multasCondonadas ?? raw.multas_condonadas ?? 0),
motivoCondonacion: raw.motivoCondonacion ?? raw.motivo_condonacion ?? null,
multasCondonadasDetalle: (raw.multasCondonadasDetalle ?? raw.multas_condonadas_detalle ?? []).map((c: any) => ({
  id: c.id,
  monto: Number(c.monto),
  tipo: c.tipo,
  fecha: c.fecha,
  motivoCondonacion: c.motivoCondonacion ?? c.motivo_condonacion ?? null,
  condonadaPorNombre: c.condonadaPorNombre ?? c.condonada_por_nombre ?? null,
  fechaCondonacion: c.fechaCondonacion ?? c.fecha_condonacion ?? null,
})),
```

- [ ] **Step 2: Agregar función `aprobar` con soporte de condonaciones**

La función `aprobar` actual envía el body de aprobación. Actualizar la firma y el body:

Al final del archivo (o donde esté la función de aprobación), agregar la función de multas pendientes y actualizar la de aprobar. Si `aprobar` ya existe como una llamada inline en el componente, la actualización se hará en el componente (Task 14).

Agregar al objeto `renovacionService`:

```typescript
getMultasPendientes: (renovacionId: number): Promise<import('@/types').MultaItem[]> =>
  api.get(`/renovaciones/${renovacionId}/multas-pendientes`)
    .then(r => (r.data ?? []).map((m: any) => ({
      id: m.id,
      creditoId: m.creditoId ?? m.credito_id,
      clienteId: m.clienteId ?? m.cliente_id,
      pagoId: m.pagoId ?? m.pago_id ?? null,
      tipo: m.tipo,
      monto: Number(m.monto),
      fecha: m.fecha,
      cobrada: Boolean(m.cobrada),
      cobradaEnPagoId: m.cobradaEnPagoId ?? m.cobrada_en_pago_id ?? null,
      condonada: Boolean(m.condonada),
      condonadaEnRenovacionId: m.condonadaEnRenovacionId ?? null,
      condonadaPorNombre: m.condonadaPorNombre ?? null,
      fechaCondonacion: m.fechaCondonacion ?? null,
      motivoCondonacion: m.motivoCondonacion ?? null,
    }))),

aprobar: (id: number, payload: {
  montoAprobado?: number | null,
  multasCondonadasIds?: number[],
  motivoCondonacion?: string,
}): Promise<import('@/types').RenovacionDetalle> =>
  api.patch(`/renovaciones/${id}/aprobar`, payload)
    .then(r => normalizeDetalle(r.data)),
```

Verificar si ya existe una función `aprobar` en el servicio — si es así, reemplazarla. Si las llamadas están directamente con `api.patch` en el componente, actualizar el componente directamente en Task 14.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/renovacionService.ts
git commit -m "feat: agregar getMultasPendientes y actualizar aprobar en renovacionService"
```

---

## Task 13: Frontend — `cajaService.ts`

**Files:**
- Modify: `frontend/src/services/cajaService.ts`

- [ ] **Step 1: Actualizar la interfaz `CajaCierrePreview`**

Agregar los dos campos nuevos:

```typescript
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
  multasCobrasRenovaciones: number    // NUEVO
  totalMultasCondonadas: number       // NUEVO
}
```

- [ ] **Step 2: Actualizar el mapper de `getPreviewCierre`**

Agregar los dos campos en el `.then(r => { ... })`:

```typescript
multasCobrasRenovaciones: Number(d.multasCobrasRenovaciones ?? d.multas_cobras_renovaciones ?? 0),
totalMultasCondonadas:    Number(d.totalMultasCondonadas ?? d.total_multas_condonadas ?? 0),
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/cajaService.ts
git commit -m "feat: actualizar cajaService con campos de multas de renovaciones"
```

---

## Task 14: Frontend — `TabPendientesRenovacion.tsx`

**Files:**
- Modify: `frontend/src/pages/renovaciones/TabPendientesRenovacion.tsx`

- [ ] **Step 1: Ampliar `TarjetaProps` con estado de condonación**

Agregar al interface `TarjetaProps`:

```typescript
interface TarjetaProps {
  renovacion: RenovacionDetalle
  dismissing: boolean
  montoAprobadoStr: string
  onMontoAprobadoChange: (val: string) => void
  montoDesembolsoCalculado: number | null
  calculandoMonto: boolean
  onAprobar: () => void
  onRechazar: () => void
  loadingAprobar: boolean
  loadingRechazar: boolean
  // Condonación
  multasPendientesLista: import('@/types').MultaItem[]
  loadingMultas: boolean
  multasSeleccionadas: Set<number>
  onToggleMulta: (id: number) => void
  motivoCondonacion: string
  onMotivoChange: (v: string) => void
}
```

- [ ] **Step 2: Agregar sección de multas individuales en `TarjetaPendiente`**

Reemplazar el bloque existente de `tieneMultas` (el `div` rojo de alerta con multas pendientes, líneas ~180–193) por:

```tsx
{tieneMultas ? (
  <div className="space-y-2">
    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-red-700">Multas pendientes</p>
        <p className="text-sm font-bold text-red-600">{fmt(r.multasPendientes)}</p>
      </div>
    </div>

    {/* Lista individual de multas para condonar */}
    {loadingMultas ? (
      <p className="text-xs text-gray-400 pl-1">Cargando multas…</p>
    ) : (
      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {multasPendientesLista.map(m => (
          <label key={m.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-[#3d6b35]"
              checked={multasSeleccionadas.has(m.id)}
              onChange={() => onToggleMulta(m.id)}
            />
            <span className="text-xs text-gray-500 flex-1">
              {m.tipo === 'NO_PAGO' ? 'No pagó' : 'Pago incompleto'} · {m.fecha}
            </span>
            <span className={`text-xs font-semibold tabular-nums ${multasSeleccionadas.has(m.id) ? 'line-through text-gray-400' : 'text-red-600'}`}>
              {fmt(m.monto)}
            </span>
          </label>
        ))}
      </div>
    )}

    {/* Campo de motivo — aparece al seleccionar ≥1 multa */}
    {multasSeleccionadas.size > 0 && (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Motivo de condonación <span className="text-red-500">*</span>
        </label>
        <textarea
          value={motivoCondonacion}
          onChange={e => onMotivoChange(e.target.value)}
          rows={2}
          placeholder="Ej: Cliente con historial limpio, acuerdo comercial…"
          className="input w-full resize-none text-xs"
        />
      </div>
    )}
  </div>
) : (
  <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
    <p className="text-xs text-gray-500">Sin multas pendientes</p>
  </div>
)}
```

- [ ] **Step 3: Actualizar la sección de desglose de montos**

Reemplazar la fila de "Multas a descontar" (líneas ~246–252) por un desglose dinámico:

```tsx
{/* Multas */}
{Number(r.multasPendientes) > 0 && (
  <div className="space-y-1 border-t border-gray-100 pt-2">
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">Multas pendientes</span>
      <span className="font-medium text-red-500">{fmt(r.multasPendientes)}</span>
    </div>
    {multasSeleccionadas.size > 0 && (
      <>
        <div className="flex items-center justify-between text-xs pl-3">
          <span className="text-green-600">└ A condonar</span>
          <span className="text-green-600 font-medium">
            −{fmt(multasPendientesLista.filter(m => multasSeleccionadas.has(m.id)).reduce((s, m) => s + Number(m.monto), 0))}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs pl-3">
          <span className="text-gray-500">└ A descontar</span>
          <span className="font-medium text-gray-700">
            {fmt(Number(r.multasPendientes) - multasPendientesLista.filter(m => multasSeleccionadas.has(m.id)).reduce((s, m) => s + Number(m.monto), 0))}
          </span>
        </div>
      </>
    )}
    {multasSeleccionadas.size === 0 && (
      <div className="flex items-center justify-between text-xs pl-3">
        <span className="text-gray-400">└ A descontar</span>
        <span className="font-semibold text-red-500">{fmt(r.multasPendientes)}</span>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Actualizar el estado en el componente padre (o donde se gestiona el estado de cada tarjeta)**

En el componente padre (`TabPendientesRenovacion`), para cada renovación agregar estado de condonación:

```typescript
// Estado local por renovación:
const [multasSeleccionadas, setMultasSeleccionadas] = useState<Map<number, Set<number>>>(new Map())
const [motivoCondonacion, setMotivoCondonacion] = useState<Map<number, string>>(new Map())

// Query de multas pendientes por renovación (se carga al montar):
const { data: multasMap } = useQuery({
  queryKey: ['multas-pendientes-renovaciones', pendientes?.map(r => r.id)],
  queryFn: async () => {
    if (!pendientes?.length) return {}
    const entries = await Promise.all(
      pendientes.map(r => renovacionService.getMultasPendientes(r.id).then(m => [r.id, m] as const))
    )
    return Object.fromEntries(entries)
  },
  enabled: !!pendientes?.length,
})
```

- [ ] **Step 5: Actualizar la mutación de aprobar para enviar multas seleccionadas**

En la mutación `useMutation` para aprobar, agregar los campos de condonación al payload:

```typescript
mutationFn: ({ renovacionId, montoAprobado }: { renovacionId: number; montoAprobado?: number }) => {
  const seleccionadas = multasSeleccionadas.get(renovacionId)
  const motivo = motivoCondonacion.get(renovacionId)
  return renovacionService.aprobar(renovacionId, {
    montoAprobado: montoAprobado || undefined,
    multasCondonadasIds: seleccionadas ? Array.from(seleccionadas) : undefined,
    motivoCondonacion: motivo || undefined,
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/renovaciones/TabPendientesRenovacion.tsx
git commit -m "feat: UI de condonación de multas en pantalla de aprobación de renovaciones"
```

---

## Task 15: Frontend — `TabPendientesDesembolso.tsx`

**Files:**
- Modify: `frontend/src/pages/renovaciones/TabPendientesDesembolso.tsx`

- [ ] **Step 1: Actualizar el bloque de multas en `TarjetaDesembolso`**

Reemplazar el bloque de multas de la zona izquierda (líneas ~77–91):

```tsx
{/* Multas — con desglose de condonadas */}
{(() => {
  const pendientes = Number(r.multasPendientes)
  const condonadas = Number(r.multasCondonadas ?? 0)
  const aDescontar = pendientes - condonadas

  if (pendientes === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5">
        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        <p className="text-xs text-gray-500">Sin multas pendientes</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {condonadas > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-green-700">Multas condonadas</p>
            <p className="text-sm font-bold text-green-600">{fmt(condonadas)}</p>
          </div>
        </div>
      )}
      {aDescontar > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-red-700">Multas a descontar</p>
            <p className="text-sm font-bold text-red-600">{fmt(aDescontar)}</p>
          </div>
        </div>
      )}
      {condonadas > 0 && r.motivoCondonacion && r.aprobadoPor && (
        <p className="text-xs text-gray-400 pl-1 italic">
          Condonadas por {r.aprobadoPor.nombreCompleto} — "{r.motivoCondonacion}"
        </p>
      )}
    </div>
  )
})()}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/renovaciones/TabPendientesDesembolso.tsx
git commit -m "feat: mostrar desglose de multas condonadas en pantalla de desembolso"
```

---

## Task 16: Frontend — `CajaCierrePage.tsx`

**Files:**
- Modify: `frontend/src/pages/caja/CajaCierrePage.tsx`

- [ ] **Step 1: Actualizar la sección "Multas Cobradas"**

Reemplazar la sección completa de Multas (líneas ~419–449):

```tsx
{/* ── Multas ───────────────────────────────────────────────── */}
<Section
  title="Multas"
  defaultOpen={preview.totalMultasCobradas > 0 || preview.totalMultasCondonadas > 0}
>
  {/* Multas diarias por asesor */}
  {preview.multasPorAsesor.length === 0 && preview.multasCobrasRenovaciones === 0 ? (
    <p className="text-[13px] text-[#adb5bd] text-center py-3">Sin multas cobradas hoy</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="tabla">
        <thead>
          <tr>
            <th>Concepto</th>
            <th className="text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {preview.multasPorAsesor.map(row => (
            <tr key={row.asesorNombre}>
              <td className="text-[13px]">Cobros diarios — {row.asesorNombre}</td>
              <td className="text-right font-mono">{fmtMoney(row.totalMultas)}</td>
            </tr>
          ))}
          {preview.multasCobrasRenovaciones > 0 && (
            <tr>
              <td className="text-[13px]">Cobradas en renovaciones</td>
              <td className="text-right font-mono">{fmtMoney(preview.multasCobrasRenovaciones)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )}

  {/* Total cobrado */}
  {(preview.totalMultasCobradas + preview.multasCobrasRenovaciones) > 0 && (
    <div className="mt-2 text-right text-[13px]">
      <span className="text-[#6c757d]">Total cobrado: </span>
      <span className="font-semibold font-mono">
        {fmtMoney(preview.totalMultasCobradas + preview.multasCobrasRenovaciones)}
      </span>
    </div>
  )}

  {/* Multas condonadas — informativo */}
  {preview.totalMultasCondonadas > 0 && (
    <div className="mt-3 pt-3 border-t border-dashed border-gray-200 flex items-center justify-between text-[13px]">
      <span className="text-red-500 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
        Condonadas en renovaciones <span className="text-gray-400 font-normal">(informativo)</span>
      </span>
      <span className="font-semibold font-mono text-red-500">
        −{fmtMoney(preview.totalMultasCondonadas)}
      </span>
    </div>
  )}
</Section>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/caja/CajaCierrePage.tsx
git commit -m "feat: mostrar multas cobradas/condonadas en renovaciones en el cierre de caja"
```

---

## Self-Review

### Spec Coverage

| Requerimiento del spec | Task que lo implementa |
|---|---|
| 5 columnas nuevas en `multas` | Task 1 (migration) + Task 2 (model) |
| `multas_condonadas` en `renovaciones` | Task 1 + Task 2 |
| Condonación al aprobar (SOLICITADO → APROBADO) | Task 7 |
| Solo ADMINISTRADOR y SUPERVISOR condonan | Task 8 (`@PreAuthorize` en endpoint) |
| Selección individual de multas | Task 6 (query) + Task 14 (UI checkboxes) |
| Motivo obligatorio | Task 7 (validación) + Task 14 (campo) |
| Fórmula desembolso actualizada | Task 6 (`sumMontosPendientesByCreditoId` excluye condonadas) |
| `confirmarDesembolso` no cobra condonadas | Task 7 (query nueva) |
| Endpoint `GET /{id}/multas-pendientes` | Task 8 |
| `CajaCierrePreviewDTO` con 2 campos nuevos | Task 5 |
| Multas cobradas vs condonadas en caja | Task 9 (service) + Task 16 (UI) |
| Detalle de condonación en `RenovacionDetalleDTO` | Task 4 |
| `MultaCondonadaDTO` con auditoría completa | Task 3 |
| `MultaDTO` con campos de condonación | Task 3 |
| UI de condonación en aprobación | Task 14 |
| UI de condonadas en desembolso | Task 15 |
| Tests unitarios de condonación | Task 10 |

### Nombres consistentes a través del plan

- `multasCondonadasIds` — en `RenovacionAprobarRequest`, servicio y controller ✅
- `multasCondonadas` — campo en `Renovacion` y en `RenovacionDetalleDTO` ✅
- `motivoCondonacion` — consistente en todos los DTOs ✅
- `condonada` / `condonadaEnRenovacion` / `condonadaPor` — en entidad `Multa` ✅
- `totalMultasCondonadas` / `multasCobrasRenovaciones` — en `CajaCierrePreviewDTO` y `cajaService.ts` ✅
- `sumMontosPendientesByCreditoId` — excluye condonadas desde Task 6, afecta preview y desembolso ✅
