const mongoose = require("mongoose");
const mongoURI = process.env.MONGODB_URI;

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.catch((err) => {
  process.exit(1);
});