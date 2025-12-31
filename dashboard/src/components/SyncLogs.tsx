import { AlertCircle, CheckCircle, Info, Terminal, XCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { SyncLogEntry } from '../hooks/useSyncStream';

interface SyncLogsProps {
    logs: SyncLogEntry[];
    isConnected: boolean;
    isComplete: boolean;
}

export function SyncLogs({ logs, isConnected, isComplete }: SyncLogsProps) {
    const logsEndRef = useRef<HTMLDivElement>(null);
    const logCount = logs.length;

    // Auto-scroll to bottom when new logs arrive
    useEffect(() => {
        if (logCount > 0) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logCount]);

    const getIcon = (type: SyncLogEntry['type']) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'error':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'warning':
                return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            default:
                return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    const getTextColor = (type: SyncLogEntry['type']) => {
        switch (type) {
            case 'success':
                return 'text-green-700';
            case 'error':
                return 'text-red-700';
            case 'warning':
                return 'text-yellow-700';
            default:
                return 'text-gray-700';
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    return (
        <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700">
                <Terminal className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-semibold">Sync Log</span>
                {isConnected && !isComplete && (
                    <span className="ml-auto flex items-center gap-2 text-green-400">
                        <span className="animate-pulse">●</span>
                        <span className="text-xs">Live</span>
                    </span>
                )}
                {isComplete && (
                    <span className="ml-auto text-gray-400 text-xs">Completed</span>
                )}
            </div>

            {/* Logs */}
            <div className="space-y-1 max-h-96 overflow-y-auto">
                {logs.length === 0 && (
                    <div className="text-gray-500 text-center py-8">
                        Waiting for sync to start...
                    </div>
                )}
                {logs.map((log) => (
                    <div key={log.timestamp.toISOString()} className="flex items-start gap-2 py-1 hover:bg-gray-800 px-2 -mx-2 rounded">
                        <span className="text-gray-500 text-xs shrink-0 mt-0.5">
                            {formatTime(log.timestamp)}
                        </span>
                        <span className="shrink-0 mt-0.5">
                            {getIcon(log.type)}
                        </span>
                        <span className={`flex-1 ${getTextColor(log.type)} text-xs leading-relaxed`}>
                            {log.message}
                        </span>
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>
        </div>
    );
}
