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
router.use(cors()); // Usar el middleware de CORS para permitir cualquier acceso

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
        const signature = req.headers['x-hub-signature-256'];
        const hmac = crypto.createHmac('sha256', secret);
        const digest = 'sha256=' + hmac.update(Buffer.from(JSON.stringify(req.body), 'utf-8')).digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
            return res.status(401).send('Invalid webhook signature');
        }
        if (req.body.ref === 'refs/heads/main') {
            const commands = [
                `cd ${repoDir}`,
                'git pull origin main',
                'npm install',
                'pm2 restart ecosystem.config.js'
            ];
            for (const command of commands) {
                const { stdout, stderr } = await exec(command);
                console.log(stdout);
                if (stderr) { 
                    console.error(stderr);
                    throw new Error(`Error executing command: ${command}`);
                }
            }
            res.status(200).json({ message: 'Actualización exitosa' });
        } else {
            res.status(202).json({ message: 'No se necesita actualizar' });
        }
    } catch (err) {
        console.error('Error durante la actualización:', err);
        res.status(500).json({ message: 'Error durante la actualización', error: err.message }); 
    }
});

// Obtener usuario por cédula
router.get("/usuario/:cc", async (req, res) => {
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
        if (req.file && req.file.buffer) {
            try {
                await fs.unlink(req.file.buffer);
            } catch (unlinkErr) {
                console.error("Error al eliminar el archivo:", unlinkErr);
            }
        }
    }
});

// Eliminar usuario por cédula
router.delete("/usuario/:cc", async (req, res) => {
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

        // Eliminar la imagen después de usarla
        await fs.unlink(req.file.buffer);

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
        if (req.file && req.file.buffer) {
            try {
                await fs.unlink(req.file.buffer);
            } catch (unlinkErr) {
                console.error("Error al eliminar el archivo:", unlinkErr);
            }
        }
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

module.exports = router;