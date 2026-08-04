import { describe, expect, it } from 'vitest';
import { Entity } from '@/domain/entities/base.entity';

class TestEntity extends Entity<{ name: string }> {
  constructor(
    public readonly props: { name: string },
    id?: string,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(
      // biome-ignore lint/style/noNonNullAssertion: test helper forwards an optional id to the required base param
      id!,
      createdAt,
      updatedAt,
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.props.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

describe('Entity Base', () => {
  it('should generate an id when not provided', () => {
    const entity = new TestEntity({ name: 'Test' }, 'auto-generated-id');
    expect(entity.id).toBe('auto-generated-id');
    expect(typeof entity.id).toBe('string');
  });

  it('should use the provided id', () => {
    const entity = new TestEntity({ name: 'Test' }, 'fixed-id');
    expect(entity.id).toBe('fixed-id');
  });

  it('should use the provided createdAt date', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const entity = new TestEntity({ name: 'Test' }, undefined, date);
    expect(entity.createdAt).toBe(date);
  });

  it('should set createdAt when not provided', () => {
    const before = new Date();
    const entity = new TestEntity({ name: 'Test' });
    const after = new Date();
    expect(entity.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(entity.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should use the provided updatedAt date', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const entity = new TestEntity({ name: 'Test' }, undefined, undefined, date);
    expect(entity.updatedAt).toBe(date);
  });

  it('should set updatedAt when not provided', () => {
    const before = new Date();
    const entity = new TestEntity({ name: 'Test' });
    const after = new Date();
    expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(entity.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  describe('equals', () => {
    it('should return true for the same entity reference', () => {
      const entity = new TestEntity({ name: 'Test' });
      expect(entity.equals(entity)).toBe(true);
    });

    it('should return true for entities with the same id', () => {
      const entity1 = new TestEntity({ name: 'Test 1' }, 'same-id');
      const entity2 = new TestEntity({ name: 'Test 2' }, 'same-id');
      expect(entity1.equals(entity2)).toBe(true);
    });

    it('should return false for entities with different ids', () => {
      const entity1 = new TestEntity({ name: 'Test' }, 'id-1');
      const entity2 = new TestEntity({ name: 'Test' }, 'id-2');
      expect(entity1.equals(entity2)).toBe(false);
    });

    it('should return false when compared to null', () => {
      const entity = new TestEntity({ name: 'Test' });
      expect(entity.equals(null as unknown as Entity<{ name: string }>)).toBe(false);
    });

    it('should return false when compared to undefined', () => {
      const entity = new TestEntity({ name: 'Test' });
      expect(entity.equals(undefined as unknown as Entity<{ name: string }>)).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should return a JSON representation', () => {
      const entity = new TestEntity({ name: 'Test Name' }, 'json-test-id');
      const json = entity.toJSON();
      expect(json).toEqual({
        id: 'json-test-id',
        name: 'Test Name',
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      });
    });
  });
});
