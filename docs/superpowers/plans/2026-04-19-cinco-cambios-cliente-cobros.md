# MAGNO — 5 Cambios (Abril 2026) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar 5 cambios confirmados por el cliente: revisión de docs de roles, mapa de ubicación del negocio en alta de cliente, upload de documentos del cliente (INE, etc.), mostrar timestamp de registro de pago en la UI, y documentar regla de bloqueo operativo post-5pm.

**Architecture:**
- Cambios 2 y 3 extienden la entidad `Cliente` con nuevos campos/relaciones en backend (Java records + Liquibase) y el modal `ClienteModal` en frontend.
- Cambio 4 es solo frontend: `createdAt` ya existe en el modelo `Pago` y en `PagoDTO`; solo falta mostrarlo en la UI.
- Cambios 1 y 5 son exclusivamente documentación.

**Tech Stack:** Spring Boot 3 / Java 17 (records, JPA), Liquibase, PostgreSQL, React 18 + TypeScript + Vite, Tailwind CSS, react-leaflet + Leaflet.js (nuevo, Cambio 2), FileUpload component existente (Cambio 3).

---

## Mapa de archivos por tarea

### Cambio 1 — Solo doc review
- Modify: `docs/02-roles-y-permisos.md`

### Cambio 2 — Mapa de ubicación del negocio
**Backend:**
- Create: `backend/src/main/resources/db/changelog/V7__cliente_negocio_coords.sql`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`
- Modify: `backend/src/main/java/com/magno/model/Cliente.java`
- Modify: `backend/src/main/java/com/magno/dto/cliente/ClienteDetalleDTO.java`
- Modify: `backend/src/main/java/com/magno/dto/cliente/ClienteCreateRequest.java`
- Modify: `backend/src/main/java/com/magno/dto/cliente/ClienteUpdateRequest.java`
- Modify: `backend/src/main/java/com/magno/service/ClienteService.java`
- Modify: `backend/src/main/java/com/magno/controller/ClienteController.java`

**Frontend:**
- Modify: `frontend/package.json` (add leaflet, react-leaflet, @types/leaflet)
- Modify: `frontend/src/types/index.ts` (add negocio_lat, negocio_lng)
- Create: `frontend/src/components/BusinessMap.tsx`
- Modify: `frontend/src/pages/clientes/ClientesPage.tsx` (schema + form + BusinessMap)
- Modify: `frontend/src/pages/clientes/ClienteDetallePage.tsx` (show pin in detail)

### Cambio 3 — Documentos del cliente
**Backend:**
- Create: `backend/src/main/resources/db/changelog/V8__cliente_documentos.sql`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`
- Create: `backend/src/main/java/com/magno/model/ClienteDocumento.java`
- Create: `backend/src/main/java/com/magno/repository/ClienteDocumentoRepository.java`
- Create: `backend/src/main/java/com/magno/dto/cliente/ClienteDocumentoDTO.java`
- Modify: `backend/src/main/java/com/magno/service/ClienteService.java`
- Modify: `backend/src/main/java/com/magno/controller/ClienteController.java`

**Frontend:**
- Modify: `frontend/src/types/index.ts` (add ClienteDocumentoDTO)
- Modify: `frontend/src/services/api.ts` (add clienteDocumentosService methods)
- Create: `frontend/src/components/clientes/ClienteDocumentosSection.tsx`
- Modify: `frontend/src/pages/clientes/ClienteDetallePage.tsx` (add Documentos tab)

### Cambio 4 — Timestamp de registro de pago (frontend only)
- Modify: `frontend/src/pages/cobros/TabHistorialCobros.tsx`
- Modify: `frontend/src/pages/clientes/ClienteDetallePage.tsx` (historial tab)

### Cambio 5 — Doc only
- Modify: `docs/07-decisiones-y-pendientes.md`

---

## Task 1: Cambio 1 — Revisar y corregir docs/02-roles-y-permisos.md

**Files:**
- Modify: `docs/02-roles-y-permisos.md`

- [ ] **Step 1: Leer el archivo completo y verificar coherencia interna**

Leer `docs/02-roles-y-permisos.md` en su totalidad. Verificar:
1. Solo existen 4 roles: ADMINISTRADOR, SUPERVISOR, SUPERVISOR_CAMPO, ASESOR_COBRADOR.
2. No aparece "Cajero" en ninguna parte.
3. La tabla de módulos accesibles no contradice las restricciones listadas en la columna de descripción.
4. "Apertura/cierre de caja permitida" solo para Gerente General y Gerente de Sucursal.
5. Modificar pagos: solo Admin (ADMINISTRADOR) y Supervisor (SUPERVISOR, Gerente de Sucursal). El Supervisor de Campo NO puede modificar pagos.

Contexto importante: En la tabla de módulos, `Cobros ❌` para Gerente General y Gerente de Sucursal es **intencional** — significa que no usan la vista de "Ruta del Día" del módulo Cobros. Sin embargo, SÍ pueden modificar pagos desde el Historial de Pago (que tiene ✅ para todos). Esto NO es una contradicción.

- [ ] **Step 2: Corregir cualquier inconsistencia encontrada**

Si se encuentran referencias a "Cajero", roles con nombres incorrectos, o contradicciones internas (ej: un rol con acceso ✅ en la tabla pero con restricción explícita en la columna descripción que contradiga esa ✅), corregirlas directamente en el archivo.

Si no hay inconsistencias, no modificar nada.

- [ ] **Step 3: Commit**

