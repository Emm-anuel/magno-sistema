# Supervisor Multi-Sucursal — Fundación + Clientes (Fase 1+2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Gerente General assign additional sucursales to a Supervisor (`SUPERVISOR_CAMPO`) user, and let that Supervisor switch between their assigned sucursales — via a dropdown — in the Clientes module, seeing and operating on that module exactly as they do today for their home sucursal.

**Architecture:** `usuarios.sucursal_id` stays as the user's home/default sucursal (no JWT changes). A new `usuario_sucursal_adicional` many-to-many table holds extra sucursales a Supervisor is granted. A new `SecurityHelper.tieneAccesoSucursal(principal, sucursalId)` method — checked against the database on every request, not baked into the JWT — replaces the hardcoded `principal.sucursalId()` comparisons in `ClienteController`. The Gerente General assigns additional sucursales from the existing Usuarios admin screen.

**Tech Stack:** Spring Boot 3 / Java 17 / PostgreSQL (Liquibase migrations) on the backend; React 18 / TypeScript / React Query / react-hook-form on the frontend. Backend tests: JUnit 5 + Mockito + AssertJ (existing convention — no controller/integration test infra exists in this codebase, so verification of controller-level behavior is manual/curl, matching how every other controller in this project is verified today). No frontend test runner exists in this repo — frontend verification is `tsc --noEmit` + manual clicks in the browser, matching existing project practice.

**Design note (deviation from the spec's illustrative code):** the spec's `useSucursalScope()` sketch included an ADMINISTRADOR branch. During planning this turned out to be wrong: `ClientesPage.tsx` already has its own, richer ADMINISTRADOR-only sucursal filter (shows "Todas las sucursales" by default, i.e. no filter) that must stay untouched. Folding ADMINISTRADOR into the new hook would force a single-branch selection on admin where today they see everything by default — a regression. So `useSucursalScope()` in this plan only ever returns non-empty `opciones` for `SUPERVISOR_CAMPO` users with assigned sucursales adicionales; every other role gets an empty list (no dropdown, current behavior untouched).

**Scope of this plan:** Spec sections 3, 4 (all), 5.1–5.4 restricted to the Clientes module, and phases 1–2 of section 6. Section 5.3's rollout to Dashboard/Cobros/Créditos Nuevos/Renovaciones/Colocaciones/Historial is **out of scope** — that is a separate follow-up plan written after this one is verified working (spec section 6, phase 3).

---

## File Structure

**Backend — new files:**
- `backend/src/main/resources/db/changelog/V37__usuario_sucursal_adicional.sql` — new join table
- `backend/src/main/java/com/magno/dto/usuario/SucursalesAdicionalesRequest.java` — PUT request body
- `backend/src/test/java/com/magno/security/SecurityHelperTest.java` — unit tests for the new authorization method

**Backend — modified files:**
- `backend/src/main/resources/db/changelog/db.changelog-master.xml` — register V37
- `backend/src/main/java/com/magno/model/Usuario.java` — add `sucursalesAdicionales` relation
- `backend/src/main/java/com/magno/repository/UsuarioRepository.java` — add derived query
- `backend/src/main/java/com/magno/security/SecurityHelper.java` — add `tieneAccesoSucursal`
- `backend/src/main/java/com/magno/dto/usuario/UsuarioDTO.java` — add `sucursalesAdicionales` field
- `backend/src/main/java/com/magno/service/UsuarioService.java` — add get/set methods
- `backend/src/main/java/com/magno/controller/UsuarioController.java` — add GET/PUT endpoints
- `backend/src/main/java/com/magno/security/CajaGuard.java` — add non-breaking overload
- `backend/src/main/java/com/magno/controller/ClienteController.java` — use `tieneAccesoSucursal` instead of hardcoded home checks

**Frontend — new files:**
- `frontend/src/hooks/useSucursalScope.ts` — resolves the Supervisor's selectable sucursales + current selection
- `frontend/src/components/SucursalSelector.tsx` — the `<select>`, renders only when there's a real choice

**Frontend — modified files:**
- `frontend/src/types/index.ts` — `Usuario.sucursales_adicionales`
- `frontend/src/services/api.ts` — `normalizeUsuario` + `usuarioService` methods
- `frontend/src/pages/usuarios/UsuariosPage.tsx` — admin assignment UI
- `frontend/src/pages/clientes/ClientesPage.tsx` — wire the selector into the Clientes list/create flow

---

### Task 1: Migration — `usuario_sucursal_adicional` table

**Files:**
- Create: `backend/src/main/resources/db/changelog/V37__usuario_sucursal_adicional.sql`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`

- [ ] **Step 1: Write the migration SQL**

```sql
-- =============================================================
-- MAGNO — V37: Sucursales adicionales para el rol Supervisor
--
-- Permite que un usuario con rol SUPERVISOR_CAMPO opere/consulte,
-- además de en su sucursal home (usuarios.sucursal_id), en otras
-- sucursales que el Gerente General le asigne explícitamente.
-- =============================================================

CREATE TABLE usuario_sucursal_adicional (
    usuario_id   BIGINT NOT NULL REFERENCES usuarios(id),
    sucursal_id  BIGINT NOT NULL REFERENCES sucursales(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usuario_id, sucursal_id)
);

CREATE INDEX idx_usuario_sucursal_adicional_usuario ON usuario_sucursal_adicional(usuario_id);
```

- [ ] **Step 2: Register the changeset**

In `backend/src/main/resources/db/changelog/db.changelog-master.xml`, replace the closing tag:

```xml
    <changeSet id="V36-gastos-seed-backfill" author="magno">
        <sqlFile
            path="db/changelog/V36__gastos_seed_backfill.sql"
            relativeToChangelogFile="false"
            splitStatements="true"
            stripComments="false"/>
    </changeSet>

</databaseChangeLog>
```

with:

```xml
    <changeSet id="V36-gastos-seed-backfill" author="magno">
        <sqlFile
            path="db/changelog/V36__gastos_seed_backfill.sql"
            relativeToChangelogFile="false"
            splitStatements="true"
            stripComments="false"/>
    </changeSet>

    <changeSet id="V37-usuario-sucursal-adicional" author="magno">
        <sqlFile
            path="db/changelog/V37__usuario_sucursal_adicional.sql"
            relativeToChangelogFile="false"
            splitStatements="true"
            stripComments="false"/>
    </changeSet>

</databaseChangeLog>
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/changelog/V37__usuario_sucursal_adicional.sql backend/src/main/resources/db/changelog/db.changelog-master.xml
git commit -m "feat: add usuario_sucursal_adicional table for Supervisor multi-sucursal access"
```

---

### Task 2: `Usuario` entity — sucursales adicionales relation

**Files:**
- Modify: `backend/src/main/java/com/magno/model/Usuario.java`

- [ ] **Step 1: Add the `@ManyToMany` field**

Add these imports at the top (after the existing `java.time.OffsetDateTime` import):

```java
import java.util.HashSet;
import java.util.Set;
```

Add the field right after the existing `sucursal` field (after line 43, `private Sucursal sucursal;`):

```java
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "usuario_sucursal_adicional",
            joinColumns = @JoinColumn(name = "usuario_id"),
            inverseJoinColumns = @JoinColumn(name = "sucursal_id"))
    @Builder.Default
    private Set<Sucursal> sucursalesAdicionales = new HashSet<>();
