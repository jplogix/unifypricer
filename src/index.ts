import cors from "cors";
import express from "express";

// Import logs controller FIRST to intercept console methods before any logging happens
import "./api/logs-controller.js";

import { config, validateConfig } from "./config";
import { initializeDatabase } from "./repositories/database";
import { initializePostgres } from "./repositories/postgres-database.js";

const app = express();

// Middleware
app.use(
	cors({
		origin: "*",
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: [
			"Content-Type",
			"Authorization",
			"Cache-Control",
			"X-Requested-With",
		],
	}),
);
app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => {
	res.json({ status: "ok", timestamp: new Date().toISOString() });
});

import { router as apiRouter } from "./api/routes";

// API routes
app.use("/api", apiRouter);

// Serve static files from 'public' directory (where frontend build will be)
import path from "node:path";

app.use(express.static(path.join(process.cwd(), "public")));

const PORT = config.server.port;

import {
	configRepository,
	statusRepository,
	syncService,
} from "./api/container";
import { errorHandler } from "./middleware/error-handler";
// Initialize Scheduler
import { SchedulerService } from "./services/scheduler";
import { Logger } from "./utils/logger";

const logger = new Logger("Server");
const scheduler = new SchedulerService(
	configRepository,
	statusRepository,
	syncService,
);

// Apply error handler last
app.use(errorHandler);

// Handle client-side routing by serving index.html for non-API routes
app.get("*", (req, res, next) => {
	if (req.path.startsWith("/api")) {
		return next();
	}
	const indexPath = path.join(process.cwd(), "public", "index.html");
	res.sendFile(indexPath, (err) => {
		if (err) {
			// If index.html is missing (e.g. in dev mode without build), just 404
			// or send a basic message
			res.status(404).send("Dashboard not found. Please build the frontend.");
		}
	});
});

if (require.main === module) {
	// Validate configuration on startup
	try {
		validateConfig();
	} catch (error) {
		console.error("Configuration validation failed:", error);
		process.exit(1);
	}

	// Initialize database on startup
	const initDb = async () => {
		try {
			if (config.database.type === "postgres") {
				logger.info("Initializing PostgreSQL database...");
				await initializePostgres(config.database.url);
				logger.info("PostgreSQL initialized successfully");
			} else {
				logger.info("Initializing SQLite database...");
				initializeDatabase(config.database.path);
				logger.info("SQLite initialized successfully");
			}

			app.listen(PORT, () => {
				logger.info(`Price Sync Dashboard API running on port ${PORT}`);
				logger.info(`Environment: ${config.server.nodeEnv}`);
				logger.info(`Database: ${config.database.type}`);

				// Start scheduler
				scheduler.start();
			});
		} catch (error) {
			console.error("Database initialization failed:", error);
			process.exit(1);
		}
	};

	initDb();
}

export default app;
