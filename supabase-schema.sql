-- =========================================================
-- SQL Schema for Ledger Book (actfubmcannmqvbsmmgv)
-- Run this in your Supabase Project -> SQL Editor
-- =========================================================

-- 1. Create Contacts Table (Customers, Vendors, Rent, Service Orders)
CREATE TABLE IF NOT EXISTS public.contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    type TEXT NOT NULL,
    balance NUMERIC DEFAULT 0,
    target_amount NUMERIC,
    start_date TEXT,
    end_date TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Transactions Table (Credit Charges, Payments, Receipts)
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    contact_id TEXT NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    description TEXT,
    balance_after NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_contacts_type ON public.contacts(type);
CREATE INDEX IF NOT EXISTS idx_transactions_contact_id ON public.transactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);

-- 4. Enable Row Level Security (RLS) and Allow Access with Anon Key
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Permissive policies for the client application
DROP POLICY IF EXISTS "Public contacts access" ON public.contacts;
CREATE POLICY "Public contacts access" ON public.contacts
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public transactions access" ON public.transactions;
CREATE POLICY "Public transactions access" ON public.transactions
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Realtime Publication (Optional - for instant live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
