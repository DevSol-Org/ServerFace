require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

const PORT = process.env.PORT || 4010;
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || "uploads");

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(uploadDir));

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

// Conexión a la base de datos
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log("Conectado a MongoDB");

  // Escuchar en el puerto y dirección especificados
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en puerto ${PORT} en modo ${process.env.NODE_ENV}`);
  });
})
.catch((err) => {
  console.error("Error al conectar a MongoDB:", err);
  process.exit(1);
});

// Importar rutas y configuraciones de la aplicación
const routes = require("./config/routes");
app.use("/", routes);