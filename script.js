
const API = "/api/mediciones";
const LIMITE_RECIENTE = 60000;

let periodoActual = "1h";
let graficaTemperatura;
let graficaHumedad;

function formatoFecha(fecha) {
  return new Date(fecha).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function establecerEstado(texto, clase) {
  document.getElementById("estadoTexto").textContent = texto;

  document.getElementById("puntoEstado").className =
    "punto " + clase;
}

function crearGrafica(id, etiqueta, color) {
  return new Chart(document.getElementById(id), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: etiqueta,
        data: [],
        borderColor: color,
        backgroundColor: color + "22",
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          labels: { color: "#cbd5e1" }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#94a3b8",
            maxTicksLimit: 7
          },
          grid: { color: "#29394f" }
        },
        y: {
          ticks: { color: "#94a3b8" },
          grid: { color: "#29394f" }
        }
      }
    }
  });
}

function actualizarGrafica(grafica, etiquetas, valores) {
  grafica.data.labels = etiquetas;
  grafica.data.datasets[0].data = valores;
  grafica.update("none");
}

async function cargarUltimaMedicion() {
  try {
    const respuesta = await fetch(API, {
      cache: "no-store"
    });

    if (!respuesta.ok) {
      throw new Error("HTTP " + respuesta.status);
    }

    const dato = await respuesta.json();

    if (
      typeof dato.temperatura !== "number" ||
      typeof dato.humedad !== "number"
    ) {
      establecerEstado("Sin mediciones", "inactivo");
      return;
    }

    document.getElementById("temperatura").textContent =
      dato.temperatura.toFixed(1) + " °C";

    document.getElementById("humedad").textContent =
      dato.humedad.toFixed(1) + " %";

    const fecha = new Date(dato.fecha);

    if (isNaN(fecha.getTime())) {
      establecerEstado("Fecha no disponible", "inactivo");
      return;
    }

    document.getElementById("ultimaFecha").textContent =
      formatoFecha(dato.fecha);

    const antiguedad = Date.now() - fecha.getTime();

    if (
      antiguedad >= 0 &&
      antiguedad <= LIMITE_RECIENTE
    ) {
      establecerEstado("ESP32 enviando datos", "activo");
    } else {
      establecerEstado("Últimos datos antiguos", "inactivo");
    }

  } catch (error) {
    console.error("Error de medición:", error);
    establecerEstado("Error de conexión", "inactivo");
  }
}

async function cargarHistorial() {
  try {
    const url = API +
      "?historial=true&periodo=" +
      encodeURIComponent(periodoActual);

    const respuesta = await fetch(url, {
      cache: "no-store"
    });

    if (!respuesta.ok) {
      throw new Error("HTTP " + respuesta.status);
    }

    const registros = await respuesta.json();

    if (!Array.isArray(registros)) {
      throw new Error("Respuesta inválida");
    }

    const validos = registros.filter(r =>
      typeof r.temperatura === "number" &&
      typeof r.humedad === "number" &&
      !isNaN(new Date(r.fecha).getTime())
    );

    const etiquetas = validos.map(r =>
      new Date(r.fecha).toLocaleTimeString("es-PE", {
        timeZone: "America/Lima",
        hour: "2-digit",
        minute: "2-digit"
      })
    );

    const temperaturas = validos.map(r => r.temperatura);
    const humedades = validos.map(r => r.humedad);

    actualizarGrafica(
      graficaTemperatura,
      etiquetas,
      temperaturas
    );

    actualizarGrafica(
      graficaHumedad,
      etiquetas,
      humedades
    );

    actualizarEstadisticas(temperaturas, humedades);
    actualizarTabla(validos);

    document.getElementById("cantidad").textContent =
      validos.length + " registros consultados";

    document.getElementById("avisoHistorial").textContent =
      validos.length === 1000
        ? "La API devuelve hasta 1000 registros. Las estadísticas corresponden a los registros consultados."
        : "";

  } catch (error) {
    console.error("Error de historial:", error);

    document.getElementById("avisoHistorial").textContent =
      "No se pudo consultar el historial.";
  }
}

function actualizarEstadisticas(temperaturas, humedades) {
  if (temperaturas.length === 0) {
    ["tempMin", "tempMax", "tempProm", "humProm"]
      .forEach(id => {
        document.getElementById(id).textContent = "--";
      });
    return;
  }

  const promedio = valores =>
    valores.reduce((a, b) => a + b, 0) / valores.length;

  document.getElementById("tempMin").textContent =
    Math.min(...temperaturas).toFixed(1) + " °C";

  document.getElementById("tempMax").textContent =
    Math.max(...temperaturas).toFixed(1) + " °C";

  document.getElementById("tempProm").textContent =
    promedio(temperaturas).toFixed(1) + " °C";

  document.getElementById("humProm").textContent =
    promedio(humedades).toFixed(1) + " %";
}

function actualizarTabla(registros) {
  const tabla = document.getElementById("tablaMediciones");
  tabla.replaceChildren();

  const ultimos = registros.slice(-20).reverse();

  if (ultimos.length === 0) {
    const fila = tabla.insertRow();
    const celda = fila.insertCell();
    celda.colSpan = 3;
    celda.textContent = "No hay mediciones en este periodo.";
    return;
  }

  ultimos.forEach(r => {
    const fila = tabla.insertRow();

    fila.insertCell().textContent =
      formatoFecha(r.fecha);

    fila.insertCell().textContent =
      r.temperatura.toFixed(1) + " °C";

    fila.insertCell().textContent =
      r.humedad.toFixed(1) + " %";
  });
}

document.querySelectorAll("[data-periodo]").forEach(boton => {
  boton.addEventListener("click", () => {
    periodoActual = boton.dataset.periodo;

    document.querySelectorAll("[data-periodo]")
      .forEach(b => b.classList.remove("seleccionado"));

    boton.classList.add("seleccionado");
    cargarHistorial();
  });
});

graficaTemperatura = crearGrafica(
  "graficaTemperatura",
  "Temperatura (°C)",
  "#fb923c"
);

graficaHumedad = crearGrafica(
  "graficaHumedad",
  "Humedad (%)",
  "#38bdf8"
);

async function actualizarTodo() {
  await Promise.all([
    cargarUltimaMedicion(),
    cargarHistorial()
  ]);
}

actualizarTodo();
setInterval(actualizarTodo, 10000);
