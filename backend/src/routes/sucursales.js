import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

// Listar
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await query('SELECT COD_SUCURSAL, DIRECCION, TELEFONO FROM SUCURSAL_AV WHERE ID_BD=1 ORDER BY COD_SUCURSAL');
    res.render('sucursales/list', { 
      items: rows,
      error: null,
      formData: {}
    });
  } catch (e) {
    res.status(500).render('error', { error: 'Error al cargar la lista de sucursales: ' + e.message });
  }
});

// Form crear
router.get('/new', requireAuth, (req, res) => {
  res.render('sucursales/new', {
    formData: {},
    error: null
  });
});

// Crear
router.post('/', requireAuth, async (req, res) => {
  const { cod, direccion, telefono } = req.body;
  
  // Validar campos requeridos
  if (!cod || !direccion) {
    return res.status(400).render('sucursales/new', { 
      error: 'Los campos Código y Dirección son obligatorios',
      formData: req.body
    });
  }

  // Validar formato del código (ejemplo: al menos 3 caracteres)
  if (cod.length < 3) {
    return res.status(400).render('sucursales/new', { 
      error: 'El código debe tener al menos 3 caracteres',
      formData: req.body
    });
  }

  // Validar formato de teléfono (opcional)
  if (telefono && !/^[0-9\s\-+()]+$/.test(telefono)) {
    return res.status(400).render('sucursales/new', { 
      error: 'El formato del teléfono no es válido',
      formData: req.body
    });
  }

  try {
    // Verificar si ya existe una sucursal con el mismo código
    const existe = await query('SELECT 1 FROM SUCURSAL_AV WHERE ID_BD=1 AND COD_SUCURSAL = :1', [cod]);
    if (existe.length > 0) {
      return res.status(400).render('sucursales/new', { 
        error: 'Ya existe una sucursal con este código',
        formData: req.body
      });
    }

    // Insertar la nueva sucursal
    await query(
      'INSERT INTO SUCURSAL_AV (ID_BD, COD_SUCURSAL, DIRECCION, TELEFONO) VALUES (1, :1, :2, :3)', 
      [cod, direccion, telefono || null]
    );
    
    res.redirect('/sucursales');
  } catch (e) {
    res.status(500).render('sucursales/new', { 
      error: 'Error al crear la sucursal: ' + e.message,
      formData: req.body
    });
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