```

`FetchType.EAGER` matches the existing `sucursal`/`rol` fields on this entity — both are loaded eagerly so `UsuarioDTO.from()` can be called from `AuthController` outside of an open transaction (confirmed by reading `AuthController.login`/`me()`, which call `usuarioRepo.findByEmail(...)` directly, not through a `@Transactional` service method). A lazy collection here would throw `LazyInitializationException` in those two call sites. With at most a couple of extra sucursales per user and 23 users total, eager fetch has no measurable cost.

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && mvn -q -o compile`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/magno/model/Usuario.java
git commit -m "feat: add sucursalesAdicionales relation to Usuario"
```

---

### Task 3: `UsuarioRepository` — derived query for access checks

**Files:**
- Modify: `backend/src/main/java/com/magno/repository/UsuarioRepository.java`

- [ ] **Step 1: Add the derived query method**

Add inside the interface, after `boolean existsByEmail(String email);`:

```java

    /** Usado por SecurityHelper.tieneAccesoSucursal para validar sucursales adicionales. */
    boolean existsByIdAndSucursalesAdicionales_Id(Long usuarioId, Long sucursalId);
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && mvn -q -o compile`
Expected: no output, exit code 0. (Spring Data validates derived query method names against the entity graph at context startup, not at compile time — full verification happens in Task 4's test, which exercises this method through a mock, and again in Task 8's manual verification, which exercises it against a real running app.)

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/magno/repository/UsuarioRepository.java
git commit -m "feat: add existsByIdAndSucursalesAdicionales_Id to UsuarioRepository"
```

---

### Task 4: `SecurityHelper.tieneAccesoSucursal` (TDD)

**Files:**
- Modify: `backend/src/main/java/com/magno/security/SecurityHelper.java`
- Test: `backend/src/test/java/com/magno/security/SecurityHelperTest.java`

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/com/magno/security/SecurityHelperTest.java`:

```java
package com.magno.security;

