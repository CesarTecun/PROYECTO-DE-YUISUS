param(
  [string]$OraclePassword = $env:ORACLE_PASSWORD
)

if (-not $OraclePassword) {
  Write-Host "Oracle password not provided. Use -OraclePassword or set ORACLE_PASSWORD in your env." -ForegroundColor Yellow
  exit 1
}

function Wait-ContainerHealthy {
  param([string]$Name)
  Write-Host "Waiting for container '$Name' to become healthy..."
  for ($i=0; $i -lt 60; $i++) {
    try {
      $status = docker inspect --format '{{.State.Health.Status}}' $Name 2>$null
      if ($status -eq 'healthy') { Write-Host "Container is healthy." -ForegroundColor Green; return }
    } catch {}
    Start-Sleep -Seconds 2
  }
  Write-Error "Container '$Name' did not become healthy in time."; exit 1
}

function Invoke-Sql {
  param([string]$Sql)
  $here = @"
sqlplus -L -s system/$OraclePassword@localhost:1521/XEPDB1 <<'SQL'
SET PAGES 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF
$Sql
EXIT
SQL
"@
  docker exec oracle-db bash -lc $here | Out-String
}

# 1) Esperar a que la BD esté healthy
Wait-ContainerHealthy -Name 'oracle-db'

# 2) Asegurar privilegios para APP_USER
Write-Host "Granting CREATE SESSION and unlocking APP_USER..." -ForegroundColor Cyan
$grantOut = Invoke-Sql @"
ALTER USER APP_USER ACCOUNT UNLOCK;
GRANT CREATE SESSION TO APP_USER;
"@
Write-Host $grantOut

# 3) Verificar si el esquema ya existe (chequeo por una tabla clave)
Write-Host "Checking if schema objects exist..." -ForegroundColor Cyan
$existsOut = Invoke-Sql "SELECT COUNT(*) FROM dba_tables WHERE owner = 'APP_USER' AND table_name = 'USUARIOS_APP';"
$exists = ($existsOut | Select-String -Pattern '^[0-9]+$' | ForEach-Object { [int]$_.Matches[0].Value } | Select-Object -First 1)
if (-not $exists) { $exists = 0 }

if ($exists -eq 0) {
  Write-Host "Schema objects not found, running initialization scripts..." -ForegroundColor Yellow
  docker exec oracle-db bash -lc "sqlplus -L -s system/$OraclePassword@localhost:1521/XEPDB1 @/container-entrypoint-initdb.d/01_schema.sql" | Write-Host
  docker exec oracle-db bash -lc "sqlplus -L -s system/$OraclePassword@localhost:1521/XEPDB1 @/container-entrypoint-initdb.d/03_auth.sql" | Write-Host
} else {
  Write-Host "Schema already present. Skipping DDL scripts." -ForegroundColor Green
}

# 4) Listar tablas finales
Write-Host "Listing APP_USER tables..." -ForegroundColor Cyan
$tables = Invoke-Sql @"
SET PAGES 0 FEEDBACK OFF
SELECT table_name FROM dba_tables WHERE owner = 'APP_USER' ORDER BY table_name;
"@
Write-Host $tables

Write-Host "Initialization complete." -ForegroundColor Green
