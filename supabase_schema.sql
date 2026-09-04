-- ==============================================================================
-- SCHEMA COMPLET SUPABASE POUR TRADING DASHBOARD & REPORT GENERATOR
-- Projet : https://njunspsbrwiyvegrqqpm.supabase.co
-- À coller dans : Supabase Dashboard -> SQL Editor -> New Query -> RUN
-- ==============================================================================

-- 1. TABLE DES TRADES (Journal de trading & Backtesting)
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    account_type TEXT DEFAULT 'Live',
    pair TEXT NOT NULL,
    direction TEXT NOT NULL,
    entry_price NUMERIC,
    exit_price NUMERIC,
    stop_loss NUMERIC,
    take_profit NUMERIC,
    pnl NUMERIC DEFAULT 0,
    pnl_r NUMERIC DEFAULT 0,
    pnl_usd NUMERIC DEFAULT 0,
    risk_percentage NUMERIC DEFAULT 1,
    setup_category TEXT,
    setup_grade TEXT,
    session TEXT,
    psychology TEXT,
    rules_respected BOOLEAN DEFAULT true,
    exit_type TEXT,
    exit_reason TEXT,
    lessons TEXT,
    entry_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. TABLE DU REPORT GENERATOR (État complet du rapport hebdomadaire)
CREATE TABLE IF NOT EXISTS public.report_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id)
);

-- 3. TABLE DES ENTRÉES DU JOURNAL (Journal Quotidien & Thèses)
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_date DATE,
    category TEXT,
    body JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. TABLE DE LA WATCHLIST MACRO & POSITIONS
CREATE TABLE IF NOT EXISTS public.macro_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    pair TEXT NOT NULL,
    daily_bias TEXT,
    h4_bias TEXT,
    key_level TEXT,
    catalyst TEXT,
    invalidation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. TABLE DES IMAGES (Captures d'écran graphiques en cloud)
CREATE TABLE IF NOT EXISTS public.report_images (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    img_data TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. ACTIVATION DU ROW LEVEL SECURITY (RLS) SUR TOUTES LES TABLES
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_images ENABLE ROW LEVEL SECURITY;

-- 7. CRÉATION DES POLICIES DE SÉCURITÉ (Chaque utilisateur gère ses propres données)
DO $$ BEGIN
    -- Trades
    DROP POLICY IF EXISTS "Users can manage their own trades" ON public.trades;
    CREATE POLICY "Users can manage their own trades" ON public.trades 
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- Report State
    DROP POLICY IF EXISTS "Users can manage their own report state" ON public.report_state;
    CREATE POLICY "Users can manage their own report state" ON public.report_state 
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- Journal Entries
    DROP POLICY IF EXISTS "Users can manage their own journal" ON public.journal_entries;
    CREATE POLICY "Users can manage their own journal" ON public.journal_entries 
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- Macro Watchlist
    DROP POLICY IF EXISTS "Users can manage their own watchlist" ON public.macro_watchlist;
    CREATE POLICY "Users can manage their own watchlist" ON public.macro_watchlist 
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    -- Report Images
    DROP POLICY IF EXISTS "Users can manage their own images" ON public.report_images;
    CREATE POLICY "Users can manage their own images" ON public.report_images 
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
END $$;
