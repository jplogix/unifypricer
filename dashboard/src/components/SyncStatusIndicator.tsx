import React from 'react';
import type { SyncStatus } from '../types';
import { CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SyncStatusIndicatorProps {
    status: SyncStatus;
    timestamp: string;
    className?: string;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ status, timestamp, className }) => {
    const getIcon = () => {
        switch (status) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'failed':
                return <XCircle className="w-5 h-5 text-red-500" />;
            case 'partial':
                return <AlertCircle className="w-5 h-5 text-yellow-500" />;
            case 'pending':
                return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
            default:
                return <Clock className="w-5 h-5 text-gray-400" />;
        }
    };

    const getLabel = () => {
        switch (status) {
            case 'success': return 'Synced';
            case 'failed': return 'Failed';
            case 'partial': return 'Partial';
            case 'pending': return 'Syncing...';
            default: return 'Unknown';
        }
    };

    return (
        <div className={twMerge(clsx("flex items-center space-x-2 text-sm", className))}>
            {getIcon()}
            <span className="font-medium text-gray-700 dark:text-gray-200">
                {getLabel()}
            </span>
            <span className="text-gray-500 text-xs">
                {timestamp && !isNaN(new Date(timestamp).getTime())
                    ? new Date(timestamp).toLocaleString()
                    : ''}
            </span>
        </div>
    );
};

export default SyncStatusIndicator;
