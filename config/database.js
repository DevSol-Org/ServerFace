require("dotenv").config();
const mongoose = require("mongoose");

const mongoURI = process.env.MONGODB_URI;

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB Connected!", "⚙️ Working...");
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

module.exports = mongoose.connection;