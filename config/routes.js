const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const User = require("../config/userModel");
const extraerDescriptoresFaciales = require("../utils/faceRecognition");
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || "uploads");

const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
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

// Subir datos de usuario y descriptores faciales
router.post("/usuario", authMiddleware, upload.single("imagen"), async (req, res) => {
    try {
        const {nombreCompleto, correoInstitucional, telefono, cc} = req.body;
        if (!req.file || !nombreCompleto || !correoInstitucional || !telefono || !cc) {
            return res.status(400).json({error: "Faltan datos obligatorios"});
        }

        const descriptoresFaciales = await extraerDescriptoresFaciales(
            req.file.path
        );

        const newUser = new User({
            nombreCompleto,
            descriptoresFaciales,
            correoInstitucional,
            telefono,
            cc,
            imagen: req.file.filename,
        });

        await newUser.save();
        await fs.unlink(req.file.path);

        res
            .status(201)
            .json({message: "Usuario creado exitosamente", usuario: newUser});
    } catch (err) {
        console.error(err);
        const errorMessage =
            err.code === 11000 ? "La cédula ya está registrada" : err.message;
        const statusCode =
            err.name === "ValidationError" || err.code === 11000 ? 400 : 500;
        res.status(statusCode).json({error: errorMessage});
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
            return res.status(400).json({error: "No se proporcionó ningún snap"});
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
                                        $pow: [{$subtract: ["$$df", descriptoresCamara]}, 2],
                                    },
                                },
                            },
                        },
                    },
                },
            },
            {$match: {distancia: {$lt: 0.6}}},
            {$sort: {distancia: 1}},
            {$limit: 1},
        ]);

        // Eliminar la imagen después de usarla
        await fs.unlink(req.file.path);

        if (usuarioCoincidente.length > 0) {
            res.json({
                message: "Coincidencia encontrada",
                usuario: usuarioCoincidente[0],
            });
        } else {
            res.json({message: "No se encontró coincidencia"});
        }
    } catch (err) {
        console.error("Error en la validación:", err);
        res.status(500).json({error: err.message});

        // Intentar eliminar el archivo incluso si hubo un error
        try {
            if (req.file && req.file.path) {
                await fs.unlink(req.file.path);
            }
        } catch (unlinkErr) {
            console.error("Error al eliminar el archivo:", unlinkErr);
        }
    }
});

router.get("/uploads/:filename", authMiddleware, (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);
    res.sendFile(filePath, (err) => {
        if (err) {
            res.status(404).json({error: "Imagen no encontrada"});
        }
    });
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