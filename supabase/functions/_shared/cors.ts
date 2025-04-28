// supabase/functions/_shared/cors.ts
// Shared CORS headers for Supabase Edge Functions

export const corsHeaders = {
  // IMPORTANT: For production, replace '*' with your deployed frontend's specific origin URL
  // Example: 'https://your-app-name.github.io' or 'https://www.yourdomain.com'
  'Access-Control-Allow-Origin': '*',

  // Headers allowed in the actual request from the frontend
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',

  // Methods allowed for the function
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST for data, OPTIONS for preflight
}
