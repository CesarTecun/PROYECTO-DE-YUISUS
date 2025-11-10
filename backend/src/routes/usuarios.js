import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.rol !== 'ADMIN') return res.status(403).send('Forbidden');
  next();
}

// Listar usuarios
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await query(`SELECT ID_USUARIO, USERNAME, NOMBRE_COMPLETO, ROL, ACTIVO FROM USUARIOS_APP ORDER BY ID_USUARIO DESC`);
    res.render('usuarios/list', { items: rows });
  } catch (e) { res.status(500).send('Error: ' + e.message); }
});

// Form crear
router.get('/new', requireAuth, requireAdmin, async (req, res) => {
  const roles = await query("SELECT DISTINCT ROL FROM USUARIOS_APP ORDER BY ROL");
  res.render('usuarios/new', { roles });
});

// Crear
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { username, nombre, rol, activo, password } = req.body;
  try {
    const exists = await query('SELECT 1 FROM USUARIOS_APP WHERE USERNAME=:1', [username]);
    if (exists.length) return res.status(400).send('Usuario ya existe');
    const hash = await bcrypt.hash(password || 'changeme', 10);
    await query("INSERT INTO USUARIOS_APP (USERNAME, PASSWORD_HASH, NOMBRE_COMPLETO, ROL, ACTIVO) VALUES (:1,:2,:3,:4,:5)", [username, hash, nombre || username, rol || 'USUARIO', (activo || 'S')]);
    res.redirect('/usuarios');
  } catch (e) { res.status(500).send('Error: ' + e.message); }
});

// Form editar
router.get('/:id/edit', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await query('SELECT ID_USUARIO, USERNAME, NOMBRE_COMPLETO, ROL, ACTIVO FROM USUARIOS_APP WHERE ID_USUARIO=:1', [Number(id)]);
    if (!rows.length) return res.status(404).send('No encontrado');
    const roles = await query("SELECT DISTINCT ROL FROM USUARIOS_APP ORDER BY ROL");
    res.render('usuarios/edit', { item: rows[0], roles });
  } catch (e) { res.status(500).send('Error: ' + e.message); }
});

// Actualizar datos (nombre, rol, activo)
router.post('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre, rol, activo } = req.body;
  try {
    await query('UPDATE USUARIOS_APP SET NOMBRE_COMPLETO=:1, ROL=:2, ACTIVO=:3 WHERE ID_USUARIO=:4', [nombre, rol, activo, Number(id)]);
    res.redirect('/usuarios');
  } catch (e) { res.status(500).send('Error: ' + e.message); }
});

// Resetear contraseña
router.post('/:id/reset', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  try {
    const hash = await bcrypt.hash(password || 'changeme', 10);
    await query('UPDATE USUARIOS_APP SET PASSWORD_HASH=:1 WHERE ID_USUARIO=:2', [hash, Number(id)]);
    res.redirect('/usuarios');
  } catch (e) { res.status(500).send('Error: ' + e.message); }
});

// Eliminar
router.post('/:id/delete', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM USUARIOS_APP WHERE ID_USUARIO=:1', [Number(id)]);
    res.redirect('/usuarios');
  } catch (e) { res.status(500).send('Error: ' + e.message); }
});

export default router;
