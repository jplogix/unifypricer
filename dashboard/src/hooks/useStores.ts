import { useState, useEffect, useCallback } from 'react';
import { storeService } from '../services/api';
import type { StoreConfig } from '../types';

export function useStores() {
    const [stores, setStores] = useState<StoreConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStores = useCallback(async () => {
        try {
            // Don't set loading to true on background refreshes, only initial
            const data = await storeService.getAll();
            setStores(data);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch stores:', err);
            setError('Failed to load stores. Please ensure the backend is running.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStores();

        // Auto-refresh every 30 seconds to catch new stores
        const interval = setInterval(fetchStores, 30000);
        return () => clearInterval(interval);
    }, [fetchStores]);

    return { stores, loading, error, refreshStores: fetchStores };
}
