import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

// Listar reservas
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await query(`SELECT ID_RESERVA, FECHA_RESERVA, COD_TURISTA, COD_SUCURSAL
                               FROM RESERVA_AV WHERE ID_BD=1 ORDER BY ID_RESERVA DESC`);
    res.render('reservas/list', { items: rows });
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Form crear
router.get('/new', requireAuth, (req, res) => {
  res.render('reservas/new');
});

// Crear
router.post('/', requireAuth, async (req, res) => {
  const { codTurista, codSucursal } = req.body;
  try {
    await query(`INSERT INTO RESERVA_AV (ID_BD, COD_TURISTA, COD_SUCURSAL)
                 VALUES (1, :1, :2)`, [codTurista, codSucursal]);
    res.redirect('/reservas');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Form editar + segmentos
router.get('/:id/edit', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const r = await query(`SELECT ID_RESERVA, FECHA_RESERVA, COD_TURISTA, COD_SUCURSAL
                            FROM RESERVA_AV WHERE ID_BD=1 AND ID_RESERVA=:1`, [Number(id)]);
    if (!r.length) return res.status(404).send('No encontrada');
    const segs = await query(`SELECT NUM_VUELO, SECUENCIA, CLASE
                               FROM RESERVA_VUELO_AV
                               WHERE ID_BD=1 AND ID_RESERVA=:1
                               ORDER BY SECUENCIA`, [Number(id)]);
    res.render('reservas/edit', { item: r[0], segmentos: segs });
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Actualizar reserva (turista/sucursal)
router.post('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { codTurista, codSucursal } = req.body;
  try {
    await query(`UPDATE RESERVA_AV SET COD_TURISTA=:1, COD_SUCURSAL=:2 WHERE ID_BD=1 AND ID_RESERVA=:3`,
      [codTurista, codSucursal, Number(id)]);
    res.redirect('/reservas');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Eliminar reserva (segmentos ON DELETE CASCADE)
router.post('/:id/delete', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await query(`DELETE FROM RESERVA_AV WHERE ID_BD=1 AND ID_RESERVA=:1`, [Number(id)]);
    res.redirect('/reservas');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Agregar segmento
router.post('/:id/segmentos', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { numVuelo, clase } = req.body;
  try {
    const rows = await query(`SELECT NVL(MAX(SECUENCIA),0)+1 AS NEXTSEQ
                               FROM RESERVA_VUELO_AV WHERE ID_BD=1 AND ID_RESERVA=:1`, [Number(id)]);
    const nextSeq = rows.length ? rows[0].NEXTSEQ : 1;
    await query(`INSERT INTO RESERVA_VUELO_AV (ID_BD, ID_RESERVA, NUM_VUELO, SECUENCIA, CLASE)
                 VALUES (1, :1, :2, :3, :4)`, [Number(id), numVuelo, Number(nextSeq), clase]);
    res.redirect(`/reservas/${id}/edit`);
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Eliminar segmento
router.post('/:id/segmentos/:num/:seq/delete', requireAuth, async (req, res) => {
  const { id, num, seq } = req.params;
  try {
    await query(`DELETE FROM RESERVA_VUELO_AV WHERE ID_BD=1 AND ID_RESERVA=:1 AND NUM_VUELO=:2 AND SECUENCIA=:3`,
      [Number(id), num, Number(seq)]);
    res.redirect(`/reservas/${id}/edit`);
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

export default router;
