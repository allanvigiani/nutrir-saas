import type { BaseRouteDeps } from "../types.ts";

export function registerHealthRoutes(deps: BaseRouteDeps) {
  deps.app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running" });
  });
}
