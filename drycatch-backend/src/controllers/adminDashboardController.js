import * as dashboardService from "../services/admin/dashboardService.js";

// GET /admin/dashboard?range=today|yesterday|7d|30d|90d
export async function getDashboard(req, res) {
  const result = await dashboardService.getDashboard({ range: req.query.range });
  res.json(result);
}
