require("dotenv").config();

const express = require('express');
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require('fs');
const https = require('https');

const app = express();

const PORT = process.env.PORT || 4010;
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || "uploads");

// Middleware
app.use(cors());  // Enable CORS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(uploadDir));

// Routes
const routes = require("./config/routes");
app.use("/", routes);

// Error Handling Middleware
const { notFoundHandler, errorHandler } = require("./config/middleware");
app.use(notFoundHandler); // 404 handler
app.use(errorHandler);     // General error handler

// --- HTTPS Server Setup ---
const httpsOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/vps-4136718-x.dattaweb.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/vps-4136718-x.dattaweb.com/fullchain.pem')
};

const server = https.createServer(httpsOptions, app); // Create HTTPS server

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log("Connected to MongoDB");

        // Start the server after successful DB connection
        server.listen(PORT, () => {
            console.log(`Server listening on port ${PORT} in ${process.env.NODE_ENV} mode`);
        });
    })
    .catch(err => {
        console.error("Error connecting to MongoDB:", err);
        process.exit(1);
    });

// --- Error Handling for the Server ---
server.on('error', (err) => {
    console.error('Server error:', err);
});