const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");

const directorioSubida = path.join(__dirname, "..", process.env.UPLOAD_DIR || "uploads");

router.get("/uploads/:filename", async (req, res) => {
    const nombreArchivo = req.params.filename;
    const rutaArchivo = path.join(directorioSubida, nombreArchivo);
    try{ 
        await fs.access(rutaArchivo);
        res.sendFile(rutaArchivo);
    } catch (err) {
        console.error("Error al enviar el archivo:", err);
        res.status(404).json({ error: "Imagen no encontrada" });
    }
});

module.exports = router;