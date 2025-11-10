import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

// Listar
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await query('SELECT COD_SUCURSAL, DIRECCION, TELEFONO FROM SUCURSAL_AV WHERE ID_BD=1 ORDER BY COD_SUCURSAL');
    res.render('sucursales/list', { items: rows });
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Form crear
router.get('/new', requireAuth, (req, res) => {
  res.render('sucursales/new');
});

// Crear
router.post('/', requireAuth, async (req, res) => {
  const { cod, direccion, telefono } = req.body;
  try {
    await query('INSERT INTO SUCURSAL_AV (ID_BD, COD_SUCURSAL, DIRECCION, TELEFONO) VALUES (1, :1, :2, :3)', [cod, direccion, telefono]);
    res.redirect('/sucursales');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Form editar
router.get('/:cod/edit', requireAuth, async (req, res) => {
  const { cod } = req.params;
  try {
    const rows = await query('SELECT COD_SUCURSAL, DIRECCION, TELEFONO FROM SUCURSAL_AV WHERE ID_BD=1 AND COD_SUCURSAL = :1', [cod]);
    if (!rows.length) return res.status(404).send('No encontrada');
    res.render('sucursales/edit', { item: rows[0] });
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Actualizar
router.post('/:cod', requireAuth, async (req, res) => {
  const { cod } = req.params;
  const { direccion, telefono } = req.body;
  try {
    await query('UPDATE SUCURSAL_AV SET DIRECCION = :1, TELEFONO = :2 WHERE ID_BD=1 AND COD_SUCURSAL = :3', [direccion, telefono, cod]);
    res.redirect('/sucursales');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Eliminar
router.post('/:cod/delete', requireAuth, async (req, res) => {
  const { cod } = req.params;
  try {
    await query('DELETE FROM SUCURSAL_AV WHERE ID_BD=1 AND COD_SUCURSAL = :1', [cod]);
    res.redirect('/sucursales');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

export default router;
