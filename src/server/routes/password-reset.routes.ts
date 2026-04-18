import type { BaseRouteDeps } from "../types.ts";

// Password reset now uses Firebase Auth directly in the frontend.
// Keep this no-op route file only to avoid stale editor imports/errors.
export function registerPasswordResetRoutes(_deps: BaseRouteDeps) {}
