-- Separate supplementary curation tables; existing health/other tables stay intact.
CREATE TABLE IF NOT EXISTS meigen_dataset (
  data_version TEXT PRIMARY KEY,
  manifest_sha256 TEXT NOT NULL CHECK (length(manifest_sha256) = 64),
  manifest_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meigen_record (
  data_version TEXT NOT NULL,
  record_id TEXT NOT NULL,
  record_sha256 TEXT NOT NULL CHECK (length(record_sha256) = 64),
  raw_sha256 TEXT NOT NULL CHECK (length(raw_sha256) = 64),
  record_json TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0 CHECK (approved IN (0, 1)),
  reviewed_by TEXT,
  PRIMARY KEY (data_version, record_id),
  FOREIGN KEY (data_version) REFERENCES meigen_dataset(data_version),
  CHECK (approved = 0 OR (reviewed_by IS NOT NULL AND length(trim(reviewed_by)) > 0))
);
