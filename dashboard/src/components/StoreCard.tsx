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
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-bold text-gray-900">{store.storeName}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${store.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                {store.enabled ? 'Active' : 'Paused'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="capitalize">{store.platform}</span>
                            <span>•</span>
                            <span className="font-mono text-xs text-gray-400">{store.storeId}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onEdit}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-sm text-gray-500 mb-1">Repriced</div>
                        <div className="text-2xl font-bold text-gray-900">{status?.repricedCount || 0}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-sm text-gray-500 mb-1">Pending</div>
                        <div className="text-2xl font-bold text-gray-900">{status?.pendingCount || 0}</div>
                    </div>
                </div>

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
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {showLogs && (
                <div className="border-t border-gray-100 bg-gray-50">
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

            {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 p-6">
                    <ProductList storeId={store.storeId} />
                </div>
            )}
        </div>
    );
};

export default StoreCard;
