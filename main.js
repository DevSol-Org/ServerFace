require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const https = require("https");

const conectarABaseDeDatos = require("./config/database");

const app = express();

const PUERTO = process.env.PORT || 4010;
const directorioSubida = path.join(__dirname, process.env.UPLOAD_DIR || "uploads");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(directorioSubida));

conectarABaseDeDatos().then(() => {

    const rutas = require("./src/routes");
    app.use("/", rutas);

    const { manejadorNoEncontrado, manejadorError } = require("./src/middleware/middleware");
    app.use(manejadorNoEncontrado);
    app.use(manejadorError);

    // --- Configuración del servidor HTTPS ---
    let servidor;

    if (process.env.NODE_ENV === "production") {
        const opcionesHttps = {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH),
        };

        servidor = https.createServer(opcionesHttps, app);
    } else {
        servidor = app;
    }

    servidor.listen(PUERTO, () => {
        console.log(`🚀 Servidor escuchando en el puerto ${PUERTO} en modo ${process.env.NODE_ENV}`);
    });

    servidor.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(`❌ El puerto ${PUERTO} ya está en uso`);
        } else {
            console.error("💥 Error del servidor:", err);
        }
        process.exit(1);
    });

}).catch((err) => {
    console.error("🚨 Error crítico durante el inicio:", err);
    process.exit(1);
});