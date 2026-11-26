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

export const saveUserProfileCloud = async (profile: import('./types').UserProfile): Promise<void> => {
  const cleanShopName = (profile.shopName || '').trim();
  const cleanPhone = (profile.phone || '').trim();
  const cleanAddress = (profile.address || '').trim();
  const cleanTagline = (profile.tagline || 'Mobile Phone Repair & Service').trim();
  const cleanFullName = (profile.fullName || 'Shop Owner').trim();
  const cleanTerms = profile.receiptTerms ? profile.receiptTerms.trim() : undefined;
  const nowIso = new Date().toISOString();

  const fullPayload: Record<string, any> = {
    id: profile.id,
    full_name: cleanFullName,
    shop_name: cleanShopName,
    tagline: cleanTagline,
    phone: cleanPhone,
    address: cleanAddress,
    logo_url: profile.logoUrl || null,
    receipt_terms: cleanTerms || null,
    setup_completed: Boolean(profile.setupCompleted),
    updated_at: nowIso
  };

  // 1. Upsert into Supabase 'profiles' table (auto-fallback if optional columns like receipt_terms don't exist yet)
  try {
    const { error: upErr } = await supabase.from('profiles').upsert(fullPayload);
    if (upErr) {
      const msg = (upErr.message || '').toLowerCase();
      if (upErr.code === '42703' || upErr.code === 'PGRST204' || msg.includes('receipt_terms') || msg.includes('column')) {
        const { receipt_terms: _rt, ...basePayload } = fullPayload;
        const { error: baseErr } = await supabase.from('profiles').upsert(basePayload);
        if (baseErr) {
          console.warn('Supabase profiles base upsert warning:', baseErr.message);
        }
      } else {
        console.warn('Supabase profiles upsert warning:', upErr.message);
      }
    }
  } catch (pErr) {
    console.warn('Supabase profiles upsert exception:', pErr);
  }

  // 2. Mirror shop profile into Supabase Auth user_metadata (always available on any new browser/device login)
  try {
    const logoIsHttp = typeof profile.logoUrl === 'string' && /^https?:\/\//i.test(profile.logoUrl);
    const compactMeta: Record<string, any> = {
      full_name: cleanFullName,
      shop_name: cleanShopName,
      tagline: cleanTagline,
      phone: cleanPhone,
      address: cleanAddress,
      logo_url: logoIsHttp ? profile.logoUrl : null,
      receipt_terms: cleanTerms || null,
      setup_completed: Boolean(profile.setupCompleted),
      updated_at: nowIso
    };
    await supabase.auth.updateUser({
      data: {
        full_name: cleanFullName,
        shop_profile: compactMeta
      }
    });
  } catch (metaErr) {
    console.warn('Auth metadata profile sync warning:', metaErr);
  }

  // 3. Mirror full profile JSON (including logo URL/data if small) to Supabase Storage
  try {
    const jsonPayload = JSON.stringify({
      ...fullPayload,
      shopName: cleanShopName,
      fullName: cleanFullName,
      logoUrl: profile.logoUrl || null,
      receiptTerms: cleanTerms || undefined,
      setupCompleted: Boolean(profile.setupCompleted)
    });
    if (jsonPayload.length <= 2_000_000) {
      const blob = new Blob([jsonPayload], { type: 'application/json' });
      await supabase.storage
        .from('shop-logos')
        .upload(`${profile.id}/shop-profile.json`, blob, {
          contentType: 'application/json',
          cacheControl: '0',
          upsert: true
        });
    }
  } catch (stErr) {
    console.warn('Storage profile sync warning:', stErr);
  }

  // 4. Persist user-scoped localStorage copy
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`st_shop_profile_${profile.id}`, JSON.stringify({
        ...fullPayload,
        shopName: cleanShopName,
        fullName: cleanFullName,
        logoUrl: profile.logoUrl || null,
        receiptTerms: cleanTerms,
        setupCompleted: Boolean(profile.setupCompleted)
      }));
      localStorage.setItem('st_last_uid', profile.id);
      if (cleanShopName) localStorage.setItem('st_shop_name', cleanShopName);
      if (cleanTagline) localStorage.setItem('st_shop_tagline', cleanTagline);
      if (cleanPhone) localStorage.setItem('st_shop_phone', cleanPhone);
      if (cleanAddress) localStorage.setItem('st_shop_address', cleanAddress);
      if (cleanTerms) localStorage.setItem('st_shop_receipt_terms', cleanTerms);
      if (profile.logoUrl) localStorage.setItem('st_shop_logo', profile.logoUrl);
    } catch {}
  }
};

