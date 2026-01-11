# Backup SQL Server database
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = ".\backups"
$backupFile = "$backupDir\admin-pods_$timestamp.bak"

# Create backups directory if it doesn't exist
if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir
}

# Get database name from .env file
$envFile = ".\api\.env"
if (Test-Path $envFile) {
    $dbUrl = Get-Content $envFile | Where-Object { $_ -match "DATABASE_URL" }
    if ($dbUrl -match "database=([^;]+)") {
        $dbName = $matches[1]
        
        Write-Host "Backing up database: $dbName" -ForegroundColor Green
        Write-Host "Backup file: $backupFile" -ForegroundColor Cyan
        
        # SQL Server backup command
        $sql = "BACKUP DATABASE [$dbName] TO DISK = '$backupFile' WITH FORMAT, MEDIANAME = 'AdminPodsBackup', NAME = 'Full Backup';"
        
        # Execute backup using sqlcmd (requires SQL Server command-line tools)
        sqlcmd -S "localhost" -Q $sql
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Backup completed successfully!" -ForegroundColor Green
            Write-Host "Backup size: $((Get-Item $backupFile).Length / 1MB) MB" -ForegroundColor Cyan
        } else {
            Write-Host "Backup failed!" -ForegroundColor Red
        }
    }
} else {
    Write-Host "Error: .env file not found at $envFile" -ForegroundColor Red
}
