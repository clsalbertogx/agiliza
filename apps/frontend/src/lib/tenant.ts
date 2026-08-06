export function getTenantId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tenant_id');
  }
  return null;
}
