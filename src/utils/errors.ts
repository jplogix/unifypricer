import { ErrorType } from '../types';

export { ErrorType };

export class AppError extends Error {
    constructor(
        public message: string,
        public type: ErrorType,
        public retryable: boolean = false,
        public originalError?: unknown
    ) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string, originalError?: unknown) {
        super(message, ErrorType.AUTHENTICATION, false, originalError);
    }
}

export class NetworkError extends AppError {
    constructor(message: string, retryable: boolean = true, originalError?: unknown) {
        super(message, ErrorType.NETWORK, retryable, originalError);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, originalError?: unknown) {
        super(message, ErrorType.VALIDATION, false, originalError);
    }
}

export class ConfigurationError extends AppError {
    constructor(message: string, originalError?: unknown) {
        super(message, ErrorType.CONFIGURATION, false, originalError);
    }
}
