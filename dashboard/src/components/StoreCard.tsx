import { ChevronDown, ChevronUp, Settings } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useStoreStatus } from '../hooks/useStoreStatus';
import { useSyncStream } from '../hooks/useSyncStream';
import type { StoreConfig } from '../types';
import ProductList from './ProductList';
import { SyncLogs } from './SyncLogs';
import SyncStatusIndicator from './SyncStatusIndicator';
import SyncTrigger from './SyncTrigger';

interface StoreCardProps {
    store: StoreConfig;
    onEdit: () => void;
}

const StoreCard: React.FC<StoreCardProps> = ({ store, onEdit }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showLogs, setShowLogs] = useState(false);
    const [syncEnabled, setSyncEnabled] = useState(false);
    const { status, refreshStatus } = useStoreStatus(store.storeId);
    const { logs, isConnected, isComplete } = useSyncStream(store.storeId, syncEnabled);

    const handleSyncStart = () => {
        setShowLogs(true);
        setSyncEnabled(true);
    };

    const handleSyncComplete = () => {
        refreshStatus();
        // Disable the stream after a delay
        setTimeout(() => {
            setSyncEnabled(false);
        }, 3000);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
                {/* Header Section */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-900">{store.storeName}</h3>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${store.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                {store.enabled ? 'Active' : 'Paused'}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                                {store.platform}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 font-mono">{store.storeId}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onEdit}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                        title="Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <div className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1">Repriced</div>
                        <div className="text-3xl font-bold text-green-700">{status?.repricedCount || 0}</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                        <div className="text-xs font-medium text-yellow-600 uppercase tracking-wide mb-1">Pending</div>
                        <div className="text-3xl font-bold text-yellow-700">{status?.pendingCount || 0}</div>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <SyncStatusIndicator
                        timestamp={status?.lastSync || ''}
                        status={status?.syncStatus || 'pending'}
                    />

                    <div className="flex gap-2">
                        <SyncTrigger
                            storeId={store.storeId}
                            onSyncStarted={handleSyncStart}
                            onSyncComplete={handleSyncComplete}
                        />
                        <button
                            type='button'
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                            title={isExpanded ? 'Hide Products' : 'Show Products'}
                        >
                            {isExpanded ? (
                                <>
                                    <ChevronUp className="w-4 h-4" />
                                    Hide Products
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="w-4 h-4" />
                                    Show Products
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Sync Logs */}
            {showLogs && (
                <div className="border-t border-gray-200 bg-gray-50">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-700">Sync Activity</h4>
                            <button
                                type="button"
                                onClick={() => setShowLogs(false)}
                                className="text-xs text-gray-500 hover:text-gray-700"
                            >
                                Hide
                            </button>
                        </div>
                        <SyncLogs logs={logs} isConnected={isConnected} isComplete={isComplete} />
                    </div>
                </div>
            )}

            {/* Products List */}
            {isExpanded && (
                <div className="border-t border-gray-200 bg-white">
                    <div className="p-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Products</h4>
                        <ProductList storeId={store.storeId} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoreCard;
