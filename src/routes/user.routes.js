const express = require("express");
const router = express.Router();
const multer = require("multer");
const Usuario = require("../userModel");
const extraerDescriptoresFaciales = require("../utils/faceRecognition");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Obtener todos los usuarios (sin descriptores faciales)
router.get("/", async (req, res) => {
    try {
        const usuarios = await Usuario.find().select("-descriptoresFaciales");
        res.json(usuarios);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Obtener un usuario por cédula (sin descriptores faciales)
router.get("/:cc", async (req, res) => {
    try {
        const usuario = await Usuario.findOne({ cc: req.params.cc }).select("-descriptoresFaciales");
        if (!usuario) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        res.json(usuario);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ruta para crear un nuevo usuario y extraer descriptores faciales
router.post("/", upload.single("imagen"), async (req, res) => {
    try {
        const { id, nombreCompleto, correoInstitucional, telefono, cc } = req.body;
        if (!req.file || !id || !nombreCompleto || !correoInstitucional || !telefono || !cc) {
            return res.status(400).json({ error: "Faltan datos obligatorios" });
        }
        const descriptoresFaciales = await extraerDescriptoresFaciales(req.file.buffer);
        const nuevoUsuario = new Usuario({
            id,
            nombreCompleto,
            descriptoresFaciales,
            correoInstitucional,
            telefono,
            cc,
            imagen: req.file.originalname, 
        });

        await nuevoUsuario.save();
        res.status(201).json({ message: "Usuario creado exitosamente", usuario: nuevoUsuario });
    } catch (err) {
        const mensajeError = err.code === 11000 ? "La cédula ya está registrada" : err.message;
        const codigoEstado = err.name === "ValidationError" || err.code === 11000 ? 400 : 500;
        res.status(codigoEstado).json({ error: mensajeError });
    }
});

// Ruta para eliminar un usuario por cédula
router.delete("/:cc", async (req, res) => {
    try {
        const usuarioEliminado = await Usuario.findOneAndDelete({ cc: req.params.cc });
        if (!usuarioEliminado) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }
        res.json({ message: "Usuario eliminado correctamente" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;