import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

// Listar estadías (últimas primero)
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await query(`SELECT ID_RESERVA, COD_HOTEL,
                                     TO_CHAR(FECHA_LLEGADA,'YYYY-MM-DD') AS FECHA_LLEGADA,
                                     TO_CHAR(FECHA_PARTIDA,'YYYY-MM-DD') AS FECHA_PARTIDA,
                                     REGIMEN
                              FROM ESTADIA_AV WHERE ID_BD=1
                              ORDER BY ID_RESERVA DESC, FECHA_LLEGADA DESC`);
    res.render('estadias/list', { items: rows });
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Form crear
router.get('/new', requireAuth, (req, res) => {
  res.render('estadias/new');
});

// Crear estadía
router.post('/', requireAuth, async (req, res) => {
  const { idReserva, codHotel, llegada, partida, regimen } = req.body;
  try {
    // Validación simple
    if (!idReserva || !codHotel || !llegada || !partida || !regimen) {
      return res.status(400).send('Faltan campos');
    }
    await query(`INSERT INTO ESTADIA_AV (ID_BD, ID_RESERVA, COD_HOTEL, FECHA_LLEGADA, FECHA_PARTIDA, REGIMEN)
                 VALUES (1, :1, :2, TO_DATE(:3,'YYYY-MM-DD'), TO_DATE(:4,'YYYY-MM-DD'), :5)`,
      [Number(idReserva), codHotel, llegada, partida, regimen]);
    res.redirect('/estadias');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Form editar (identificado por PK compuesta)
router.get('/:idReserva/:codHotel/:llegada/edit', requireAuth, async (req, res) => {
  const { idReserva, codHotel, llegada } = req.params;
  try {
    const rows = await query(`SELECT ID_RESERVA, COD_HOTEL,
                                     TO_CHAR(FECHA_LLEGADA,'YYYY-MM-DD') AS FECHA_LLEGADA,
                                     TO_CHAR(FECHA_PARTIDA,'YYYY-MM-DD') AS FECHA_PARTIDA,
                                     REGIMEN
                              FROM ESTADIA_AV
                              WHERE ID_BD=1 AND ID_RESERVA=:1 AND COD_HOTEL=:2 AND FECHA_LLEGADA=TO_DATE(:3,'YYYY-MM-DD')`,
      [Number(idReserva), codHotel, llegada]);
    if (!rows.length) return res.status(404).send('No encontrada');
    res.render('estadias/edit', { item: rows[0] });
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Actualizar (permitimos cambiar FECHA_PARTIDA y REGIMEN)
router.post('/:idReserva/:codHotel/:llegada', requireAuth, async (req, res) => {
  const { idReserva, codHotel, llegada } = req.params;
  const { partida, regimen } = req.body;
  try {
    await query(`UPDATE ESTADIA_AV
                 SET FECHA_PARTIDA=TO_DATE(:1,'YYYY-MM-DD'), REGIMEN=:2
                 WHERE ID_BD=1 AND ID_RESERVA=:3 AND COD_HOTEL=:4 AND FECHA_LLEGADA=TO_DATE(:5,'YYYY-MM-DD')`,
      [partida, regimen, Number(idReserva), codHotel, llegada]);
    res.redirect('/estadias');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Eliminar
router.post('/:idReserva/:codHotel/:llegada/delete', requireAuth, async (req, res) => {
  const { idReserva, codHotel, llegada } = req.params;
  try {
    await query(`DELETE FROM ESTADIA_AV WHERE ID_BD=1 AND ID_RESERVA=:1 AND COD_HOTEL=:2 AND FECHA_LLEGADA=TO_DATE(:3,'YYYY-MM-DD')`,
      [Number(idReserva), codHotel, llegada]);
    res.redirect('/estadias');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

export default router;
