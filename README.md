# Admin Pods

Pod/Ring/Floor management system for organizing entities in a spatial layout.

## Project Structure

```
admin-pods/
├── api/                          # Node.js Express backend
│   ├── src/
│   │   ├── index.ts             # Express server entry point
│   │   └── routes/              # API route handlers
│   ├── prisma/
│   │   └── schema.prisma        # Database schema
│   ├── package.json
│   └── tsconfig.json
├── web/                         # React frontend with Vite
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── api.ts               # API client
│   │   ├── App.tsx              # Main app component
│   │   └── main.tsx             # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
└── .github/
    └── copilot-instructions.md  # AI agent instructions
```

## Architecture

**MVP Stack:**
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQL Server with Prisma ORM
- **Frontend**: React 18 with Vite

**Core Entities:**
- **Floor**: Top-level container with orderIndex for reordering
- **Ring**: Concentric rings within a floor (radiusIndex, slots)
- **Pod**: Individual unit in a ring slot (unique per ring+slot)
- **Entity**: External entities (Customer, Department, etc.)
- **PodAssignment**: Link between Pod and Entity with optional roleTag
- **LayoutSnapshot**: JSON snapshots of floor layouts for history

**Key Constraints:**
- Unique: `(ringId, slotIndex)` - only one pod per ring slot
- Unique: `(podId, entityId)` - no duplicate assignments

## Setup

### Prerequisites
- Node.js 18+
- SQL Server (local or Azure SQL)

### API Setup

```bash
cd api
npm install
```

Configure `.env`:
```
DATABASE_URL="Server=localhost;Database=admin_pods;User=sa;Password=YourPassword123;TrustServerCertificate=true"
PORT=3000
```

Run migrations:
```bash
npm run prisma:migrate init
```

Start dev server:
```bash
npm run dev
```

### Web Setup

```bash
cd web
npm install
npm run dev
```

Server runs on `http://localhost:5173`, proxies API calls to `http://localhost:3000`.

## Start both servers (Windows)

From the repo root:

```powershell
./start-dev.ps1
```

Or:

```powershell
./start-dev.bat
```

This starts both dev servers and opens the React app.

## API Endpoints

### Floors
- `GET /floors` - List all floors
- `POST /floors` - Create floor
- `PATCH /floors/:id` - Update name/orderIndex
- `DELETE /floors/:id` - Delete floor

### Rings
- `GET /floors/:floorId/rings` - List rings for floor
- `POST /floors/:floorId/rings` - Create ring + auto-create pods
- `PATCH /rings/:id` - Update ring name
- `DELETE /rings/:id` - Delete ring

### Pods
- `GET /floors/:floorId/pods` - List pods for floor
- `PATCH /pods/:id` - Update pod name/type

### Entities
- `GET /entities?type=Customer&q=acme` - List/search entities
- `POST /entities` - Create entity
- `PATCH /entities/:id` - Update entity
- `DELETE /entities/:id` - Delete entity

### Assignments
- `GET /pods/:podId/assignments` - List assignments for pod
- `POST /pods/:podId/assignments` - Assign entity to pod
- `DELETE /assignments/:id` - Remove assignment

## React Components

- **FloorManager**: Lists floors with reorder buttons (up/down)
- **LayoutView**: Visual ring layout for selected floor, click pod to select
- **PodDetailDrawer**: Edit pod details, view/remove assignments
- **EntityLibrary**: Search/filter entities by type, create new

## Development

- Both `npm run dev` commands start watchers for hot reload
- API: TypeScript → transpiled to JS
- Web: Vite dev server with React Fast Refresh
- Prisma studio: `npm run prisma:studio` (from api/)
