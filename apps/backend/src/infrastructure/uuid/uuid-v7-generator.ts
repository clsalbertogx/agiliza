import { v7 as uuidv7 } from 'uuid';
import type { IdGeneratorPort } from '@/domain/ports/id-generator.port';

export class UuidV7Generator implements IdGeneratorPort {
  generate(): string {
    return uuidv7();
  }

  validate(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }
}
