-- ==============================================================================
-- SUPABASE DATABASE MIGRATION & RLS SCHEMA FOR "LEDGER BOOK"
-- Project ID: actfubmcannmqvbsmmgv
-- Project URL: https://actfubmcannmqvbsmmgv.supabase.co
--
-- INSTRUCTIONS TO RUN:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/actfubmcannmqvbsmmgv
-- 2. Click on the "SQL Editor" in the left sidebar.
-- 3. Click "New Query", paste this entire script, and click "Run".
--
-- SUPABASE AUTH SETUP INSTRUCTIONS:
-- 1. Enable Email Confirmation:
--    Go to Authentication -> Providers -> Email -> Turn ON "Confirm email".
-- 2. Configure Redirect & Site URLs:
--    Go to Authentication -> URL Configuration.
--    Set "Site URL" to your production domain (e.g., https://your-ledger-app.vercel.app or http://localhost:3000)
--    Under "Redirect URLs", add:
--      - http://localhost:3000/**
--      - https://*.vercel.app/**
--      - https://your-domain.com/**
-- ==============================================================================

-- 1. Create Profiles Table (Stores Shop Profile & Receipt Terms)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    shop_name TEXT NOT NULL DEFAULT '',
    tagline TEXT DEFAULT 'Mobile Phone Repair & Service',
    phone TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    logo_url TEXT,
    receipt_terms TEXT,
    setup_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'receipt_terms'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN receipt_terms TEXT;
    END IF;
END $$;

-- Automatic Profile Creation Trigger on Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, shop_name, phone, address, setup_completed)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        '',
        '',
        '',
        false
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name
    WHERE profiles.full_name = '';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Create Contacts Table ('CUSTOMER' | 'RENT' | 'SERVICE')
CREATE TABLE IF NOT EXISTS public.contacts (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    phone TEXT,
    city TEXT,
    type TEXT NOT NULL, -- 'CUSTOMER' | 'RENT' | 'SERVICE'
    balance NUMERIC DEFAULT 0,
    target_amount NUMERIC,
    start_date TEXT,
    end_date TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.contacts ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'city'
    ) THEN
        ALTER TABLE public.contacts ADD COLUMN city TEXT;
    END IF;
END $$;

-- 3. Create Items & Stock Inventory Table (daybook_items)
CREATE TABLE IF NOT EXISTS public.daybook_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    item TEXT NOT NULL,
    sku TEXT,
    category TEXT,
    qty NUMERIC NOT NULL DEFAULT 0,
    cost NUMERIC NOT NULL DEFAULT 0,
    wholesale_price NUMERIC NOT NULL DEFAULT 0,
    retail_price NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Transactions Table (Customer Ledger, Service Billing, Split Cash + Cheque)
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    contact_id TEXT NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL, -- 'CREDIT' | 'PAYMENT'
    description TEXT,
    payment_method TEXT, -- 'Cash' | 'Bank Transfer' | 'Card' | 'Cheque' | 'Cash + Cheque'
    cheque_status TEXT, -- 'PENDING' | 'PASSED' | 'BOUNCED'
    cheque_number TEXT,
    cheque_date TEXT,
    cash_amount NUMERIC,
    cheque_amount NUMERIC,
    balance_after NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN payment_method TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'cheque_status'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN cheque_status TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'cheque_number'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN cheque_number TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'cheque_date'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN cheque_date TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'cash_amount'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN cash_amount NUMERIC;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'cheque_amount'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN cheque_amount NUMERIC;
    END IF;
END $$;

-- 5. Create Sales Daybook Table (cashbook_entries — Sales Only, linked to Customers & Items)
CREATE TABLE IF NOT EXISTS public.cashbook_entries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    type TEXT NOT NULL DEFAULT 'SALE', -- 'SALE'
    amount NUMERIC NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    payment_method TEXT DEFAULT 'Cash',
    reference_no TEXT,
    contact_name TEXT,
    contact_id TEXT,
    items_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cashbook_entries' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.cashbook_entries ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cashbook_entries' AND column_name = 'contact_id'
    ) THEN
        ALTER TABLE public.cashbook_entries ADD COLUMN contact_id TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cashbook_entries' AND column_name = 'items_json'
    ) THEN
        ALTER TABLE public.cashbook_entries ADD COLUMN items_json JSONB;
    END IF;
END $$;

-- 6. High-Performance Composite Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_type ON public.contacts(user_id, type);
CREATE INDEX IF NOT EXISTS idx_daybook_items_user_id ON public.daybook_items(user_id);
CREATE INDEX IF NOT EXISTS idx_daybook_items_user_sku ON public.daybook_items(user_id, sku);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_contact_id ON public.transactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_cashbook_user_id ON public.cashbook_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_user_date ON public.cashbook_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_cashbook_contact_id ON public.cashbook_entries(user_id, contact_id);

-- 7. Enable Row Level Security (RLS) on All Tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daybook_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbook_entries ENABLE ROW LEVEL SECURITY;

-- 8. Define Strict User-Isolation RLS Policies (auth.uid() = user_id)
DROP POLICY IF EXISTS "Public contacts access" ON public.contacts;
DROP POLICY IF EXISTS "Public transactions access" ON public.transactions;
DROP POLICY IF EXISTS "Public cashbook access" ON public.cashbook_entries;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can manage own daybook_items" ON public.daybook_items;
DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can manage own cashbook" ON public.cashbook_entries;

CREATE POLICY "Users can manage own profile" ON public.profiles
    FOR ALL TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can manage own contacts" ON public.contacts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own daybook_items" ON public.daybook_items
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own transactions" ON public.transactions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own cashbook" ON public.cashbook_entries
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 9. Storage Bucket for Shop Logos & Attachments with Strict Storage RLS
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-logos', 'shop-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Shop logos are publicly readable" ON storage.objects;
CREATE POLICY "Shop logos are publicly readable"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'shop-logos');

DROP POLICY IF EXISTS "Users can upload own shop logos" ON storage.objects;
CREATE POLICY "Users can upload own shop logos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'shop-logos' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can update own shop logos" ON storage.objects;
CREATE POLICY "Users can update own shop logos"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'shop-logos' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can delete own shop logos" ON storage.objects;
CREATE POLICY "Users can delete own shop logos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'shop-logos' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 10. Realtime Publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
EXCEPTION WHEN duplicate_object THEN
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daybook_items;
EXCEPTION WHEN duplicate_object THEN
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
EXCEPTION WHEN duplicate_object THEN
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cashbook_entries;
EXCEPTION WHEN duplicate_object THEN
END $$;
