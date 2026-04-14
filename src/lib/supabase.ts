import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Chýba VITE_SUPABASE_URL alebo VITE_SUPABASE_PUBLISHABLE_KEY v .env súbore.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)