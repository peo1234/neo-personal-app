import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const neoApiBase = (env.NEO_API_BASE || env.VITE_NEO_API_BASE || "http://16.145.12.11/neo-api").replace(/\/$/, "");
  const neoApiToken = env.NEO_API_TOKEN || env.VITE_NEO_API_TOKEN || "";

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5174,
      proxy: {
        "/api": {
          target: neoApiBase,
          changeOrigin: true,
          configure(proxy: any) {
            proxy.on("proxyReq", (proxyReq: any) => {
              if (!neoApiToken) return;
              proxyReq.setHeader("authorization", `Bearer ${neoApiToken}`);
              proxyReq.setHeader("x-neo-token", neoApiToken);
            });
          }
        }
      }
    }
  };
});
