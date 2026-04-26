# MAGNO Sistema de Cobros — v3.5
> Microfinanciera | 23 usuarios | 3 sucursales | 24 semanas

## Contexto rápido
Sistema que digitaliza: alta de cliente → crédito → cobro diario → renovación → corte de caja.

Stack: Spring Boot 3 + Java 17 + PostgreSQL + Redis
       + React 18 + TypeScript + Vite + Tailwind CSS
Monorepo: /backend + /frontend
BD: Liquibase migrations en db/changelog/

## Módulos completados
- ✅ Módulo 1: Auth + Usuarios (JWT, BCrypt, 4 roles)
- ✅ Módulo 2: Clientes (CRUD completo, validaciones)
- ✅ Módulo 3: Créditos Nuevos (solicitud→aprobación→desembolso)
- ✅ Módulo 4: Cobros (ruta del día, multas, historial)
- ✅ Módulo 5: Renovaciones (backend + frontend completos)
- ⬜ Módulo 6: Corte de Caja
- ⬜ Módulo 7: Gastos
- ⬜ Módulo 8: Reportes
- ⬜ Módulo 9: Administración

## Decisiones críticas confirmadas
- 4 roles: ADMINISTRADOR→"Gerente General",
  SUPERVISOR→"Gerente de Sucursal",
  SUPERVISOR_CAMPO→"Supervisor",
  ASESOR_COBRADOR→"Asesor"
- Calendario: N días hábiles corridos (Opción C)
- Un crédito activo por cliente a la vez
- Zona $15k-$19,999: plazo=25d, tasa=24%
- Video de entrega: opcional, no bloquea activación
- Multas: se cobran con el siguiente pago
- Modificar pagos: solo Admin y Supervisor
- Comprobante de gastos: texto libre, NO upload

## Documentación detallada
Para contexto completo leer según la tarea:

| Tarea | Archivo |
|-------|---------|
| Stack, arquitectura, convenciones | docs/01-stack-y-arquitectura.md |
| Roles, permisos, acceso por módulo | docs/02-roles-y-permisos.md |
| Reglas de negocio, cálculos, tablas de pago | docs/03-reglas-de-negocio.md |
| UI, formularios, campos, responsive | docs/04-modulos-y-ui.md |
| Tablas de BD, campos, relaciones | docs/05-modelo-de-datos.md |
| Uploads, S3, MinIO, bucket structure | docs/06-archivos-y-storage.md |
| Decisiones confirmadas, pendientes, plan | docs/07-decisiones-y-pendientes.md |

## Reglas que NUNCA debes olvidar
- NUNCA usar FLOAT para montos → siempre DECIMAL(12,2)
- NUNCA almacenar archivos en PostgreSQL → URLs en S3
- NUNCA llamar "Cajero" a ningún rol — no existe
- NUNCA llamar "Préstamos" → siempre "Créditos Nuevos"
- NUNCA hardcodear multas o ahorro → desde config API
- Soft delete en tablas financieras → deleted_at
- DTOs para todas las respuestas de API
- Mobile-first obligatorio en TODO componente

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
