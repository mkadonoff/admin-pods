# Common Development Tasks

## Adding a New Route Endpoint

### Example: Add `GET /pods/:id` to get a single pod

**File**: `api/src/routes/pods.ts`

```typescript
// Add to createPodRoutes function:
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pod = await prisma.pod.findUnique({
      where: { podId: parseInt(id) },
      include: { assignments: true, ring: true },
    });
    if (!pod) {
      res.status(404).json({ error: 'Pod not found' });
      return;
    }
    res.json(pod);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pod' });
  }
});
```

**Update API client**: `web/src/api.ts`

```typescript
export const podAPI = {
  // ... existing methods
  getById: (id: number) => API.get(`/pods/${id}`),
};
```

**Use in component**:
```typescript
const pod = await podAPI.getById(podId);
```

---

## Adding a New React Component

### Example: Create `AssignmentForm` component

**File**: `web/src/components/AssignmentForm.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { entityAPI, assignmentAPI } from '../api';

interface AssignmentFormProps {
  podId: number;
  onSuccess: () => void;
}

export const AssignmentForm: React.FC<AssignmentFormProps> = ({ podId, onSuccess }) => {
  const [entities, setEntities] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState('');
  const [roleTag, setRoleTag] = useState('');

  useEffect(() => {
    loadEntities();
  }, []);

  const loadEntities = async () => {
    const response = await entityAPI.list();
    setEntities(response.data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await assignmentAPI.create(podId, {
        entityId: parseInt(selectedEntity),
        roleTag: roleTag || undefined,
      });
      onSuccess();
      setSelectedEntity('');
      setRoleTag('');
    } catch (error) {
      console.error('Failed to assign', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <select
        value={selectedEntity}
        onChange={(e) => setSelectedEntity(e.target.value)}
        required
      >
        <option value="">Select entity</option>
        {entities.map((e) => (
          <option key={e.entityId} value={e.entityId}>
            {e.displayName}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Role tag (optional)"
        value={roleTag}
        onChange={(e) => setRoleTag(e.target.value)}
      />
      <button type="submit">Assign</button>
    </form>
  );
};
```

**Use in parent**:
```typescript
<AssignmentForm
  podId={selectedPod}
  onSuccess={() => loadAssignments()}
/>
```

---

## Adding a New Database Model

### Example: Add `Pod.location` (coordinates)

**File**: `api/prisma/schema.prisma`

```prisma
model Pod {
  podId        Int      @id @default(autoincrement())
  floorId      Int
  ringId       Int
  slotIndex    Int
  name         String
  podType      String   @default("standard")
  locX         Float?   // Add this
  locY         Float?   // Add this
  floor        Floor    @relation(fields: [floorId], references: [floorId], onDelete: Cascade)
  ring         Ring     @relation(fields: [ringId], references: [ringId], onDelete: Cascade)
  assignments  PodAssignment[]

  @@unique([ringId, slotIndex])
  @@map("Pod")
}
```

**Create migration**:
```bash
npm run prisma:migrate addPodLocation
```

**Regenerate client**:
```bash
npm run prisma:generate
```

**Update API handler** to include new fields in update:
```typescript
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, podType, locX, locY } = req.body;
  const pod = await prisma.pod.update({
    where: { podId: parseInt(id) },
    data: {
      ...(name && { name }),
      ...(podType && { podType }),
      ...(locX !== undefined && { locX }),
      ...(locY !== undefined && { locY }),
    },
  });
  res.json(pod);
});
```

---

## Fixing a Database Issue

### Scenario: Accidentally created duplicate pods in a ring

**Debug**:
```bash
npm run prisma:studio
# Navigate to Pod table, filter by ringId
# Manually delete duplicates in UI
```

**Better: Reset and re-migrate**:
```bash
# ⚠️ DANGEROUS - only in dev!
# Drop all tables and re-run migrations:
npm run prisma:migrate reset
# Confirms with prompt, then re-applies all migrations
```

### Scenario: Can't add data due to constraint error

**Example error**: `"Unique constraint failed on the fields: (ringId, slotIndex)"`

**Cause**: Tried to create two pods in the same ring at same slot.

**Fix**: 
- Rings auto-create pods on creation (in `POST /floors/:floorId/rings`)
- Don't call `POST /pods` separately - use the ring endpoint instead

---

## Testing an API Endpoint with cURL (Windows)

```powershell
# Get all floors
curl -X GET http://localhost:3000/floors

# Create a floor
curl -X POST http://localhost:3000/floors `
  -H "Content-Type: application/json" `
  -d '{"name": "Floor 1", "orderIndex": 0}'

# Create a ring + auto-pods (requires floorId=1)
curl -X POST http://localhost:3000/floors/1/rings `
  -H "Content-Type: application/json" `
  -d '{"name": "Ring 1", "radiusIndex": 1, "slots": 6}'

# Update a floor
curl -X PATCH http://localhost:3000/floors/1 `
  -H "Content-Type: application/json" `
  -d '{"name": "Floor 1 Updated"}'

# Delete a floor
curl -X DELETE http://localhost:3000/floors/1
```

---

## Performance Tips

### 1. Reduce N+1 Queries
**Bad**:
```typescript
const pods = await prisma.pod.findMany({ where: { floorId } });
for (const pod of pods) {
  const assignments = await prisma.podAssignment.findMany({
    where: { podId: pod.podId }
  });
}
```

**Good**:
```typescript
const pods = await prisma.pod.findMany({
  where: { floorId },
  include: { assignments: true }  // Fetch in one query
});
```

### 2. Pagination for Large Lists
```typescript
const entities = await prisma.entity.findMany({
  skip: (page - 1) * 20,
  take: 20,
  where: { entityType }
});
```

### 3. Index Hot Columns
In `schema.prisma`:
```prisma
model Entity {
  entityId Int @id @default(autoincrement())
  entityType String @db.VarChar(50)
  displayName String
  externalSystemId String?
  
  @@index([entityType])  // Add index if frequently filtered
  @@map("Entity")
}
```

---

## Debugging Tips

### 1. Enable Prisma Query Logging
Add to `api/src/index.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

### 2. Check Request/Response with Postman
- Import the cURL commands above into Postman
- See exact payload and response
- Test auth headers before building in app

### 3. React Component Debug Logging
```typescript
useEffect(() => {
  console.log('FloorManager mounted, loading floors');
  loadFloors();
}, []);

useEffect(() => {
  console.log('Selected floor changed:', selectedFloor);
}, [selectedFloor]);
```

### 4. Break on Error
```typescript
try {
  await floorAPI.list();
} catch (error) {
  console.error('API error:', error);  // Will break in DevTools
  debugger;  // Pauses execution
}
```

---

## Deployment Checklist

- [ ] Remove `console.log()` statements
- [ ] Set `NODE_ENV=production`
- [ ] Configure production DATABASE_URL
- [ ] Build API: `npm run build`
- [ ] Build Web: `npm run build`
- [ ] Test production build locally
- [ ] Add error tracking (Sentry, etc)
- [ ] Add request logging middleware
- [ ] Set up CORS for production domain
- [ ] Enable HTTPS
