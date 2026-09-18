require("dotenv").config();
const { google } = require("googleapis");
const readline = require("readline");

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "urn:ietf:wg:oauth:2.0:oob" // le dice a Google que no hay una web esperando la respuesta, la vamos a pegar a mano
);

// permiso solo para leer, para nada mas 
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline", // necesario para que Google nos dé el refresh token
  scope: SCOPES,
});

console.log("Abre esta URL en tu navegador y autoriza el acceso:");
console.log(authUrl);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("Pega aquí el código que te dio Google: ", async (code) => {
  const { tokens } = await oAuth2Client.getToken(code);
  console.log("\nGuarda esto en tu .env como GOOGLE_REFRESH_TOKEN:");
  console.log(tokens.refresh_token);
  rl.close();
});