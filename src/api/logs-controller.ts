import type { Request, Response } from "express";
import { Logger } from "../utils/logger.js";

const logger = new Logger("LogsController");

// Store recent logs in memory (circular buffer)
const MAX_LOGS = 1000;
const recentLogs: Array<{
	timestamp: string;
	level: string;
	context: string;
	message: string;
	meta?: Record<string, unknown>;
}> = [];

// Intercept console methods to capture logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleDebug = console.debug;

function parseLogMessage(message: string) {
	// Parse format: [timestamp] [level] [context] message {meta}
	const logRegex = /^\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] (.+)$/;
	const match = message.match(logRegex);

	if (match) {
		const [, timestamp, level, context, rest] = match;

		// Try to extract meta JSON if present
		let actualMessage = rest;
		let meta: Record<string, unknown> | undefined;

		const metaMatch = rest.match(/^(.+?)\s+(\{.+\})$/);
		if (metaMatch) {
			try {
				actualMessage = metaMatch[1];
				meta = JSON.parse(metaMatch[2]);
			} catch {
				// If JSON parse fails, keep the whole message
			}
		}

		return {
			timestamp,
			level,
			context,
			message: actualMessage,
			meta,
		};
	}

	// Fallback for non-formatted logs
	return {
		timestamp: new Date().toISOString(),
		level: "INFO",
		context: "System",
		message,
		meta: undefined,
	};
}

function captureLog(level: string, args: unknown[]) {
	const message = args.map((arg) => String(arg)).join(" ");
	const logEntry = parseLogMessage(message);

	// Override level if it wasn't parsed from message
	if (logEntry.level === "INFO" && level !== "INFO") {
		logEntry.level = level;
	}

	// Add to circular buffer
	recentLogs.push(logEntry);
	if (recentLogs.length > MAX_LOGS) {
		recentLogs.shift();
	}

	// Broadcast to all connected SSE clients
	broadcastLog(logEntry);
}

// Override console methods
console.log = (...args: unknown[]) => {
	captureLog("INFO", args);
	originalConsoleLog.apply(console, args);
};

console.error = (...args: unknown[]) => {
	captureLog("ERROR", args);
	originalConsoleError.apply(console, args);
};

console.warn = (...args: unknown[]) => {
	captureLog("WARN", args);
	originalConsoleWarn.apply(console, args);
};

console.debug = (...args: unknown[]) => {
	captureLog("DEBUG", args);
	originalConsoleDebug.apply(console, args);
};

// SSE clients
const sseClients: Response[] = [];

function broadcastLog(logEntry: {
	timestamp: string;
	level: string;
	context: string;
	message: string;
	meta?: Record<string, unknown>;
}) {
	const data = JSON.stringify(logEntry);
	sseClients.forEach((client) => {
		try {
			client.write(`data: ${data}\n\n`);
		} catch (err) {
			// Client disconnected, will be cleaned up
		}
	});
}

export class LogsController {
	/**
	 * Stream logs via Server-Sent Events
	 */
	async streamLogs(req: Request, res: Response): Promise<void> {
		logger.info("Client connected to log stream");

		// Set SSE headers
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-cache");
		res.setHeader("Connection", "keep-alive");
		res.setHeader("Access-Control-Allow-Origin", "*");

		// Send recent logs immediately
		recentLogs.forEach((log) => {
			res.write(`data: ${JSON.stringify(log)}\n\n`);
		});

		// Add client to SSE clients list
		sseClients.push(res);

		// Remove client when connection closes
		req.on("close", () => {
			const index = sseClients.indexOf(res);
			if (index !== -1) {
				sseClients.splice(index, 1);
			}
			logger.info("Client disconnected from log stream");
		});
	}

	/**
	 * Get recent logs (REST endpoint)
	 */
	async getRecentLogs(req: Request, res: Response): Promise<void> {
		const limit = Number.parseInt(req.query.limit as string) || 100;
		const level = req.query.level as string | undefined;

		let logs = recentLogs.slice(-limit);

		if (level) {
			logs = logs.filter((log) => log.level === level.toUpperCase());
		}

		res.json({
			logs,
			total: logs.length,
		});
	}

	/**
	 * Clear recent logs
	 */
	async clearLogs(req: Request, res: Response): Promise<void> {
		const count = recentLogs.length;
		recentLogs.length = 0;
		logger.info(`Cleared ${count} logs`);
		res.json({ message: `Cleared ${count} logs`, count });
	}
}
