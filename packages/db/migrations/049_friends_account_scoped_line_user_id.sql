-- line-harness-allow: rebuild-friends-account-scope
-- Rebuild friends to replace the global UNIQUE(line_user_id) constraint with
-- account-scoped uniqueness. This preserves existing rows, then lets the same
-- LINE user id exist once per LINE account.

PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;

ALTER TABLE friends RENAME TO friends_line_user_id_unique_old;

CREATE TABLE friends (
  id               TEXT PRIMARY KEY,
  line_user_id     TEXT NOT NULL,
  display_name     TEXT,
  picture_url      TEXT,
  status_message   TEXT,
  is_following     INTEGER NOT NULL DEFAULT 1,
  user_id          TEXT,
  ig_igsid         TEXT,
  ref_code         TEXT,
  metadata         TEXT NOT NULL DEFAULT '{}',
  line_account_id  TEXT REFERENCES line_accounts(id),
  first_tracked_link_id TEXT REFERENCES tracked_links (id) ON DELETE SET NULL,
  score            INTEGER NOT NULL DEFAULT 0,
  last_ref_code    TEXT,
  last_ref_at      TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'))
);

INSERT INTO friends (
  id,
  line_user_id,
  display_name,
  picture_url,
  status_message,
  is_following,
  user_id,
  ig_igsid,
  ref_code,
  metadata,
  line_account_id,
  first_tracked_link_id,
  score,
  last_ref_code,
  last_ref_at,
  created_at,
  updated_at
)
SELECT
  id,
  line_user_id,
  display_name,
  picture_url,
  status_message,
  is_following,
  user_id,
  ig_igsid,
  ref_code,
  metadata,
  line_account_id,
  first_tracked_link_id,
  score,
  last_ref_code,
  last_ref_at,
  created_at,
  updated_at
FROM friends_line_user_id_unique_old;

DROP TABLE friends_line_user_id_unique_old;

CREATE INDEX IF NOT EXISTS idx_friends_line_user_id ON friends (line_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_friends_account_line_user_id ON friends (line_account_id, line_user_id) WHERE line_account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_friends_legacy_line_user_id ON friends (line_user_id) WHERE line_account_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends (user_id);
CREATE INDEX IF NOT EXISTS idx_friends_ig_igsid ON friends (ig_igsid);

PRAGMA legacy_alter_table = OFF;
PRAGMA foreign_keys = ON;
