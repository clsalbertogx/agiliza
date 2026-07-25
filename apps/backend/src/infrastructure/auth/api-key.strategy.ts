// Simple API key validation for B2B tenants
export function validateApiKey(apiKey: string, tenantApiKey: string): boolean {
  // In production, compare against stored hash
  return apiKey === tenantApiKey;
}
