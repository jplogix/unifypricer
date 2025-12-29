import { useState, useEffect, useCallback } from 'react';
import { storeService } from '../services/api';
import type { ProductStatusRecord } from '../types';

export function useStoreProducts(storeId: string) {
    const [products, setProducts] = useState<ProductStatusRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true);
            const data = await storeService.getProducts(storeId);
            setProducts(data);
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
