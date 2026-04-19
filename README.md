# MAGNO Sistema de Cobros

Sistema de gestión financiera para **MAGNO Financiera** — digitaliza el ciclo completo de una microfinanciera: alta de cliente → colocación de crédito → cobro diario → renovación → corte de caja.

## Stack

| Capa                    | Tecnología                                                |
| ----------------------- | --------------------------------------------------------- |
| Frontend                | React 18 + TypeScript + Vite + Tailwind CSS               |
| Estado servidor         | React Query (TanStack Query v5)                           |
| HTTP client             | Axios con interceptor JWT                                 |
| Routing                 | React Router v6                                           |
| Backend                 | Spring Boot 3.2 + Java 17                                 |
| Autenticación           | Spring Security + JWT (jjwt 0.12)                         |
| ORM                     | JPA / Hibernate                                           |
| Base de datos           | PostgreSQL 16                                             |
| Migraciones             | Liquibase                                                 |
| Caché / tokens          | Redis 7                                                   |
| PDF                     | iText 8                                                   |
| Email                   | JavaMailSender                                            |
| Almacenamiento archivos | S3-compatible (Hetzner Object Storage o MinIO on-premise) |
| Contenedores            | Docker Compose                                            |
| Proxy                   | Nginx                                                     |

## Estructura del repositorio

```
magno-sistema/
├── backend/
│   ├── src/main/java/com/magno/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   ├── model/
│   │   ├── dto/
│   │   ├── security/
│   │   └── config/
│   ├── src/main/resources/
│   │   ├── application.yml          # Perfiles dev y prod
│   │   └── db/changelog/
│   │       ├── db.changelog-master.xml
│   │       └── V1__init.sql         # Schema completo PostgreSQL
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       ├── types/
│       └── utils/
├── docker-compose.yml               # Stack de producción
├── docker-compose.dev.yaml          # Infraestructura local (postgres + redis)
├── .env.example
└── CLAUDE.md                        # Contexto completo del proyecto
```

## Desarrollo local

### Requisitos

- Java 17+
- Maven 3.9+
- Node 20+
- Docker Desktop

### 1. Variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores locales si es necesario
```

### 2. Levantar infraestructura

```bash
docker compose -f docker-compose.dev.yaml up -d
```

Esto levanta PostgreSQL en `localhost:5432` y Redis en `localhost:6379`.

### 3. Backend

```bash
cd backend
mvn "-Dspring-boot.run.profiles=dev" spring-boot:run
```

API disponible en `http://localhost:8080`.

> La primera vez, Liquibase aplica `V1__init.sql` automáticamente y crea el schema completo.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

App disponible en `http://localhost:5173`. Las llamadas a `/api` se proxean al backend.

### Credenciales por defecto

| Campo      | Valor             |
| ---------- | ----------------- |
| Email      | `admin@magno.com` |
| Contraseña | `Admin@2024`      |
| Rol        | Administrador     |

## Producción

### 1. Configurar variables de entorno

Copiar `.env.example` a `.env` y completar todos los valores:

```bash
cp .env.example .env    b12 dX
```

Variables requeridas:

