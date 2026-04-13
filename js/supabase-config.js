// ============================================================
// VH Vastgoed — Supabase Configuration
// ============================================================

const SUPABASE_URL = 'https://vziiwmfrqzdosnlnenbq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6aWl3bWZycXpkb3NubG5lbmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjgxMjYsImV4cCI6MjA5MDY0NDEyNn0.Ly13VigW5Hq70DwXlgJPHlgetQIC-bzmZGblx9NscF0';

// Create the Supabase client — stored as 'db' to avoid name conflict with the CDN global
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
