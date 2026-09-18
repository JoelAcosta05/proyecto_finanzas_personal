const cheerio = require("cheerio");

const identificarTipo = (html) => {
  if (html.includes("Retiro sin tarjeta")) return "retiro_sin_tarjeta";
  if (html.includes("Pago de servicios")) return "pago_servicio";
  if (html.includes("¡Transferencia exitosa!")) return "transferencia_interna";
  if (html.includes("TRANSFERENCIA")) return "transferencia_externa";
  return "desconocido";
};

// 1. Extrae TODO en crudo (tu función actual)
const extraerCamposBrutos = (html) => {
  const htmlConSaltos = html.replace(/<br\s*\/?>/gi, "\n");
  const $ = cheerio.load(htmlConSaltos);
  const campos = {};
  let seccionActual = "";

  $("tr").each((i, fila) => {
    // EL CAMBIO CLAVE: .children() en lugar de .find() para evitar tablas anidadas
    const celdas = $(fila).children("td");
    
    if (celdas.length !== 2) return; 

    const etiquetas = $(celdas[0]).text().split("\n").map((t) => t.trim());
    const valores = $(celdas[1]).text().split("\n").map((t) => t.trim());

    etiquetas.forEach((etiqueta, idx) => {
      const valor = valores[idx] || "";
      if (!etiqueta) return;

      if (!valor && !etiqueta.includes(":")) {
        seccionActual = etiqueta;
        return;
      }
      if (valor) {
        const clave = seccionActual ? `${seccionActual} - ${etiqueta}` : etiqueta;
        campos[clave] = valor;
      }
    });
  });

  return campos;
};

// 2. NUEVA FUNCIÓN: Filtra y limpia para dejar solo lo esencial
const normalizarCampos = (camposBrutos) => {
  const datosLimpios = {};

  for (const [clave, valor] of Object.entries(camposBrutos)) {
    const claveMin = clave.toLowerCase();

    // Monto (limpia símbolos de $ o USD para dejar solo el número)
    if (claveMin.includes("monto") || (claveMin.includes("valor total") && !claveMin.includes("comisión"))) {
      datosLimpios.monto = Number(valor.replace(/[^\d.-]/g, '').trim());
    }
    // Cuenta de Origen
    else if (claveMin.includes("cuenta de origen") || claveMin.includes("cuenta a debitar") || claveMin.includes("cuenta de débito") || claveMin === "cuenta:") {
      datosLimpios.cuentaOrigen = valor.replace(/\D/g, '').slice(-4); // Guarda solo los últimos 4 números
    }
    // Cuenta Destino
    else if (claveMin.includes("cuenta destino - número") || claveMin.includes("cuenta acreditada")) {
      datosLimpios.cuentaDestino = valor.replace(/\D/g, '').slice(-4);
    }
    // Fecha
    else if (claveMin.includes("fecha")) {
      datosLimpios.fecha = valor;
    }
    // Beneficiario o Empresa (útil para la descripción en la app)
    else if (claveMin.includes("empresa") || claveMin.includes("nombre del beneficiario") || claveMin.includes("cuenta destino - nombre")) {
      datosLimpios.beneficiario = valor;
    }
  }

  return datosLimpios;
};

// 3. Función principal que exportarás
const extraerDatosLimpios = (html) => {
  const camposBrutos = extraerCamposBrutos(html);
  return normalizarCampos(camposBrutos);
};

module.exports = { identificarTipo, extraerDatosLimpios };