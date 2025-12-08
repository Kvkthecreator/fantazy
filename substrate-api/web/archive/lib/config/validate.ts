export function validateEnvironment() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Check for localhost in production
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    
    if (supabaseUrl?.includes('localhost') || supabaseUrl?.includes('127.0.0.1')) {
      console.error('CRITICAL: Localhost Supabase URL in production environment!');
    }
    
    if (apiBaseUrl?.includes('localhost') || apiBaseUrl?.includes('127.0.0.1')) {
      console.error('CRITICAL: Localhost API URL in production environment!');
    }
  }
}

// Log environment info (without exposing sensitive data)
export function logEnvironmentInfo() {
  if (typeof window !== 'undefined') {
    console.log('Environment Info:', {
      hostname: window.location.hostname,
      isProduction: process.env.NODE_ENV === 'production',
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasApiUrl: !!process.env.NEXT_PUBLIC_API_BASE_URL,
    });
  }
}