function notFoundHandler(req, res, next) {
  const error = new Error("Not Found");
  error.status = 404;
  next(error);
}

function errorHandler(err, req, res, next) { 
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  console.error(err); 
  const errorResponse = {
    error: {
      message: message,
    },
  };

  if (process.env.NODE_ENV === "production") {
    errorResponse.error.stack = err.stack; 
    errorResponse.error.status = status;
  }
  res.status(status).json(errorResponse);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};