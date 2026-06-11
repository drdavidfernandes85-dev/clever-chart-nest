/**
 * Maps Trading Layer / MT5 broker responses to actionable Spanish messages.
 * Used by the docked order ticket and (later) the order modal.
 * Never returns a generic "failed" string — every known retcode has its own line.
 */
export interface BrokerErrorInput {
  retcode?: number | null;
  retcodeName?: string | null;
  retcodeDescription?: string | null;
  brokerMessage?: string | null;
  error?: string | null;
  status?: string | null;
  reason?: string | null;
}

// MT5 TRADE_RETCODE_* canonical map (MetaQuotes docs).
const MT5_MAP: Record<number, string> = {
  10004: "Recotización: el precio cambió antes de ejecutar. Intenta de nuevo.",
  10006: "Solicitud rechazada por el bróker.",
  10007: "Solicitud cancelada por el operador.",
  10008: "Orden pendiente colocada (no ejecutada todavía).",
  10009: "Operación ejecutada correctamente.",
  10010: "Solo se ejecutó parcialmente la solicitud.",
  10011: "Error de procesamiento de la solicitud en el bróker.",
  10012: "Solicitud expirada por tiempo de espera.",
  10013: "Solicitud inválida.",
  10014: "Volumen inválido para este símbolo (revisa mínimo, máximo o paso).",
  10015: "Precio inválido para esta orden.",
  10016: "Stops inválidos: SL o TP están del lado equivocado o demasiado cerca del precio.",
  10017: "Operativa deshabilitada en el bróker para esta cuenta o símbolo.",
  10018: "Mercado cerrado.",
  10019: "Fondos insuficientes para abrir la posición (margen no disponible).",
  10020: "El precio cambió: requote del bróker.",
  10021: "No hay cotizaciones disponibles para procesar la solicitud.",
  10022: "Fecha de expiración inválida en la orden.",
  10023: "Estado de orden inválido.",
  10024: "Demasiadas solicitudes — intenta más tarde.",
  10025: "Sin cambios en la solicitud.",
  10026: "Autotrading deshabilitado por el servidor.",
  10027: "Autotrading deshabilitado por el cliente.",
  10028: "Solicitud bloqueada para procesamiento.",
  10029: "La orden o posición está congelada.",
  10030: "Tipo de llenado (filling) inválido para este símbolo.",
  10031: "Sin conexión con el servidor de operaciones.",
  10032: "Operación permitida solo para cuentas en vivo.",
  10033: "Número máximo de órdenes pendientes alcanzado.",
  10034: "Volumen total máximo de órdenes y posiciones para este símbolo alcanzado.",
  10035: "Tipo de orden incorrecto.",
  10036: "Posición ya cerrada.",
  10038: "Volumen de cierre supera el volumen actual de la posición.",
  10039: "Ya existe una orden de cierre para esta posición.",
  10040: "Número máximo de posiciones abiertas alcanzado.",
  10041: "La orden pendiente fue rechazada por la regla FIFO.",
  10042: "La operación viola la regla 'no hedging': prohibido abrir posición opuesta.",
  10043: "La operación viola la regla 'close by': cierres por compensación no permitidos.",
  10044: "Cierre por compensación no permitido.",
};

