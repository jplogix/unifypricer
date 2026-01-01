import { Router } from "express";
import { connectRouter } from "./connect-routes";
import { configRepository, statusRepository, syncService } from "./container";
import logsRouter from "./logs-routes.js";
import { oauthRouter } from "./oauth-routes";
import { StoreController } from "./store-controller";
import { SyncController } from "./sync-controller";
import { SyncStreamController } from "./sync-stream-controller";

export const router = Router();

const storeController = new StoreController(configRepository, statusRepository);
const syncController = new SyncController(syncService, configRepository);
const syncStreamController = new SyncStreamController(
	syncService,
	configRepository,
);

// OAuth routes
router.use("/oauth", oauthRouter);

// Connection routes (simplified plugin)
router.use("/connect", connectRouter);

// Logs routes
router.use("/logs", logsRouter);

// Store routes
router.get("/stores", storeController.getAllStores);
router.get("/stores/:storeId", storeController.getStore);
router.post("/stores", storeController.createStore);
router.get("/stores/:storeId/status", storeController.getStoreStatus);
router.get("/stores/:storeId/products", storeController.getStoreProducts);

// Sync routes
router.post("/sync/:storeId", syncController.triggerSync);
router.get("/sync/:storeId/stream", syncStreamController.streamSync);
