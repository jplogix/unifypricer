interface SyncStatusBarProps {
    storeName: string;
    status: 'in_progress' | 'success' | 'partial' | 'failed';
    repricedCount?: number;
    pendingCount?: number;
    unlistedCount?: number;
    error?: string;
}

export function SyncStatusBar({
    storeName,
    status,
    repricedCount = 0,
    pendingCount = 0,
    unlistedCount = 0,
    error,
}: SyncStatusBarProps) {
    const statusColors = {
        in_progress: 'bg-blue-500',
        success: 'bg-green-500',
        partial: 'bg-yellow-500',
        failed: 'bg-red-500',
    };

    const statusLabels = {
        in_progress: 'Syncing...',
        success: 'Sync Complete',
        partial: 'Partially Complete',
        failed: 'Sync Failed',
    };

    return (
        <div className={`${statusColors[status]} text-white px-6 py-3 rounded-lg shadow-md mb-4`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {status === 'in_progress' && (
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    )}
                    <div>
                        <p className="font-semibold">{storeName}</p>
                        <p className="text-sm opacity-90">{statusLabels[status]}</p>
                    </div>
                </div>

                <div className="flex gap-6 text-sm">
                    <div className="text-center">
                        <p className="font-bold text-lg">{repricedCount}</p>
                        <p className="opacity-75">Repriced</p>
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-lg">{pendingCount}</p>
                        <p className="opacity-75">Pending</p>
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-lg">{unlistedCount}</p>
                        <p className="opacity-75">Unlisted</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mt-2 pt-2 border-t border-white/20">
                    <p className="text-sm opacity-90">Error: {error}</p>
                </div>
            )}
        </div>
    );
}
