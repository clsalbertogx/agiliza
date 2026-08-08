/**
 * Single source of truth for the backend version.
 * Reads npm_package_version (set by npm from package.json) when available,
 * otherwise falls back to the literal below — kept in sync with the current
 * git tag (v0.12.0). Update both package.json and this fallback on release.
 */
export const VERSION: string = process.env.npm_package_version ?? '0.12.0';
