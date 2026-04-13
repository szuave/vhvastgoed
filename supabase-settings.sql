CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_public_select" ON settings FOR SELECT USING (true);
CREATE POLICY "settings_auth_upsert" ON settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "settings_auth_update" ON settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
