// server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

// Middleware para que el servidor entienda JSON
app.use(express.json());

// Ruta inicial de prueba
app.get('/', (req, res) => {
    res.send('Servidor básico con Express.js funcionando 🚀');
});

// ---------------------- ARCHIVOS ----------------------
const tareasFile = path.join(__dirname, 'tareas.json');
const usuariosFile = path.join(__dirname, 'usuarios.json');
const SECRET_KEY = 'clave_secreta_super_segura'; // cámbiala por algo más robusto

// Funciones auxiliares para tareas
async function leerTareas() {
    try {
        const data = await fs.readFile(tareasFile, 'utf8');
        return data ? JSON.parse(data) : [];
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}
async function escribirTareas(tareas) {
    await fs.writeFile(tareasFile, JSON.stringify(tareas, null, 2));
}

// Funciones auxiliares para usuarios
async function leerUsuarios() {
    try {
        const data = await fs.readFile(usuariosFile, 'utf8');
        return data ? JSON.parse(data) : [];
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}
async function escribirUsuarios(usuarios) {
    await fs.writeFile(usuariosFile, JSON.stringify(usuarios, null, 2));
}

// ---------------------- RUTAS DE AUTENTICACIÓN ----------------------

// POST /register
app.post('/register', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }

        const usuarios = await leerUsuarios();
        const existe = usuarios.find(u => u.username === username);
        if (existe) {
            return res.status(400).json({ error: 'Usuario ya registrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const nuevoUsuario = { id: usuarios.length + 1, username, password: hashedPassword };

        usuarios.push(nuevoUsuario);
        await escribirUsuarios(usuarios);

        res.status(201).json({ mensaje: 'Usuario registrado correctamente' });
    } catch (err) {
        next(err);
    }
});

// POST /login
app.post('/login', async (req, res, next) => {
    try {
        console.log('Contenido de req.body:', req.body); // <-- Depuración
        const { username, password } = req.body;
        const usuarios = await leerUsuarios();
        const usuario = usuarios.find(u => u.username === username);

        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const esValido = await bcrypt.compare(password, usuario.password);
        if (!esValido) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        const token = jwt.sign({ id: usuario.id, username: usuario.username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ mensaje: 'Login exitoso', token });
    } catch (err) {
        next(err);
    }
});

// ---------------------- MIDDLEWARE DE AUTENTICACIÓN ----------------------
function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token requerido' });

    jwt.verify(token, SECRET_KEY, (err, usuario) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.usuario = usuario;
        next();
    });
}

// ---------------------- RUTAS CRUD PROTEGIDAS ----------------------
app.get('/tareas', autenticarToken, async (req, res, next) => {
    try {
        const tareas = await leerTareas();
        res.json(tareas);
    } catch (err) {
        next(err);
    }
});

app.get('/tareas/:id', autenticarToken, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const tareas = await leerTareas();
        const tarea = tareas.find(t => t.id === id);

        if (!tarea) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        res.json(tarea);
    } catch (err) {
        next(err);
    }
});

app.post('/tareas', autenticarToken, async (req, res, next) => {
    try {
        const { titulo, descripcion } = req.body;
        if (!titulo || !descripcion) {
            return res.status(400).json({ error: 'Título y descripción son requeridos' });
        }

        const tareas = await leerTareas();
        const nuevaTarea = {
            id: tareas.length ? tareas[tareas.length - 1].id + 1 : 1,
            titulo,
            descripcion
        };

        tareas.push(nuevaTarea);
        await escribirTareas(tareas);

        res.status(201).json(nuevaTarea);
    } catch (err) {
        next(err);
    }
});

app.put('/tareas/:id', autenticarToken, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        const { titulo, descripcion } = req.body;

        const tareas = await leerTareas();
        const tareaIndex = tareas.findIndex(t => t.id === id);

        if (tareaIndex === -1) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        tareas[tareaIndex] = { id, titulo, descripcion };
        await escribirTareas(tareas);

        res.json(tareas[tareaIndex]);
    } catch (err) {
        next(err);
    }
});

app.delete('/tareas/:id', autenticarToken, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);

        const tareas = await leerTareas();
        const nuevaLista = tareas.filter(t => t.id !== id);

        if (tareas.length === nuevaLista.length) {
            return res.status(404).json({ error: 'Tarea no encontrada' });
        }

        await escribirTareas(nuevaLista);
        res.json({ mensaje: 'Tarea eliminada correctamente' });
    } catch (err) {
        next(err);
    }
});

//ruta temporal para hacer test 500 
app.get('/error-test', (req, res, next) => {
    try {
        throw new Error("Error simulado en el servidor");
    } catch (err) {
        next(err);
    }
});

// ---------------------- MANEJO DE ERRORES ----------------------
app.use((err, req, res, next) => {
    console.error('Error capturado:', err.stack);
    const status = err.status || 500;
    const mensaje = err.message || 'Error interno del servidor';
    res.status(status).json({ error: mensaje });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// ---------------------- INICIO DEL SERVIDOR ----------------------
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
