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
    res.render('usuarios/list', { 
      items: rows,
      error: null,
      formData: {}
    });
  } catch (e) { 
    res.status(500).render('error', { error: 'Error al cargar la lista de usuarios: ' + e.message });
  }
});

// Form crear
router.get('/new', requireAuth, requireAdmin, async (req, res) => {
  try {
    const roles = await query("SELECT DISTINCT ROL FROM USUARIOS_APP ORDER BY ROL");
    res.render('usuarios/new', { 
      roles,
      usuario: null,  // Asegurando que la variable usuario esté definida
      formData: {},
      error: null,
      user: req.session.user  // Asegurando que el usuario de sesión esté disponible
    });
  } catch (e) {
    res.status(500).render('error', { 
      error: 'Error al cargar el formulario: ' + e.message,
      user: req.session.user
    });
  }
});

// Crear
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { username, nombre, rol, activo, password } = req.body;
  try {
    // Validar campos requeridos
    if (!username || !rol) {
      const roles = await query("SELECT DISTINCT ROL FROM USUARIOS_APP ORDER BY ROL");
      return res.status(400).render('usuarios/new', {
        error: 'Usuario y rol son campos obligatorios',
        formData: req.body,
        roles,
        usuario: null,
        user: req.session.user
      });
    }
    
    // Verificar si el usuario ya existe
    const exists = await query('SELECT 1 FROM USUARIOS_APP WHERE USERNAME=:1', [username]);
    if (exists.length) {
      const roles = await query("SELECT DISTINCT ROL FROM USUARIOS_APP ORDER BY ROL");
      return res.status(400).render('usuarios/new', { 
        error: 'El nombre de usuario ya está en uso',
        formData: req.body,
        roles,
        usuario: null,
        user: req.session.user
      });
    }
    
    const hash = await bcrypt.hash(password || 'changeme', 10);
    await query(
      "INSERT INTO USUARIOS_APP (USERNAME, PASSWORD_HASH, NOMBRE_COMPLETO, ROL, ACTIVO) VALUES (:1, :2, :3, :4, :5)", 
      [username, hash, nombre || username, rol || 'USUARIO', (activo || 'S')]
    );
    
    res.redirect('/usuarios');
  } catch (e) { 
    console.error('Error al crear usuario:', e);
    const roles = await query("SELECT DISTINCT ROL FROM USUARIOS_APP ORDER BY ROL");
    res.status(500).render('usuarios/new', { 
      error: 'Error al crear el usuario: ' + e.message,
      formData: req.body,
      roles,
      usuario: null,
      user: req.session.user
    });
  }
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
