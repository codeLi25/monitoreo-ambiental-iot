
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  // SOLO PERMITIR GET Y POST
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({
      error: "Metodo no permitido"
    });
  }

  // CONSULTAR MEDICIONES
  if (req.method === "GET") {

    // Si se solicita historial, devolver varios registros
    if (req.query.historial === "true") {

      const periodo = req.query.periodo || "1h";

      const periodos = {
        "1h": 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000
      };

      if (!periodos[periodo]) {
        return res.status(400).json({
          error: "Periodo no valido"
        });
      }

      const desde = new Date(
        Date.now() - periodos[periodo]
      ).toISOString();

      const { data, error } = await supabase
        .from("mediciones")
        .select("id, temperatura, humedad, fecha")
        .gte("fecha", desde)
        .order("fecha", { ascending: false })
        .limit(1000);

      if (error) {
        console.error("Error al consultar historial:", error);
        return res.status(500).json({
          error: "Error al consultar historial"
        });
      }

      // Devolver registros ordenados del más antiguo
      // al más reciente para las gráficas
      return res.status(200).json(
        (data || []).reverse()
      );
    }

    // MANTENER CONSULTA DE ULTIMA MEDICION
    const { data, error } = await supabase
      .from("mediciones")
      .select("temperatura, humedad, fecha")
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error al consultar medicion:", error);
      return res.status(500).json({
        error: "Error al consultar mediciones"
      });
    }

    return res.status(200).json(data ?? {});
  }

  // AUTORIZACION PARA EL ESP32
  const clave = req.headers["x-api-key"];

  if (
    !process.env.ESP32_API_KEY ||
    clave !== process.env.ESP32_API_KEY
  ) {
    return res.status(401).json({
      error: "No autorizado"
    });
  }

  // VALIDAR DATOS DEL SENSOR
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

  // GUARDAR MEDICION EN SUPABASE
  const { error } = await supabase
    .from("mediciones")
    .insert([{ temperatura, humedad }]);

  if (error) {
    console.error("Error al guardar medicion:", error);
    return res.status(500).json({
      error: "Error al guardar medicion"
    });
  }

  return res.status(201).json({
    mensaje: "Medicion guardada correctamente"
  });
}
