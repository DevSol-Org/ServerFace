const express = require("express");
const router = express.Router();

const userRoutes = require("./user.routes");
const validationRoutes = require("./validation.routes");
const fileRoutes = require("./files.routes");
const webhookRoutes = require("./webhook.routes");

router.use("/usuarios", userRoutes);  
router.use("/validar", validationRoutes); 
router.use("/uploads", fileRoutes);     
router.use("/webhook", webhookRoutes);  

module.exports = router; 