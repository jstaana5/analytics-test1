import { createClient } from '@supabase/supabase-js'

// These come from your .env.local file (see .env.example).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase keys. Copy .env.example to .env.local, fill in your URL and key, then restart `npm run dev`.'
  )
}

// One shared client for the whole app. Import it anywhere with:
//   import { supabase } from './supabase'
export const supabase = createClient(supabaseUrl, supabaseKey)
