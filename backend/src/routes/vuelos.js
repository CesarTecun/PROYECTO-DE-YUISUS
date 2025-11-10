import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await query('SELECT NUM_VUELO, FECHA_HORA, ORIGEN, DESTINO, PLAZAS_TOTALES, PLAZAS_TURISTA FROM VUELO_AV WHERE ID_BD=1 ORDER BY NUM_VUELO');
    res.render('vuelos/list', { 
      items: rows,
      error: null,
      formData: {}
    });
  } catch (e) {
    res.status(500).render('error', { error: 'Error al cargar la lista de vuelos: ' + e.message });
  }
});

router.get('/new', requireAuth, (req, res) => {
  res.render('vuelos/new', { 
    formData: {},
    error: null 
  });
});

router.post('/', requireAuth, async (req, res) => {
  const { num, fechaHora, origen, destino, plazasTotales, plazasTurista } = req.body;
  
  // Validar campos requeridos
  if (!num || !fechaHora || !origen || !destino || !plazasTotales || !plazasTurista) {
    return res.status(400).render('vuelos/new', { 
      error: 'Todos los campos son obligatorios',
      formData: req.body
    });
  }

  // Validar que las plazas turista no sean mayores que las plazas totales
  if (Number(plazasTurista) > Number(plazasTotales)) {
    return res.status(400).render('vuelos/new', { 
      error: 'Las plazas turista no pueden ser más que las plazas totales',
      formData: req.body
    });
  }

  // Validar formato de fecha
  const fechaRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!fechaRegex.test(fechaHora)) {
    return res.status(400).render('vuelos/new', { 
      error: 'Formato de fecha y hora inválido. Use YYYY-MM-DDTHH:MM',
      formData: req.body
    });
  }

  try {
    // Verificar si ya existe un vuelo con el mismo número
    const existe = await query('SELECT 1 FROM VUELO_AV WHERE ID_BD=1 AND NUM_VUELO = :1', [num]);
    if (existe.length > 0) {
      return res.status(400).render('vuelos/new', { 
        error: 'Ya existe un vuelo con este número',
        formData: req.body
      });
    }

    // Insertar el nuevo vuelo
    await query(
      `INSERT INTO VUELO_AV (ID_BD, NUM_VUELO, FECHA_HORA, ORIGEN, DESTINO, PLAZAS_TOTALES, PLAZAS_TURISTA)
       VALUES (1, :1, TO_TIMESTAMP(:2, 'YYYY-MM-DD"T"HH24:MI'), :3, :4, :5, :6)`,
      [num, fechaHora, origen, destino, Number(plazasTotales), Number(plazasTurista)]
    );
    
    res.redirect('/vuelos');
  } catch (e) {
    res.status(500).render('vuelos/new', { 
      error: 'Error al crear el vuelo: ' + e.message,
      formData: req.body
    });
  }
});

router.get('/:num/edit', requireAuth, async (req, res) => {
  const { num } = req.params;
  try {
    const rows = await query(`SELECT NUM_VUELO,
                                     TO_CHAR(FECHA_HORA, 'YYYY-MM-DD"T"HH24:MI') AS FECHA_HORA_STR,
                                     ORIGEN, DESTINO, PLAZAS_TOTALES, PLAZAS_TURISTA
                              FROM VUELO_AV
                              WHERE ID_BD=1 AND NUM_VUELO = :1`, [num]);
    if (!rows.length) return res.status(404).send('No encontrado');
    res.render('vuelos/edit', { item: rows[0] });
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

router.post('/:num', requireAuth, async (req, res) => {
  const { num } = req.params;
  const { fechaHora, origen, destino, plazasTotales, plazasTurista } = req.body;
  try {
    await query(`UPDATE VUELO_AV
                 SET FECHA_HORA = TO_TIMESTAMP(:1, 'YYYY-MM-DD"T"HH24:MI'),
                     ORIGEN=:2, DESTINO=:3, PLAZAS_TOTALES=:4, PLAZAS_TURISTA=:5
                 WHERE ID_BD=1 AND NUM_VUELO=:6`,
                [fechaHora, origen, destino, Number(plazasTotales), Number(plazasTurista), num]);
    res.redirect('/vuelos');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

router.post('/:num/delete', requireAuth, async (req, res) => {
  const { num } = req.params;
  try {
    await query('DELETE FROM VUELO_AV WHERE ID_BD=1 AND NUM_VUELO=:1', [num]);
    res.redirect('/vuelos');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

export default router;
