const clasificarMovimiento = (datos, tipo, cuentaPrincipal, cuentaFlexible) => {
  // 1. Retiros y pagos de servicios siempre son gastos
  if (tipo === "retiro_sin_tarjeta" || tipo === "pago_servicio") return "gasto";
  if (html.includes("PAGO TARJETAS DE CREDITO")) return "pago_tarjeta";

  const origen = datos.cuentaOrigen || "";
  const destino = datos.cuentaDestino || "";

  // 2. Traspasos internos (solo si el usuario tiene cuenta flexible)
  if (cuentaFlexible) {
    // Principal a Flexible -> Ganancia
    if (origen.includes(cuentaPrincipal.slice(-3)) && destino.includes(cuentaFlexible.slice(-3))) {
      return "ganancia";
    }
    // Flexible a Principal -> IGNORADO (solo estás moviendo plata para pagar después)
    if (origen.includes(cuentaFlexible.slice(-3)) && destino.includes(cuentaPrincipal.slice(-3))) {
      return "ignorado"; 
    }
  }

  // 3. Cualquier transferencia a un TERCERO, ya sea que salga de la principal o de la flexible -> Gasto
  const saleDePrincipal = origen.includes(cuentaPrincipal.slice(-3));
  const saleDeFlexible = cuentaFlexible ? origen.includes(cuentaFlexible.slice(-3)) : false;

  if (saleDePrincipal || saleDeFlexible) {
    return "gasto";
  }

  return "desconocido";
};

module.exports = { clasificarMovimiento };