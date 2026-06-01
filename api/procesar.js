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
            const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

            // Prompt optimizado con instrucciones estrictas de comillas para evitar rupturas de sintaxis
            const promptInstrucciones = "Analiza la imagen o PDF adjunto. Puede contener UNA o VARIAS facturas/comprobantes. " +
                                        "Extrae los siguientes campos de CADA COMPROBANTE visible: proveedor, rut, fecha, numero, baseImponible, impuesto, total, moneda, categoria. " +
                                        "Para el campo 'rut', busca el número de RUT, Identificación Fiscal o NIT del proveedor. " +
                                        "Para el campo 'categoria', debes clasificar el gasto en una de las siguientes opciones según el rubro del proveedor: " +
                                        "['Repuestos y Herramientas', 'Servicios Públicos', 'Combustible y Viajes', 'Insumos de Oficina', 'Mantenimiento', 'Alimentación', 'Otros']. " +
                                        "Si no estás seguro, elige la que mejor se adapte o pon 'Otros'. " +
                                        "Debes devolver la respuesta ÚNICAMENTE en formato JSON plano dentro de un arreglo/lista, sin bloques de código markdown, sin saltos de línea. " +
                                        "Formato requerido obligatorio: [{\"proveedor\":\"...\", \"rut\":\"...\", \"fecha\":\"...\", \"numero\":\"...\", \"baseImponible\":0.00, \"impuesto\":0.00, \"total\":0.00, \"moneda\":\"...\", \"categoria\":\"...\"}]. " +
                                        "CRÍTICO: Si un campo de texto no es visible, ponlo entre comillas como \"N/A\". Si un campo numérico como baseImponible o impuesto no es visible, pon 0.00 (NUNCA dejes texto suelto sin comillas).";

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
            
            // 1. Limpieza estándar de bloques markdown
            let jsonLimpio = textoIa.replace(/```json/g, "").replace(/```/g, "").trim();
            
            // 2. FILTRO ANTI-FALLAS: Si la IA metió N/A sueltos sin comillas en los números, los corregimos a 0.00
            jsonLimpio = jsonLimpio.replace(/:\s*N\/A/g, ': "N/A"'); // Pone comillas si quedó suelto en textos
            jsonLimpio = jsonLimpio.replace(/:\s*([^"\d\[\{]\s*[^"\d\]\}]+)/g, ': 0.00'); // Si metió basura en los campos numéricos lo plancha a cero para que no rompa el JSON

            // Parseamos de forma segura
            const listaFacturas = JSON.parse(jsonLimpio);

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
