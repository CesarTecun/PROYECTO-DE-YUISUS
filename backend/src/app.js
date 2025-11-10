import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './db.js';
import session from 'express-session';
import { ensureAdmin, authenticate, requireAuth } from './auth.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'public', 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret_dev',
  resave: false,
  saveUninitialized: false
}));

// Exponer usuario a todas las vistas
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Guard global: si no hay sesión, solo permitir login/register
app.use((req, res, next) => {
  if (req.session.user) return next();
  const p = req.path;
  if (p === '/login' || p === '/register') return next();
  if ((p === '/login' || p === '/register') && (req.method === 'POST')) return next();
  return res.redirect('/login');
});

// Crear admin por defecto al iniciar
ensureAdmin().catch(err => console.error('ensureAdmin error', err));

app.get('/', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  try {
    const rows = await query("SELECT 'OK' AS STATUS FROM dual");
    res.render('index', { status: rows[0]?.STATUS || 'N/A', user: req.session.user || null });
  } catch (e) {
    res.status(500).send('DB error: ' + e.message);
  }
});

// Login
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await authenticate(username, password);
    if (!user) return res.status(401).render('auth/login', { error: 'Credenciales inválidas' });
    req.session.user = user;
    res.redirect('/');
  } catch (e) {
    res.status(500).render('auth/login', { error: e.message });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// Registro
app.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/register', { error: null });
});

app.post('/register', async (req, res) => {
  const { username, password, nombre } = req.body;
  try {
    const exists = await query('SELECT 1 FROM USUARIOS_APP WHERE USERNAME=:1', [username]);
    if (exists.length) return res.status(400).render('auth/register', { error: 'Usuario ya existe' });
    const hash = await bcrypt.hash(password, 10);
    await query('INSERT INTO USUARIOS_APP (USERNAME, PASSWORD_HASH, NOMBRE_COMPLETO, ROL, ACTIVO) VALUES (:1,:2,:3,\'USUARIO\',\'S\')', [username, hash, nombre || username]);
    res.redirect('/login');
  } catch (e) {
    res.status(500).render('auth/register', { error: e.message });
  }
});

app.get('/sucursales', requireAuth, async (req, res) => {
  try {
    const rows = await query('SELECT COD_SUCURSAL, DIRECCION, TELEFONO FROM SUCURSAL_AV WHERE ID_BD=1 ORDER BY COD_SUCURSAL');
    res.render('sucursales/list', { items: rows });
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

app.get('/sucursales/new', requireAuth, (req, res) => {
  res.render('sucursales/new');
});

app.post('/sucursales', requireAuth, async (req, res) => {
  const { cod, direccion, telefono } = req.body;
  try {
    await query('INSERT INTO SUCURSAL_AV (ID_BD, COD_SUCURSAL, DIRECCION, TELEFONO) VALUES (1, :1, :2, :3)', [cod, direccion, telefono]);
    res.redirect('/sucursales');
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log('Backend listening on ' + port));
