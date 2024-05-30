const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;
const path = require('path');

// Configuración para utilizar canvas con face-api.js
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

async function extraerDescriptoresFaciales(imagenBuffer) {
  try {
    // Cargar modelos de reconocimiento faciales
    const modelPath = path.join(__dirname, 'modelos');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);

    // Cargar y preparar la imagen (Buffer recibido)
    const img = await canvas.loadImage(imagenBuffer);

    // Detectar rostros y extraer descriptores
    const detecciones = await faceapi
      .detectAllFaces(img)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detecciones.length === 0) {
      throw new Error("No se detectaron rostros en la imagen.");
    }

    return detecciones[0].descriptor;
  } catch (err) {
    console.error("Error en el reconocimiento facial:", err);
    throw err; 
  }
}

module.exports = extraerDescriptoresFaciales;
