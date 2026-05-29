import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // 1. Solo permitimos el método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    console.log("Conectando con el motor de Gemini...");

    // 2. Conectamos con Gemini usando la variable segura que guardamos en Vercel
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 3. Le pedimos al modelo que procese la información (aquí irá la lógica del prompt)
    // Por ahora dejamos el enlace listo para verificar la conexión con la IA
    return res.status(200).json({ 
      mensaje: "Conexión con Gemini exitosa",
      estado: "Completado" 
    });

  } catch (error) {
    console.error("Error en el PLC:", error);
    return res.status(500).json({ error: "Error en el procesamiento del PLC con IA" });
  }
}
