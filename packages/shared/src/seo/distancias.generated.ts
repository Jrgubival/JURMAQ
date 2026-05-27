/**
 * AUTO-GENERADO por scripts/calc-distancias.mjs — NO EDITAR A MANO.
 *
 * Distancia (km) y tiempo de despacho desde cada HQ física a cada ciudad
 * de CIUDADES. Calculado con OSRM público + buffer 15% para camión cargado.
 *
 * Para regenerar: `node scripts/calc-distancias.mjs`
 *
 * Última generación: 2026-05-26T01:38:14.310Z
 */

export const DISTANCIAS_BARRACA: Record<string, { km: number; min: number; tiempo: string }> = {
  "curico": { km: 20, min: 20, tiempo: "20 minutos" },
  "molina": { km: 0, min: 0, tiempo: "inmediato" },
  "teno": { km: 37, min: 35, tiempo: "35 minutos" },
  "romeral": { km: 28, min: 27, tiempo: "25 minutos" },
  "sagrada-familia": { km: 23, min: 30, tiempo: "30 minutos" },
  "hualane": { km: 86, min: 100, tiempo: "1h 40min" },
  "licanten": { km: 107, min: 134, tiempo: "2h 15min" },
  "vichuquen": { km: 124, min: 172, tiempo: "2h 50min" },
  "rauco": { km: 31, min: 41, tiempo: "40 minutos" },
  "talca": { km: 54, min: 47, tiempo: "45 minutos" },
  "linares": { km: 104, min: 88, tiempo: "1h 30min" },
  "constitucion": { km: 161, min: 175, tiempo: "2h 55min" },
};

export const DISTANCIAS_CONSTRUCTORA: Record<string, { km: number; min: number; tiempo: string }> = {
  "curico": { km: 5, min: 10, tiempo: "10 minutos" },
  "molina": { km: 23, min: 24, tiempo: "25 minutos" },
  "teno": { km: 19, min: 23, tiempo: "25 minutos" },
  "romeral": { km: 10, min: 14, tiempo: "15 minutos" },
  "sagrada-familia": { km: 25, min: 32, tiempo: "30 minutos" },
  "hualane": { km: 76, min: 108, tiempo: "1h 50min" },
  "licanten": { km: 97, min: 141, tiempo: "2h 20min" },
  "vichuquen": { km: 115, min: 179, tiempo: "3 horas" },
  "rauco": { km: 16, min: 29, tiempo: "30 minutos" },
  "talca": { km: 69, min: 57, tiempo: "55 minutos" },
  "linares": { km: 119, min: 98, tiempo: "1h 40min" },
  "constitucion": { km: 176, min: 185, tiempo: "3h 5min" },
};
