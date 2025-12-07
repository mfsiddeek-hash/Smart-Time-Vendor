import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  BookText, Wallet, Receipt, UserCircle, Store, Phone, Pencil, Palette, 
  Check, Languages, ChevronRight, LogOut, ChevronLeft, Share2, Calendar, 
  ChevronDown, Filter, Download, Trash2, Calculator, FilePlus, Loader2, 
  Camera, Eye, Target, MoreVertical, RefreshCw, ArrowDown, ArrowUp, 
  Search, Plus, FileText, Users, Truck, Building, PlayCircle, CalendarClock,
  ArrowRight
} from 'lucide-react';
import jsPDF from 'jspdf';
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

// UUID Generator Polyfill
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  // App Settings
  const [appTheme, setAppTheme] = useState<ThemeColor>('blue');
  const [shopName, setShopName] = useState('Smart Time');
  const [shopPhone, setShopPhone] = useState('0771234567');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Report State
  const [reportStartDate, setReportStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [reportEndDate, setReportEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reportFilterType, setReportFilterType] = useState<'ALL' | 'CUSTOM'>('CUSTOM');

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

  // Load Data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      // Fetch Contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*');
        
      if (contactsError) {
          console.error('Error fetching contacts:', contactsError);
      } else if (contactsData) {
          const mappedContacts: Contact[] = contactsData.map((c: any) => ({
              id: c.id,
              name: c.name,
              phone: c.phone || '',
              type: c.type,
              balance: c.balance || 0,
              targetAmount: c.target_amount,
              startDate: c.start_date,
              endDate: c.end_date,
              lastUpdated: c.last_updated
          }));
          setContacts(mappedContacts);
      }

      // Fetch Transactions
      const { data: transData, error: transError } = await supabase
        .from('transactions')
        .select('*');

      if (transError) {
          console.error('Error fetching transactions:', transError);
      } else if (transData) {
          const mappedTrans: Transaction[] = transData.map((t: any) => ({
              id: t.id,
              contactId: t.contact_id,
              date: t.date,
              description: t.description,
              amount: t.amount,
              type: t.type,
              balanceAfter: t.balance_after,
              hasAttachment: t.has_attachment,
              attachmentUrl: t.attachment_url
          }));
          setTransactions(mappedTrans);
      }
    };

    fetchData();
  }, []);

  const getFormattedDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  
  const formattedReportRange = reportFilterType === 'ALL' 
    ? 'All Time' 
    : `${getFormattedDate(reportStartDate)} - ${getFormattedDate(reportEndDate)}`;

  const currentTransactions = useMemo(() => {
    if (!selectedContact) return [];
    return transactions.filter(t => t.contactId === selectedContact.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedContact]);

  const reportTransactions = useMemo(() => {
    if (!selectedContact) return [];
    let filtered = transactions.filter(t => t.contactId === selectedContact.id);
    
    if (reportFilterType === 'CUSTOM') {
       const start = new Date(reportStartDate);
       const end = new Date(reportEndDate);
       end.setHours(23, 59, 59, 999); // Include full end day

       filtered = filtered.filter(t => {
           const tDate = new Date(t.date);
           return tDate >= start && tDate <= end;
       });
    }
    
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedContact, reportFilterType, reportStartDate, reportEndDate]);

  const filteredContacts = useMemo(() => {
      return contacts.filter(c => {
          const matchesType = c.type === activeTab;
          const query = searchQuery.toLowerCase().trim();
          const matchesSearch = !query || 
             c.name.toLowerCase().includes(query) || 
             c.phone.toLowerCase().includes(query);
          return matchesType && matchesSearch;
      });
  }, [contacts, activeTab, searchQuery]);

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

  const handleUpdateContact = async () => {
      if (!selectedContact) return;
      
      const updates = {
          name: newContactName,
          phone: newContactPhone,
          target_amount: selectedContact.type === 'RENT' ? parseFloat(newContactTarget) : null,
          start_date: newContactStartDate || null,
          end_date: newContactEndDate || null,
          last_updated: new Date().toISOString()
      };

      const { error } = await supabase.from('contacts').update(updates).eq('id', selectedContact.id);

      if (error) {
          console.error("Error updating contact:", error);
          alert(`Failed to update contact: ${error.message}`);
          return;
      }

      const updated: Contact = {
          ...selectedContact,
          name: newContactName,
          phone: newContactPhone,
          targetAmount: selectedContact.type === 'RENT' ? parseFloat(newContactTarget) : undefined,
          startDate: newContactStartDate,
          endDate: newContactEndDate,
          lastUpdated: updates.last_updated
      };
      setContacts(contacts.map(c => c.id === selectedContact.id ? updated : c));
      setSelectedContact(updated);
      setCurrentView('DETAIL');
  };

  const handleDeleteContact = async () => {
      if (!selectedContact) return;
      
      const { error } = await supabase.from('contacts').delete().eq('id', selectedContact.id);
      
      if (error) {
          console.error("Error deleting contact:", error);
          alert(`Failed to delete contact: ${error.message}`);
          return;
      }

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

  const handleSaveTransaction = async () => {
      if (!selectedContact) return;
      
      const amountVal = parseFloat(transAmount) || 0;
      
      // Basic balance calculation logic
      // Rent: Payment (Deposit) increases balance. Credit (Withdraw) decreases balance.
      // Supplier/Customer: Credit increases Owed. Payment decreases Owed.
      
      // If Editing: Revert old transaction effect first
      let currentBalance = selectedContact.balance;
      
      if (editingTransactionId) {
          const oldTx = transactions.find(t => t.id === editingTransactionId);
          if (oldTx) {
               if (selectedContact.type === 'RENT') {
                   currentBalance = oldTx.type === 'PAYMENT' ? currentBalance - oldTx.amount : currentBalance + oldTx.amount;
               } else {
                   currentBalance = oldTx.type === 'CREDIT' ? currentBalance - oldTx.amount : currentBalance + oldTx.amount;
               }
          }
      }

      // Apply new transaction effect
      let newBalance = currentBalance;
      if (selectedContact.type === 'RENT') {
          newBalance = transType === 'PAYMENT' ? newBalance + amountVal : newBalance - amountVal;
      } else {
          newBalance = transType === 'CREDIT' ? newBalance + amountVal : newBalance - amountVal;
      }

      const txPayload = {
          contact_id: selectedContact.id,
          date: transDate,
          amount: amountVal,
          type: transType,
          description: transDesc,
          balance_after: newBalance,
          has_attachment: !!attachmentUrl,
          attachment_url: attachmentUrl
      };

      let savedTx: Transaction | null = null;

      if (editingTransactionId) {
          const { data, error } = await supabase
            .from('transactions')
            .update(txPayload)
            .eq('id', editingTransactionId)
            .select();
            
          if (error || !data) {
              console.error("Error updating transaction", error);
              alert(`Error updating transaction: ${error?.message}`);
              return;
          }
          savedTx = {
              id: data[0].id,
              contactId: data[0].contact_id,
              date: data[0].date,
              description: data[0].description,
              amount: data[0].amount,
              type: data[0].type,
              balanceAfter: data[0].balance_after,
              hasAttachment: data[0].has_attachment,
              attachmentUrl: data[0].attachment_url
          };
      } else {
          const { data, error } = await supabase
            .from('transactions')
            .insert([txPayload])
            .select();
            
          if (error || !data) {
              console.error("Error creating transaction", error);
              alert(`Error creating transaction: ${error?.message}`);
              return;
          }
           savedTx = {
              id: data[0].id,
              contactId: data[0].contact_id,
              date: data[0].date,
              description: data[0].description,
              amount: data[0].amount,
              type: data[0].type,
              balanceAfter: data[0].balance_after,
              hasAttachment: data[0].has_attachment,
              attachmentUrl: data[0].attachment_url
          };
      }

      // Update Contact Balance
      const { error: contactError } = await supabase
        .from('contacts')
        .update({ balance: newBalance, last_updated: new Date().toISOString() })
        .eq('id', selectedContact.id);

      if (contactError) {
          console.error("Error updating balance", contactError);
          alert(`Warning: Transaction saved but balance update failed: ${contactError.message}`);
      }

      // Update Local State
      if (editingTransactionId) {
          setTransactions(transactions.map(t => t.id === editingTransactionId ? savedTx! : t));
      } else {
          setTransactions([savedTx!, ...transactions]);
      }
      
      const updatedContact = { ...selectedContact, balance: newBalance, lastUpdated: new Date().toISOString().slice(0, 10) };
      setContacts(contacts.map(c => c.id === selectedContact.id ? updatedContact : c));
      setSelectedContact(updatedContact);

      setCurrentView('DETAIL');
  };

  const handleDeleteTransaction = async () => {
      if (!editingTransactionId || !selectedContact) return;

      const txToDelete = transactions.find(t => t.id === editingTransactionId);
      if (!txToDelete) return;

      // Revert balance
      let newBalance = selectedContact.balance;
       if (selectedContact.type === 'RENT') {
           newBalance = txToDelete.type === 'PAYMENT' ? newBalance - txToDelete.amount : newBalance + txToDelete.amount;
       } else {
           newBalance = txToDelete.type === 'CREDIT' ? newBalance - txToDelete.amount : newBalance + txToDelete.amount;
       }

      // DB Delete
      const { error } = await supabase.from('transactions').delete().eq('id', editingTransactionId);
      if (error) {
          console.error("Error deleting transaction", error);
          alert(`Error deleting transaction: ${error.message}`);
          return;
      }

      // DB Update Contact
      await supabase.from('contacts').update({ balance: newBalance }).eq('id', selectedContact.id);

      // Local Update
      setTransactions(transactions.filter(t => t.id !== editingTransactionId));
      const updatedContact = { ...selectedContact, balance: newBalance };
      setContacts(contacts.map(c => c.id === selectedContact.id ? updatedContact : c));
      setSelectedContact(updatedContact);
      
      setCurrentView('DETAIL');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setIsUploading(true);
          // In a real app, upload to Supabase Storage here.
          // For now, we simulate a URL.
          setTimeout(() => {
              setAttachmentUrl('https://via.placeholder.com/150');
              setIsUploading(false);
          }, 1000);
      }
  };

  const handleDownloadReport = () => {
      if (!selectedContact) return;

      try {
        const doc = new jsPDF();

        // --- Header ---
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40); // Dark Gray
        doc.text(shopName || 'Credit Ledger', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(shopPhone || '', 14, 26);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);

        // --- Recipient Info ---
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text(`Statement for: ${selectedContact.name}`, 14, 45);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Phone: ${selectedContact.phone}`, 14, 50);
        doc.text(`Period: ${formattedReportRange}`, 14, 55);

        // --- Summary Box (Right Side) ---
        const totalCredit = reportTransactions
            .filter(t => t.type === 'CREDIT')
            .reduce((sum, t) => sum + t.amount, 0);
        const totalPayment = reportTransactions
            .filter(t => t.type === 'PAYMENT')
            .reduce((sum, t) => sum + t.amount, 0);

        doc.setFontSize(10);
        doc.text('Total Credit:', 140, 45);
        doc.text(`Rs. ${totalCredit.toLocaleString()}`, 195, 45, { align: 'right' });
        
        doc.text('Total Paid:', 140, 50);
        doc.text(`Rs. ${totalPayment.toLocaleString()}`, 195, 50, { align: 'right' });
        
        doc.setLineWidth(0.5);
        doc.line(140, 53, 195, 53);
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text('Balance:', 140, 60);
        doc.text(`Rs. ${selectedContact.balance.toLocaleString()}`, 195, 60, { align: 'right' });
        doc.setFont("helvetica", "normal");

        // --- Table ---
        const tableColumn = ["Date", "Description", "Type", "Credit", "Payment"];
        const tableRows = reportTransactions.map(t => {
           return [
              t.date,
              t.description || '',
              t.type,
              t.type === 'CREDIT' ? t.amount.toLocaleString() : '-',
              t.type === 'PAYMENT' ? t.amount.toLocaleString() : '-',
           ];
        });

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 70,
          theme: 'grid',
          headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255] },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
              3: { halign: 'right', textColor: [200, 0, 0] }, // Credit Red
              4: { halign: 'right', textColor: [0, 150, 0] }  // Payment Green
          }
        });

        // --- Footer ---
        const pageCount = doc.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, 195, 290, { align: 'right' });
            doc.text('Generated by Smart Credit Ledger', 14, 290);
        }

        doc.save(`Statement_${selectedContact.name.replace(/\s+/g, '_')}.pdf`);
      } catch (err) {
        console.error("PDF generation error:", err);
        alert("Failed to generate PDF. Please ensure all libraries are loaded.");
      }
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
                        <input 
                          type="text" 
                          placeholder="Search name or number here" 
                          className="bg-transparent outline-none text-sm w-full" 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
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
                    onClick={async () => {
                            // Quick add to Supabase
                            const newId = generateUUID();
                            const newContactPayload = {
                                id: newId,
                                name: 'New Contact',
                                phone: '',
                                type: activeTab,
                                balance: 0,
                                target_amount: 0, // Ensure field exists
                                start_date: null,
                                end_date: null,
                                last_updated: new Date().toISOString()
                            };

                            const { data, error } = await supabase.from('contacts').insert([newContactPayload]).select();
                            
                            if (error) {
                                console.error("Error creating contact", error);
                                alert(`Error creating contact: ${error.message || JSON.stringify(error)}`);
                                return;
                            }

                            if (data && data[0]) {
                                const c = data[0];
                                const newContact: Contact = {
                                    id: c.id,
                                    name: c.name,
                                    phone: c.phone || '',
                                    type: c.type,
                                    balance: c.balance,
                                    lastUpdated: c.last_updated
                                };
                                setContacts([...contacts, newContact]);
                            }
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
// ... rest of the file remains same
