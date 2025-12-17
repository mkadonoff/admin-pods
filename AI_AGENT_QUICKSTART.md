# 🤖 AI Agent Quick Reference

This is a one-page guide for AI coding agents working on admin-pods.

## 30-Second Overview

**Admin Pods** = Pod/Ring/Floor spatial management system

- **Backend**: Express.js + TypeScript + Prisma + SQL Server
- **Frontend**: React 18 + Vite + TypeScript
- **Architecture**: Monorepo (api/ + web/) sharing single SQL Server database
- **MVP Status**: ✅ All core endpoints implemented, basic UI working

---

## Critical Rules (Don't Violate)

### Database
1. ❌ **Do NOT create pods separately** → Rings auto-create pods on `POST /floors/:floorId/rings`
2. ✅ Unique constraint `(ringId, slotIndex)` enforced at DB level
3. ✅ Unique constraint `(podId, entityId)` prevents duplicate assignments
4. ✅ Always run `npm run prisma:generate` after schema changes

### API
1. ❌ **Do NOT create axios instances in routes** → Use injected Prisma client
2. ✅ Route handlers = exported functions: `export default function createXxxRoutes(prisma)`
3. ✅ Return HTTP 400 for constraint violations (P2002 errors)
4. ✅ Include try-catch with descriptive error messages

### React
1. ❌ **Do NOT fetch from components directly** → Use centralized `web/src/api.ts`
2. ✅ Always reload data after mutations (POST, PATCH, DELETE)
3. ✅ Component state: function-based with hooks, no class components
4. ✅ Props flow: App → FloorManager/LayoutView/EntityLibrary → children

---

## File Quick Reference

| What | Where |
|------|-------|
| **API routes** | `api/src/routes/*.ts` |
| **Database schema** | `api/prisma/schema.prisma` |
| **React components** | `web/src/components/*.tsx` |
| **API client** | `web/src/api.ts` |
| **Main app** | `web/src/App.tsx` |
| **Express setup** | `api/src/index.ts` |
| **AI instructions** | `.github/copilot-instructions.md` ← **READ THIS FIRST** |
| **Data flow diagram** | `DATA_FLOW.md` |
| **Dev patterns** | `DEVELOPMENT.md` |

---

## Common Tasks (Copy-Paste Ready)

### Add a New API Endpoint

**1. Add route in `api/src/routes/floors.ts`:**
```typescript
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const floor = await prisma.floor.findUnique({
      where: { floorId: parseInt(req.params.id) },
    });
    res.json(floor);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch floor' });
  }
});
```

**2. Add client method in `web/src/api.ts`:**
```typescript
export const floorAPI = {
  getById: (id: number) => API.get(`/floors/${id}`),
};
```

**3. Use in component:**
```typescript
const floor = await floorAPI.getById(1);
```

### Add a New React Component

**File: `web/src/components/MyComponent.tsx`**
```typescript
import React, { useState, useEffect } from 'react';
import { floorAPI } from '../api';

interface Props {
  floorId: number;
  onSelect: (id: number) => void;
}

export const MyComponent: React.FC<Props> = ({ floorId, onSelect }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    loadData();
  }, [floorId]);

  const loadData = async () => {
    const response = await floorAPI.list();
    setData(response.data);
  };

  return (
    <div>
      {data.map((item) => (
        <button key={item.id} onClick={() => onSelect(item.id)}>
          {item.name}
        </button>
      ))}
    </div>
  );
};
```

### Add Database Migration

```bash
cd api

# 1. Edit api/prisma/schema.prisma (add field/model)
# 2. Create migration
npm run prisma:migrate addMyFeature

# 3. Regenerate client
npm run prisma:generate

# 4. Restart API server (hot reload should catch it)
```

### Test an API Endpoint

```bash
# Get all floors
curl http://localhost:3000/floors

# Create floor
curl -X POST http://localhost:3000/floors \
  -H "Content-Type: application/json" \
  -d '{"name":"Floor 1","orderIndex":0}'

# Update floor
curl -X PATCH http://localhost:3000/floors/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated"}'

# Create ring (auto-creates pods)
curl -X POST http://localhost:3000/floors/1/rings \
  -H "Content-Type: application/json" \
  -d '{"name":"Ring 1","radiusIndex":1,"slots":6}'
```

---

## Data Model (Schema)

```
Floor (floorId, name, orderIndex)
  ↓
Ring (ringId, floorId, name, radiusIndex, slots)
  ↓
Pod (podId, floorId, ringId, slotIndex, name, podType)
  ↓
PodAssignment (assignmentId, podId, entityId, roleTag, createdAt)
  ↓
Entity (entityId, entityType, displayName, externalSystemId)

Constraints:
- (ringId, slotIndex) unique → only 1 pod per ring slot
- (podId, entityId) unique → no duplicate assignments
- Cascading deletes on all relationships
```

