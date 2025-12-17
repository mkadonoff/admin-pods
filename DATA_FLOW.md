# Component Data Flow Diagram

## Screen Layout

```
┌─────────────────────────────────────────────────────────┐
│  Admin Pods Application                                 │
├─────────────────┬─────────────────────────┬─────────────┤
│                 │                         │             │
│  FloorManager   │      LayoutView         │  Entity     │
│  (left)         │      (center)           │  Library    │
│                 │                         │  (right)    │
│  - Floor list   │  - Ring visualization  │             │
│  - Reorder ↑↓   │  - Click pod → select  │  - Search   │
│  - Add new      │                         │  - Type     │
│                 │     PodDetailDrawer     │  - Filter   │
│                 │     (right overlay)     │             │
│                 │                         │             │
│                 │  - Edit pod name       │             │
│                 │  - List assignments    │             │
│                 │  - Add/remove assign   │             │
└─────────────────┴─────────────────────────┴─────────────┘
```

## State & Data Flow

### 1. App.tsx (Main Container)
```
App
├── selectedFloor: number | null        ← User picks from FloorManager
├── selectedPod: number | null          ← User clicks in LayoutView
│
└── Components:
    ├─ FloorManager
    │  └─ onFloorSelect(id) → sets selectedFloor
    │
    ├─ LayoutView (if selectedFloor)
    │  ├─ Fetches pods for floor
    │  └─ onPodSelect(id) → sets selectedPod
    │
    ├─ EntityLibrary (if selectedFloor)
    │  └─ Fetches entities (searchable)
    │
    └─ PodDetailDrawer (if selectedPod)
       └─ Fetches assignments for pod
```

### 2. FloorManager Data Flow
```
FloorManager
├─ API Call: GET /floors
├─ State: floors: Floor[]
├─ Renders: floor list with ↑↓ reorder buttons
├─ Actions:
│  ├─ PATCH /floors/:id (update orderIndex) → reload
│  └─ POST /floors (create) → reload
└─ Emits: onFloorSelect(floorId)
```

### 3. LayoutView Data Flow
```
LayoutView (needs floorId)
├─ API Call: GET /floors/:floorId/pods (includes assignments)
├─ State: pods: Pod[]
├─ Renders:
│  ├─ Center pods (podType='center')
│  ├─ Ring 1 pods (ringId=1)
│  └─ Ring 2 pods (ringId=2)
└─ Emits: onPodSelect(podId)
```

### 4. PodDetailDrawer Data Flow
```
PodDetailDrawer (needs podId)
├─ API Calls:
│  ├─ GET /pods/:podId/assignments (shows linked entities)
│  ├─ PATCH /pods/:id (edit name/type)
│  └─ DELETE /assignments/:id (remove assignment)
├─ State: assignments: Assignment[]
├─ Renders: assignment list with remove buttons
└─ Actions: mutate → reload assignments
```

### 5. EntityLibrary Data Flow
```
EntityLibrary
├─ API Call: GET /entities?type=X&q=Y
├─ State: entities: Entity[], filter: string, search: string
├─ Renders: filterable entity list
├─ Actions:
│  ├─ Update filter → reload
│  ├─ Update search → reload
│  └─ (future: drag to pod to assign)
└─ Note: No emit - display only in MVP
```

## API Request Sequence Example

**User flow: Create Floor → Select Floor → Select Pod → View Assignments**

```
1. FloorManager mounts
   → GET /floors
   → Display floor list

2. User clicks "Floor 1"
   → onFloorSelect(1) 
   → App sets selectedFloor = 1

3. LayoutView mounts (selectedFloor=1)
   → GET /floors/1/pods
   → Render rings

4. User clicks a pod button
   → onPodSelect(5)
   → App sets selectedPod = 5

5. PodDetailDrawer mounts (selectedPod=5)
   → GET /pods/5/assignments
   → Display linked entities

6. User clicks "Remove" on assignment
   → DELETE /assignments/3
   → loadAssignments() (reload from GET /pods/5/assignments)
```

## How API Client Works

All HTTP calls go through `web/src/api.ts`:

```typescript
// Example usage in component:
const loadFloors = async () => {
  try {
    const response = await floorAPI.list();      // GET /floors
    setFloors(response.data);
  } catch (error) {
    console.error('Failed to load floors', error);
  }
};

const handleCreate = async (name: string) => {
  await floorAPI.create({                         // POST /floors
    name,
    orderIndex: floors.length,
  });
  loadFloors();  // Reload after mutation
};
```

**Pattern**: Always reload data after mutations (`POST`, `PATCH`, `DELETE`).

## Unique Patterns in This Codebase

### Pattern 1: Auto-Pod Creation on Ring Creation
```typescript
// When user creates a ring, the API does this:
POST /floors/:floorId/rings
→ Create Ring record
→ Loop: Create Pod for each slot
→ If radiusIndex=0: Create center Pod
// No separate pod creation needed
```

### Pattern 2: Unique Constraint Handling
```typescript
// In assignments.ts:
try {
  const assignment = await prisma.podAssignment.create({...});
} catch (error: any) {
  if (error.code === 'P2002') {
    // Duplicate (podId, entityId) - entity already assigned
    res.status(400).json({ error: 'Entity already assigned' });
  }
}
```

### Pattern 3: Optional Fields in Updates
```typescript
// In floors.ts update handler:
const floor = await prisma.floor.update({
  where: { floorId: parseInt(id) },
  data: {
    ...(name && { name }),                      // Only update if provided
    ...(orderIndex !== undefined && { orderIndex })
  }
});
// Allows partial updates without overwriting other fields
```

---

## Testing a Component in Isolation

1. **Test FloorManager**: 
   - Mock `floorAPI` with hard-coded data
   - Click buttons, verify `onFloorSelect` callback fires

2. **Test LayoutView**:
   - Pass `floorId={1}` as prop
   - Mock `podAPI.listByFloor` response
   - Verify pods render in correct positions

3. **Test data fetching**:
   - Use Prisma Studio to seed test data
   - Start API server, call endpoints directly with curl/Postman
