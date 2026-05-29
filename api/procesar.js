const { GoogleGenerativeAI } = require("@google/generative-ai");
const Busboy = require("busboy");

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

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
        if (!fileBuffer) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        try {
            // Inicialización correcta de la IA
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            // Enviamos el archivo como datos en línea y la instrucción
            const result = await model.generateContent([
                {
                    inlineData: {
                        data: fileBuffer.toString("base64"),
                        mimeType: mimeType
                    }
                },
                "Extrae de esta factura los siguientes datos en formato JSON: RUT, monto total, impuestos y nombre del emisor."
            ]);

            const response = await result.response;
            return res.status(200).json({ resultado: response.text() });

        } catch (error) {
            return res.status(500).json({ 
                error: "Error en el procesamiento de la IA", 
                detalles: error.message 
            });
        }
    });

    req.pipe(busboy);
};
