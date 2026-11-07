// 2500 respuestas sintéticas corregidas con el código Python original (nucleo.comparar): la versión JS debe dar lo mismo.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { crearMotor } from "../js/comparar.js";
const cat = JSON.parse(fs.readFileSync(new URL("../data/catalogo.json", import.meta.url), "utf8")).items;
const casos = JSON.parse(fs.readFileSync(new URL("./casos_referencia.json", import.meta.url), "utf8"));
test("la corrección coincide con el código de referencia", () => {
  const m = crearMotor(cat), fallos = [];
  for (const c of casos) {
    const [r, info] = m.comparar(m.porId.get(c.id), c.resp);
    if (r !== c.r || JSON.stringify(info.partes ?? null) !== JSON.stringify(c.partes ?? null)) fallos.push(`${c.id} «${c.resp}»: ${r} ≠ ${c.r}`);
  }
  assert.deepEqual(fallos, []);
});