export const loadUserProfile = async (userId: string, userMetadata?: any): Promise<import('./types').UserProfile> => {
  let resolvedMeta = userMetadata;
  if (!resolvedMeta) {
    try {
      const { data: uData } = await supabase.auth.getUser();
      if (uData?.user?.id === userId) {
        resolvedMeta = uData.user.user_metadata;
      }
    } catch {}
  }

  let dbRow: any = null;
  let storageObj: any = null;
  let localObj: any = null;
  const metaObj: any = resolvedMeta?.shop_profile || null;

  // 1. Fetch from Supabase 'profiles' table + Storage JSON in parallel
  await Promise.all([
    (async () => {
      try {
        const { data: pData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (pData) dbRow = pData;
      } catch (pErr) {
        console.warn('Supabase profile fetch warning:', pErr);
      }
    })(),
    (async () => {
      try {
        const { data: blobData, error } = await supabase.storage
          .from('shop-logos')
          .download(`${userId}/shop-profile.json`);
        if (!error && blobData) {
          const parsed = JSON.parse(await blobData.text());
          if (parsed && typeof parsed === 'object') storageObj = parsed;
        }
      } catch {}
      if (!storageObj) {
        try {
          const { data: pubData } = supabase.storage
            .from('shop-logos')
            .getPublicUrl(`${userId}/shop-profile.json`);
          if (pubData?.publicUrl) {
            const res = await fetch(`${pubData.publicUrl}?t=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) {
              const parsed = await res.json();
              if (parsed && typeof parsed === 'object') storageObj = parsed;
            }
          }
        } catch {}
      }
    })()
  ]);

  // 2. Read user-scoped localStorage fallback (only use unscoped st_shop_name if this browser belongs to userId)
  if (typeof window !== 'undefined') {
    try {
      const localSaved = localStorage.getItem(`st_shop_profile_${userId}`);
      if (localSaved) {
        localObj = JSON.parse(localSaved);
      } else {
        const lastUid = localStorage.getItem('st_last_uid');
        if (!lastUid || lastUid === userId) {
          const legacyShopName = (localStorage.getItem('st_shop_name') || '').trim();
          if (legacyShopName) {
            localObj = {
              shop_name: legacyShopName,
              tagline: localStorage.getItem('st_shop_tagline') || 'Mobile Phone Repair & Service',
              phone: localStorage.getItem('st_shop_phone') || '',
              address: localStorage.getItem('st_shop_address') || '',
              logo_url: localStorage.getItem('st_shop_logo') || null,
              receipt_terms: localStorage.getItem('st_shop_receipt_terms') || undefined,
              setup_completed: true
            };
          }
        }
      }
    } catch (lErr) {
      console.warn('Local profile fetch warning:', lErr);
    }
  }

  const pickStr = (...vals: Array<any>): string => {
    for (const v of vals) {
      if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    }
    return '';
  };

  const sources = [dbRow, metaObj, storageObj, localObj].filter(Boolean);
  const shopName = pickStr(
    dbRow?.shop_name,
    metaObj?.shop_name, metaObj?.shopName,
    storageObj?.shop_name, storageObj?.shopName,
    localObj?.shop_name, localObj?.shopName
  );
  const phone = pickStr(
    dbRow?.phone,
    metaObj?.phone,
    storageObj?.phone,
    localObj?.phone
  );
  const address = pickStr(
    dbRow?.address,
    metaObj?.address,
    storageObj?.address,
    localObj?.address
  );
  const tagline = pickStr(
    dbRow?.tagline,
    metaObj?.tagline,
    storageObj?.tagline,
    localObj?.tagline
  ) || 'Mobile Phone Repair & Service';
  const fullName = pickStr(
    dbRow?.full_name,
    metaObj?.full_name, metaObj?.fullName,
    storageObj?.full_name, storageObj?.fullName,
    localObj?.full_name, localObj?.fullName,
    resolvedMeta?.full_name
  ) || 'Shop Owner';
  const logoUrl = pickStr(
    dbRow?.logo_url,
    storageObj?.logo_url, storageObj?.logoUrl,
    metaObj?.logo_url, metaObj?.logoUrl,
    localObj?.logo_url, localObj?.logoUrl
  ) || null;
  const receiptTerms = pickStr(
    dbRow?.receipt_terms,
    metaObj?.receipt_terms, metaObj?.receiptTerms,
    storageObj?.receipt_terms, storageObj?.receiptTerms,
    localObj?.receipt_terms, localObj?.receiptTerms
  ) || undefined;

  const dbCompleted = Boolean(dbRow?.setup_completed) && Boolean((dbRow?.shop_name || '').trim());
  const anySourceCompleted = sources.some(s => Boolean(s?.setup_completed || s?.setupCompleted)) && Boolean(shopName);
  let setupCompleted = dbCompleted || anySourceCompleted;

  // 3. If profile wasn't marked completed yet, check if this user ALREADY has business records in Supabase
  //    (prevents forcing First-Time Shop Setup on existing users whose earlier profiles upsert failed due to missing columns)
  if (!setupCompleted) {
    try {
      const [cCheck, tCheck, cbCheck] = await Promise.all([
        supabase.from('contacts').select('id').eq('user_id', userId).limit(1),
        supabase.from('transactions').select('id').eq('user_id', userId).limit(1),
        supabase.from('cashbook_entries').select('id').eq('user_id', userId).limit(1)
      ]);
      const hasExistingData =
        (Array.isArray(cCheck.data) && cCheck.data.length > 0) ||
        (Array.isArray(tCheck.data) && tCheck.data.length > 0) ||
        (Array.isArray(cbCheck.data) && cbCheck.data.length > 0);
      if (hasExistingData) {
        setupCompleted = true;
      }
    } catch {}
  }

  const prof: import('./types').UserProfile = {
    id: userId,
    fullName,
    shopName,
    tagline,
    phone,
    address,
    logoUrl,
    receiptTerms,
    setupCompleted
  };

  // 4. Auto-heal: if completed profile came from metadata/storage/localStorage while DB row was missing/incomplete, sync back to cloud
  if (setupCompleted && (!dbCompleted || (!dbRow?.shop_name && shopName))) {
    saveUserProfileCloud(prof).catch(() => {});
  }

  return prof;
};