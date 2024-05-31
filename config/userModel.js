const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: {  
    type: String,
    required: true
  },
  nombreCompleto: {
    type: String,
    required: true,
  },
  descriptoresFaciales: {
    type: Array,
    required: true,
  },
  correoInstitucional: {
    type: String,
    required: true,
  },
  telefono: {
    type: String,
    required: true,
    validate: {
      validator: (v) => /^\d{10}$/.test(v), // Validar que tenga 10 dígitos
      message: (props) => `${props.value} no es un teléfono válido`,
    },
  },
  cc: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: (v) => /^\d{1,12}$/.test(v), // Validar que tenga entre 1 y 12 dígitos
      message: (props) => `${props.value} no es una cédula válida`,
    },
  },
  imagen: {
    type: String, 
    get: (filename) => `${process.env.BASE_URL}/uploads/${filename}`,
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;