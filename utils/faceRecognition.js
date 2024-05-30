const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;
const path = require('path');

// Configuración para utilizar canvas con face-api.js
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// Ruta a los modelos
const modelPath = path.join(__dirname, 'modelos');

// Cargar modelos de reconocimiento facial una sola vez
async function cargarModelos() {
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
  ]);
}

// Inicializar la carga de los modelos
cargarModelos().catch(err => {
  console.error("Error al cargar los modelos de face-api.js:", err);
});

async function extraerDescriptoresFaciales(imagenBuffer) {
  try {
    // Asegurarse de que los modelos se han cargado antes de procesar la imagen
    if (!faceapi.nets.ssdMobilenetv1.isLoaded || 
        !faceapi.nets.faceLandmark68Net.isLoaded || 
        !faceapi.nets.faceRecognitionNet.isLoaded) {
      throw new Error("Los modelos no están cargados correctamente.");
    }

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

    return detecciones.map(d => d.descriptor);
  } catch (err) {
    console.error("Error en el reconocimiento facial:", err);
    throw err; 
  }
}

module.exports = extraerDescriptoresFaciales;