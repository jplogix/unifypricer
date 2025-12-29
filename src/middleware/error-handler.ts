
import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

const logger = new Logger('ErrorHandler');

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
    logger.error(`Error processing request ${req.method} ${req.url}: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err.stack : undefined);

    // Default to 500 if not specified
    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Don't leak implementation details in 500 errors unless dev
    // For this project, we return message for now
    res.status(statusCode).json({
        error: message
    });
}
