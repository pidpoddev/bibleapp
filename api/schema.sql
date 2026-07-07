CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  recovery_id CHAR(64) NOT NULL UNIQUE,
  username VARCHAR(40) NULL UNIQUE,
  sync_phrase_auth_hash CHAR(64) NOT NULL,
  kdf_salt VARBINARY(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_seen_at DATETIME NULL,
  disabled_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  device_name VARCHAR(120) NULL,
  device_secret_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NULL,
  revoked_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_devices_user (user_id)
);

CREATE TABLE IF NOT EXISTS encrypted_items (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  client_item_id VARCHAR(180) NOT NULL,
  item_type ENUM(
    'account_session',
    'app_settings',
    'bible_reading_progress',
    'daily_mood',
    'journal_index',
    'journal_entry',
    'studio_journal_entry',
    'verse_state_map',
    'verse_design_index',
    'verse_design_timestamps',
    'saved_designs',
    'saved_designs_backup',
    'legacy_saved_designs',
    'shop_entitlements'
  ) NOT NULL,
  local_storage_key VARCHAR(220) NULL,
  schema_version INT NOT NULL DEFAULT 1,
  current_version_id CHAR(36) NULL,
  has_conflict BOOLEAN NOT NULL DEFAULT FALSE,
  conflict_detected_at DATETIME NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_user_client_item (user_id, client_item_id),
  INDEX idx_items_user_updated (user_id, updated_at),
  INDEX idx_items_user_type (user_id, item_type)
);

CREATE TABLE IF NOT EXISTS encrypted_item_versions (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  device_id CHAR(36) NOT NULL,
  base_version_id CHAR(36) NULL,
  client_updated_at BIGINT NOT NULL,
  server_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  encryption_version INT NOT NULL DEFAULT 1,
  nonce VARBINARY(32) NOT NULL,
  ciphertext MEDIUMBLOB NOT NULL,
  auth_tag VARBINARY(32) NULL,
  payload_sha256 CHAR(64) NOT NULL,
  FOREIGN KEY (item_id) REFERENCES encrypted_items(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_versions_item_created (item_id, server_created_at),
  INDEX idx_versions_user_created (user_id, server_created_at)
);

CREATE TABLE IF NOT EXISTS sync_cursors (
  user_id CHAR(36) NOT NULL,
  device_id CHAR(36) NOT NULL,
  last_pulled_at DATETIME NULL,
  last_pushed_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, device_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  device_id CHAR(36) NULL,
  event_type ENUM('push','pull','restore','delete','conflict_resolved') NOT NULL,
  item_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sync_events_user_created (user_id, created_at)
);
