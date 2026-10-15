-- Additive storage only. Run manually on DS1, never on a cloud Postgres copy.
-- No existing archive, sports table, role or release is changed.
CREATE SCHEMA IF NOT EXISTS legacy_meigen;
CREATE SCHEMA IF NOT EXISTS meigen;
-- The existing central archive is authoritative and already watched by backups.
DO $$ BEGIN
  IF to_regclass('legacy_files.raw_archive') IS NULL THEN
    RAISE EXCEPTION 'The existing DS1 central raw archive is required';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS legacy_meigen.raw_source (
  sha256 text PRIMARY KEY CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  archive_name text NOT NULL REFERENCES legacy_files.raw_archive(name),
  bytes bigint NOT NULL CHECK (bytes >= 0)
);
CREATE TABLE IF NOT EXISTS legacy_meigen.raw_download (
  sha256 text NOT NULL REFERENCES legacy_meigen.raw_source(sha256),
  name text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  PRIMARY KEY (sha256, name, source_url, retrieved_at)
);
CREATE TABLE IF NOT EXISTS meigen.record_version (
  record_id text NOT NULL,
  record_sha256 text NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
  raw_sha256 text NOT NULL REFERENCES legacy_meigen.raw_source(sha256),
  payload jsonb NOT NULL CHECK (payload->>'id' = record_id),
  PRIMARY KEY (record_id, record_sha256)
);
CREATE TABLE IF NOT EXISTS meigen.dataset (
  data_version text PRIMARY KEY,
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  manifest jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meigen.dataset_record (
  data_version text NOT NULL REFERENCES meigen.dataset(data_version),
  record_id text NOT NULL,
  record_sha256 text NOT NULL,
  PRIMARY KEY (data_version, record_id),
  FOREIGN KEY (record_id, record_sha256) REFERENCES meigen.record_version(record_id, record_sha256)
);
