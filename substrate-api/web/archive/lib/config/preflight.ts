/**
 * Configuration preflight checker
 * Validates required environment variables and provides helpful error messages
 */

interface PreflightResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  mode: 'mock' | 'remote';
}

interface EnvironmentConfig {
  API_MODE?: string;
  NEXT_PUBLIC_API_MODE?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  NEXT_PUBLIC_API_BASE_URL?: string;
  BACKEND_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
}

/**
 * Get current environment configuration
 */
function getEnvironmentConfig(): EnvironmentConfig {
  if (typeof window !== 'undefined') {
    // Client-side - only public env vars available
    return {
      NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    };
  } else {
    // Server-side - all env vars available
    return {
      API_MODE: process.env.API_MODE,
      NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
      BACKEND_URL: process.env.BACKEND_URL,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    };
  }
}

/**
 * Perform preflight checks on environment configuration
 */
export function runPreflightChecks(): PreflightResult {
  const config = getEnvironmentConfig();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Determine API mode
  const apiMode = config.API_MODE || config.NEXT_PUBLIC_API_MODE || 'remote';
  const mode = apiMode === 'mock' ? 'mock' : 'remote';
  
  if (mode === 'remote') {
    // Check required variables for remote mode
    if (!config.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push('NEXT_PUBLIC_SUPABASE_URL is required for remote API mode');
    }
    
    if (!config.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required for remote API mode');
    }
    
    // Server-side checks
    if (typeof window === 'undefined' && !config.SUPABASE_SERVICE_ROLE_KEY) {
      warnings.push('SUPABASE_SERVICE_ROLE_KEY is recommended for server-side operations');
    }
    
    // API endpoint checks
    if (!config.NEXT_PUBLIC_API_BASE_URL && !config.BACKEND_URL) {
      warnings.push('NEXT_PUBLIC_API_BASE_URL or BACKEND_URL should be set for external API calls');
    }
  }
  
  // General checks
  if (!config.NEXT_PUBLIC_SITE_URL && typeof window === 'undefined') {
    warnings.push('NEXT_PUBLIC_SITE_URL is recommended for absolute URL generation');
  }
  
  // Validate URL formats
  if (config.NEXT_PUBLIC_SUPABASE_URL && !isValidUrl(config.NEXT_PUBLIC_SUPABASE_URL)) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must be a valid URL');
  }
  
  if (config.NEXT_PUBLIC_API_BASE_URL && !isValidUrl(config.NEXT_PUBLIC_API_BASE_URL)) {
    errors.push('NEXT_PUBLIC_API_BASE_URL must be a valid URL');
  }
  
  if (config.NEXT_PUBLIC_SITE_URL && !isValidUrl(config.NEXT_PUBLIC_SITE_URL)) {
    errors.push('NEXT_PUBLIC_SITE_URL must be a valid URL');
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings,
    mode,
  };
}

/**
 * Validate URL format
 */
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get user-friendly setup instructions
 */
export function getSetupInstructions(result: PreflightResult): string[] {
  const instructions: string[] = [];
  
  if (result.mode === 'remote' && !result.passed) {
    instructions.push(
      '1. Copy .env.example to .env.local',
      '2. Set up your Supabase project at https://supabase.com',
      '3. Add your Supabase URL and anon key to .env.local',
      '4. Optionally set BACKEND_URL for external API integration'
    );
  }
  
  if (result.mode === 'mock') {
    instructions.push(
      'Running in mock mode - no external services required.',
      'Set API_MODE=remote in .env.local to use live services.'
    );
  }
  
  return instructions;
}

/**
 * Environment summary for development
 */
export function getEnvironmentSummary(): Record<string, string> {
  const config = getEnvironmentConfig();
  const result = runPreflightChecks();
  
  return {
    mode: result.mode,
    nodeEnv: process.env.NODE_ENV || 'development',
    hasSupabase: (!!(config.NEXT_PUBLIC_SUPABASE_URL && config.NEXT_PUBLIC_SUPABASE_ANON_KEY)).toString(),
    hasBackendUrl: (!!(config.NEXT_PUBLIC_API_BASE_URL || config.BACKEND_URL)).toString(),
    passed: result.passed.toString(),
    errors: result.errors.length.toString(),
    warnings: result.warnings.length.toString(),
  };
}