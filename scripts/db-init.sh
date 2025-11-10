#!/usr/bin/env bash
set -euo pipefail

# Requirements: ORACLE_PASSWORD env var, sqlplus available in PATH (provided by image)
ORAPASS="${ORACLE_PASSWORD:?ORACLE_PASSWORD not set}"
CONNECT="system/${ORAPASS}@oracle-db:1521/XEPDB1"

log(){ printf "[db-init] %s\n" "$*"; }

die(){ echo "[db-init][ERROR] $*" >&2; exit 1; }

# 1) Wait for listener+PDB to accept SQL connections
log "Waiting for XEPDB1 to accept SQL connections..."
for i in $(seq 1 120); do
  echo "select 1 from dual; exit" | sqlplus -L -s "$CONNECT" >/dev/null 2>&1 && { log "XEPDB1 reachable (attempt $i)"; break; }
  log "Waiting ($i/120)..."; sleep 2
  if [ "$i" -eq 120 ]; then die "Timeout waiting for XEPDB1"; fi
done

# 2) Ensure APP_USER can log in
log "Granting CREATE SESSION and unlocking APP_USER..."
sqlplus -L -s "$CONNECT" <<SQL
ALTER USER APP_USER ACCOUNT UNLOCK;
GRANT CREATE SESSION TO APP_USER;
EXIT
SQL

# 3) Check if schema exists
EXISTS=$(sqlplus -L -s "$CONNECT" <<'SQL'
SET PAGES 0 FEEDBACK OFF HEADING OFF
SELECT COUNT(*) FROM dba_tables WHERE owner='APP_USER' AND table_name='USUARIOS_APP';
EXIT
SQL
)
EXISTS=$(echo "$EXISTS" | tr -dc 0-9)
if [ "${EXISTS:-0}" -eq 0 ]; then
  log "Schema not found, running init scripts..."
  sqlplus -L -s "$CONNECT" @/container-entrypoint-initdb.d/01_schema.sql || die "01_schema.sql failed"
  sqlplus -L -s "$CONNECT" @/container-entrypoint-initdb.d/03_auth.sql || die "03_auth.sql failed"
else
  log "Schema already present, skipping DDL"
fi

# 4) List tables
log "Listing APP_USER tables:"
sqlplus -L -s "$CONNECT" <<'SQL'
SET PAGES 0 FEEDBACK OFF
SELECT table_name FROM dba_tables WHERE owner='APP_USER' ORDER BY table_name;
EXIT
SQL

log "db-init completed successfully."