import com.magno.repository.ClienteRepository;
import com.magno.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SecurityHelperTest {

    private ClienteRepository clienteRepo;
    private UsuarioRepository usuarioRepo;
    private SecurityHelper securityHelper;

    private static final Long USUARIO_ID = 10L;
    private static final Long HOME_SUCURSAL_ID = 1L;
    private static final Long SUCURSAL_ADICIONAL_ID = 2L;
    private static final Long SUCURSAL_NO_ASIGNADA_ID = 3L;

    @BeforeEach
    void setUp() {
        clienteRepo = mock(ClienteRepository.class);
        usuarioRepo = mock(UsuarioRepository.class);
        securityHelper = new SecurityHelper(clienteRepo, usuarioRepo);
    }

    @Test
    void administrador_tieneAccesoACualquierSucursal() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "admin@magno.mx", "ADMINISTRADOR", HOME_SUCURSAL_ID);

        assertThat(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_NO_ASIGNADA_ID)).isTrue();
    }

    @Test
    void supervisorCampo_tieneAccesoASuSucursalHome() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "supervisor@magno.mx", "SUPERVISOR_CAMPO", HOME_SUCURSAL_ID);

        assertThat(securityHelper.tieneAccesoSucursal(principal, HOME_SUCURSAL_ID)).isTrue();
    }

    @Test
    void supervisorCampo_tieneAccesoASucursalAdicionalAsignada() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "supervisor@magno.mx", "SUPERVISOR_CAMPO", HOME_SUCURSAL_ID);
        when(usuarioRepo.existsByIdAndSucursalesAdicionales_Id(USUARIO_ID, SUCURSAL_ADICIONAL_ID)).thenReturn(true);

        assertThat(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_ADICIONAL_ID)).isTrue();
    }

    @Test
    void supervisorCampo_sinAccesoASucursalNoAsignada() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "supervisor@magno.mx", "SUPERVISOR_CAMPO", HOME_SUCURSAL_ID);
        when(usuarioRepo.existsByIdAndSucursalesAdicionales_Id(USUARIO_ID, SUCURSAL_NO_ASIGNADA_ID)).thenReturn(false);

        assertThat(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_NO_ASIGNADA_ID)).isFalse();
    }

    @Test
    void supervisor_sinAccesoAOtraSucursal_soloVeSuHome() {
        // SUPERVISOR (Gerente de Sucursal) no debe tratarse como "ve todo" — solo ADMINISTRADOR
        // tiene ese bypass. Ver la nota en el spec (docs/superpowers/specs/2026-08-06-supervisor-multi-sucursal-design.md).
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "gerente@magno.mx", "SUPERVISOR", HOME_SUCURSAL_ID);

        assertThat(securityHelper.tieneAccesoSucursal(principal, SUCURSAL_NO_ASIGNADA_ID)).isFalse();
        assertThat(securityHelper.tieneAccesoSucursal(principal, HOME_SUCURSAL_ID)).isTrue();
    }

    @Test
    void sucursalIdNulo_siempreFalse() {
        JwtPrincipal principal = new JwtPrincipal(USUARIO_ID, "admin@magno.mx", "ADMINISTRADOR", HOME_SUCURSAL_ID);

        assertThat(securityHelper.tieneAccesoSucursal(principal, null)).isFalse();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && mvn -q -o test -Dtest=SecurityHelperTest`
Expected: compile error — `SecurityHelper(ClienteRepository, UsuarioRepository)` constructor and `tieneAccesoSucursal` method don't exist yet.

- [ ] **Step 3: Implement `tieneAccesoSucursal`**

Replace the full contents of `backend/src/main/java/com/magno/security/SecurityHelper.java`:

```java
package com.magno.security;

import com.magno.repository.ClienteRepository;
import com.magno.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Helper de seguridad para validaciones de acceso a nivel de negocio.
 * Usado en módulos que requieren filtrado por asesor (Créditos, Renovaciones, Historial)
 * o por sucursal (Clientes y, en fases futuras, el resto de módulos de Supervisor).
 */
@Component
public class SecurityHelper {

    private final ClienteRepository clienteRepo;
    private final UsuarioRepository usuarioRepo;

    public SecurityHelper(ClienteRepository clienteRepo, UsuarioRepository usuarioRepo) {
        this.clienteRepo = clienteRepo;
        this.usuarioRepo = usuarioRepo;
    }

    /**
     * Verifica que el cliente pertenezca al usuario autenticado.
     * Solo aplica para ASESOR_COBRADOR y SUPERVISOR_CAMPO; los roles superiores siempre pasan.
     *
     * @throws ResponseStatusException 403 si el cliente no pertenece al usuario.
     */
    public boolean esMiCliente(Long clienteId, Authentication auth) {
        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        return switch (principal.rol()) {
            case "ASESOR_COBRADOR" -> {
                boolean esAsesor = clienteRepo.findById(clienteId)
                        .map(c -> c.getAsesor() != null && c.getAsesor().getId().equals(principal.userId()))
                        .orElse(false);
                if (!esAsesor) throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No tienes acceso a este cliente");
                yield true;
            }
            case "SUPERVISOR_CAMPO" -> {
                boolean esSucursal = clienteRepo.findById(clienteId)
                        .map(c -> c.getSucursal().getId().equals(principal.sucursalId()))
                        .orElse(false);
                if (!esSucursal) throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No tienes acceso a este cliente");
                yield true;
            }
            default -> true; // ADMINISTRADOR y SUPERVISOR ven todo
        };
    }

    /**
     * Verifica si el usuario autenticado puede operar/consultar datos de una sucursal dada.
     * ADMINISTRADOR: acceso a cualquier sucursal.
     * Cualquier otro rol: su sucursal home, o una sucursal adicional asignada por el
     * Gerente General (tabla usuario_sucursal_adicional).
     */
    public boolean tieneAccesoSucursal(JwtPrincipal principal, Long sucursalId) {
        if (sucursalId == null) return false;
        if ("ADMINISTRADOR".equals(principal.rol())) return true;
        if (sucursalId.equals(principal.sucursalId())) return true;
        return usuarioRepo.existsByIdAndSucursalesAdicionales_Id(principal.userId(), sucursalId);
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && mvn -q -o test -Dtest=SecurityHelperTest`
Expected: `BUILD SUCCESS`, 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/magno/security/SecurityHelper.java backend/src/test/java/com/magno/security/SecurityHelperTest.java
git commit -m "feat: add SecurityHelper.tieneAccesoSucursal with tests"
```

---

### Task 5: `UsuarioDTO` — expose sucursales adicionales

**Files:**
- Modify: `backend/src/main/java/com/magno/dto/usuario/UsuarioDTO.java`

- [ ] **Step 1: Add the field and populate it in `from()`**

Replace the full contents of `backend/src/main/java/com/magno/dto/usuario/UsuarioDTO.java`:

```java
package com.magno.dto.usuario;

import com.magno.model.Usuario;

import java.util.List;

/**
 * Respuesta pública del usuario — nunca incluye password_hash.
 */
public record UsuarioDTO(
                Long id,
                String nombreCompleto,
                String email,
                String telefono,
                String rol,
                SucursalInfo sucursal,
                List<SucursalInfo> sucursalesAdicionales,
                Boolean activo,
                String ineNumero,
                String ineImagenUrl,
                String ineImagenReversoUrl,
                // Domicilio
                String calle,
                String noExterior,
                String noInterior,
                String colonia,
                String municipio,
                String estado,
                String codigoPostal,
                // Referencias
                String ref1Nombre,
                String ref1Telefono,
                String ref1Parentesco,
                String ref2Nombre,
                String ref2Telefono,
                String ref2Parentesco) {

        public record SucursalInfo(
                        Long id,
                        String nombre,
                        String direccion,
                        String telefono,
                        Boolean activa) {

                static SucursalInfo from(com.magno.model.Sucursal s) {
                        return new SucursalInfo(s.getId(), s.getNombre(), s.getDireccion(), s.getTelefono(), s.getActiva());
                }
        }

        /** Convierte una entidad Usuario a DTO. */
        public static UsuarioDTO from(Usuario u) {
                SucursalInfo s = SucursalInfo.from(u.getSucursal());
                List<SucursalInfo> adicionales = u.getSucursalesAdicionales().stream()
                                .map(SucursalInfo::from)
                                .toList();
                return new UsuarioDTO(
                                u.getId(),
                                u.getNombreCompleto(),
                                u.getEmail(),
                                u.getTelefono(),
                                u.getRol().getNombre(),
                                s,
                                adicionales,
                                u.getActivo(),
                                u.getIneNumero(),
                                u.getIneImagenUrl(),
                                u.getIneImagenReversoUrl(),
                                u.getCalle(),
                                u.getNoExterior(),
                                u.getNoInterior(),
                                u.getColonia(),
                                u.getMunicipio(),
                                u.getEstado(),
                                u.getCodigoPostal(),
                                u.getRef1Nombre(),
                                u.getRef1Telefono(),
                                u.getRef1Parentesco(),
                                u.getRef2Nombre(),
                                u.getRef2Telefono(),
                                u.getRef2Parentesco());
        }
}
```

Note: this removes the stale doc comment claiming a "Jackson SNAKE_CASE strategy" — verified against `backend/src/main/resources/application.yml:23` (`property-naming-strategy: LOWER_CAMEL_CASE`) that this was incorrect; the API actually serializes camelCase, which is what the frontend's `toXxxRequestPayload` helpers already assume for outgoing requests.

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && mvn -q -o compile`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/magno/dto/usuario/UsuarioDTO.java
git commit -m "feat: expose sucursalesAdicionales in UsuarioDTO"
```

---

### Task 6: `UsuarioService` — get/set sucursales adicionales

**Files:**
- Modify: `backend/src/main/java/com/magno/service/UsuarioService.java`

- [ ] **Step 1: Add the two methods**

Add at the end of the class, right before the final closing `}` of `backend/src/main/java/com/magno/service/UsuarioService.java` (after `cambiarEstado`):

```java

    /** Lista las sucursales adicionales asignadas a un usuario Supervisor. */
    public List<UsuarioDTO.SucursalInfo> getSucursalesAdicionales(Long usuarioId) {
        Usuario u = usuarioRepo.findById(usuarioId)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + usuarioId));
        return u.getSucursalesAdicionales().stream()
                .map(UsuarioDTO.SucursalInfo::from)
                .toList();
    }

    /**
     * Reemplaza el conjunto completo de sucursales adicionales de un usuario Supervisor.
     * Solo aplica a SUPERVISOR_CAMPO — es el único rol para el que este flujo está expuesto
     * en el admin (ver spec: docs/superpowers/specs/2026-08-06-supervisor-multi-sucursal-design.md).
     */
    @Transactional
    public List<UsuarioDTO.SucursalInfo> setSucursalesAdicionales(Long usuarioId, java.util.List<Long> sucursalIds) {
        Usuario u = usuarioRepo.findById(usuarioId)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + usuarioId));

        if (!"SUPERVISOR_CAMPO".equals(u.getRol().getNombre())) {
            throw new IllegalArgumentException(
                    "Solo se pueden asignar sucursales adicionales a usuarios con rol Supervisor");
        }
        if (sucursalIds.contains(u.getSucursal().getId())) {
            throw new IllegalArgumentException(
                    "La sucursal home del usuario no debe incluirse en sucursales adicionales");
        }

        java.util.List<Sucursal> sucursales = sucursalRepo.findAllById(sucursalIds);
        if (sucursales.size() != sucursalIds.size()) {
            throw new EntityNotFoundException("Una o más sucursales no existen");
        }

        u.setSucursalesAdicionales(new java.util.HashSet<>(sucursales));
        usuarioRepo.save(u);

        return sucursales.stream()
                .map(UsuarioDTO.SucursalInfo::from)
                .toList();
    }
```

This reuses `sucursalRepo` and `usuarioRepo`, both already injected in this service's constructor — no constructor changes needed.

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && mvn -q -o compile`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/magno/service/UsuarioService.java
git commit -m "feat: add UsuarioService methods to manage sucursales adicionales"
```

---

### Task 7: `UsuarioController` — assignment endpoints

**Files:**
- Create: `backend/src/main/java/com/magno/dto/usuario/SucursalesAdicionalesRequest.java`
- Modify: `backend/src/main/java/com/magno/controller/UsuarioController.java`

- [ ] **Step 1: Create the request DTO**

```java
package com.magno.dto.usuario;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record SucursalesAdicionalesRequest(
        @NotNull(message = "sucursalIds no debe ser nulo")
        List<Long> sucursalIds
) {}
```

- [ ] **Step 2: Add the two endpoints**

In `backend/src/main/java/com/magno/controller/UsuarioController.java`, add the import:

```java
import com.magno.dto.usuario.SucursalesAdicionalesRequest;
```

and add `import java.util.List;` next to the existing `import java.util.Map;`.

Add the endpoints right before the closing `}` of the class (after `cambiarEstado`):

```java

    /** GET /api/usuarios/{id}/sucursales-adicionales */
    @GetMapping("/{id}/sucursales-adicionales")
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<List<UsuarioDTO.SucursalInfo>> getSucursalesAdicionales(@PathVariable Long id) {
        return ResponseEntity.ok(usuarioService.getSucursalesAdicionales(id));
    }

    /** PUT /api/usuarios/{id}/sucursales-adicionales  body: { "sucursalIds": [2, 3] } */
    @PutMapping("/{id}/sucursales-adicionales")
    @PreAuthorize("hasAuthority('ADMINISTRADOR')")
    public ResponseEntity<List<UsuarioDTO.SucursalInfo>> setSucursalesAdicionales(
            @PathVariable Long id,
            @Valid @RequestBody SucursalesAdicionalesRequest req) {
        return ResponseEntity.ok(usuarioService.setSucursalesAdicionales(id, req.sucursalIds()));
    }
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && mvn -q -o compile`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/magno/dto/usuario/SucursalesAdicionalesRequest.java backend/src/main/java/com/magno/controller/UsuarioController.java
git commit -m "feat: add sucursales-adicionales assignment endpoints to UsuarioController"
```

---

### Task 8: Backend Fundación — manual verification

No controller/integration test infrastructure exists in this codebase (confirmed: only `MagnoApplicationTests` uses `@SpringBootTest`, everything else is a plain Mockito unit test at the service layer). Verify this slice end-to-end against a running backend instead of writing new test infra.

**Files:** none (verification only)

- [ ] **Step 1: Start the backend against the dev database**

Run: `cd backend && mvn -q -o spring-boot:run` (requires local Postgres/Redis from `application.yml` dev profile to be up)

- [ ] **Step 2: Log in as an ADMINISTRADOR and grab the token**

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<admin-email>","password":"<admin-password>"}' | jq -r .token
```

- [ ] **Step 3: Find a SUPERVISOR_CAMPO user's id and a second sucursal id**

```bash
TOKEN=<paste token>
curl -s http://localhost:8080/api/usuarios?rol=SUPERVISOR_CAMPO -H "Authorization: Bearer $TOKEN" | jq '.content[] | {id, nombreCompleto, sucursal}'
curl -s http://localhost:8080/api/sucursales/admin -H "Authorization: Bearer $TOKEN" | jq '.[] | {id, nombre}'
```

- [ ] **Step 4: Assign a sucursal adicional and verify it round-trips**

```bash
curl -s -X PUT http://localhost:8080/api/usuarios/<supervisorId>/sucursales-adicionales \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"sucursalIds":[<otraSucursalId>]}' | jq

curl -s http://localhost:8080/api/usuarios/<supervisorId>/sucursales-adicionales \
  -H "Authorization: Bearer $TOKEN" | jq
```

Expected: both calls return a one-element array with `id`, `nombre`, etc. of `<otraSucursalId>`.

- [ ] **Step 5: Verify the guardrails**

```bash
# Debe devolver 400 — la sucursal home no puede ser "adicional"
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:8080/api/usuarios/<supervisorId>/sucursales-adicionales \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"sucursalIds":[<supervisorHomeSucursalId>]}'

# Debe devolver 400 — no es SUPERVISOR_CAMPO
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:8080/api/usuarios/<administradorUserId>/sucursales-adicionales \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"sucursalIds":[<otraSucursalId>]}'
```

Expected: both return `400`.

- [ ] **Step 6: Log in as the SUPERVISOR_CAMPO user and confirm `/auth/me` includes the assignment**

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<supervisor-email>","password":"<supervisor-password>"}' | jq '.usuario.sucursalesAdicionales'
```

Expected: array with the assigned sucursal.

No commit for this task — it's a verification checkpoint, not a code change.

---

### Task 9: Frontend types — `Usuario.sucursales_adicionales`

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add the field**

In the `Usuario` interface (currently starting at line 68), add right after `sucursal: Sucursal`:

```typescript
  sucursal: Sucursal
  sucursales_adicionales: Sucursal[]
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: new errors at every place that constructs a `Usuario` object literal without `sucursales_adicionales` — this is intentional, Task 10 fixes the one real construction site (`normalizeUsuario`). If `tsc` reports errors elsewhere, note the file paths — they'll need the same field added, most likely test fixtures or mock data (none are known to exist in this codebase as of this plan, but verify).

- [ ] **Step 3: Commit**

Commit together with Task 10 (same logical change, split for review clarity but they must land as one buildable unit) — see Task 10 Step 3.

---

### Task 10: Frontend API layer — normalize + service methods

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Extend `normalizeUsuario`**

In `normalizeUsuario` (starts at line 5), add a line inside the returned object, right after the `sucursal: { ... }` block (after line 20, before `activo: raw?.activo ?? true,`):

```typescript
    sucursales_adicionales: (raw?.sucursales_adicionales ?? raw?.sucursalesAdicionales ?? []).map((s: any) => ({
      id: s?.id,
      nombre: s?.nombre ?? '',
      direccion: s?.direccion,
      telefono: s?.telefono,
      activa: s?.activa ?? true,
    })),
```

- [ ] **Step 2: Add service methods**

In `usuarioService` (starts at line 350), add after `cambiarEstado`:

```typescript

  getSucursalesAdicionales: (id: number) =>
    api.get<any[]>(`/usuarios/${id}/sucursales-adicionales`).then((r) => r.data.map(normalizeSucursal)),

  setSucursalesAdicionales: (id: number, sucursalIds: number[]) =>
    api.put<any[]>(`/usuarios/${id}/sucursales-adicionales`, { sucursalIds }).then((r) => r.data.map(normalizeSucursal)),
```

`{ sucursalIds }` is sent as camelCase, matching `SucursalesAdicionalesRequest.sucursalIds()` on the backend and the LOWER_CAMEL_CASE Jackson config — confirmed by reading `application.yml:23` and every existing `toXxxRequestPayload` helper in this file, which all build camelCase bodies.

- [ ] **Step 3: Verify and commit (covers Task 9 + Task 10)**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no output.

```bash
git add frontend/src/types/index.ts frontend/src/services/api.ts
git commit -m "feat: add sucursales_adicionales to Usuario type and API layer"
```

---

### Task 11: `UsuariosPage.tsx` — admin assignment UI

**Files:**
- Modify: `frontend/src/pages/usuarios/UsuariosPage.tsx`

- [ ] **Step 1: Import the service and add local state**

`usuarioService` is already imported (line 9). Add `watch` to the `useForm` destructure (currently `register, handleSubmit, getValues, setValue, formState: { errors }` around line 367-372):

```typescript
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateForm>({
```

Add new state right after `const [passwordModified, setPasswordModified] = useState(false)` (line 361):

```typescript
  const [sucursalesAdicionales, setSucursalesAdicionales] = useState<number[]>(
    usuario?.sucursales_adicionales?.map((s) => s.id) ?? [],
  )
```

- [ ] **Step 2: Stop closing the modal from inside the mutations**

The mutations currently call `onSaved()` from their `onSuccess` handler. That runs before the code in `onSubmit` gets a chance to make the follow-up `sucursales-adicionales` call, so the modal would close (and the parent would stop rendering it) mid-save. Move `onSaved()` out of the mutations and call it explicitly at the end of `onSubmit` once everything — including the sucursales-adicionales save — has finished.

Replace (around line 403-422):

```typescript
  const createMutation = useMutation({
    mutationFn: (data: UsuarioCreateRequest) => usuarioService.crear(data),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['usuarios'] })
      toast.success('Usuario creado')
      onSaved()
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al crear usuario'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UsuarioUpdateRequest }) =>
      usuarioService.actualizar(id, data),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['usuarios'] })
      toast.success('Usuario actualizado')
      onSaved()
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al actualizar'),
  })
```

with:

```typescript
  const createMutation = useMutation({
    mutationFn: (data: UsuarioCreateRequest) => usuarioService.crear(data),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['usuarios'] })
      toast.success('Usuario creado')
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al crear usuario'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UsuarioUpdateRequest }) =>
      usuarioService.actualizar(id, data),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['usuarios'] })
      toast.success('Usuario actualizado')
    },
    onError: (e: any) => toast.error(e.message ?? 'Error al actualizar'),
  })
```

- [ ] **Step 3: Save sucursales adicionales after the user is saved**

Replace `onSubmit` (currently lines 465-508):

```typescript
  const onSubmit = async (formData: CreateForm) => {
    setIsProcessing(true)

    try {
      let ineUrl = formData.ine_imagen_url ?? ''
      let ineReversoUrl = formData.ine_imagen_reverso_url ?? ''

      // 1. Subir imagen si hay una nueva seleccionada
      if (ineFile) {
        try {
          ineUrl = await fileService.upload(ineFile, 'usuarios-ine')
        } catch {
          toast.error('Error al subir imagen INE')
          return
        }
        setValue('ine_imagen_url', ineUrl)
      }

      if (ineReversoFile) {
        try {
          ineReversoUrl = await fileService.upload(ineReversoFile, 'usuarios-ine-reverso')
        } catch {
          toast.error('Error al subir reverso de INE')
          return
        }
        setValue('ine_imagen_reverso_url', ineReversoUrl)
      }

      const payload = { ...formData, ine_imagen_url: ineUrl, ine_imagen_reverso_url: ineReversoUrl }

      if (isEdit) {
        if (!passwordModified || !payload.password) {
          delete (payload as any).password
        }
        await editMutation.mutateAsync({ id: usuario!.id, data: payload as UsuarioUpdateRequest })
      } else {
        await createMutation.mutateAsync(payload as UsuarioCreateRequest)
      }
    } catch {
      return
    } finally {
      setIsProcessing(false)
    }
  }
```

with:

```typescript
  const onSubmit = async (formData: CreateForm) => {
    setIsProcessing(true)

    try {
      let ineUrl = formData.ine_imagen_url ?? ''
      let ineReversoUrl = formData.ine_imagen_reverso_url ?? ''

      // 1. Subir imagen si hay una nueva seleccionada
      if (ineFile) {
        try {
          ineUrl = await fileService.upload(ineFile, 'usuarios-ine')
        } catch {
          toast.error('Error al subir imagen INE')
          return
        }
        setValue('ine_imagen_url', ineUrl)
      }

      if (ineReversoFile) {
        try {
          ineReversoUrl = await fileService.upload(ineReversoFile, 'usuarios-ine-reverso')
        } catch {
          toast.error('Error al subir reverso de INE')
          return
        }
        setValue('ine_imagen_reverso_url', ineReversoUrl)
      }

      const payload = { ...formData, ine_imagen_url: ineUrl, ine_imagen_reverso_url: ineReversoUrl }

      let savedId: number
      if (isEdit) {
        if (!passwordModified || !payload.password) {
          delete (payload as any).password
        }
        const saved = await editMutation.mutateAsync({ id: usuario!.id, data: payload as UsuarioUpdateRequest })
        savedId = saved.id
      } else {
        const saved = await createMutation.mutateAsync(payload as UsuarioCreateRequest)
        savedId = saved.id
      }

      if (payload.rol === 'SUPERVISOR_CAMPO') {
        const seleccion = sucursalesAdicionales.filter((id) => id !== payload.sucursal_id)
        try {
          await usuarioService.setSucursalesAdicionales(savedId, seleccion)
        } catch {
          toast.error('Usuario guardado, pero no se pudieron guardar las sucursales adicionales')
        }
      }

      onSaved()
    } catch {
      return
    } finally {
      setIsProcessing(false)
    }
  }
```

The `seleccion` filter drops the currently-selected home sucursal from the adicionales list before saving — it can linger there if the admin picks a sucursal as "adicional" and then changes the "Sucursal \*" dropdown to that same one; without the filter the backend would reject the whole save with a 400 (see `UsuarioService.setSucursalesAdicionales` guard from Task 6).

- [ ] **Step 4: Render the checkbox list**

In the JSX, right after the "Sucursal \*" `<Field>` closes (around line 596, immediately after `</Field>` and before the closing `</div>` of the grid), add:

```tsx

                {watch('rol') === 'SUPERVISOR_CAMPO' && (
                  <div className="md:col-span-2">
                    <label className="text-[13px] font-medium text-[#495057] mb-1.5 block">
                      Sucursales adicionales
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {sucursales
                        .filter((s) => s.id !== Number(watch('sucursal_id')))
                        .map((s) => (
                          <label key={s.id} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 accent-[#2196F3] cursor-pointer"
                              checked={sucursalesAdicionales.includes(s.id)}
                              onChange={(e) => {
                                setSucursalesAdicionales((prev) =>
                                  e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                                )
                              }}
                            />
                            <span className="text-[13px] text-[#495057]">{s.nombre}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
```

- [ ] **Step 5: Verify it typechecks**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/usuarios/UsuariosPage.tsx
git commit -m "feat: assign sucursales adicionales to Supervisor users from UsuariosPage"
```

---

### Task 12: Frontend Fundación — manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start both servers**

Run: `cd backend && mvn -q -o spring-boot:run` (background) and `cd frontend && npm run dev`

- [ ] **Step 2: Log in as ADMINISTRADOR, open Usuarios, edit a SUPERVISOR_CAMPO user**

Confirm: the "Sucursales adicionales" checkbox list appears (only when rol = Supervisor), shows every sucursal except the one currently selected in "Sucursal \*", and pre-checks whatever was assigned via Task 8's curl calls (if that verification was run against the same DB).

- [ ] **Step 3: Check one, save, reopen**

Confirm: toast "Usuario actualizado", modal closes, reopening the same user shows the checkbox still checked (round-tripped through the backend).

- [ ] **Step 4: Change "Sucursal \*" to a sucursal that's currently checked as adicional**

Confirm: that sucursal disappears from the checkbox list (since it can't be both home and adicional) and saving doesn't error (Task 11 Step 3's `seleccion` filter).

- [ ] **Step 5: Switch role to something other than Supervisor**

Confirm: the checkbox list disappears entirely, and saving doesn't attempt to call `setSucursalesAdicionales` (the `payload.rol === 'SUPERVISOR_CAMPO'` guard in `onSubmit`).

No commit for this task.

---

### Task 13: `CajaGuard` — non-breaking overload

**Files:**
- Modify: `backend/src/main/java/com/magno/security/CajaGuard.java`

This adds a second method instead of changing the existing one's signature, so `CreditoController`, `RenovacionController`, and `CobrosController` — all out of scope for this plan (they belong to the Fase 3 rollout) — keep compiling and behaving exactly as they do today.

- [ ] **Step 1: Add the overload**

Replace the full contents of `backend/src/main/java/com/magno/security/CajaGuard.java`:

```java
package com.magno.security;

import com.magno.model.EstadoCaja;
import com.magno.repository.CajaDiaRepository;
import com.magno.util.DateTimeUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

@Component
public class CajaGuard {

    private static final Set<String> ROLES_BLOQUEADOS = Set.of("ASESOR_COBRADOR", "SUPERVISOR_CAMPO");

    private final CajaDiaRepository cajaDiaRepo;

    public CajaGuard(CajaDiaRepository cajaDiaRepo) {
        this.cajaDiaRepo = cajaDiaRepo;
    }

    /** Valida contra la sucursal home del usuario (comportamiento sin cambios). */
    public void validarCajaAbierta(JwtPrincipal principal) {
        validarCajaAbierta(principal, principal.sucursalId());
    }

    /**
     * Valida contra una sucursal explícita — para roles con acceso a más de una sucursal,
     * usar la sucursal efectiva de la operación en curso, no siempre la sucursal home.
     */
    public void validarCajaAbierta(JwtPrincipal principal, Long sucursalId) {
        if (!ROLES_BLOQUEADOS.contains(principal.rol())) return;
        boolean abierta = cajaDiaRepo.existsBySucursalIdAndFechaAndEstado(
                sucursalId, DateTimeUtils.hoyEnMagno(), EstadoCaja.ABIERTA);
        if (!abierta) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "No es posible registrar operaciones — la caja está cerrada");
        }
    }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && mvn -q -o compile`
Expected: no output, exit code 0. All 4 existing call sites (`ClienteController` x2, `CreditoController`, `RenovacionController`, `CobrosController` x2) keep calling the single-argument overload unchanged.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/magno/security/CajaGuard.java
git commit -m "feat: add sucursal-aware overload to CajaGuard.validarCajaAbierta"
```

---

### Task 14: `ClienteController` — wire `tieneAccesoSucursal`

**Files:**
- Modify: `backend/src/main/java/com/magno/controller/ClienteController.java`

- [ ] **Step 1: Inject `SecurityHelper`**

Add the import:

```java
import com.magno.security.SecurityHelper;
```

Replace the constructor (lines 32-42):

```java
    private final ClienteService clienteService;
    private final ClientePdfService clientePdfService;
    private final CajaGuard cajaGuard;

    public ClienteController(ClienteService clienteService,
                             ClientePdfService clientePdfService,
                             CajaGuard cajaGuard) {
        this.clienteService    = clienteService;
        this.clientePdfService = clientePdfService;
        this.cajaGuard         = cajaGuard;
    }
```

with:

```java
    private final ClienteService clienteService;
    private final ClientePdfService clientePdfService;
    private final CajaGuard cajaGuard;
    private final SecurityHelper securityHelper;

    public ClienteController(ClienteService clienteService,
                             ClientePdfService clientePdfService,
                             CajaGuard cajaGuard,
                             SecurityHelper securityHelper) {
        this.clienteService    = clienteService;
        this.clientePdfService = clientePdfService;
        this.cajaGuard         = cajaGuard;
        this.securityHelper    = securityHelper;
    }
```

- [ ] **Step 2: `listar` — validate explicit `sucursalId`, not just default it**

Replace (lines 65-75):

```java
        switch (principal.rol()) {
            case "ASESOR_COBRADOR" ->
                // Solo ve sus propios clientes
                asesorId = principal.userId();
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                // Ve solo los clientes de su sucursal
                if (sucursalId == null)
                    sucursalId = principal.sucursalId();
            }
            // ADMINISTRADOR: sin restricción automática
        }
```

with:

```java
        switch (principal.rol()) {
            case "ASESOR_COBRADOR" ->
                // Solo ve sus propios clientes
                asesorId = principal.userId();
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                if (sucursalId == null) {
                    sucursalId = principal.sucursalId();
                } else if (!securityHelper.tieneAccesoSucursal(principal, sucursalId)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                }
            }
            // ADMINISTRADOR: sin restricción automática
        }
```

(Previously this endpoint didn't validate an explicitly-passed `sucursalId` at all for `SUPERVISOR`/`SUPERVISOR_CAMPO` — it only filled in the default when absent. This closes that pre-existing gap as a natural side effect of touching this exact line for the new feature.)

- [ ] **Step 3: `obtener` — use `tieneAccesoSucursal`**

Replace (lines 94-98):

```java
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                if (!dto.sucursal().id().equals(principal.sucursalId())) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                }
            }
```

with:

```java
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                if (!securityHelper.tieneAccesoSucursal(principal, dto.sucursal().id())) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
                }
            }
```

- [ ] **Step 4: Add a `resolverSucursalEfectiva` helper**

Add this private method right after the existing `getPrincipal` helper (after line 189):

```java

    /**
     * Para SUPERVISOR/SUPERVISOR_CAMPO: usa el sucursalId que mandó el request si el
     * usuario tiene acceso a esa sucursal (home o adicional asignada); si no vino o no
     * tiene acceso, cae a su sucursal home.
     */
    private Long resolverSucursalEfectiva(Long sucursalIdSolicitado, JwtPrincipal p) {
        if (sucursalIdSolicitado != null && securityHelper.tieneAccesoSucursal(p, sucursalIdSolicitado)) {
            return sucursalIdSolicitado;
        }
        return p.sucursalId();
    }
```

- [ ] **Step 5: `normalizarCreate` — stop forcing the home sucursal**

Replace the `SUPERVISOR, SUPERVISOR_CAMPO` case's last argument (line 244, currently `p.sucursalId(), // sucursalId forzado`) inside `normalizarCreate` (the full case block is lines 225-245):

```java
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> new ClienteCreateRequest(
                    req.nombre(), req.apellidoPaterno(), req.apellidoMaterno(),
                    req.fechaNacimiento(), req.genero(), req.estadoCivil(),
                    req.nombreConyuge(), req.telefonoFijo(), req.celular(),
                    req.ineTipo(), req.ineNumero(), req.curp(), req.rfc(),
                    req.domCalle(), req.domNoExterior(), req.domNoInterior(),
                    req.domColonia(), req.domMunicipio(), req.domEstado(),
                    req.domCodigoPostal(), req.domTipoVivienda(), req.domMontoRenta(),
                    req.negocioNombre(), req.negocioGiro(), req.negocioAntiguedad(),
                    req.negocioDireccion(),
                    req.negocioCalle(), req.negocioNoExterior(), req.negocioNoInterior(),
                    req.negocioColonia(), req.negocioMunicipio(), req.negocioEstado(), req.negocioCp(),
                    req.negocioTipoLocal(), req.negocioMontoRenta(), req.negocioHorarios(),
                    req.negocioLat(), req.negocioLng(),
                    req.ingresosSemanales(), req.gastosSemanales(), req.gastosRenta(), req.gastosOtros(),
                    req.ref1Nombre(), req.ref1Telefono(), req.ref1Parentesco(),
                    req.ref2Nombre(), req.ref2Telefono(), req.ref2Parentesco(),
                    req.avalNombre(), req.avalTelefono(), req.avalDireccion(), req.avalIdentificacion(),
                    req.asesorId(), // puede elegir asesor
                    resolverSucursalEfectiva(req.sucursalId(), p)
                );
```

(Only the last line before the closing `);` changes — everything else in that case block stays exactly as-is.)

- [ ] **Step 6: `normalizarUpdate` — same change**

In `normalizarUpdate`, the `SUPERVISOR, SUPERVISOR_CAMPO` case (lines 384-404) has the identical shape. Change its last argument the same way:

```java
                    req.asesorId(), // puede elegir asesor
                    resolverSucursalEfectiva(req.sucursalId(), p)
                );
```

- [ ] **Step 7: `crear` — validate caja against the effective sucursal**

Replace (lines 104-115):

```java
    /** POST /api/clientes */
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ClienteDetalleDTO> crear(
            @Valid @RequestBody ClienteCreateRequest req,
            Authentication auth) {
        JwtPrincipal principal = getPrincipal(auth);
        cajaGuard.validarCajaAbierta(principal);
        ClienteCreateRequest normalizado = normalizarCreate(req, principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(clienteService.crearCliente(normalizado, principal.userId()));
    }
```

with:

```java
    /** POST /api/clientes */
    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ClienteDetalleDTO> crear(
            @Valid @RequestBody ClienteCreateRequest req,
            Authentication auth) {
        JwtPrincipal principal = getPrincipal(auth);
        ClienteCreateRequest normalizado = normalizarCreate(req, principal);
        cajaGuard.validarCajaAbierta(principal, normalizado.sucursalId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(clienteService.crearCliente(normalizado, principal.userId()));
    }
```

(Normalizing first so the caja check runs against the sucursal the client will actually be created in, not always the caller's home.)

- [ ] **Step 8: `actualizar` — same reordering**

Replace (lines 117-128):

```java
    /** PUT /api/clientes/{id} */
    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ClienteDetalleDTO> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ClienteUpdateRequest req,
            Authentication auth) {
        JwtPrincipal principal = getPrincipal(auth);
        cajaGuard.validarCajaAbierta(principal);
        ClienteUpdateRequest normalizado = normalizarUpdate(req, principal);
        return ResponseEntity.ok(clienteService.actualizarCliente(id, normalizado));
    }
```

with:

```java
    /** PUT /api/clientes/{id} */
    @PutMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ClienteDetalleDTO> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ClienteUpdateRequest req,
            Authentication auth) {
        JwtPrincipal principal = getPrincipal(auth);
        ClienteUpdateRequest normalizado = normalizarUpdate(req, principal);
        cajaGuard.validarCajaAbierta(principal, normalizado.sucursalId());
        return ResponseEntity.ok(clienteService.actualizarCliente(id, normalizado));
    }
```

- [ ] **Step 9: `obtenerConAcceso`, `listarDocumentos`, `agregarDocumento` — same swap**

Replace in `obtenerConAcceso` (lines 281-291):

```java
    private ClienteDetalleDTO obtenerConAcceso(Long id, Authentication auth) {
        ClienteDetalleDTO dto = clienteService.obtenerDetalle(id);
        JwtPrincipal p = getPrincipal(auth);
        return switch (p.rol()) {
            case "ASESOR_COBRADOR" ->
                    (dto.asesor() != null && dto.asesor().id().equals(p.userId())) ? dto : null;
            case "SUPERVISOR", "SUPERVISOR_CAMPO" ->
                    dto.sucursal().id().equals(p.sucursalId()) ? dto : null;
            default -> dto;
        };
    }
```

with:

```java
    private ClienteDetalleDTO obtenerConAcceso(Long id, Authentication auth) {
        ClienteDetalleDTO dto = clienteService.obtenerDetalle(id);
        JwtPrincipal p = getPrincipal(auth);
        return switch (p.rol()) {
            case "ASESOR_COBRADOR" ->
                    (dto.asesor() != null && dto.asesor().id().equals(p.userId())) ? dto : null;
            case "SUPERVISOR", "SUPERVISOR_CAMPO" ->
                    securityHelper.tieneAccesoSucursal(p, dto.sucursal().id()) ? dto : null;
            default -> dto;
        };
    }
```

Replace in `listarDocumentos` (lines 315-319):

```java
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                if (!dto.sucursal().id().equals(principal.sucursalId()))
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
```

with:

```java
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                if (!securityHelper.tieneAccesoSucursal(principal, dto.sucursal().id()))
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
```

Replace in `agregarDocumento` (lines 336-340) — identical change:

```java
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                if (!dto.sucursal().id().equals(principal.sucursalId()))
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
```

with:

```java
            case "SUPERVISOR", "SUPERVISOR_CAMPO" -> {
                if (!securityHelper.tieneAccesoSucursal(principal, dto.sucursal().id()))
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
```

- [ ] **Step 10: Verify it compiles**

Run: `cd backend && mvn -q -o compile`
Expected: no output, exit code 0.

- [ ] **Step 11: Commit**

```bash
git add backend/src/main/java/com/magno/controller/ClienteController.java
git commit -m "feat: let SUPERVISOR_CAMPO operate in assigned sucursales adicionales in ClienteController"
```

---

### Task 15: Backend Fase 2 — manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the backend**

Run: `cd backend && mvn -q -o spring-boot:run`

- [ ] **Step 2: As the SUPERVISOR_CAMPO user from Task 8, list clients in the assigned sucursal**

```bash
TOKEN=<token del supervisor>
curl -s "http://localhost:8080/api/clientes?sucursalId=<otraSucursalId>" -H "Authorization: Bearer $TOKEN" | jq '.content | length'
```

Expected: `200`, returns clients from `<otraSucursalId>` (not filtered out or 403).

- [ ] **Step 3: Try a sucursal that was never assigned**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8080/api/clientes?sucursalId=<sucursalNoAsignadaId>" -H "Authorization: Bearer $TOKEN"
```

Expected: `403`. As implemented, Task 14 Step 2 validates an explicitly-passed `sucursalId` via `tieneAccesoSucursal` and returns 403 for one the caller can't access — it only falls back silently to the home sucursal when no `sucursalId` is passed at all. (This note originally assumed silent fallback for an invalid explicit filter too; corrected after Task 14's code review confirmed the actual shipped behavior.)

- [ ] **Step 4: Open a specific client that belongs to the assigned (non-home) sucursal**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8080/api/clientes/<clienteIdDeOtraSucursal>" -H "Authorization: Bearer $TOKEN"
```

Expected: `200` (previously this would have been `403`).

- [ ] **Step 5: Create a client with `sucursalId` set to the assigned sucursal**

Requires an open caja for `<otraSucursalId>` today — if none, this call correctly returns 403 "la caja está cerrada", which itself confirms Task 14 Step 7's reordering is checking the right sucursal (not the supervisor's home). If a caja is open, confirm the created client's `sucursal.id` is `<otraSucursalId>`, not the supervisor's home.

No commit for this task.

---

### Task 16: `useSucursalScope` hook

**Files:**
- Create: `frontend/src/hooks/useSucursalScope.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useMemo, useState } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'
import type { Sucursal } from '@/types'

/**
 * Sucursales entre las que un usuario puede alternar dentro de un módulo, y cuál
 * está seleccionada actualmente.
 *
 * Solo devuelve opciones para SUPERVISOR_CAMPO con sucursales adicionales asignadas.
 * ADMINISTRADOR no pasa por aquí — cada página ya tiene su propio patrón (filtro con
 * "todas las sucursales" por defecto) que este hook no debe reemplazar ni interferir.
 */
export function useSucursalScope() {
  const { usuario } = useAuthStore()

  const opciones: Sucursal[] = useMemo(() => {
    if (usuario?.rol === 'SUPERVISOR_CAMPO' && usuario.sucursales_adicionales?.length) {
      return [usuario.sucursal, ...usuario.sucursales_adicionales]
    }
    return []
  }, [usuario])

  const [seleccionManual, setSeleccionManual] = useState<number | undefined>(undefined)

  const sucursalId = opciones.length > 1
    ? (seleccionManual ?? usuario?.sucursal?.id)
    : undefined

  return { opciones, sucursalId, setSucursalId: setSeleccionManual }
}
```

`sucursalId` is `undefined` for everyone except a `SUPERVISOR_CAMPO` with real multi-branch access — safe to OR into any existing `sucursalId` query param without changing behavior for any other role.

- [ ] **Step 2: Verify it typechecks**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no output (file isn't imported anywhere yet, but must still typecheck standalone).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useSucursalScope.ts
git commit -m "feat: add useSucursalScope hook for Supervisor multi-sucursal switching"
```

---

### Task 17: `SucursalSelector` component

**Files:**
- Create: `frontend/src/components/SucursalSelector.tsx`

- [ ] **Step 1: Write the component**

```tsx
import type { Sucursal } from '@/types'

interface SucursalSelectorProps {
  opciones: Sucursal[]
  value: number | undefined
  onChange: (sucursalId: number) => void
}

/** Dropdown de sucursal — no renderiza nada si hay 0 o 1 opciones (nada que elegir). */
export default function SucursalSelector({ opciones, value, onChange }: SucursalSelectorProps) {
  if (opciones.length <= 1) return null

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(Number(e.target.value))}
      className="input w-auto"
    >
      {opciones.map((s) => (
        <option key={s.id} value={s.id}>{s.nombre}</option>
      ))}
    </select>
  )
}
```

Same visual style (`input w-auto`) as the existing admin sucursal selector in `frontend/src/pages/gastos/GastosPage.tsx:278-288`.

- [ ] **Step 2: Verify it typechecks**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SucursalSelector.tsx
git commit -m "feat: add SucursalSelector component"
```

---

### Task 18: Wire into `ClientesPage.tsx`

**Files:**
- Modify: `frontend/src/pages/clientes/ClientesPage.tsx`

- [ ] **Step 1: Import the hook and component**

Add near the top imports (after `import CajaOperativaBanner from '@/components/caja/CajaOperativaBanner'`):

```typescript
import SucursalSelector from '@/components/SucursalSelector'
import { useSucursalScope } from '@/hooks/useSucursalScope'
```

- [ ] **Step 2: Call the hook and fold it into the list query**

Add right after the existing `const { bannerVariant, horaLimite, bloqueado } = useCajaOperativa()` (line 105):

```typescript
  const { opciones: sucursalScopeOpciones, sucursalId: sucursalScopeId, setSucursalId: setSucursalScopeId } = useSucursalScope()
```

Replace the `queryFn` inside the clientes `useQuery` (lines 130-137):

```typescript
    queryFn: () => clienteService.listar({
      buscar:      buscar || undefined,
      estado:      filtroEstado || undefined,
      asesorId:    filtroAsesor || undefined,
      sucursalId:  filtroSucursal || undefined,
      page: pagina,
      size: 20,
    }),
```

with:

```typescript
    queryFn: () => clienteService.listar({
      buscar:      buscar || undefined,
      estado:      filtroEstado || undefined,
      asesorId:    filtroAsesor || undefined,
      sucursalId:  filtroSucursal || sucursalScopeId || undefined,
      page: pagina,
      size: 20,
    }),
```

Also add `sucursalScopeId` to the query's `queryKey` (line 129) so switching sucursal actually refetches:

```typescript
    queryKey: ['clientes', usuario?.id, usuario?.rol, sucursalScopeId, { buscar, filtroEstado, filtroAsesor, filtroSucursal, pagina }],
```

- [ ] **Step 3: Render the selector next to the existing admin one**

The existing admin-only sucursal filter is at lines 285-296 (`{usuario?.rol === 'ADMINISTRADOR' && (...)}`). Add the new selector right after that block closes, still inside the same filters container:

```tsx
          {usuario?.rol === 'ADMINISTRADOR' && (
            <select
              className="input w-auto"
              value={filtroSucursal}
              onChange={(e) => { setFiltroSucursal(e.target.value ? Number(e.target.value) : ''); setPagina(0) }}
            >
              <option value="">Todas las sucursales</option>
              {(sucursales ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}
          <SucursalSelector
            opciones={sucursalScopeOpciones}
            value={sucursalScopeId}
            onChange={(id) => { setSucursalScopeId(id); setPagina(0) }}
          />
```

(`SucursalSelector` already no-ops for every role except `SUPERVISOR_CAMPO` with assigned sucursales adicionales, so it's safe to render unconditionally here — it simply won't show for anyone else, including ADMINISTRADOR whose own dropdown sits right above it.)

- [ ] **Step 4: Default new clients to the currently-selected sucursal**

`ClienteModal`'s create-mode default currently hardcodes the user's home sucursal (line 596: `sucursal_id: authUsuario?.sucursal?.id ?? 0`). Add a new prop so it can follow the page-level selection instead.

In the `ModalProps` interface (lines 505-513), add:

```typescript
interface ModalProps {
  cliente: ClienteDetalle | null
  sucursales: { id: number; nombre: string }[]
  asesores: { id: number; nombre_completo: string }[]
  puedeAsignarAsesor: boolean
  puedeAsignarSucursal: boolean
  sucursalScopeId?: number
  onClose: () => void
  onSaved: () => void
}
```

In the component signature (line 515):

```typescript
export function ClienteModal({ cliente, sucursales, asesores, puedeAsignarAsesor, puedeAsignarSucursal, sucursalScopeId, onClose, onSaved }: ModalProps) {
```

In the `defaultValues` for create mode (line 594-597):

```typescript
    } : {
      // Para create mode: auto-fill sucursal del usuario actual si no es admin
      sucursal_id: authUsuario?.sucursal?.id ?? 0,
    },
```

with:

```typescript
    } : {
      // Para create mode: prioriza la sucursal actualmente seleccionada (Supervisor con
      // múltiples sucursales asignadas); si no aplica, cae a la sucursal del usuario.
      sucursal_id: sucursalScopeId ?? authUsuario?.sucursal?.id ?? 0,
    },
```

**IMPORTANT — this defaultValues change alone is not enough.** The `sucursal_id` field in the form is only ever `register()`-ed when `puedeAsignarSucursal` is true (ADMINISTRADOR only — see the "Asignación" section, `{puedeAsignarSucursal && (<Field label="Sucursal *">...)}`). For every other role, including SUPERVISOR_CAMPO, `data.sucursal_id` on submit is untouched form state — but it's not even read: the `onSubmit` payload construction has its own separate ternary that unconditionally overrides it for non-admins:

```typescript
      sucursal_id:  puedeAsignarSucursal  ? data.sucursal_id                 : authUsuario!.sucursal.id,
```

This line ignores `sucursalScopeId` entirely and always forces the client's home sucursal for every non-admin role, on both create AND edit (the same `payload` object is reused for both mutations). For edit, this is harmless — the backend's `ClienteController.normalizarUpdate` already discards whatever `sucursal_id` the frontend sends for SUPERVISOR/SUPERVISOR_CAMPO (see Task 14). But for **create**, the backend's `resolverSucursalEfectiva` *does* honor whatever `sucursal_id` is sent (falling back to home only if null or not granted) — so without this fix, a SUPERVISOR_CAMPO viewing sucursal B via the new selector would still have every new client silently created in their home sucursal A, defeating the entire point of Task 18.

Fix: update that same line to fall back to `sucursalScopeId` before the hardcoded home sucursal:

```typescript
      sucursal_id:  puedeAsignarSucursal  ? data.sucursal_id                 : (sucursalScopeId ?? authUsuario!.sucursal.id),
```

- [ ] **Step 5: Pass the prop from the invocation site**

At the `<ClienteModal ... />` invocation (lines 475-498), add the prop:

```tsx
        <ClienteModal
          cliente={modal.cliente}
          sucursales={sucursales ?? []}
          asesores={asesores ?? []}
          puedeAsignarAsesor={puedeAsignarAsesor}
          puedeAsignarSucursal={puedeAsignarSucursal}
          sucursalScopeId={sucursalScopeId}
          onClose={() => {
```

- [ ] **Step 6: Verify it typechecks**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/clientes/ClientesPage.tsx
git commit -m "feat: wire SucursalSelector into ClientesPage for Supervisor multi-sucursal"
```

---

### Task 19: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start both servers, ensure the SUPERVISOR_CAMPO test user from Task 8 has a sucursal adicional assigned and an open caja in both sucursales**

- [ ] **Step 2: Log in as that Supervisor in the browser**

Confirm: no sucursal dropdown anywhere yet other than Clientes (this plan only wires Clientes — Dashboard/Cobros/Créditos/Renovaciones still behave exactly as before, which is expected per the phase-3-is-separate scope note at the top of this plan).

- [ ] **Step 3: Open Clientes**

Confirm: a sucursal dropdown appears (home + the assigned sucursal), defaulted to home. Client list matches home sucursal's clients.

- [ ] **Step 4: Switch the dropdown to the assigned sucursal**

Confirm: the list refetches and shows that sucursal's clients (not empty, not 403 in the network tab).

- [ ] **Step 5: Click "Nuevo Cliente" while the assigned sucursal is selected, fill and submit the form**

Confirm: the created client belongs to the assigned sucursal (check its detail page or the list). If caja is closed there, confirm the error message correctly says the caja is closed (not a generic 403).

- [ ] **Step 6: Switch back to home, click on a client from the assigned sucursal (if still visible via search) or navigate directly to its detail URL**

Confirm: the detail page opens (no 403) — this exercises `ClienteController.obtener`'s new `tieneAccesoSucursal` check independent of which sucursal is selected in the page-level dropdown (that dropdown only affects the list query, not per-resource access checks).

- [ ] **Step 7: Log in as a plain SUPERVISOR_CAMPO with no sucursales adicionales assigned**

Confirm: no dropdown appears on Clientes, behavior is identical to before this plan.

- [ ] **Step 8: Log in as ADMINISTRADOR**

Confirm: Clientes page looks and behaves exactly as before — existing "Todas las sucursales" filter still there, no new forced single-branch selector.

No commit for this task — if all checks pass, this plan is complete and ready for `superpowers:requesting-code-review` before considering the Fase 3 rollout plan.

---

## Self-Review Notes

- **Spec coverage:** sections 3 (Task 1), 4.1 (Tasks 2-3), 4.2 (Task 4), 4.3 ClienteController rows only (Task 14 — CreditoController/CobrosController/RenovacionController/DashboardController rows are explicitly Fase 3, out of scope here), 4.4 (Task 13, as a non-breaking overload rather than a signature change — deviation explained in Task 13's intro), 4.5 (Task 7), 4.6 (Task 5), 5.1 (Task 16, scoped to SUPERVISOR_CAMPO only — deviation explained at the top of this plan), 5.2 (Task 17), 5.3 Clientes only (Task 18), 5.4 (Task 11). Section 6 phases 1-2 fully covered; phase 3 explicitly deferred. Section 7 edge cases: sucursal desasignada → covered by Task 15 Step 3's fallback-to-home behavior (no separate 403-handling UI needed since the list endpoint already degrades gracefully); sucursal inactiva → not separately handled in this plan, flagged as a known gap for the Fase 3 plan to pick up since `sucursales` passed into `useSucursalScope` comes from `usuario.sucursal`/`usuario.sucursales_adicionales` as returned by the backend, not filtered by `activa` — low risk given sucursales are essentially never deactivated in practice, but worth a one-line filter (`.filter(s => s.activa)`) added when Fase 3 revisits this hook.
- **Placeholder scan:** no TBD/TODO/"add error handling" phrases; every step has complete code.
- **Type consistency:** `tieneAccesoSucursal(JwtPrincipal, Long)` signature is identical everywhere it's called (Tasks 4, 14). `usuarioService.setSucursalesAdicionales(id, sucursalIds)` matches the `{ sucursalIds }` body shape from Task 7's `SucursalesAdicionalesRequest`. `useSucursalScope()`'s returned shape (`opciones`, `sucursalId`, `setSucursalId`) matches its one consumer in Task 18 exactly.
