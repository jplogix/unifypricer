import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface SyncLogEntry {
	timestamp: Date;
	type: "info" | "success" | "error" | "warning";
	message: string;
}

export function useSyncStream(storeId: string, enabled: boolean) {
	const [logs, setLogs] = useState<SyncLogEntry[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const [isComplete, setIsComplete] = useState(false);
	const eventSourceRef = useRef<EventSource | null>(null);

	useLayoutEffect(() => {
		if (!enabled || !storeId) {
			return;
		}

		// Clear previous logs and state
		setLogs([]);
		setIsConnected(false);
		setIsComplete(false);

		const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
		const eventSource = new EventSource(`${apiUrl}/api/sync/${storeId}/stream`);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			setIsConnected(true);
		};

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);

				// Map event types to log types
				let logType: SyncLogEntry["type"] = "info";
				if (data.type === "success") logType = "success";
				else if (data.type === "error") logType = "error";
				else if (data.type === "warning") logType = "warning";

				const logEntry: SyncLogEntry = {
					timestamp: new Date(),
					type: logType,
					message: data.message,
				};

				setLogs((prev) => [...prev, logEntry]);

				// Mark as complete if sync finished
				if (data.type === "complete" || data.type === "error") {
					setIsComplete(true);
					setTimeout(() => {
						eventSource.close();
					}, 1000);
				}
			} catch (err) {
				console.error("Failed to parse SSE data:", err);
			}
		};

		eventSource.onerror = () => {
			setIsConnected(false);
			eventSource.close();
		};

		return () => {
			eventSource.close();
			eventSourceRef.current = null;
		};
	}, [storeId, enabled]);

	const clearLogs = () => {
		setLogs([]);
		setIsComplete(false);
	};

	return {
		logs,
		isConnected,
		isComplete,
		clearLogs,
	};
}
