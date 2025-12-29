
export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

export class Logger {
    constructor(private context: string) { }

    private log(level: LogLevel, message: string, meta?: Record<string, any>) {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
        const formattedMessage = `[${timestamp}] [${level}] [${this.context}] ${message}${metaStr}`;

        switch (level) {
            case LogLevel.ERROR:
                console.error(formattedMessage);
                break;
            case LogLevel.WARN:
                console.warn(formattedMessage);
                break;
            case LogLevel.DEBUG:
                // Check env var or default to showing debug for this assessment
                if (process.env.LOG_LEVEL === 'DEBUG' || true) {
                    console.debug(formattedMessage);
                }
                break;
            default:
                console.log(formattedMessage);
        }
    }

    info(message: string, meta?: Record<string, any>) {
        this.log(LogLevel.INFO, message, meta);
    }

    warn(message: string, meta?: Record<string, any>) {
        this.log(LogLevel.WARN, message, meta);
    }

    error(message: string, meta?: Record<string, any>) {
        this.log(LogLevel.ERROR, message, meta);
    }

    debug(message: string, meta?: Record<string, any>) {
        this.log(LogLevel.DEBUG, message, meta);
    }
}
