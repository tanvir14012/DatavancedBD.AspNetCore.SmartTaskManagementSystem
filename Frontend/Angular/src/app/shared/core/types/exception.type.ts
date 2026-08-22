/**
 * Exception types for the framework
 */

export enum ErrorSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface IException {
  code: string;
  message: string;
  severity: ErrorSeverity;
  timestamp: Date;
  stack?: string;
  details?: Record<string, any>;
  cause?: Error | IException;
}

export class AppException extends Error implements IException {
  code: string;
  severity: ErrorSeverity;
  timestamp: Date;
  override stack?: string;
  details?: Record<string, any>;
  override cause?: Error | IException;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    details?: Record<string, any>,
    cause?: Error | IException
  ) {
    super(message);
    this.name = 'AppException';
    this.code = code;
    this.severity = severity;
    this.timestamp = new Date();
    this.details = details;
    this.cause = cause;

    Object.setPrototypeOf(this, AppException.prototype);
  }
}

export class ValidationException extends AppException {
  constructor(
    message: string,
    details?: Record<string, any>,
    cause?: Error
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      ErrorSeverity.WARNING,
      details,
      cause
    );
    this.name = 'ValidationException';
    Object.setPrototypeOf(this, ValidationException.prototype);
  }
}

export class NotFoundException extends AppException {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, 'NOT_FOUND', ErrorSeverity.WARNING, details, cause);
    this.name = 'NotFoundException';
    Object.setPrototypeOf(this, NotFoundException.prototype);
  }
}

export class UnauthorizedException extends AppException {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(
      message,
      'UNAUTHORIZED',
      ErrorSeverity.WARNING,
      details,
      cause
    );
    this.name = 'UnauthorizedException';
    Object.setPrototypeOf(this, UnauthorizedException.prototype);
  }
}

export class ForbiddenException extends AppException {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, 'FORBIDDEN', ErrorSeverity.WARNING, details, cause);
    this.name = 'ForbiddenException';
    Object.setPrototypeOf(this, ForbiddenException.prototype);
  }
}

export class ConflictException extends AppException {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, 'CONFLICT', ErrorSeverity.ERROR, details, cause);
    this.name = 'ConflictException';
    Object.setPrototypeOf(this, ConflictException.prototype);
  }
}

export class TimeoutException extends AppException {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, 'TIMEOUT', ErrorSeverity.ERROR, details, cause);
    this.name = 'TimeoutException';
    Object.setPrototypeOf(this, TimeoutException.prototype);
  }
}

export class RateLimitException extends AppException {
  readonly retryAfter?: number;

  constructor(
    message: string,
    retryAfter?: number,
    details?: Record<string, any>,
    cause?: Error
  ) {
    super(message, 'RATE_LIMIT', ErrorSeverity.WARNING, details, cause);
    this.name = 'RateLimitException';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitException.prototype);
  }
}

export class InvalidOperationException extends AppException {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(
      message,
      'INVALID_OPERATION',
      ErrorSeverity.ERROR,
      details,
      cause
    );
    this.name = 'InvalidOperationException';
    Object.setPrototypeOf(this, InvalidOperationException.prototype);
  }
}
