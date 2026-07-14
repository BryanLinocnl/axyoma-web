import { createClient } from '@supabase/supabase-js'

// Cliente Supabase do navegador (landing). Anon key é pública. Sessão fica no
// localStorage; OAuth usa PKCE com detecção do code na URL de retorno.
//
// IMPORTANTE: usamos fallback de placeholder VÁLIDO quando a env não está
// presente. Sem isso, `createClient(undefined)` lança "supabaseUrl is required"
// já no import — o que QUEBRA O BUILD do Next ao prerenderizar /conta, /login,
// /signup. Com o placeholder o build passa; em runtime a env real (setada na
// Vercel) é inlinada e o cliente funciona normalmente.
const SUPABASE_URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_ENV = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key-placeholder'

export const supabase = createClient(SUPABASE_URL_ENV, SUPABASE_ANON_ENV, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})

export const SUPABASE_URL = SUPABASE_URL_ENV
