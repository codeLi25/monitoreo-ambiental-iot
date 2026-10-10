
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    // Permitir únicamente GET y POST
    if (req.method !== "GET" && req.method !== "POST") {
        res.setHeader("Allow", "GET, POST");
        return res.status(405).json({
            error: "Metodo no permitido"
        });
    }

    // Consultar la ultima medicion
    if (req.method === "GET") {
        const { data, error } = await supabase
            .from("mediciones")
            .select("temperatura, humedad, fecha")
            .order("fecha", { ascending: false })
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("Error de Supabase al consultar:", {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            });

            return res.status(500).json({
                error: "Error al consultar mediciones"
            });
        }

        return res.status(200).json(data ?? {});
    }

    // Validar la clave enviada por el ESP32
    const clave = req.headers["x-api-key"];

    if (
        !process.env.ESP32_API_KEY ||
        clave !== process.env.ESP32_API_KEY
    ) {
        return res.status(401).json({
            error: "No autorizado"
        });
    }

    // Recibir y validar las mediciones
    const { temperatura, humedad } = req.body ?? {};

    if (
        typeof temperatura !== "number" ||
        typeof humedad !== "number" ||
        !Number.isFinite(temperatura) ||
        !Number.isFinite(humedad) ||
        temperatura < -40 ||
        temperatura > 80 ||
        humedad < 0 ||
        humedad > 100
    ) {
        return res.status(400).json({
            error: "Mediciones invalidas"
        });
    }

    const { error } = await supabase
        .from("mediciones")
        .insert([{ temperatura, humedad }]);

    if (error) {
        return res.status(500).json({
            error: "Error al guardar medicion"
        });
    }

    return res.status(201).json({
        mensaje: "Medicion guardada correctamente"
    });
}