```bash
git add docs/02-roles-y-permisos.md
git commit -m "docs: revisar coherencia interna de roles y permisos"
```

---

## Task 2: Cambio 2 Backend — Migración Liquibase para coordenadas de negocio

**Files:**
- Create: `backend/src/main/resources/db/changelog/V7__cliente_negocio_coords.sql`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`

- [ ] **Step 1: Crear el archivo SQL de migración**

Crear `backend/src/main/resources/db/changelog/V7__cliente_negocio_coords.sql`:

```sql
-- =============================================================
-- V7: Coordenadas geográficas del negocio del cliente
-- =============================================================

ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS negocio_lat DECIMAL(10, 7),
    ADD COLUMN IF NOT EXISTS negocio_lng DECIMAL(10, 7);
```

`DECIMAL(10,7)` soporta valores como `-90.1234567` hasta `180.1234567`, cubre latitud y longitud globales.

- [ ] **Step 2: Registrar la migración en db.changelog-master.xml**

Abrir `backend/src/main/resources/db/changelog/db.changelog-master.xml` y agregar el changeSet V7 al final, antes de `</databaseChangeLog>`:

```xml
    <changeSet id="V7-cliente-negocio-coords" author="magno">
        <sqlFile
            path="db/changelog/V7__cliente_negocio_coords.sql"
            relativeToChangelogFile="false"
            splitStatements="true"
            stripComments="false"/>
    </changeSet>
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/changelog/V7__cliente_negocio_coords.sql
git add backend/src/main/resources/db/changelog/db.changelog-master.xml
git commit -m "db: V7 - agregar coordenadas de negocio a clientes"
```

---

## Task 3: Cambio 2 Backend — Entidad, DTOs y servicio para coordenadas

**Files:**
- Modify: `backend/src/main/java/com/magno/model/Cliente.java`
- Modify: `backend/src/main/java/com/magno/dto/cliente/ClienteDetalleDTO.java`
- Modify: `backend/src/main/java/com/magno/dto/cliente/ClienteCreateRequest.java`
- Modify: `backend/src/main/java/com/magno/dto/cliente/ClienteUpdateRequest.java`
- Modify: `backend/src/main/java/com/magno/service/ClienteService.java`
- Modify: `backend/src/main/java/com/magno/controller/ClienteController.java`

- [ ] **Step 1: Agregar campos a Cliente.java**

En `backend/src/main/java/com/magno/model/Cliente.java`, después de la sección `// ── Negocio ───────────────────────────────────────────────────────`, agregar los dos campos nuevos al final de la sección de negocio (antes de `// ── Finanzas ──────────────────────────────────────────────────────────────`):

Buscar la línea:
```java
    @Column(name = "negocio_horarios", length = 150)
    private String negocioHorarios;
```

Agregar después:
```java
    @Column(name = "negocio_lat", precision = 10, scale = 7)
    private BigDecimal negocioLat;

    @Column(name = "negocio_lng", precision = 10, scale = 7)
    private BigDecimal negocioLng;
```

- [ ] **Step 2: Agregar campos a ClienteDetalleDTO.java**

El record `ClienteDetalleDTO` tiene todos los campos listados positivamente. Agregar `negocioLat` y `negocioLng` después de `String negocioHorarios,`:

Buscar en el record:
```java
        String negocioHorarios,
```

Agregar después:
```java
        BigDecimal negocioLat,
        BigDecimal negocioLng,
```

En el método estático `from(Cliente c, boolean tieneCreditoActivo)`, agregar las dos líneas después de `c.getNegocioHorarios(),`:

Buscar:
```java
                c.getNegocioHorarios(),
```

Agregar después:
```java
                c.getNegocioLat(),
                c.getNegocioLng(),
```

- [ ] **Step 3: Agregar campos a ClienteCreateRequest.java**

Al final del record, antes del cierre `Long sucursalId`, agregar después de `String negocioHorarios,`:

Buscar en el record:
```java
        String negocioHorarios,
```

Agregar después:
```java
        BigDecimal negocioLat,
        BigDecimal negocioLng,
```

- [ ] **Step 4: Agregar campos a ClienteUpdateRequest.java**

Igual que en el paso anterior, agregar después de `String negocioHorarios,`:

Buscar en el record:
```java
        String negocioHorarios,
```

Agregar después:
```java
        BigDecimal negocioLat,
        BigDecimal negocioLng,
```

- [ ] **Step 5: Actualizar ClienteService.java**

Abrir `backend/src/main/java/com/magno/service/ClienteService.java`. Buscar el método `crearCliente` y en la construcción del builder de `Cliente`, agregar después de `.negocioHorarios(req.negocioHorarios())`:

```java
                .negocioLat(req.negocioLat())
                .negocioLng(req.negocioLng())
```

Buscar el método `actualizarCliente` y después de la línea que setea `negocioHorarios`, agregar:

```java
        if (req.negocioLat() != null) cliente.setNegocioLat(req.negocioLat());
        if (req.negocioLng() != null) cliente.setNegocioLng(req.negocioLng());
```

Si el servicio usa un setter directo sin null-check para negocioHorarios, agregar igualmente sin null-check. Si usa null-check (patrón `if != null`), mantener ese patrón.

- [ ] **Step 6: Actualizar ClienteController.java — normalizarCreate y normalizarUpdate**

