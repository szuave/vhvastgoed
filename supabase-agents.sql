-- ============================================================
-- VH Vastgoed — Agents Table & Setup
-- ============================================================

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    title TEXT DEFAULT 'Vastgoedmakelaar',
    bio TEXT,
    photo_path TEXT,
    biv_number TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add agent_id to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_public_select" ON agents FOR SELECT USING (true);
CREATE POLICY "agents_auth_insert" ON agents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "agents_auth_update" ON agents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "agents_auth_delete" ON agents FOR DELETE TO authenticated USING (true);

-- Auto-update trigger
CREATE TRIGGER trg_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Storage bucket for agent photos
INSERT INTO storage.buckets (id, name, public) VALUES ('agent-photos', 'agent-photos', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "agent_photos_public_select" ON storage.objects FOR SELECT USING (bucket_id = 'agent-photos');
CREATE POLICY "agent_photos_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'agent-photos');
CREATE POLICY "agent_photos_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'agent-photos') WITH CHECK (bucket_id = 'agent-photos');
CREATE POLICY "agent_photos_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'agent-photos');
