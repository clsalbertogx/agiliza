export interface DomainMapper<TPersistence, TDomain> {
  toDomain(persistence: TPersistence): TDomain;
  toPersistence(domain: TDomain): TPersistence;
}
