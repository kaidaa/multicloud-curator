import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
// Backend dev URL — Vite proxy forward /api/* ke sini supaya frontend dan
// backend bisa single-origin walaupun jalan di port berbeda.
var BACKEND_URL = "http://localhost:8000";
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: BACKEND_URL,
                changeOrigin: true,
            },
        },
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: "./tests/setup.ts",
        css: false,
    },
});
