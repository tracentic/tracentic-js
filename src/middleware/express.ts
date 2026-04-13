import type { Request, Response, NextFunction } from 'express';
import { TracenticGlobalContext } from '../global-context.js';

/**
 * Options for the Tracentic Express middleware.
 */
export interface TracenticMiddlewareOptions {
  /**
   * Resolves per-request attributes from the Express request.
   * Returned attributes are applied to the global context for
   * the duration of the request, then restored.
   *
   * Null/undefined values temporarily remove a key, letting
   * callers suppress a global attribute for specific requests.
   */
  requestAttributes: (req: Request) => Record<string, unknown>;
}

/**
 * Express middleware that injects per-request attributes into the
 * global context for the duration of a single HTTP request, then
 * restores the previous values.
 *
 * ```ts
 * import { tracenticMiddleware } from 'tracentic/middleware/express';
 *
 * app.use(tracenticMiddleware({
 *   requestAttributes: (req) => ({
 *     userId: req.headers['x-user-id'],
 *     method: req.method,
 *   }),
 * }));
 * ```
 */
export function tracenticMiddleware(
  options: TracenticMiddlewareOptions,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const global = TracenticGlobalContext.current;
    const attributes = options.requestAttributes(req);

    if (!attributes || Object.keys(attributes).length === 0) {
      next();
      return;
    }

    // Snapshot current global values for keys we are about to set
    const currentAll = global.getAll();
    const snapshot: Record<string, unknown> = {};
    for (const key of Object.keys(attributes)) {
      snapshot[key] = currentAll[key]; // undefined if not present
    }

    // Apply per-request attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (value != null) {
        global.set(key, value);
      } else {
        global.remove(key);
      }
    }

    // Restore on finish (always, even if the handler throws). Both 'finish'
    // and 'close' can fire — the guard ensures we only restore once so we
    // don't blow away values written by a later concurrent request that
    // overlapped this one.
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      for (const [key, prev] of Object.entries(snapshot)) {
        if (prev != null) {
          global.set(key, prev);
        } else {
          global.remove(key);
        }
      }
    };

    res.on('finish', restore);
    res.on('close', restore);

    next();
  };
}
