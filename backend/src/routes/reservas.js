import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

// Listar reservas
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await query(`SELECT ID_RESERVA, FECHA_RESERVA, COD_TURISTA, COD_SUCURSAL
                               FROM RESERVA_AV WHERE ID_BD=1 ORDER BY ID_RESERVA DESC`);
    res.render('reservas/list', { 
      items: rows,
      error: null,
      formData: {}
    });
  } catch (e) {
    res.status(500).render('error', { error: 'Error al cargar la lista de reservas: ' + e.message });
  }
});

// Obtener lista de turistas para el select
async function getTuristas() {
  const result = await query('SELECT COD_TURISTA, NOMBRE1, APELLIDO1 FROM TURISTA_AV WHERE ID_BD=1 ORDER BY NOMBRE1, APELLIDO1');
  return result.map(t => ({
    cod: t.COD_TURISTA,
    nombre: `${t.NOMBRE1} ${t.APELLIDO1}`.trim()
  }));
}

// Obtener lista de sucursales para el select
async function getSucursales() {
  return await query('SELECT COD_SUCURSAL, DIRECCION FROM SUCURSAL_AV WHERE ID_BD=1 ORDER BY COD_SUCURSAL');
}

// Form crear
router.get('/new', requireAuth, async (req, res) => {
  try {
    const [turistas, sucursales] = await Promise.all([
      getTuristas(),
      getSucursales()
    ]);
    res.render('reservas/new', { 
      turistas, 
      sucursales,
      formData: {},
      error: null
    });
  } catch (e) {
    res.status(500).render('error', { error: 'Error al cargar el formulario: ' + e.message });
  }
});

// Crear
router.post('/', requireAuth, async (req, res) => {
  const { codTurista, codSucursal } = req.body;
  
  // Validar campos requeridos
  if (!codTurista || !codSucursal) {
    try {
      const [turistas, sucursales] = await Promise.all([
        getTuristas(),
        getSucursales()
      ]);
      return res.status(400).render('reservas/new', { 
        error: 'Todos los campos son obligatorios',
        formData: req.body,
        turistas,
        sucursales
      });
    } catch (e) {
      return res.status(500).render('error', { error: 'Error al validar: ' + e.message });
    }
  }

  try {
    // Verificar si el turista existe
    const turistaExiste = await query('SELECT 1 FROM TURISTA_AV WHERE ID_BD=1 AND COD_TURISTA = :1', [codTurista]);
    if (turistaExiste.length === 0) {
      const [turistas, sucursales] = await Promise.all([
        getTuristas(),
        getSucursales()
      ]);
      return res.status(400).render('reservas/new', { 
        error: 'El turista seleccionado no existe',
        formData: req.body,
        turistas,
        sucursales
      });
    }

    // Verificar si la sucursal existe
    const sucursalExiste = await query('SELECT 1 FROM SUCURSAL_AV WHERE ID_BD=1 AND COD_SUCURSAL = :1', [codSucursal]);
    if (sucursalExiste.length === 0) {
      const [turistas, sucursales] = await Promise.all([
        getTuristas(),
        getSucursales()
      ]);
      return res.status(400).render('reservas/new', { 
        error: 'La sucursal seleccionada no existe',
        formData: req.body,
        turistas,
        sucursales
      });
    }

    // Crear la reserva
    await query(
      `INSERT INTO RESERVA_AV (ID_BD, COD_TURISTA, COD_SUCURSAL, FECHA_RESERVA)
       VALUES (1, :1, :2, SYSDATE)`, 
      [codTurista, codSucursal]
    );
    
    res.redirect('/reservas');
  } catch (e) {
    console.error('Error al crear reserva:', e);
    try {
      const [turistas, sucursales] = await Promise.all([
        getTuristas(),
        getSucursales()
      ]);
      res.status(500).render('reservas/new', { 
        error: 'Error al crear la reserva: ' + e.message,
        formData: req.body,
        turistas,
        sucursales
      });
    } catch (err) {
      res.status(500).render('error', { error: 'Error crítico: ' + err.message });
    }
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
