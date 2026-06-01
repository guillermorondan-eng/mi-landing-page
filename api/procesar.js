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

            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            
            // CONFIGURACIÓN: Usamos el modelo con soporte de visión que tienes habilitado en tu lista
            const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

            // Traemos las instrucciones exactas y detalladas que tenías en Google Sheets
            const promptInstrucciones = "Analiza la imagen o PDF adjunto. Puede contener UNA o VARIAS facturas/comprobantes. " +
                                        "Extrae los siguientes campos de CADA COMPROBANTE visible: proveedor, rut, fecha, numero, baseImponible, impuesto, total, moneda, categoria. " +
                                        "Para el campo 'rut', busca el número de RUT, Identificación Fiscal o NIT del proveedor. " +
                                        "Para el campo 'categoria', debes clasificar el gasto en una de las siguientes opciones según el rubro del proveedor: " +
                                        "['Repuestos y Herramientas', 'Servicios Públicos', 'Combustible y Viajes', 'Insumos de Oficina', 'Mantenimiento', 'Alimentación', 'Otros']. " +
                                        "Si no estás seguro, elige la que mejor se adapte o pon 'Otros'. " +
                                        "Debes devolver la respuesta ÚNICAMENTE en formato JSON plano dentro de un arreglo/lista, sin bloques de código markdown, sin saltos de línea. " +
                                        "Formato requerido: [{\"proveedor\":\"...\", \"rut\":\"...\", \"fecha\":\"...\", \"numero\":\"...\", \"baseImponible\":0.00, \"impuesto\":0.00, \"total\":0.00, \"moneda\":\"...\", \"categoria\":\"...\"}]. " +
                                        "Si un campo no es visible o no aplica, pon 'N/A'.";

            const result = await model.generateContent([
                {
                    inlineData: {
                        data: fileBuffer.toString("base64"),
                        mimeType: mimeType
                    }
                },
                promptInstrucciones
            ]);

            const response = await result.response;
            const textoIa = response.text();
            
            // LAZO DE LIMPIEZA: Eliminamos marcas de Markdown ```json ... ``` si la IA las genera
            const jsonLimpio = textoIa.replace(/```json/g, "").replace(/```/g, "").trim();
            
            // Parseamos el texto para convertirlo en un objeto nativo de JavaScript
            const listaFacturas = JSON.parse(jsonLimpio);

            // Devolvemos el JSON estructurado directo al Frontend
            return res.status(200).json({ status: "SUCCESS", facturas: listaFacturas });

        } catch (error) {
            console.error("Error detallado:", error);
            return res.status(500).json({ 
                status: "ERROR",
                error: "Error en el procesamiento del lazo", 
                detalles: error.message 
            });
        }
    });

    req.pipe(busboy);
};
