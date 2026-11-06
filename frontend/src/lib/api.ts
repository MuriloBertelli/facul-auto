import type { Session } from '@supabase/supabase-js';

export class ApiError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}

const configurationMessage = 'VITE_API_BASE_URL inválida. Use apenas a origem HTTPS do backend Java (por exemplo, https://api.seu-dominio.com), sem caminho, credenciais ou parâmetros. Para desenvolvimento, HTTP é permitido somente em localhost.';
const configuredApiOrigin = import.meta.env?.VITE_API_BASE_URL;

export function validateApiOrigin(value: string | undefined): string {
  const configured = value?.trim();
  if (!configured) return '';
  try {
    if (!/^https?:\/\/[^/?#\\]+\/?$/i.test(configured)) throw new Error();
    const url = new URL(configured);
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
      || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    return url.origin;
  } catch { throw new ApiError(configurationMessage, 'API_CONFIGURATION'); }
}

export function resolveApiUrl(path: string, configuredOrigin: string | undefined): string {
  if (!path.startsWith('/api/') || path.includes('\\')) throw new ApiError('Rota interna da API inválida.', 'API_CONFIGURATION');
  const origin = validateApiOrigin(configuredOrigin);
  return origin ? `${origin}${path}` : path;
}

export const apiConfigurationError = (() => {
  try { validateApiOrigin(configuredApiOrigin); return null; }
  catch (error) { return error instanceof Error ? error.message : configurationMessage; }
})();

export async function apiRequest<T>(path: string, session: Session | null, init: RequestInit = {}, timeout = 20_000): Promise<T> {
  const url = resolveApiUrl(path, configuredApiOrigin);
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
  // The Supabase session is sent only to the fixed configured backend, never through redirects.
  const response = await fetch(url, { ...init, headers, redirect: 'error', signal: AbortSignal.timeout(timeout) });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'error' in body ? String(body.error) : 'Não foi possível acessar a API Java.';
    const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string' ? body.code : undefined;
    throw new ApiError(detail, code);
  }
  return body as T;
}
