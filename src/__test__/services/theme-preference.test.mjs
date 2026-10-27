import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { isThemePreference } = require("../../../build/service/theme-preference.service.js");

test("accepts supported theme preferences", () => {
  for (const value of ["light", "dark", "system"]) assert.equal(isThemePreference(value), true);
});

test("rejects unsupported theme preferences", () => {
  for (const value of ["auto", "LIGHT", "", null, undefined, 1]) assert.equal(isThemePreference(value), false);
});
