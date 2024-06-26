function notFoundHandler(req, res, next) {
    const error = new Error("Ruta no encontrada");
    error.status = 404;
    next(error);
}

function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    const message = err.message || "Error interno del servidor";

    if (process.env.NODE_ENV !== "production") {
        console.error(err);
    } else {
        console.error("Error interno del servidor:", err.message);
    }

    const errorResponse = {
        error: {
            mensaje: message,
        },
    };

    if (process.env.NODE_ENV !== "production") {
        errorResponse.error.stack = err.stack;
        errorResponse.error.status = status;
    }
    res.status(status).json(errorResponse);
}

module.exports = {
    notFoundHandler,
    errorHandler,
};