import { v7 as uuidv7 } from 'uuid';

export abstract class Entity<T> {
  readonly id: string;
  protected props: T;

  constructor(props: T, id?: string) {
    this.id = id ?? uuidv7();
    this.props = props;
  }

  public equals(other: Entity<T>): boolean {
    if (!other) return false;
    if (this === other) return true;
    return this.id === other.id;
  }

  abstract toPersistence(): Record<string, unknown>;
  abstract toViewModel(): Record<string, unknown>;
}