En `ClienteController.java`, el método `normalizarCreate` construye `new ClienteCreateRequest(...)` pasando todos los argumentos en orden. Dado que `negocioLat` y `negocioLng` se agregan después de `negocioHorarios` en el record, agregar `req.negocioLat(), req.negocioLng()` en la posición correcta en los 3 constructores del switch (`ASESOR_COBRADOR`, `SUPERVISOR_CAMPO`, `default → req`).

El método default retorna `req` sin cambios, entonces solo los dos casos explícitos necesitan actualización.

En el caso `ASESOR_COBRADOR` de `normalizarCreate`, buscar `req.negocioHorarios(),` y agregar después:
```java
                    req.negocioLat(), req.negocioLng(),
```

En el caso `SUPERVISOR_CAMPO` de `normalizarCreate`, igual.

Repetir el mismo proceso para `normalizarUpdate` con `ClienteUpdateRequest`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/magno/model/Cliente.java
git add backend/src/main/java/com/magno/dto/cliente/ClienteDetalleDTO.java
git add backend/src/main/java/com/magno/dto/cliente/ClienteCreateRequest.java
git add backend/src/main/java/com/magno/dto/cliente/ClienteUpdateRequest.java
git add backend/src/main/java/com/magno/service/ClienteService.java
git add backend/src/main/java/com/magno/controller/ClienteController.java
git commit -m "feat(clientes): agregar campos negocio_lat/negocio_lng en backend"
```

---

## Task 4: Cambio 2 Frontend — Instalar Leaflet e implementar BusinessMap

**Files:**
- Modify: `frontend/package.json` (vía npm install)
- Create: `frontend/src/components/BusinessMap.tsx`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/pages/clientes/ClientesPage.tsx`
- Modify: `frontend/src/pages/clientes/ClienteDetallePage.tsx`

- [ ] **Step 1: Instalar dependencias**

```bash
cd frontend && npm install leaflet react-leaflet @types/leaflet
```

Expected: packages instalados sin errores. `react-leaflet` v4.x es compatible con React 18.

- [ ] **Step 2: Crear BusinessMap.tsx**

Crear `frontend/src/components/BusinessMap.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon missing in Vite builds
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface BusinessMapProps {
  lat: number | null | undefined
  lng: number | null | undefined
  onChange: (lat: number, lng: number) => void
  readOnly?: boolean
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function BusinessMap({ lat, lng, onChange, readOnly = false }: BusinessMapProps) {
  const center: [number, number] = (lat != null && lng != null)
    ? [lat, lng]
    : [20.6597, -103.3496] // Centro: Guadalajara, Jalisco

  const hasPin = lat != null && lng != null

  const handleGeolocate = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl overflow-hidden border border-[#dee2e6]" style={{ height: 260 }}>
        <MapContainer
          center={center}
          zoom={hasPin ? 16 : 13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {!readOnly && <ClickHandler onChange={onChange} />}
          {hasPin && (
            <Marker position={[lat!, lng!]} />
          )}
        </MapContainer>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11px] text-[#6c757d] flex-1">
            {hasPin
              ? `Pin: ${lat!.toFixed(5)}, ${lng!.toFixed(5)} — Haz clic en el mapa para mover el pin`
              : 'Haz clic en el mapa para marcar la ubicación del negocio'}
          </p>
          {'geolocation' in navigator && (
            <button
              type="button"
              onClick={handleGeolocate}
              className="btn btn-sm text-xs"
            >
              Usar mi ubicación
            </button>
          )}
          {hasPin && (
            <button
              type="button"
              onClick={() => onChange(0, 0)}
              className="text-[11px] text-[#adb5bd] underline hover:text-[#6c757d]"
            >
              Limpiar pin
            </button>
          )}
        </div>
      )}
      {readOnly && hasPin && (
        <p className="text-[11px] text-[#6c757d]">
          Coordenadas: {lat!.toFixed(6)}, {lng!.toFixed(6)}
        </p>
      )}
    </div>
  )
}
```

Nota: el botón "Limpiar pin" setea 0,0 como señal de vacío. Esto se manejará en el form con la lógica `value === 0 ? undefined : value`. Alternativamente, puedes pasar `null` si el tipo lo permite — ver Step 4 para el manejo.

- [ ] **Step 3: Agregar tipos en index.ts**

En `frontend/src/types/index.ts`, buscar la interface `ClienteDetalle` y agregar después de `negocio_horarios`:

```ts
  negocio_lat?: number | null
  negocio_lng?: number | null
```

Buscar la interface `ClienteCreateRequest` (o el type que se usa para el form payload) y agregar igualmente:

```ts
  negocio_lat?: number | null
  negocio_lng?: number | null
```

Hacer lo mismo en `ClienteUpdateRequest` si existe como tipo separado.

- [ ] **Step 4: Actualizar ClientesPage.tsx — schema y form**

En `ClientesPage.tsx`:

**4a. Agregar campos al schema Zod** (en la sección donde está `clienteSchema`):

```ts
  negocio_lat: z.coerce.number().optional(),
  negocio_lng: z.coerce.number().optional(),
```

**4b. Agregar state para coordenadas** dentro de `ClienteModal`:

```tsx
const [mapLat, setMapLat] = useState<number | null>(cliente?.negocio_lat ?? null)
const [mapLng, setMapLng] = useState<number | null>(cliente?.negocio_lng ?? null)
```

**4c. En la sección "Datos del Negocio"** del form, después del bloque de "Dirección del Negocio" (después del grid de `negocio_cp`) agregar:

