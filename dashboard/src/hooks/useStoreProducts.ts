import { useState, useEffect, useCallback } from 'react';
import { storeService } from '../services/api';
import type { ProductStatusRecord } from '../types';

const normalizePrice = (value: unknown): number | undefined => {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(num) ? num : undefined;
};

export function useStoreProducts(storeId: string) {
    const [products, setProducts] = useState<ProductStatusRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true);
            const data = await storeService.getProducts(storeId);
            const normalized = data.map((product) => ({
                ...product,
                currentPrice: normalizePrice((product as any).currentPrice ?? (product as any).current_price),
                targetPrice: normalizePrice((product as any).targetPrice ?? (product as any).target_price),
            }));
            setProducts(normalized);
            setError(null);
        } catch (err) {
            console.error(`Failed to fetch products for store ${storeId}:`, err);
            setError('Failed to fetch products');
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    return { products, loading, error, refreshProducts: fetchProducts };
}
