import bcrypt from 'bcryptjs';
import { query } from './db.js';

export async function ensureAdmin() {
  const u = process.env.ADMIN_USER || 'admin';
  const p = process.env.ADMIN_PASSWORD || 'admin123';
  const rows = await query('SELECT USERNAME FROM USUARIOS_APP WHERE USERNAME = :1', [u]);
  if (rows.length === 0) {
    const hash = await bcrypt.hash(p, 10);
    await query('INSERT INTO USUARIOS_APP (USERNAME, PASSWORD_HASH, NOMBRE_COMPLETO, ROL, ACTIVO) VALUES (:1, :2, :3, :4, :5)', [u, hash, 'Administrador', 'ADMIN', 'S']);
  }
}

export async function authenticate(username, password) {
  const rows = await query("SELECT ID_USUARIO, USERNAME, PASSWORD_HASH, ROL FROM USUARIOS_APP WHERE USERNAME=:1 AND ACTIVO = 'S'", [username]);
  if (rows.length === 0) return null;
  const u = rows[0];
  const ok = await bcrypt.compare(password, u.PASSWORD_HASH);
  if (!ok) return null;
  return { id: u.ID_USUARIO, username: u.USERNAME, rol: u.ROL };
}

export function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
