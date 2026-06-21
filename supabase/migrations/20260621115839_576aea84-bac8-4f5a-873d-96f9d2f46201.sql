CREATE TABLE public.user_table_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_key text NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, table_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_table_preferences TO authenticated;
GRANT ALL ON public.user_table_preferences TO service_role;

ALTER TABLE public.user_table_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own table prefs"
  ON public.user_table_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own table prefs"
  ON public.user_table_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own table prefs"
  ON public.user_table_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own table prefs"
  ON public.user_table_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_table_preferences_updated_at
  BEFORE UPDATE ON public.user_table_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();