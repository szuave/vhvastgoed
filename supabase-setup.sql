-- ============================================================
-- VH Vastgoed — Supabase Database Setup
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Basic info
    type            TEXT NOT NULL CHECK (type IN (
                        'appartement','woning','villa','grond',
                        'handelspand','studio','garage','kantoor'
                    )),
    title           TEXT NOT NULL,
    address         TEXT,
    postal_code     TEXT,
    city            TEXT,
    price           NUMERIC,
    status          TEXT NOT NULL CHECK (status IN (
                        'te koop','te huur','verkocht','verhuurd'
                    )),
    description     TEXT,
    reference_nr    TEXT UNIQUE,
    featured        BOOLEAN NOT NULL DEFAULT false,
    sort_order      INTEGER NOT NULL DEFAULT 0,

    -- Specs
    bedrooms        SMALLINT,
    bathrooms       SMALLINT,
    living_area     NUMERIC,
    total_area      NUMERIC,
    floors          SMALLINT,
    build_year      SMALLINT,
    condition       TEXT CHECK (condition IN (
                        'nieuw','uitstekend','goed',
                        'te renoveren','gerenoveerd'
                    )),
    orientation     TEXT,

    -- Features
    garden          BOOLEAN,
    terrace         BOOLEAN,
    terrace_area    NUMERIC,
    garage          BOOLEAN,
    parking         BOOLEAN,
    cellar          BOOLEAN,
    attic           BOOLEAN,
    elevator        BOOLEAN,
    alarm           BOOLEAN,
    video_intercom  BOOLEAN,
    furnished       BOOLEAN,
    kitchen_type    TEXT,
    bathroom_type   TEXT,
    toilets         SMALLINT,
    laundry_room    BOOLEAN,

    -- Energy
    epc_score       NUMERIC,
    epc_label       TEXT CHECK (epc_label IN ('A','B','C','D','E','F')),
    epc_unique_code TEXT,
    heating_type    TEXT,
    heating_system  TEXT,
    double_glazing  BOOLEAN,
    window_type     TEXT,
    electricity_inspection BOOLEAN,

    -- Legal / Stedenbouw
    building_permit       BOOLEAN,
    subdivision_permit    BOOLEAN,
    pre_emption_right     BOOLEAN,
    flood_zone            TEXT,
    g_score               TEXT,
    p_score               TEXT,
    judgments              TEXT,
    servitude              TEXT,
    destination            TEXT
);

-- Property media table
CREATE TABLE IF NOT EXISTS property_media (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    type          TEXT NOT NULL CHECK (type IN ('photo','video','document')),
    storage_path  TEXT NOT NULL,
    file_name     TEXT,
    mime_type     TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_primary    BOOLEAN NOT NULL DEFAULT false,
    label         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_properties_status
    ON properties (status);

CREATE INDEX IF NOT EXISTS idx_properties_featured
    ON properties (featured)
    WHERE featured = true;

CREATE INDEX IF NOT EXISTS idx_properties_type_status
    ON properties (type, status);

CREATE INDEX IF NOT EXISTS idx_property_media_property_id
    ON property_media (property_id);


-- ============================================================
-- 3. AUTO-UPDATE TRIGGER FOR updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_properties_updated_at ON properties;

CREATE TRIGGER trg_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on both tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_media ENABLE ROW LEVEL SECURITY;

-- Properties policies
CREATE POLICY "properties_public_select"
    ON properties FOR SELECT
    USING (true);

CREATE POLICY "properties_auth_insert"
    ON properties FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "properties_auth_update"
    ON properties FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "properties_auth_delete"
    ON properties FOR DELETE
    TO authenticated
    USING (true);

-- Property media policies
CREATE POLICY "property_media_public_select"
    ON property_media FOR SELECT
    USING (true);

CREATE POLICY "property_media_auth_insert"
    ON property_media FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "property_media_auth_update"
    ON property_media FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "property_media_auth_delete"
    ON property_media FOR DELETE
    TO authenticated
    USING (true);


-- ============================================================
-- 5. STORAGE BUCKET
-- ============================================================

-- Create the public storage bucket for property media
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-media', 'property-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies

-- Anyone can view / download files
CREATE POLICY "property_media_storage_public_select"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'property-media');

-- Authenticated users can upload
CREATE POLICY "property_media_storage_auth_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'property-media');

-- Authenticated users can update (overwrite)
CREATE POLICY "property_media_storage_auth_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'property-media')
    WITH CHECK (bucket_id = 'property-media');

-- Authenticated users can delete
CREATE POLICY "property_media_storage_auth_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'property-media');
