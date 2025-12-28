# Quick Start Guide

## 1. Setup SQL Server

### Option A: Local SQL Server
Install SQL Server Express, then create a database:
```sql
CREATE DATABASE admin_pods;
```

### Option B: Docker (Windows PowerShell)
```powershell
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourPassword123" `
  -p 1433:1433 --name admin-pods-db `
  mcr.microsoft.com/mssql/server:latest
```

Wait 30s for startup, then verify:
```powershell
sqlcmd -S localhost -U sa -P YourPassword123 -Q "SELECT 1"
```

## 2. Setup API

```powershell
cd api
npm install
```

Create `.env`:
```
DATABASE_URL="Server=localhost;Database=admin_pods;User=sa;Password=YourPassword123;TrustServerCertificate=true"
PORT=3000
NODE_ENV=development
```

Run migrations:
```powershell
npm run prisma:migrate init
```

Start API server:
```powershell
npm run dev
```

Verify at `http://localhost:3000/health` → should see `{ "status": "ok" }`

## 3. Setup Web

In a new terminal:
```powershell
cd web
npm install
npm run dev
```

Open `http://localhost:5173`

## One-command startup (Windows)

From the repo root:

```powershell
./start-dev.ps1
```

Or:

```powershell
./start-dev.bat
```

This starts both servers and opens `http://localhost:5173`.

## 4. Test the App

1. Click "Add Floor" → type "Floor 1" → Add
2. Click "Floor 1"
3. Use Prisma Studio to create test data: `npm run prisma:studio` (from api/)

## Troubleshooting

**API won't start:**
- Check DATABASE_URL in `.env`
- Run `npm run prisma:generate` to regenerate Prisma client
- Check SQL Server is running

**React app shows "Cannot find module":**
- Delete `web/node_modules` and `web/package-lock.json`
- Run `npm install` again

**CORS errors:**
- Ensure API is running on port 3000
- Check Vite proxy config in `web/vite.config.ts`

## Key Commands

```bash
# API
cd api && npm run dev                # Start with hot reload
npm run prisma:studio               # Visual DB explorer
npm run prisma:migrate <name>       # Create migration

# Web
cd web && npm run dev               # Start with hot reload
npm run build                       # Production build
```

## Next Steps

- Add more entity types in Prisma Studio
- Improve layout visualization (SVG rings)
- Add floor reordering validation
- Build assignment workflow
