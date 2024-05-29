require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");

// --- Crear la aplicación Express --- 
const app = express();

const PORT = process.env.PORT || 4010;
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || "uploads");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(uploadDir));


// Rutas
const routes = require("./config/routes");
const {notFoundHandler, errorHandler} = require("./config/middleware");
app.use("/", routes)


app.use(notFoundHandler);

// Manejar errores generales
app.use(errorHandler);


// --- Servidor ---


// Manejar errores no controlados
process.on('uncaughtException', (err) => {
    console.error('Excepción no controlada:', err);
    process.exit(1); // Salir del proceso con código de error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Rechazo no manejado:', reason);
    process.exit(1); // Salir del proceso con código de error
});

// --- Conexión a la Base de Datos ---
mongoose
    .connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("Conectado a MongoDB");

        app.listen(PORT, () => {
            console.log(`Servidor en puerto ${PORT} en modo ${process.env.NODE_ENV}`);
        });

    })
    .catch((err) => {
        console.error("Error al conectar a MongoDB:", err);
        process.exit(1);
    });