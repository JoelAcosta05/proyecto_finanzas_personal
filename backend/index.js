const express = require("express");
const cors = require("cors");
const prisma = require("./db/prisma");

const app = express();

const { buscarCorreosDelBanco, obtenerContenidoCorreo } = require("./services/gmailService");
const { identificarTipo, extraerDatosLimpios } = require("./services/parserService");
const { clasificarMovimiento } = require("./services/clasificadorService");

app.use(cors());
app.use(express.json()); // ayuda a traer informacion del body (json) o frontend  

app.get("/", (req, res) => {
  res.send("El servidor está funcionando 🎉");
});

app.get("/test-db", async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany();
    res.json({ conectado: true, usuarios });
  } catch (error) {
    res.status(500).json({ conectado: false, error: error.message });
  }
});

app.post("/usuarios", async (req, res) => {
  try {
    const { nombre, correoGmail } = req.body;
    const usuario = await prisma.usuario.create({
      data: { nombre, correoGmail },
    });
    res.json(usuario);
    console.log("usuario creado con exito")
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/movimientos", async (req, res) => {
  try {
    const { usuarioId, tipo, monto, categoria, fecha, descripcion } = req.body;
    const movimiento = await prisma.movimiento.create({
      data: { usuarioId, tipo, monto, categoria, fecha: new Date(fecha), descripcion },
    });
    res.json(movimiento);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/movimientos/:usuarioId", async (req, res) => {
  try {
    const usuarioId = Number(req.params.usuarioId);
    const movimientos = await prisma.movimiento.findMany({
      where: { usuarioId },
      orderBy: { fecha: "desc" },
    });
    res.json(movimientos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/movimientos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { descripcion } = req.body;

    const movimiento = await prisma.movimiento.update({
      where: { id },
      data: { descripcion },
    });

    res.json(movimiento);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/probar-gmail1", async (req, res) => {
  try {
    const correos = await buscarCorreosDelBanco();
    const resultados = [];

    // Para la prueba, definimos tus cuentas (en producción esto vendrá de Prisma)
    const cuentaPrincipal = "3253"; 
    const cuentaFlexible = "9610";

    for (const correo of correos.slice(0, 10)) {
      const contenido = await obtenerContenidoCorreo(correo.id);
      const tipo = identificarTipo(contenido.texto);
      const campos = extraerDatosLimpios(contenido.texto); // Tu nueva función limpia
      
      const categoria = clasificarMovimiento(campos, tipo, cuentaPrincipal, cuentaFlexible);

      // AQUÍ ESTÁ LA SOLUCIÓN: Si es ignorado, saltamos este correo automáticamente
      if (categoria === "ignorado") {
        continue; // Esto hace que no se guarde ni se muestre en el JSON
      }

      resultados.push({ 
        asunto: contenido.asunto, 
        fechaLlegada: contenido.fechaLlegada, 
        tipoDetectado: tipo, 
        categoriaAsignada: categoria,
        campos 
      });
    }

    res.json(resultados);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/sincronizar", async (req, res) => {
  try {
    // 1. Traemos a todos los usuarios de la base de datos (tú y tu familia)
    const usuarios = await prisma.usuario.findMany();
    
    // 2. Leemos los correos
    const correos = await buscarCorreosDelBanco();
    let movimientosGuardados = 0;

    for (const correo of correos) {
      // 3. VALIDACIÓN CLAVE: ¿Ya guardamos este correo antes?
      const existe = await prisma.movimiento.findUnique({
        where: { gmailId: correo.id }
      });
      if (existe) continue; // Si ya existe, saltamos al siguiente correo

      const contenido = await obtenerContenidoCorreo(correo.id);
      const tipo = identificarTipo(contenido.texto);
      
      // Opcional: El detalle visual que te mencioné para que no salga "desconocido"
      const tipoFinal = contenido.asunto.includes("TARJETAS DE CREDITO") ? "pago_tarjeta" : tipo;

      const campos = extraerDatosLimpios(contenido.texto);

      if (!campos.cuentaOrigen) continue; // Si no hay cuenta origen, no podemos procesarlo

      // 4. Buscar a qué usuario de la familia le pertenece este movimiento
      const usuario = usuarios.find(u => 
        (u.cuentaPrincipal && campos.cuentaOrigen.includes(u.cuentaPrincipal.slice(-3))) ||
        (u.cuentaFlexible && campos.cuentaOrigen.includes(u.cuentaFlexible.slice(-3)))
      );

      if (!usuario) continue; // Si la cuenta no coincide con nadie de la BD, lo ignoramos

      // 5. Clasificar el movimiento con las reglas que creamos
      const categoria = clasificarMovimiento(campos, tipoFinal, usuario.cuentaPrincipal, usuario.cuentaFlexible);

      if (categoria === "ignorado") continue;

      // 6. Guardar finalmente en PostgreSQL
      await prisma.movimiento.create({
        data: {
          usuarioId: usuario.id,
          tipo: tipoFinal,
          monto: campos.monto,
          categoria: categoria,
          fecha: new Date(contenido.fechaLlegada), // Usamos la fecha de llegada del correo
          descripcion: campos.beneficiario || "Movimiento Banco Pichincha", 
          gmailId: correo.id // Guardamos el ID para no volver a registrarlo mañana
        }
      });

      movimientosGuardados++;
    }

    res.json({ 
      exito: true, 
      mensaje: `Sincronización completada. Se registraron ${movimientosGuardados} movimientos nuevos.` 
    });

  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
