# Admin Pods MVP - Project Summary

## What Was Created

A production-ready MVP monorepo for pod/ring/floor management with spatial layout visualization:

### Backend (`api/`)
- **Express.js** server with TypeScript
- **Prisma ORM** for SQL Server
- 5 route modules (Floors, Rings, Pods, Entities, Assignments)
- Auto-pod generation when creating rings
- Unique constraint enforcement

### Frontend (`web/`)
- **React 18** with Vite
- 4 core components: FloorManager, LayoutView, PodDetailDrawer, EntityLibrary
- Centralized axios API client
- Simple ring layout visualization (center, ring 1, ring 2)

### Database
- 6 Prisma models with proper relationships
- Enforced uniqueness constraints at DB level
- Ready for SQL Server (Azure SQL or on-prem)

## Project Files

```
admin-pods/
├── README.md                          # Full documentation
├── QUICKSTART.md                      # Get running in 5 min
├── .github/
│   └── copilot-instructions.md       # ← AI AGENT GUIDE (detailed)
├── .gitignore
├── .prettierrc
│
├── api/
│   ├── src/
│   │   ├── index.ts                  # Express app setup
│   │   └── routes/
│   │       ├── floors.ts             # GET/POST/PATCH/DELETE /floors
│   │       ├── rings.ts              # Rings + auto pod creation
│   │       ├── pods.ts               # Pods (linked to rings)
│   │       ├── entities.ts           # External entities (Customer, Dept, etc)
│   │       └── assignments.ts        # Pod↔Entity assignments
│   ├── prisma/
│   │   └── schema.prisma             # 6 models, constraints
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
└── web/
    ├── src/
    │   ├── api.ts                    # Axios client (all endpoints)
    │   ├── components/
    │   │   ├── FloorManager.tsx       # Left sidebar: floor list + reorder
    │   │   ├── LayoutView.tsx         # Center: ring visualization
    │   │   ├── PodDetailDrawer.tsx    # Right: pod details + assignments
    │   │   └── EntityLibrary.tsx      # Right: entity search/filter
    │   ├── App.tsx                   # Main layout
    │   ├── main.tsx                  # Entry point
    │   └── App.css, index.css
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts
```

## How to Use

### 1. Open in VS Code
Open the `/admin-pods` folder in VS Code. The workspace will recognize both `api/` and `web/` as separate projects.

### 2. Install & Run (Terminal)
```bash
# Terminal 1: API
 cd api
npm install
npm run dev         # Listens on port 3000

# Terminal 2: Web
cd web
npm install
npm run dev          # Listens on port 5173
```

### 3. Database Setup
Configure `api/.env` with your SQL Server connection, then:
```bash
npm run prisma:migrate init
```

### 4. Visit `http://localhost:5173`
- Add floors
- Select floor to view rings
- Click pods to edit details
- See entity library on the right

## For AI Agents (Most Important!)

**Read `.github/copilot-instructions.md`** - it contains:
- ✅ Why the project is structured this way
- ✅ Critical workflows (e.g., ring creation auto-generates pods)
- ✅ Database constraint enforcement patterns
- ✅ Where to find code patterns and examples
- ✅ Common mistakes to avoid
- ✅ Debugging tips
- ✅ File reference guide with links

**Key architectural decisions documented:**
- Monorepo structure with shared DB
- Prisma for SQL Server (not TypeORM or raw SQL)
- React hooks for state management (not Redux—this is MVP)
- Centralized axios client in `web/src/api.ts`
- Route handlers as exported functions (not direct exports)

## Next Steps for Development

1. **Test the setup**: Run both servers, create test data in Prisma Studio
2. **Add more features**: Ring reordering, better layout visualization, assignment workflow
3. **Improve UI**: Add form validation, loading states, error handling
4. **Add auth**: Integrate with Azure AD or similar
5. **Deploy**: Container both services (Docker), deploy to Azure Container Instances

## Tech Debt / MVP Limitations

- No input validation (add `zod` or `joi`)
- No pagination (add to entity list)
- Layout is static (ring 0 center, ring 1-2 fixed)
- No optimistic updates (add loading states)
- No error boundaries in React
- No API request/response logging middleware

All are documented in the AI instructions for future sprints.

---

**Status**: ✅ Ready for development. All dependencies, configs, and core endpoints implemented.
