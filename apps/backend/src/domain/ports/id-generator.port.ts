export interface IdGeneratorPort {
  generate(): string;
  validate(id: string): boolean;
}