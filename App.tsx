import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  BookText, Wallet, Receipt, UserCircle, Store, Phone, Pencil, Palette, 
  Check, Languages, ChevronRight, LogOut, ChevronLeft, Share2, Calendar, 
  ChevronDown, Filter, Download, Trash2, Calculator, FilePlus, Loader2, 
  Camera, Eye, Target, MoreVertical, RefreshCw, ArrowDown, ArrowUp, 
  Search, Plus, FileText, Users, Truck, Building, PlayCircle, CalendarClock,
  ArrowRight, Database, AlertCircle, History, TrendingUp, TrendingDown, Settings, ShieldAlert
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Contact, ContactType, Transaction, TransactionType } from './types';
import { BottomNav } from './components/BottomNav';
import { TransactionRow } from './components/TransactionRow';
import { supabase } from './supabaseClient';

type ThemeColor = 'blue' | 'purple' | 'emerald' | 'orange' | 'dark';

const THEMES: Record<ThemeColor, any> = {
  blue: { name: 'Blue', primary: 'bg-blue-600', primaryActive: 'active:bg-blue-700', text: 'text-blue-600', light: 'bg-blue-50', lightHover: 'hover:bg-blue-100', border: 'border-blue-200', bgIndicator: 'bg-blue-500' },
  purple: { name: 'Purple', primary: 'bg-purple-600', primaryActive: 'active:bg-purple-700', text: 'text-purple-600', light: 'bg-purple-50', lightHover: 'hover:bg-purple-100', border: 'border-purple-200', bgIndicator: 'bg-purple-500' },
  emerald: { name: 'Emerald', primary: 'bg-emerald-600', primaryActive: 'active:bg-emerald-700', text: 'text-emerald-600', light: 'bg-emerald-50', lightHover: 'hover:bg-emerald-100', border: 'border-emerald-200', bgIndicator: 'bg-emerald-500' },
  orange: { name: 'Orange', primary: 'bg-orange-600', primaryActive: 'active:bg-orange-700', text: 'text-orange-600', light: 'bg-orange-50', lightHover: 'hover:bg-orange-100', border: 'border-orange-200', bgIndicator: 'bg-orange-500' },
  dark: { name: 'Dark', primary: 'bg-slate-800', primaryActive: 'active:bg-slate-900', text: 'text-slate-800', light: 'bg-gray-100', lightHover: 'hover:bg-gray-200', border: 'border-gray-200', bgIndicator: 'bg-slate-800' },
};

interface CashTransaction {
  id: string;
  date: string;
  amount: number;
  type: 'IN' | 'OUT';
  description: string;
}

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const normalizeDate = (d: string | Date) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getRentCycleStart = () => {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();
  
  let cycleStart;
  if (day >= 13) {
    cycleStart = new Date(year, month, 13);
  } else {
    cycleStart = new Date(year, month - 1, 13);
  }
  cycleStart.setHours(0, 0, 0, 0);
  return cycleStart;
};

