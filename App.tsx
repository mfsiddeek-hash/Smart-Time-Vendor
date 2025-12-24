import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  BookText, Wallet, Receipt, UserCircle, Store, Phone, Pencil, Palette, 
  Check, Languages, ChevronRight, LogOut, ChevronLeft, Share2, Calendar, 
  ChevronDown, Filter, Download, Trash2, Calculator, FilePlus, Loader2, 
  Camera, Eye, Target, MoreVertical, RefreshCw, ArrowDown, ArrowUp, 
  Search, Plus, FileText, Users, Truck, Building, PlayCircle, CalendarClock,
  ArrowRight, Database, AlertCircle, History, TrendingUp, TrendingDown
} from 'lucide-react';
import { jsPDF } from 'jsPDF';
import autoTable from 'jspdf-autotable';
import { Contact, Transaction, ContactType, TransactionType } from './types';
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

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesType = c.type === activeTab;
      const query = searchQuery.toLowerCase().trim();
      return matchesType && (!query || c.name.toLowerCase().includes(query) || c.phone.includes(query));
    });
  }, [contacts, activeTab, searchQuery]);

  const totals = useMemo(() => {
    const sT = contacts.filter(c => c.type === 'SUPPLIER').reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
    const cT = contacts.filter(c => c.type === 'CUSTOMER').reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
    const rS = contacts.filter(c => c.type === 'RENT').reduce((acc, c) => acc + c.balance, 0);
    return { supplierTotal: sT, customerToCollect: cT, rentSaved: rS };
  }, [contacts]);

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
      const payload = { id: generateUUID(), name: addName, phone: addPhone, type: activeTab, balance: 0, last_updated: new Date().toISOString() };
      const { data, error } = await supabase.from('contacts').insert([payload]).select();
      if (error) throw error;
      if (data) setContacts([...contacts, { ...payload, lastUpdated: payload.last_updated }]);
      setAddName(''); setAddPhone('');
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleSaveTransaction = async () => {
    if (!selectedContact || isSubmitting) return;
    const amountVal = parseFloat(transAmount) || 0;
    if (amountVal < 0) return; // Allow 0 for descriptions maybe? But usually > 0

    setIsSubmitting(true);
    // Reconciliation if we were editing (revert old balance first)
    let currentBalance = selectedContact.balance;
    if (editingTransaction) {
      const oldAmount = editingTransaction.amount;
      if (selectedContact.type === 'RENT') {
        // Revert Rent: Payment was Deposit(+), Credit was Withdrawal(-)
        currentBalance = editingTransaction.type === 'PAYMENT' ? currentBalance - oldAmount : currentBalance + oldAmount;
      } else {
        // Revert Customer/Supplier: Credit was Debt(+), Payment was Paid(-)
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

  const handleDeleteTransaction = async () => {
    if (!selectedContact || !editingTransaction || isSubmitting) return;
    if (!window.confirm("Are you sure you want to delete this transaction? This will permanently adjust the balance.")) return;

    setIsSubmitting(true);
    let newBalance = selectedContact.balance;
    const amount = editingTransaction.amount;
    
    // Reverse the transaction effect on the total balance
    if (selectedContact.type === 'RENT') {
      // Revert Rent: Payment was Deposit (+), Credit was Withdrawal (-)
      newBalance = editingTransaction.type === 'PAYMENT' ? newBalance - amount : newBalance + amount;
    } else {
      // Revert Customer/Supplier: Credit was Debt (+), Payment was Paid (-)
      newBalance = editingTransaction.type === 'CREDIT' ? newBalance - amount : newBalance + amount;
    }

    try {
      const { error } = await supabase.from('transactions').delete().eq('id', editingTransaction.id);
      if (error) throw error;

      await supabase.from('contacts').update({ balance: newBalance, last_updated: new Date().toISOString() }).eq('id', selectedContact.id);

      setTransactions(transactions.filter(t => t.id !== editingTransaction.id));
      const updated = { ...selectedContact, balance: newBalance, lastUpdated: new Date().toISOString() };
      setContacts(contacts.map(c => c.id === selectedContact.id ? updated : c));
      setSelectedContact(updated);
      setEditingTransaction(null);
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /><p className="text-gray-400 font-medium">Syncing Ledger...</p></div>;
  if (loadError) return <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-center"><div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm"><AlertCircle size={48} className="text-red-500 mx-auto mb-4" /><h2 className="text-xl font-bold mb-2">Sync Error</h2><p className="text-gray-500 text-sm mb-6">{loadError}</p><button onClick={fetchData} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><RefreshCw size={18} /> Retry</button></div></div>;

  // VIEW: DASHBOARD
  if (currentView === 'DASHBOARD') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
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
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Total {activeTab === 'CUSTOMER' ? 'to collect' : activeTab === 'SUPPLIER' ? 'to pay' : 'saved'}</p>
            <p className={`text-xl font-bold ${activeTab === 'RENT' ? 'text-blue-600' : 'text-red-600'}`}>Rs. {(activeTab === 'CUSTOMER' ? totals.customerToCollect : activeTab === 'SUPPLIER' ? totals.supplierTotal : totals.rentSaved).toLocaleString()}</p>
          </div>
          <div className="bg-gray-100 rounded-lg px-3 py-2.5 flex items-center"><Search size={18} className="text-gray-400 mr-2" /><input type="text" placeholder="Search name" className="bg-transparent outline-none text-sm w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
          <div className="flex flex-col gap-2">
            {filteredContacts.map(c => (
              <div key={c.id} onClick={() => { setSelectedContact(c); navigateTo('DETAIL', c.id); }} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between active:bg-gray-50 cursor-pointer">
                <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${c.type === 'RENT' ? 'bg-blue-500' : 'bg-slate-400'}`}>{c.name[0]}</div><div><h3 className="font-semibold text-slate-800">{c.name}</h3><p className="text-xs text-gray-400">{c.phone}</p></div></div>
                <div className="text-right"><p className="text-[10px] text-gray-400 font-bold uppercase">Balance</p><p className={`font-bold ${c.balance > 0 ? (c.type === 'RENT' ? 'text-blue-600' : 'text-red-600') : 'text-green-600'}`}>{c.balance.toLocaleString()}</p></div>
              </div>
            ))}
            {filteredContacts.length === 0 && <div className="text-center py-10 text-gray-400">No {activeTab.toLowerCase()} records found</div>}
          </div>
        </div>
        <button onClick={() => navigateTo('ADD_CONTACT')} className={`fixed bottom-20 right-4 w-14 h-14 ${theme.primary} text-white rounded-full shadow-xl flex items-center justify-center z-30`}><Plus size={24} /></button>
        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme={appTheme} />
      </div>
    );
  }

  // VIEW: ADD_CONTACT
  if (currentView === 'ADD_CONTACT') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-4 py-4 flex items-center gap-4 border-b border-gray-100"><button onClick={handleBack}><ChevronLeft size={24} /></button><h1 className="text-lg font-bold">Add New {activeTab}</h1></header>
        <div className="p-6 flex flex-col gap-6">
          <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Full Name" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500" autoFocus />
          <input value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="Phone (Optional)" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500" />
          <button 
            disabled={isSubmitting}
            onClick={handleAddContact} 
            className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Add To Ledger'}
          </button>
        </div>
      </div>
    );
  }

  // VIEW: DETAIL
  if (currentView === 'DETAIL' && selectedContact) {
    const isSupplier = selectedContact.type === 'SUPPLIER';
    const isRent = selectedContact.type === 'RENT';
    
    const labelLeft = isRent ? "WITHDRAW" : (isSupplier ? "YOU GOT" : "YOU GAVE");
    const labelRight = isRent ? "DEPOSIT" : (isSupplier ? "YOU GAVE" : "YOU GOT");

    // Dynamic running balance calculation
    const contactTransactions = transactions
      .filter(t => t.contactId === selectedContact.id)
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let runningBalance = selectedContact.balance;
    const computedTransactions = contactTransactions.map((t) => {
      const displayTx = { ...t, balanceAfter: runningBalance };
      // Work backward: If it was a deposit (+), we subtract it to find previous balance
      if (isRent) {
        runningBalance = t.type === 'PAYMENT' ? runningBalance - t.amount : runningBalance + t.amount;
      } else {
        runningBalance = t.type === 'CREDIT' ? runningBalance - t.amount : runningBalance + t.amount;
      }
      return displayTx;
    });

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
        <header className="bg-white sticky top-0 z-30 shadow-sm px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button>
          <div className="flex-1"><h1 className="font-bold text-lg">{selectedContact.name}</h1><p className="text-xs text-gray-400">{selectedContact.phone}</p></div>
          <button onClick={() => navigateTo('ADD_CONTACT')} className="p-2 text-slate-400"><Pencil size={20} /></button>
        </header>
        <div className="p-4 bg-white mb-2 shadow-sm text-center">
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <h2 className={`text-2xl font-bold ${selectedContact.balance > 0 ? (isRent ? 'text-blue-600' : 'text-red-600') : 'text-green-600'}`}>Rs. {Math.abs(selectedContact.balance).toLocaleString()}</h2>
            <p className="text-gray-400 text-[10px] font-bold uppercase mt-1">
              {selectedContact.balance > 0 ? (isRent ? 'Current Savings' : (isSupplier ? 'You Owe Him' : 'He Owes You')) : 'Settled'}
            </p>
          </div>
        </div>
        <div className="flex-1 bg-white">
          {computedTransactions.map(t => (
            <TransactionRow 
              key={t.id} 
              transaction={t} 
              onClick={(tx) => {
                setEditingTransaction(tx);
                setTransType(tx.type);
                setTransAmount(tx.amount.toString());
                setTransDate(tx.date);
                setTransDesc(tx.description || '');
                navigateTo('TRANSACTION_FORM', selectedContact.id);
              }}
            />
          ))}
          {computedTransactions.length === 0 && <div className="p-10 text-center text-gray-400">No transactions recorded</div>}
        </div>
        <div className="fixed bottom-0 left-0 right-0 bg-white px-4 pt-4 pb-10 flex gap-4 border-t border-gray-200 z-40">
          <button onClick={() => { setEditingTransaction(null); setTransType('CREDIT'); setTransAmount(''); setTransDesc(''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} className="flex-1 bg-red-700 text-white font-bold py-3.5 rounded-xl flex flex-col items-center justify-center active:scale-95 transition-transform">
             <span className="text-[10px] opacity-80 uppercase">{labelLeft}</span>
             <span className="flex items-center gap-1 font-bold">Rs. <ArrowDown size={14} /></span>
          </button>
          <button onClick={() => { setEditingTransaction(null); setTransType('PAYMENT'); setTransAmount(''); setTransDesc(''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} className="flex-1 bg-green-700 text-white font-bold py-3.5 rounded-xl flex flex-col items-center justify-center active:scale-95 transition-transform">
             <span className="text-[10px] opacity-80 uppercase">{labelRight}</span>
             <span className="flex items-center gap-1 font-bold">Rs. <ArrowUp size={14} /></span>
          </button>
        </div>
      </div>
    );
  }

  // VIEW: TRANSACTION_FORM
  if (currentView === 'TRANSACTION_FORM' && selectedContact) {
    const isSupplier = selectedContact.type === 'SUPPLIER';
    const isRent = selectedContact.type === 'RENT';
    
    let title = "";
    if (editingTransaction) {
      title = "Edit Entry";
    } else {
      if (isRent) {
        title = transType === 'PAYMENT' ? "Deposit Savings" : "Withdraw Savings";
      } else {
        title = transType === 'CREDIT' ? (isSupplier ? 'Received Items' : 'Gave Items') : (isSupplier ? 'Paid Money' : 'Received Money');
      }
    }

    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-4 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handleBack}><ChevronLeft size={24} /></button>
            <h1 className="text-lg font-bold">{title}</h1>
          </div>
          {editingTransaction && (
            <button 
              disabled={isSubmitting}
              onClick={handleDeleteTransaction} 
              className="p-2 text-red-600 bg-red-50 rounded-full active:bg-red-100"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
            </button>
          )}
        </header>
        <div className="p-6 flex-1">
          <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Amount</label>
          <input type="number" value={transAmount} onChange={e => setTransAmount(e.target.value)} placeholder="0.00" className={`w-full text-4xl font-bold mb-8 outline-none ${transType === 'CREDIT' ? 'text-red-600' : 'text-green-600'}`} autoFocus />
          
          <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Date</label>
          <input type="date" value={transDate} onChange={e => setTransDate(e.target.value)} className="w-full border-b mb-8 py-2 font-semibold outline-none focus:border-blue-500" />

          <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Notes</label>
          <textarea value={transDesc} onChange={e => setTransDesc(e.target.value)} placeholder="Enter details..." className="w-full bg-gray-50 border rounded-xl p-4 h-32 outline-none" />
        </div>
        <div className="p-6 pb-10">
          <button 
            disabled={isSubmitting}
            onClick={handleSaveTransaction} 
            className={`w-full py-4 rounded-xl text-white font-bold shadow-lg flex items-center justify-center gap-2 ${transType === 'CREDIT' ? 'bg-red-700' : 'bg-green-700'} disabled:opacity-50`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingTransaction ? 'Update Entry' : 'Save To Ledger')}
          </button>
        </div>
      </div>
    );
  }

  // VIEW: CASH_BOOK
  if (currentView === 'CASH_BOOK') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
        <header className="bg-white px-4 py-4 shadow-sm sticky top-0"><h1 className="text-xl font-bold">Cash Book</h1></header>
        <div className="p-4 flex flex-col gap-4">
          <div className="bg-slate-800 text-white rounded-2xl p-6 shadow-lg">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Total Cash In Hand</p>
            <h2 className="text-3xl font-bold">Rs. {cashSummary.balance.toLocaleString()}</h2>
          </div>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {cashTransactions.map(t => (
              <div key={t.id} className="p-4 border-b flex justify-between items-center active:bg-gray-50">
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.type === 'IN' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{t.type === 'IN' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}</div>
                  <div><p className="text-sm font-bold">{t.description}</p><p className="text-[10px] text-gray-400">{new Date(t.date).toLocaleDateString()}</p></div>
                </div>
                <p className={`font-bold ${t.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'IN' ? '+' : '-'} {t.amount.toLocaleString()}</p>
              </div>
            ))}
            {cashTransactions.length === 0 && <div className="p-10 text-center text-gray-400">No cash entries yet</div>}
          </div>
        </div>
        {isCashFormOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-3xl p-6 animate-in slide-in-from-bottom-20">
              <div className="flex gap-2 mb-6">
                <button onClick={() => setCashType('IN')} className={`flex-1 py-3 rounded-xl border-2 font-bold ${cashType === 'IN' ? 'border-green-600 text-green-700' : 'border-transparent bg-gray-50'}`}>CASH IN</button>
                <button onClick={() => setCashType('OUT')} className={`flex-1 py-3 rounded-xl border-2 font-bold ${cashType === 'OUT' ? 'border-red-600 text-red-700' : 'border-transparent bg-gray-50'}`}>CASH OUT</button>
              </div>
              <input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="0.00" className="w-full text-2xl font-bold mb-4 py-2 border-b-2 outline-none" autoFocus />
              <input value={cashDesc} onChange={e => setCashDesc(e.target.value)} placeholder="Reason" className="w-full text-lg mb-8 py-2 border-b-2 outline-none" />
              <button onClick={async () => {
                const p = { id: generateUUID(), date: new Date().toISOString(), amount: parseFloat(cashAmount), type: cashType, description: cashDesc };
                await supabase.from('cash_transactions').insert([p]);
                setCashTransactions([p, ...cashTransactions]);
                setIsCashFormOpen(false); setCashAmount(''); setCashDesc('');
              }} className={`w-full py-4 rounded-xl text-white font-bold ${cashType === 'IN' ? 'bg-green-600' : 'bg-red-600'}`}>Save Entry</button>
              <button onClick={() => setIsCashFormOpen(false)} className="w-full text-gray-400 mt-4 font-bold">Cancel</button>
            </div>
          </div>
        )}
        <button onClick={() => setIsCashFormOpen(true)} className="fixed bottom-20 right-4 w-14 h-14 bg-slate-800 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"><Plus size={24} /></button>
        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme={appTheme} />
      </div>
    );
  }

  return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Navigating Ledger...</p></div>;
}