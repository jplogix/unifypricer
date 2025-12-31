import { useCallback, useState } from "react";
import type { ToastItem, ToastType } from "../components/Toast";

export function useToast() {
	const [toasts, setToasts] = useState<ToastItem[]>([]);

	const addToast = useCallback(
		(message: string, type: ToastType = "info", duration: number = 5000) => {
			const id = `${Date.now()}-${Math.random()}`;
			const toast: ToastItem = { id, message, type, duration };

			setToasts((prev) => [...prev, toast]);

			return id;
		},
		[],
	);

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
	}, []);

	const success = useCallback(
		(message: string, duration?: number) => {
			return addToast(message, "success", duration);
		},
		[addToast],
	);

	const error = useCallback(
		(message: string, duration?: number) => {
			return addToast(message, "error", duration);
		},
		[addToast],
	);

	const info = useCallback(
		(message: string, duration?: number) => {
			return addToast(message, "info", duration);
		},
		[addToast],
	);

	const warning = useCallback(
		(message: string, duration?: number) => {
			return addToast(message, "warning", duration);
		},
		[addToast],
	);

	return {
		toasts,
		addToast,
		removeToast,
		success,
		error,
		info,
		warning,
	};
}
