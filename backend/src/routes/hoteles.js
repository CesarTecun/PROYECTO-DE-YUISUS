import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await query('SELECT COD_HOTEL, NOMBRE, DIRECCION, CIUDAD, TELEFONO, PLAZAS_TOTALES FROM HOTEL_AV WHERE ID_BD=1 ORDER BY COD_HOTEL');
    res.render('hoteles/list', { items: rows });
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

router.get('/new', requireAuth, (req, res) => {
  res.render('hoteles/new');
});

router.post('/', requireAuth, async (req, res) => {
  const { cod, nombre, direccion, ciudad, telefono, plazas } = req.body;
  try {
    await query('INSERT INTO HOTEL_AV (ID_BD, COD_HOTEL, NOMBRE, DIRECCION, CIUDAD, TELEFONO, PLAZAS_TOTALES) VALUES (1, :1, :2, :3, :4, :5, :6)', [cod, nombre, direccion, ciudad, telefono, Number(plazas)]);
    res.redirect('/hoteles');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

router.get('/:cod/edit', requireAuth, async (req, res) => {
  const { cod } = req.params;
  try {
    const rows = await query('SELECT COD_HOTEL, NOMBRE, DIRECCION, CIUDAD, TELEFONO, PLAZAS_TOTALES FROM HOTEL_AV WHERE ID_BD=1 AND COD_HOTEL = :1', [cod]);
    if (!rows.length) return res.status(404).send('No encontrado');
    res.render('hoteles/edit', { item: rows[0] });
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

router.post('/:cod', requireAuth, async (req, res) => {
  const { cod } = req.params;
  const { nombre, direccion, ciudad, telefono, plazas } = req.body;
  try {
    await query('UPDATE HOTEL_AV SET NOMBRE=:1, DIRECCION=:2, CIUDAD=:3, TELEFONO=:4, PLAZAS_TOTALES=:5 WHERE ID_BD=1 AND COD_HOTEL=:6', [nombre, direccion, ciudad, telefono, Number(plazas), cod]);
    res.redirect('/hoteles');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

router.post('/:cod/delete', requireAuth, async (req, res) => {
  const { cod } = req.params;
  try {
    await query('DELETE FROM HOTEL_AV WHERE ID_BD=1 AND COD_HOTEL=:1', [cod]);
    res.redirect('/hoteles');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

export default router;
