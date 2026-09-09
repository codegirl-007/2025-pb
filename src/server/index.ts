import { createServer } from "node:http";
import { loadConfig } from "./config";
import { createApp, mountFrontend } from "./app";
import { attachWebSocket } from "./ws";

const config = loadConfig();
const { app, store } = createApp(config);
const server = createServer(app);

attachWebSocket(server, store);

if (!config.isProduction) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  mountFrontend(app, config);
}

const sweep = setInterval(() => {
  store.sweep();
}, 60_000);
sweep.unref();

server.listen(config.port, config.host, () => {
  console.log(`Birthday MCP listening on http://${config.host}:${config.port}`);
});
