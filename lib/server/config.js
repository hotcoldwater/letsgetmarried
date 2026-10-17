import 'server-only';
export const REQUIRED = ['APP_URL', 'DATABASE_URL'];
export function missingConfig() { return REQUIRED.filter(key => !process.env[key]?.trim()); }
export function configuration() {
  if (missingConfig().length) throw new Error('CONFIG_MISSING');
  const origin = new URL(process.env.APP_URL).origin;
  if (!origin.startsWith('https://') && origin !== 'http://localhost:3000') throw new Error('APP_URL_INVALID');
  return { origin };
}
