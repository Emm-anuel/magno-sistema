# Stack, Arquitectura y Convenciones — MAGNO v3.5

## 1. Descripción General

Sistema de gestión financiera a la medida para **MAGNO Financiera** (microfinanciera).
Digitaliza el ciclo completo: alta de cliente → colocación de crédito → cobro diario → renovación → corte de caja.

| Campo                  | Detalle                                                       |
| ---------------------- | ------------------------------------------------------------- |
| Usuarios concurrentes  | ~23                                                           |
| Sucursales             | 1 a 3                                                         |
| Plazo de desarrollo    | 24 semanas                                                    |
| Costo total            | $50,000 MXN sin IVA                                           |
| Estructura de pago     | 30% anticipo / 40% al 60% funcional / 30% entrega final       |
| Despliegue recomendado | Cloud VPS Hetzner/Contabo (~$20 USD/mes)                      |
| Opción futura          | Servidor on-premise cliente (Intel i5, 16 GB RAM, 250 GB SSD) |

---

## 2. Stack Tecnológico

| Capa                       | Tecnología                                                |
| -------------------------- | --------------------------------------------------------- |
| Frontend                   | React 18 + TypeScript + Vite + Tailwind CSS               |
| Estado servidor            | React Query                                               |
| HTTP client                | Axios con interceptor JWT                                 |
| Routing                    | React Router v6                                           |
| Backend                    | Spring Boot 3 + Java 17                                   |
| Autenticación              | Spring Security + JWT                                     |
| ORM                        | JPA / Hibernate                                           |
| Base de datos              | PostgreSQL                                                |
| Migraciones                | Liquibase                                                 |
| Caché                      | Redis (sesiones + tokens + datos frecuentes)              |
| PDF                        | iText                                                     |
| Email                      | JavaMailSender                                            |
| Contenedores               | Docker Compose                                            |
| Proxy                      | Nginx (reverse proxy + SSL termination)                   |
| Almacenamiento de archivos | S3-compatible (Hetzner Object Storage o MinIO on-premise) |
| Cloud VPS                  | Hetzner o Contabo (~$20 USD/mes) / Ubuntu 24 LTS          |

### Estructura del Repositorio (Monorepo)

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
│   │   ├── application.yml
│   │   └── db/changelog/   ← migraciones Liquibase
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       ├── types/
│       └── utils/
├── docker-compose.yml
└── CLAUDE.md
```

---

## 12. Seguridad

- JWT con expiración configurable.
- Contraseñas con hash **BCrypt** — nunca en texto plano ni en logs.
- Autorización RBAC con Spring Security.
- Todas las rutas de API protegidas excepto `/api/auth/login`.
- HTTPS obligatorio en producción (SSL vía Nginx).
- Redis para invalidación rápida de tokens (logout).
- Bitácora automática de todas las operaciones sensibles.

---

## 15. Convenciones de Código

### Backend (Java)

- Paquete base: `com.magno`
- Estructura: `controller / service / repository / model / dto / security / config`
- DTOs para todas las respuestas — nunca exponer entidades directamente
- Endpoints: `/api/auth`, `/api/clientes`, `/api/creditos`, `/api/cobros`, `/api/renovaciones`, `/api/caja`, `/api/gastos`, `/api/reportes`, `/api/usuarios`, `/api/sucursales`, `/api/bitacora`, `/api/admin`, `/api/files`

### Base de Datos

- Nombres en español, snake_case
- Montos: `DECIMAL(12,2)` siempre
- Archivos: solo URLs (`VARCHAR`), nunca bytes en BD
- Soft delete con `deleted_at`

### Frontend

- Estructura: `pages / components / hooks / services / types / utils`
- Montos de multa, ahorro, configs: siempre desde API, nunca hardcodeados
- Subida de archivos: multipart/form-data al endpoint `/api/files/upload`

---

## 16. Paleta de Colores (mockups aprobados)

| Color              | Hex       | Uso                                     |
| ------------------ | --------- | --------------------------------------- |
| Verde oscuro Magno | `#3d6b35` | Cabeceras, botones primarios, nav       |
| Verde medio        | `#5a8f50` | Hover, secundario                       |
| Blanco             | `#ffffff` | Fondos de contenido                     |
| Gris claro         | `#f5f5f5` | Fondos secundarios                      |
| Rojo               | `#dc2626` | ✗ no pagó, mora, alertas críticas       |
| Amarillo/ámbar     | `#f59e0b` | Multas, advertencias, pagos incompletos |
| Verde pago         | `#16a34a` | ✓ pagó, estados positivos               |

---

## 18. Notas Técnicas

- HTML standalone: NO usar Cloudflare email-decode.min.js — rompe scripts inline.
- El sistema debe funcionar en red local (intranet) sin internet constante — los archivos S3 deben ser accesibles desde la intranet si se usa MinIO.
- **4 roles exactos**, no 5 — no crear lógica ni permisos para un rol "Cajero" que no existe.
- Multas, ahorro diario, días festivos: siempre desde configuración de la API, nunca hardcodeados.
- Nómina: NO es módulo del sistema.
- Comprobante de gastos: campo de texto VARCHAR, no upload.
- `evidencia_urls` en créditos: array de URLs S3 (`TEXT[]` en PostgreSQL).
- `ine_imagen_url` en usuarios: string único URL S3 (`VARCHAR`).
- **Diseño mobile first obligatorio** — los asesores usan la app desde el celular en campo. La grilla de cobros se convierte en cards en móvil. Ver `04-modulos-y-ui.md` sección 17.
- Área de toque mínima en botones: 44×44px para uso táctil en campo.
