const express = require("express");
const router = express.Router();
const multer = require("multer");
const Usuario = require("../userModel");
const extraerDescriptoresFaciales = require("../utils/faceRecognition");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post("/validar", upload.single("snap"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No se proporcionó ninguna imagen" });
        }
        const imageBuffer = req.file.buffer;
        const descriptoresCamara = await extraerDescriptoresFaciales(imageBuffer);
        const usuarioCoincidente = await Usuario.aggregate([
            {
                $project: {
                    nombreCompleto: 1,
                    correoInstitucional: 1,
                    telefono: 1,
                    cc: 1,
                    imagen: 1,
                    distancia: {
                        $sqrt: {
                            $sum: {
                                $map: {
                                    input: { $zip: { inputs: ["$descriptoresFaciales", descriptoresCamara] } },
                                    as: "pair",
                                    in: { $pow: [{ $subtract: [{ $arrayElemAt: ["$$pair", 0] }, { $arrayElemAt: ["$$pair", 1] }] }, 2] }
                                }
                            }
                        }
                    }
                }
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
            res.status(401).json({ error: "No se encontró coincidencia" });
        }
    } catch (reconocimientoError) {
        console.error("Error en el reconocimiento facial:", reconocimientoError);
        res.status(500).json({ error: "Error en el reconocimiento facial" });
    }
});

module.exports = router;