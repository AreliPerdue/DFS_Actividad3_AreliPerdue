// server.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware para que el servidor entienda JSON
app.use(express.json());

// Ruta inicial de prueba
app.get('/', (req, res) => {
    res.send('Servidor básico con Express.js funcionando 🚀');
});

// Ruta del archivo de tareas
const tareasFile = path.join(__dirname, 'tareas.json');

// Función auxiliar para leer tareas
async function leerTareas() {
    try {
        const data = await fs.readFile(tareasFile, 'utf8');
        return data ? JSON.parse(data) : [];
    } catch (err) {
        // Si el archivo no existe, devolvemos un arreglo vacío
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}

// Función auxiliar para escribir tareas
async function escribirTareas(tareas) {
    await fs.writeFile(tareasFile, JSON.stringify(tareas, null, 2));
}

// ---------------------- RUTAS CRUD ----------------------

// GET /tareas: devuelve todas las tareas
app.get('/tareas', async (req, res, next) => {
    try {
        const tareas = await leerTareas();
        res.json(tareas);
    } catch (err) {
        next(err);
    }
});

// POST /tareas: agrega una nueva tarea
app.post('/tareas', async (req, res, next) => {
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

// PUT /tareas/:id: actualiza una tarea existente
app.put('/tareas/:id', async (req, res, next) => {
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

// DELETE /tareas/:id: elimina una tarea
app.delete('/tareas/:id', async (req, res, next) => {
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

// ---------------------- MANEJO DE ERRORES ----------------------
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// ---------------------- INICIO DEL SERVIDOR ----------------------
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
