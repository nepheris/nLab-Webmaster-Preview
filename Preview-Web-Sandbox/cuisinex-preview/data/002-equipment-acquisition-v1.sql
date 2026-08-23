-- CuisineX V1 RC1 — public equipment acquisition/lifecycle extension
-- Apply after data/cuisinex-v1.sql

PRAGMA foreign_keys = ON;

ALTER TABLE equipment ADD COLUMN brand TEXT;
ALTER TABLE equipment ADD COLUMN model TEXT;
ALTER TABLE equipment ADD COLUMN category TEXT;
ALTER TABLE equipment ADD COLUMN ownership_status TEXT;
ALTER TABLE equipment ADD COLUMN purchase_date TEXT;
ALTER TABLE equipment ADD COLUMN acquired_date TEXT;
ALTER TABLE equipment ADD COLUMN retailer TEXT;
ALTER TABLE equipment ADD COLUMN retailer_url TEXT;
ALTER TABLE equipment ADD COLUMN purchase_price_eur REAL;
ALTER TABLE equipment ADD COLUMN warranty_end_date TEXT;
ALTER TABLE equipment ADD COLUMN manufacturer_url TEXT;
ALTER TABLE equipment ADD COLUMN support_url TEXT;
ALTER TABLE equipment ADD COLUMN manual_url TEXT;
ALTER TABLE equipment ADD COLUMN manual_repo_status TEXT;

INSERT OR REPLACE INTO equipment(id,name_fr,brand,model,category,ownership_status,purchase_date,acquired_date,retailer,retailer_url,purchase_price_eur,warranty_end_date,manufacturer_url,support_url,manual_url,manual_repo_status) VALUES
('EQP-NINJA-AF500EU','Ninja Foodi FlexDrawer AF500EU','Ninja','AF500EU','air_fryer','owned','2026-08-21','2026-08-21','Darty','https://www.darty.com/',179.99,'2028-08-21','https://ninjakitchen.fr/','https://support.ninjakitchen.fr/hc/fr/articles/17718607823388-S%C3%A9rie-AF500EU-Friteuse-sans-huile-Ninja-Foodi-Flex-FAQ','https://ninjakitchen.fr/INTERSHOP/web/WFS/SharkNinja-FR-Site/fr_FR/ninjafr/EUR/ViewProductAttachment-OpenFile?DirectoryPath=&FileName=AF500EU_IB_MP_230526_Mv1_LR.pdf&LocaleId=&UnitName=SharkNinja-FR','pending_binary_import'),
('EQP-MOULINEX-CE705100','Moulinex Cookeo 6 L CE705100','Moulinex','CE705100','electric_pressure_multicooker','owned','2018-02-19','2018-02-22','Darty','https://www.darty.com/',NULL,NULL,'https://www.moulinex.fr/','https://www.moulinex.fr/notices/cuisson-electrique/autocuiseur-electrique/cookeo-6l-50-recettes/csp/7211002928','https://www.moulinex.fr/notices/cuisson-electrique/autocuiseur-electrique/cookeo-6l-50-recettes/csp/7211002928','pending_binary_import'),
('EQP-ELECTROLUX-EHH6333FOK','Plaque induction Electrolux EHH6333FOK','Electrolux','EHH6333FOK','induction_hob','owned',NULL,'2016-11-03','Darty','https://www.darty.com/',NULL,NULL,'https://www.electrolux.fr/','https://shop.electrolux.fr/model/m/EHH6333FOK%20IZ4',NULL,'pending_binary_import'),
('EQP-AREBOS-AR-HE-EA28TW','Stérilisateur automatique Arebos 28 L 2500 W','Arebos','AR-HE-EA28TW','electric_preserver','ordered_in_transit','2026-08-21',NULL,'Amazon.fr','https://www.amazon.fr/',89.90,NULL,'https://www.arebos.fr/','https://www.arebos.fr/fr_fr/home-living/kuche/cuiseur-a-vin-chaud/sterilisateur-automatique-28l-2500w-1.html','https://about.arebos.de/shared-files/5408/?Einkochautomat_2500W_EN.pdf=','external_only');

CREATE TABLE IF NOT EXISTS equipment_lifecycle_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id TEXT NOT NULL,
  event_date TEXT,
  event_type TEXT NOT NULL,
  cost_eur REAL,
  notes TEXT,
  source_status TEXT,
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);

CREATE VIEW IF NOT EXISTS equipment_lifecycle_summary AS
SELECT e.id,e.name_fr,e.purchase_date,e.acquired_date,e.purchase_price_eur,
CASE WHEN e.acquired_date IS NOT NULL THEN (julianday('now')-julianday(e.acquired_date))/365.2425 ELSE NULL END AS years_owned,
CASE WHEN e.purchase_price_eur IS NOT NULL AND e.acquired_date IS NOT NULL AND julianday('now')>julianday(e.acquired_date) THEN e.purchase_price_eur/((julianday('now')-julianday(e.acquired_date))/365.2425) ELSE NULL END AS purchase_cost_per_year_eur
FROM equipment e;
