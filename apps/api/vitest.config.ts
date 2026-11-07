import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Carga el .env de la raíz para que las pruebas encuentren la base de datos.
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

export default defineConfig({ test: { fileParallelism: false, testTimeout: 20000 } });
