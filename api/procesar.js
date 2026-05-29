const { GoogleGenerativeAI } = require("@google/generative-ai");
const Busboy = require("busboy");

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let mimeType = "";
    let isFileReceived = false;

    busboy.on('file', (fieldname, file, info) => {
        isFileReceived = true;
        mimeType = info.mimeType;
        const chunks = [];
        file.on('data', (data) => chunks.push(data));
        file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });

    busboy.on('finish', async () => {
        if (!isFileReceived || !fileBuffer) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        try {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error("La variable de entorno GEMINI_API_KEY no está configurada.");
            }

           const genAI = new GoogleGenerativeAI("AIzaSyCys3zgiN3izn7PiOoI-3wvAiwNajaTFaw");
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            const result = await model.generateContent([
                {
                    inlineData: {
                        data: fileBuffer.toString("base64"),
                        mimeType: mimeType
                    }
                },
                "Extrae de esta factura los siguientes datos en formato JSON: RUT, monto total, impuestos y nombre del emisor. Responde solo con el JSON."
            ]);

            const response = await result.response;
            return res.status(200).json({ resultado: response.text() });

        } catch (error) {
            console.error("Error detallado:", error); // Esto aparecerá en los logs de Vercel
            return res.status(500).json({ 
                error: "Error en el procesamiento", 
                detalles: error.message 
            });
        }
    });

    req.pipe(busboy);
};
