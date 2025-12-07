import React, { useState, useRef, useMemo } from 'react';
import { 
  BookText, Wallet, Receipt, UserCircle, Store, Phone, Pencil, Palette, 
  Check, Languages, ChevronRight, LogOut, ChevronLeft, Share2, Calendar, 
  ChevronDown, Filter, Download, Trash2, Calculator, FilePlus, Loader2, 
  Camera, Eye, Target, MoreVertical, RefreshCw, ArrowDown, ArrowUp, 
  Search, Plus, FileText, Users, Truck, Building, PlayCircle, CalendarClock
} from 'lucide-react';
import { MOCK_CONTACTS, MOCK_TRANSACTIONS } from './constants';
import { Contact, Transaction, ContactType, TransactionType } from './types';
import { BottomNav } from './components/BottomNav';
import { TransactionRow } from './components/TransactionRow';

type ThemeColor = 'blue' | 'purple' | 'emerald' | 'orange' | 'dark';

const THEMES: Record<ThemeColor, any> = {
  blue: { name: 'Blue', primary: 'bg-blue-600', primaryActive: 'active:bg-blue-700', text: 'text-blue-600', light: 'bg-blue-50', lightHover: 'hover:bg-blue-100', border: 'border-blue-200', bgIndicator: 'bg-blue-500' },
  purple: { name: 'Purple', primary: 'bg-purple-600', primaryActive: 'active:bg-purple-700', text: 'text-purple-600', light: 'bg-purple-50', lightHover: 'hover:bg-purple-100', border: 'border-purple-200', bgIndicator: 'bg-purple-500' },
  emerald: { name: 'Emerald', primary: 'bg-emerald-600', primaryActive: 'active:bg-emerald-700', text: 'text-emerald-600', light: 'bg-emerald-50', lightHover: 'hover:bg-emerald-100', border: 'border-emerald-200', bgIndicator: 'bg-emerald-500' },
  orange: { name: 'Orange', primary: 'bg-orange-600', primaryActive: 'active:bg-orange-700', text: 'text-orange-600', light: 'bg-orange-50', lightHover: 'hover:bg-orange-100', border: 'border-orange-200', bgIndicator: 'bg-orange-500' },
  dark: { name: 'Dark', primary: 'bg-slate-800', primaryActive: 'active:bg-slate-900', text: 'text-slate-800', light: 'bg-gray-100', lightHover: 'hover:bg-gray-200', border: 'border-gray-200', bgIndicator: 'bg-slate-800' },
};

