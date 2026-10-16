import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".");
export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, root, ""), ...process.env };
  // A separately hosted static portal must call the ZenControl API explicitly.
  if (command === "build") {
    let url;
    try {
      url = new URL(env.VITE_API_URL);
    } catch {}
    if (
      !url ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        )) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw Error(
        "Configure VITE_API_URL com a URL HTTPS do backend ZenControl (HTTP permitido apenas em localhost).",
      );
  }
  return {
    envDir: root,
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@zenfield/ui": path.join(root, "src/ui") } },
    define: {
      "import.meta.env.VITE_APP_AUDIENCE": JSON.stringify("technician"),
    },
    server: {
      fs: { allow: [root] },
      proxy: {
        "/api": {
          target: env.ZEN_API_PROXY || "http://127.0.0.1:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
