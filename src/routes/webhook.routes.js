const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const directorioRepositorio = "ServerFace";
const secretoWebhook = process.env.WEBHOOK_SECRET;

// Ruta para manejar webhooks
router.post("/webhook", async (req, res) => {
    try {
        const signature = req.headers["x-hub-signature-256"];
        if (!signature || !crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(`sha256=${crypto.createHmac("sha256", secretoWebhook)
                .update(JSON.stringify(req.body))
                .digest("hex")}`)
        )) {
            return res.status(401).send("Firma de webhook inválida");
        }

        if (req.body.ref === "refs/heads/main") {
            const comandos = [
                `cd ${directorioRepositorio}`,
                "git pull origin main",
                "npm install",
                "pm2 restart ecosystem.config.js" 
            ];

            for (const comando of comandos) {
                const { stdout, stderr } = await exec(comando);
                console.log(stdout); 
                if (stderr) {  
                    console.error(`Error al ejecutar ${comando}:`, stderr);
                    throw new Error(`Error en la actualización: ${comando}`);
                }
            }
            res.status(200).json({ message: "Actualización exitosa" });
        } else {
            res.status(202).json({ message: "No se necesita actualización" });
        }
    } catch (err) {
        console.error("Error durante la actualización:", err);
        res.status(500).json({ message: "Error en la actualización", error: err.message });
    }
});

module.exports = router;