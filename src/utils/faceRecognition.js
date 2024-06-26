const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;
const path = require('path');

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const modelPath = path.resolve(__dirname, '../models'); 

(async () => {
  try {
    console.log('Cargando modelos de face-api.js...');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
    console.log('✅ Modelos de face-api.js cargados correctamente');
  } catch (err) {
    console.error('❌ Error al cargar los modelos de face-api.js:', err);
    process.exit(1);
  }
})();

async function extraerDescriptoresFaciales(imagenBuffer) {
  try {
    const img = await canvas.loadImage(imagenBuffer);
    const detections = await faceapi
      .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.7 })) 
      .withFaceLandmarks()
      .withFaceDescriptors();
    if (!detections) {
      throw new Error("No se detectó ningún rostro en la imagen.");
    }
    return detections.descriptor;
  } catch (err) {
    console.error("Error en el reconocimiento facial:", err);
    throw err; 
  }
}

module.exports = extraerDescriptoresFaciales;