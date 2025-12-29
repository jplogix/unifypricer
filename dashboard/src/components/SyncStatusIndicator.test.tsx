import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import SyncStatusIndicator from './SyncStatusIndicator';

describe('SyncStatusIndicator Property Tests', () => {
    // Property 13.2: Timestamp display accuracy
    // Validates: Requirements 6.4, 7.4
    it('should display valid formatted timestamps', () => {
        fc.assert(
            fc.property(
                fc.date(),
                fc.constantFrom('success', 'failed', 'partial', 'pending', 'unknown'),
                (date, status) => {
                    const isoString = date.toISOString();
                    const { unmount } = render(
                        <SyncStatusIndicator
                            status={status as any}
                            timestamp={isoString}
                        />
                    );

                    // Verification logic:
                    // new Date(timestamp).toLocaleString() output depends on the environment.
                    // However, we can verify that the text content of the element contains parts of the date
                    // or simply that it renders without error and contains a string representation.
                    // A robust check is to ensure strict equality with the expected transformation in the test environment.

                    const expectedText = new Date(isoString).toLocaleString();
                    // normalize text (sometimes spaces differ, e.g. non-breaking space)
                    // but usually direct check is fine in jsdom.

                    expect(screen.getByText(expectedText)).toBeInTheDocument();

                    unmount();
                }
            )
        );
    });

    it('should display correct status label and icon', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('success', 'failed', 'partial', 'pending'),
                (status) => {
                    const { unmount } = render(
                        <SyncStatusIndicator
                            status={status as any}
                            timestamp={new Date().toISOString()}
                        />
                    );

                    let expectedLabel = 'Unknown';
                    switch (status) {
                        case 'success': expectedLabel = 'Synced'; break;
                        case 'failed': expectedLabel = 'Failed'; break;
                        case 'partial': expectedLabel = 'Partial'; break;
                        case 'pending': expectedLabel = 'Syncing...'; break;
                    }

                    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
                    unmount();
                }
            )
        );
    });
});
