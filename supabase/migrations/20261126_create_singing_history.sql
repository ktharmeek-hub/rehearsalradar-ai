
-- Day 7: Secure Personal Singing History

CREATE TABLE IF NOT EXISTS public.singing_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    mode TEXT NOT NULL
        CHECK (mode IN ('free', 'compare')),

    singing_filename TEXT NOT NULL,
    reference_filename TEXT,

    duration_seconds DOUBLE PRECISION NOT NULL,
    median_pitch_hz DOUBLE PRECISION,

    payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS
    singing_history_user_recent_idx
ON public.singing_history (user_id, id DESC);

ALTER TABLE public.singing_history
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.singing_history
FROM anon, authenticated;

GRANT SELECT, INSERT, DELETE
ON TABLE public.singing_history
TO authenticated;

DROP POLICY IF EXISTS history_select_own
ON public.singing_history;

DROP POLICY IF EXISTS history_insert_own
ON public.singing_history;

DROP POLICY IF EXISTS history_delete_own
ON public.singing_history;

CREATE POLICY history_select_own
ON public.singing_history
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY history_insert_own
ON public.singing_history
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY history_delete_own
ON public.singing_history
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);
