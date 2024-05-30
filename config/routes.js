const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const crypto = require('crypto');
const util = require('util');
const exec = util.promisify(require('child_process').exec); 

const repoDir = 'ServerFace';
const secret = process.env.WEBHOOK_SECRET;

router.use(express.json());

const User = require("../config/userModel");
const extraerDescriptoresFaciales = require("../utils/faceRecognition");
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || "uploads");

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        const { id } = req.body;
        cb(null, id + path.extname(file.originalname)); 
    },
});
const upload = multer({storage: storage});

const authMiddleware = require('./authMiddleware');

// Obtener todos los usuarios
router.get("/usuarios", async (req, res) => {
    try {
        const users = await User.find().select("-descriptoresFaciales");
        res.json(users);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

router.post('/webhook', async (req, res) => {
    try {
        // Verify webhook signature
        const signature = req.headers['x-hub-signature-256'];
        const hmac = crypto.createHmac('sha256', secret);
        const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
            return res.status(401).send('Invalid webhook signature'); // Use consistent error message
        }

        // Check if push to main branch
        if (req.body.ref === 'refs/heads/main') {
            const commands = [
                `cd ${repoDir}`,
                'git pull origin main',
                'npm install',
                'pm2 restart ecosystem.config.js'
            ];

            // Execute commands asynchronously with error handling
            for (const command of commands) {
                const { stdout, stderr } = await exec(command); // Await each command
                console.log(stdout); // Log output for debugging
                if (stderr) { 
                    console.error(stderr); // Log errors
                    throw new Error(`Error executing command: ${command}`);
                }
            }

            res.status(200).json({ message: 'Update successful' });
        } else {
            res.status(202).json({ message: 'No update needed' });
        }
    } catch (err) {
        console.error('Error during update:', err);
        res.status(500).json({ message: 'Error during update', error: err.message }); // Send error details in response
    }
});

// Obtener usuario por cédula
router.get("/usuario/:cc", authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({cc: req.params.cc}).select(
            "-descriptoresFaciales"
        );
        if (!user)
            return res.status(404).json({message: "Usuario no encontrado"});
        res.json(user);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Registro de usuario y extracción de descriptores faciales
router.post("/usuario", authMiddleware, upload.single("imagen"), async (req, res) => {
    try {
        const { id, nombreCompleto, correoInstitucional, telefono, cc } = req.body;

        if (!req.file || !id || !nombreCompleto || !correoInstitucional || !telefono || !cc) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        // Extraer descriptores faciales
        const descriptoresFaciales = await extraerDescriptoresFaciales(req.file.path);

        const newUser = new User({
            id,
            nombreCompleto,
            descriptoresFaciales,
            correoInstitucional,
            telefono,
            cc,
            imagen: req.file.filename,
        });

        await newUser.save();

        res.status(201).json({ message: "Usuario creado exitosamente", usuario: newUser });
    } catch (err) {
        console.error("Error al crear usuario:", err);
        const errorMessage = err.code === 11000 ? "La cédula ya está registrada" : err.message;
        const statusCode = err.name === "ValidationError" || err.code === 11000 ? 400 : 500;
        res.status(statusCode).json({ error: errorMessage });

        // Intentar eliminar el archivo incluso si hubo un error
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkErr) {
                console.error("Error al eliminar el archivo:", unlinkErr);
            }
        }
    }
});

// Eliminar usuario por cédula
router.delete("/usuario/:cc", authMiddleware, async (req, res) => {
    try {
        const deletedUser = await User.findOneAndDelete({cc: req.params.cc});
        if (!deletedUser)
            return res.status(404).json({message: "Usuario no encontrado"});

        if (deletedUser.imagen) {
            await fs.unlink(
                path.join(__dirname, "../uploads", deletedUser.imagen)
            );
        }

        res.json({message: "Usuario eliminado correctamente"});
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

// Validar descriptores faciales
router.post("/validar", authMiddleware, upload.single("snap"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se proporcionó ningún snap" });
        }

        const descriptoresCamara = await extraerDescriptoresFaciales(req.file.path);

        const usuarioCoincidente = await User.aggregate([
            {
                $project: {
                    nombreCompleto: 1,
                    correoInstitucional: 1,
                    telefono: 1,
                    cc: 1,
                    imagen: 1,
                    distancia: {
                        $min: {
                            $map: {
                                input: "$descriptoresFaciales",
                                as: "df",
                                in: {
                                    $sum: {
                                        $pow: [{ $subtract: ["$$df", descriptoresCamara] }, 2],
                                    },
                                },
                            },
                        },
                    },
                },
            },
            { $match: { distancia: { $lt: 0.6 } } },
            { $sort: { distancia: 1 } },
            { $limit: 1 },
        ]);

        // Eliminar la imagen después de usarla
        await fs.unlink(req.file.path);

        if (usuarioCoincidente.length > 0) {
            res.json({
                message: "Coincidencia encontrada",
                usuario: usuarioCoincidente[0],
            });
        } else {
            res.json({ message: "No se encontró coincidencia" });
        }
    } catch (err) {
        console.error("Error en la validación:", err);
        res.status(500).json({ error: err.message });

        // Intentar eliminar el archivo incluso si hubo un error
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkErr) {
                console.error("Error al eliminar el archivo:", unlinkErr);
            }
        }
    }
});

router.get("/uploads/:filename", authMiddleware, async (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);

    try {
        await fs.access(filePath);
        res.sendFile(filePath);
    } catch (err) {
        console.error('Error al enviar el archivo:', err);
        res.status(404).json({ error: "Imagen no encontrada" });
    }
});


router.post('/admin/login', authMiddleware, async (req, res) => {
    const {username, password} = req.body;

    // Verificar las credenciales del administrador
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        // Generar un token JWT si las credenciales son válidas
        const token = jwt.sign({rol: 'admin'}, process.env.JWT_SECRET, {expiresIn: '1h'});
        res.json({token});
    } else {
        res.status(401).json({error: 'Credenciales inválidas'});
    }
});

module.exports = router;