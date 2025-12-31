import { useCallback, useEffect, useState } from "react";
import { type StoreStatus, storeService } from "../services/api";

const DEFAULT_STATUS: StoreStatus = {
	repricedCount: 0,
	pendingCount: 0,
	unlistedCount: 0,
	syncStatus: "pending",
};

export function useStoreStatus(storeId: string) {
	const [status, setStatus] = useState<StoreStatus>(DEFAULT_STATUS);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchStatus = useCallback(
		async (isBackground = false) => {
			try {
				if (!isBackground) setLoading(true);
				const data = await storeService.getStatus(storeId);
				setStatus(data);
				setError(null);
			} catch (err) {
				console.error(`Failed to fetch status for store ${storeId}:`, err);
				setError("Failed to fetch status");
			} finally {
				if (!isBackground) setLoading(false);
			}
		},
		[storeId],
	);

	useEffect(() => {
		fetchStatus();
		const interval = setInterval(() => fetchStatus(true), 10000); // Poll every 10s for status
		return () => clearInterval(interval);
	}, [fetchStatus]);

	const triggerSync = async () => {
		try {
			const statusAfterTrigger = await storeService.triggerSync(storeId);
			// Immediately set status from response and continue polling
			setStatus(statusAfterTrigger);
			fetchStatus(true);
		} catch (err) {
			console.error("Failed to trigger sync:", err);
			throw err;
		}
	};

	return {
		status,
		loading,
		error,
		refreshStatus: () => fetchStatus(false),
		triggerSync,
	};
}
