import React, { useState, useRef } from 'react';
import { Store, Phone, MapPin, Upload, Image as ImageIcon, Check, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserProfile } from '../types';

interface ShopSetupScreenProps {
  userId: string;
  userEmail: string;
  initialFullName?: string;
  onSetupComplete: (profile: UserProfile) => void;
}

export const ShopSetupScreen: React.FC<ShopSetupScreenProps> = ({
  userId,
  userEmail,
  initialFullName = '',
  onSetupComplete,
}) => {
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [tagline, setTagline] = useState('Mobile Phone Repair & Service');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, or WebP).');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg('Image size should be less than 3MB.');
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanShopName = shopName.trim();
    const cleanPhone = phone.trim();
    const cleanAddress = address.trim();

    if (!cleanShopName) {
      setErrorMsg('Please enter your Shop Name.');
      return;
    }
    if (!cleanPhone) {
      setErrorMsg('Please enter your Shop Contact Phone Number.');
      return;
    }
    if (!cleanAddress) {
      setErrorMsg('Please enter your Shop Address.');
      return;
    }

    setIsLoading(true);

    try {
      let finalLogoUrl: string | null = logoPreview;

      // Try uploading to Supabase Storage 'shop-logos' bucket if file was selected
      if (logoFile) {
        try {
          const fileExt = logoFile.name.split('.').pop() || 'png';
          const filePath = `${userId}/${Date.now()}_logo.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('shop-logos')
            .upload(filePath, logoFile, {
              cacheControl: '3600',
              upsert: true,
            });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('shop-logos')
              .getPublicUrl(filePath);

            if (urlData?.publicUrl) {
              finalLogoUrl = urlData.publicUrl;
            }
          } else {
            console.warn('Storage upload fallback:', uploadError);
            // If storage bucket isn't created yet in SQL editor, logoPreview (base64) remains usable
          }
        } catch (storageErr) {
          console.warn('Supabase storage error (fallback to local preview):', storageErr);
        }
      }

      const profilePayload = {
        id: userId,
        full_name: initialFullName || 'Shop Owner',
        shop_name: cleanShopName,
        phone: cleanPhone,
        address: cleanAddress,
        tagline: tagline.trim() || 'Mobile Phone Repair & Service',
        logo_url: finalLogoUrl,
        setup_completed: true,
        updated_at: new Date().toISOString(),
      };

      // Upsert to Supabase profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profilePayload);

      if (profileError) {
        console.warn('Supabase profiles table upsert error:', profileError);
        // If table doesn't exist yet, we still construct profile and allow user into app
      }

      // Save to localStorage scoped for this user
      try {
        localStorage.setItem(`st_shop_profile_${userId}`, JSON.stringify(profilePayload));
        localStorage.setItem('st_shop_name', cleanShopName);
        localStorage.setItem('st_shop_phone', cleanPhone);
        localStorage.setItem('st_shop_address', cleanAddress);
        localStorage.setItem('st_shop_tagline', tagline.trim());
        if (finalLogoUrl) {
          localStorage.setItem('st_shop_logo', finalLogoUrl);
        }
      } catch {}

      const createdProfile: UserProfile = {
        id: userId,
        fullName: initialFullName || 'Shop Owner',
        shopName: cleanShopName,
        phone: cleanPhone,
        address: cleanAddress,
        tagline: tagline.trim(),
        logoUrl: finalLogoUrl,
        setupCompleted: true,
      };

      onSetupComplete(createdProfile);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save shop profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 relative overflow-hidden select-none">
      {/* Decorative gradient backdrops */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-800/95 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 flex flex-col">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-700/80">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest">
            <Sparkles size={16} /> First-Time Setup
          </div>
          <span className="text-[11px] font-semibold bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-500/30">
            Step 1 of 1
          </span>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-black text-white tracking-tight">Setup Your Shop Profile</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Welcome to Ledger Book! Configure your business information. These details will appear on your customer receipts, invoices, and reports.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 bg-red-500/15 border border-red-500/40 rounded-2xl text-red-200 text-xs flex items-start gap-2.5">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Shop Logo (Optional Upload) */}
          <div className="flex items-center gap-4 p-3 bg-slate-900/60 rounded-2xl border border-slate-700/70">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 hover:border-blue-500 flex flex-col items-center justify-center cursor-pointer overflow-hidden shrink-0 group transition-all"
              title="Click to upload logo"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Shop Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-400">
                  <ImageIcon size={20} />
                  <span className="text-[9px] font-bold mt-1">Logo</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <label className="text-[11px] font-bold text-slate-300 block mb-0.5">
                Shop Logo <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <p className="text-[10px] text-slate-400 truncate mb-1.5">
                Appears on POS receipts, A4 invoices, and PDF reports
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <Upload size={12} />
                  <span>{logoPreview ? 'Change Logo' : 'Upload Image'}</span>
                </button>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoPreview(null);
                      setLogoFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-[11px] text-red-400 hover:text-red-300 font-semibold"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Shop Name (Required) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Shop Name *
            </label>
            <div className="relative">
              <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                type="text"
                required
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                placeholder="e.g. Smart Mobile Care"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-3.5 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Phone Number (Required) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Phone Number *
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                type="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. +94 77 123 4567"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-3.5 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Shop Address (Required) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Shop Address *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3 text-slate-400" size={17} />
              <textarea
                required
                rows={2}
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. No. 128, Main Street, Colombo 03"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
              />
            </div>
          </div>

          {/* Shop Tagline / Subtitle (Optional) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Business Tagline / Specialty (Optional)
            </label>
            <input
              type="text"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              placeholder="e.g. Mobile Repair & Electronics Sales"
              className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-300 placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl text-sm shadow-xl shadow-blue-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Saving Shop Profile...</span>
              </>
            ) : (
              <>
                <Check size={18} />
                <span>Complete Setup & Open Ledger</span>
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-center text-slate-500 mt-4">
          Logged in as <span className="font-semibold text-slate-400">{userEmail}</span>
        </p>
      </div>
    </div>
  );
};
