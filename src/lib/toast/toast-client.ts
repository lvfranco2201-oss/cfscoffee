/**
 * Toast API Client — CFSCoffee BI
 *
 * Autenticación OAuth2 Machine-to-Machine (TOAST_MACHINE_CLIENT).
 * El token JWT (~5h de vigencia) se cachea en memoria y se renueva
 * automáticamente cuando expira, evitando un login por cada petición.
 *
 * Docs: https://doc.toasttab.com/doc/devguide/authentication.html
 */

import { env } from '@/lib/env';

// ── Token cache in-process ────────────────────────────────────────────────────
interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix timestamp (ms)
}

let tokenCache: TokenCache | null = null;

// Refresh the token 5 minutes before real expiry to avoid edge-case failures
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

interface ToastAuthResponse {
  token: {
    tokenType: string;
    expiresIn: number; // seconds remaining
    accessToken: string;
  };
  status: string;
}

/**
 * Obtiene un Bearer token válido de la API de Toast.
 * Reutiliza el token en caché mientras no haya expirado.
 */
export async function getToastToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid
  if (tokenCache && tokenCache.expiresAt - now > TOKEN_REFRESH_BUFFER_MS) {
    return tokenCache.accessToken;
  }

  const loginUrl = `${env.toast.apiHostname}/authentication/v1/authentication/login`;

  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId:       env.toast.clientId,
      clientSecret:   env.toast.clientSecret,
      userAccessType: env.toast.userAccessType,
    }),
    // No caching — always get fresh token from Toast
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Toast auth failed [${response.status}]: ${body}`
    );
  }

  const data: ToastAuthResponse = await response.json();

  if (data.status !== 'SUCCESS' || !data.token?.accessToken) {
    throw new Error(`Toast auth returned unexpected response: ${JSON.stringify(data)}`);
  }

  // Cache the new token
  tokenCache = {
    accessToken: data.token.accessToken,
    // expiresIn is in seconds — convert to ms and anchor to now
    expiresAt: now + data.token.expiresIn * 1000,
  };

  console.log(
    `[Toast] Token renovado. Expira en ${Math.round(data.token.expiresIn / 60)} minutos.`
  );

  return tokenCache.accessToken;
}

/**
 * Wrapper sobre fetch que inyecta automáticamente:
 *   - Authorization: Bearer <token>
 *   - Toast-Restaurant-External-ID: <restaurantGuid>  (si se provee)
 *
 * @param path         Path relativo al hostname de Toast (ej: /era/v1/restaurants)
 * @param init         Opciones estándar de fetch (method, body, etc.)
 * @param restaurantGuid GUID del restaurante para peticiones con contexto de restaurante
 */
export async function toastFetch<T>(
  path: string,
  init: RequestInit = {},
  restaurantGuid?: string
): Promise<T> {
  const token = await getToastToken();

  const headers: Record<string, string> = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
    ...(restaurantGuid ? { 'Toast-Restaurant-External-ID': restaurantGuid } : {}),
    // Spread any custom headers provided by the caller
    ...(init.headers as Record<string, string> ?? {}),
  };

  const url = `${env.toast.apiHostname}${path}`;

  const response = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Toast API error [${response.status}] ${init.method ?? 'GET'} ${path}: ${body}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Invalida el token en caché (útil para tests o forzar re-login).
 */
export function invalidateToastToken(): void {
  tokenCache = null;
}
