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

            // Prompt calibrado: Letra incluida en número + columna RUC explícita
            const promptInstrucciones = "Analiza la imagen o PDF adjunto. Puede contener UNA o VARIAS facturas/comprobantes. " +
                                        "Extrae los siguientes campos de CADA COMPROBANTE visible: proveedor, rut, ruc, fecha, numero, baseImponible, impuesto, total, moneda, categoria. " +
                                        "Para el campo 'rut', busca el número de RUT o Identificación Fiscal del receptor o emisor según aplique. " +
                                        "Para el campo 'ruc', busca específicamente el número de RUC si figura explícitamente en el documento. " +
                                        "Para el campo 'numero', debes incluir OBLIGATORIAMENTE la LETRA del tipo de factura (por ejemplo: A-0001-00001234, B-5432, E-123, etc.). Si la letra está en otra parte del documento, búscala y anteponla al número. " +
                                        "Para el campo 'categoria', clasifica el gasto en: ['Repuestos y Herramientas', 'Servicios Públicos', 'Combustible y Viajes', 'Insumos de Oficina', 'Mantenimiento', 'Alimentación', 'Otros']. " +
                                        "Debes devolver la respuesta ÚNICAMENTE en formato JSON plano dentro de un arreglo/lista, sin bloques de código markdown, sin saltos de línea. " +
                                        "Formato requerido obligatorio: [{\"proveedor\":\"...\", \"rut\":\"...\", \"ruc\":\"...\", \"fecha\":\"...\", \"numero\":\"...\", \"baseImponible\":0.00, \"impuesto\":0.00, \"total\":0.00, \"moneda\":\"...\", \"categoria\":\"...\"}]. " +
                                        "CRÍTICO: Si un campo de texto no es visible, ponlo entre comillas como \"N/A\". Si un campo numérico no es visible, pon 0.00 (NUNCA dejes texto suelto sin comillas).";

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
            
            let jsonLimpio = textoIa.replace(/```json/g, "").replace(/```/g, "").trim();
            
            // Filtro anti-fallas para limpiar la respuesta
            jsonLimpio = jsonLimpio.replace(/:\s*N\/A/g, ': "N/A"'); 
            jsonLimpio = jsonLimpio.replace(/:\s*([^"\d\[\{]\s*[^"\d\]\}]+)/g, ': 0.00'); 

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
