import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'https://xzwaisyiszdhwmyrnbkh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6d2Fpc3lpc3pkaHdteXJuYmtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MjQ2NjMsImV4cCI6MjA3NTUwMDY2M30.gf9vwF44EysfVHJBN_ifmosjIe3kpUn77TcWiaX51sY'

const supabase = createClient(supabaseUrl, supabaseKey)

export { supabase }
