export function getTenantId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tenant_id') || 'demo';
  }
  return 'demo';
}