// Server-side error codes / statuses your edge functions may surface.
const APP_MAP: Record<string, string> = {
  ADMIN_LIVE_TEST_DISABLED: "Trading en vivo desactivado por política administrativa.",
  ADMIN_LIVE_TEST_NOT_AUTHORIZED: "Esta cuenta no está autorizada para operar en vivo todavía.",
  LIVE_EXEC_DISABLED: "Trading en vivo deshabilitado temporalmente.",
  STALE_MT_MAPPING: "Tu conexión MT5 necesita renovarse. Vuelve a conectar la cuenta.",
  CANARY_GUARD_BLOCKED: "Esta operación está bloqueada por la política de release controlado.",
  CANARY_DISABLED_BY_ADMIN: "Capability deshabilitada por el administrador.",
  FINAL_ACTIVATION_BLOCKER_ACTIVE: "Operativa bloqueada por verificación de mercado en curso.",
  PENDING_ORDERS_DISABLED_UNTIL_MARKET_VERIFIED: "Órdenes pendientes deshabilitadas hasta verificar apertura/cierre de mercado.",
  BROKER_SYMBOL_NOT_RESOLVED: "El símbolo no está disponible en el catálogo del bróker.",
  BROKER_SYMBOL_UNRESOLVED: "No se pudo resolver el símbolo con el bróker. Refresca y vuelve a intentar.",
  BROKER_SYMBOL_MAPPING_STALE: "No se pudo validar el símbolo con el bróker — reintenta en unos segundos.",
  BROKER_SYMBOL_MISMATCH: "El símbolo del bróker cambió. Refresca la posición/orden y reintenta.",
  BROKER_SYMBOL_AMBIGUOUS_MULTIPLE_EXECUTABLE_VARIANTS: "Existen múltiples variantes del símbolo para esta cuenta. Un administrador debe seleccionar la predeterminada.",
  BROKER_SYMBOL_DISCREPANCY_ACK_REQUIRED: "El símbolo requiere confirmación del administrador antes de operar en vivo.",
  BROKER_SYMBOL_NOT_LIST_DISCOVERED: "El símbolo aún no está verificado por el bróker para esta cuenta.",
  BROKER_SYMBOL_CHANGED_REVALIDATE_TICKET: "El símbolo del bróker cambió. Vuelve a abrir el ticket de orden.",
  BROKER_SYMBOL_RESOLUTION_FAILED_PRETRADE: "No se pudo validar el símbolo con el bróker — reintenta en unos segundos.",
  MT5_MAPPING_STALE: "La conexión MT5 necesita renovarse. Vuelve a conectar la cuenta.",
  TL_MAPPING_STALE: "La conexión MT5 necesita renovarse. Vuelve a conectar la cuenta.",
  NO_CONNECTED_MT5_ACCOUNT: "No hay una cuenta MT5 conectada para esta operación.",
  TL_API_KEY_MISSING: "Servicio de bróker no disponible temporalmente. Reintenta en unos minutos.",
  ACCOUNT_TRADE_PERMISSION_UNAVAILABLE: "No se pudieron verificar los permisos de la cuenta. Reintenta en unos segundos.",
  BROKER_SYMBOL_TRADE_MODE_BLOCKED: "Este símbolo está en modo solo lectura para tu cuenta.",
  FRESH_TICK_UNAVAILABLE: "Sin tick fresco del bróker para validar el precio. Reintenta en unos segundos.",
  rate_limited: "El bróker limitó la frecuencia de solicitudes. Reintenta en unos segundos.",
};

/**
 * Returns a Spanish, user-facing rejection message. Never returns
 * "Trade execution failed" or any generic fallback — always identifies
 * the broker code or app error code by name.
 */
export function translateBrokerRejection(input: BrokerErrorInput): string {
  const retcode = input.retcode != null ? Number(input.retcode) : null;
  if (retcode != null && MT5_MAP[retcode]) {
    return `${MT5_MAP[retcode]} (código ${retcode}${input.retcodeName ? ` · ${input.retcodeName}` : ""})`;
  }
  const code = input.error || input.status;
  if (code && APP_MAP[code]) return APP_MAP[code];

  const tail = input.retcodeDescription || input.brokerMessage || input.reason || input.error;
  if (retcode != null) {
    return `Operación rechazada por el bróker (código ${retcode}${input.retcodeName ? ` · ${input.retcodeName}` : ""})${tail ? `: ${tail}` : "."}`;
  }
  if (tail) return `Operación rechazada: ${tail}`;
  return "Operación rechazada: el bróker no devolvió un código identificable. Revisa el registro de auditoría.";
}
