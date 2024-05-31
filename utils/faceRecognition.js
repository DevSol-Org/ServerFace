const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;
const path = require('path');

// Configuración para utilizar canvas con face-api.js
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// Ruta a los modelos
const modelPath = path.join(__dirname, '../modelos');

// Promesa para verificar si los modelos están cargados
let modelosCargados = false;
const promesaCargaModelos = (async () => {
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
    console.log("Modelos de face-api.js cargados correctamente");
    modelosCargados = true;
  } catch (err) {
    console.error("Error al cargar los modelos de face-api.js:", err);
    throw err;
  }
})();

async function extraerDescriptoresFaciales(imagenBuffer) {
  try {
    await promesaCargaModelos; 

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