require("dotenv").config(); 

const express = require("express");
const morgan = require("morgan");  
const helmet = require("helmet"); 

const app = express();

if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev")); 
} else {
    app.use(morgan('combined')); 
}

app.use(helmet()); 
app.use(express.json());           
app.use(express.urlencoded({ extended: true }));

const routes = require("./routes");
app.use("/api", routes); 

app.use((req, res, next) => {
    const error = new Error("Not Found");
    error.status = 404;
    next(error);
});

app.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    res.status(statusCode).json({
        error: {
            message: err.message,
            // process.env.NODE_ENV === "development" ? { stack: err.stack } : {}
        },
    });
});

module.exports = app;