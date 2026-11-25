// El login falló en producción porque la ruta de /api/auth y el middleware de /admin eligieron nombres
// de cookie distintos (`__Host-` contra `dev-`). Correr: node --test scripts/auth-cookies-entorno.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { esEntornoProduccion } from "../../../packages/shared/src/auth/entorno-cookies.ts";

test("NODE_ENV production basta", () => {
  assert.equal(esEntornoProduccion({ nodeEnv: "production" }), true);
});

test("middleware sin NODE_ENV pero con DESPLIEGUE=cloudflare sigue siendo producción", () => {
  assert.equal(esEntornoProduccion({ nodeEnv: undefined, despliegue: "cloudflare" }), true);
  assert.equal(esEntornoProduccion({ despliegue: " Cloudflare " }), true);
});

test("AUTH_URL https cuenta como producción", () => {
  assert.equal(esEntornoProduccion({ authUrl: "https://barraca.jurmaq.cl" }), true);
});

test("local: sin señales o http es modo dev", () => {
  assert.equal(esEntornoProduccion({}), false);
  assert.equal(esEntornoProduccion({ nodeEnv: "development", authUrl: "http://localhost:3000" }), false);
  assert.equal(esEntornoProduccion({ nodeEnv: "test", despliegue: "vercel" }), false);
});

test("ruta y middleware coinciden aunque solo uno vea NODE_ENV", () => {
  const ruta = esEntornoProduccion({ nodeEnv: "production", despliegue: "cloudflare" });
  const middleware = esEntornoProduccion({ nodeEnv: undefined, despliegue: "cloudflare" });
  assert.equal(ruta, middleware);
});
