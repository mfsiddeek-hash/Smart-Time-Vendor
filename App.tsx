import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, 
  Truck, 
  Search, 
  BarChart3, 
  ChevronLeft, 
  MoreVertical, 
  Pencil, 
  CalendarClock,
  ArrowDown,
  ArrowUp,
  X,
  Calculator,
  ChevronDown,
  ChevronRight,
  Camera,
  FilePlus,
  Trash2,
  FileText,
  Calendar,
  Share2,
  Download,
  Store,
  Phone,
  Palette,
  Languages,
  LogOut,
  Check,
  MessageCircle,
  Clock,
  Loader2,
  Eye,
  ImageIcon,
  Target,
  PiggyBank,
  Building,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { TransactionRow } from './components/TransactionRow';
import { Contact, Transaction, ContactType, TransactionType } from './types';
import { supabase } from './supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ViewState = 'DASHBOARD' | 'DETAIL' | 'TRANSACTION_FORM' | 'EDIT_CONTACT' | 'REPORT' | 'PROFILE' | 'REMINDERS';
type ThemeColor = 'blue' | 'purple' | 'emerald' | 'orange' | 'dark';

// Theme Configuration
const THEMES: Record<ThemeColor, {
  name: string;
  primary: string;
  primaryHover: string;
  primaryActive: string;
  text: string;
  textDark: string;
  light: string;
  lightHover: string;
  border: string;
  bgIndicator: string;
}> = {
  blue: {
    name: 'Blue',
    primary: 'bg-blue-600',
    primaryHover: 'hover:bg-blue-700',
    primaryActive: 'active:bg-blue-700',
    text: 'text-blue-600',
    textDark: 'text-blue-700',
    light: 'bg-blue-50',
    lightHover: 'hover:bg-blue-100',
    border: 'border-blue-200',
    bgIndicator: 'bg-blue-600'
  },
  purple: {
    name: 'Purple',
    primary: 'bg-purple-600',
    primaryHover: 'hover:bg-purple-700',
    primaryActive: 'active:bg-purple-700',
    text: 'text-purple-600',
    textDark: 'text-purple-700',
    light: 'bg-purple-50',
    lightHover: 'hover:bg-purple-100',
    border: 'border-purple-200',
    bgIndicator: 'bg-purple-600'
  },
  emerald: {
    name: 'Emerald',
    primary: 'bg-emerald-600',
    primaryHover: 'hover:bg-emerald-700',
    primaryActive: 'active:bg-emerald-700',
    text: 'text-emerald-600',
    textDark: 'text-emerald-700',
    light: 'bg-emerald-50',
    lightHover: 'hover:bg-emerald-100',
    border: 'border-emerald-200',
    bgIndicator: 'bg-emerald-600'
  },
  orange: {
    name: 'Orange',
    primary: 'bg-orange-600',
    primaryHover: 'hover:bg-orange-700',
    primaryActive: 'active:bg-orange-700',
    text: 'text-orange-600',
    textDark: 'text-orange-700',
    light: 'bg-orange-50',
    lightHover: 'hover:bg-orange-100',
    border: 'border-orange-200',
    bgIndicator: 'bg-orange-600'
  },
  dark: {
    name: 'Dark',
    primary: 'bg-slate-800',
    primaryHover: 'hover:bg-slate-900',
    primaryActive: 'active:bg-slate-900',
    text: 'text-slate-800',
    textDark: 'text-slate-900',
    light: 'bg-slate-100',
    lightHover: 'hover:bg-slate-200',
    border: 'border-slate-300',
    bgIndicator: 'bg-slate-800'
  }
};

