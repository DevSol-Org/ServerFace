function notFoundHandler(req, res, next) {
  const error = new Error("Not Found");
  error.status = 404;
  next(error); // Pass the error to the next middleware
}

function errorHandler(err, req, res, next) { 
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  console.error(err); 

  // Customized error response for better debugging
  const errorResponse = {
    error: {
      message: message,
    },
  };

  // Include additional error details in development mode
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