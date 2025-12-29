import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { storeService } from '../services/api';
import axios from 'axios';

interface SyncTriggerProps {
    storeId: string;
    onSyncStarted?: () => void;
    onSyncComplete?: () => void;
    onSyncError?: (error: string) => void;
}

export const SyncTrigger: React.FC<SyncTriggerProps> = ({ storeId, onSyncStarted, onSyncComplete, onSyncError }) => {
    const [loading, setLoading] = useState(false);

    const handleSync = async () => {
        if (loading) return;

        setLoading(true);
        if (onSyncStarted) onSyncStarted();

        try {
            await storeService.triggerSync(storeId);
            if (onSyncComplete) onSyncComplete();
        } catch (error) {
            const msg = axios.isAxiosError(error) ? error.message : 'Sync failed';
            if (onSyncError) onSyncError(msg);
            console.error('Sync trigger error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleSync}
            disabled={loading}
            className={`
        px-3 py-1.5 rounded-md flex items-center space-x-1.5 
        text-white font-medium transition-colors
        ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
      `}
        >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Syncing...' : 'Sync Now'}</span>
        </button>
    );
};

export default SyncTrigger;
