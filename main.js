require("dotenv").config();

var express = require('express');
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
var fs = require('fs');
var https = require('https');

var app = express();

const PORT = process.env.PORT || 4010;
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || "uploads");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(uploadDir));

// Rutas
const routes = require("./config/routes");
app.use("/", routes);

const { notFoundHandler, errorHandler } = require("./config/middleware");
app.use(notFoundHandler);

// Manejar errores generales
app.use(errorHandler);

// --- Servidor ---

// Manejar errores no controlados
process.on('uncaughtException', (err) => {
    console.error('Excepción no controlada:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rechazo no manejado:', reason);
    process.exit(1); 
});

// --- Conexión a la Base de Datos ---
mongoose
    .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("Conectado a MongoDB");

        // Leer los certificados SSL
        const options = {
            key: fs.readFileSync('/etc/letsencrypt/live/vps-4136718-x.dattaweb.com/privkey.pem'),
            cert: fs.readFileSync('/etc/letsencrypt/live/vps-4136718-x.dattaweb.com/fullchain.pem')
        };

        https.createServer(options, app).listen(PORT, function(){
            console.log(`Servidor escuchando en puerto ${PORT} en modo ${process.env.NODE_ENV}`);
        });
    })
    .catch((err) => {
        console.error("Error al conectar a MongoDB:", err);
        process.exit(1);
    });