| Variable                                | Descripción                                                          |
| --------------------------------------- | -------------------------------------------------------------------- |
| `DB_USER` / `DB_PASS`                   | Credenciales PostgreSQL                                              |
| `REDIS_PASS`                            | Contraseña Redis                                                     |
| `JWT_SECRET`                            | Clave secreta JWT (mínimo 256 bits — usar `openssl rand -base64 64`) |
| `S3_ENDPOINT`                           | URL del bucket S3-compatible                                         |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY`       | Credenciales S3                                                      |
| `MAIL_HOST` / `MAIL_USER` / `MAIL_PASS` | Servidor SMTP                                                        |
| `CORS_ORIGINS`                          | Dominio(s) del frontend                                              |

### 2. Levantar el stack

```bash
docker compose up -d --build
```

### SSL

Colocar los certificados en `nginx/ssl/` y actualizar `nginx/nginx.conf` para habilitar HTTPS. En producción con Hetzner se recomienda usar Certbot o los certificados del proveedor.

## Módulos del sistema

| Módulo          | Roles con acceso                 |
| --------------- | -------------------------------- |
| Dashboard       | Todos                            |
| Cobros          | Todos                            |
| Créditos Nuevos | Admin, Supervisor, Sup. de Campo |
| Renovaciones    | Admin, Supervisor, Sup. de Campo |
| Clientes        | Admin, Supervisor, Sup. de Campo |
| Historial       | Admin, Supervisor, Sup. de Campo |
| Caja            | Admin, Supervisor                |
| Gastos          | Admin, Supervisor                |
| Reportes        | Admin, Supervisor                |
| Sucursales      | Admin                            |
| Usuarios        | Admin                            |
| Bitácora        | Admin                            |
| Administración  | Admin                            |

## Diseño mobile-first

Los asesores/cobradores usan la app desde su celular mientras cobran en campo. El diseño es **mobile-first obligatorio**: cada componente se diseña primero para móvil (`< 640px`) y luego escala con los breakpoints de Tailwind.

### Layout responsive

| Elemento              | Móvil                                 | Desktop (`lg:`) |
| --------------------- | ------------------------------------- | --------------- |
| Menú lateral          | Oculto, abre con botón hamburger (☰) | Siempre visible |
| Overlay               | Fondo semitransparente al abrir menú  | —               |
| Padding del contenido | `p-4`                                 | `p-6`           |

### Patrones de UI obligatorios

- **Tablas anchas** (grilla de cobros con 25+ columnas) → se convierten en **cards por cliente** en móvil
- **Formularios** → `grid-cols-1` en móvil, `md:grid-cols-2` en tablet
- **Botones de acción** → mínimo `44×44px` para uso táctil
- **Modales** → pantalla completa en móvil (`w-full h-full`), centrados con `max-w` en desktop

### Prioridad responsive por módulo

| Módulo                                   | Prioridad                         |
| ---------------------------------------- | --------------------------------- |
| Cobros — Ruta del Día                    | 🔴 Crítica — asesor en campo      |
| Cobros — Modal de pago                   | 🔴 Crítica — acción más frecuente |
| Clientes — ficha y listado               | 🔴 Crítica                        |
| Renovaciones, Dashboard, Créditos Nuevos | 🟡 Alta                           |
| Corte de Caja, Reportes, Administración  | 🟢 Media/Baja — uso en oficina    |

## Almacenamiento de archivos

Los archivos **nunca se guardan en PostgreSQL**. El backend los sube al bucket S3-compatible y almacena únicamente la URL.

| Tipo de archivo                  | Ruta en bucket                                               |
| -------------------------------- | ------------------------------------------------------------ |
| Evidencia del negocio (créditos) | `magno/evidencia-negocio/{cliente_id}/{credito_id}/`         |
| Imagen INE de usuario            | `magno/usuarios-ine/{usuario_id}/`                           |
| PDFs de corte de caja            | generados por backend, URL guardada en `cortes_caja.pdf_url` |

En **desarrollo on-premise** usar [MinIO](https://min.io/) como reemplazo S3-compatible.

## Comandos útiles

```bash
# Ver logs del backend en producción
docker compose logs -f backend

# Acceder a PostgreSQL
docker compose exec postgres psql -U magno -d magno_db

# Acceder a Redis
docker compose exec redis redis-cli -a $REDIS_PASS

# Recompilar solo el backend
docker compose up -d --build backend
```

## Plan de desarrollo

| Fase              | Módulos                                   | Semanas |
| ----------------- | ----------------------------------------- | ------- |
| 1 — Fundamentos   | Auth JWT + Usuarios + Roles + S3          | 1–3     |
| 2 — Clientes      | Alta, edición, ficha de cliente           | 4–6     |
| 3 — Créditos      | Solicitud + evaluación + tabla de pagos   | 7–10    |
| 4 — Cobros        | Cobros diarios, multas, registro de pagos | 11–14   |
| 5 — Renovaciones  | Renovaciones + Colocaciones semanales     | 15–17   |
| 6 — Caja y Gastos | Apertura/cierre de caja, gastos, corte    | 18–20   |
| 7 — Reportes      | PDF, correo, historial                    | 21–22   |
| 8 — Admin y QA    | Administración, bitácora, pruebas         | 23–24   |
