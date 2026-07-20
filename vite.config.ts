import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type ViteDevServer } from "vite";

export default defineConfig({
  root: "web",
  plugins: [
    react(),
    {
      name: "xoaco-agent-api",
      configureServer(server: ViteDevServer) {
        server.middlewares.use("/api/agent", async (req, res) => {
          try {
            const module = await server.ssrLoadModule(
              "/@fs/" + path.resolve(process.cwd(), "src/server/webAgent.ts")
            );
            await module.handleAgentRequest(req, res);
          } catch (error: unknown) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : String(error)
              })
            );
          }
        });
      }
    }
  ],
  server: {
    port: 5173,
    fs: { allow: [path.resolve(process.cwd())] }
  }
});
