# Production startup script for Admin Pods
# Starts both API and Web services in production mode

Write-Host "Starting Admin Pods in Production Mode" -ForegroundColor Cyan
Write-Host ""

# Check if builds exist
if (-not (Test-Path "api\dist\index.js")) {
    Write-Host "[ERROR] API build not found. Run 'cd api && npm run build' first." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "web\dist\index.html")) {
    Write-Host "[ERROR] Web build not found. Run 'cd web && npm run build' first." -ForegroundColor Red
    exit 1
}

# Check if .env exists
if (-not (Test-Path "api\.env")) {
    Write-Host "[ERROR] api\.env not found. Copy api\.env.example and configure it." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Build files verified" -ForegroundColor Green
Write-Host "[OK] Environment configuration verified" -ForegroundColor Green
Write-Host ""

# Start API in background
Write-Host "Starting API server..." -ForegroundColor Yellow
$apiJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\api
    npm start
}

# Wait a moment for API to start
Start-Sleep -Seconds 3

# Check if API started successfully
if ($apiJob.State -eq "Running") {
    Write-Host "[OK] API server started (Job ID: $($apiJob.Id))" -ForegroundColor Green
} else {
    Write-Host "[ERROR] API server failed to start" -ForegroundColor Red
    Receive-Job -Job $apiJob
    exit 1
}

# Start Web preview server in background
Write-Host "Starting Web server..." -ForegroundColor Yellow
$webJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\web
    npm run preview
}

# Wait a moment for Web to start
Start-Sleep -Seconds 3

# Check if Web started successfully
if ($webJob.State -eq "Running") {
    Write-Host "[OK] Web server started (Job ID: $($webJob.Id))" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Web server failed to start" -ForegroundColor Red
    Receive-Job -Job $webJob
    Stop-Job -Job $apiJob
    Remove-Job -Job $apiJob
    exit 1
}

Write-Host ""
Write-Host "[SUCCESS] Admin Pods is running in production mode!" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "   API:  http://localhost:3000" -ForegroundColor White
Write-Host "   Web:  http://localhost:4173" -ForegroundColor White
Write-Host ""
Write-Host "View logs:" -ForegroundColor Cyan
Write-Host "   API: Receive-Job -Job $($apiJob.Id) -Keep" -ForegroundColor Gray
Write-Host "   Web: Receive-Job -Job $($webJob.Id) -Keep" -ForegroundColor Gray
Write-Host ""
Write-Host "Stop servers:" -ForegroundColor Cyan
Write-Host "   Stop-Job -Job $($apiJob.Id), $($webJob.Id)" -ForegroundColor Gray
Write-Host "   Remove-Job -Job $($apiJob.Id), $($webJob.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop monitoring. Servers will continue running in background." -ForegroundColor Yellow
Write-Host ""

# Monitor logs in foreground
try {
    while ($true) {
        $apiOutput = Receive-Job -Job $apiJob
        $webOutput = Receive-Job -Job $webJob
        
        if ($apiOutput) {
            Write-Host "[API] $apiOutput" -ForegroundColor Cyan
        }
        if ($webOutput) {
            Write-Host "[WEB] $webOutput" -ForegroundColor Magenta
        }
        
        # Check if jobs are still running
        if ($apiJob.State -ne "Running") {
            Write-Host "[ERROR] API server stopped unexpectedly" -ForegroundColor Red
            break
        }
        if ($webJob.State -ne "Running") {
            Write-Host "[ERROR] Web server stopped unexpectedly" -ForegroundColor Red
            break
        }
        
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host ""
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    Stop-Job -Job $apiJob, $webJob -ErrorAction SilentlyContinue
    Remove-Job -Job $apiJob, $webJob -ErrorAction SilentlyContinue
    Write-Host "[OK] Servers stopped" -ForegroundColor Green
}
