# Deployment Guide

## Production Deployment

This guide covers deploying Admin Pods to production.

## Prerequisites

✅ Both projects built successfully:
- `cd api && npm run build` → creates `api/dist/`
- `cd web && npm run build` → creates `web/dist/`

✅ Database configured:
- SQL Server connection string in `api/.env`
- All migrations applied: `cd api && npm run prisma:migrate`

✅ Production environment variables configured in `api/.env`

## Local Production Testing

Before deploying to a remote server, test production builds locally:

### Windows
```bash
# Start both services
.\start-prod.bat

# Or use PowerShell directly
.\start-prod.ps1
```

### Linux/macOS
```bash
# Start API (Terminal 1)
cd api
npm start

# Start Web preview (Terminal 2)
cd web
npm run preview
```

**Services:**
- API: http://localhost:3000
- Web: http://localhost:4173

## Production Environment Variables

Create `api/.env` with production settings:

```env
# Database
DATABASE_URL="sqlserver://SERVER:1433;database=AdminPods;user=USERNAME;password=PASSWORD;encrypt=true;trustServerCertificate=true"

# Server
PORT=3000
NODE_ENV=production

# CORS (set to your production web URL)
CORS_ORIGIN=http://your-domain.com
```

## Deployment Options

### Option 1: Windows Server / VM

1. **Install Prerequisites:**
   ```powershell
   # Install Node.js 18+ from https://nodejs.org
   # Install SQL Server or configure connection to existing server
   ```

2. **Deploy Files:**
   ```powershell
   # Copy entire project to server
   # Or just copy:
   - api/dist/
   - api/node_modules/
   - api/package.json
   - api/prisma/
   - api/.env
   - web/dist/
   ```

3. **Run Migrations:**
   ```powershell
   cd api
   npm run prisma:migrate deploy
   ```

4. **Start Services:**
   ```powershell
   # Option A: Use start-prod.ps1
   .\start-prod.ps1

   # Option B: Use PM2 or Windows Service
   npm install -g pm2
   cd api
   pm2 start dist/index.js --name admin-pods-api
   cd ../web
   pm2 start --name admin-pods-web "npm run preview"
   ```

5. **Configure Reverse Proxy (IIS or nginx):**
   - Route `/api/*` → `http://localhost:3000`
   - Route `/*` → `http://localhost:4173`

### Option 2: Docker (Coming Soon)

Docker support is planned. This will include:
- `Dockerfile` for API
- `Dockerfile` for Web
- `docker-compose.yml` for full stack
- Multi-stage builds for optimization

### Option 3: Azure App Service (Coming Soon)

Azure deployment is planned with:
- App Service for Web (Static Web App)
- App Service for API
- Azure SQL Database
- Application Insights for monitoring

## Web Server Configuration

### For Static Web Hosting

If deploying web frontend to a static host (nginx, IIS, Apache):

1. **Copy `web/dist/` contents** to web root

2. **Configure API proxy** or update `web/src/api.ts`:
   ```typescript
   const API = axios.create({
     baseURL: 'https://your-api-domain.com', // Production API URL
   });
   ```

3. **Rebuild web** after changing API URL:
   ```bash
   cd web
   npm run build
   ```

### Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Web frontend (React SPA)
    location / {
        root /var/www/admin-pods/web/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### IIS Configuration Example

For IIS, use URL Rewrite module:

**web.config** (in web/dist/):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- Proxy API requests -->
        <rule name="API Proxy" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://localhost:3000/api/{R:1}" />
        </rule>
        <!-- SPA fallback -->
        <rule name="SPA" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

## Process Management

### PM2 (Recommended for Linux/Mac)

```bash
# Install PM2 globally
npm install -g pm2

# Start services
cd api
pm2 start dist/index.js --name admin-pods-api

# Auto-restart on reboot
pm2 startup
pm2 save

# Monitor
pm2 monit
pm2 logs
```

### Windows Service (NSSM)

```powershell
# Install NSSM
choco install nssm

# Create service
nssm install AdminPodsAPI "C:\Program Files\nodejs\node.exe"
nssm set AdminPodsAPI AppDirectory "C:\path\to\admin-pods\api"
nssm set AdminPodsAPI AppParameters "dist\index.js"
nssm start AdminPodsAPI
```

## Health Checks

Test deployment:

```bash
# API health
curl http://localhost:3000/api/health

# Test endpoints
curl http://localhost:3000/api/floors
curl http://localhost:3000/api/entities

# Web
curl http://localhost:4173
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Configure CORS to specific domains (not `*`)
- [ ] Use HTTPS in production
- [ ] Enable SQL Server encryption
- [ ] Set `NODE_ENV=production`
- [ ] Configure firewall rules
- [ ] Regular database backups
- [ ] Monitor logs for errors
- [ ] Use environment variables for secrets (never commit .env)

## Monitoring

### Application Logs

```bash
# PM2
pm2 logs admin-pods-api
pm2 logs admin-pods-web

# Windows Event Viewer
Get-EventLog -LogName Application -Source "AdminPods*"
```

### Database Monitoring

```sql
-- Active connections
SELECT * FROM sys.dm_exec_connections;

-- Query performance
SELECT TOP 10 * 
FROM sys.dm_exec_query_stats 
ORDER BY total_worker_time DESC;
```

## Backup Strategy

### Database Backup

```bash
# Using the backup script
cd api
npm run backup
# Creates backups/backup_TIMESTAMP.json
```

### Automated Backups

**Windows Task Scheduler:**
```powershell
$action = New-ScheduledTaskAction -Execute "npm" -Argument "run backup" -WorkingDirectory "C:\path\to\admin-pods\api"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName "AdminPodsBackup" -Action $action -Trigger $trigger
```

**Linux Cron:**
```bash
# Edit crontab
crontab -e

# Add backup at 2am daily
0 2 * * * cd /path/to/admin-pods/api && npm run backup
```

## Troubleshooting

### API won't start
- Check `api/.env` exists and is configured
- Verify SQL Server is accessible
- Check port 3000 is not in use: `netstat -an | findstr :3000`
- Review logs in terminal

### Web can't connect to API
- Verify API is running: `curl http://localhost:3000/api/health`
- Check CORS configuration in `api/src/index.ts`
- Verify proxy configuration in `web/vite.config.ts` or web server

### Database connection errors
- Test connection string
- Check SQL Server authentication mode (SQL + Windows)
- Verify network connectivity and firewall rules
- Ensure Prisma client is generated: `npm run prisma:generate`

## Rollback Procedure

1. **Stop services:**
   ```bash
   pm2 stop admin-pods-api admin-pods-web
   ```

2. **Restore database backup:**
   ```bash
   cd api/scripts
   ts-node restore.ts ../backups/backup_TIMESTAMP.json
   ```

3. **Revert code:**
   ```bash
   git checkout <previous-tag>
   npm install
   npm run build
   ```

4. **Restart services:**
   ```bash
   pm2 restart admin-pods-api admin-pods-web
   ```

## Next Steps

After successful deployment:

1. **Monitor** application logs and performance
2. **Set up alerts** for errors and downtime
3. **Configure automated backups**
4. **Document** any custom configuration
5. **Plan** for scaling if needed

## Support

For issues or questions:
- Check logs first
- Review this deployment guide
- Check GitHub issues (if applicable)
- Contact system administrator
