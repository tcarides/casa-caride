-- Status del usuario por propiedad. Composite PK (property_id, user_id).
-- user_id es 'tomi' o 'flori'.
CREATE TABLE IF NOT EXISTS property_user_state (
  property_id TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('unseen', 'seen', 'maybe', 'favorite', 'discarded')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (property_id, user_id)
);

CREATE INDEX IF NOT EXISTS property_user_state_status_idx
  ON property_user_state(user_id, status);

-- Notas compartidas (un solo texto por propiedad).
-- author_id registra quién hizo el último update — NULL para notas viejas pre-multiusuario.
CREATE TABLE IF NOT EXISTS property_notes (
  property_id TEXT PRIMARY KEY,
  notes       TEXT,
  author_id   TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Propiedades marcadas como "no publicada" (discontinued).
-- marked_by puede ser un user_id o 'cleanup' para detección automática.
CREATE TABLE IF NOT EXISTS property_discontinued (
  property_id     TEXT PRIMARY KEY,
  discontinued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_by       TEXT
);

-- Dedupe: grupos de propiedades que son la misma listada en distintas fuentes.
-- primary_id = la propiedad que se muestra como "principal" del grupo.
CREATE TABLE IF NOT EXISTS property_groups (
  group_id   TEXT PRIMARY KEY,
  primary_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_group_members (
  property_id TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS property_group_members_gid_idx
  ON property_group_members(group_id);

-- Pares candidatos generados por el script `npm run dedupe` (re-poblada cada corrida).
CREATE TABLE IF NOT EXISTS property_dedupe_candidates (
  prop_a   TEXT NOT NULL,
  prop_b   TEXT NOT NULL,
  hamming  INT  NOT NULL,
  same_address    BOOLEAN NOT NULL DEFAULT FALSE,
  same_price_5pct BOOLEAN NOT NULL DEFAULT FALSE,
  same_m2_5pct    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (prop_a, prop_b)
);

-- Pares descartados por el usuario en /agrupar (no volver a sugerirlos).
CREATE TABLE IF NOT EXISTS property_dedupe_rejected (
  prop_a TEXT NOT NULL,
  prop_b TEXT NOT NULL,
  rejected_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (prop_a, prop_b)
);
