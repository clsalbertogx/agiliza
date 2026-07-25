import { describe, it, expect } from 'vitest';

describe('Brute Force Protection — SEC-09', () => {
  it('should rate-limit login endpoint at 20 req/min per IP', () => {
    // Given an IP address
    // When 21 login attempts are made in 1 minute
    // Then the 21st attempt returns 429
    expect(true).toBe(false);
  });

  it('should return 429 on 6th failed login attempt (lockout)', () => {
    // Given a valid tenant email
    // When 5 consecutive login attempts fail
    // Then the 6th attempt (even with correct password) returns 429
    expect(true).toBe(false);
  });

  it('should lockout by account, not just by IP', () => {
    // Given a tenant account
    // When failing login from IP 1.2.3.4 (5 times)
    // Then login from IP 5.6.7.8 also triggers lockout
    expect(true).toBe(false);
  });

  it('should reset lockout after cool-down period (15 min)', () => {
    // Given a locked account
    // When waiting 15 minutes
    // Then login should succeed with correct credentials
    expect(true).toBe(false);
  });
});
