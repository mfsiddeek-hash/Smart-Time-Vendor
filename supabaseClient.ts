import { createClient } from '@supabase/supabase-js';

// Supabase Project Configuration for "Ledger Book"
export const SUPABASE_PROJECT_NAME = 'Ledger Book';
export const SUPABASE_PROJECT_ID = 'actfubmcannmqvbsmmgv';
export const SUPABASE_URL = 'https://actfubmcannmqvbsmmgv.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4hVe_Sx-L1MoDg1r9_nNRA_O_vKuLtG';

// Environment variable overrides if defined
const activeUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || SUPABASE_URL)
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');

const activeKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || 
  SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(activeUrl, activeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

export const loadUserProfile = async (userId: string, userMetadata?: any): Promise<import('./types').UserProfile> => {
  let prof: import('./types').UserProfile | null = null;

  // 1. Try to fetch from Supabase 'profiles' table
  try {
    const { data: pData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (pData) {
      const sName = pData.shop_name || '';
      const isCompleted = Boolean(pData.setup_completed) && Boolean(sName.trim().length > 0);
      prof = {
        id: pData.id,
        fullName: pData.full_name || userMetadata?.full_name || 'Shop Owner',
        shopName: sName,
        tagline: pData.tagline || 'Mobile Phone Repair & Service',
        phone: pData.phone || '',
        address: pData.address || '',
        logoUrl: pData.logo_url || null,
        receiptTerms: pData.receipt_terms || undefined,
        setupCompleted: isCompleted
      };
    }
  } catch (pErr) {
    console.warn('Supabase profile fetch warning:', pErr);
  }

  // 2. Fallback to user-scoped localStorage profile
  if (!prof || !prof.setupCompleted) {
    try {
      const localSaved = typeof window !== 'undefined' ? localStorage.getItem(`st_shop_profile_${userId}`) : null;
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (parsed) {
          const sName = parsed.shop_name || parsed.shopName || '';
          const isCompleted = Boolean(parsed.setup_completed || parsed.setupCompleted) && Boolean(sName.trim().length > 0);
          if (isCompleted) {
            prof = {
              id: userId,
              fullName: parsed.full_name || parsed.fullName || userMetadata?.full_name || 'Shop Owner',
              shopName: sName,
              tagline: parsed.tagline || 'Mobile Phone Repair & Service',
              phone: parsed.phone || '',
              address: parsed.address || '',
              logoUrl: parsed.logo_url || parsed.logoUrl || null,
              receiptTerms: parsed.receipt_terms || parsed.receiptTerms || undefined,
              setupCompleted: true
            };
          }
        }
      }
    } catch (lErr) {
      console.warn('Local profile fetch warning:', lErr);
    }
  }

  // 3. If no user-specific profile is found, return clean uncompleted profile (blank shop name, phone, address, logo)
  if (!prof) {
    prof = {
      id: userId,
      fullName: userMetadata?.full_name || 'Shop Owner',
      shopName: '',
      tagline: 'Mobile Phone Repair & Service',
      phone: '',
      address: '',
      logoUrl: null,
      setupCompleted: false
    };
  }

  return prof;
};