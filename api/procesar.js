const { GoogleGenAI } = require('@google/genai');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const { archivo, tipo } = req.body;

        if (!archivo) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    inlineData: {
                        mimeType: tipo || "application/pdf",
                        data: archivo
                    }
                },
                "Extrae de esta factura los siguientes datos en formato JSON: RUT, monto total, impuestos y nombre del emisor."
            ],
        });

        return res.status(200).json({ 
            mensaje: "Procesado por Gemini con éxito", 
            resultado: response.text 
        });

    } catch (error) {
        return res.status(500).json({ 
            error: "Error en el procesamiento de la IA", 
            detalles: error.message 
        });
    }
};