```tsx
{/* ── Ubicación del negocio ── */}
<div className="mt-4">
  <p className="text-[11px] font-semibold text-[#6c757d] uppercase tracking-wide mb-2">
    Ubicación del negocio (opcional)
  </p>
  <BusinessMap
    lat={mapLat}
    lng={mapLng}
    onChange={(lat, lng) => {
      setMapLat(lat === 0 ? null : lat)
      setMapLng(lng === 0 ? null : lng)
    }}
  />
</div>
```

Agregar `import BusinessMap from '@/components/BusinessMap'` al inicio del archivo.

**4d. En la función `onSubmit`**, incluir las coordenadas en el `payload`:

```ts
negocio_lat: mapLat ?? undefined,
negocio_lng: mapLng ?? undefined,
```

- [ ] **Step 5: Mostrar mapa en read-only en ClienteDetallePage.tsx**

En `ClienteDetallePage.tsx`, en la sección "Datos del Negocio" (tab `datos`), después de mostrar los datos de dirección del negocio, agregar:

```tsx
{cliente.negocio_lat && cliente.negocio_lng && (
  <div className="mt-3">
    <p className="text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide mb-2">
      Ubicación del negocio
    </p>
    <BusinessMap
      lat={cliente.negocio_lat}
      lng={cliente.negocio_lng}
      onChange={() => {}}
      readOnly
    />
  </div>
)}
```

Agregar `import BusinessMap from '@/components/BusinessMap'` al inicio del archivo.

- [ ] **Step 6: Verificar compilación**

```bash
cd frontend && npm run type-check
```

Expected: 0 errores TypeScript.

- [ ] **Step 7: Actualizar docs**

En `docs/05-modelo-de-datos.md`, en la fila de `clientes`, agregar `negocio_lat DECIMAL(10,7)`, `negocio_lng DECIMAL(10,7)` a los campos listados.

En `docs/04-modulos-y-ui.md`, buscar la sección del formulario de Alta de Cliente y agregar mención del mapa interactivo con Leaflet/OSM en la sección Datos del Negocio.

En `docs/07-decisiones-y-pendientes.md`, mover el ítem #7 de "Ítems Pendientes" (`INE del cliente: ¿se agrega upload de imagen?`) para reflejar que el mapa ya fue implementado (ese era un pendiente separado pero relacionado). El ítem del mapa no estaba pendiente — era nuevo.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/BusinessMap.tsx
git add frontend/src/types/index.ts
git add frontend/src/pages/clientes/ClientesPage.tsx
git add frontend/src/pages/clientes/ClienteDetallePage.tsx
git add docs/04-modulos-y-ui.md docs/05-modelo-de-datos.md docs/07-decisiones-y-pendientes.md
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(clientes): mapa interactivo de ubicación del negocio con Leaflet/OSM"
```

---

## Task 5: Cambio 3 Backend — Migración Liquibase para documentos del cliente

**Files:**
- Create: `backend/src/main/resources/db/changelog/V8__cliente_documentos.sql`
- Modify: `backend/src/main/resources/db/changelog/db.changelog-master.xml`

- [ ] **Step 1: Crear el archivo SQL de migración**

Crear `backend/src/main/resources/db/changelog/V8__cliente_documentos.sql`:

```sql
-- =============================================================
-- V8: Tabla de documentos del cliente (INE, comprobante, etc.)
-- =============================================================

CREATE TABLE IF NOT EXISTS cliente_documentos (
    id          BIGSERIAL PRIMARY KEY,
    cliente_id  BIGINT NOT NULL REFERENCES clientes(id),
    tipo        VARCHAR(30) NOT NULL,
    -- Tipos: INE_FRENTE | INE_REVERSO | COMPROBANTE_DOMICILIO | OTRO
    url         VARCHAR(500) NOT NULL,
    nombre      VARCHAR(150),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  BIGINT REFERENCES usuarios(id),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cliente_documentos_cliente
    ON cliente_documentos(cliente_id)
    WHERE deleted_at IS NULL;
```

- [ ] **Step 2: Registrar en db.changelog-master.xml**

Agregar el changeSet V8 al final, antes de `</databaseChangeLog>`:

```xml
    <changeSet id="V8-cliente-documentos" author="magno">
        <sqlFile
            path="db/changelog/V8__cliente_documentos.sql"
            relativeToChangelogFile="false"
            splitStatements="true"
            stripComments="false"/>
    </changeSet>
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/changelog/V8__cliente_documentos.sql
git add backend/src/main/resources/db/changelog/db.changelog-master.xml
git commit -m "db: V8 - tabla cliente_documentos para INE, comprobante y otros"
```

---

## Task 6: Cambio 3 Backend — Entidad, DTO, Repository, Service, Controller

**Files:**
- Create: `backend/src/main/java/com/magno/model/ClienteDocumento.java`
- Create: `backend/src/main/java/com/magno/repository/ClienteDocumentoRepository.java`
- Create: `backend/src/main/java/com/magno/dto/cliente/ClienteDocumentoDTO.java`
- Modify: `backend/src/main/java/com/magno/service/ClienteService.java`
- Modify: `backend/src/main/java/com/magno/controller/ClienteController.java`

- [ ] **Step 1: Crear ClienteDocumento.java**

Crear `backend/src/main/java/com/magno/model/ClienteDocumento.java`:

```java
package com.magno.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "cliente_documentos")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"cliente", "createdBy"})
public class ClienteDocumento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @Column(nullable = false, length = 30)
    private String tipo; // INE_FRENTE | INE_REVERSO | COMPROBANTE_DOMICILIO | OTRO

    @Column(nullable = false, length = 500)
    private String url;

    @Column(length = 150)
    private String nombre;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Usuario createdBy;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @PrePersist
    void prePersist() {
        createdAt = OffsetDateTime.now();
    }
}
```

- [ ] **Step 2: Crear ClienteDocumentoRepository.java**

Crear `backend/src/main/java/com/magno/repository/ClienteDocumentoRepository.java`:

```java
package com.magno.repository;

