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

const normalizeToLocalMidnight = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const getRentCycleStart = () => {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth();
  const year = now.getFullYear();
  let cycleStart;
  if (day >= 13) { cycleStart = new Date(year, month, 13); } 
  else { cycleStart = new Date(year, month - 1, 13); }
  cycleStart.setHours(0, 0, 0, 0);
  return cycleStart;
};

export default function App() {
  const [currentView, setCurrentView] = useState<string>('DASHBOARD');
  const [activeTab, setActiveTab] = useState<ContactType>('RENT');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const contactsRef = useRef(contacts);
  const [appTheme, setAppTheme] = useState<ThemeColor>('blue');
  const [shopName, setShopName] = useState('Smart Time');
  const [searchQuery, setSearchQuery] = useState('');

  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [targetAmount, setTargetAmount] = useState('30000');
  const [isCashFormOpen, setIsCashFormOpen] = useState(false);
  const [cashType, setCashType] = useState<'IN' | 'OUT'>('IN');
  const [cashAmount, setCashAmount] = useState('');
  const [cashDesc, setCashDesc] = useState('');
  
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transType, setTransType] = useState<TransactionType>('CREDIT');
  const [transAmount, setTransAmount] = useState('');
  const [transDate, setTransDate] = useState(new Date().toISOString().slice(0, 10));
  const [transDesc, setTransDesc] = useState('');

  const dateInputRef = useRef<HTMLInputElement>(null);
  const theme = THEMES[appTheme];

  useEffect(() => { contactsRef.current = contacts; }, [contacts]);

  useEffect(() => {
    if (!window.history.state) {
        window.history.replaceState({ view: 'DASHBOARD', contactId: null, tab: 'RENT' }, '', window.location.pathname);
    }
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (!state) { setCurrentView('DASHBOARD'); setSelectedContact(null); return; }
      setCurrentView(state.view || 'DASHBOARD');
      if (state.tab) setActiveTab(state.tab);
      if (state.contactId) {
        const c = contactsRef.current.find(con => con.id === state.contactId);
        setSelectedContact(c || null);
      } else { setSelectedContact(null); }
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
    try {
      const [contactsRes, transRes, cashRes] = await Promise.all([
        supabase.from('contacts').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('cash_transactions').select('*').order('date', { ascending: false })
      ]);
      if (contactsRes.data) {
          setContacts(contactsRes.data.map((c: any) => ({
              id: c.id, name: c.name, phone: c.phone || '', type: c.type,
              balance: c.balance || 0, targetAmount: c.target_amount,
              startDate: c.start_date, endDate: c.end_date, lastUpdated: c.last_updated
          })));
      }
      if (transRes.data) {
          setTransactions(transRes.data.map((t: any) => ({
              id: t.id, contactId: t.contact_id, date: t.date, description: t.description,
              amount: t.amount, type: t.type, balanceAfter: t.balance_after,
              hasAttachment: t.has_attachment, attachmentUrl: t.attachment_url
          })));
      }
      if (cashRes.data) {
        setCashTransactions(cashRes.data.map((c: any) => ({
          id: c.id, date: c.date, amount: c.amount, type: c.type, description: c.description
        })));
      }
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // For Summary calculation specifically for "Cycle" targets
  const getCycleSavings = (contactId: string) => {
    const cycleStart = getRentCycleStart();
    return transactions
      .filter(t => {
        if (t.contactId !== contactId) return false;
        const tDate = normalizeToLocalMidnight(t.date);
        return tDate >= cycleStart;
      })
      .reduce((sum, t) => { return t.type === 'PAYMENT' ? sum + t.amount : sum - t.amount; }, 0);
  };

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
    if (activeTab === 'RENT') {
      let totalSavedOverall = 0;
      let totalCurrentCycleSaved = 0;
      let totalMonthlyTarget = 0;

      currentContacts.forEach(contact => {
        const target = contact.targetAmount || 30000;
        totalMonthlyTarget += target;
        totalSavedOverall += contact.balance;
        totalCurrentCycleSaved += getCycleSavings(contact.id);
      });

      // Show Overall Savings in 'Rent Saved' card so older dates appear immediately
      const currentDebt = Math.max(0, totalMonthlyTarget - totalCurrentCycleSaved);
      return { totalPayments: totalSavedOverall, netBalance: currentDebt };
    } else {
      const contactIds = currentContacts.map(c => c.id);
      const totalPayments = transactions
        .filter(t => contactIds.includes(t.contactId) && t.type === 'PAYMENT')
        .reduce((acc, t) => acc + t.amount, 0);
      const netBalance = currentContacts.reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
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
      const finalTarget = activeTab === 'RENT' ? (parseFloat(targetAmount) || 30000) : null;
      const payload = { 
        id: generateUUID(), name: addName, phone: addPhone, type: activeTab, balance: 0, 
        target_amount: finalTarget, last_updated: new Date().toISOString() 
      };
      const { data, error } = await supabase.from('contacts').insert([payload]).select();
      if (error) throw error;
      if (data) setContacts([...contacts, { ...payload, lastUpdated: payload.last_updated, targetAmount: payload.target_amount }]);
      setAddName(''); setAddPhone(''); setTargetAmount('30000');
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteContact = async (id: string) => {
    if (!window.confirm("Delete this entry and start new check?")) return;
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
        contact_id: selectedContact.id, date: transDate, amount: amountVal, 
        type: transType, description: transDesc, balance_after: newBalance 
      };
      let res;
      if (editingTransaction) { res = await supabase.from('transactions').update(txPayload).eq('id', editingTransaction.id).select(); }
      else { res = await supabase.from('transactions').insert([txPayload]).select(); }
      if (res.error) throw res.error;
      await supabase.from('contacts').update({ balance: newBalance, last_updated: new Date().toISOString() }).eq('id', selectedContact.id);
      if (res.data) {
        const saved = { id: res.data[0].id, contactId: res.data[0].contact_id, date: res.data[0].date, description: res.data[0].description, amount: res.data[0].amount, type: res.data[0].type, balanceAfter: res.data[0].balance_after };
        if (editingTransaction) { setTransactions(transactions.map(t => t.id === editingTransaction.id ? saved : t)); }
        else { setTransactions([saved, ...transactions]); }
      }
      const updated = { ...selectedContact, balance: newBalance, lastUpdated: new Date().toISOString() };
      setContacts(contacts.map(c => c.id === selectedContact.id ? updated : c));
      setSelectedContact(updated);
      setEditingTransaction(null);
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /><p className="text-gray-400 font-medium">Updating Ledger...</p></div>;
  
  if (currentView === 'DASHBOARD') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-20 no-scrollbar">
        <header className="bg-white px-4 py-3 pb-0 shadow-sm z-20 sticky top-0">
          <div className="flex justify-between items-start mb-2">
            <div><h1 className="text-xl font-bold text-slate-800">Ledger Book</h1><p className="text-xs font-semibold text-slate-500">{shopName}</p></div>
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
              <p className="text-[10px] text-slate-600 font-bold mb-1 uppercase tracking-tighter">
                {activeTab === 'RENT' ? 'Rent Saved' : (activeTab === 'SUPPLIER' ? 'Total Paid' : 'Total Received')}
              </p>
              <p className="text-lg font-bold text-[#15803d]">Rs. {activeTotals.totalPayments.toLocaleString()}</p>
            </div>
            <div className="bg-[#fef2f2] border border-[#fee2e2] rounded-xl p-3 shadow-sm flex flex-col justify-center min-h-[70px]">
              <p className="text-[10px] text-slate-600 font-bold mb-1 uppercase tracking-tighter">
                {activeTab === 'RENT' ? 'Current Debt' : (activeTab === 'SUPPLIER' ? 'To pay' : 'To collect')}
              </p>
              <p className="text-lg font-bold text-[#b91c1c]">Rs. {activeTotals.netBalance.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="bg-[#f1f5f9] rounded-xl px-4 py-3 flex items-center flex-1 border border-transparent focus-within:border-blue-200 transition-all shadow-sm">
              <Search size={18} className="text-slate-400 mr-3" />
              <input type="text" placeholder="Search name or number here" className="bg-transparent outline-none text-[13px] w-full placeholder:text-slate-400 font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <button className="bg-[#eff6ff] text-[#2563eb] p-3 rounded-xl border border-[#dbeafe] active:scale-95 transition-transform flex items-center justify-center shadow-sm"><Filter size={18} /></button>
          </div>

          <div className="flex flex-col gap-2">
            {filteredContacts.map(c => {
              // Using total balance (c.balance) for RENT list items ensures old dates show up immediately
              const displayAmount = activeTab === 'RENT' ? c.balance : Math.abs(c.balance);
              return (
                <div key={c.id} onClick={() => { setSelectedContact(c); navigateTo('DETAIL', c.id); }} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between active:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner ${c.type === 'RENT' ? 'bg-[#3b82f6]' : 'bg-slate-400'}`}>
                      {c.name[0]}
                    </div>
                    <h3 className="font-semibold text-slate-800 text-sm">{c.name}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">{c.type === 'RENT' ? 'Total Saved' : 'Balance'}</p>
                    <p className={`font-bold text-[15px] ${c.type === 'RENT' ? 'text-[#2563eb]' : (c.balance > 0 ? 'text-red-600' : 'text-green-600')}`}>
                      Rs. {displayAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
            {filteredContacts.length === 0 && <div className="text-center py-16 text-slate-400 text-sm font-medium">No records yet</div>}
          </div>
        </div>
        <button onClick={() => navigateTo('ADD_CONTACT')} className={`fixed bottom-24 right-4 w-14 h-14 ${theme.primary} text-white rounded-full shadow-xl flex items-center justify-center z-30 active:scale-90 transition-all`}><Plus size={28} /></button>
        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme={appTheme} />
      </div>
    );
  }

  if (currentView === 'DETAIL' && selectedContact) {
    const isRent = selectedContact.type === 'RENT';
    const labelLeft = isRent ? "WITHDRAW" : (selectedContact.type === 'SUPPLIER' ? "GOT ITEMS" : "GAVE ITEMS");
    const labelRight = isRent ? "DEPOSIT" : (selectedContact.type === 'SUPPLIER' ? "PAID MONEY" : "GOT MONEY");
    const contactTransactions = transactions.filter(t => t.contactId === selectedContact.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let runningBalance = selectedContact.balance;
    const computedTransactions = contactTransactions.map((t) => {
      const displayTx = { ...t, balanceAfter: runningBalance };
      if (isRent) { runningBalance = t.type === 'PAYMENT' ? runningBalance - t.amount : runningBalance + t.amount; }
      else { runningBalance = t.type === 'CREDIT' ? runningBalance - t.amount : runningBalance + t.amount; }
      return displayTx;
    });
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-28 no-scrollbar">
        <header className="bg-white sticky top-0 z-30 shadow-sm px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button>
          <div className="flex-1"><h1 className="font-bold text-lg">{selectedContact.name}</h1><p className="text-[11px] text-slate-400 font-medium">{selectedContact.phone}</p></div>
          <button onClick={() => handleDeleteContact(selectedContact.id)} className="p-2 text-red-500 bg-red-50 rounded-full active:scale-90 transition-all shadow-sm"><Trash2 size={18} /></button>
        </header>
        <div className="p-4 bg-white mb-2 shadow-sm text-center">
          <div className="bg-[#f8fafc] rounded-2xl p-6 border border-slate-100 shadow-inner">
            <h2 className={`text-3xl font-bold ${selectedContact.balance > 0 ? (isRent ? 'text-blue-600' : 'text-red-600') : 'text-green-600'}`}>
              Rs. {Math.abs(selectedContact.balance).toLocaleString()}
            </h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">{isRent ? 'Total Savings' : 'Balance'}</p>
          </div>
        </div>
        <div className="flex-1 bg-white">
          {computedTransactions.map(t => (
            <TransactionRow key={t.id} transaction={t} onClick={(tx) => { setEditingTransaction(tx); setTransType(tx.type); setTransAmount(tx.amount.toString()); setTransDate(tx.date); setTransDesc(tx.description || ''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} />
          ))}
          {computedTransactions.length === 0 && <div className="p-16 text-center text-slate-400 font-medium text-sm">No entries here</div>}
        </div>
        <div className="fixed bottom-0 left-0 right-0 bg-white px-4 pt-4 pb-10 flex gap-4 border-t border-slate-100 z-40 shadow-lg">
          <button onClick={() => { setEditingTransaction(null); setTransType('CREDIT'); setTransAmount(''); setTransDesc(''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} className="flex-1 bg-red-700 text-white font-bold py-4 rounded-xl flex flex-col items-center justify-center active:scale-95 shadow-md">
             <span className="text-[10px] opacity-90 uppercase font-black tracking-tight">{labelLeft}</span>
             <span className="flex items-center gap-1 font-bold text-lg">Rs. <ArrowDown size={14} /></span>
          </button>
          <button onClick={() => { setEditingTransaction(null); setTransType('PAYMENT'); setTransAmount(''); setTransDesc(''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} className="flex-1 bg-green-700 text-white font-bold py-4 rounded-xl flex flex-col items-center justify-center active:scale-95 shadow-md">
             <span className="text-[10px] opacity-90 uppercase font-black tracking-tight">{labelRight}</span>
             <span className="flex items-center gap-1 font-bold text-lg">Rs. <ArrowUp size={14} /></span>
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'TRANSACTION_FORM' && selectedContact) {
    const isRent = selectedContact.type === 'RENT';
    let title = editingTransaction ? "Edit Record" : (isRent ? (transType === 'PAYMENT' ? "Deposit Savings" : "Withdraw Savings") : (transType === 'CREDIT' ? 'Items Sent' : 'Cash Received'));
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-4 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-4"><button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button><h1 className="text-lg font-bold">{title}</h1></div>
          {editingTransaction && (
            <button onClick={async () => { if (!window.confirm("Delete record?")) return; await supabase.from('transactions').delete().eq('id', editingTransaction.id); fetchData(); handleBack(); }} className="p-2 text-red-600 bg-red-50 rounded-full active:scale-90 transition-all"><Trash2 size={20} /></button>
          )}
        </header>
        <div className="p-6 flex-1 overflow-y-auto">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
          <input type="number" value={transAmount} onChange={e => setTransAmount(e.target.value)} placeholder="0.00" className={`w-full text-5xl font-bold mb-8 outline-none border-none ${transType === 'CREDIT' ? 'text-red-600' : 'text-green-600'}`} autoFocus />
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Transaction Date</label>
          <div className="flex flex-col gap-3 mb-8">
            <div className="flex gap-2">
              <button onClick={() => setTransDate(new Date().toISOString().slice(0, 10))} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border ${transDate === new Date().toISOString().slice(0, 10) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 shadow-sm'}`}>TODAY</button>
              <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setTransDate(d.toISOString().slice(0, 10)); }} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border ${transDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 shadow-sm'}`}>YESTERDAY</button>
              <button onClick={() => dateInputRef.current?.showPicker()} className="flex-1 py-2 rounded-lg text-[10px] font-bold bg-white text-slate-500 border border-slate-200 flex items-center justify-center gap-1 active:bg-gray-50 transition-colors shadow-sm"><Calendar size={12} /> CHANGE DATE</button>
            </div>
            <input ref={dateInputRef} type="date" value={transDate} onChange={e => setTransDate(e.target.value)} className="w-full border-b py-3 font-semibold outline-none focus:border-blue-500 transition-colors" />
          </div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Notes</label>
          <textarea value={transDesc} onChange={e => setTransDesc(e.target.value)} placeholder="Add optional details..." className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 h-24 outline-none focus:border-slate-300 transition-colors" />
        </div>
        <div className="p-6 pb-12">
          <button disabled={isSubmitting} onClick={handleSaveTransaction} className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-xl flex items-center justify-center gap-2 ${transType === 'CREDIT' ? 'bg-red-700' : 'bg-green-700'} active:scale-95 transition-all`}>
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Confirm Record'}
          </button>
        </div>
      </div>
    );
  }

  if (currentView === 'ADD_CONTACT') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-4 py-4 flex items-center gap-4 border-b"><button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button><h1 className="text-lg font-bold">Add New {activeTab}</h1></header>
        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
            <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Enter Name" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" autoFocus />
          </div>
          {activeTab === 'RENT' && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monthly Target (LKR)</label>
              <input value={targetAmount} onChange={e => setTargetAmount(e.target.value)} type="number" placeholder="30000" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" />
            </div>
          )}
          <button disabled={isSubmitting} onClick={handleAddContact} className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg mt-8 flex items-center justify-center gap-2 active:scale-95 transition-all">{isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Save Contact'}</button>
        </div>
      </div>
    );
  }

  if (currentView === 'PROFILE') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-20 no-scrollbar">
        <header className="bg-white px-6 py-8 shadow-sm flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-white shadow-xl"><Store size={40} /></div>
          <div className="text-center"><h1 className="text-xl font-bold">{shopName}</h1><p className="text-sm text-slate-400">Ledger Profile</p></div>
        </header>
        <div className="p-6">
           <button onClick={async () => { if(!window.confirm("RESET APP? This clears all entries permanently.")) return; await Promise.all([supabase.from('transactions').delete().neq('id', '0'), supabase.from('contacts').delete().neq('id', '0'), supabase.from('cash_transactions').delete().neq('id', '0')]); window.location.reload(); }} className="w-full flex items-center gap-4 p-4 rounded-xl bg-red-50 text-red-700 active:bg-red-100 transition-colors border border-red-100 shadow-sm"><ShieldAlert size={20} /><div className="text-left font-bold">Wipe Ledger Data</div></button>
        </div>
        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme={appTheme} />
      </div>
    );
  }

  return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-slate-200" size={40} /></div>;
}