/**
 * Claude rejects tool settings whose names start with "$" (e.g. "$top").
 * This wrapper renames them to "odata_top", "odata_filter", etc. when tools
 * are registered, and maps them back to "$top", "$filter" when a tool runs,
 * so the rest of the code is unchanged.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const PREFIX = "odata_";

function isZodShape(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const vals = Object.values(v as Record<string, unknown>);
  return vals.length > 0 && vals.every((x) => !!x && typeof x === "object" && "_def" in (x as object));
}

export function applyDollarKeyFix(server: McpServer): void {
  const original = (server as any).tool.bind(server);
  (server as any).tool = (...args: any[]) => {
    const renamed: Record<string, string> = {}; // safeName -> "$name"
    const newArgs = args.map((a) => {
      if (!isZodShape(a)) return a;
      const shape: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(a)) {
        if (k.startsWith("$")) {
          const safe = PREFIX + k.slice(1);
          renamed[safe] = k;
          shape[safe] = v;
        } else {
          shape[k] = v;
        }
      }
      return shape;
    });
    if (Object.keys(renamed).length > 0) {
      const last = newArgs.length - 1;
      const handler = newArgs[last];
      if (typeof handler === "function") {
        newArgs[last] = (input: any, extra: any) => {
          const mapped: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(input ?? {})) mapped[renamed[k] ?? k] = v;
          return handler(mapped, extra);
        };
      }
    }
    return original(...newArgs);
  };
}
