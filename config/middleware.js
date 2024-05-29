function notFoundHandler(req, res, next) {
  const error = new Error("Ruta no encontrada");
  error.status = 404;
  next(error);
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || "Error interno del servidor";
  const isDevelopment = process.env.NODE_ENV === "development";

  // Registrar el error en la consola
  console.error(err);

  res.status(status).json({
      error: {
          message,
          ...(isDevelopment ? {stack: err.stack} : {}),
      },
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
}