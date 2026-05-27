/**
 * Environment Variable Validation — CFSCoffee BI
 * Validates all required env vars at startup.
 * Throws a descriptive error immediately if any are missing,
 * avoiding cryptic runtime failures deep in the request lifecycle.
 */

interface EnvVar {
  key: string;
  description: string;
  required: boolean;
}

const ENV_VARS: EnvVar[] = [
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'URL del proyecto Supabase (formato: https://xxx.supabase.co)',
    required: true,
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Clave anónima pública de Supabase (para auth en el cliente)',
    required: true,
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    description: 'Clave de servicio de Supabase (solo servidor — para administrar usuarios)',
    required: true,
  },
  {
    key: 'DATABASE_URL',
    description: 'Cadena de conexión PostgreSQL para Drizzle ORM',
    required: true,
  },
  {
    key: 'CRON_SECRET',
    description: 'Token secreto para autenticar llamadas al cron (desde Vercel)',
    required: false, // Optional: only required in production
  },
  // ── Toast Analytics API ────────────────────────────────────────────────────
  {
    key: 'TOAST_API_HOSTNAME',
    description: 'URL base de la API de Toast (ej: https://ws-api.toasttab.com)',
    required: true,
  },
  {
    key: 'TOAST_ANALYTICS_BASE_PATH',
    description: 'Base path de la Analytics API (ej: /era/v1)',
    required: true,
  },
  {
    key: 'TOAST_CLIENT_ID',
    description: 'Client ID de la Toast Analytics API (desde AWS Secrets Manager)',
    required: true,
  },
  {
    key: 'TOAST_CLIENT_SECRET',
    description: 'Client Secret de la Toast Analytics API (desde AWS Secrets Manager)',
    required: true,
  },
  {
    key: 'TOAST_USER_ACCESS_TYPE',
    description: 'Tipo de acceso Toast (siempre: TOAST_MACHINE_CLIENT)',
    required: false,
  },
];

function validateEnv(): void {
  // Skip detailed validation on the client side
  if (typeof window !== 'undefined') return;

  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.key];

    if (!value || value.trim() === '') {
      if (envVar.required) {
        missing.push(`  ❌ ${envVar.key}\n     ${envVar.description}`);
      } else {
        warnings.push(`  ⚠  ${envVar.key} (opcional)\n     ${envVar.description}`);
      }
    }
  }

  // Warn about optional missing vars
  if (warnings.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn(
      '\n[CFSCoffee BI] Variables de entorno opcionales no configuradas:\n' +
      warnings.join('\n') +
      '\n'
    );
  }

  // Fail hard on missing required vars
  if (missing.length > 0) {
    const message =
      '\n╔══════════════════════════════════════════════════════════════╗\n' +
      '║         CFSCoffee BI — Error de Configuración                ║\n' +
      '╚══════════════════════════════════════════════════════════════╝\n\n' +
      'Las siguientes variables de entorno son requeridas y no están definidas:\n\n' +
      missing.join('\n\n') +
      '\n\n' +
      'Pasos para solucionar:\n' +
      '  1. Copia el archivo .env.example a .env.local\n' +
      '  2. Completa los valores desde el dashboard de Supabase y tu DB\n' +
      '  3. Reinicia el servidor de desarrollo\n' +
      '  4. En Vercel: agrega las variables en Settings → Environment Variables\n\n';

    throw new Error(message);
  }
}

// Run validation once at module load time (server-side only)
validateEnv();

// ── Typed env exports ───────────────────────────────────────────────────────
// Use these throughout the app instead of process.env directly for type safety.
export const env = {
  supabaseUrl:            process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey:        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  databaseUrl:            process.env.DATABASE_URL!,
  cronSecret:             process.env.CRON_SECRET ?? '',
  nodeEnv:                process.env.NODE_ENV,
  isDev:                  process.env.NODE_ENV === 'development',
  isProd:                 process.env.NODE_ENV === 'production',
  // ── Toast Analytics API ───────────────────────────────────────────────────
  toast: {
    apiHostname:      process.env.TOAST_API_HOSTNAME!,
    analyticsBase:    process.env.TOAST_ANALYTICS_BASE_PATH ?? '/era/v1',
    clientId:         process.env.TOAST_CLIENT_ID!,
    clientSecret:     process.env.TOAST_CLIENT_SECRET!,
    userAccessType:   process.env.TOAST_USER_ACCESS_TYPE ?? 'TOAST_MACHINE_CLIENT',
    pollingIntervalMs: Number(process.env.TOAST_POLLING_INTERVAL_MS ?? '3000'),
    maxPollingAttempts: Number(process.env.TOAST_MAX_POLLING_ATTEMPTS ?? '20'),
  },
} as const;
