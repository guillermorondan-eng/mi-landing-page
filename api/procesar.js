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
        // --- DEBUG TEMPORAL ---
        console.log("KEY STATUS:", process.env.GEMINI_API_KEY 
            ? `Presente - empieza con: ${process.env.GEMINI_API_KEY.substring(0, 8)}...` 
            : "UNDEFINED O VACÍA");
        console.log("Archivo recibido:", isFileReceived);
        console.log("Buffer size:", fileBuffer ? fileBuffer.length : "null");
        console.log("MimeType:", mimeType);
        // --- FIN DEBUG ---

        if (!isFileReceived || !fileBuffer) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        try {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error("La variable de entorno GEMINI_API_KEY no está configurada.");
            }

            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
            console.error("Error detallado:", error);
            return res.status(500).json({ 
                error: "Error en el procesamiento", 
                detalles: error.message 
            });
        }
    });

    req.pipe(busboy);
};
