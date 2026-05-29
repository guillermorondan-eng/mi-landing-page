const { GoogleGenAI } = require('@google/genai');
const Busboy = require('busboy');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let mimeType = "";

    busboy.on('file', (fieldname, file, info) => {
        mimeType = info.mimeType;
        const chunks = [];
        file.on('data', (data) => chunks.push(data));
        file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });

    busboy.on('finish', async () => {
        if (!fileBuffer) return res.status(400).json({ error: 'No se recibió archivo' });

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: fileBuffer.toString("base64")
                        }
                    },
                    "Extrae de esta factura los siguientes datos en formato JSON: RUT, monto total, impuestos y nombre del emisor."
                ],
            });

            return res.status(200).json({ resultado: response.text });
        } catch (error) {
            return res.status(500).json({ error: "Error en la IA", detalles: error.message });
        }
    });

    req.pipe(busboy);
};
