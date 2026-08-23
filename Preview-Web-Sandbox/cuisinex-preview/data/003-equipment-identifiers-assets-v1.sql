-- CuisineX V1 RC1 — public schema for equipment identifiers and assets
-- Apply after 002-equipment-acquisition-v1.sql.
-- Public projection contains only non-sensitive identifiers and sanitized/public assets.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS equipment_identifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id TEXT NOT NULL,
  identifier_type TEXT NOT NULL,
  identifier_value TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  source_type TEXT,
  source_ref TEXT,
  confidence TEXT NOT NULL DEFAULT 'documented',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('private','masked','public')),
  notes TEXT,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
  UNIQUE (equipment_id, identifier_type, identifier_value)
);

CREATE TABLE IF NOT EXISTS equipment_assets (
  asset_id TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  file_path TEXT,
  external_url TEXT,
  captured_at TEXT,
  caption_fr TEXT,
  source_type TEXT,
  visibility TEXT NOT NULL DEFAULT 'sanitized_public' CHECK (visibility IN ('private','sanitized_public','public')),
  contains_serial_or_unique_id INTEGER NOT NULL DEFAULT 0 CHECK (contains_serial_or_unique_id IN (0,1)),
  contains_personal_data INTEGER NOT NULL DEFAULT 0 CHECK (contains_personal_data IN (0,1)),
  sha256 TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
  CHECK (file_path IS NOT NULL OR external_url IS NOT NULL)
);

INSERT OR IGNORE INTO equipment_identifiers(equipment_id,identifier_type,identifier_value,is_primary,source_type,confidence,visibility,notes) VALUES
('EQP-NINJA-AF500EU','model','AF500EU',1,'manufacturer/manual','documented','public','Model identifier'),
('EQP-MOULINEX-CE705100','model','CE705100',1,'manufacturer/manual','documented','public','Model identifier'),
('EQP-MOULINEX-CE705100','series','EPC03',0,'user_manual','documented','public','Series stated in supplied manual'),
('EQP-ELECTROLUX-EHH6333FOK','model','EHH6333FOK',1,'manufacturer/manual','documented','public','Model identifier'),
('EQP-ELECTROLUX-EHH6333FOK','PNC','94959616700',0,'user_manual','documented','public','Product number from supplied manual'),
('EQP-AREBOS-AR-HE-EA28TW','model','AR-HE-EA28TW',1,'manufacturer_product_page','documented','public','Model identifier');
