require("dotenv").config();
const { google } = require("googleapis");

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

const buscarCorreosDelBanco = async () => {
  const respuesta = await gmail.users.messages.list({
    userId: "me",
    q: "from:banco@pichincha.com",
    maxResults: 20,
  });

  return respuesta.data.messages || [];
};


// Trae el contenido completo de UN correo, buscando específicamente la parte HTML
const obtenerContenidoCorreo = async (id) => {
  const respuesta = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });

  const payload = respuesta.data.payload;

  // Los correos del banco suelen tener anidaciones. Esta función busca el HTML de forma segura.
  const buscarHtml = (partes) => {
    if (!partes) return null;
    for (const parte of partes) {
      if (parte.mimeType === "text/html") return parte.body.data;
      if (parte.parts) {
        const html = buscarHtml(parte.parts);
        if (html) return html;
      }
    }
    return null;
  };

  // Extraemos el cuerpo en base64 buscando la parte HTML
  let cuerpoBase64 = buscarHtml(payload.parts) || payload.body?.data || "";

  // Google usa 'base64url' (cambia + por - y / por _). Hay que normalizarlo antes de decodificar.
  const textoHtml = cuerpoBase64
    ? Buffer.from(cuerpoBase64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    : "";

  return {
    id,
    fechaLlegada: new Date(Number(respuesta.data.internalDate)), 
    asunto: payload.headers.find((h) => h.name === "Subject")?.value || "",
    texto: textoHtml,
  };
};

module.exports = { buscarCorreosDelBanco, obtenerContenidoCorreo };