import com.magno.model.ClienteDocumento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClienteDocumentoRepository extends JpaRepository<ClienteDocumento, Long> {

    @Query("SELECT d FROM ClienteDocumento d WHERE d.cliente.id = :clienteId AND d.deletedAt IS NULL ORDER BY d.createdAt ASC")
    List<ClienteDocumento> findByClienteIdActivos(@Param("clienteId") Long clienteId);
}
```

- [ ] **Step 3: Crear ClienteDocumentoDTO.java**

Crear `backend/src/main/java/com/magno/dto/cliente/ClienteDocumentoDTO.java`:

```java
package com.magno.dto.cliente;

import com.magno.model.ClienteDocumento;

import java.time.OffsetDateTime;

public record ClienteDocumentoDTO(
        Long id,
        String tipo,
        String url,
        String nombre,
        OffsetDateTime createdAt
) {
    public static ClienteDocumentoDTO from(ClienteDocumento d) {
        return new ClienteDocumentoDTO(
                d.getId(),
                d.getTipo(),
                d.getUrl(),
                d.getNombre(),
                d.getCreatedAt()
        );
    }
}
```

- [ ] **Step 4: Agregar métodos en ClienteService.java**

En `ClienteService.java`, inyectar `ClienteDocumentoRepository` en el constructor o como `@Autowired`.

Agregar métodos:

```java
public List<ClienteDocumentoDTO> listarDocumentos(Long clienteId) {
    return clienteDocumentoRepository.findByClienteIdActivos(clienteId)
            .stream().map(ClienteDocumentoDTO::from).toList();
}

public ClienteDocumentoDTO agregarDocumento(Long clienteId, String tipo, String url, String nombre, Long createdByUserId) {
    Cliente cliente = clienteRepository.findById(clienteId)
            .orElseThrow(() -> new EntityNotFoundException("Cliente no encontrado: " + clienteId));
    Usuario createdBy = usuarioRepository.findById(createdByUserId).orElse(null);

    ClienteDocumento doc = ClienteDocumento.builder()
            .cliente(cliente)
            .tipo(tipo)
            .url(url)
            .nombre(nombre)
            .createdBy(createdBy)
            .build();

    return ClienteDocumentoDTO.from(clienteDocumentoRepository.save(doc));
}

public void eliminarDocumento(Long documentoId, Long clienteId) {
    ClienteDocumento doc = clienteDocumentoRepository.findById(documentoId)
            .orElseThrow(() -> new EntityNotFoundException("Documento no encontrado: " + documentoId));
    if (!doc.getCliente().getId().equals(clienteId)) {
        throw new IllegalArgumentException("El documento no pertenece al cliente indicado");
    }
    doc.setDeletedAt(java.time.OffsetDateTime.now());
    clienteDocumentoRepository.save(doc);
}
```

Nota: si `usuarioRepository` no está inyectado en `ClienteService`, inyectarlo. Si existe un patrón diferente para resolución de usuario, seguirlo.

- [ ] **Step 5: Agregar endpoints en ClienteController.java**

En `ClienteController.java`, agregar el DTO de request como record interno o clase independiente, y los 3 endpoints:

```java
// ── Documentos del cliente ────────────────────────────────────────

