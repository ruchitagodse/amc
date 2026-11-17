export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly errorCode = "VALIDATION_ERROR";
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly errorCode = "UNAUTHORIZED";
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly errorCode = "FORBIDDEN";

  constructor(message = "Access denied", context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class DeviceNotAllowedError extends AppError {
  readonly statusCode = 403;
  readonly errorCode = "DEVICE_NOT_ALLOWED";

  constructor(
    message = "Your account is restricted to computer access. Please sign in using a laptop or desktop computer.",
    context?: Record<string, unknown>,
  ) {
    super(message, context);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly errorCode = "NOT_FOUND";

  constructor(resource: string, id?: string) {
    super(`${resource} not found`, id ? { resource, id } : { resource });
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly errorCode = "CONFLICT";
}

export class ExternalServiceError extends AppError {
  readonly statusCode = 502;
  readonly errorCode = "EXTERNAL_SERVICE_ERROR";
}

export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly errorCode = "INTERNAL_ERROR";
}
