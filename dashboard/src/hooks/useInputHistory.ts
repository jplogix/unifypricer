import { useCallback, useState } from "react";

interface UseInputHistoryOptions {
	maxItems?: number;
	storageKey: string;
}

function loadHistoryFromStorage(storageKey: string): string[] {
	try {
		const stored = localStorage.getItem(storageKey);
		if (stored) {
			const parsed = JSON.parse(stored);
			return Array.isArray(parsed) ? parsed : [];
		}
	} catch (error) {
		console.error("Failed to load input history:", error);
	}
	return [];
}

export function useInputHistory(options: UseInputHistoryOptions) {
	const { maxItems = 10, storageKey } = options;
	const [history, setHistory] = useState<string[]>(() =>
		loadHistoryFromStorage(storageKey),
	);
	const [showSuggestions, setShowSuggestions] = useState(false);

	// Save history to localStorage
	const saveHistory = useCallback(
		(newHistory: string[]) => {
			try {
				localStorage.setItem(storageKey, JSON.stringify(newHistory));
				setHistory(newHistory);
			} catch (error) {
				console.error("Failed to save input history:", error);
			}
		},
		[storageKey],
	);

	// Add a value to history
	const addToHistory = useCallback(
		(value: string) => {
			if (!value || value.trim() === "") return;

			const trimmedValue = value.trim();

			// Remove duplicate if exists and add to front
			const newHistory = [
				trimmedValue,
				...history.filter((item) => item !== trimmedValue),
			].slice(0, maxItems);

			saveHistory(newHistory);
		},
		[history, maxItems, saveHistory],
	);

	// Filter history based on current input
	const getSuggestions = useCallback(
		(input: string): string[] => {
			if (!input || input.trim() === "") return history;

			const lowerInput = input.toLowerCase();
			return history.filter((item) => item.toLowerCase().includes(lowerInput));
		},
		[history],
	);

	// Clear all history
	const clearHistory = useCallback(() => {
		try {
			localStorage.removeItem(storageKey);
			setHistory([]);
		} catch (error) {
			console.error("Failed to clear input history:", error);
		}
	}, [storageKey]);

	// Remove specific item from history
	const removeFromHistory = useCallback(
		(value: string) => {
			const newHistory = history.filter((item) => item !== value);
			saveHistory(newHistory);
		},
		[history, saveHistory],
	);

	return {
		history,
		showSuggestions,
		setShowSuggestions,
		addToHistory,
		getSuggestions,
		clearHistory,
		removeFromHistory,
	};
}
