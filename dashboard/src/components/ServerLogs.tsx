import { AlertCircle, ChevronDown, ChevronUp, Info, Terminal, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface ServerLogEntry {
    timestamp: string;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    context: string;
    message: string;
    meta?: Record<string, unknown>;
}

interface ServerLogsProps {
    maxHeight?: string;
}

export function ServerLogs({ maxHeight = '500px' }: ServerLogsProps) {
    const [logs, setLogs] = useState<ServerLogEntry[]>([]);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const logsContainerRef = useRef<HTMLDivElement>(null);
    const autoScrollRef = useRef(autoScroll);

    // Calculate pagination
    const totalPages = useMemo(() => Math.ceil(logs.length / itemsPerPage), [logs.length, itemsPerPage]);
    const startIndex = useMemo(() => (currentPage - 1) * itemsPerPage, [currentPage, itemsPerPage]);
    const endIndex = useMemo(() => startIndex + itemsPerPage, [startIndex, itemsPerPage]);
    const paginatedLogs = useMemo(() => logs.slice(startIndex, endIndex), [logs, startIndex, endIndex]);

    // Update autoScrollRef when autoScroll changes
    useEffect(() => {
        autoScrollRef.current = autoScroll;
    }, [autoScroll]);

    // Update page when logs change and auto-scroll is enabled
    useEffect(() => {
        if (autoScrollRef.current && logs.length > 0) {
            const newTotalPages = Math.ceil(logs.length / itemsPerPage);
            if (newTotalPages !== currentPage) {
                // Use setTimeout to defer the state update and avoid cascading renders
                setTimeout(() => {
                    setCurrentPage(newTotalPages);
                }, 0);
            }
        }
    }, [logs.length, itemsPerPage, currentPage]);

    // Auto-scroll to bottom when new logs arrive
    useEffect(() => {
        if (autoScroll && logs.length > 0) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    // Check if user scrolled away from bottom
    const handleScroll = () => {
        if (!logsContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        setAutoScroll(isAtBottom);
    };

    useEffect(() => {
        if (isCollapsed) return;

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const eventSource = new EventSource(`${apiUrl}/api/logs/stream`);

        let connectionTimer: number | undefined;
        let hasReceivedData = false;

        eventSource.onopen = () => {
            console.log('[ServerLogs] SSE connection opened');
            setIsConnected(true);
            if (connectionTimer) clearTimeout(connectionTimer);
        };

        eventSource.onmessage = (event) => {
            // Set connected on first message if not already set
            if (!hasReceivedData) {
                hasReceivedData = true;
                setIsConnected(true);
            }
            if (connectionTimer) clearTimeout(connectionTimer);

            try {
                const logEntry: ServerLogEntry = JSON.parse(event.data);
                setLogs((prev) => [...prev.slice(-500), logEntry]); // Keep last 500 logs
            } catch (err) {
                console.error('Failed to parse log data:', err);
            }
        };

        eventSource.onerror = (error) => {
            console.error('[ServerLogs] SSE connection error:', error);
            setIsConnected(false);
            eventSource.close();
        };

        // Set a timeout to mark as connected after initial connection
        connectionTimer = setTimeout(() => {
            if (eventSource.readyState === EventSource.OPEN) {
                setIsConnected(true);
            }
        }, 1000);

        return () => {
            if (connectionTimer) clearTimeout(connectionTimer);
            eventSource.close();
            setIsConnected(false);
        };
    }, [isCollapsed]);

    const getIcon = (level: ServerLogEntry['level']) => {
        switch (level) {
            case 'ERROR':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'WARN':
                return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'DEBUG':
                return <Info className="w-4 h-4 text-gray-500" />;
            default:
                return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    const getTextColor = (level: ServerLogEntry['level']) => {
        switch (level) {
            case 'ERROR':
                return 'text-red-400';
            case 'WARN':
                return 'text-yellow-400';
            case 'DEBUG':
                return 'text-gray-400';
            default:
                return 'text-blue-400';
        }
    };

    const getLevelBadgeColor = (level: ServerLogEntry['level']) => {
        switch (level) {
            case 'ERROR':
                return 'bg-red-900 text-red-200';
            case 'WARN':
                return 'bg-yellow-900 text-yellow-200';
            case 'DEBUG':
                return 'bg-gray-800 text-gray-300';
            default:
                return 'bg-blue-900 text-blue-200';
        }
    };

    const clearLogs = () => {
        setLogs([]);
    };

    const formatTime = (timestamp: string) => {
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3
            });
        } catch {
            return timestamp;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header - Always Visible */}
            <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Server Logs</h3>
                    {!isCollapsed && isConnected && (
                        <span className="flex items-center gap-2 text-green-600">
                            <span className="animate-pulse">●</span>
                            <span className="text-xs font-medium">Live</span>
                        </span>
                    )}
                    {!isCollapsed && logs.length > 0 && (
                        <span className="text-sm text-gray-500">
                            ({logs.length} {logs.length === 1 ? 'entry' : 'entries'})
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {!isCollapsed && logs.length > 0 && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                clearLogs();
                            }}
                            className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Clear
                        </button>
                    )}
                    {isCollapsed ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                    )}
                </div>
            </button>

            {/* Logs Content - Collapsible */}
            {!isCollapsed && (
                <div className="border-t border-gray-200 bg-gray-900">
                    <div className="p-4">
                        <div
                            ref={logsContainerRef}
                            onScroll={handleScroll}
                            className="space-y-0.5 overflow-y-auto rounded-lg"
                            style={{ maxHeight }}
                        >
                            {logs.length === 0 && (
                                <div className="text-gray-500 text-center py-12 text-sm">
                                    {isConnected ? 'Waiting for logs...' : 'Connecting to server...'}
                                </div>
                            )}
                            {paginatedLogs.map((log, index) => (
                                <div
                                    key={`${log.timestamp}-${startIndex + index}`}
                                    className="flex items-start gap-2 py-1 px-2 hover:bg-gray-800 rounded font-mono text-xs"
                                >
                                    <span className="text-gray-500 shrink-0 mt-0.5">
                                        {formatTime(log.timestamp)}
                                    </span>
                                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${getLevelBadgeColor(log.level)}`}>
                                        {log.level}
                                    </span>
                                    <span className="text-purple-400 shrink-0 mt-0.5">
                                        [{log.context}]
                                    </span>
                                    <span className="shrink-0 mt-0.5">
                                        {getIcon(log.level)}
                                    </span>
                                    <span className={`flex-1 ${getTextColor(log.level)} leading-relaxed`}>
                                        {log.message}
                                        {log.meta && Object.keys(log.meta).length > 0 && (
                                            <span className="block text-gray-500 mt-1 text-[11px]">
                                                {JSON.stringify(log.meta)}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                        {!autoScroll && (
                            <div className="mt-2 text-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAutoScroll(true);
                                        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="text-xs text-blue-400 hover:text-blue-300"
                                >
                                    ↓ Scroll to bottom
                                </button>
                            </div>
                        )}

                        {/* Pagination Controls */}
                        {logs.length > 0 && totalPages > 1 && (
                            <div className="mt-4 flex items-center justify-between border-t border-gray-800 pt-3">
                                <div className="flex items-center gap-2">
                                    <label htmlFor="items-per-page" className="text-xs text-gray-400">Per page:</label>
                                    <select
                                        id="items-per-page"
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="bg-gray-800 text-gray-300 text-xs rounded px-2 py-1 border border-gray-700"
                                    >
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                        <option value={200}>200</option>
                                    </select>
                                    <span className="text-xs text-gray-500">
                                        Showing {startIndex + 1}-{Math.min(endIndex, logs.length)} of {logs.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                        className="px-2 py-1 text-xs bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-gray-700 rounded"
                                    >
                                        ««
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="px-2 py-1 text-xs bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-gray-700 rounded"
                                    >
                                        «
                                    </button>
                                    <span className="px-3 py-1 text-xs text-gray-200 font-medium">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-2 py-1 text-xs bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-gray-700 rounded"
                                    >
                                        »
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className="px-2 py-1 text-xs bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed border border-gray-700 rounded"
                                    >
                                        »»
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
