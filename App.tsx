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
  ImageIcon
} from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { TransactionRow } from './components/TransactionRow';
import { Contact, Transaction, ContactType, TransactionType } from './types';
import { supabase } from './supabaseClient';

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
        id: c.id,
        name: c.name,
        phone: c.phone,
        type: c.type as ContactType,
        balance: c.balance,
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
        id: t.id,
        contactId: t.contact_id,
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

  const currentTransactions = useMemo(() => {
    if (!selectedContactId) return [];
    // Only filter the transactions we already fetched and sorted
    return transactions.filter(t => t.contactId === selectedContactId);
  }, [transactions, selectedContactId]);

  // Actions
  const handleContactClick = (id: string) => {
    setSelectedContactId(id);
    setCurrentView('DETAIL');
  };

  const handleNavigate = (view: ViewState) => {
    // If going to dashboard, clear selection
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
    setShowAddContactModal(true);
  };

  const openEditContact = () => {
    if (!selectedContact) return;
    setNewContactName(selectedContact.name);
    setNewContactPhone(selectedContact.phone);
    setCurrentView('EDIT_CONTACT'); 
  };

  const handleSaveNewContact = async () => {
    if (!newContactName) return;
    
    try {
      const newContactId = Date.now().toString(); // Or use crypto.randomUUID()
      const newContact = {
        id: newContactId,
        name: newContactName,
        phone: newContactPhone,
        type: activeTab,
        balance: 0,
        last_updated: new Date().toISOString().split('T')[0]
      };

      const { error } = await supabase.from('contacts').insert([newContact]);
      if (error) throw error;

      // Update local state
      const mappedNewContact: Contact = {
        id: newContactId,
        name: newContactName,
        phone: newContactPhone,
        type: activeTab,
        balance: 0,
        lastUpdated: newContact.last_updated
      };
      
      setContacts([...contacts, mappedNewContact]);
      setNewContactName('');
      setNewContactPhone('');
      setShowAddContactModal(false);
    } catch (error) {
      console.error('Error adding contact:', error);
      alert('Failed to add contact');
    }
  };

  const handleUpdateContact = async () => {
    if (!selectedContact || !newContactName) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ name: newContactName, phone: newContactPhone })
        .eq('id', selectedContact.id);

      if (error) throw error;

      setContacts(contacts.map(c => 
          c.id === selectedContact.id 
            ? { ...c, name: newContactName, phone: newContactPhone }
            : c
      ));

      setCurrentView('DETAIL'); 
    } catch (error) {
      console.error('Error updating contact:', error);
      alert('Failed to update contact');
    }
  };

  const handleDeleteContact = async () => {
    if (!selectedContact) return;
    if (confirm('Are you sure you want to delete this contact and all their transactions?')) {
      try {
        // Delete transactions first (manual cascade just in case)
        await supabase.from('transactions').delete().eq('contact_id', selectedContact.id);
        
        // Delete contact
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
          if (transToDelete.type === 'CREDIT') {
              reversionAmount = -transToDelete.amount;
          } else {
              reversionAmount = transToDelete.amount;
          }
          
          const newBalance = selectedContact.balance + reversionAmount;

          // DB Updates
          await supabase.from('transactions').delete().eq('id', editingTransactionId);
          await supabase.from('contacts').update({
             balance: newBalance,
             last_updated: new Date().toISOString().split('T')[0]
          }).eq('id', selectedContact.id);

          // State Updates
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

      // Upload file to 'receipts' bucket
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
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

    const getBalanceEffect = (type: TransactionType, amount: number) => {
        return type === 'CREDIT' ? amount : -amount;
    };

    let newBalance = selectedContact.balance;
    const dateObj = new Date(transDate);
    const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    
    let finalDesc = transDesc;
    if (transType === 'PAYMENT' && paymentMode === 'BANK') {
       finalDesc = finalDesc ? `${finalDesc} (Bank)` : 'Bank Payment';
    }

    try {
      if (editingTransactionId) {
          const oldTransIndex = transactions.findIndex(t => t.id === editingTransactionId);
          if (oldTransIndex === -1) return;
          const oldTrans = transactions[oldTransIndex];

          const oldEffect = getBalanceEffect(oldTrans.type, oldTrans.amount);
          newBalance -= oldEffect;

          const newEffect = getBalanceEffect(transType, amountVal);
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

          // Local update
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
          const effect = getBalanceEffect(transType, amountVal);
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
      const reminderContacts = contacts.filter(c => c.type === activeTab && c.balance > 0);
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

                {/* Stats */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4 border border-gray-100">
                    <div className="flex border-b border-gray-100">
                        <div className="flex-1 p-4 border-r border-gray-100 text-center">
                            <p className="text-xs text-gray-500 mb-1">Total Credit</p>
                            <p className="text-lg font-bold text-red-600">Rs. {totalCredit.toLocaleString()}</p>
                        </div>
                        <div className="flex-1 p-4 text-center">
                            <p className="text-xs text-gray-500 mb-1">Total Paid</p>
                            <p className="text-lg font-bold text-green-600">Rs. {totalPayment.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="p-4 text-center bg-gray-50">
                        <p className="text-xs text-gray-500 mb-1">Net Balance</p>
                        <p className={`text-xl font-bold ${selectedContact.balance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                             Rs. {selectedContact.balance.toLocaleString()}
                             <span className="text-xs font-normal text-gray-500 ml-1">
                                {selectedContact.type === 'SUPPLIER' ? '(To Pay)' : '(To Collect)'}
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
                             <span className="text-xs font-bold text-gray-500 w-16 text-right">DEBIT</span>
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
                <button className={`w-full ${theme.primary} ${theme.primaryActive} text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors`}>
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
                <h1 className="text-lg font-bold text-slate-800">Edit Contact</h1>
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
                    Delete Contact
                </button>
            </div>
        </div>
      );
  }

  // --- RENDER: TRANSACTION FORM VIEW ---
  if (currentView === 'TRANSACTION_FORM' && selectedContact) {
    const isCredit = transType === 'CREDIT';
    const themeColor = isCredit ? 'text-red-700' : 'text-green-700';
    const btnColor = isCredit ? 'bg-red-800' : 'bg-green-800';
    const titleAction = editingTransactionId ? 'Edit' : (isCredit ? 'Get Credit from' : 'Make Payment to');
    const title = editingTransactionId ? 'Edit Transaction' : `${titleAction} ${selectedContact.name}`;
    
    return (
      <div className="min-h-screen bg-white flex flex-col relative">
        {/* Header */}
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
          {/* Amount Input */}
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

          {/* Date Selector */}
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

          {/* Payment Mode */}
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

          {/* Notes Input */}
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

          {/* More Options Header */}
          <div>
            <button 
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className={`flex items-center gap-2 ${theme.text} mb-4`}
            >
              <span className="text-sm font-medium">More Options</span>
              {showMoreOptions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {/* Expanded Options */}
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
                
                {/* Hidden File Input */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                />

                {/* Attach Bills Button */}
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

        {/* Save Button Footer */}
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
    
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-24 relative">
        {/* Header */}
        <header className="bg-white sticky top-0 z-30 shadow-sm px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={handleBack} className="p-1">
                <ChevronLeft size={24} className="text-slate-800" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                  {selectedContact.name.substring(0, 1)}
                </div>
                <h1 className="font-bold text-lg text-slate-800 line-clamp-1">{selectedContact.name}</h1>
              </div>
            </div>
            <button>
              <MoreVertical size={20} className="text-slate-700" />
            </button>
          </div>
          
          {/* Actions Bar next to name */}
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

        {/* Balance Summary */}
        <div className="p-4 bg-white mb-2">
          <div className="bg-gray-50 rounded-lg p-6 flex flex-col items-center justify-center">
            <h2 className={`text-xl font-bold ${selectedContact.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              Rs. {selectedContact.balance.toLocaleString()}
            </h2>
            <p className="text-gray-500 text-sm">
              {isSupplier ? 'To Pay' : 'To Collect'}
            </p>
          </div>
        </div>

        {/* Transactions List */}
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
            <div className="p-8 text-center text-gray-400">No transactions found</div>
          )}
        </div>

        {/* Sticky Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-white p-4 flex gap-4 border-t border-gray-200 z-40">
          <button 
            onClick={() => startTransaction('CREDIT')}
            className="flex-1 bg-red-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 active:bg-red-800 transition-colors"
          >
            <ArrowDown size={18} />
            {isSupplier ? 'Purchase (Credit)' : 'Give Credit'}
          </button>
          <button 
            onClick={() => startTransaction('PAYMENT')}
            className="flex-1 bg-green-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 active:bg-green-800 transition-colors"
          >
            <ArrowUp size={18} />
            {isSupplier ? 'Pay Cash / Bank' : 'Receive Cash / Bank'}
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER: DASHBOARD VIEW ---
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      {/* Top Bar */}
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

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button 
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 relative ${activeTab === 'CUSTOMER' ? 'text-slate-800' : 'text-slate-500'}`}
            onClick={() => setActiveTab('CUSTOMER')}
          >
            <Users size={18} />
            Customers
            {activeTab === 'CUSTOMER' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800"></div>
            )}
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 relative ${activeTab === 'SUPPLIER' ? 'text-slate-800' : 'text-slate-500'}`}
            onClick={() => setActiveTab('SUPPLIER')}
          >
            <Truck size={18} />
            Suppliers
            {activeTab === 'SUPPLIER' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800"></div>
            )}
          </button>
        </div>
      </header>

      {/* Summary Cards */}
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
        ) : (
          <>
            <div className="flex-1 bg-green-50 border border-green-100 rounded-lg p-3">
              <p className="text-xs text-slate-600 mb-1">To Collect</p>
              <p className="text-lg font-bold text-green-700">Rs. {totalToCollect.toLocaleString()}</p>
            </div>
             {/* Placeholder for symmetry */}
             <div className="flex-1"></div>
          </>
        )}
      </div>

      {/* Search */}
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

      {/* List Header */}
      <div className="px-4 py-2 flex justify-between items-center">
        <span className="text-xs font-medium text-gray-400 uppercase">
          {filteredContacts.length} {activeTab === 'SUPPLIER' ? 'Suppliers' : 'Customers'}
        </span>
        <span className="text-xs font-medium text-gray-400 uppercase">Amount (Rs.)</span>
      </div>

      {/* List */}
      <div className="flex-1 px-4 flex flex-col gap-2">
        {filteredContacts.map(contact => (
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
        ))}

        {filteredContacts.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
                No contacts found.
            </div>
        )}
      </div>

      {/* Add Button */}
      <div className="px-4 mt-4">
        <button 
          onClick={openAddContact}
          className={`w-full ${theme.primary} ${theme.primaryActive} text-white font-semibold py-3 rounded-lg shadow-md transition-colors`}
        >
          Add {activeTab === 'SUPPLIER' ? 'Supplier' : 'Customer'}
        </button>
      </div>

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                Add New {activeTab === 'SUPPLIER' ? 'Supplier' : 'Customer'}
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
                  placeholder="Business or Person Name"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500">Phone Number</label>
                <input 
                  type="tel" 
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="border border-gray-300 rounded-lg p-3 text-sm"
                  placeholder="Mobile Number"
                />
              </div>

              <button 
                onClick={handleSaveNewContact}
                className={`mt-2 w-full ${theme.primary} ${theme.primaryActive} text-white font-semibold py-3 rounded-lg transition-colors`}
              >
                Save Contact
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Spacer for Bottom Nav */}
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