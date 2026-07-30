export interface UnitOfWorkPort {
  execute<T>(fn: () => Promise<T>): Promise<T>;
}