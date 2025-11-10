import oracledb from 'oracledb';

let pool;

export async function getPool() {
  if (!pool) {
    const ez = process.env.DB_CONNECT_STRING;
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT || '1521';
    const service = process.env.DB_SERVICE_NAME;
    const connectString = (host && service)
      ? `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${host})(PORT=${port}))(CONNECT_DATA=(SERVICE_NAME=${service})))`
      : ez;
    const cfg = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString,
      poolMin: Number(process.env.DB_POOL_MIN || 1),
      poolMax: Number(process.env.DB_POOL_MAX || 5)
    };
    const maxAttempts = 20;
    const delayMs = 3000;
    for (let i = 1; i <= maxAttempts; i++) {
      try {
        pool = await oracledb.createPool(cfg);
        break;
      } catch (e) {
        const msg = String(e && e.message || e);
        const transient = msg.includes('NJS-518') || msg.includes('ORA-12514') || msg.includes('service') || msg.includes('listener');
        if (i === maxAttempts || !transient) throw e;
        console.log(`DB not ready yet (attempt ${i}/${maxAttempts}): ${msg}. Retrying in ${delayMs/1000}s...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  return pool;
}

export async function query(sql, params = []) {
  const p = await getPool();
  const conn = await p.getConnection();
  try {
    const res = await conn.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: true });
    return res.rows || [];
  } finally {
    await conn.close();
  }
}