// --- CHART COMPONENT ---
const TrendChart = ({ transactions, type }: { transactions: Transaction[], type: ContactType }) => {
    // 1. Group by Date
    const groupedData = useMemo(() => {
        const groups: Record<string, { credit: number, payment: number, date: string }> = {};
        
        transactions.forEach(t => {
            const dateKey = t.date; // Assuming YYYY-MM-DD
            if (!groups[dateKey]) {
                groups[dateKey] = { credit: 0, payment: 0, date: dateKey };
            }
            if (t.type === 'CREDIT') groups[dateKey].credit += t.amount;
            else groups[dateKey].payment += t.amount;
        });

        // Convert to array and sort by date ascending
        const sorted = Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
        
        // Take last 7 entries to fit screen comfortably
        return sorted.slice(-7);
    }, [transactions]);

    if (groupedData.length === 0) return null;

    // Find max value for scaling
    const maxValue = Math.max(
        ...groupedData.map(d => Math.max(d.credit, d.payment)),
        1 // prevent division by zero
    );

    const isRent = type === 'RENT';

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-4">
             <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-gray-400" />
                <h3 className="text-sm font-bold text-slate-700">Activity Trend (Last 7 Days)</h3>
            </div>
            
            <div className="flex items-end justify-between h-40 gap-2 pt-2 pb-6 px-2 relative">
                {/* Grid Lines (Optional visual guide) */}
                <div className="absolute inset-0 border-b border-gray-100 pointer-events-none"></div>

                {groupedData.map((item, idx) => {
                    const creditHeight = (item.credit / maxValue) * 100;
                    const paymentHeight = (item.payment / maxValue) * 100;
                    // Format date: 2025-12-06 -> 06/12
                    const dateLabel = item.date.split('-').slice(1).reverse().join('/');

                    return (
                        <div key={idx} className="flex flex-col items-center justify-end h-full flex-1 gap-1">
                            <div className="flex items-end gap-1 w-full justify-center h-full relative group">
                                {/* Credit Bar */}
                                {item.credit > 0 && (
                                    <div 
                                        className={`w-3 rounded-t-sm ${isRent ? 'bg-orange-400' : 'bg-red-400'} transition-all hover:opacity-80`}
                                        style={{ height: `${Math.max(creditHeight, 5)}%` }}
                                        title={`${isRent ? 'Withdraw' : 'Credit'}: ${item.credit}`}
                                    ></div>
                                )}
                                {/* Payment Bar */}
                                {item.payment > 0 && (
                                    <div 
                                        className={`w-3 rounded-t-sm ${isRent ? 'bg-blue-400' : 'bg-green-400'} transition-all hover:opacity-80`}
                                        style={{ height: `${Math.max(paymentHeight, 5)}%` }}
                                        title={`${isRent ? 'Saved' : 'Paid'}: ${item.payment}`}
                                    ></div>
                                )}
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium absolute -bottom-0">{dateLabel}</span>
                        </div>
                    )
                })}
            </div>
             <div className="flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${isRent ? 'bg-orange-400' : 'bg-red-400'}`}></div>
                    <span className="text-xs text-gray-500">{isRent ? 'Withdraw' : 'Credit'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${isRent ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                    <span className="text-xs text-gray-500">{isRent ? 'Saved' : 'Paid'}</span>
                </div>
            </div>
        </div>
    );
}

function App() {
  // Core Data State
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // App Settings State
  const [shopName, setShopName] = useState('Smart Time');
  const [shopPhone, setShopPhone] = useState('0771234567');
  const [appTheme, setAppTheme] = useState<ThemeColor>('blue');

  // UI State
  const [activeTab, setActiveTab] = useState<ContactType>('SUPPLIER');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Navigation State
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  
  // Transaction Form State
  const [transType, setTransType] = useState<TransactionType>('CREDIT');
  const [transAmount, setTransAmount] = useState('');
  const [transDesc, setTransDesc] = useState('');
  const [transDate, setTransDate] = useState(new Date().toISOString().split('T')[0]);
  const [showMoreOptions, setShowMoreOptions] = useState(true);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK'>('CASH');
  
  // Attachment State
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Editing State
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  // Add/Edit Contact State
  const [showAddContactModal, setShowAddContactModal] = useState(false); 
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactTarget, setNewContactTarget] = useState('');
  const [newContactStartDate, setNewContactStartDate] = useState('');
  const [newContactEndDate, setNewContactEndDate] = useState('');

  // Helpers
  const theme = THEMES[appTheme];

  // --- SUPABASE DATA FETCHING ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*');
      
      if (contactsError) throw contactsError;

      // Map snake_case DB to camelCase Types
      const mappedContacts: Contact[] = (contactsData || []).map(c => ({
        id: String(c.id),
        name: c.name,
        phone: c.phone,
        type: c.type as ContactType,
        balance: c.balance,
        targetAmount: c.target_amount || 0,
        startDate: c.start_date,
        endDate: c.end_date,
        lastUpdated: c.last_updated
      }));
      
      setContacts(mappedContacts);

      // Fetch Transactions
      const { data: transData, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });
        
      if (transError) throw transError;

      const mappedTransactions: Transaction[] = (transData || []).map(t => ({
        id: String(t.id),
        contactId: String(t.contact_id), 
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type as TransactionType,
        balanceAfter: t.balance_after,
        hasAttachment: t.has_attachment,
        attachmentUrl: t.attachment_url
      }));

      setTransactions(mappedTransactions);

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load data from database.');
    } finally {
      setIsLoading(false);
    }
  };

  // Derived Data
  const selectedContact = useMemo(() => 
    contacts.find(c => c.id === selectedContactId) || null
  , [contacts, selectedContactId]);

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => 
      c.type === activeTab && 
      (c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
       c.phone.includes(searchQuery))
    );
  }, [activeTab, searchQuery, contacts]);

  const totalToPay = useMemo(() => {
    return contacts
      .filter(c => c.type === 'SUPPLIER')
      .reduce((sum, c) => sum + c.balance, 0);
  }, [contacts]);
  
  const totalToCollect = useMemo(() => {
    return contacts
      .filter(c => c.type === 'CUSTOMER')
      .reduce((sum, c) => sum + c.balance, 0);
  }, [contacts]);
  
  const totalRentSaved = useMemo(() => {
    return contacts
      .filter(c => c.type === 'RENT')
      .reduce((sum, c) => sum + c.balance, 0);
  }, [contacts]);

  const totalRentRemaining = useMemo(() => {
    return contacts
      .filter(c => c.type === 'RENT')
      .reduce((sum, c) => sum + Math.max(0, (c.targetAmount || 0) - c.balance), 0);
  }, [contacts]);

  const currentTransactions = useMemo(() => {
    if (!selectedContactId) return [];
    
    // For RENT type, filter transactions based on start/end dates
    const contact = contacts.find(c => c.id === selectedContactId);
    let relevantTransactions = transactions.filter(t => t.contactId === selectedContactId);

    if (contact?.type === 'RENT' && contact.startDate && contact.endDate) {
        const start = new Date(contact.startDate);
        const end = new Date(contact.endDate);
        relevantTransactions = relevantTransactions.filter(t => {
            const tDate = new Date(t.date); 
            return t.date >= contact.startDate! && t.date <= contact.endDate!;
        });
    }

    return relevantTransactions;
  }, [transactions, selectedContactId, contacts]);

  // Actions
  const handleContactClick = (id: string) => {
    setSelectedContactId(id);
    setCurrentView('DETAIL');
  };

  const handleNavigate = (view: ViewState) => {
    if (view === 'DASHBOARD') {
        setSelectedContactId(null);
    }
    setCurrentView(view);
  };

  const handleBack = () => {
    if (currentView === 'TRANSACTION_FORM' || currentView === 'REPORT' || currentView === 'EDIT_CONTACT') {
      setCurrentView('DETAIL');
      setEditingTransactionId(null);
    } else if (currentView === 'DETAIL') {
      setSelectedContactId(null);
      setCurrentView('DASHBOARD');
    } else if (currentView === 'PROFILE' || currentView === 'REMINDERS') {
      setCurrentView('DASHBOARD');
    }
  };

  const startTransaction = (type: TransactionType) => {
    setTransType(type);
    setTransAmount('');
    setTransDesc('');
    setTransDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('CASH');
    setAttachmentUrl(null);
    setEditingTransactionId(null);
    setShowMoreOptions(type === 'CREDIT');
    setCurrentView('TRANSACTION_FORM');
  };

  const openAddContact = () => {
    setNewContactName('');
    setNewContactPhone('');
    setNewContactTarget('');
    
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setNewContactStartDate(firstDay.toISOString().split('T')[0]);
    setNewContactEndDate(lastDay.toISOString().split('T')[0]);
    
    setShowAddContactModal(true);
  };

  const openEditContact = () => {
    if (!selectedContact) return;
    setNewContactName(selectedContact.name);
    setNewContactPhone(selectedContact.phone);
    setNewContactTarget(selectedContact.targetAmount?.toString() || '');
    setNewContactStartDate(selectedContact.startDate || '');
    setNewContactEndDate(selectedContact.endDate || '');
    setCurrentView('EDIT_CONTACT'); 
  };

  const handleSaveNewContact = async () => {
    if (!newContactName) return;
    
    try {
      const newContactId = Date.now().toString(); 
      const newContact: any = {
        id: newContactId,
        name: newContactName,
        phone: newContactPhone,
        type: activeTab,
        balance: 0,
        last_updated: new Date().toISOString().split('T')[0]
      };

      if (activeTab === 'RENT') {
          newContact.target_amount = parseFloat(newContactTarget) || 0;
          newContact.start_date = newContactStartDate || null;
          newContact.end_date = newContactEndDate || null;
      }

      const { error } = await supabase.from('contacts').insert([newContact]);
      if (error) throw error;

      const mappedNewContact: Contact = {
        id: newContactId,
        name: newContactName,
        phone: newContactPhone,
        type: activeTab,
        balance: 0,
        targetAmount: newContact.target_amount || 0,
        startDate: newContact.start_date,
        endDate: newContact.end_date,
        lastUpdated: newContact.last_updated
      };
      
      setContacts([...contacts, mappedNewContact]);
      setNewContactName('');
      setNewContactPhone('');
      setNewContactTarget('');
      setShowAddContactModal(false);
    } catch (error: any) {
      console.error('Error adding contact:', error);
      alert(`Failed to add contact: ${error.message || 'Unknown error. Check database columns.'}`);
    }
  };

  const handleUpdateContact = async () => {
    if (!selectedContact || !newContactName) return;

    try {
      const updates: any = { name: newContactName, phone: newContactPhone };
      if (selectedContact.type === 'RENT') {
          updates.target_amount = parseFloat(newContactTarget) || 0;
          updates.start_date = newContactStartDate || null;
          updates.end_date = newContactEndDate || null;
      }

      const { error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', selectedContact.id);

      if (error) throw error;

      setContacts(contacts.map(c => 
          c.id === selectedContact.id 
            ? { 
                ...c, 
                name: newContactName, 
                phone: newContactPhone, 
                targetAmount: updates.target_amount ?? c.targetAmount,
                startDate: updates.start_date ?? c.startDate,
                endDate: updates.end_date ?? c.endDate
              }
            : c
      ));

      setCurrentView('DETAIL'); 
    } catch (error) {
      console.error('Error updating contact:', error);
      alert('Failed to update contact');
    }
  };

  const handleStartNewMonth = async () => {
    if (!selectedContact || selectedContact.type !== 'RENT') return;
    
    if (!confirm(`Are you sure you want to finish the current target and start a new month? \n\nThis will reset the saved balance to 0 and advance the dates to next month.`)) {
        return;
    }

    try {
        let nextStart = new Date();
        let nextEnd = new Date();

        if (selectedContact.endDate) {
            const currentEnd = new Date(selectedContact.endDate);
            nextStart = new Date(currentEnd);
            nextStart.setDate(nextStart.getDate() + 1);
            nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);
        } else {
            const now = new Date();
            nextStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            nextEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        }

        const nextStartStr = nextStart.toISOString().split('T')[0];
        const nextEndStr = nextEnd.toISOString().split('T')[0];

        const updates = {
            balance: 0,
            start_date: nextStartStr,
            end_date: nextEndStr,
            last_updated: new Date().toISOString().split('T')[0]
        };

        const { error } = await supabase
            .from('contacts')
            .update(updates)
            .eq('id', selectedContact.id);

        if (error) throw error;

        setContacts(contacts.map(c => 
            c.id === selectedContact.id 
              ? { 
                  ...c, 
                  balance: 0, 
                  startDate: nextStartStr, 
                  endDate: nextEndStr, 
                  lastUpdated: updates.last_updated 
                }
              : c
        ));
        
    } catch (error) {
        console.error("Error starting new month", error);
        alert("Failed to start new month");
    }
  };

  const handleDeleteContact = async () => {
    if (!selectedContact) return;
    if (confirm('Are you sure you want to delete this contact and all their transactions?')) {
      try {
        await supabase.from('transactions').delete().eq('contact_id', selectedContact.id);
        const { error } = await supabase.from('contacts').delete().eq('id', selectedContact.id);
        if (error) throw error;

        setContacts(contacts.filter(c => c.id !== selectedContact.id));
        setTransactions(transactions.filter(t => t.contactId !== selectedContact.id));
        
        setSelectedContactId(null);
        setCurrentView('DASHBOARD');
      } catch (error) {
        console.error('Error deleting contact:', error);
        alert('Failed to delete contact');
      }
    }
  };

  // --- PDF GENERATION ---
  const handleDownloadReport = () => {
      if (!selectedContact) return;

      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text(shopName, 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      if (shopPhone) doc.text(`Phone: ${shopPhone}`, 14, 28);
      
      // Title
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("Statement of Account", 14, 40);
      
      // Contact Details
      doc.setFontSize(11);
      doc.text(`Account: ${selectedContact.name}`, 14, 48);
      if (selectedContact.phone) doc.text(`Mobile: ${selectedContact.phone}`, 14, 54);
      
      const now = new Date();
      doc.text(`Date Generated: ${now.toLocaleDateString()}`, 14, 60);

      // Summary
      let totalCredit = 0;
      let totalPayment = 0;
      
      currentTransactions.forEach(t => {
          if (t.type === 'CREDIT') totalCredit += t.amount;
          else totalPayment += t.amount;
      });

      const isRent = selectedContact.type === 'RENT';
      const labelCredit = isRent ? 'Total Withdrawal' : 'Total Credit';
      const labelPayment = isRent ? 'Total Savings' : 'Total Paid';
      const labelBalance = isRent ? 'Current Balance' : 'Net Balance';

      doc.setFillColor(245, 245, 245);
      doc.rect(14, 65, 180, 25, 'F');
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      
      doc.text(labelCredit, 20, 72);
      doc.text(labelPayment, 80, 72);
      doc.text(labelBalance, 140, 72);
      
      doc.setFontSize(12);
      doc.setTextColor(200, 0, 0); // Red
      doc.text(`Rs. ${totalCredit.toLocaleString()}`, 20, 80);
      
      doc.setTextColor(0, 150, 0); // Green
      doc.text(`Rs. ${totalPayment.toLocaleString()}`, 80, 80);
      
      doc.setTextColor(0, 0, 0);
      doc.text(`Rs. ${selectedContact.balance.toLocaleString()}`, 140, 80);

      // Table
      const tableColumn = ["Date", "Description", isRent ? "Withdraw" : "Credit", isRent ? "Deposit" : "Payment", "Balance"];
      const tableRows: any[] = [];

      // Sort by date old to new for the running balance in report usually, but app shows new to old.
      // Let's keep app order or reverse? Usually reports are Old -> New.
      // Let's stick to the current view order (New -> Old) for simplicity or reverse it.
      // Let's reverse to show chronological order
      const sortedTrans = [...currentTransactions].sort((a, b) => a.date.localeCompare(b.date));
      
      let runningBalance = 0; // This is tricky if we don't have starting balance.
      // For simplicity, we just list amounts.
      
      sortedTrans.forEach(t => {
          const credit = t.type === 'CREDIT' ? t.amount.toLocaleString() : "-";
          const payment = t.type === 'PAYMENT' ? t.amount.toLocaleString() : "-";
          
          const rowData = [
              t.date,
              t.description || "-",
              credit,
              payment,
              t.balanceAfter.toLocaleString()
          ];
          tableRows.push(rowData);
      });

      autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 95,
          theme: 'grid',
          styles: { fontSize: 9 },
          headStyles: { fillColor: [66, 66, 66] }
      });

      doc.save(`Statement_${selectedContact.name}_${now.toISOString().split('T')[0]}.pdf`);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id);
    setTransType(transaction.type);
    setTransAmount(transaction.amount.toString());
    
    let isoDate = new Date().toISOString().split('T')[0];
    const parsedDate = new Date(transaction.date);
    if (!isNaN(parsedDate.getTime())) {
         isoDate = parsedDate.toISOString().split('T')[0];
    }
    setTransDate(isoDate);

    let desc = transaction.description || '';
    if (transaction.type === 'PAYMENT' && desc.includes('(Bank)')) {
        setPaymentMode('BANK');
        desc = desc.replace(' (Bank)', '').replace('Bank Payment', '').trim();
    } else {
        setPaymentMode('CASH');
    }
    setTransDesc(desc);
    
    setAttachmentUrl(transaction.attachmentUrl || null);
    setShowMoreOptions(true);
    setCurrentView('TRANSACTION_FORM');
  };

  const handleDeleteTransaction = async () => {
    if (!editingTransactionId || !selectedContact) return;

    if (confirm('Delete this transaction?')) {
        try {
          const transToDelete = transactions.find(t => t.id === editingTransactionId);
          if (!transToDelete) return;

          let reversionAmount = 0;
          if (selectedContact.type === 'RENT') {
              reversionAmount = transToDelete.type === 'PAYMENT' ? -transToDelete.amount : transToDelete.amount;
          } else {
              reversionAmount = transToDelete.type === 'CREDIT' ? -transToDelete.amount : transToDelete.amount;
          }
          
          const newBalance = selectedContact.balance + reversionAmount;

          await supabase.from('transactions').delete().eq('id', editingTransactionId);
          await supabase.from('contacts').update({
             balance: newBalance,
             last_updated: new Date().toISOString().split('T')[0]
          }).eq('id', selectedContact.id);

          setTransactions(transactions.filter(t => t.id !== editingTransactionId));
          setContacts(contacts.map(c => 
              c.id === selectedContact.id 
                ? { ...c, balance: newBalance, lastUpdated: new Date().toISOString().split('T')[0] }
                : c
          ));

          handleBack();
        } catch (error) {
          console.error("Error deleting transaction", error);
          alert("Failed to delete transaction");
        }
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setIsUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      setAttachmentUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload image. Make sure the storage bucket "receipts" exists and is public.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveTransaction = async () => {
    if (!selectedContact || !transAmount) return;
    
    const amountVal = parseFloat(transAmount);
    if (isNaN(amountVal)) return;

    const getBalanceEffect = (type: TransactionType, amount: number, contactType: ContactType) => {
        if (contactType === 'RENT') {
            return type === 'PAYMENT' ? amount : -amount;
        } else {
            return type === 'CREDIT' ? amount : -amount;
        }
    };

    let newBalance = selectedContact.balance;
    const dateObj = new Date(transDate);
    const dateStr = dateObj.toISOString().split('T')[0];
    
    let finalDesc = transDesc;
    if (transType === 'PAYMENT' && paymentMode === 'BANK') {
       finalDesc = finalDesc ? `${finalDesc} (Bank)` : 'Bank Payment';
    }

    try {
      if (editingTransactionId) {
          const oldTransIndex = transactions.findIndex(t => t.id === editingTransactionId);
          if (oldTransIndex === -1) return;
          const oldTrans = transactions[oldTransIndex];

          const oldEffect = getBalanceEffect(oldTrans.type, oldTrans.amount, selectedContact.type);
          newBalance -= oldEffect;

          const newEffect = getBalanceEffect(transType, amountVal, selectedContact.type);
          newBalance += newEffect;

          const updatedTransDb = {
              date: dateStr,
              description: finalDesc,
              amount: amountVal,
              type: transType,
              balance_after: newBalance,
              has_attachment: !!attachmentUrl,
              attachment_url: attachmentUrl
          };

          await supabase.from('transactions').update(updatedTransDb).eq('id', editingTransactionId);
          await supabase.from('contacts').update({
             balance: newBalance,
             last_updated: new Date().toISOString().split('T')[0]
          }).eq('id', selectedContact.id);

          const updatedTrans: Transaction = {
              ...oldTrans,
              date: dateStr,
              description: finalDesc,
              amount: amountVal,
              type: transType,
              balanceAfter: newBalance,
              hasAttachment: !!attachmentUrl,
              attachmentUrl: attachmentUrl
          };

          const newTransactions = [...transactions];
          newTransactions[oldTransIndex] = updatedTrans;
          setTransactions(newTransactions);

      } else {
          const effect = getBalanceEffect(transType, amountVal, selectedContact.type);
          newBalance += effect;
          const newId = Date.now().toString();

          const newTransDb = {
              id: newId,
              contact_id: selectedContact.id,
              date: dateStr,
              description: finalDesc,
              amount: amountVal,
              type: transType,
              balance_after: newBalance,
              has_attachment: !!attachmentUrl,
              attachment_url: attachmentUrl
          };

          await supabase.from('transactions').insert([newTransDb]);
          await supabase.from('contacts').update({
             balance: newBalance,
             last_updated: new Date().toISOString().split('T')[0]
          }).eq('id', selectedContact.id);

          const newTrans: Transaction = {
              id: newId,
              contactId: selectedContact.id,
              date: dateStr,
              description: finalDesc,
              amount: amountVal,
              type: transType,
              balanceAfter: newBalance,
              hasAttachment: !!attachmentUrl,
              attachmentUrl: attachmentUrl
          };
          setTransactions([newTrans, ...transactions]);
      }

      setContacts(contacts.map(c => 
        c.id === selectedContact.id 
          ? { ...c, balance: newBalance, lastUpdated: new Date().toISOString().split('T')[0] }
          : c
      ));

      handleBack(); 

    } catch(error) {
      console.error("Error saving transaction", error);
      alert("Failed to save transaction");
    }
  };

  const getFormattedDate = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString; 
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  
  const getDaysAgo = (dateString: string) => {
      const today = new Date();
      const last = new Date(dateString);
      if (isNaN(last.getTime())) return 0;
      
      const diffTime = Math.abs(today.getTime() - last.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays;
  };

  const handleSendReminder = (contact: Contact) => {
      alert(`Reminder sent to ${contact.name} (${contact.phone}) for Rs. ${contact.balance.toLocaleString()}`);
  };

  // --- RENDER: LOADING ---
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4">
        <Loader2 size={40} className="animate-spin text-blue-600" />
        <p className="text-gray-500 font-medium">Loading your ledger...</p>
      </div>
    );
  }

  // --- RENDER: REMINDERS VIEW ---
  if (currentView === 'REMINDERS') {
      const reminderContacts = contacts.filter(c => c.type !== 'RENT' && c.type === activeTab && c.balance > 0);
      const totalPending = reminderContacts.reduce((sum, c) => sum + c.balance, 0);
      
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white px-4 py-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
                <button onClick={handleBack}>
                    <ChevronLeft size={24} className="text-slate-800" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold text-slate-800">Payment Reminders</h1>
                    <p className="text-xs text-gray-500">Manage pending payments</p>
                </div>
            </header>

            {/* Toggle Tabs (Customers/Suppliers) */}
             <div className="bg-white px-4 pt-2 pb-0 mb-2 border-b border-slate-100">
                <div className="flex">
                  <button 
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 relative ${activeTab === 'CUSTOMER' ? theme.textDark : 'text-slate-500'}`}
                    onClick={() => setActiveTab('CUSTOMER')}
                  >
                    <Users size={18} />
                    To Collect
                    {activeTab === 'CUSTOMER' && (
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${theme.bgIndicator}`}></div>
                    )}
                  </button>
                  <button 
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 relative ${activeTab === 'SUPPLIER' ? theme.textDark : 'text-slate-500'}`}
                    onClick={() => setActiveTab('SUPPLIER')}
                  >
                    <Truck size={18} />
                    To Pay
                    {activeTab === 'SUPPLIER' && (
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${theme.bgIndicator}`}></div>
                    )}
                  </button>
                </div>
            </div>

            {/* Summary Banner */}
            <div className="px-4 py-2">
                <div className={`${activeTab === 'CUSTOMER' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'} border rounded-lg p-4 flex justify-between items-center`}>
                    <span className="text-sm font-medium">{activeTab === 'CUSTOMER' ? 'Total To Collect' : 'Total To Pay'}</span>
                    <span className="text-xl font-bold">Rs. {totalPending.toLocaleString()}</span>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 px-4 py-2 flex flex-col gap-3 pb-safe">
                {reminderContacts.length > 0 ? (
                    reminderContacts.map(contact => {
                        const daysAgo = getDaysAgo(contact.lastUpdated);
                        return (
                            <div key={contact.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">
                                            {contact.name.substring(0, 1)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">{contact.name}</h3>
                                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                                <Clock size={12} />
                                                <span>{daysAgo} days ago</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold text-lg ${activeTab === 'CUSTOMER' ? 'text-green-700' : 'text-red-700'}`}>
                                            Rs. {contact.balance.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                
                                {activeTab === 'CUSTOMER' && (
                                    <div className="pt-2 border-t border-gray-50 flex gap-3">
                                        <button 
                                            onClick={() => handleSendReminder(contact)}
                                            className="flex-1 bg-green-50 text-green-700 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 active:bg-green-100 transition-colors"
                                        >
                                            <MessageCircle size={16} />
                                            Remind via WhatsApp
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <Check size={48} className="mb-2 opacity-20" />
                        <p>No pending payments</p>
                    </div>
                )}
            </div>
        </div>
      );
  }

  // --- RENDER: PROFILE VIEW ---
  if (currentView === 'PROFILE') {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
            <header className="bg-white px-4 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <h1 className="text-xl font-bold text-slate-800">Profile & Settings</h1>
                <div className={`w-8 h-8 rounded-full ${theme.light} flex items-center justify-center`}>
                    <Store size={16} className={theme.text} />
                </div>
            </header>

            <div className="p-4 flex flex-col gap-4">
                {/* Shop Details Card */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <h2 className="text-sm font-bold text-gray-500 mb-4 uppercase">Business Details</h2>
                    
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full ${theme.light} flex items-center justify-center shrink-0`}>
                                <Store size={20} className={theme.text} />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-400">Shop Name</label>
                                <input 
                                    type="text" 
                                    value={shopName}
                                    onChange={(e) => setShopName(e.target.value)}
                                    className="w-full text-slate-800 font-semibold outline-none border-b border-gray-100 focus:border-gray-300 py-1 transition-colors"
                                />
                            </div>
                            <Pencil size={16} className="text-gray-300" />
                        </div>

                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full ${theme.light} flex items-center justify-center shrink-0`}>
                                <Phone size={20} className={theme.text} />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-gray-400">Phone Number</label>
                                <input 
                                    type="tel" 
                                    value={shopPhone}
                                    onChange={(e) => setShopPhone(e.target.value)}
                                    className="w-full text-slate-800 font-semibold outline-none border-b border-gray-100 focus:border-gray-300 py-1 transition-colors"
                                />
                            </div>
                            <Pencil size={16} className="text-gray-300" />
                        </div>
                    </div>
                </div>

                {/* Appearance Card */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <h2 className="text-sm font-bold text-gray-500 mb-4 uppercase">Appearance</h2>
                    
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Palette size={18} className="text-gray-400" />
                            <span className="text-sm font-medium text-slate-700">App Theme</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                            {(Object.keys(THEMES) as ThemeColor[]).map((colorKey) => (
                                <button
                                    key={colorKey}
                                    onClick={() => setAppTheme(colorKey)}
                                    className={`relative flex flex-col items-center gap-2 p-2 rounded-lg border ${appTheme === colorKey ? `border-${colorKey}-500 bg-gray-50` : 'border-transparent'}`}
                                >
                                    <div className={`w-10 h-10 rounded-full ${THEMES[colorKey].bgIndicator} shadow-sm flex items-center justify-center`}>
                                        {appTheme === colorKey && <Check size={18} className="text-white" />}
                                    </div>
                                    <span className={`text-xs font-medium ${appTheme === colorKey ? 'text-slate-800' : 'text-gray-500'}`}>
                                        {THEMES[colorKey].name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Other Settings Placeholder */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <button className="w-full p-4 flex items-center justify-between active:bg-gray-50">
                        <div className="flex items-center gap-3">
                            <Languages size={20} className="text-gray-400" />
                            <span className="text-sm font-medium text-slate-700">App Language</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">English</span>
                            <ChevronRight size={16} className="text-gray-300" />
                        </div>
                    </button>
                    <div className="h-[1px] bg-gray-50 mx-4"></div>
                    <button className="w-full p-4 flex items-center justify-between active:bg-gray-50 text-red-600">
                        <div className="flex items-center gap-3">
                            <LogOut size={20} />
                            <span className="text-sm font-medium">Log Out</span>
                        </div>
                    </button>
                </div>
            </div>

            <BottomNav 
                currentView={currentView} 
                onNavigate={handleNavigate} 
                activeTheme={appTheme}
            />
        </div>
      );
  }

  // --- RENDER: REPORT VIEW ---
  if (currentView === 'REPORT' && selectedContact) {
    const totalCredit = currentTransactions
        .filter(t => t.type === 'CREDIT')
        .reduce((sum, t) => sum + t.amount, 0);
    const totalPayment = currentTransactions
        .filter(t => t.type === 'PAYMENT')
        .reduce((sum, t) => sum + t.amount, 0);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white px-4 py-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
                <button onClick={handleBack}>
                    <ChevronLeft size={24} className="text-slate-800" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold text-slate-800">Report</h1>
                    <p className="text-xs text-gray-500">{selectedContact.name}</p>
                </div>
                <button className={theme.text}>
                    <Share2 size={20} />
                </button>
            </header>

            <div className="p-4">
                {/* Date Filter Mock */}
                <div className="bg-white rounded-lg p-3 flex items-center justify-between shadow-sm mb-4 border border-gray-100">
                    <div className="flex items-center gap-2 text-slate-600">
                        <Calendar size={18} />
                        <span className="text-sm font-medium">This Month</span>
                    </div>
                    <ChevronDown size={16} className="text-gray-400" />
                </div>

                {/* GRAPH SECTION */}
                <TrendChart transactions={currentTransactions} type={selectedContact.type} />

                {/* Stats */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4 border border-gray-100">
                    <div className="flex border-b border-gray-100">
                        <div className="flex-1 p-4 border-r border-gray-100 text-center">
                            <p className="text-xs text-gray-500 mb-1">Total {selectedContact.type === 'RENT' ? 'Withdrawn' : 'Credit'}</p>
                            <p className="text-lg font-bold text-red-600">Rs. {totalCredit.toLocaleString()}</p>
                        </div>
                        <div className="flex-1 p-4 text-center">
                            <p className="text-xs text-gray-500 mb-1">Total {selectedContact.type === 'RENT' ? 'Saved' : 'Paid'}</p>
                            <p className="text-lg font-bold text-green-600">Rs. {totalPayment.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="p-4 text-center bg-gray-50">
                        <p className="text-xs text-gray-500 mb-1">
                            {selectedContact.type === 'RENT' ? 'Current Savings Balance' : 'Net Balance'}
                        </p>
                        <p className={`text-xl font-bold ${selectedContact.type === 'RENT' ? 'text-blue-700' : selectedContact.balance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                             Rs. {selectedContact.balance.toLocaleString()}
                             <span className="text-xs font-normal text-gray-500 ml-1">
                                {selectedContact.type === 'SUPPLIER' ? '(To Pay)' : selectedContact.type === 'RENT' ? '(Saved)' : '(To Collect)'}
                             </span>
                        </p>
                    </div>
                </div>

                {/* Transaction List */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                    <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between">
                        <span className="text-xs font-bold text-gray-500">DATE</span>
                        <div className="flex gap-8">
                             <span className="text-xs font-bold text-gray-500 w-16 text-right">CREDIT</span>
                             <span className="text-xs font-bold text-gray-500 w-16 text-right">{selectedContact.type === 'RENT' ? 'DEPOSIT' : 'DEBIT'}</span>
                        </div>
                    </div>
                    {currentTransactions.map(t => (
                        <div key={t.id} className="p-3 border-b border-gray-100 flex justify-between text-sm">
                            <div className="flex flex-col">
                                <span className="font-medium text-slate-700">{t.date}</span>
                                <span className="text-[10px] text-gray-400 max-w-[100px] truncate">{t.description || '-'}</span>
                            </div>
                            <div className="flex gap-8">
                                <span className="w-16 text-right font-medium text-red-600">
                                    {t.type === 'CREDIT' ? t.amount.toLocaleString() : '-'}
                                </span>
                                <span className="w-16 text-right font-medium text-green-600">
                                    {t.type === 'PAYMENT' ? t.amount.toLocaleString() : '-'}
                                </span>
                            </div>
                        </div>
                    ))}
                    {currentTransactions.length === 0 && (
                        <div className="p-6 text-center text-gray-400 text-sm">No transactions in this period</div>
                    )}
                </div>
            </div>

            <div className="p-4 mt-auto">
                <button 
                    onClick={handleDownloadReport}
                    className={`w-full ${theme.primary} ${theme.primaryActive} text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors`}
                >
                    <Download size={18} />
                    Download PDF Report
                </button>
            </div>
        </div>
    );
  }

  // --- RENDER: EDIT CONTACT VIEW ---
  if (currentView === 'EDIT_CONTACT' && selectedContact) {
      return (
        <div className="min-h-screen bg-white flex flex-col">
            <header className="px-4 py-4 flex items-center gap-4 border-b border-gray-100">
                <button onClick={handleBack}>
                    <ChevronLeft size={24} className="text-slate-800" />
                </button>
                <h1 className="text-lg font-bold text-slate-800">Edit {selectedContact.type === 'RENT' ? 'Target' : 'Contact'}</h1>
            </header>

            <div className="p-6 flex-col flex gap-6">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-600">Name</label>
                    <input 
                        type="text" 
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        className={`w-full border border-gray-300 rounded-lg p-3 text-base text-slate-800 ${theme.primary} focus:border-transparent focus:ring-2 outline-none transition-all ring-offset-0`}
                        placeholder="Name"
                    />
                </div>
                
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-600">Phone Number</label>
                    <input 
                        type="tel" 
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        className={`w-full border border-gray-300 rounded-lg p-3 text-base text-slate-800 ${theme.primary} focus:border-transparent focus:ring-2 outline-none transition-all ring-offset-0`}
                        placeholder="Phone"
                    />
                </div>

                {selectedContact.type === 'RENT' && (
                    <>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-600">Target Amount</label>
                            <input 
                                type="number" 
                                value={newContactTarget}
                                onChange={(e) => setNewContactTarget(e.target.value)}
                                className={`w-full border border-gray-300 rounded-lg p-3 text-base text-slate-800 ${theme.primary} focus:border-transparent focus:ring-2 outline-none transition-all ring-offset-0`}
                                placeholder="Target Amount (e.g. 30000)"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-600">Start Date</label>
                                <input 
                                    type="date" 
                                    value={newContactStartDate}
                                    onChange={(e) => setNewContactStartDate(e.target.value)}
                                    className={`w-full border border-gray-300 rounded-lg p-3 text-base text-slate-800 ${theme.primary} outline-none transition-all`}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-600">End Date</label>
                                <input 
                                    type="date" 
                                    value={newContactEndDate}
                                    onChange={(e) => setNewContactEndDate(e.target.value)}
                                    className={`w-full border border-gray-300 rounded-lg p-3 text-base text-slate-800 ${theme.primary} outline-none transition-all`}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="mt-auto p-6 flex flex-col gap-3">
                <button 
                    onClick={handleUpdateContact}
                    className={`w-full ${theme.primary} ${theme.primaryActive} text-white font-bold py-3.5 rounded-lg transition-colors shadow-sm`}
                >
                    Save Changes
                </button>
                <button 
                    onClick={handleDeleteContact}
                    className="w-full bg-white border border-red-200 text-red-600 font-bold py-3.5 rounded-lg active:bg-red-50 transition-colors flex items-center justify-center gap-2"
                >
                    <Trash2 size={18} />
                    Delete {selectedContact.type === 'RENT' ? 'Target' : 'Contact'}
                </button>
            </div>
        </div>
      );
  }

  // --- RENDER: TRANSACTION FORM VIEW ---
  if (currentView === 'TRANSACTION_FORM' && selectedContact) {
    const isCredit = transType === 'CREDIT';
    const isRent = selectedContact.type === 'RENT';
    const themeColor = isCredit ? 'text-red-700' : 'text-green-700';
    const btnColor = isCredit ? 'bg-red-800' : 'bg-green-800';
    
    let titleAction = '';
    if (editingTransactionId) titleAction = 'Edit';
    else if (isRent) titleAction = isCredit ? 'Withdraw from' : 'Save to';
    else titleAction = isCredit ? 'Get Credit from' : 'Make Payment to';
    
    const title = editingTransactionId ? 'Edit Transaction' : `${titleAction} ${selectedContact.name}`;
    
    return (
      <div className="min-h-screen bg-white flex flex-col relative">
        <header className="bg-white px-4 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
                <button onClick={handleBack}>
                    <ChevronLeft size={24} className="text-slate-800" />
                </button>
                <h1 className={`text-lg font-bold ${themeColor}`}>{title}</h1>
            </div>
            {editingTransactionId && (
                <button 
                    onClick={handleDeleteTransaction}
                    className="p-2 text-red-600 bg-red-50 rounded-full"
                >
                    <Trash2 size={20} />
                </button>
            )}
        </header>

        <div className="flex-1 p-4 flex flex-col">
          <div className="mt-2">
            <label className="text-sm font-medium text-slate-800 block mb-1">Amount</label>
            <div className="flex items-center border-b border-gray-300 py-2">
              <span className={`text-lg font-bold mr-2 ${themeColor}`}>Rs.</span>
              <input 
                type="number" 
                value={transAmount}
                onChange={(e) => setTransAmount(e.target.value)}
                className={`flex-1 text-2xl font-bold outline-none bg-transparent ${themeColor}`}
                autoFocus
                placeholder="0"
              />
              <button className={`p-2 rounded ${theme.light} ${theme.text}`}>
                <Calculator size={20} />
              </button>
            </div>
          </div>

          <div className="flex justify-end mt-2 mb-6">
            <div className={`flex items-center gap-2 ${theme.text} bg-white py-1 px-2 rounded hover:bg-gray-50 cursor-pointer relative`}>
               <input 
                type="date" 
                value={transDate}
                onChange={(e) => setTransDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
               />
               <span className="text-sm font-medium">{getFormattedDate(transDate)}</span>
               <Pencil size={14} />
            </div>
          </div>

          {!isCredit && (
             <div className="mb-6">
               <label className="text-sm font-medium text-slate-800 block mb-4">Payment Mode</label>
               <div className="flex gap-8">
                 <label className="flex items-center gap-2 cursor-pointer">
                   <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMode === 'CASH' ? 'border-blue-600' : 'border-gray-400'}`}>
                     {paymentMode === 'CASH' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                   </div>
                   <input type="radio" className="hidden" checked={paymentMode === 'CASH'} onChange={() => setPaymentMode('CASH')} />
                   <span className="text-sm font-medium text-slate-700">Cash</span>
                 </label>
                 <label className="flex items-center gap-2 cursor-pointer">
                   <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMode === 'BANK' ? 'border-blue-600' : 'border-gray-400'}`}>
                     {paymentMode === 'BANK' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                   </div>
                   <input type="radio" className="hidden" checked={paymentMode === 'BANK'} onChange={() => setPaymentMode('BANK')} />
                   <span className="text-sm font-medium text-slate-700">Bank</span>
                 </label>
               </div>
             </div>
          )}

          {!isCredit && (
            <div className="mb-6">
              <textarea
                placeholder="Add notes (Items, bill number, quantity, etc.)"
                className="w-full bg-gray-50 border border-gray-100 rounded-lg p-4 text-sm text-slate-700 outline-none resize-none h-24 placeholder:text-gray-400"
                value={transDesc}
                onChange={(e) => setTransDesc(e.target.value)}
              />
              <div className="flex justify-end mt-1">
                <span className="text-[10px] text-gray-400">0/180</span>
              </div>
            </div>
          )}

          <div>
            <button 
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className={`flex items-center gap-2 ${theme.text} mb-4`}
            >
              <span className="text-sm font-medium">More Options</span>
              {showMoreOptions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {showMoreOptions && (
              <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
                {isCredit && (
                  <div className="border border-gray-300 rounded-lg p-3 flex items-center justify-between cursor-pointer active:bg-gray-50">
                    <div className="flex items-center gap-3 w-full">
                      <FilePlus size={20} className="text-gray-400" />
                      <input 
                          type="text" 
                          placeholder="Add Item"
                          value={transDesc}
                          onChange={(e) => setTransDesc(e.target.value)}
                          className="text-sm text-slate-700 outline-none w-full placeholder:text-gray-400"
                          onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                )}
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                />

                <div 
                    onClick={() => {
                        if (!attachmentUrl && !isUploading) {
                            fileInputRef.current?.click();
                        }
                    }}
                    className={`border border-gray-300 rounded-lg p-3 flex items-center justify-between cursor-pointer active:bg-gray-50 transition-colors ${attachmentUrl ? 'bg-blue-50 border-blue-200' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {isUploading ? (
                        <Loader2 size={20} className="text-blue-600 animate-spin" />
                    ) : attachmentUrl ? (
                        <Check size={20} className="text-blue-600" />
                    ) : (
                        <Camera size={20} className="text-gray-400" />
                    )}
                    
                    <span className={`text-sm ${attachmentUrl ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>
                        {isUploading ? 'Uploading...' : attachmentUrl ? 'Bill Attached' : 'Attach Bills'}
                    </span>
                  </div>
                  
                  {attachmentUrl ? (
                      <div className="flex items-center gap-3">
                           <button 
                             onClick={(e) => {
                                 e.stopPropagation();
                                 window.open(attachmentUrl, '_blank');
                             }}
                             className="text-blue-600 hover:text-blue-800"
                           >
                               <Eye size={18} />
                           </button>
                           <button 
                             onClick={(e) => {
                                 e.stopPropagation();
                                 setAttachmentUrl(null);
                                 if (fileInputRef.current) fileInputRef.current.value = '';
                             }}
                             className="text-red-500 hover:text-red-700"
                           >
                               <Trash2 size={18} />
                           </button>
                      </div>
                  ) : (
                      <ChevronRight size={16} className="text-gray-300" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleSaveTransaction}
            disabled={isUploading}
            className={`w-full ${btnColor} text-white font-bold py-3.5 rounded-lg active:opacity-90 transition-opacity ${isUploading ? 'opacity-70' : ''}`}
          >
            {editingTransactionId ? 'Update Transaction' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER: DETAIL VIEW ---
  if (currentView === 'DETAIL' && selectedContact) {
    const isSupplier = selectedContact.type === 'SUPPLIER';
    const isRent = selectedContact.type === 'RENT';
    
    const rentTarget = selectedContact.targetAmount || 0;
    const rentRemaining = Math.max(0, rentTarget - selectedContact.balance);
    const progressPercent = rentTarget > 0 ? Math.min(100, (selectedContact.balance / rentTarget) * 100) : 0;
    
    const formattedStartDate = selectedContact.startDate ? getFormattedDate(selectedContact.startDate) : 'N/A';
    const formattedEndDate = selectedContact.endDate ? getFormattedDate(selectedContact.endDate) : 'N/A';

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-24 relative">
        <header className="bg-white sticky top-0 z-30 shadow-sm px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={handleBack} className="p-1">
                <ChevronLeft size={24} className="text-slate-800" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                  {isRent ? <Target size={18} /> : selectedContact.name.substring(0, 1)}
                </div>
                <h1 className="font-bold text-lg text-slate-800 line-clamp-1">{selectedContact.name}</h1>
              </div>
            </div>
            <button>
              <MoreVertical size={20} className="text-slate-700" />
            </button>
          </div>
          
          <div className="flex gap-2 pl-12">
            <button 
                onClick={openEditContact} 
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 transition-colors"
            >
                <Pencil size={14} />
                Edit
            </button>
            <button 
                onClick={handleDeleteContact} 
                className="flex items-center gap-1 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full text-xs font-semibold text-red-600 transition-colors"
            >
                <Trash2 size={14} />
                Delete
            </button>
            <button 
                onClick={() => setCurrentView('REPORT')}
                className={`flex items-center gap-1 ${theme.light} ${theme.lightHover} px-3 py-1.5 rounded-full text-xs font-semibold ${theme.text} transition-colors`}
            >
                <FileText size={14} />
                Reports
            </button>
          </div>
        </header>

        <div className="p-4 bg-white mb-2">
          <div className="bg-gray-50 rounded-lg p-6 flex flex-col items-center justify-center">
             {isRent ? (
                 <div className="w-full">
                     <div className="flex justify-between items-center mb-2">
                         <span className="text-sm font-semibold text-gray-500">Goal: Rs. {rentTarget.toLocaleString()}</span>
                         <span className="text-sm font-bold text-blue-600">{progressPercent.toFixed(1)}%</span>
                     </div>
                     <div className="w-full h-3 bg-gray-200 rounded-full mb-4 overflow-hidden">
                         <div className="h-full bg-blue-600 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                     </div>
                     <div className="flex justify-between items-center text-center">
                         <div>
                             <p className="text-xs text-gray-500">Saved</p>
                             <p className="text-lg font-bold text-green-600">Rs. {selectedContact.balance.toLocaleString()}</p>
                         </div>
                         <div className="h-8 w-[1px] bg-gray-200"></div>
                         <div>
                             <p className="text-xs text-gray-500">Remaining</p>
                             <p className="text-lg font-bold text-red-600">Rs. {rentRemaining.toLocaleString()}</p>
                         </div>
                     </div>
                     
                     <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                            <Calendar size={14} />
                            <span>{formattedStartDate} - {formattedEndDate}</span>
                        </div>
                        <button 
                            onClick={handleStartNewMonth}
                            className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                        >
                            <RefreshCw size={14} />
                            Finish & Start New Month
                        </button>
                     </div>
                 </div>
             ) : (
                <>
                    <h2 className={`text-xl font-bold ${selectedContact.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Rs. {selectedContact.balance.toLocaleString()}
                    </h2>
                    <p className="text-gray-500 text-sm">
                      {isSupplier ? 'To Pay' : 'To Collect'}
                    </p>
                </>
             )}
          </div>
        </div>

        <div className="flex-1">
          {currentTransactions.length > 0 ? (
             currentTransactions.map(t => (
                <TransactionRow 
                    key={t.id} 
                    transaction={t} 
                    onClick={handleEditTransaction}
                />
             ))
          ) : (
            <div className="p-8 text-center text-gray-400">
                <p>No transactions found</p>
                {isRent && <p className="text-xs mt-2 text-gray-300">for this period</p>}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white p-4 flex gap-4 border-t border-gray-200 z-40">
          <button 
            onClick={() => startTransaction('CREDIT')}
            className="flex-1 bg-red-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 active:bg-red-800 transition-colors"
          >
            <ArrowDown size={18} />
            {isRent ? 'Withdraw' : (isSupplier ? 'Purchase (Credit)' : 'Give Credit')}
          </button>
          <button 
            onClick={() => startTransaction('PAYMENT')}
            className="flex-1 bg-green-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 active:bg-green-800 transition-colors"
          >
            <ArrowUp size={18} />
            {isRent ? 'Add Savings' : (isSupplier ? 'Pay Cash / Bank' : 'Receive Cash / Bank')}
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER: DASHBOARD VIEW ---
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      <header className="bg-white px-4 py-3 pb-0">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Manage Credit</h1>
            <div className="flex items-center text-slate-600 text-sm gap-1 mt-1">
              <span className="font-semibold">{shopName}</span>
              <ChevronLeft size={16} className="-rotate-90" />
            </div>
            {shopPhone && <div className="text-xs text-slate-400 mt-0.5">{shopPhone}</div>}
          </div>
          <div className="flex gap-4">
            <button 
                onClick={() => setCurrentView('REMINDERS')}
                className="flex flex-col items-center gap-0.5"
            >
              <CalendarClock className={theme.text} size={22} />
              <span className={`text-[10px] font-medium ${theme.text}`}>Reminders</span>
            </button>
          </div>
        </div>

        <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
          <button 
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 relative min-w-[100px] ${activeTab === 'CUSTOMER' ? 'text-slate-800' : 'text-slate-500'}`}
            onClick={() => setActiveTab('CUSTOMER')}
          >
            <Users size={18} />
            Customers
            {activeTab === 'CUSTOMER' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800"></div>
            )}
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 relative min-w-[100px] ${activeTab === 'SUPPLIER' ? 'text-slate-800' : 'text-slate-500'}`}
            onClick={() => setActiveTab('SUPPLIER')}
          >
            <Truck size={18} />
            Suppliers
            {activeTab === 'SUPPLIER' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800"></div>
            )}
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 relative min-w-[100px] ${activeTab === 'RENT' ? 'text-slate-800' : 'text-slate-500'}`}
            onClick={() => setActiveTab('RENT')}
          >
            <Building size={18} />
            Rent / Targets
            {activeTab === 'RENT' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800"></div>
            )}
          </button>
        </div>
      </header>

      <div className="p-4 flex gap-3">
        {activeTab === 'SUPPLIER' ? (
          <>
            <div className="flex-1 bg-green-50 border border-green-100 rounded-lg p-3">
              <p className="text-xs text-slate-600 mb-1">Supplier holds</p>
              <p className="text-lg font-bold text-green-700">Rs. 0</p>
            </div>
            <div className="flex-1 bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs text-slate-600 mb-1">To pay</p>
              <p className="text-lg font-bold text-red-700">Rs. {totalToPay.toLocaleString()}</p>
            </div>
          </>
        ) : activeTab === 'CUSTOMER' ? (
          <>
            <div className="flex-1 bg-green-50 border border-green-100 rounded-lg p-3">
              <p className="text-xs text-slate-600 mb-1">To Collect</p>
              <p className="text-lg font-bold text-green-700">Rs. {totalToCollect.toLocaleString()}</p>
            </div>
             <div className="flex-1"></div>
          </>
        ) : (
            <>
            <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs text-slate-600 mb-1">Total Saved</p>
              <p className="text-lg font-bold text-blue-700">Rs. {totalRentSaved.toLocaleString()}</p>
            </div>
             <div className="flex-1 bg-orange-50 border border-orange-100 rounded-lg p-3">
                <p className="text-xs text-slate-600 mb-1">Remaining</p>
                <p className="text-lg font-bold text-orange-700">Rs. {totalRentRemaining.toLocaleString()}</p>
             </div>
            </>
        )}
      </div>

      <div className="px-4 mb-2">
        <div className="bg-white border border-gray-200 rounded-lg flex items-center px-3 py-2.5">
          <Search size={18} className="text-gray-400 mr-2" />
          <input 
            type="text" 
            placeholder="Search name or number here" 
            className="flex-1 text-sm outline-none text-slate-700"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="border-l border-gray-200 pl-3 ml-1">
             <BarChart3 size={18} className="text-blue-500" />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 flex justify-between items-center">
        <span className="text-xs font-medium text-gray-400 uppercase">
          {filteredContacts.length} {activeTab === 'SUPPLIER' ? 'Suppliers' : activeTab === 'RENT' ? 'Targets' : 'Customers'}
        </span>
        <span className="text-xs font-medium text-gray-400 uppercase">{activeTab === 'RENT' ? 'Savings' : 'Amount (Rs.)'}</span>
      </div>

      <div className="flex-1 px-4 flex flex-col gap-2">
        {filteredContacts.map(contact => {
            if (contact.type === 'RENT') {
                const target = contact.targetAmount || 0;
                const percent = target > 0 ? (contact.balance / target) * 100 : 0;
                const remaining = Math.max(0, target - contact.balance);

                const dateRange = (contact.startDate && contact.endDate) 
                    ? `${getFormattedDate(contact.startDate)} - ${getFormattedDate(contact.endDate)}` 
                    : '';

                return (
                  <div 
                    key={contact.id} 
                    onClick={() => handleContactClick(contact.id)}
                    className="bg-white rounded-lg p-4 shadow-sm flex flex-col gap-3 active:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-medium">
                            <Target size={18} />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-slate-800">{contact.name}</h3>
                            <div className="flex flex-col">
                                <p className="text-xs text-gray-400 mt-0.5">Target: {target.toLocaleString()}</p>
                                {dateRange && <p className="text-[10px] text-gray-400 mt-0.5 bg-gray-50 px-1 rounded inline-block w-max">{dateRange}</p>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase mb-0.5">Saved</p>
                          <p className="font-bold text-blue-700">{contact.balance.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, percent)}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                        <span>{percent.toFixed(0)}% Done</span>
                        <span>Remaining: {remaining.toLocaleString()}</span>
                    </div>
                  </div>
                );
            }
            return (
              <div 
                key={contact.id} 
                onClick={() => handleContactClick(contact.id)}
                className="bg-white rounded-lg p-3 shadow-sm flex justify-between items-center active:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-slate-600 font-medium">
                    {contact.name.substring(0, 1)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{contact.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{contact.phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase mb-0.5">
                    {activeTab === 'SUPPLIER' ? 'To pay' : 'To collect'}
                  </p>
                  <p className={`font-bold ${activeTab === 'SUPPLIER' ? 'text-red-700' : 'text-green-700'}`}>
                    {contact.balance.toLocaleString()}
                  </p>
                </div>
              </div>
            );
        })}

        {filteredContacts.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
                No items found.
            </div>
        )}
      </div>

      <div className="px-4 mt-4">
        <button 
          onClick={openAddContact}
          className={`w-full ${theme.primary} ${theme.primaryActive} text-white font-semibold py-3 rounded-lg shadow-md transition-colors`}
        >
          Add {activeTab === 'SUPPLIER' ? 'Supplier' : activeTab === 'RENT' ? 'Target' : 'Customer'}
        </button>
      </div>

      {showAddContactModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                Add New {activeTab === 'SUPPLIER' ? 'Supplier' : activeTab === 'RENT' ? 'Rent / Target' : 'Customer'}
              </h3>
              <button onClick={() => setShowAddContactModal(false)}><X size={24} className="text-gray-400" /></button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">Name</label>
                <input 
                  type="text" 
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="border border-gray-300 rounded-lg p-3 text-sm"
                  placeholder={activeTab === 'RENT' ? "e.g. Shop Rent" : "Business or Person Name"}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">Phone Number (Optional)</label>
                <input 
                  type="tel" 
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="border border-gray-300 rounded-lg p-3 text-sm"
                  placeholder="Mobile Number"
                />
              </div>
              
              {activeTab === 'RENT' && (
                  <>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500">Target Amount</label>
                        <input 
                        type="number" 
                        value={newContactTarget}
                        onChange={(e) => setNewContactTarget(e.target.value)}
                        className="border border-gray-300 rounded-lg p-3 text-sm"
                        placeholder="e.g. 30000"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-gray-500">Start Date</label>
                            <input 
                                type="date" 
                                value={newContactStartDate}
                                onChange={(e) => setNewContactStartDate(e.target.value)}
                                className="border border-gray-300 rounded-lg p-3 text-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-gray-500">End Date</label>
                            <input 
                                type="date" 
                                value={newContactEndDate}
                                onChange={(e) => setNewContactEndDate(e.target.value)}
                                className="border border-gray-300 rounded-lg p-3 text-sm"
                            />
                        </div>
                    </div>
                  </>
              )}

              <button 
                onClick={handleSaveNewContact}
                className={`mt-2 w-full ${theme.primary} ${theme.primaryActive} text-white font-semibold py-3 rounded-lg transition-colors`}
              >
                Save {activeTab === 'RENT' ? 'Target' : 'Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="h-4"></div>

      <BottomNav 
        currentView={currentView} 
        onNavigate={handleNavigate} 
        activeTheme={appTheme}
      />
    </div>
  );
}

export default App;