---

## Component Tree

```
App
├─ FloorManager (left sidebar)
│  └─ onFloorSelect(id)
├─ LayoutView (center) [if selectedFloor]
│  ├─ Renders center + 2 rings of pods
│  └─ onPodSelect(id)
├─ EntityLibrary (right) [if selectedFloor]
│  └─ Search/filter entities
└─ PodDetailDrawer (right overlay) [if selectedPod]
   ├─ Edit pod name/type
   └─ List + remove assignments
```

---

## Build & Run

```bash
# Terminal 1: API
cd api && npm install && npm run dev    # http://localhost:3000

# Terminal 2: Web
cd web && npm install && npm run dev    # http://localhost:5173

# Database visualization
cd api && npm run prisma:studio         # http://localhost:5555
```

---

## Key Patterns

### Route Handler Pattern
```typescript
export default function createXxxRoutes(prisma: PrismaClient) {
  // Not: export const router = Router()
  // This allows injection of prisma client
  router.get('/', async (req, res) => { ... });
  return router;
}
```

### Error Handling Pattern
```typescript
try {
  // db operation
} catch (error: any) {
  if (error.code === 'P2002') {
    res.status(400).json({ error: 'Unique constraint violation' });
  } else {
    res.status(500).json({ error: 'Unexpected error' });
  }
}
```

### Partial Update Pattern
```typescript
data: {
  ...(name && { name }),                    // Only update if provided
  ...(orderIndex !== undefined && { orderIndex })
}
```

### React Fetch Pattern
```typescript
const [data, setData] = useState([]);

useEffect(() => {
  loadData();
}, [dependency]);

const loadData = async () => {
  try {
    const res = await apiClient.list();
    setData(res.data);
  } catch (error) {
    console.error('Load failed', error);
  }
};
```

---

## Debugging

```bash
# 1. Check API is running
curl http://localhost:3000/health

# 2. Check database
npm run prisma:studio  # Visual DB browser

# 3. Check logs
# Terminal running API: look for error messages
# Browser console: React DevTools + Network tab

# 4. Check Prisma client is regenerated
npm run prisma:generate
```

---

## DO's and DON'Ts

### ✅ DO

- Follow existing patterns in `floors.ts`, `FloorManager.tsx`
- Always use centralized `api.ts` client
- Run migrations before schema changes
- Reload data after mutations
- Return descriptive error messages
- Use TypeScript types everywhere

### ❌ DON'T

- Create pods manually → use ring creation endpoint
- Fetch directly in components → use `api.ts`
- Export routes directly → export as function
- Mutate Prisma responses → use update endpoints
- Ignore constraint violations → return HTTP 400
- Commit `.env` files → use `.env.example`

---

## Test Scenarios

### Scenario 1: Create a complete layout
1. `POST /floors` → create Floor 1
2. `POST /floors/1/rings` (radiusIndex=0, slots=1) → creates center ring + center pod
3. `POST /floors/1/rings` (radiusIndex=1, slots=6) → creates ring 1 + 6 pods
4. Check in Prisma Studio → should see 1 floor, 2 rings, 7 pods total

### Scenario 2: Assign entity to pod
1. Create floor + rings + pods (above)
2. `POST /entities` → create entity
3. `POST /pods/1/assignments` → assign entity to a pod
4. Try again → should fail with 400 (duplicate constraint)

### Scenario 3: Reorder floors
1. `POST /floors` → create Floor 1 (orderIndex=0)
2. `POST /floors` → create Floor 2 (orderIndex=1)
3. `PATCH /floors/1` → set orderIndex=1
4. `PATCH /floors/2` → set orderIndex=0
5. `GET /floors` → verify order changed

---

## Useful Docs

- **`.github/copilot-instructions.md`** ← Critical workflows & gotchas
- **`DATA_FLOW.md`** ← Component interactions
- **`DEVELOPMENT.md`** ← How to add features
- **`README.md`** ← Full API reference

---

## When Stuck

1. Read `.github/copilot-instructions.md` section on the problem
2. Check `DEVELOPMENT.md` for the pattern
3. Look at existing similar code (e.g., add GET by copying POST pattern)
4. Run `npm run prisma:studio` to inspect database state
5. Check browser Network tab for exact API request/response

---

**Ready? Open admin-pods/ in VS Code, run npm install + npm run dev in both directories, then visit http://localhost:5173**
