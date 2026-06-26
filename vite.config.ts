import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const neoApiBase = (env.NEO_API_BASE || env.VITE_NEO_API_BASE || "http://16.145.12.11/neo-api").replace(/\/$/, "");
  const neoApiToken = env.NEO_API_TOKEN || env.VITE_NEO_API_TOKEN || "";
  const appVersion = parseInt(fs.readFileSync("./src/version.txt", "utf8").trim(), 10);

  return {
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __APP_VERSION__: appVersion,
    },
    plugins: [
      react(),
      {
        name: "copy-version",
        writeBundle() {
          fs.copyFileSync("./src/version.txt", "./dist/version.txt");
        }
      },
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "neo · Personal AI",
          short_name: "neo",
          description: "你的个人 AI 助手",
          theme_color: "#eef3f2",
          background_color: "#eef3f2",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
          ]
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ["**/*.{js,css,png,svg,ico}"],
          runtimeCaching: [
            {
              urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "neo-html", networkTimeoutSeconds: 3 }
            },
            {
              urlPattern: /^\/api\//,
              handler: "NetworkFirst",
              options: { cacheName: "neo-api", networkTimeoutSeconds: 5 }
            }
          ]
        }
      })
    ],
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
