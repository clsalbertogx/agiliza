import { describe, it, expect } from 'vitest';
import { ApplicationError } from '@/application/errors/application.error';

describe('ApplicationError', () => {
  describe('factory methods', () => {
    it('should create notFound error', () => {
      const error = ApplicationError.notFound('User', '123');
      expect(error.message).toBe('User with id 123 not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should create notFound error without id', () => {
      const error = ApplicationError.notFound('User');
      expect(error.message).toBe('User not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should create validation error', () => {
      const error = ApplicationError.validation('Invalid email');
      expect(error.message).toBe('Invalid email');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('should create conflict error', () => {
      const error = ApplicationError.conflict('Email already exists');
      expect(error.message).toBe('Email already exists');
      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
    });

    it('should create unauthorized error', () => {
      const error = ApplicationError.unauthorized('Invalid token');
      expect(error.message).toBe('Invalid token');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
    });

    it('should create unauthorized error with default message', () => {
      const error = ApplicationError.unauthorized();
      expect(error.message).toBe('Unauthorized');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
    });

    it('should create forbidden error', () => {
      const error = ApplicationError.forbidden('Access denied');
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
    });

    it('should create internal error', () => {
      const error = ApplicationError.internal('Database connection failed');
      expect(error.message).toBe('Database connection failed');
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should create provider error', () => {
      const error = ApplicationError.providerError('Asaas', 'API timeout');
      expect(error.message).toBe('Asaas error: API timeout');
      expect(error.code).toBe('PROVIDER_ERROR');
      expect(error.statusCode).toBe(502);
    });

    it('should create configuration error', () => {
      const error = ApplicationError.configuration('Missing API key');
      expect(error.message).toBe('Missing API key');
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('instance properties', () => {
    it('should have correct name', () => {
      const error = ApplicationError.validation('test');
      expect(error.name).toBe('ApplicationError');
    });

    it('should be instanceof Error', () => {
      const error = ApplicationError.validation('test');
      expect(error instanceof Error).toBe(true);
    });

    it('should be instanceof ApplicationError', () => {
      const error = ApplicationError.validation('test');
      expect(error instanceof ApplicationError).toBe(true);
    });
  });
});