const TrendChart = ({ transactions, type, monthLabel }: { transactions: Transaction[], type: ContactType, monthLabel: string }) => {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-4">
      <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">Trend Analysis ({monthLabel})</h3>
      <div className="h-32 flex items-end gap-2 justify-between px-2">
        {[40, 60, 30, 80, 50, 70, 45].map((h, i) => (
          <div key={i} className="w-full bg-blue-50 rounded-t-sm relative group">
             <div 
                className={`absolute bottom-0 w-full rounded-t-sm ${type === 'RENT' ? 'bg-blue-500' : 'bg-green-500'}`} 
                style={{ height: `${h}%`, opacity: 0.7 }}
             ></div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-gray-400">
        <span>Start</span>
        <span>End</span>
      </div>
    </div>
  );
};

export default function App() {
  const [currentView, setCurrentView] = useState<string>('DASHBOARD');
  const [activeTab, setActiveTab] = useState<ContactType>('SUPPLIER');
  
  const [contacts, setContacts] = useState<Contact[]>(MOCK_CONTACTS);
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  // App Settings
  const [appTheme, setAppTheme] = useState<ThemeColor>('blue');
  const [shopName, setShopName] = useState('Smart Time');
  const [shopPhone, setShopPhone] = useState('0771234567');

  // Report State
  const [reportMonth, setReportMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Edit Contact State
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactTarget, setNewContactTarget] = useState('');
  const [newContactStartDate, setNewContactStartDate] = useState('');
  const [newContactEndDate, setNewContactEndDate] = useState('');

  // Transaction Form State
  const [transType, setTransType] = useState<TransactionType>('CREDIT');
  const [transAmount, setTransAmount] = useState('');
  const [transDate, setTransDate] = useState(new Date().toISOString().slice(0, 10));
  const [transDesc, setTransDesc] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK'>('CASH');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const theme = THEMES[appTheme];

  const getFormattedDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  
  const formattedReportMonth = reportMonth ? new Date(reportMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : 'All Time';

  const currentTransactions = useMemo(() => {
    if (!selectedContact) return [];
    return transactions.filter(t => t.contactId === selectedContact.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedContact]);

  const reportTransactions = useMemo(() => {
    if (!selectedContact) return [];
    let filtered = transactions.filter(t => t.contactId === selectedContact.id);
    if (reportMonth) {
       filtered = filtered.filter(t => t.date.includes(reportMonth) || (t.date.match(/\d{4}-\d{2}/) && t.date.startsWith(reportMonth)));
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedContact, reportMonth]);

  const filteredContacts = useMemo(() => {
      return contacts.filter(c => c.type === activeTab);
  }, [contacts, activeTab]);

  const totals = useMemo(() => {
      const supplierTotal = contacts.filter(c => c.type === 'SUPPLIER').reduce((acc, c) => acc + c.balance, 0);
      
      const customerContacts = contacts.filter(c => c.type === 'CUSTOMER');
      const customerToCollect = customerContacts.reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
      const customerAdvance = customerContacts.reduce((acc, c) => acc + (c.balance < 0 ? Math.abs(c.balance) : 0), 0);
      
      const rentContacts = contacts.filter(c => c.type === 'RENT');
      const rentSaved = rentContacts.reduce((acc, c) => acc + c.balance, 0);
      const rentRemaining = rentContacts.reduce((acc, c) => acc + Math.max(0, (c.targetAmount || 0) - c.balance), 0);

      return { supplierTotal, customerToCollect, customerAdvance, rentSaved, rentRemaining };
  }, [contacts]);

  const handleNavigate = (view: string) => setCurrentView(view);
  
  const handleBack = () => {
    if (currentView === 'TRANSACTION_FORM') setCurrentView('DETAIL');
    else if (currentView === 'EDIT_CONTACT') setCurrentView('DETAIL');
    else if (currentView === 'REPORT') setCurrentView('DETAIL');
    else if (currentView === 'DETAIL') {
        setSelectedContact(null);
        setCurrentView('DASHBOARD');
    }
    else setCurrentView('DASHBOARD');
  };

  const openContact = (contact: Contact) => {
    setSelectedContact(contact);
    setCurrentView('DETAIL');
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

  const handleUpdateContact = () => {
      if (!selectedContact) return;
      const updated: Contact = {
          ...selectedContact,
          name: newContactName,
          phone: newContactPhone,
          targetAmount: selectedContact.type === 'RENT' ? parseFloat(newContactTarget) : undefined,
          startDate: newContactStartDate,
          endDate: newContactEndDate
      };
      setContacts(contacts.map(c => c.id === selectedContact.id ? updated : c));
      setSelectedContact(updated);
      setCurrentView('DETAIL');
  };

  const handleDeleteContact = () => {
      if (!selectedContact) return;
      setContacts(contacts.filter(c => c.id !== selectedContact.id));
      setSelectedContact(null);
      setCurrentView('DASHBOARD');
  };
  
  const startTransaction = (type: TransactionType) => {
      setTransType(type);
      setTransAmount('');
      setTransDate(new Date().toISOString().slice(0, 10));
      setTransDesc('');
      setPaymentMode('CASH');
      setAttachmentUrl(null);
      setEditingTransactionId(null);
      setShowMoreOptions(false);
      setCurrentView('TRANSACTION_FORM');
  };

  const handleEditTransaction = (t: Transaction) => {
      setTransType(t.type);
      setTransAmount(t.amount.toString());
      setTransDate(t.date); 
      setTransDesc(t.description || '');
      setAttachmentUrl(t.attachmentUrl || null);
      setEditingTransactionId(t.id);
      setCurrentView('TRANSACTION_FORM');
  };

  const handleSaveTransaction = () => {
      if (!selectedContact) return;
      
      const newTx: Transaction = {
          id: editingTransactionId || Math.random().toString(36).substr(2, 9),
          contactId: selectedContact.id,
          date: transDate,
          amount: parseFloat(transAmount) || 0,
          type: transType,
          description: transDesc,
          balanceAfter: selectedContact.balance + (transType === 'CREDIT' ? parseFloat(transAmount) : -parseFloat(transAmount)),
          hasAttachment: !!attachmentUrl,
          attachmentUrl
      };

      if (editingTransactionId) {
          setTransactions(transactions.map(t => t.id === editingTransactionId ? newTx : t));
      } else {
          setTransactions([newTx, ...transactions]);
      }
      
      let newBalance = selectedContact.balance;
      if (selectedContact.type === 'RENT') {
          newBalance = selectedContact.balance + (transType === 'PAYMENT' ? newTx.amount : -newTx.amount);
      } else {
          newBalance = selectedContact.balance + (transType === 'CREDIT' ? newTx.amount : -newTx.amount);
      }

      const updatedContact = { ...selectedContact, balance: newBalance, lastUpdated: new Date().toISOString().slice(0, 10) };
      setContacts(contacts.map(c => c.id === selectedContact.id ? updatedContact : c));
      setSelectedContact(updatedContact);

      setCurrentView('DETAIL');
  };

  const handleDeleteTransaction = () => {
      if (editingTransactionId) {
          setTransactions(transactions.filter(t => t.id !== editingTransactionId));
      }
      setCurrentView('DETAIL');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setIsUploading(true);
          setTimeout(() => {
              setAttachmentUrl('https://via.placeholder.com/150');
              setIsUploading(false);
          }, 1000);
      }
  };

  const handleDownloadReport = () => {
      alert("Download PDF Feature");
  };

  const handleStartNewMonth = () => {
      alert("Starting New Month...");
  };

  // --- RENDER: DASHBOARD VIEW ---
  if (currentView === 'DASHBOARD') {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
             <header className="bg-white px-4 py-3 pb-0 shadow-sm z-20">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h1 className="text-xl font-bold text-slate-800">Manage Credit</h1>
                    <div className="flex items-center text-slate-600 text-sm gap-1">
                      <span className="font-semibold">{shopName}</span>
                      <ChevronDown size={14} />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button className="flex flex-col items-center gap-0.5 text-blue-600">
                        <PlayCircle size={20} />
                        <span className="text-[10px] font-medium">Demo</span>
                    </button>
                    <button className="flex flex-col items-center gap-0.5 text-blue-600">
                        <CalendarClock size={20} />
                        <span className="text-[10px] font-medium">Reminders</span>
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-6 mt-4">
                   <button 
                     onClick={() => setActiveTab('CUSTOMER')}
                     className={`flex items-center gap-2 pb-3 border-b-2 transition-colors font-medium ${activeTab === 'CUSTOMER' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500'}`}
                   >
                     <Users size={18} />
                     Customers
                   </button>
                   <button 
                     onClick={() => setActiveTab('SUPPLIER')}
                     className={`flex items-center gap-2 pb-3 border-b-2 transition-colors font-medium ${activeTab === 'SUPPLIER' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500'}`}
                   >
                     <Truck size={18} />
                     Suppliers
                   </button>
                   <button 
                     onClick={() => setActiveTab('RENT')}
                     className={`flex items-center gap-2 pb-3 border-b-2 transition-colors font-medium ${activeTab === 'RENT' ? 'border-slate-800 text-slate-800' : 'border-transparent text-gray-500'}`}
                   >
                     <Building size={18} />
                     Rent/Targets
                   </button>
                </div>
            </header>

            <div className="p-4 flex flex-col gap-4">
                {/* Summary Cards */}
                {activeTab === 'SUPPLIER' && (
                    <div className="flex gap-3">
                        <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-xs text-slate-600">Supplier holds</p>
                            <p className="text-lg font-bold text-green-700">Rs. 0</p>
                        </div>
                        <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-xs text-slate-600">To pay</p>
                            <p className="text-lg font-bold text-red-700">Rs. {totals.supplierTotal.toLocaleString()}</p>
                        </div>
                    </div>
                )}
                
                {activeTab === 'CUSTOMER' && (
                    <div className="flex gap-3">
                         <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-xs text-slate-600">Advance</p>
                            <p className="text-lg font-bold text-green-700">Rs. {totals.customerAdvance.toLocaleString()}</p>
                        </div>
                        <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-xs text-slate-600">To Collect</p>
                            <p className="text-lg font-bold text-green-700">Rs. {totals.customerToCollect.toLocaleString()}</p>
                        </div>
                    </div>
                )}

                {activeTab === 'RENT' && (
                    <div className="flex gap-3">
                         <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs text-slate-600">Total Saved</p>
                            <p className="text-lg font-bold text-blue-700">Rs. {totals.rentSaved.toLocaleString()}</p>
                        </div>
                        <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <p className="text-xs text-slate-600">Remaining</p>
                            <p className="text-lg font-bold text-orange-700">Rs. {totals.rentRemaining.toLocaleString()}</p>
                        </div>
                    </div>
                )}

                {/* Search */}
                <div className="flex gap-2">
                    <div className="flex-1 bg-gray-100 rounded-lg px-3 py-2.5 flex items-center">
                        <Search size={18} className="text-gray-400 mr-2" />
                        <input type="text" placeholder="Search name or number here" className="bg-transparent outline-none text-sm w-full" />
                    </div>
                    <button className="bg-blue-50 text-blue-600 p-2.5 rounded-lg border border-blue-100">
                        <Filter size={20} />
                    </button>
                </div>

                {/* List Header */}
                <div className="flex justify-between items-center px-1">
                    <span className="text-xs font-bold text-gray-400">{filteredContacts.length} {activeTab === 'SUPPLIER' ? 'Suppliers' : activeTab === 'CUSTOMER' ? 'Customers' : 'Targets'}</span>
                    <span className="text-xs font-bold text-gray-400">Amount (Rs.)</span>
                </div>

                {/* Contact List */}
                <div className="flex flex-col gap-3">
                    {filteredContacts.map(contact => (
                        <div 
                            key={contact.id} 
                            onClick={() => openContact(contact)} 
                            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between active:bg-gray-50 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-medium text-lg ${contact.type === 'RENT' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}>
                                    {contact.type === 'RENT' ? <Target size={20} /> : contact.name.substring(0, 1)}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800 text-base">{contact.name}</h3>
                                    {contact.type === 'RENT' ? (
                                        <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                            <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (contact.balance / (contact.targetAmount || 1)) * 100)}%` }}></div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400">{contact.phone}</p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 mb-0.5">
                                    {activeTab === 'SUPPLIER' ? 'To pay' : activeTab === 'CUSTOMER' ? 'To Collect' : 'Saved'}
                                </p>
                                <p className={`font-bold text-base ${activeTab === 'SUPPLIER' ? 'text-red-700' : activeTab === 'RENT' ? 'text-blue-600' : 'text-green-700'}`}>
                                    {contact.balance.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    ))}
                    
                    {filteredContacts.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            <p>No contacts found.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Button */}
            <div className="px-4 fixed bottom-20 left-0 right-0 z-20 pointer-events-none">
                <button 
                    onClick={() => {
                            // Quick add mock
                            const newId = Math.random().toString();
                            setContacts([...contacts, { id: newId, name: 'New Contact', phone: '', type: activeTab, balance: 0, lastUpdated: new Date().toISOString().slice(0, 10) }]);
                    }}
                    className={`w-full ${theme.primary} text-white font-semibold py-3.5 rounded-lg shadow-lg pointer-events-auto active:scale-[0.98] transition-transform`}
                >
                    Add {activeTab === 'SUPPLIER' ? 'Supplier' : activeTab === 'CUSTOMER' ? 'Customer' : 'Target'}
                </button>
            </div>

            <BottomNav 
                currentView={currentView} 
                onNavigate={handleNavigate} 
                activeTheme={appTheme}
            />
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
    const totalCredit = reportTransactions
        .filter(t => t.type === 'CREDIT')
        .reduce((sum, t) => sum + t.amount, 0);
    const totalPayment = reportTransactions
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
                {/* Date Filter */}
                <div className="flex gap-2 mb-4">
                    <div className="relative flex-1">
                        <div className="bg-white rounded-lg p-3 flex items-center justify-between shadow-sm border border-gray-100 h-12">
                            <div className="flex items-center gap-2 text-slate-600">
                                <Calendar size={18} />
                                <span className="text-sm font-medium">{formattedReportMonth}</span>
                            </div>
                            <ChevronDown size={16} className="text-gray-400" />
                        </div>
                        {/* Invisible Month Input Overlay */}
                        <input 
                            type="month" 
                            value={reportMonth}
                            onChange={(e) => setReportMonth(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                        />
                    </div>
                    
                    {/* All Time Button */}
                    <button 
                        onClick={() => setReportMonth('')}
                        className={`px-4 rounded-lg font-medium text-sm border flex items-center gap-2 h-12 transition-colors ${!reportMonth ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-gray-200'}`}
                    >
                        <Filter size={16} />
                        All Time
                    </button>
                </div>

                {/* GRAPH SECTION */}
                <TrendChart transactions={reportTransactions} type={selectedContact.type} monthLabel={formattedReportMonth} />

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
                    {reportTransactions.map(t => (
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
                    {reportTransactions.length === 0 && (
                        <div className="p-6 text-center text-gray-400 text-sm">No transactions in {formattedReportMonth}</div>
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

  return null; // Fallback
}