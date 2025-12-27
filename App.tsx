import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  BookText, Wallet, Receipt, UserCircle, Store, Phone, Pencil, Palette, 
  Check, Languages, ChevronRight, LogOut, ChevronLeft, Share2, Calendar, 
  ChevronDown, Filter, Download, Trash2, Calculator, FilePlus, Loader2, 
  Camera, Eye, Target, MoreVertical, RefreshCw, ArrowDown, ArrowUp, 
  Search, Plus, FileText, Users, Truck, Building, PlayCircle, CalendarClock,
  ArrowRight, Database, AlertCircle, History, TrendingUp, TrendingDown, Settings, ShieldAlert, X
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
  if (!dateString) return new Date();
  
  // Clean date string: extract only the date part YYYY-MM-DD
  const match = dateString.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1]);
    const m = parseInt(match[2]);
    const d = parseInt(match[3]);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  
  // Try parsing directly for other formats (like mock data '6th Dec 2025')
  const parsed = new Date(dateString);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
  }
  
  // If parsing fails, use a safe default instead of Invalid Date
  return new Date(1970, 0, 1);
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
  const [activeTab, setActiveTab] = useState<ContactType>('VENDOR');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const contactsRef = useRef(contacts);
  
  const [shopName, setShopName] = useState('Smart Time');
  const [searchQuery, setSearchQuery] = useState('');

  // Form States
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [targetAmount, setTargetAmount] = useState('30000');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transType, setTransType] = useState<TransactionType>('CREDIT');
  const [transAmount, setTransAmount] = useState('');
  const [transDate, setTransDate] = useState(new Date().toISOString().slice(0, 10));
  const [transDesc, setTransDesc] = useState('');

  // Report States
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportRange, setReportRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10)
  });
  const [reportTarget, setReportTarget] = useState<'CATEGORY' | 'CONTACT'>('CATEGORY');

  const dateInputRef = useRef<HTMLInputElement>(null);
  const theme = THEMES['blue'];

  // -----------------------------------------------------------------
  // DERIVED STATE: STATS & BALANCES
  // -----------------------------------------------------------------
  const contactStats = useMemo(() => {
    const stats: Record<string, { totalCredit: number; totalPayment: number; balance: number }> = {};
    contacts.forEach(c => stats[c.id] = { totalCredit: 0, totalPayment: 0, balance: 0 });
    
    transactions.forEach(t => {
      if (!stats[t.contactId]) return;
      if (t.type === 'CREDIT') stats[t.contactId].totalCredit += t.amount;
      else stats[t.contactId].totalPayment += t.amount;
    });

    contacts.forEach(c => {
      const s = stats[c.id];
      if (c.type === 'RENT') {
        s.balance = s.totalPayment - s.totalCredit; // Savings = Deposits - Withdrawals
      } else {
        s.balance = s.totalCredit - s.totalPayment; // Debt = Items/Credit - Payments
      }
    });
    return stats;
  }, [contacts, transactions]);

  const cycleSavingsMap = useMemo(() => {
    const savings: Record<string, number> = {};
    const cycleStart = getRentCycleStart();
    
    contacts.filter(c => c.type === 'RENT').forEach(c => {
      savings[c.id] = transactions
        .filter(t => t.contactId === c.id && normalizeToLocalMidnight(t.date) >= cycleStart)
        .reduce((sum, t) => sum + (t.type === 'PAYMENT' ? t.amount : -t.amount), 0);
    });
    return savings;
  }, [contacts, transactions]);

  const activeTotals = useMemo(() => {
    const currentContacts = contacts.filter(c => c.type === activeTab);
    let totalPayments = 0;
    let netBalance = 0;

    if (activeTab === 'RENT') {
      let totalTarget = 0;
      let totalSavedInCycle = 0;
      currentContacts.forEach(c => {
        totalPayments += contactStats[c.id]?.balance || 0;
        totalSavedInCycle += cycleSavingsMap[c.id] || 0;
        totalTarget += c.targetAmount || 30000;
      });
      netBalance = Math.max(0, totalTarget - totalSavedInCycle);
    } else {
      currentContacts.forEach(c => {
        const bal = contactStats[c.id]?.balance || 0;
        if (bal > 0) netBalance += bal;
        totalPayments += contactStats[c.id]?.totalPayment || 0;
      });
    }
    return { totalPayments, netBalance };
  }, [contacts, activeTab, contactStats, cycleSavingsMap]);

  // Derived totals for the reporting modal summary
  const reportTotals = useMemo(() => {
    const start = normalizeToLocalMidnight(reportRange.start);
    const end = normalizeToLocalMidnight(reportRange.end);
    end.setHours(23, 59, 59, 999);
    
    let filteredTransactions = [];
    if (reportTarget === 'CATEGORY') {
      const categoryContacts = contacts.filter(c => c.type === activeTab || (activeTab === 'VENDOR' && c.type as any === 'SUPPLIER')).map(c => c.id);
      filteredTransactions = transactions.filter(t => categoryContacts.includes(t.contactId));
    } else if (selectedContact) {
      filteredTransactions = transactions.filter(t => t.contactId === selectedContact.id);
    }

    const rangeTransactions = filteredTransactions.filter(t => {
      const d = normalizeToLocalMidnight(t.date);
      return d >= start && d <= end;
    });

    const totalPaid = rangeTransactions.filter(t => t.type === 'PAYMENT').reduce((sum, t) => sum + t.amount, 0);
    const totalCredit = rangeTransactions.filter(t => t.type === 'CREDIT').reduce((sum, t) => sum + t.amount, 0);

    return { totalPaid, totalCredit };
  }, [transactions, contacts, activeTab, selectedContact, reportRange, reportTarget]);

  // -----------------------------------------------------------------
  // REPORT GENERATION (PDF)
  // -----------------------------------------------------------------
  const downloadCategoryReport = () => {
    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString();
      const currentContacts = contacts.filter(c => c.type === activeTab || (activeTab === 'VENDOR' && c.type as any === 'SUPPLIER'));
      
      const start = normalizeToLocalMidnight(reportRange.start);
      const end = normalizeToLocalMidnight(reportRange.end);
      end.setHours(23, 59, 59, 999);

      const rangeTransactions = transactions.filter(t => {
        const d = normalizeToLocalMidnight(t.date);
        return d >= start && d <= end;
      });

      const contactReportData = currentContacts.map(c => {
        const cTrans = rangeTransactions.filter(t => t.contactId === c.id);
        const paid = cTrans.filter(t => t.type === 'PAYMENT').reduce((s, t) => s + t.amount, 0);
        const credit = cTrans.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
        const bal = credit - paid; 
        
        return {
          name: c.name,
          phone: c.phone || '-',
          paid,
          credit,
          bal
        };
      });

      doc.setFontSize(20);
      doc.text(`${shopName} - ${activeTab} Summary`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${timestamp}`, 14, 28);
      doc.text(`Period: ${reportRange.start} to ${reportRange.end}`, 14, 33);
      
      const tableData = contactReportData.map(d => [
        d.name,
        d.phone,
        `LKR ${d.credit.toLocaleString()}`,
        `LKR ${d.paid.toLocaleString()}`,
        `LKR ${Math.abs(d.bal).toLocaleString()}`
      ]);

      const totalCredit = contactReportData.reduce((s, d) => s + d.credit, 0);
      const totalPaid = contactReportData.reduce((s, d) => s + d.paid, 0);
      const netBalance = totalCredit - totalPaid;

      autoTable(doc, {
        startY: 40,
        head: [['Name', 'Phone', 'Range Credit', 'Range Paid', 'Range Balance']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85] },
        foot: [['Total', '', `LKR ${totalCredit.toLocaleString()}`, `LKR ${totalPaid.toLocaleString()}`, `LKR ${Math.abs(netBalance).toLocaleString()}`]],
        footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
      
      const safeFileName = `${activeTab.toLowerCase()}_report_${Date.now()}.pdf`.replace(/[^a-z0-9._-]/gi, '_');
      doc.save(safeFileName);
      setIsReportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF report. Please try again.");
    }
  };

  const downloadContactStatement = (contact: Contact) => {
    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString();
      const isRent = contact.type === 'RENT';
      
      doc.setFontSize(18);
      doc.text(shopName, 14, 20);
      doc.setFontSize(12);
      doc.text(`Statement for: ${contact.name}`, 14, 30);
      doc.setFontSize(10);
      doc.text(`Period: ${reportRange.start} to ${reportRange.end} | Generated: ${timestamp}`, 14, 38);
      
      const start = normalizeToLocalMidnight(reportRange.start);
      const end = normalizeToLocalMidnight(reportRange.end);
      end.setHours(23, 59, 59, 999);

      // Calculate Opening Balance (sum of transactions before start date)
      const transactionsBefore = transactions
        .filter(t => t.contactId === contact.id && normalizeToLocalMidnight(t.date) < start);
      
      let openingBalance = 0;
      transactionsBefore.forEach(t => {
        if (isRent) { openingBalance += (t.type === 'PAYMENT' ? t.amount : -t.amount); }
        else { openingBalance += (t.type === 'CREDIT' ? t.amount : -t.amount); }
      });

      const contactTransactions = transactions
        .filter(t => t.contactId === contact.id)
        .filter(t => {
          const d = normalizeToLocalMidnight(t.date);
          return d >= start && d <= end;
        })
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      let runningBal = openingBalance;
      const tableRows = contactTransactions.map(t => {
        if (isRent) { runningBal += (t.type === 'PAYMENT' ? t.amount : -t.amount); }
        else { runningBal += (t.type === 'CREDIT' ? t.amount : -t.amount); }
        
        const typeLabel = t.type === 'PAYMENT' ? (isRent ? 'Deposit' : 'Paid') : (isRent ? 'Withdraw' : 'Credit');

        return [
          t.date,
          t.description || '-',
          typeLabel,
          `LKR ${t.amount.toLocaleString()}`,
          `LKR ${runningBal.toLocaleString()}`
        ];
      });

      // Insert Opening Balance row at the beginning
      tableRows.unshift([
        reportRange.start,
        'Opening Balance',
        '-',
        '-',
        `LKR ${openingBalance.toLocaleString()}`
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['Date', 'Description', 'Type', 'Amount', 'Balance']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        foot: [['', '', 'CLOSING BALANCE', '', `LKR ${runningBal.toLocaleString()}`]],
        footStyles: { fontStyle: 'bold', fillColor: [248, 250, 252] }
      });
      
      const safeName = contact.name.replace(/[^a-z0-9]/gi, '_');
      doc.save(`${safeName}_statement.pdf`);
      setIsReportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to generate statement. Please try again.");
    }
  };

  // -----------------------------------------------------------------
  // EFFECTS & DATA FETCHING
  // -----------------------------------------------------------------
  useEffect(() => { contactsRef.current = contacts; }, [contacts]);

  useEffect(() => {
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
      const [contactsRes, transRes] = await Promise.all([
        supabase.from('contacts').select('*'),
        supabase.from('transactions').select('*').order('date', { ascending: false })
      ]);
      if (contactsRes.data) {
        setContacts(contactsRes.data.map((c: any) => ({
          id: c.id, 
          name: c.name, 
          phone: c.phone || '', 
          // MAPPING LEGACY SUPPLIER TYPE TO VENDOR
          type: c.type === 'SUPPLIER' ? 'VENDOR' : c.type,
          balance: c.balance || 0, 
          targetAmount: c.target_amount,
          lastUpdated: c.last_updated
        })));
      }
      if (transRes.data) {
        setTransactions(transRes.data.map((t: any) => ({
          id: t.id, contactId: t.contact_id, date: t.date, description: t.description,
          amount: t.amount, type: t.type, balanceAfter: t.balance_after
        })));
      }
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // -----------------------------------------------------------------
  // HANDLERS
  // -----------------------------------------------------------------
  const handleBack = () => { window.history.back(); };

  const handleSaveContact = async () => {
    if (!addName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = { 
        name: addName, 
        phone: addPhone,
        type: activeTab, 
        target_amount: activeTab === 'RENT' ? (parseFloat(targetAmount) || 30000) : null, 
        last_updated: new Date().toISOString() 
      };
      
      let res;
      if (editingContact) {
        res = await supabase.from('contacts').update(payload).eq('id', editingContact.id).select();
      } else {
        const newId = generateUUID();
        res = await supabase.from('contacts').insert([{ ...payload, id: newId, balance: 0 }]).select();
      }

      if (res.error) throw res.error;
      
      if (res.data) {
        const updatedContact = {
          id: res.data[0].id,
          name: res.data[0].name,
          phone: res.data[0].phone || '',
          type: res.data[0].type === 'SUPPLIER' ? 'VENDOR' : res.data[0].type,
          balance: res.data[0].balance || 0,
          targetAmount: res.data[0].target_amount,
          lastUpdated: res.data[0].last_updated
        };
        
        if (editingContact) {
          setContacts(contacts.map(c => c.id === editingContact.id ? updatedContact : c));
          if (selectedContact?.id === editingContact.id) setSelectedContact(updatedContact);
        } else {
          setContacts([...contacts, updatedContact]);
        }
      }
      
      setAddName(''); setAddPhone(''); setTargetAmount('30000'); setEditingContact(null);
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteContact = async (id: string) => {
    if (!window.confirm("Delete this check entirely? All transactions will be lost.")) return;
    setIsSubmitting(true);
    try {
      await supabase.from('transactions').delete().eq('contact_id', id);
      await supabase.from('contacts').delete().eq('id', id);
      setContacts(contacts.filter(c => c.id !== id));
      setTransactions(transactions.filter(t => t.contactId !== id));
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteTransaction = async () => {
    if (!editingTransaction || isSubmitting) return;
    if (!window.confirm("Delete this record?")) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', editingTransaction.id);
      if (error) throw error;
      const newTransactions = transactions.filter(t => t.id !== editingTransaction.id);
      setTransactions(newTransactions);
      setEditingTransaction(null);
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleSaveTransaction = async () => {
    if (!selectedContact || isSubmitting) return;
    const amountVal = parseFloat(transAmount) || 0;
    setIsSubmitting(true);
    try {
      const txPayload = { 
        contact_id: selectedContact.id, date: transDate, amount: amountVal, 
        type: transType, description: transDesc, balance_after: 0 
      };
      let res;
      if (editingTransaction) { 
        res = await supabase.from('transactions').update(txPayload).eq('id', editingTransaction.id).select(); 
      } else { 
        res = await supabase.from('transactions').insert([txPayload]).select(); 
      }
      if (res.error) throw res.error;
      if (res.data) {
        const saved = { 
          id: res.data[0].id, contactId: res.data[0].contact_id, date: res.data[0].date, 
          description: res.data[0].description, amount: res.data[0].amount, 
          type: res.data[0].type, balanceAfter: 0 
        };
        if (editingTransaction) { 
          setTransactions(transactions.map(t => t.id === editingTransaction.id ? saved : t)); 
        } else { 
          setTransactions([saved, ...transactions]); 
        }
      }
      setEditingTransaction(null);
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  // -----------------------------------------------------------------
  // VIEWS
  // -----------------------------------------------------------------
  if (isLoading) return <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /><p className="text-gray-400 font-medium">Updating Ledger...</p></div>;
  
  if (currentView === 'DASHBOARD') {
    const filtered = contacts.filter(c => {
      // BACKWARD COMPATIBLE FILTER: VENDOR TAB MATCHES VENDOR OR SUPPLIER TYPE
      const matchesTab = c.type === activeTab || (activeTab === 'VENDOR' && c.type as any === 'SUPPLIER');
      const q = searchQuery.toLowerCase();
      return matchesTab && (c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
    });

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-20 no-scrollbar">
        <header className="bg-white px-4 py-3 pb-0 shadow-sm z-20 sticky top-0">
          <div className="flex justify-between items-center mb-2">
            <div><h1 className="text-xl font-bold text-slate-800">Ledger Book</h1><p className="text-xs font-semibold text-slate-500">{shopName}</p></div>
            <div className="flex items-center gap-3">
               <button 
                 onClick={() => navigateTo('CONTACT_FORM')}
                 className="bg-blue-600 text-white p-2 rounded-full shadow-sm active:scale-90 transition-transform flex items-center justify-center"
                 title="Add New"
               >
                 <Plus size={22} />
               </button>
               <PlayCircle size={24} className="text-blue-600" />
            </div>
          </div>
          <div className="flex gap-6 mt-4">
            <button onClick={() => setActiveTab('CUSTOMER')} className={`flex items-center gap-2 pb-3 border-b-2 font-medium transition-colors ${activeTab === 'CUSTOMER' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500'}`}><Users size={18} />Customers</button>
            <button onClick={() => setActiveTab('VENDOR')} className={`flex items-center gap-2 pb-3 border-b-2 font-medium transition-colors ${activeTab === 'VENDOR' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500'}`}><Truck size={18} />Vendors</button>
            <button onClick={() => setActiveTab('RENT')} className={`flex items-center gap-2 pb-3 border-b-2 font-medium transition-colors ${activeTab === 'RENT' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500'}`}><Building size={18} />Rent</button>
          </div>
        </header>

        <div className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-3 shadow-sm flex flex-col justify-center min-h-[70px]">
              <p className="text-[10px] text-slate-600 font-bold mb-1 uppercase tracking-tighter">
                {activeTab === 'RENT' ? 'Total Saved' : (activeTab === 'VENDOR' ? 'Total Paid' : 'Total Received')}
              </p>
              <p className="text-xl font-bold text-[#15803d]">LKR {activeTotals.totalPayments.toLocaleString()}</p>
            </div>
            <div className="bg-[#fef2f2] border border-[#fee2e2] rounded-xl p-3 shadow-sm flex flex-col justify-center min-h-[70px]">
              <p className="text-[10px] text-slate-600 font-bold mb-1 uppercase tracking-tighter">
                {activeTab === 'RENT' ? 'Monthly Debt' : (activeTab === 'VENDOR' ? 'To pay' : 'To collect')}
              </p>
              <p className="text-xl font-bold text-[#b91c1c]">LKR {activeTotals.netBalance.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="bg-[#f1f5f9] rounded-xl px-4 py-3 flex items-center flex-1 border border-transparent focus-within:border-blue-200 transition-all shadow-sm">
              <Search size={18} className="text-slate-400 mr-3" />
              <input type="text" placeholder="Search name or number here" className="bg-transparent outline-none text-[13px] w-full placeholder:text-slate-400 font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <button 
              onClick={() => { setReportTarget('CATEGORY'); setIsReportModalOpen(true); }}
              className="bg-[#eff6ff] text-[#2563eb] p-3 rounded-xl border border-[#dbeafe] active:scale-95 transition-transform flex items-center justify-center shadow-sm"
              title="Download Report"
            >
              <Download size={18} />
            </button>
            <button className="bg-[#eff6ff] text-[#2563eb] p-3 rounded-xl border border-[#dbeafe] active:scale-95 transition-transform flex items-center justify-center shadow-sm"><Filter size={18} /></button>
          </div>

          <div className="flex flex-col gap-2">
            {filtered.map(c => {
              const stats = contactStats[c.id];
              const displayBal = stats?.balance || 0;
              
              const leftLabel = c.type === 'VENDOR' ? 'Got' : (c.type === 'CUSTOMER' ? 'Gave' : 'Out');
              const rightLabel = c.type === 'VENDOR' ? 'Paid' : (c.type === 'CUSTOMER' ? 'Got' : 'In');
              
              return (
                <div key={c.id} onClick={() => { setSelectedContact(c); navigateTo('DETAIL', c.id); }} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between active:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-white shadow-inner ${c.type === 'RENT' ? 'bg-[#3b82f6]' : 'bg-slate-400'}`}>
                      {c.name[0]}
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-slate-800 text-base truncate leading-tight">{c.name}</h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">{leftLabel}:</span>
                          <span className="text-xs font-bold text-red-600">LKR {stats.totalCredit.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">{rightLabel}:</span>
                          <span className="text-xs font-bold text-green-600">LKR {stats.totalPayment.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Balance</p>
                    <p className={`font-bold text-[17px] ${c.type === 'RENT' ? 'text-[#2563eb]' : (displayBal > 0 ? 'text-red-600' : 'text-green-600')}`}>
                      LKR {Math.abs(displayBal).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reporting Modal */}
        {isReportModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
            <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-bold text-lg">Generate Report</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{reportTarget === 'CATEGORY' ? activeTab : selectedContact?.name}</p>
                </div>
                <button onClick={() => setIsReportModalOpen(false)} className="p-2 bg-white rounded-full shadow-sm"><X size={18} /></button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start Date</label>
                    <input type="date" value={reportRange.start} onChange={e => setReportRange({ ...reportRange, start: e.target.value })} className="w-full border rounded-xl p-3 font-semibold text-sm outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End Date</label>
                    <input type="date" value={reportRange.end} onChange={e => setReportRange({ ...reportRange, end: e.target.value })} className="w-full border rounded-xl p-3 font-semibold text-sm outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 mt-2 shadow-inner">
                   <div className="flex justify-between items-center">
                     <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                       {reportTarget === 'CONTACT' ? 
                         (selectedContact?.type === 'RENT' ? 'Total Withdrawals' : (selectedContact?.type === 'CUSTOMER' ? 'Total Credit' : 'Total Items')) :
                         (activeTab === 'RENT' ? 'Total Withdrawals' : (activeTab === 'CUSTOMER' ? 'Total Credit' : 'Total Items'))
                       }
                     </span>
                     <span className="font-bold text-red-600 text-sm">LKR {reportTotals.totalCredit.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                       {reportTarget === 'CONTACT' ? 
                         (selectedContact?.type === 'RENT' ? 'Total Deposits' : (selectedContact?.type === 'CUSTOMER' ? 'Total Received' : 'Total Paid')) :
                         (activeTab === 'RENT' ? 'Total Deposits' : (activeTab === 'CUSTOMER' ? 'Total Received' : 'Total Paid'))
                       }
                     </span>
                     <span className="font-bold text-green-600 text-sm">LKR {reportTotals.totalPaid.toLocaleString()}</span>
                   </div>
                </div>

                <button 
                  onClick={() => reportTarget === 'CATEGORY' ? downloadCategoryReport() : (selectedContact && downloadContactStatement(selectedContact))}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-2 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Download size={18} /> Download PDF Report
                </button>
              </div>
            </div>
          </div>
        )}

        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme="blue" />
      </div>
    );
  }

  if (currentView === 'DETAIL' && selectedContact) {
    const isRent = selectedContact.type === 'RENT';
    const labelLeft = isRent ? "WITHDRAW" : (selectedContact.type === 'VENDOR' ? "GOT ITEMS" : "GAVE ITEMS");
    const labelRight = isRent ? "DEPOSIT" : (selectedContact.type === 'VENDOR' ? "PAID MONEY" : "GOT MONEY");
    
    const contactTransactions = transactions.filter(t => t.contactId === selectedContact.id).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let currentSum = 0;
    const computedWithBalance = contactTransactions.map(t => {
      if (isRent) { currentSum += (t.type === 'PAYMENT' ? t.amount : -t.amount); }
      else { currentSum += (t.type === 'CREDIT' ? t.amount : -t.amount); }
      return { ...t, balanceAfter: currentSum };
    }).reverse();

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-28 no-scrollbar">
        <header className="bg-white sticky top-0 z-30 shadow-sm px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button>
          <div className="flex-1 overflow-hidden">
            <h1 className="font-bold text-lg truncate">{selectedContact.name}</h1>
            <p className="text-[11px] text-slate-400 font-medium">{selectedContact.phone || 'No phone'}</p>
          </div>
          <button 
            onClick={() => { setReportTarget('CONTACT'); setIsReportModalOpen(true); }}
            className="p-2 text-blue-600 bg-blue-50 rounded-full active:scale-90 shadow-sm"
            title="Download Statement"
          >
            <Download size={18} />
          </button>
          <button 
            onClick={() => { setEditingContact(selectedContact); setAddName(selectedContact.name); setAddPhone(selectedContact.phone); setTargetAmount(selectedContact.targetAmount?.toString() || '30000'); navigateTo('CONTACT_FORM'); }}
            className="p-2 text-slate-600 bg-slate-100 rounded-full active:scale-90 shadow-sm"
            title="Edit Contact"
          >
            <Pencil size={18} />
          </button>
          <button onClick={() => handleDeleteContact(selectedContact.id)} className="p-2 text-red-500 bg-red-50 rounded-full active:scale-90 shadow-sm"><Trash2 size={18} /></button>
        </header>
        <div className="p-4 bg-white mb-2 shadow-sm text-center">
          <div className="bg-[#f8fafc] rounded-2xl p-6 border border-slate-100 shadow-inner">
            <h2 className={`text-4xl font-bold ${contactStats[selectedContact.id]?.balance > 0 ? (isRent ? 'text-blue-600' : 'text-red-600') : 'text-green-600'}`}>
              LKR {Math.abs(contactStats[selectedContact.id]?.balance || 0).toLocaleString()}
            </h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">{isRent ? 'Total Savings' : 'Total Balance'}</p>
          </div>
        </div>
        <div className="flex-1 bg-white">
          {computedWithBalance.map(t => (
            <TransactionRow key={t.id} transaction={t} onClick={(tx) => { setEditingTransaction(tx); setTransType(tx.type); setTransAmount(tx.amount.toString()); setTransDate(tx.date); setTransDesc(tx.description || ''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} />
          ))}
          {computedWithBalance.length === 0 && <div className="p-16 text-center text-slate-400">No transactions recorded yet</div>}
        </div>
        <div className="fixed bottom-0 left-0 right-0 bg-white px-4 pt-4 pb-10 flex gap-4 border-t border-slate-100 z-40 shadow-lg">
          <button onClick={() => { setEditingTransaction(null); setTransType('CREDIT'); setTransAmount(''); setTransDesc(''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} className="flex-1 bg-red-700 text-white font-bold py-4 rounded-xl flex flex-col items-center justify-center active:scale-95 shadow-md">
             <span className="text-[10px] opacity-90 uppercase font-black">{labelLeft}</span>
             <span className="flex items-center gap-1 font-bold text-lg">LKR <ArrowDown size={14} /></span>
          </button>
          <button onClick={() => { setEditingTransaction(null); setTransType('PAYMENT'); setTransAmount(''); setTransDesc(''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} className="flex-1 bg-green-700 text-white font-bold py-4 rounded-xl flex flex-col items-center justify-center active:scale-95 shadow-md">
             <span className="text-[10px] opacity-90 uppercase font-black">{labelRight}</span>
             <span className="flex items-center gap-1 font-bold text-lg">LKR <ArrowUp size={14} /></span>
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
            <button onClick={handleDeleteTransaction} className="p-2 text-red-600 bg-red-50 rounded-full active:scale-90 transition-all"><Trash2 size={20} /></button>
          )}
        </header>
        <div className="p-6 flex-1 overflow-y-auto">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
          <input type="number" value={transAmount} onChange={e => setTransAmount(e.target.value)} placeholder="0.00" className={`w-full text-5xl font-bold mb-8 outline-none border-none ${transType === 'CREDIT' ? 'text-red-600' : 'text-green-600'}`} autoFocus />
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Transaction Date</label>
          <div className="flex flex-col gap-3 mb-8">
            <div className="flex gap-2">
              <button onClick={() => setTransDate(new Date().toISOString().slice(0, 10))} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border ${transDate === new Date().toISOString().slice(0, 10) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>TODAY</button>
              <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setTransDate(d.toISOString().slice(0, 10)); }} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border ${transDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>YESTERDAY</button>
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

  if (currentView === 'CONTACT_FORM') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-4 py-4 flex items-center gap-4 border-b"><button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button><h1 className="text-lg font-bold">{editingContact ? 'Edit' : 'New'} {activeTab}</h1></header>
        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
            <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Enter Name" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
            <input value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="Enter Phone" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" />
          </div>
          {activeTab === 'RENT' && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monthly Target (LKR)</label>
              <input value={targetAmount} onChange={e => setTargetAmount(e.target.value)} type="number" placeholder="30000" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" />
            </div>
          )}
          <button disabled={isSubmitting} onClick={handleSaveContact} className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg mt-8 flex items-center justify-center gap-2 active:scale-95 transition-all">
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingContact ? 'Update Contact' : 'Save Contact')}
          </button>
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
           <button onClick={async () => { if(!window.confirm("RESET APP? All data will be deleted.")) return; await Promise.all([supabase.from('transactions').delete().neq('id', '0'), supabase.from('contacts').delete().neq('id', '0')]); window.location.reload(); }} className="w-full flex items-center gap-4 p-4 rounded-xl bg-red-50 text-red-700 active:bg-red-100 transition-colors border border-red-100 shadow-sm"><ShieldAlert size={20} /><div className="text-left font-bold">Wipe Ledger Data</div></button>
        </div>
        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme="blue" />
      </div>
    );
  }

  return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-slate-200" size={40} /></div>;
}