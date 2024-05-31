const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");
const multer = require("multer");
const crypto = require('crypto');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const cors = require('cors');

const repoDir = 'ServerFace'; 
const secret = process.env.WEBHOOK_SECRET;

router.use(express.json());
router.use(cors()); 

const User = require("../config/userModel");
const extraerDescriptoresFaciales = require("../utils/faceRecognition");
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || "uploads"); 
const storage = multer.memoryStorage(); 
const upload = multer({ storage: storage }); 

// Obtener todos los usuarios
router.get("/usuarios", async (req, res) => {
    try {
        const users = await User.find().select("-descriptoresFaciales");
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener usuario por cédula
router.get("/usuario/:cc", async (req, res) => {
    try {
        const user = await User.findOne({ cc: req.params.cc }).select("-descriptoresFaciales");
        if (!user)
            return res.status(404).json({ message: "Usuario no encontrado" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Registro de usuario y extracción de descriptores faciales
router.post("/usuario", upload.single("imagen"), async (req, res) => {
    try {
        const { id, nombreCompleto, correoInstitucional, telefono, cc } = req.body;

        if (!req.file || !id || !nombreCompleto || !correoInstitucional || !telefono || !cc) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }

        // Extraer descriptores faciales
        const descriptoresFaciales = await extraerDescriptoresFaciales(req.file.buffer);

        const newUser = new User({
            id,
            nombreCompleto,
            descriptoresFaciales,
            correoInstitucional,
            telefono,
            cc,
            imagen: req.file.originalname,
        });

        await newUser.save();

        res.status(201).json({ message: "Usuario creado exitosamente", usuario: newUser });
    } catch (err) {
        console.error("Error al crear usuario:", err);
        const errorMessage = err.code === 11000 ? "La cédula ya está registrada" : err.message;
        const statusCode = err.name === "ValidationError" || err.code === 11000 ? 400 : 500;
        res.status(statusCode).json({ error: errorMessage });
    }
});

// Eliminar usuario por cédula
router.delete("/usuario/:cc", async (req, res) => {
    try {
        const deletedUser = await User.findOneAndDelete({ cc: req.params.cc });
        if (!deletedUser)
            return res.status(404).json({ message: "Usuario no encontrado" });

        res.json({ message: "Usuario eliminado correctamente" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Validar descriptores faciales
router.post("/validar", upload.single("snap"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se proporcionó ningún snap" });
        }

        const descriptoresCamara = await extraerDescriptoresFaciales(req.file.buffer);

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
    }
});

router.get("/uploads/:filename", async (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);

    try {
        await fs.access(filePath);
        res.sendFile(filePath);
    } catch (err) {
        console.error('Error al enviar el archivo:', err);
        res.status(404).json({ error: "Imagen no encontrada" });
    }
});

// Webhook
// Webhook for Automatic Updates
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-hub-signature-256'];

        // Verify Webhook Signature (Stricter)
        if (!signature || !crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(`sha256=${crypto.createHmac('sha256', secret)
                .update(JSON.stringify(req.body))
                .digest('hex')}`))) {
            return res.status(401).send('Invalid webhook signature');
        }

        if (req.body.ref === 'refs/heads/main') {
            const commands = [
                `cd ${repoDir}`,
                'git pull origin main',
                'npm install',
                'pm2 restart ecosystem.config.js'
            ];

            // Execute Update Commands (with Error Handling)
            for (const command of commands) {
                const { stdout, stderr } = await exec(command);
                console.log(stdout);
                if (stderr) {
                    console.error(`Error executing ${command}:`, stderr);
                    throw new Error(`Update failed at: ${command}`); // More informative error
                }
            }
            res.status(200).json({ message: 'Update successful' });
        } else {
            res.status(202).json({ message: 'No update needed' });
        }
    } catch (err) {
        console.error('Error during update:', err);
        res.status(500).json({ message: 'Update failed', error: err.message });
    }
});

module.exports = router;