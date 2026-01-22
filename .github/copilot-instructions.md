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

This is in <a href="api/src/routes/rings.ts">api/src/routes/rings.ts</a>. **Do not create pods separately.**

### Assignment Uniqueness

The `(podId, entityId)` unique constraint is enforced at the DB level. The API catches `P2002` (duplicate key) errors and returns a 400. See <a href="api/src/routes/assignments.ts">api/src/routes/assignments.ts</a>.

## Development Patterns

### API Request Handlers

All route files follow this pattern:
```typescript
export default function createXxxRoutes(prisma: PrismaClient) {
  router.get('/', async (req, res) => { ... })
  return router;
}
```

The router is exported as a default function, not directly. See <a href="api/src/routes/floors.ts">api/src/routes/floors.ts</a> for reference.

### React Data Fetching

Use the `api.ts` centralized axios client (<a href="web/src/api.ts">web/src/api.ts</a>). All API methods are grouped by resource:

```typescript
await entityAPI.list(type, q);  // GET /entities?type=X&q=Y
await podAPI.update(id, data);  // PATCH /pods/:id
```

**Do not create axios instances in components.** Components import from `api.ts` and call the exported functions.

### Component Structure

Components are function-based with hooks. State is local unless shared across multiple screens. See <a href="web/src/components/FloorManager.tsx">web/src/components/FloorManager.tsx</a> for the pattern.

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
- Web: Hardcoded to 5173 in <a href="web/vite.config.ts">web/vite.config.ts</a>
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
| Db schema, relationships | <a href="api/prisma/schema.prisma">api/prisma/schema.prisma</a> |
| HTTP routes | <a href="api/src/routes/">api/src/routes/*.ts</a> |
| React components | <a href="web/src/components/">web/src/components/*.tsx</a> |
| API client | <a href="web/src/api.ts">web/src/api.ts</a> |
| Server entry | <a href="api/src/index.ts">api/src/index.ts</a> |
| App entry | <a href="web/src/App.tsx">web/src/App.tsx</a> |

## Debugging Tips

- Use `npm run prisma:studio` to inspect database state
- Check API logs in terminal running `npm run dev` (api/)
- React DevTools for component state inspection
- Network tab for request/response validation

## Testing

### API Tests
The API has Jest configured but no tests written yet. When adding tests:
```bash
cd api
npm test                   # Run all tests
npm test -- --watch        # Run in watch mode
npm test -- <pattern>      # Run specific test file
```

Test files should be placed in `api/src/__tests__/` or co-located with source files using `.test.ts` extension.

### Frontend Tests
No test framework is currently configured for the frontend. Consider adding Vitest for React component testing if needed.

## Code Formatting

Prettier is configured (<a href=".prettierrc">.prettierrc</a>) but no format scripts are defined in api/ or web/ package.json files. To format code manually:
```bash
# Install prettier globally or use npx
npx prettier --write "**/*.{ts,tsx,js,jsx,json,md}"
```

Recommended: Add format scripts to package.json files:
- `"format": "prettier --write \"src/**/*.{ts,tsx}\""`
- `"format:check": "prettier --check \"src/**/*.{ts,tsx}\""`

## Troubleshooting

### Common Issues

**Database connection errors:**
- Verify SQL Server is running
- Check `DATABASE_URL` in `api/.env`
- Test connection: `npm run prisma:studio` from api/

**Prisma client errors:**
- Run `npm run prisma:generate` from api/
- Restart API dev server after schema changes

**API not responding:**
- Check API is running on port 3000
- Verify no port conflicts: `lsof -i :3000` (Unix) or `netstat -ano | findstr ":3000"` (Windows)
- Check API logs for errors

**Frontend proxy errors:**
- Ensure API is running before starting frontend
- Check Vite config proxy settings in <a href="web/vite.config.ts">web/vite.config.ts</a>
- Clear browser cache and restart Vite dev server

**TypeScript errors after schema changes:**
- Run `npm run prisma:generate` from api/
- Restart TypeScript server in your editor
- Check that changes are reflected in `node_modules/.prisma/client`
