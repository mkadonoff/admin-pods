# Admin Pods - AI Agent Instructions

## Architecture Overview

This is a **monorepo** with two independent Node.js projects sharing a SQL Server database. The architecture is designed for fast iteration on a pod management system.

### Directory Layout
- `api/` - Express.js backend (port 3000)
- `web/` - React frontend (port 5173)
- `.github/copilot-instructions.md` - This file

### Database Schema (SQL Server via Prisma)

The schema enforces these core constraints:

1. **Pod Uniqueness**: `(ringId, slotIndex)` unique constraint prevents duplicate pods
2. **No Duplicate Assignments**: `(podId, entityId)` unique constraint prevents assigning same entity twice

Key relationships:
- Floor → Rings (1:N)
- Ring → Pods (1:N) 
- Pod → PodAssignments → Entity (M:N)

Ring zero is the center; rings 1+ radiate outward. When creating a ring, the API auto-creates pods for all slots and a center pod if `radiusIndex=0`.

## Critical Workflows

### Creating a Ring with Auto-Pod Generation

When `POST /floors/:floorId/rings`, the endpoint automatically:
1. Creates the Ring record
2. Creates a Pod for each slot (slotIndex 0 to slots-1)
3. If `radiusIndex=0`, creates an extra Pod with `slotIndex=-1` (center)

This is in [api/src/routes/rings.ts](../api/src/routes/rings.ts). **Do not create pods separately.**

### Assignment Uniqueness

The `(podId, entityId)` unique constraint is enforced at the DB level. The API catches `P2002` (duplicate key) errors and returns a 400. See [api/src/routes/assignments.ts](../api/src/routes/assignments.ts).

## Development Patterns

### API Request Handlers

All route files follow this pattern:
```typescript
export default function createXxxRoutes(prisma: PrismaClient) {
  router.get('/', async (req, res) => { ... })
  return router;
}
```

The router is exported as a default function, not directly. See [api/src/routes/floors.ts](../api/src/routes/floors.ts) for reference.

### React Data Fetching

Use the `api.ts` centralized axios client ([web/src/api.ts](../web/src/api.ts)). All API methods are grouped by resource:

```typescript
await entityAPI.list(type, q);  // GET /entities?type=X&q=Y
await podAPI.update(id, data);  // PATCH /pods/:id
```

**Do not create axios instances in components.** Components import from `api.ts` and call the exported functions.

### Component Structure

Components are function-based with hooks. State is local unless shared across multiple screens. See [web/src/components/FloorManager.tsx](../web/src/components/FloorManager.tsx) for the pattern.

## Project-Specific Conventions

### Prisma Migrations

Run migrations from `api/` directory:
```bash
npm run prisma:migrate <name>  # Create + apply migration
npm run prisma:generate        # Regenerate Prisma client
```

Always regenerate after schema changes. Migrations are additive only in this MVP.

### Environment Files

- `api/.env.example` - Template for `api/.env`
- No `.env` files in git; add to `.gitignore`

### Port Configuration

- API: `PORT` env var (default 3000)
- Web: Hardcoded to 5173 in [web/vite.config.ts](../web/vite.config.ts)
- Web proxies `/api/*` requests to `http://localhost:3000`

## Build & Test Commands

### API
```bash
cd api
npm run dev              # Watch mode with hot reload
npm run build            # Compile to dist/
npm run prisma:studio    # Visual DB browser
npm run prisma:migrate   # Create + apply migrations
```

### Web
```bash
cd web
npm run dev              # Vite dev server + hot reload
npm run build            # Build for production (dist/)
npm run preview          # Preview production build
```

## Common Patterns to Avoid

- **Don't fetch from components** - use centralized `api.ts`
- **Don't mutate Prisma responses** - always use update/patch endpoints
- **Don't create pods manually** - use ring creation endpoint
- **Don't bypass unique constraints** - catch and handle constraint errors

## Useful Files Reference

| Purpose | File |
|---------|------|
| Db schema, relationships | [api/prisma/schema.prisma](../api/prisma/schema.prisma) |
| HTTP routes | [api/src/routes/*.ts](../api/src/routes) |
| React components | [web/src/components/*.tsx](../web/src/components) |
| API client | [web/src/api.ts](../web/src/api.ts) |
| Server entry | [api/src/index.ts](../api/src/index.ts) |
| App entry | [web/src/App.tsx](../web/src/App.tsx) |

## Debugging Tips

- Use `npm run prisma:studio` to inspect database state
- Check API logs in terminal running `npm run dev` (api/)
- React DevTools for component state inspection
- Network tab for request/response validation
