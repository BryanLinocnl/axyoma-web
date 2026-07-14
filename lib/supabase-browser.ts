import { createClient } from '@supabase/supabase-js'

// Cliente Supabase do navegador (landing). Anon key é pública. Sessão fica no
// localStorage; OAuth usa PKCE com detecção do code na URL de retorno.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
)

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
