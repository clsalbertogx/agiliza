import { randomUUID } from 'node:crypto';

export abstract class Entity<T> {
  protected readonly _id: string;
  protected readonly _createdAt: Date;
  protected _updatedAt: Date;

  constructor(id?: string, createdAt?: Date, updatedAt?: Date) {
    this._id = id || randomUUID();
    this._createdAt = createdAt || new Date();
    this._updatedAt = updatedAt || new Date();
  }

  get id(): string {
    return this._id;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  public equals(other: Entity<T>): boolean {
    if (!other) return false;
    if (this === other) return true;
    return this._id === other._id;
  }

  abstract toJSON(): Record<string, unknown>;
}
