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
    res.render('estadias/list', { 
      items: rows,
      error: null,
      formData: {}
    });
  } catch (e) {
    res.status(500).render('error', { error: 'Error al cargar la lista de estadías: ' + e.message });
  }
});

// Form crear
router.get('/new', requireAuth, async (req, res) => {
  try {
    // Obtener códigos de hoteles existentes
    const hoteles = await query('SELECT COD_HOTEL, NOMBRE FROM HOTEL_AV WHERE ID_BD=1 ORDER BY COD_HOTEL');
    res.render('estadias/new', { 
      hoteles,
      formData: {},
      error: null
    });
  } catch (e) {
    res.status(500).render('error', { 
      error: 'Error al cargar el formulario: ' + e.message 
    });
  }
});

// Función para formatear fechas de DD/MM/YYYY a YYYY-MM-DD
function formatearFecha(fecha) {
  if (!fecha) return null;
  
  // Si ya está en formato YYYY-MM-DD, retornar tal cual
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }
  
  // Convertir de DD/MM/YYYY a YYYY-MM-DD
  const [dia, mes, anio] = fecha.split('/');
  if (dia && mes && anio) {
    return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  
  return fecha; // Si no coincide con ningún formato, devolver el original
}

// Función para validar fechas según las restricciones de la base de datos
function validarFechasEstadia(llegada, partida) {
  const fechaLlegada = new Date(llegada);
  const fechaPartida = new Date(partida);
  
  // Verificar que las fechas sean válidas
  if (isNaN(fechaLlegada.getTime()) || isNaN(fechaPartida.getTime())) {
    return { valido: false, error: 'Formato de fecha inválido. Use DD/MM/YYYY' };
  }
  
  // Verificar que la fecha de partida sea posterior a la de llegada
  if (fechaPartida <= fechaLlegada) {
    return { 
      valido: false, 
      error: 'La fecha de partida debe ser posterior a la fecha de llegada' 
    };
  }
  
  return { valido: true };
}

// Función para validar el régimen
function validarRegimen(regimen) {
  const regimenesValidos = ['MEDIA_PENSION', 'PENSION_COMPLETA'];
  if (!regimenesValidos.includes(regimen)) {
    return {
      valido: false,
      error: `El régimen debe ser uno de los siguientes: ${regimenesValidos.join(', ')}`
    };
  }
  return { valido: true };
}

// Crear estadía
router.post('/', requireAuth, async (req, res) => {
  const { idReserva, codHotel, llegada, partida, regimen } = req.body;
  
  try {
    // Validación de campos requeridos
    if (!idReserva || !codHotel || !llegada || !partida || !regimen) {
      const hoteles = await query('SELECT COD_HOTEL, NOMBRE FROM HOTEL_AV WHERE ID_BD=1 ORDER BY COD_HOTEL');
      return res.status(400).render('estadias/new', { 
        error: 'Todos los campos son obligatorios',
        formData: req.body,
        hoteles
      });
    }
    
    // Formatear fechas
    const fechaLlegada = formatearFecha(llegada);
    const fechaPartida = formatearFecha(partida);
    
    // Validar fechas
    const validacionFechas = validarFechasEstadia(fechaLlegada, fechaPartida);
    if (!validacionFechas.valido) {
      const hoteles = await query('SELECT COD_HOTEL, NOMBRE FROM HOTEL_AV WHERE ID_BD=1 ORDER BY COD_HOTEL');
      return res.status(400).render('estadias/new', {
        error: validacionFechas.error,
        formData: req.body,
        hoteles
      });
    }
    
    // Validar régimen
    const validacionRegimen = validarRegimen(regimen);
    if (!validacionRegimen.valido) {
      const hoteles = await query('SELECT COD_HOTEL, NOMBRE FROM HOTEL_AV WHERE ID_BD=1 ORDER BY COD_HOTEL');
      return res.status(400).render('estadias/new', {
        error: validacionRegimen.error,
        formData: req.body,
        hoteles
      });
    }
    
    // Verificar si ya existe una estadía para esta reserva
    const existe = await query('SELECT 1 FROM ESTADIA_AV WHERE ID_BD=1 AND ID_RESERVA=:1', [Number(idReserva)]);
    if (existe.length > 0) {
      const hoteles = await query('SELECT COD_HOTEL, NOMBRE FROM HOTEL_AV WHERE ID_BD=1 ORDER BY COD_HOTEL');
      return res.status(400).render('estadias/new', { 
        error: 'Ya existe una estadía para esta reserva',
        formData: req.body,
        hoteles
      });
    }
    
    // Insertar la nueva estadía
    await query(
      `INSERT INTO ESTADIA_AV (ID_BD, ID_RESERVA, COD_HOTEL, FECHA_LLEGADA, FECHA_PARTIDA, REGIMEN)
       VALUES (1, :1, :2, TO_DATE(:3, 'YYYY-MM-DD'), TO_DATE(:4, 'YYYY-MM-DD'), :5)`,
      [Number(idReserva), codHotel, fechaLlegada, fechaPartida, regimen]
    );
    
    res.redirect('/estadias');
  } catch (e) {
    console.error('Error al crear estadía:', e);
    const hoteles = await query('SELECT COD_HOTEL, NOMBRE FROM HOTEL_AV WHERE ID_BD=1 ORDER BY COD_HOTEL');
    
    // Manejar específicamente el error de restricción
    let mensajeError = 'Error al crear la estadía';
    if (e.message.includes('ORA-02290')) {
      mensajeError = 'Error: No se pudo crear la estadía. Verifique que:' +
                    '\n1. La fecha de partida sea posterior a la de llegada' +
                    '\n2. El régimen sea MEDIA_PENSION o PENSION_COMPLETA' +
                    '\n3. La reserva y el hotel existan en la base de datos';
    } else {
      mensajeError += ': ' + e.message;
    }
    
    res.status(500).render('estadias/new', {
      error: mensajeError,
      formData: req.body,
      hoteles
    });
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
