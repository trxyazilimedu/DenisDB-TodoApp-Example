import DDBConnect from "denisdb";
import express from "express";
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUI from 'swagger-ui-express';

const app = express();
app.use(express.json());

// Swagger Configuration
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Todo API with DenisDB',
            version: '1.0.0',
            description: 'A simple Todo API using DenisDB as cache storage'
        },
        servers: [
            {
                url: 'http://localhost:3000'
            }
        ]
    },
    apis: ['./index.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

// TCP Connection
const client = new DDBConnect({ type: 'tcp', port: 5142 });
async function initializeDB() {
    try {
        await client.connect();
        await client.send("LIN yusuf Ahi1/MmJo5V5nbAzYvaJPA==");
        await client.send("AUTH A3SwKx7IJMahRLVqQLb2qxUN0N3fxp60jJH8OuUQdEZUGwuwxIHlJxEdrlyFSpFR040tB2mdHekCAE8ha2DxmJfFDvYPxl0mWGcApmllG1pgtRRqn1K32AMdvu7YxbjZ");
        // Initialize todo IDs list if not exists
        
        const todoList = await client.send("GET todo_ids");
        try {
            JSON.parse(todoList);
        } catch (error) {
            
            await client.send("SET todo_ids [] -&save");
        }
      
        console.log('Connected to DenisDB');
    } catch (error) {
        console.error('Connection error:', error);
    }
}

initializeDB();


/**
 * @swagger
 * components:
 *   schemas:
 *     Todo:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         id:
 *           type: string
 *           description: Auto-generated ID of the todo
 *         title:
 *           type: string
 *           description: Title of the todo
 *         completed:
 *           type: boolean
 *           description: Completion status of todo
 */

/**
 * @swagger
 * /todos:
 *   post:
 *     summary: Create a new todo
 *     tags: [Todos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               completed:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Todo created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Todo'
 */
app.post('/todos', async (req, res) => {
    try {
        const { title, completed = false } = req.body;
        const id = Date.now().toString();
        const todo = { id, title, completed };
        await client.send(`SET todo:${id} ${JSON.stringify(todo)} -&save`);
        let todoIds = JSON.parse(await client.send("GET todo_ids") || "[]");
        todoIds.push(id);
        await client.send(`SET todo_ids ${JSON.stringify(todoIds)} -&save`);
        res.status(201).json(todo);
    } catch (error) {
        res.status(500).json({ error: 'Error creating todo' });
    }
});

/**
 * @swagger
 * /todos:
 *   get:
 *     summary: Get all todos
 *     tags: [Todos]
 *     responses:
 *       200:
 *         description: List of todos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Todo'
 */
app.get('/todos', async (req, res) => {
    try {
     
        const todoIds = JSON.parse(await client.send("GET todo_ids") || "[]");
        const todos = [];
        for (const id of todoIds) {
            const todo = await client.send(`GET todo:${id}`);
            
            if (todo) todos.push(JSON.parse(todo));
        }
        res.json(todos);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Error fetching todos' });
    }
});

/**
 * @swagger
 * /todos/{id}:
 *   get:
 *     summary: Get a todo by id
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Todo found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Todo'
 *       404:
 *         description: Todo not found
 */
app.get('/todos/:id', async (req, res) => {
    try {
        const todo = await client.send(`GET todo:${req.params.id}`);
        if (!todo) return res.status(404).json({ error: 'Todo not found' });
        res.json(JSON.parse(todo));
    } catch (error) {
        res.status(500).json({ error: 'Error fetching todo' });
    }
});

/**
 * @swagger
 * /todos/{id}:
 *   put:
 *     summary: Update a todo
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               completed:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Todo updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Todo'
 *       404:
 *         description: Todo not found
 */
app.put('/todos/:id', async (req, res) => {
    try {
        const { title, completed } = req.body;
        const existingTodo = await client.send(`GET todo:${req.params.id}`);
        if (!existingTodo) return res.status(404).json({ error: 'Todo not found' });

        const updatedTodo = {
            ...JSON.parse(existingTodo),
            title: title !== undefined ? title : JSON.parse(existingTodo).title,
            completed: completed !== undefined ? completed : JSON.parse(existingTodo).completed
        };

        await client.send(`SET todo:${req.params.id} ${JSON.stringify(updatedTodo)} -&save`);
        res.json(updatedTodo);
    } catch (error) {
        res.status(500).json({ error: 'Error updating todo' });
    }
});

/**
 * @swagger
 * /todos/{id}:
 *   delete:
 *     summary: Delete a todo
 *     tags: [Todos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Todo deleted
 *       404:
 *         description: Todo not found
 */
app.delete('/todos/:id', async (req, res) => {
    try {
        const todo = await client.send(`GET todo:${req.params.id}`);
        if (!todo) return res.status(404).json({ error: 'Todo not found' });
        await client.send(`DEL todo:${req.params.id} -&save`);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error deleting todo' });
    }
});

// Initialize connection and start server
async function start() {
    try {
        await client.connect();
        await client.send("LIN yusuf Ahi1/MmJo5V5nbAzYvaJPA==");
        await client.send("AUTH A3SwKx7IJMahRLVqQLb2qxUN0N3fxp60jJH8OuUQdEZUGwuwxIHlJxEdrlyFSpFR040tB2mdHekCAE8ha2DxmJfFDvYPxl0mWGcApmllG1pgtRRqn1K32AMdvu7YxbjZ");
        console.log('Connected to DenisDB');

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
        });
    } catch (error) {
        console.error('Startup error:', error);
    }
}

start();