import { Router } from "express";
import { LogsController } from "./logs-controller.js";

const router = Router();
const logsController = new LogsController();

/**
 * Stream server logs via SSE
 * GET /api/logs/stream
 */
router.get("/stream", (req, res) => logsController.streamLogs(req, res));

/**
 * Get recent logs
 * GET /api/logs?limit=100&level=ERROR
 */
router.get("/", (req, res) => logsController.getRecentLogs(req, res));

/**
 * Clear recent logs
 * DELETE /api/logs
 */
router.delete("/", (req, res) => logsController.clearLogs(req, res));

export default router;
