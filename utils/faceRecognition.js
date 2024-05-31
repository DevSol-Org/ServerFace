const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;
const path = require('path');

// Configuración para utilizar canvas con face-api.js
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// Ruta a los modelos (ajusta si es necesario)
const modelPath = path.join(__dirname, '../modelos');

// Promesa para verificar si los modelos están cargados
let modelosCargados = false;
const promesaCargaModelos = (async () => {
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
      faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath)
    ]);
    console.log("Modelos de face-api.js cargados correctamente");
    modelosCargados = true;
  } catch (err) {
    console.error("Error al cargar los modelos de face-api.js:", err);
    throw new Error("Error al cargar los modelos de reconocimiento facial. Verifica la ruta y los archivos de los modelos."); 
  }
})();

async function extraerDescriptoresFaciales(imagenBuffer) {
  try {
    // Esperamos a que los modelos se carguen antes de continuar
    await promesaCargaModelos;

    // Cargar y preparar la imagen (Buffer recibido)
    const img = await canvas.loadImage(imagenBuffer);

    // Detectar rostros y extraer descriptores
    const detecciones = await faceapi
      .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })) 
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detecciones.length === 0) {
      throw new Error("No se detectaron rostros en la imagen.");
    } else if (detecciones.length > 1) {
      throw new Error("Se detectaron múltiples rostros en la imagen. Por favor, proporciona una imagen con un solo rostro.");
    }

    return detecciones[0].descriptor;
  } catch (err) {
    console.error("Error en el reconocimiento facial:", err);
    throw err;
  }
}

module.exports = extraerDescriptoresFaciales;