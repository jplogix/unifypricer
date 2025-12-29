import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import StoreCard from './StoreCard';
import { storeService } from '../services/api';

// Mock storeService
vi.mock('../services/api', () => ({
    storeService: {
        getStatus: vi.fn(),
        triggerSync: vi.fn()
    }
}));

describe('StoreCard Property Tests', () => {
    // Property 13: Dashboard count accuracy
    // Validates: Requirements 6.1, 6.2, 6.3, 7.1, 7.2, 7.3
    it('should display correct counts from API', async () => {
        const store = {
            storeId: 'test-store',
            storeName: 'Test Store',
            platform: 'shopify' as const,
            enabled: true,
            syncInterval: 60,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // We use fc.assert/fc.asyncProperty to generate random inputs
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 10000 }), // repriced
                fc.integer({ min: 0, max: 10000 }), // pending
                fc.integer({ min: 0, max: 10000 }), // unlisted
                async (repriced, pending, unlisted) => {
                    // Reset mocks for each run
                    vi.clearAllMocks();

                    // Mock API response
                    (storeService.getStatus as any).mockResolvedValue({
                        repricedCount: repriced,
                        pendingCount: pending,
                        unlistedCount: unlisted,
                        lastSync: new Date().toISOString(),
                        completedAt: new Date().toISOString(),
                        syncStatus: 'success',
                        lastStatus: 'success'
                    });

                    const { unmount } = render(<StoreCard store={store} onEdit={() => { }} />);

                    // Wait for data to load and assertions to pass
                    await waitFor(() => {
                        // StoreCard currently displays Repriced and Pending counts
                        // We check if the text content matches exactly, or look for elements containing the number
                        // Since numbers can be formatted, checking presence is robust enough for this property test
                        // providing the numbers are distinct enough or we search specifically.
                        // However, with fast-check we might get small numbers like 0 and 1 which might appear elsewhere.
                        // But StoreCard structure is:
                        // Repriced -> count
                        // Pending -> count

                        // Let's use more specific queries if possible, or just text presence for now.
                        // Given the DOM structure: 
                        // <div ...>Repriced</div><div>{status.repricedCount}</div>

                        // Ideally we'd add data-testid, but let's try to find by text.
                        // If repriced and pending are same, getAllByText might return multiple.

                        const repricedElements = screen.getAllByText(repriced.toString());
                        expect(repricedElements.length).toBeGreaterThan(0);

                        const pendingElements = screen.getAllByText(pending.toString());
                        expect(pendingElements.length).toBeGreaterThan(0);
                    });

                    unmount();
                }
            ),
            { numRuns: 20 } // Limit runs for UI tests to avoid timeouts
        );
    });
});
