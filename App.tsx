import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Truck, 
  Search, 
  BarChart3, 
  ChevronLeft, 
  MoreVertical, 
  Pencil, 
  PlayCircle,
  CalendarClock,
  ArrowDown,
  ArrowUp,
  X,
  Calculator,
  ChevronDown,
  ChevronRight,
  Camera,
  FilePlus,
  Trash2
} from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { TransactionRow } from './components/TransactionRow';
import { Contact, Transaction, ContactType, TransactionType } from './types';
import { MOCK_CONTACTS, MOCK_TRANSACTIONS } from './constants';

type ViewState = 'DASHBOARD' | 'DETAIL' | 'TRANSACTION_FORM';

function App() {
  // Core Data State
  const [contacts, setContacts] = useState<Contact[]>(MOCK_CONTACTS);
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);

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
  
  // Editing State
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [isEditingContact, setIsEditingContact] = useState(false);

  // Add/Edit Contact Modal State
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

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
    return transactions.filter(t => t.contactId === selectedContactId);
  }, [transactions, selectedContactId]);

  // Actions
  const handleContactClick = (id: string) => {
    setSelectedContactId(id);
    setCurrentView('DETAIL');
  };

  const handleBack = () => {
    if (currentView === 'TRANSACTION_FORM') {
      setCurrentView('DETAIL');
      setEditingTransactionId(null); // Reset editing state
    } else if (currentView === 'DETAIL') {
      setSelectedContactId(null);
      setCurrentView('DASHBOARD');
    }
  };

  const startTransaction = (type: TransactionType) => {
    setTransType(type);
    setTransAmount('');
    setTransDesc('');
    setTransDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('CASH');
    setEditingTransactionId(null); // Ensure we are in create mode
    setShowMoreOptions(type === 'CREDIT');
    setCurrentView('TRANSACTION_FORM');
  };

  const openAddContact = () => {
    setIsEditingContact(false);
    setNewContactName('');
    setNewContactPhone('');
    setShowContactModal(true);
  };

  const openEditContact = () => {
    if (!selectedContact) return;
    setIsEditingContact(true);
    setNewContactName(selectedContact.name);
    setNewContactPhone(selectedContact.phone);
    setShowContactModal(true);
  };

  const handleSaveContact = () => {
    if (!newContactName) return;

    if (isEditingContact && selectedContact) {
      // Update existing contact
      setContacts(contacts.map(c => 
        c.id === selectedContact.id 
          ? { ...c, name: newContactName, phone: newContactPhone }
          : c
      ));
    } else {
      // Add new contact
      const newContact: Contact = {
        id: Date.now().toString(),
        name: newContactName,
        phone: newContactPhone,
        type: activeTab,
        balance: 0,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      setContacts([...contacts, newContact]);
    }
    
    setNewContactName('');
    setNewContactPhone('');
    setShowContactModal(false);
  };

  const handleDeleteContact = () => {
    if (!selectedContact) return;
    if (confirm('Are you sure you want to delete this contact and all their transactions?')) {
      // Remove contact
      setContacts(contacts.filter(c => c.id !== selectedContact.id));
      // Remove associated transactions
      setTransactions(transactions.filter(t => t.contactId !== selectedContact.id));
      
      setShowContactModal(false);
      setSelectedContactId(null);
      setCurrentView('DASHBOARD');
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id);
    setTransType(transaction.type);
    setTransAmount(transaction.amount.toString());
    
    // Parse date for input (assuming stored as string or convert if needed)
    // The input[type=date] needs YYYY-MM-DD.
    // Our mock data is "6th Dec 2025" or similar, which is hard to parse back simply.
    // For this demo, we'll try to parse or default to today if format is complex.
    // Ideally, store ISO string in backend.
    
    // Attempting simple parse or fallback
    let isoDate = new Date().toISOString().split('T')[0];
    const parsedDate = new Date(transaction.date);
    if (!isNaN(parsedDate.getTime())) {
         isoDate = parsedDate.toISOString().split('T')[0];
    }
    setTransDate(isoDate);

    // Handle Description and Payment Mode
    let desc = transaction.description || '';
    if (transaction.type === 'PAYMENT' && desc.includes('(Bank)')) {
        setPaymentMode('BANK');
        desc = desc.replace(' (Bank)', '').replace('Bank Payment', '').trim();
    } else {
        setPaymentMode('CASH');
    }
    setTransDesc(desc);
    
    setShowMoreOptions(true);
    setCurrentView('TRANSACTION_FORM');
  };

  const handleDeleteTransaction = () => {
    if (!editingTransactionId || !selectedContact) return;

    if (confirm('Delete this transaction?')) {
        const transToDelete = transactions.find(t => t.id === editingTransactionId);
        if (!transToDelete) return;

        // Revert balance
        // If CREDIT (+), we subtract. If PAYMENT (-), we add.
        let reversionAmount = 0;
        if (transToDelete.type === 'CREDIT') {
            reversionAmount = -transToDelete.amount;
        } else {
            reversionAmount = transToDelete.amount;
        }
        
        const newBalance = selectedContact.balance + reversionAmount;

        // Update Transactions
        setTransactions(transactions.filter(t => t.id !== editingTransactionId));
        
        // Update Contact
        setContacts(contacts.map(c => 
            c.id === selectedContact.id 
              ? { ...c, balance: newBalance, lastUpdated: new Date().toISOString().split('T')[0] }
              : c
        ));

        handleBack();
    }
  }

  const handleSaveTransaction = () => {
    if (!selectedContact || !transAmount) return;
    
    const amountVal = parseFloat(transAmount);
    if (isNaN(amountVal)) return;

    // Helper to calculate effect of a transaction type on balance
    const getBalanceEffect = (type: TransactionType, amount: number) => {
        return type === 'CREDIT' ? amount : -amount;
    };

    let newBalance = selectedContact.balance;
    const dateObj = new Date(transDate);
    const dateStr = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    
    // Description formatting
    let finalDesc = transDesc;
    if (transType === 'PAYMENT' && paymentMode === 'BANK') {
       finalDesc = finalDesc ? `${finalDesc} (Bank)` : 'Bank Payment';
    }

    if (editingTransactionId) {
        // --- EDIT MODE ---
        const oldTransIndex = transactions.findIndex(t => t.id === editingTransactionId);
        if (oldTransIndex === -1) return;
        const oldTrans = transactions[oldTransIndex];

        // 1. Revert old transaction effect
        const oldEffect = getBalanceEffect(oldTrans.type, oldTrans.amount);
        newBalance -= oldEffect;

        // 2. Apply new transaction effect
        const newEffect = getBalanceEffect(transType, amountVal);
        newBalance += newEffect;

        // 3. Update Transaction Object
        const updatedTrans: Transaction = {
            ...oldTrans,
            date: dateStr,
            description: finalDesc,
            amount: amountVal,
            type: transType,
            balanceAfter: newBalance // Note: In a real ledger, subsequent transactions would also need re-calculation. For this simplified app, we update the contact's final balance but might leave intermediate "balanceAfter" slightly out of sync if editing historical data.
            // Ideally, we'd re-calculate the running balance for all transactions after this date. 
            // For simplicity here, we assume the user mainly cares about the final Contact Balance.
        };

        const newTransactions = [...transactions];
        newTransactions[oldTransIndex] = updatedTrans;
        setTransactions(newTransactions);

    } else {
        // --- CREATE MODE ---
        const effect = getBalanceEffect(transType, amountVal);
        newBalance += effect;

        const newTrans: Transaction = {
            id: Date.now().toString(),
            contactId: selectedContact.id,
            date: dateStr,
            description: finalDesc,
            amount: amountVal,
            type: transType,
            balanceAfter: newBalance,
            hasAttachment: false
        };
        setTransactions([newTrans, ...transactions]);
    }

    // Update Contact Balance
    setContacts(contacts.map(c => 
      c.id === selectedContact.id 
        ? { ...c, balance: newBalance, lastUpdated: new Date().toISOString().split('T')[0] }
        : c
    ));

    handleBack(); 
  };

  // Helper to get formatted date string for the form
  const getFormattedDate = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString; // Fallback
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

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
              <button className="p-2 bg-blue-50 rounded text-blue-600">
                <Calculator size={20} />
              </button>
            </div>
          </div>

          {/* Date Selector */}
          <div className="flex justify-end mt-2 mb-6">
            <div className="flex items-center gap-2 text-blue-600 bg-white py-1 px-2 rounded hover:bg-gray-50 cursor-pointer relative">
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

          {/* Payment Mode (Only for Payment) */}
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

          {/* Notes Input (Only for Payment - replaces the 'Add Item' row) */}
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
              className="flex items-center gap-2 text-blue-600 mb-4"
            >
              <span className="text-sm font-medium">More Options</span>
              {showMoreOptions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {/* Expanded Options */}
            {showMoreOptions && (
              <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
                {/* Add Item Row (Only for Credit) */}
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

                {/* Attach Bills Row (Common) */}
                <div className="border border-gray-300 rounded-lg p-3 flex items-center justify-between cursor-pointer active:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Camera size={20} className="text-gray-400" />
                    <span className="text-sm text-gray-400">Attach Bills</span>
                  </div>
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button Footer */}
        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleSaveTransaction}
            className={`w-full ${btnColor} text-white font-bold py-3.5 rounded-lg active:opacity-90 transition-opacity`}
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
        <header className="bg-white sticky top-0 z-30 shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-1">
              <ChevronLeft size={24} className="text-slate-800" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                {selectedContact.name.substring(0, 1)}
              </div>
              <h1 className="font-bold text-lg text-slate-800">{selectedContact.name}</h1>
              <button 
                onClick={openEditContact}
                className="text-gray-400 p-2 hover:bg-gray-100 rounded-full"
              >
                <Pencil size={16} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700">
              Reports
            </button>
            <button>
              <MoreVertical size={20} className="text-slate-700" />
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
            {isSupplier ? 'Pay Cash' : 'Receive Payment'}
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
              <span>Smart Time</span>
              <ChevronLeft size={16} className="-rotate-90" />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-0.5">
              <PlayCircle className="text-blue-600" size={22} />
              <span className="text-[10px] text-blue-600 font-medium">Demo</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <CalendarClock className="text-blue-600" size={22} />
              <span className="text-[10px] text-blue-600 font-medium">Reminders</span>
            </div>
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
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg shadow-md active:bg-blue-700 transition-colors"
        >
          Add {activeTab === 'SUPPLIER' ? 'Supplier' : 'Customer'}
        </button>
      </div>

      {/* Add/Edit Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">
                {isEditingContact ? `Edit ${activeTab === 'SUPPLIER' ? 'Supplier' : 'Customer'}` : `Add New ${activeTab === 'SUPPLIER' ? 'Supplier' : 'Customer'}`}
              </h3>
              <button onClick={() => setShowContactModal(false)}><X size={24} className="text-gray-400" /></button>
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
                onClick={handleSaveContact}
                className="mt-2 w-full bg-blue-600 text-white font-semibold py-3 rounded-lg active:bg-blue-700 transition-colors"
              >
                {isEditingContact ? 'Update Contact' : 'Save Contact'}
              </button>
              
              {isEditingContact && (
                <button 
                    onClick={handleDeleteContact}
                    className="w-full bg-white border border-red-200 text-red-600 font-semibold py-3 rounded-lg active:bg-red-50 transition-colors"
                >
                    Delete Contact
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Spacer for Bottom Nav */}
      <div className="h-4"></div>

      <BottomNav />
    </div>
  );
}

export default App;