/** GET /api/clientes/{id}/documentos */
@GetMapping("/{id}/documentos")
@PreAuthorize("isAuthenticated()")
public ResponseEntity<List<ClienteDocumentoDTO>> listarDocumentos(
        @PathVariable Long id, Authentication auth) {
    // Misma restricción de acceso que GET /{id}
    ClienteDetalleDTO dto = clienteService.obtenerDetalle(id);
    JwtPrincipal principal = getPrincipal(auth);
    switch (principal.rol()) {
        case "ASESOR_COBRADOR" -> {
            if (dto.asesor() == null || !dto.asesor().id().equals(principal.userId()))
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        case "SUPERVISOR_CAMPO" -> {
            if (!dto.sucursal().id().equals(principal.sucursalId()))
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }
    return ResponseEntity.ok(clienteService.listarDocumentos(id));
}

/** POST /api/clientes/{id}/documentos */
@PostMapping("/{id}/documentos")
@PreAuthorize("isAuthenticated()")
public ResponseEntity<ClienteDocumentoDTO> agregarDocumento(
        @PathVariable Long id,
        @RequestBody AgregarDocumentoRequest req,
        Authentication auth) {
    JwtPrincipal principal = getPrincipal(auth);
    return ResponseEntity.status(HttpStatus.CREATED)
            .body(clienteService.agregarDocumento(id, req.tipo(), req.url(), req.nombre(), principal.userId()));
}

/** DELETE /api/clientes/{clienteId}/documentos/{docId} */
@DeleteMapping("/{clienteId}/documentos/{docId}")
@PreAuthorize("hasAnyAuthority('ADMINISTRADOR','SUPERVISOR','SUPERVISOR_CAMPO','ASESOR_COBRADOR')")
public ResponseEntity<Void> eliminarDocumento(
        @PathVariable Long clienteId,
        @PathVariable Long docId) {
    clienteService.eliminarDocumento(docId, clienteId);
    return ResponseEntity.noContent().build();
}

record AgregarDocumentoRequest(String tipo, String url, String nombre) {}
```

Agregar `import com.magno.dto.cliente.ClienteDocumentoDTO;` en los imports.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/magno/model/ClienteDocumento.java
git add backend/src/main/java/com/magno/repository/ClienteDocumentoRepository.java
git add backend/src/main/java/com/magno/dto/cliente/ClienteDocumentoDTO.java
git add backend/src/main/java/com/magno/service/ClienteService.java
git add backend/src/main/java/com/magno/controller/ClienteController.java
git commit -m "feat(clientes): backend documentos del cliente (INE, comprobante, etc.)"
```

---

## Task 7: Cambio 3 Frontend — Sección de documentos del cliente

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/components/clientes/ClienteDocumentosSection.tsx`
- Modify: `frontend/src/pages/clientes/ClienteDetallePage.tsx`

- [ ] **Step 1: Agregar tipo ClienteDocumentoDTO en index.ts**

En `frontend/src/types/index.ts`, agregar la interface:

```ts
export interface ClienteDocumentoDTO {
  id: number
  tipo: 'INE_FRENTE' | 'INE_REVERSO' | 'COMPROBANTE_DOMICILIO' | 'OTRO'
  url: string
  nombre: string | null
  createdAt: string
}
```

- [ ] **Step 2: Agregar métodos de documentos en api.ts**

En `frontend/src/services/api.ts`, dentro del objeto `clienteService` (o donde se agrupan los métodos de clientes), agregar:

```ts
listarDocumentos: (clienteId: number) =>
  api.get<ClienteDocumentoDTO[]>(`/clientes/${clienteId}/documentos`).then((r) => r.data),

agregarDocumento: (clienteId: number, tipo: string, url: string, nombre?: string) =>
  api.post<ClienteDocumentoDTO>(`/clientes/${clienteId}/documentos`, { tipo, url, nombre }).then((r) => r.data),

eliminarDocumento: (clienteId: number, docId: number) =>
  api.delete(`/clientes/${clienteId}/documentos/${docId}`),
```

Asegurarse de importar `ClienteDocumentoDTO` desde `@/types`.

- [ ] **Step 3: Crear ClienteDocumentosSection.tsx**

Crear `frontend/src/components/clientes/ClienteDocumentosSection.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Trash2, FileText } from 'lucide-react'
import FileUpload from '@/components/FileUpload'
import { clienteService } from '@/services/api'
import type { ClienteDocumentoDTO } from '@/types'

const TIPOS_DOCUMENTO: { value: string; label: string }[] = [
  { value: 'INE_FRENTE',            label: 'INE — Frente' },
  { value: 'INE_REVERSO',           label: 'INE — Reverso' },
  { value: 'COMPROBANTE_DOMICILIO', label: 'Comprobante de domicilio' },
  { value: 'OTRO',                  label: 'Otro documento' },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  clienteId: number
  canDelete?: boolean
}

export default function ClienteDocumentosSection({ clienteId, canDelete = false }: Props) {
  const qc = useQueryClient()
  const [tipoSeleccionado, setTipoSeleccionado] = useState('INE_FRENTE')
  const [nombre, setNombre] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [uploadKey, setUploadKey] = useState(0) // reset FileUpload

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['cliente-documentos', clienteId],
    queryFn: () => clienteService.listarDocumentos(clienteId),
    staleTime: 30_000,
  })

  const agregarMutation = useMutation({
    mutationFn: () => clienteService.agregarDocumento(clienteId, tipoSeleccionado, uploadedUrl!, nombre || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente-documentos', clienteId] })
      toast.success('Documento guardado')
      setUploadedUrl(null)
      setNombre('')
      setUploadKey((k) => k + 1)
    },
    onError: () => toast.error('Error al guardar documento'),
  })

  const eliminarMutation = useMutation({
    mutationFn: (docId: number) => clienteService.eliminarDocumento(clienteId, docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cliente-documentos', clienteId] })
      toast.success('Documento eliminado')
    },
    onError: () => toast.error('Error al eliminar documento'),
  })

  return (
    <div className="space-y-5">
      {/* ── Subir nuevo documento ── */}
      <div className="card p-4 space-y-3">
        <p className="text-[13px] font-semibold text-[#212529]">Subir documento</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-medium text-[#495057] mb-1.5">Tipo de documento</label>
            <select
              className="input"
              value={tipoSeleccionado}
              onChange={(e) => setTipoSeleccionado(e.target.value)}
            >
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#495057] mb-1.5">Descripción (opcional)</label>
            <input
              className="input"
              placeholder="Ej. INE del titular"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
        </div>

        <FileUpload
          key={uploadKey}
          accept="image/*,.pdf"
          folder={`clientes-documentos/${clienteId}/${tipoSeleccionado}`}
          compress
          label="Arrastra el documento o haz clic para seleccionar (imagen o PDF)"
          onUploadComplete={(url) => setUploadedUrl(url)}
        />

        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          disabled={!uploadedUrl || agregarMutation.isPending}
          onClick={() => agregarMutation.mutate()}
        >
          {agregarMutation.isPending ? 'Guardando...' : 'Guardar documento'}
        </button>
      </div>

      {/* ── Lista de documentos ── */}
      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-[#6c757d] uppercase tracking-wide">
          Documentos guardados ({documentos.length})
        </p>

        {isLoading && <p className="text-[13px] text-[#adb5bd]">Cargando...</p>}

        {!isLoading && documentos.length === 0 && (
          <p className="text-[13px] text-[#adb5bd] py-4 text-center">Sin documentos registrados</p>
        )}

        {documentos.map((doc) => (
          <div key={doc.id} className="card p-3 flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#3d6b35] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[#212529] truncate">
                {TIPOS_DOCUMENTO.find((t) => t.value === doc.tipo)?.label ?? doc.tipo}
                {doc.nombre && <span className="text-[#6c757d] font-normal"> — {doc.nombre}</span>}
              </p>
              <p className="text-[11px] text-[#adb5bd]">{fmtDate(doc.createdAt)}</p>
            </div>
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm text-xs shrink-0"
            >
              Ver
            </a>
            {canDelete && (
              <button
                type="button"
                className="btn btn-sm text-xs text-[#dc2626] hover:bg-[#fff5f5] shrink-0"
                onClick={() => eliminarMutation.mutate(doc.id)}
                disabled={eliminarMutation.isPending}
                title="Eliminar documento"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Agregar tab "Documentos" en ClienteDetallePage.tsx**

En `ClienteDetallePage.tsx`, el type `Tab` actualmente es `'datos' | 'referencias' | 'historial'`. Agregar `'documentos'`:

```ts
type Tab = 'datos' | 'referencias' | 'historial' | 'documentos'
```

En la barra de tabs, agregar el botón "Documentos":

```tsx
<button
  type="button"
  onClick={() => setTab('documentos')}
  className={`tab-btn ${tab === 'documentos' ? 'tab-active' : ''}`}
>
  <FileText className="w-4 h-4" />
  Documentos
</button>
```

Asegurarse de importar `FileText` de `lucide-react` si no está ya importado.

En el cuerpo del tab, agregar:

```tsx
{tab === 'documentos' && (
  <ClienteDocumentosSection
    clienteId={Number(id)}
    canDelete={esAdmin}
  />
)}
```

Agregar `import ClienteDocumentosSection from '@/components/clientes/ClienteDocumentosSection'` al inicio del archivo.

- [ ] **Step 5: Verificar compilación**

```bash
cd frontend && npm run type-check
```

Expected: 0 errores TypeScript.

- [ ] **Step 6: Actualizar docs**

En `docs/05-modelo-de-datos.md`, agregar la tabla `cliente_documentos` con sus campos.

En `docs/06-archivos-y-storage.md`:
- Agregar fila a la tabla de uploads: Clientes, Alta de Cliente, Documentos del cliente, INE frente/reverso, comprobante, otro, No obligatorio, `cliente_documentos.url VARCHAR`.
- Agregar sección en `4.2 Detalles` para documentos del cliente.
- Actualizar el árbol de buckets en `4.3` con el nuevo path: `clientes-documentos/{cliente_id}/{tipo}/`.

En `docs/07-decisiones-y-pendientes.md`, marcar como resuelto el ítem pendiente #7: "INE del cliente: ¿se agrega upload de imagen en el alta de cliente?" — confirmar que sí se implementó como tab de documentos en el detalle del cliente.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/index.ts
git add frontend/src/services/api.ts
git add frontend/src/components/clientes/ClienteDocumentosSection.tsx
git add frontend/src/pages/clientes/ClienteDetallePage.tsx
git add docs/05-modelo-de-datos.md docs/06-archivos-y-storage.md docs/07-decisiones-y-pendientes.md
git commit -m "feat(clientes): upload de documentos del cliente con tab Documentos"
```

---

## Task 8: Cambio 4 — Mostrar timestamp de registro de pago en la UI

**Files:**
- Modify: `frontend/src/pages/cobros/TabHistorialCobros.tsx`
- Modify: `frontend/src/pages/clientes/ClienteDetallePage.tsx`

> Contexto: `Pago.java` ya tiene `createdAt` (`@PrePersist`). `PagoDTO.java` ya lo devuelve. `PagoCobroDTO` en `index.ts` ya tiene `createdAt: string`. **No hay cambios de backend en este task** — solo agregar la columna en la UI.

- [ ] **Step 1: Agregar helper fmtDateTime en TabHistorialCobros.tsx**

En `TabHistorialCobros.tsx`, agregar la función `fmtDateTime` junto a las existentes `fmtDate`, `fmtMoney`:

```ts
function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
```

- [ ] **Step 2: Agregar columna "Registrado" en la tabla desktop de TabHistorialCobros.tsx**

En el `<thead>` de la tabla desktop, agregar la columna después de "Fecha":

```tsx
<th>Fecha cobro</th>
<th>Registrado</th>
```

Nota: renombrar la columna existente "Fecha" a "Fecha cobro" para claridad.

En el `<tbody>`, en la fila de cada pago, agregar la celda después de `fmtDate(p.fechaPago)`:

```tsx
<td className="text-[#6c757d] whitespace-nowrap">{fmtDate(p.fechaPago)}</td>
<td className="text-[12px] text-[#adb5bd] whitespace-nowrap">{fmtDateTime(p.createdAt)}</td>
```

- [ ] **Step 3: Agregar "Registrado" en las cards móviles de TabHistorialCobros.tsx**

En las mobile cards, después de mostrar el asesor, agregar:

```tsx
{p.createdAt && (
  <p className="text-[10px] text-[#adb5bd] mt-0.5">
    Registrado: {fmtDateTime(p.createdAt)}
  </p>
)}
```

- [ ] **Step 4: Agregar fmtDateTime en el historial de pagos de ClienteDetallePage.tsx**

En `ClienteDetallePage.tsx`, buscar la sección donde se muestra `ultimosCobros` (tab `historial`). Agregar la misma función `fmtDateTime` (puede ser importada o copiada localmente). Mostrar `createdAt` en cada item del historial.

Buscar el render de cada pago en el tab historial y agregar:

```tsx
{p.createdAt && (
  <span className="text-[10px] text-[#adb5bd]">
    {' · '}Reg. {fmtDateTime(p.createdAt)}
  </span>
)}
```

- [ ] **Step 5: Actualizar docs**

En `docs/05-modelo-de-datos.md`, en la fila de `pagos`, verificar que `created_at` está listado (ya está según la convención de todas las tablas). Si no está explícito en la fila de `pagos`, agregarlo.

En `docs/03-reglas-de-negocio.md`, agregar una nota en la sección de Cobros: "El timestamp exacto de registro (`created_at`) se guarda automáticamente y se muestra en el historial en formato `dd/MM/yyyy HH:mm` (hora local `America/Mexico_City`)."

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/cobros/TabHistorialCobros.tsx
git add frontend/src/pages/clientes/ClienteDetallePage.tsx
git add docs/03-reglas-de-negocio.md docs/05-modelo-de-datos.md
git commit -m "feat(cobros): mostrar timestamp de registro de pago en historial"
```

---

## Task 9: Cambio 5 — Documentar regla de bloqueo operativo post-5pm

**Files:**
- Modify: `docs/07-decisiones-y-pendientes.md`

- [ ] **Step 1: Agregar la regla pendiente en docs/07-decisiones-y-pendientes.md**

Al final de la sección `## 13b. Ítems Pendientes de Confirmar con Cliente`, agregar:

```markdown
---

## 13c. Reglas Confirmadas — Pendientes de Implementar

| #   | Regla                                         | Módulo de implementación |
| --- | --------------------------------------------- | ------------------------ |
| 🔜  | **Bloqueo operativo después de las 5:00 PM**  | Módulo 6 — Caja          |

### Detalle — Bloqueo operativo por cierre de caja

**Regla confirmada por cliente (Abril 2026):** Después de las 5:00 PM (hora local, `America/Mexico_City`), los roles `ASESOR_COBRADOR` y `SUPERVISOR_CAMPO` no pueden registrar ni modificar pagos, ni editar operaciones en ninguna sección.

**Diseño conceptual:**
- Esta restricción está **conceptualmente ligada al cierre de caja del día**, no es una validación de horario independiente.
- Debe implementarse dentro del **Módulo 6 (Caja)**, donde el estado `abierta/cerrada` de la caja será la fuente de verdad.
- La hora límite (5:00 PM) **podría ser configurable por sucursal** en el futuro.
- El **mensaje de error al usuario** debe ser: `"No es posible registrar operaciones después de las 5:00 PM"`.
- Roles que NO se bloquean: `ADMINISTRADOR` y `SUPERVISOR` (Gerente de Sucursal) pueden operar sin restricción de horario.
```

- [ ] **Step 2: Commit**

```bash
git add docs/07-decisiones-y-pendientes.md
git commit -m "docs: regla de bloqueo operativo post-5pm (pendiente Módulo 6)"
```

---

## Self-Review

### Spec coverage check

| Cambio | Requerimiento | Task cubierta |
|--------|--------------|---------------|
| 1 | Revisar coherencia interna de roles | Task 1 |
| 2 | Mapa con click-to-pin y geolocalización | Task 4 (Step 2, 4) |
| 2 | Migración DB coordenadas | Task 2 |
| 2 | Backend coords (entity, DTO, service, controller) | Task 3 |
| 2 | Mobile-first | Task 4 (`BusinessMap` usa `height:260` flexible) |
| 3 | Upload INE frente/reverso, comprobante, otro | Task 7 (Step 3) |
| 3 | Migración DB documentos | Task 5 |
| 3 | Backend documentos (entity, repo, DTO, service, controller) | Task 6 |
| 3 | Reutilizar FileUpload existente | Task 7 (Step 3) |
| 4 | Mostrar `created_at` en historial | Task 8 |
| 4 | Formato `dd/MM/yyyy HH:mm` hora México | Task 8 (Step 1) |
| 5 | Documentar regla bloqueo operativo | Task 9 |
| Todos | Actualizar docs/ afectados | Incluido en cada task |

### Notas de implementación críticas

1. **`ClienteCreateRequest` y `ClienteUpdateRequest` son Java records**: agregar campos al final (después de `negocioHorarios`) para no romper el orden de los parámetros existentes.

2. **`ClienteController.normalizarCreate/normalizarUpdate`**: estos métodos construyen los records manualmente con todos los parámetros por posición. Al agregar 2 campos nuevos (`negocioLat`, `negocioLng`) en los 2 casos explícitos del switch, NO olvidar agregarlos también. El `default → req` no necesita cambio.

3. **Leaflet en Vite**: necesita el fix del icono marcador (incluido en `BusinessMap.tsx`). Sin este fix, el marcador no aparece.

4. **`createdAt` en pago**: ya existe en modelo, DTO y tipo frontend — solo UI.

5. **Documentos tab**: decidido en detalle del cliente (no en modal de creación) porque el `cliente_id` es necesario para el S3 path y el cliente debe existir primero.
