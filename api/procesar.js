export default async function handler(req, res) {
  // 1. Solo permitimos el método POST (envío de archivos)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // 2. Aquí recibiremos la imagen o PDF
    // En un sistema real, aquí procesarías el archivo y llamarías a la API de IA
    // Por ahora, simulamos que el "PLC" recibió el archivo y lo está analizando
    
    console.log("Archivo recibido en el PLC (Serverless Function)");

    // Simulación de respuesta del motor lógico
    return res.status(200).json({ 
      mensaje: "Factura recibida y procesada por el PLC",
      estado: "Completado" 
    });

  } catch (error) {
    return res.status(500).json({ error: "Error en el procesamiento del PLC" });
  }
}