export default function App() {
  const [currentView, setCurrentView] = useState<string>('DASHBOARD');
  const [activeTab, setActiveTab] = useState<ContactType>('SUPPLIER');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  const contactsRef = useRef(contacts);
  const [appTheme, setAppTheme] = useState<ThemeColor>('blue');
  const [shopName, setShopName] = useState('Smart Time');
  const [searchQuery, setSearchQuery] = useState('');

  // Form States
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [isCashFormOpen, setIsCashFormOpen] = useState(false);
  const [cashType, setCashType] = useState<'IN' | 'OUT'>('IN');
  const [cashAmount, setCashAmount] = useState('');
  const [cashDesc, setCashDesc] = useState('');
  
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transType, setTransType] = useState<TransactionType>('CREDIT');
  const [transAmount, setTransAmount] = useState('');
  const [transDate, setTransDate] = useState(new Date().toISOString().slice(0, 10));
  const [transDesc, setTransDesc] = useState('');

  const theme = THEMES[appTheme];

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    if (!window.history.state) {
        window.history.replaceState({ view: 'DASHBOARD', contactId: null, tab: 'SUPPLIER' }, '', window.location.pathname);
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (!state) {
        setCurrentView('DASHBOARD');
        setSelectedContact(null);
        return;
      }
      setCurrentView(state.view || 'DASHBOARD');
      if (state.tab) setActiveTab(state.tab);
      if (state.contactId) {
        const c = contactsRef.current.find(con => con.id === state.contactId);
        setSelectedContact(c || null);
      } else {
        setSelectedContact(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (view: string, contactId: string | null = null) => {
    let hash = `#${view.toLowerCase()}`;
    if (contactId) hash += `/${contactId}`;
    window.history.pushState({ view, contactId, tab: activeTab }, '', hash);
    setCurrentView(view);
  };

  const fetchData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [contactsRes, transRes, cashRes] = await Promise.all([
        supabase.from('contacts').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('cash_transactions').select('*').order('date', { ascending: false })
      ]);
        
      if (contactsRes.error) throw contactsRes.error;
      if (transRes.error) throw transRes.error;

      if (contactsRes.data) {
          setContacts(contactsRes.data.map((c: any) => ({
              id: c.id,
              name: c.name,
              phone: c.phone || '',
              type: c.type,
              balance: c.balance || 0,
              targetAmount: c.target_amount,
              startDate: c.start_date,
              endDate: c.end_date,
              lastUpdated: c.last_updated
          })));
      }

      if (transRes.data) {
          setTransactions(transRes.data.map((t: any) => ({
              id: t.id,
              contactId: t.contact_id,
              date: t.date,
              description: t.description,
              amount: t.amount,
              type: t.type,
              balanceAfter: t.balance_after,
              hasAttachment: t.has_attachment,
              attachmentUrl: t.attachment_url
          })));
      }

      if (cashRes.data) {
        setCashTransactions(cashRes.data.map((c: any) => ({
          id: c.id,
          date: c.date,
          amount: c.amount,
          type: c.type,
          description: c.description
        })));
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setLoadError("Check your internet connection or Supabase settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Helper to get savings in current cycle for a specific contact
  const getCycleSavings = (contactId: string) => {
    const cycleStart = getRentCycleStart();
    return transactions
      .filter(t => t.contactId === contactId && t.type === 'PAYMENT' && normalizeDate(t.date) >= cycleStart)
      .reduce((sum, t) => sum + t.amount, 0);
  };

  // Fixed missing filteredContacts by adding useMemo implementation
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesTab = c.type === activeTab;
      const q = searchQuery.toLowerCase();
      const matchesSearch = c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
      return matchesTab && matchesSearch;
    });
  }, [contacts, activeTab, searchQuery]);

  const activeTotals = useMemo(() => {
    const currentContacts = contacts.filter(c => c.type === activeTab);
    const contactIds = currentContacts.map(c => c.id);

    if (activeTab === 'RENT') {
      let totalSavedInCycle = 0;
      let totalMonthlyTarget = 0;

      currentContacts.forEach(contact => {
        const target = contact.targetAmount || 30000;
        totalMonthlyTarget += target;
        totalSavedInCycle += getCycleSavings(contact.id);
      });

      const currentDebt = Math.max(0, totalMonthlyTarget - totalSavedInCycle);
      return { 
        totalPayments: totalSavedInCycle,
        netBalance: currentDebt
      };
    } else {
      const totalPayments = transactions
        .filter(t => contactIds.includes(t.contactId) && t.type === 'PAYMENT')
        .reduce((acc, t) => acc + t.amount, 0);

      const netBalance = currentContacts
        .reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);

      return { totalPayments, netBalance };
    }
  }, [contacts, transactions, activeTab]);

  const cashSummary = useMemo(() => {
    const totalIn = cashTransactions.filter(t => t.type === 'IN').reduce((s, t) => s + t.amount, 0);
    const totalOut = cashTransactions.filter(t => t.type === 'OUT').reduce((s, t) => s + t.amount, 0);
    return { totalIn, totalOut, balance: totalIn - totalOut };
  }, [cashTransactions]);

  const handleBack = () => { window.history.back(); };

  const handleAddContact = async () => {
    if (!addName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = { 
        id: generateUUID(), 
        name: addName, 
        phone: addPhone, 
        type: activeTab, 
        balance: 0, 
        target_amount: activeTab === 'RENT' ? 30000 : null,
        last_updated: new Date().toISOString() 
      };
      const { data, error } = await supabase.from('contacts').insert([payload]).select();
      if (error) throw error;
      if (data) setContacts([...contacts, { ...payload, lastUpdated: payload.last_updated, targetAmount: payload.target_amount }]);
      setAddName(''); setAddPhone('');
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteContact = async (id: string) => {
    if (!window.confirm("Delete this contact and all their transactions? This cannot be undone.")) return;
    setIsSubmitting(true);
    try {
      await supabase.from('transactions').delete().eq('contact_id', id);
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
      
      setContacts(contacts.filter(c => c.id !== id));
      setTransactions(transactions.filter(t => t.contactId !== id));
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleResetAllData = async () => {
    if (!window.confirm("CRITICAL: Delete EVERYTHING? (Contacts, Transactions, Cash Book). This is permanent.")) return;
    setIsSubmitting(true);
    try {
      // In Supabase with RLS off or proper permissions, we delete by targeting all rows.
      // Usually requires a .neq('id', '0') or similar for bulk delete.
      await Promise.all([
        supabase.from('transactions').delete().neq('id', '0'),
        supabase.from('contacts').delete().neq('id', '0'),
        supabase.from('cash_transactions').delete().neq('id', '0')
      ]);
      setContacts([]);
      setTransactions([]);
      setCashTransactions([]);
      alert("All data cleared. Application reset.");
      navigateTo('DASHBOARD');
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleSaveTransaction = async () => {
    if (!selectedContact || isSubmitting) return;
    const amountVal = parseFloat(transAmount) || 0;
    if (amountVal < 0) return;

    setIsSubmitting(true);
    let currentBalance = selectedContact.balance;
    if (editingTransaction) {
      const oldAmount = editingTransaction.amount;
      if (selectedContact.type === 'RENT') {
        currentBalance = editingTransaction.type === 'PAYMENT' ? currentBalance - oldAmount : currentBalance + oldAmount;
      } else {
        currentBalance = editingTransaction.type === 'CREDIT' ? currentBalance - oldAmount : currentBalance + oldAmount;
      }
    }

    let newBalance = currentBalance;
    if (selectedContact.type === 'RENT') {
      newBalance = transType === 'PAYMENT' ? newBalance + amountVal : newBalance - amountVal;
    } else {
      newBalance = transType === 'CREDIT' ? newBalance + amountVal : newBalance - amountVal;
    }

    try {
      const txPayload = { 
        contact_id: selectedContact.id, 
        date: transDate, 
        amount: amountVal, 
        type: transType, 
        description: transDesc, 
        balance_after: newBalance 
      };

      let res;
      if (editingTransaction) {
        res = await supabase.from('transactions').update(txPayload).eq('id', editingTransaction.id).select();
      } else {
        res = await supabase.from('transactions').insert([txPayload]).select();
      }

      if (res.error) throw res.error;
      
      await supabase.from('contacts').update({ balance: newBalance, last_updated: new Date().toISOString() }).eq('id', selectedContact.id);
      
      if (res.data) {
        const saved = { id: res.data[0].id, contactId: res.data[0].contact_id, date: res.data[0].date, description: res.data[0].description, amount: res.data[0].amount, type: res.data[0].type, balanceAfter: res.data[0].balance_after };
        if (editingTransaction) {
          setTransactions(transactions.map(t => t.id === editingTransaction.id ? saved : t));
        } else {
          setTransactions([saved, ...transactions]);
        }
      }
      
      const updated = { ...selectedContact, balance: newBalance, lastUpdated: new Date().toISOString() };
      setContacts(contacts.map(c => c.id === selectedContact.id ? updated : c));
      setSelectedContact(updated);
      setEditingTransaction(null);
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /><p className="text-gray-400 font-medium">Syncing Ledger...</p></div>;
  
  if (currentView === 'DASHBOARD') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-20 no-scrollbar">
        <header className="bg-white px-4 py-3 pb-0 shadow-sm z-20 sticky top-0">
          <div className="flex justify-between items-start mb-2">
            <div><h1 className="text-xl font-bold text-slate-800">Manage Credit</h1><p className="text-xs font-semibold text-slate-500">{shopName}</p></div>
            <PlayCircle size={20} className="text-blue-600" />
          </div>
          <div className="flex gap-6 mt-4">
            <button onClick={() => setActiveTab('CUSTOMER')} className={`flex items-center gap-2 pb-3 border-b-2 font-medium transition-colors ${activeTab === 'CUSTOMER' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500'}`}><Users size={18} />Customers</button>
            <button onClick={() => setActiveTab('SUPPLIER')} className={`flex items-center gap-2 pb-3 border-b-2 font-medium transition-colors ${activeTab === 'SUPPLIER' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500'}`}><Truck size={18} />Suppliers</button>
            <button onClick={() => setActiveTab('RENT')} className={`flex items-center gap-2 pb-3 border-b-2 font-medium transition-colors ${activeTab === 'RENT' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500'}`}><Building size={18} />Rent</button>
          </div>
        </header>

        <div className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-3 shadow-sm flex flex-col justify-center min-h-[70px]">
              <p className="text-[11px] text-slate-600 font-medium mb-1 uppercase tracking-tighter">
                {activeTab === 'RENT' ? 'Rent Saved' : (activeTab === 'SUPPLIER' ? 'Total Paid' : 'Total Received')}
              </p>
              <p className="text-lg font-bold text-[#15803d]">Rs. {activeTotals.totalPayments.toLocaleString()}</p>
            </div>
            <div className="bg-[#fef2f2] border border-[#fee2e2] rounded-xl p-3 shadow-sm flex flex-col justify-center min-h-[70px]">
              <p className="text-[11px] text-slate-600 font-medium mb-1 uppercase tracking-tighter">
                {activeTab === 'RENT' ? 'Current Debt' : (activeTab === 'SUPPLIER' ? 'To pay' : 'To collect')}
              </p>
              <p className="text-lg font-bold text-[#b91c1c]">Rs. {activeTotals.netBalance.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="bg-[#f1f5f9] rounded-xl px-4 py-3 flex items-center flex-1 border border-transparent focus-within:border-blue-200 transition-all">
              <Search size={18} className="text-slate-400 mr-3" />
              <input 
                type="text" 
                placeholder="Search name or number here" 
                className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400 font-medium" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
            </div>
            <button className="bg-[#eff6ff] text-[#2563eb] p-3 rounded-xl border border-[#dbeafe] active:scale-95 transition-transform flex items-center justify-center">
              <Filter size={20} />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {filteredContacts.map(c => {
              const displayAmount = activeTab === 'RENT' ? getCycleSavings(c.id) : Math.abs(c.balance);
              return (
                <div key={c.id} onClick={() => { setSelectedContact(c); navigateTo('DETAIL', c.id); }} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between active:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner ${c.type === 'RENT' ? 'bg-blue-500' : 'bg-slate-400'}`}>
                      {c.name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{c.name}</h3>
                      <p className="text-[11px] text-slate-400 font-medium">{c.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">
                      {c.type === 'RENT' ? 'Current Cycle' : 'Balance'}
                    </p>
                    <p className={`font-bold text-[15px] ${c.balance > 0 || c.type === 'RENT' ? (c.type === 'RENT' ? 'text-blue-600' : 'text-red-600') : 'text-green-600'}`}>
                      Rs. {displayAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
            {filteredContacts.length === 0 && <div className="text-center py-16 text-slate-400 text-sm font-medium">No results found</div>}
          </div>
        </div>
        
        <button onClick={() => navigateTo('ADD_CONTACT')} className={`fixed bottom-24 right-4 w-14 h-14 ${theme.primary} text-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center z-30 active:scale-90 transition-all`}><Plus size={28} /></button>
        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme={appTheme} />
      </div>
    );
  }

  if (currentView === 'ADD_CONTACT') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-4 py-4 flex items-center gap-4 border-b border-gray-100"><button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button><h1 className="text-lg font-bold">Add New {activeTab}</h1></header>
        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
            <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Enter Name" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone (Optional)</label>
            <input value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="07XXXXXXXX" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" />
          </div>
          <button 
            disabled={isSubmitting}
            onClick={handleAddContact} 
            className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg mt-8 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Add To Ledger'}
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'DETAIL' && selectedContact) {
    const isSupplier = selectedContact.type === 'SUPPLIER';
    const isRent = selectedContact.type === 'RENT';
    const labelLeft = isRent ? "WITHDRAW" : (isSupplier ? "YOU GOT" : "YOU GAVE");
    const labelRight = isRent ? "DEPOSIT" : (isSupplier ? "YOU GAVE" : "YOU GOT");

    const contactTransactions = transactions
      .filter(t => t.contactId === selectedContact.id)
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let runningBalance = selectedContact.balance;
    const computedTransactions = contactTransactions.map((t) => {
      const displayTx = { ...t, balanceAfter: runningBalance };
      if (isRent) {
        runningBalance = t.type === 'PAYMENT' ? runningBalance - t.amount : runningBalance + t.amount;
      } else {
        runningBalance = t.type === 'CREDIT' ? runningBalance - t.amount : runningBalance + t.amount;
      }
      return displayTx;
    });

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-28 no-scrollbar">
        <header className="bg-white sticky top-0 z-30 shadow-sm px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button>
          <div className="flex-1"><h1 className="font-bold text-lg">{selectedContact.name}</h1><p className="text-[11px] text-slate-400 font-medium">{selectedContact.phone}</p></div>
          <button onClick={() => handleDeleteContact(selectedContact.id)} className="p-2 text-red-400 active:text-red-600"><Trash2 size={20} /></button>
        </header>
        <div className="p-4 bg-white mb-2 shadow-sm text-center">
          <div className="bg-[#f8fafc] rounded-2xl p-6 border border-slate-100 shadow-inner">
            <h2 className={`text-3xl font-bold ${selectedContact.balance > 0 ? (isRent ? 'text-blue-600' : 'text-red-600') : 'text-green-600'}`}>
              Rs. {Math.abs(selectedContact.balance).toLocaleString()}
            </h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">
              {isRent ? 'Current Balance' : (selectedContact.balance > 0 ? (isSupplier ? 'You Owe Him' : 'He Owes You') : 'Settled')}
            </p>
          </div>
        </div>
        <div className="flex-1 bg-white">
          {computedTransactions.map(t => (
            <TransactionRow key={t.id} transaction={t} onClick={(tx) => {
                setEditingTransaction(tx);
                setTransType(tx.type);
                setTransAmount(tx.amount.toString());
                setTransDate(tx.date);
                setTransDesc(tx.description || '');
                navigateTo('TRANSACTION_FORM', selectedContact.id);
            }} />
          ))}
          {computedTransactions.length === 0 && <div className="p-16 text-center text-slate-400 font-medium text-sm">No history yet</div>}
        </div>
        <div className="fixed bottom-0 left-0 right-0 bg-white px-4 pt-4 pb-10 flex gap-4 border-t border-slate-100 z-40 shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
          <button onClick={() => { setEditingTransaction(null); setTransType('CREDIT'); setTransAmount(''); setTransDesc(''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} className="flex-1 bg-red-700 text-white font-bold py-4 rounded-xl flex flex-col items-center justify-center active:scale-95 transition-all shadow-md">
             <span className="text-[10px] opacity-90 uppercase font-black tracking-tighter">{labelLeft}</span>
             <span className="flex items-center gap-1 font-bold text-lg">Rs. <ArrowDown size={14} /></span>
          </button>
          <button onClick={() => { setEditingTransaction(null); setTransType('PAYMENT'); setTransAmount(''); setTransDesc(''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} className="flex-1 bg-green-700 text-white font-bold py-4 rounded-xl flex flex-col items-center justify-center active:scale-95 transition-all shadow-md">
             <span className="text-[10px] opacity-90 uppercase font-black tracking-tighter">{labelRight}</span>
             <span className="flex items-center gap-1 font-bold text-lg">Rs. <ArrowUp size={14} /></span>
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'PROFILE') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-20 no-scrollbar">
        <header className="bg-white px-6 py-8 shadow-sm flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-white shadow-xl">
             <Store size={40} />
          </div>
          <div className="text-center">
             <h1 className="text-xl font-bold">{shopName}</h1>
             <p className="text-sm text-slate-400">Settings & Security</p>
          </div>
        </header>
        
        <div className="p-6 flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col gap-4">
             <div className="flex items-center gap-4 p-2 border-b border-slate-50 active:bg-slate-50">
               <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Phone size={20} /></div>
               <div className="flex-1"><p className="text-xs text-slate-400 font-bold uppercase">Business Phone</p><p className="font-semibold">+94 XX XXX XXXX</p></div>
               <ChevronRight size={18} className="text-slate-300" />
             </div>
             <div className="flex items-center gap-4 p-2 active:bg-slate-50">
               <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><Languages size={20} /></div>
               <div className="flex-1"><p className="text-xs text-slate-400 font-bold uppercase">Language</p><p className="font-semibold">English (US)</p></div>
               <ChevronRight size={18} className="text-slate-300" />
             </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-4 flex flex-col gap-4">
             <h3 className="text-[11px] font-black text-red-500 uppercase tracking-widest px-2">Danger Zone</h3>
             <button 
               onClick={handleResetAllData}
               disabled={isSubmitting}
               className="flex items-center gap-4 p-4 rounded-xl bg-red-50 text-red-700 active:bg-red-100 transition-colors"
             >
               <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                 {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <ShieldAlert size={20} />}
               </div>
               <div className="text-left flex-1">
                 <p className="font-bold">Delete All Data</p>
                 <p className="text-[10px] opacity-70">Wipe all records and start fresh</p>
               </div>
             </button>
          </div>
        </div>
        
        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme={appTheme} />
      </div>
    );
  }

  // Transaction form view
  if (currentView === 'TRANSACTION_FORM' && selectedContact) {
    const isSupplier = selectedContact.type === 'SUPPLIER';
    const isRent = selectedContact.type === 'RENT';
    let title = editingTransaction ? "Edit Entry" : (isRent ? (transType === 'PAYMENT' ? "Deposit Savings" : "Withdraw Savings") : (transType === 'CREDIT' ? (isSupplier ? 'Received Items' : 'Gave Items') : (isSupplier ? 'Paid Money' : 'Received Money')));

    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-4 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-4"><button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button><h1 className="text-lg font-bold">{title}</h1></div>
          {editingTransaction && (
            <button disabled={isSubmitting} onClick={async () => {
              if (!window.confirm("Delete this entry?")) return;
              setIsSubmitting(true);
              try {
                let newBalance = selectedContact.balance;
                if (isRent) {
                   newBalance = editingTransaction.type === 'PAYMENT' ? newBalance - editingTransaction.amount : newBalance + editingTransaction.amount;
                } else {
                   newBalance = editingTransaction.type === 'CREDIT' ? newBalance - editingTransaction.amount : newBalance + editingTransaction.amount;
                }
                await supabase.from('transactions').delete().eq('id', editingTransaction.id);
                await supabase.from('contacts').update({ balance: newBalance }).eq('id', selectedContact.id);
                setTransactions(transactions.filter(t => t.id !== editingTransaction.id));
                setContacts(contacts.map(c => c.id === selectedContact.id ? {...c, balance: newBalance} : c));
                handleBack();
              } catch (e:any) { alert(e.message); }
              finally { setIsSubmitting(false); }
            }} className="p-2 text-red-600 bg-red-50 rounded-full active:bg-red-100 transition-colors">
              <Trash2 size={20} />
            </button>
          )}
        </header>
        <div className="p-6 flex-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
          <input type="number" value={transAmount} onChange={e => setTransAmount(e.target.value)} placeholder="0.00" className={`w-full text-5xl font-bold mb-8 outline-none border-none ${transType === 'CREDIT' ? 'text-red-600' : 'text-green-600'}`} autoFocus />
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Transaction Date</label>
          <input type="date" value={transDate} onChange={e => setTransDate(e.target.value)} className="w-full border-b mb-8 py-3 font-semibold outline-none focus:border-blue-500 transition-colors" />
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Description / Notes</label>
          <textarea value={transDesc} onChange={e => setTransDesc(e.target.value)} placeholder="Add items or cash details..." className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 h-32 outline-none focus:border-slate-300 transition-colors" />
        </div>
        <div className="p-6 pb-12">
          <button disabled={isSubmitting} onClick={handleSaveTransaction} className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-xl flex items-center justify-center gap-2 ${transType === 'CREDIT' ? 'bg-red-700' : 'bg-green-700'} disabled:opacity-50 active:scale-95 transition-all`}>
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingTransaction ? 'Update Ledger' : 'Confirm & Save')}
          </button>
        </div>
      </div>
    );
  }

  // Cash book view
  if (currentView === 'CASH_BOOK') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-24 no-scrollbar">
        <header className="bg-white px-4 py-4 shadow-sm sticky top-0 z-20"><h1 className="text-xl font-bold">Cash Book</h1></header>
        <div className="p-4 flex flex-col gap-4">
          <div className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Net Cash Balance</p>
            <h2 className="text-4xl font-black">Rs. {cashSummary.balance.toLocaleString()}</h2>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {cashTransactions.map(t => (
              <div key={t.id} className="p-4 border-b border-slate-50 flex justify-between items-center active:bg-slate-50 transition-colors">
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${t.type === 'IN' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{t.type === 'IN' ? <TrendingUp size={24} /> : <TrendingDown size={24} />}</div>
                  <div><p className="text-sm font-bold text-slate-800">{t.description || (t.type === 'IN' ? 'Cash Received' : 'Cash Expense')}</p><p className="text-[10px] text-slate-400 font-bold tracking-wider">{new Date(t.date).toLocaleDateString()}</p></div>
                </div>
                <p className={`font-black text-lg ${t.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'IN' ? '+' : '-'} {t.amount.toLocaleString()}</p>
              </div>
            ))}
            {cashTransactions.length === 0 && <div className="p-16 text-center text-slate-400 font-medium">No cash entries today</div>}
          </div>
        </div>
        {isCashFormOpen && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end animate-in fade-in duration-200">
            <div className="bg-white w-full rounded-t-[2.5rem] p-8 shadow-[0_-10px_50px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-300">
              <div className="flex gap-3 mb-8">
                <button onClick={() => setCashType('IN')} className={`flex-1 py-4 rounded-2xl border-2 font-black transition-all ${cashType === 'IN' ? 'border-green-600 text-green-700 bg-green-50' : 'border-slate-100 text-slate-400'}`}>CASH IN</button>
                <button onClick={() => setCashType('OUT')} className={`flex-1 py-4 rounded-2xl border-2 font-black transition-all ${cashType === 'OUT' ? 'border-red-600 text-red-700 bg-red-50' : 'border-slate-100 text-slate-400'}`}>CASH OUT</button>
              </div>
              <input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="0.00" className="w-full text-4xl font-black mb-6 py-4 border-b-2 outline-none focus:border-slate-800 transition-colors text-center" autoFocus />
              <input value={cashDesc} onChange={e => setCashDesc(e.target.value)} placeholder="Entry details (e.g., Sales, Lunch)" className="w-full text-lg mb-10 py-4 border-b outline-none focus:border-slate-400 transition-colors" />
              <button onClick={async () => {
                const amount = parseFloat(cashAmount) || 0;
                if (amount <= 0) return;
                const p = { id: generateUUID(), date: new Date().toISOString(), amount, type: cashType, description: cashDesc };
                await supabase.from('cash_transactions').insert([p]);
                setCashTransactions([p, ...cashTransactions]);
                setIsCashFormOpen(false); setCashAmount(''); setCashDesc('');
              }} className={`w-full py-5 rounded-2xl text-white font-black text-xl shadow-lg active:scale-95 transition-all ${cashType === 'IN' ? 'bg-green-600 shadow-green-200' : 'bg-red-600 shadow-red-200'}`}>Add Entry</button>
              <button onClick={() => setIsCashFormOpen(false)} className="w-full text-slate-400 mt-6 font-bold py-2">Close</button>
            </div>
          </div>
        )}
        <button onClick={() => setIsCashFormOpen(true)} className="fixed bottom-24 right-4 w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all z-30"><Plus size={32} /></button>
        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme={appTheme} />
      </div>
    );
  }

  return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-slate-200" size={40} /></div>;
}