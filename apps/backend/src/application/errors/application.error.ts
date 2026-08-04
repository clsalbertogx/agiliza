export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }

  static notFound(resource: string, id?: string): ApplicationError {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    return new ApplicationError(message, 'NOT_FOUND', 404);
  }

  static validation(message: string): ApplicationError {
    return new ApplicationError(message, 'VALIDATION_ERROR', 400);
  }

  static conflict(message: string): ApplicationError {
    return new ApplicationError(message, 'CONFLICT', 409);
  }

  static unauthorized(message: string = 'Unauthorized'): ApplicationError {
    return new ApplicationError(message, 'UNAUTHORIZED', 401);
  }

  static forbidden(message: string = 'Forbidden'): ApplicationError {
    return new ApplicationError(message, 'FORBIDDEN', 403);
  }

  static internal(message: string = 'Internal server error'): ApplicationError {
    return new ApplicationError(message, 'INTERNAL_ERROR', 500);
  }

  static providerError(provider: string, message: string): ApplicationError {
    return new ApplicationError(`${provider} error: ${message}`, 'PROVIDER_ERROR', 502);
  }

  static configuration(message: string): ApplicationError {
    return new ApplicationError(message, 'CONFIGURATION_ERROR', 500);
  }
}
