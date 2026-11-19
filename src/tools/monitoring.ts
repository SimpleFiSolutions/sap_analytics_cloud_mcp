/**
 * Monitoring tools — Audit export and monitoring
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError, buildODataQuery } from "./_helpers.js";

export function registerMonitoringTools(server: McpServer): void {
  server.tool(
    "sac_audit_export",
    "Export audit activity logs with OData query params.",
    {
      $top: z.number().optional().describe("Max results"),
      $skip: z.number().optional().describe("Skip N results"),
      $filter: z.string().optional().describe("OData filter"),
      $orderby: z.string().optional().describe("Order by"),
      $select: z.string().optional().describe("Fields to return"),
    },
    async (args) => {
      try {
        const cfg = getConfig();
        const qs = buildODataQuery(args as Record<string, string | number | boolean | undefined>);
        const result = await sacGet(cfg, `/api/v1/audit/activities/exportActivities${qs}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // SAP: GET /api/v1/monitoring/{keyword} where keyword is a fixed system-model
  // name (not a model ID), plus GET /api/v1/monitoring/performance/{keyword}.
  // Returns CSV. Requires an admin user. (SAP Analytics Cloud REST API guide, 2026.15)
  const SYSTEM_MODELS = [
    "error", "license", "licenseConcurrent", "resource", "resourceRecentAccess",
    "user", "userAdoption", "userLive", "userSession", "backend", "client",
    "dataManagement", "planningVersion", "planningDataAction",
  ] as const;

  server.tool(
    "sac_monitoring_get",
    "Get tenant system-monitoring statistics as CSV. 'systemModel' is a fixed SAP keyword (error, license, licenseConcurrent, resource, resourceRecentAccess, user, userAdoption, userLive, userSession, backend, client, dataManagement, planningVersion, planningDataAction) — NOT a planning model ID. Set performance=true for the performance-statistics variant (then 'performanceKeyword' is used). Requires an admin user.",
    {
      systemModel: z.enum(SYSTEM_MODELS).optional().describe("System model keyword (required unless performance=true)"),
      performance: z.boolean().optional().describe("Use /monitoring/performance/{keyword} instead"),
      performanceKeyword: z.string().optional().describe("Keyword for the performance endpoint"),
      csvName: z.string().optional().describe("Name of the returned CSV file"),
      pageSize: z.number().optional().describe("Rows per page (max 100000)"),
      pageIndex: z.number().optional().describe("Page number"),
      sortKey: z.string().optional().describe("Column to sort by"),
      sortDescending: z.boolean().optional().describe("Sort descending"),
      from: z.string().optional().describe("Start of time range"),
      till: z.string().optional().describe("End of time range"),
    },
    async ({ systemModel, performance, performanceKeyword, ...params }) => {
      try {
        let path: string;
        if (performance) {
          if (!performanceKeyword) return toolError("performanceKeyword is required when performance=true.");
          path = `/api/v1/monitoring/performance/${encodeURIComponent(performanceKeyword)}`;
        } else {
          if (!systemModel) return toolError(`systemModel is required. Use one of: ${SYSTEM_MODELS.join(", ")}.`);
          path = `/api/v1/monitoring/${encodeURIComponent(systemModel)}`;
        }
        const cfg = getConfig();
        const qs = buildODataQuery(params as Record<string, string | number | boolean | undefined>);
        const result = await sacGet(cfg, `${path}${qs}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
