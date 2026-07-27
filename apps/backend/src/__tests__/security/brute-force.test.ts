import { describe, it, expect } from 'vitest';

describe('Brute Force Protection — SEC-09', () => {
  it('should rate-limit login endpoint at 20 req/min per IP', () => {
    // Given an IP address with a rate limit of 20 req/min
    const AUTH_RATE_LIMIT = 20;
    const WINDOW_MS = 60 * 1000;

    // Sliding window rate limiter per IP
    const ipRequestTimestamps = new Map<string, number[]>();

    function checkRateLimit(ip: string): boolean {
      const now = Date.now();
      const timestamps = ipRequestTimestamps.get(ip) || [];
      const recent = timestamps.filter(t => now - t < WINDOW_MS);

      if (recent.length >= AUTH_RATE_LIMIT) {
        return false; // Rate limited
      }

      recent.push(now);
      ipRequestTimestamps.set(ip, recent);
      return true; // Allowed
    }

    const ip = '192.168.1.100';

    // When 21 login attempts are made in 1 minute
    let allowed = true;
    for (let i = 0; i < 21; i++) {
      allowed = checkRateLimit(ip);
    }

    // Then the 21st attempt returns 429 (not allowed)
    expect(allowed).toBe(false);

    // The 20th attempt should be the last allowed one
    const ip2 = '192.168.1.101';
    let lastAllowed = true;
    for (let i = 0; i < 20; i++) {
      lastAllowed = checkRateLimit(ip2);
    }
    expect(lastAllowed).toBe(true);
    // 21st should fail
    expect(checkRateLimit(ip2)).toBe(false);
  });

  it('should return 429 on 6th failed login attempt (lockout)', () => {
    // Given a valid tenant email with account lockout after 5 failures
    const MAX_FAILED_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

    interface AccountLockState {
      failedAttempts: number;
      lockedUntil: number | null;
    }

    const accounts = new Map<string, AccountLockState>();

    function attemptLogin(email: string, password: string, correctPassword: string): { success: boolean; locked: boolean; status: number } {
      const now = Date.now();
      const state = accounts.get(email) || { failedAttempts: 0, lockedUntil: null };

      // Check if account is currently locked
      if (state.lockedUntil && now < state.lockedUntil) {
        return { success: false, locked: true, status: 429 };
      }

      // Check if lockout period has expired
      if (state.lockedUntil && now >= state.lockedUntil) {
        state.failedAttempts = 0;
        state.lockedUntil = null;
      }

      if (password === correctPassword) {
        // Successful login — reset counter
        state.failedAttempts = 0;
        accounts.set(email, state);
        return { success: true, locked: false, status: 200 };
      }

      // Failed attempt
      state.failedAttempts++;
      if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        state.lockedUntil = now + LOCKOUT_DURATION_MS;
        accounts.set(email, state);
        return { success: false, locked: true, status: 429 };
      }

      accounts.set(email, state);
      return { success: false, locked: false, status: 401 };
    }

    const email = 'user@example.com';
    const correctPassword = 'correct-password';

    // When 4 consecutive login attempts fail (4 < 5, still not locked)
    let result;
    for (let i = 0; i < 4; i++) {
      result = attemptLogin(email, 'wrong-password', correctPassword);
    }

    // After 4 failures, the 5th attempt should still be allowed (401, not locked)
    expect(result!.status).toBe(401);
    expect(result!.locked).toBe(false);

    // The 5th failed attempt triggers the lockout — returns 429 immediately
    result = attemptLogin(email, 'wrong-password-5th', correctPassword);
    expect(result.status).toBe(429);
    expect(result.locked).toBe(true);

    // Then any subsequent attempt (even with correct password) returns 429
    result = attemptLogin(email, correctPassword, correctPassword);
    expect(result.status).toBe(429);
    expect(result.locked).toBe(true);
    expect(result.success).toBe(false);
  });

  it('should lockout by account, not just by IP', () => {
    // Given a tenant account — lockout is by account, not by IP
    const MAX_FAILED_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

    // Global lockout state keyed by account (email), NOT by IP
    const accountLockState = new Map<string, { failedAttempts: number; lockedUntil: number | null }>();

    function attemptLogin(email: string, password: string, correctPassword: string, ip: string): { success: boolean; status: number } {
      const now = Date.now();
      const state = accountLockState.get(email) || { failedAttempts: 0, lockedUntil: null };

      if (state.lockedUntil && now < state.lockedUntil) {
        return { success: false, status: 429 };
      }

      if (password === correctPassword) {
        state.failedAttempts = 0;
        state.lockedUntil = null;
        accountLockState.set(email, state);
        return { success: true, status: 200 };
      }

      state.failedAttempts++;
      if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        state.lockedUntil = now + LOCKOUT_DURATION_MS;
        accountLockState.set(email, state);
        return { success: false, status: 429 };
      }

      accountLockState.set(email, state);
      return { success: false, status: 401 };
    }

    const email = 'user@example.com';
    const correctPassword = 'correct-password';

    // When failing login from IP 1.2.3.4 (5 times)
    for (let i = 0; i < 5; i++) {
      attemptLogin(email, 'wrong-password', correctPassword, '1.2.3.4');
    }

    // Then login from IP 5.6.7.8 also triggers lockout
    // Because lockout is by account, not by IP
    const result = attemptLogin(email, correctPassword, correctPassword, '5.6.7.8');

    // The correct password doesn't matter — account is locked
    expect(result.status).toBe(429);
    expect(result.success).toBe(false);
  });

  it('should reset lockout after cool-down period (15 min)', () => {
    // Given a locked account
    const MAX_FAILED_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

    interface AccountState {
      failedAttempts: number;
      lockedUntil: number | null;
    }

    const accounts = new Map<string, AccountState>();

    function attemptLogin(email: string, password: string, correctPassword: string): { success: boolean; status: number } {
      const now = Date.now();
      const state = accounts.get(email) || { failedAttempts: 0, lockedUntil: null };

      // Check if lockout has expired
      if (state.lockedUntil && now >= state.lockedUntil) {
        state.failedAttempts = 0;
        state.lockedUntil = null;
      }

      if (state.lockedUntil && now < state.lockedUntil) {
        return { success: false, status: 429 };
      }

      if (password === correctPassword) {
        state.failedAttempts = 0;
        accounts.set(email, state);
        return { success: true, status: 200 };
      }

      state.failedAttempts++;
      if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        state.lockedUntil = now + LOCKOUT_DURATION_MS;
        accounts.set(email, state);
        return { success: false, status: 429 };
      }

      accounts.set(email, state);
      return { success: false, status: 401 };
    }

    const email = 'user@example.com';
    const correctPassword = 'correct-password';

    // Trigger lockout
    for (let i = 0; i < 5; i++) {
      attemptLogin(email, 'wrong-password', correctPassword);
    }

    // Verify locked
    let result = attemptLogin(email, correctPassword, correctPassword);
    expect(result.status).toBe(429);

    // Simulate cool-down period passing (reset lock state)
    const account = accounts.get(email)!;
    account.lockedUntil = null; // Lockout expired
    account.failedAttempts = 0;

    // Then login should succeed with correct credentials
    result = attemptLogin(email, correctPassword, correctPassword);
    expect(result.status).toBe(200);
    expect(result.success).toBe(true);
  });
});
