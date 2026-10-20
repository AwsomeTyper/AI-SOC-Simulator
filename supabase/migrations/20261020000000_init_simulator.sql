-- AI Lab & SOC Crisis Simulator Schema (50 Players / 10 Tables / 5 Arenas / 3 Admins)

CREATE TABLE IF NOT EXISTS public.sim_sessions (
  id TEXT PRIMARY KEY DEFAULT 'main',
  phase TEXT NOT NULL DEFAULT 'lobby',
  current_act INTEGER NOT NULL DEFAULT 1,
  timer_seconds INTEGER NOT NULL DEFAULT 900,
  timer_running BOOLEAN NOT NULL DEFAULT false,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sim_tables (
  table_number INTEGER PRIMARY KEY CHECK (table_number BETWEEN 1 AND 10),
  arena_number INTEGER NOT NULL CHECK (arena_number BETWEEN 1 AND 5),
  lab_id TEXT NOT NULL CHECK (lab_id IN ('aegis', 'vanguard')),
  lab_name TEXT NOT NULL,
  security INTEGER NOT NULL DEFAULT 50,
  capability INTEGER NOT NULL DEFAULT 50,
  trust INTEGER NOT NULL DEFAULT 50,
  growth INTEGER NOT NULL DEFAULT 50,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  team_decisions JSONB NOT NULL DEFAULT '{}'::jsonb,
  unlocked_acts JSONB NOT NULL DEFAULT '{"1": false, "2": false, "3": false}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sim_players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  table_number INTEGER NOT NULL CHECK (table_number BETWEEN 1 AND 10),
  role_id TEXT,
  individual_actions JSONB NOT NULL DEFAULT '{}'::jsonb,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sim_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  arena_number INTEGER,
  table_number INTEGER,
  act_number INTEGER,
  actor TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sim_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sim_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sim_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sim_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access for realtime scoreboard updates; mutations go through Next.js API routes using service_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sim_sessions' AND policyname = 'Allow public read sim_sessions'
  ) THEN
    CREATE POLICY "Allow public read sim_sessions" ON public.sim_sessions FOR SELECT USING (true);
  END IF;
END $$;
