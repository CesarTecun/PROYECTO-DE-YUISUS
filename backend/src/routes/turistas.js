import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

// Listar turistas
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await query(`SELECT COD_TURISTA, NOMBRE1, NOMBRE2, NOMBRE3, APELLIDO1, APELLIDO2, PAIS_RESIDENCIA
                               FROM TURISTA_AV WHERE ID_BD=1 ORDER BY COD_TURISTA`);
    res.render('turistas/list', { 
      items: rows,
      error: null,
      formData: {}
    });
  } catch (e) {
    res.status(500).render('error', { error: 'Error al cargar la lista de turistas: ' + e.message });
  }
});

// Form crear turista
router.get('/new', requireAuth, (req, res) => {
  res.render('turistas/new', { 
    formData: {},
    error: null 
  });
});

// Crear turista
router.post('/', requireAuth, async (req, res) => {
  const { cod, nombre1, nombre2, nombre3, apellido1, apellido2, direccion, pais } = req.body;
  
  // Validar campos requeridos
  if (!cod || !nombre1 || !apellido1) {
    return res.status(400).render('turistas/new', { 
      error: 'Los campos Código, Primer Nombre y Primer Apellido son obligatorios',
      formData: req.body
    });
  }

  // Validar formato del código (ejemplo: al menos 3 caracteres)
  if (cod.length < 3) {
    return res.status(400).render('turistas/new', { 
      error: 'El código debe tener al menos 3 caracteres',
      formData: req.body
    });
  }

  try {
    // Verificar si ya existe un turista con el mismo código
    const existe = await query('SELECT 1 FROM TURISTA_AV WHERE ID_BD=1 AND COD_TURISTA = :1', [cod]);
    if (existe.length > 0) {
      return res.status(400).render('turistas/new', { 
        error: 'Ya existe un turista con este código',
        formData: req.body
      });
    }

    // Insertar el nuevo turista
    await query(
      `INSERT INTO TURISTA_AV 
       (ID_BD, COD_TURISTA, NOMBRE1, NOMBRE2, NOMBRE3, APELLIDO1, APELLIDO2, DIRECCION, PAIS_RESIDENCIA)
       VALUES (1, :1, :2, :3, :4, :5, :6, :7, :8)`,
      [
        cod, 
        nombre1, 
        nombre2 || null, 
        nombre3 || null, 
        apellido1, 
        apellido2 || null, 
        direccion || null, 
        pais || null
      ]
    );
    
    res.redirect('/turistas');
  } catch (e) {
    res.status(500).render('turistas/new', { 
      error: 'Error al crear el turista: ' + e.message,
      formData: req.body
    });
  }
});

// Form editar + ver emails/telefonos
router.get('/:cod/edit', requireAuth, async (req, res) => {
  const { cod } = req.params;
  try {
    const tRows = await query(`SELECT COD_TURISTA, NOMBRE1, NOMBRE2, NOMBRE3, APELLIDO1, APELLIDO2, DIRECCION, PAIS_RESIDENCIA
                               FROM TURISTA_AV WHERE ID_BD=1 AND COD_TURISTA=:1`, [cod]);
    if (!tRows.length) return res.status(404).send('No encontrado');
    const emails = await query('SELECT EMAIL FROM TURISTA_EMAIL_AV WHERE ID_BD=1 AND COD_TURISTA=:1 ORDER BY EMAIL', [cod]);
    const tels = await query('SELECT TELEFONO FROM TURISTA_TELEFONO_AV WHERE ID_BD=1 AND COD_TURISTA=:1 ORDER BY TELEFONO', [cod]);
    res.render('turistas/edit', { item: tRows[0], emails, tels });
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Actualizar datos de turista
router.post('/:cod', requireAuth, async (req, res) => {
  const { cod } = req.params;
  const { nombre1, nombre2, nombre3, apellido1, apellido2, direccion, pais } = req.body;
  try {
    await query(`UPDATE TURISTA_AV SET NOMBRE1=:1, NOMBRE2=:2, NOMBRE3=:3, APELLIDO1=:4, APELLIDO2=:5, DIRECCION=:6, PAIS_RESIDENCIA=:7
                 WHERE ID_BD=1 AND COD_TURISTA=:8`,
                [nombre1, nombre2 || null, nombre3 || null, apellido1, apellido2 || null, direccion || null, pais || null, cod]);
    res.redirect('/turistas');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Eliminar turista
router.post('/:cod/delete', requireAuth, async (req, res) => {
  const { cod } = req.params;
  try {
    await query('DELETE FROM TURISTA_AV WHERE ID_BD=1 AND COD_TURISTA=:1', [cod]);
    res.redirect('/turistas');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Agregar email
router.post('/:cod/emails', requireAuth, async (req, res) => {
  const { cod } = req.params;
  const { email } = req.body;
  try {
    if (email) {
      await query('INSERT INTO TURISTA_EMAIL_AV (ID_BD, COD_TURISTA, EMAIL) VALUES (1, :1, :2)', [cod, email]);
    }
    res.redirect(`/turistas/${cod}/edit`);
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Eliminar email
router.post('/:cod/emails/:email/delete', requireAuth, async (req, res) => {
  const { cod, email } = req.params;
  try {
    await query('DELETE FROM TURISTA_EMAIL_AV WHERE ID_BD=1 AND COD_TURISTA=:1 AND EMAIL=:2', [cod, email]);
    res.redirect(`/turistas/${cod}/edit`);
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Agregar teléfono
router.post('/:cod/telefonos', requireAuth, async (req, res) => {
  const { cod } = req.params;
  const { telefono } = req.body;
  try {
    if (telefono) {
      await query('INSERT INTO TURISTA_TELEFONO_AV (ID_BD, COD_TURISTA, TELEFONO) VALUES (1, :1, :2)', [cod, telefono]);
    }
    res.redirect(`/turistas/${cod}/edit`);
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

// Eliminar teléfono
router.post('/:cod/telefonos/:tel/delete', requireAuth, async (req, res) => {
  const { cod, tel } = req.params;
  try {
    await query('DELETE FROM TURISTA_TELEFONO_AV WHERE ID_BD=1 AND COD_TURISTA=:1 AND TELEFONO=:2', [cod, tel]);
    res.redirect(`/turistas/${cod}/edit`);
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

export default router;
