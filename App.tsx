import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  BookText, Wallet, Receipt, UserCircle, Store, Phone, Pencil, Palette, 
  Check, Languages, ChevronRight, LogOut, ChevronLeft, Share2, Calendar, 
  ChevronDown, Filter, Download, Trash2, Calculator, FilePlus, Loader2, 
  Camera, Eye, Target, MoreVertical, RefreshCw, ArrowDown, ArrowUp, 
  Search, Plus, FileText, Users, Truck, Building, PlayCircle, CalendarClock,
  ArrowRight, Database, AlertCircle, History, TrendingUp, TrendingDown, Settings, ShieldAlert, X,
  RotateCcw, Wrench, Smartphone, Printer
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

const normalizeToLocalMidnight = (dateString: string | null | undefined) => {
  if (!dateString) return new Date();
  
  const match = dateString.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = parseInt(match[1]);
    const m = parseInt(match[2]);
    const d = parseInt(match[3]);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  
  const parsed = new Date(dateString);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
  }
  
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

const formatDisplayDate = (dStr: string | null | undefined) => {
  if (!dStr) return '-';
  const parts = dStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts) {
    const y = parseInt(parts[1]);
    const m = parseInt(parts[2]) - 1;
    const d = parseInt(parts[3]);
    const dateObj = new Date(y, m, d);
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return dStr;
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

  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPhoneModel, setAddPhoneModel] = useState('');
  const [addTotalCost, setAddTotalCost] = useState('');
  const [addAdvancePayment, setAddAdvancePayment] = useState('');
  const [addOrderDate, setAddOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [addAdvanceDate, setAddAdvanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [addServiceStatus, setAddServiceStatus] = useState('Pending');
  const [targetAmount, setTargetAmount] = useState('30000');
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transType, setTransType] = useState<TransactionType>('CREDIT');
  const [transAmount, setTransAmount] = useState('');
  const [transDate, setTransDate] = useState(new Date().toISOString().slice(0, 10));
  const [transDesc, setTransDesc] = useState('');

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportRange, setReportRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10)
  });
  const [reportTarget, setReportTarget] = useState<'CATEGORY' | 'CONTACT'>('CATEGORY');

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewServiceOrder, setPreviewServiceOrder] = useState<Contact | null>(null);
  const [printMenuContactId, setPrintMenuContactId] = useState<string | null>(null);
  const [previewFormat, setPreviewFormat] = useState<'POS' | 'A4'>('POS');

  const dateInputRef = useRef<HTMLInputElement>(null);
  const orderDateInputRef = useRef<HTMLInputElement>(null);
  const advanceDateInputRef = useRef<HTMLInputElement>(null);

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
        s.balance = s.totalPayment - s.totalCredit;
      } else {
        s.balance = s.totalCredit - s.totalPayment;
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
        
        return { name: c.name, phone: c.phone || '-', paid, credit, bal };
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
      alert("Failed to generate PDF report.");
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
      doc.text(`Statement for: ${contact.name}${contact.phoneModel ? ' (' + contact.phoneModel + ')' : ''}`, 14, 30);
      doc.setFontSize(10);
      doc.text(`Period: ${reportRange.start} to ${reportRange.end} | Generated: ${timestamp}`, 14, 38);
      
      const start = normalizeToLocalMidnight(reportRange.start);
      const end = normalizeToLocalMidnight(reportRange.end);
      end.setHours(23, 59, 59, 999);

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
        .sort((a,b) => {
          const timeA = new Date(a.date).getTime();
          const timeB = new Date(b.date).getTime();
          if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeA - timeB;
          if (a.type === b.type) return 0;
          return a.type === 'CREDIT' ? -1 : 1;
        });
      
      let runningBal = openingBalance;
      const tableRows = contactTransactions.map(t => {
        if (isRent) { runningBal += (t.type === 'PAYMENT' ? t.amount : -t.amount); }
        else { runningBal += (t.type === 'CREDIT' ? t.amount : -t.amount); }
        const typeLabel = t.type === 'PAYMENT' ? (isRent ? 'Deposit' : 'Paid') : (isRent ? 'Withdraw' : 'Credit');
        return [t.date, t.description || '-', typeLabel, `LKR ${t.amount.toLocaleString()}`, `LKR ${runningBal.toLocaleString()}`];
      });

      tableRows.unshift([reportRange.start, 'Opening Balance', '-', '-', `LKR ${openingBalance.toLocaleString()}`]);

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
      alert("Failed to generate statement.");
    }
  };

  const generateServicePDF = (contact: Contact, format: 'POS' | 'A4', action: 'download' | 'print' = 'download') => {
    try {
      const stats = contactStats[contact.id];
      const totalCost = stats?.totalCredit || contact.targetAmount || contact.totalCost || 0;
      
      const contactTransactions = transactions
        .filter(t => t.contactId === contact.id)
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const paymentTransactions = contactTransactions.filter(t => t.type === 'PAYMENT');
      const paymentsToRender = paymentTransactions.length > 0
        ? paymentTransactions.map(p => ({
            id: p.id,
            date: p.date,
            desc: p.description || 'Payment Received',
            amount: p.amount
          }))
        : ((contact.advancePayment || 0) > 0 ? [{
            id: 'init-adv',
            date: contact.advanceDate || (contact.lastUpdated ? contact.lastUpdated.slice(0, 10) : new Date().toISOString().slice(0, 10)),
            desc: 'Advance Payment',
            amount: contact.advancePayment || 0
          }] : []);

      const totalPaid = paymentsToRender.reduce((sum, p) => sum + p.amount, 0);
      const balanceDue = totalCost - totalPaid;
      const orderNo = `SO-${contact.id.slice(0, 6).toUpperCase()}`;
      const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (format === 'POS') {
        const dynamicHeight = Math.max(160, 130 + (paymentsToRender.length * 6) + 35);
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [80, dynamicHeight]
        });

        let y = 10;
        doc.setFont('courier', 'bold');
        doc.setFontSize(13);
        doc.text(shopName.toUpperCase(), 40, y, { align: 'center' });

        y += 5;
        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        doc.text('MOBILE PHONE REPAIR & SERVICE', 40, y, { align: 'center' });

        y += 4;
        doc.text('Smart Time Service Center', 40, y, { align: 'center' });

        y += 4;
        doc.text('------------------------------------------', 40, y, { align: 'center' });

        y += 4;
        doc.setFont('courier', 'bold');
        doc.setFontSize(9);
        doc.text('SERVICE ORDER RECEIPT', 40, y, { align: 'center' });

        y += 5;
        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        doc.text(`Order No : #${orderNo}`, 6, y);
        y += 4.5;
        doc.text(`Date     : ${dateStr} ${timeStr}`, 6, y);
        y += 4.5;
        doc.text(`Customer : ${contact.name}`, 6, y);
        y += 4.5;
        doc.text(`Phone    : ${contact.phone || '-'}`, 6, y);
        y += 4.5;
        doc.text(`Device   : ${contact.phoneModel || '-'}`, 6, y);
        y += 4.5;
        doc.text(`Status   : ${(contact.serviceStatus || 'Pending').toUpperCase()}`, 6, y);

        y += 4;
        doc.text('------------------------------------------', 40, y, { align: 'center' });

        y += 4.5;
        doc.setFont('courier', 'bold');
        doc.setFontSize(8.5);
        doc.text('TOTAL REPAIR COST :', 6, y);
        doc.text(`LKR ${totalCost.toLocaleString()}`, 74, y, { align: 'right' });

        y += 4;
        doc.text('------------------------------------------', 40, y, { align: 'center' });
        y += 4;
        doc.setFont('courier', 'bold');
        doc.setFontSize(8.5);
        doc.text('PAYMENT HISTORY (WITH DATE)', 40, y, { align: 'center' });
        y += 3.5;
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.5);

        if (paymentsToRender.length === 0) {
          y += 3.5;
          doc.text('No payments recorded yet', 40, y, { align: 'center' });
        } else {
          paymentsToRender.forEach(p => {
            y += 4.2;
            const pDate = formatDisplayDate(p.date);
            const desc = (p.desc || 'Payment').slice(0, 16);
            doc.text(`${pDate} ${desc}`, 6, y);
            doc.text(`LKR ${p.amount.toLocaleString()}`, 74, y, { align: 'right' });
          });
        }

        y += 4;
        doc.text('------------------------------------------', 40, y, { align: 'center' });
        y += 4.5;
        doc.text('Total Paid to Date :', 6, y);
        doc.text(`LKR ${totalPaid.toLocaleString()}`, 74, y, { align: 'right' });

        y += 4;
        doc.text('------------------------------------------', 40, y, { align: 'center' });

        y += 5;
        doc.setFont('courier', 'bold');
        doc.setFontSize(10);
        doc.text('BALANCE DUE  :', 6, y);
        doc.text(`LKR ${Math.abs(balanceDue).toLocaleString()}`, 74, y, { align: 'right' });

        y += 6;
        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.text('------------------------------------------', 40, y, { align: 'center' });
        y += 4;
        doc.text('* Please present this receipt upon pickup', 40, y, { align: 'center' });
        y += 3.5;
        doc.text('* Repaired devices kept up to 30 days', 40, y, { align: 'center' });
        y += 4;
        doc.text('*** THANK YOU FOR YOUR BUSINESS! ***', 40, y, { align: 'center' });

        const safeName = `POS_${orderNo}_${contact.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        if (action === 'print') {
          doc.autoPrint();
          const blobUrl = doc.output('bloburl');
          window.open(blobUrl, '_blank');
        } else {
          doc.save(safeName);
        }
      } else {
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // Top Header
        doc.setFillColor(30, 41, 59); // slate-800
        doc.rect(0, 0, 210, 28, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(shopName.toUpperCase(), 14, 15);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('MOBILE PHONE REPAIR & SERVICE INVOICE', 14, 22);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`JOB NO: #${orderNo}`, 196, 15, { align: 'right' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`Date: ${dateStr}`, 196, 22, { align: 'right' });

        // Customer & Device Box
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Customer Information', 14, 38);
        doc.text('Device & Service Details', 115, 38);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Customer Name : ${contact.name}`, 14, 46);
        doc.text(`Contact Phone : ${contact.phone || 'N/A'}`, 14, 53);
        doc.text(`Service Type  : Walk-in Repair Order`, 14, 60);

        doc.text(`Phone Model   : ${contact.phoneModel || 'N/A'}`, 115, 46);
        doc.text(`Repair Status : ${(contact.serviceStatus || 'Pending').toUpperCase()}`, 115, 53);
        doc.text(`Receipt Time  : ${timeStr}`, 115, 60);

        // Table 1: Service Charge
        autoTable(doc, {
          startY: 68,
          head: [['#', 'Item / Service Description', 'Device / Model', 'Status', 'Total Charge (LKR)']],
          body: [
            ['1', 'Device Service & Repair Charge', contact.phoneModel || '-', contact.serviceStatus || 'Pending', `LKR ${totalCost.toLocaleString()}`],
          ],
          theme: 'striped',
          headStyles: { fillColor: [51, 65, 85], fontStyle: 'bold' },
          styles: { fontSize: 10, cellPadding: 4 },
          columnStyles: {
            0: { cellWidth: 12 },
            1: { cellWidth: 70 },
            2: { cellWidth: 48 },
            3: { cellWidth: 32 },
            4: { cellWidth: 34, halign: 'right' }
          }
        });

        const table1FinalY = (doc as any).lastAutoTable?.finalY || 85;

        // Payment History Section Heading
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Payment History & Receipts (With Dates)', 14, table1FinalY + 8);

        const paymentRows = paymentsToRender.length > 0
          ? paymentsToRender.map((p, idx) => [
              (idx + 1).toString(),
              formatDisplayDate(p.date),
              p.desc || 'Payment Received',
              'Confirmed',
              `LKR ${p.amount.toLocaleString()}`
            ])
          : [['-', '-', 'No payment records found', 'Pending', 'LKR 0']];

        // Table 2: Payment History
        autoTable(doc, {
          startY: table1FinalY + 11,
          head: [['#', 'Payment Date', 'Payment Description / Note', 'Status', 'Amount Paid (LKR)']],
          body: paymentRows,
          theme: 'striped',
          headStyles: { fillColor: [15, 118, 110], fontStyle: 'bold' },
          styles: { fontSize: 9.5, cellPadding: 3.5 },
          columnStyles: {
            0: { cellWidth: 12 },
            1: { cellWidth: 35 },
            2: { cellWidth: 80 },
            3: { cellWidth: 32 },
            4: { cellWidth: 37, halign: 'right' }
          }
        });

        const finalY = (doc as any).lastAutoTable?.finalY || (table1FinalY + 35);

        // Balance Summary Box
        const boxY = finalY + 8;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(120, boxY, 76, 32, 2, 2, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(120, boxY, 76, 32, 2, 2, 'D');

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Total Service Cost:', 125, boxY + 8);
        doc.text(`LKR ${totalCost.toLocaleString()}`, 190, boxY + 8, { align: 'right' });

        doc.text('Total Paid to Date:', 125, boxY + 15);
        doc.text(`LKR ${totalPaid.toLocaleString()}`, 190, boxY + 15, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(balanceDue > 0 ? 185 : 21, balanceDue > 0 ? 28 : 128, balanceDue > 0 ? 28 : 61);
        doc.text('BALANCE DUE:', 125, boxY + 25);
        doc.text(`LKR ${Math.abs(balanceDue).toLocaleString()}`, 190, boxY + 25, { align: 'right' });

        // Terms and Signatures
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('TERMS & CONDITIONS:', 14, boxY + 45);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('1. Please produce this receipt when collecting your repaired device.', 14, boxY + 51);
        doc.text('2. Repaired items not claimed within 30 days are subject to storage charges.', 14, boxY + 56);
        doc.text('3. Warranty applies exclusively to parts replaced during this repair.', 14, boxY + 61);

        doc.setDrawColor(203, 213, 225);
        doc.line(14, boxY + 85, 75, boxY + 85);
        doc.text('Customer Signature', 14, boxY + 90);

        doc.line(135, boxY + 85, 196, boxY + 85);
        doc.text('Authorized Store Signature', 135, boxY + 90);

        const safeName = `Invoice_${orderNo}_${contact.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        if (action === 'print') {
          doc.autoPrint();
          const blobUrl = doc.output('bloburl');
          window.open(blobUrl, '_blank');
        } else {
          doc.save(safeName);
        }
      }
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const openPreview = (contact: Contact, initialFormat: 'POS' | 'A4' = 'POS') => {
    setPreviewServiceOrder(contact);
    setPreviewFormat(initialFormat);
    setIsPreviewModalOpen(true);
    setPrintMenuContactId(null);
  };

  const handleEditServiceOrder = (contact: Contact) => {
    setEditingContact(contact);
    setAddName(contact.name);
    setAddPhone(contact.phone || '');
    setAddPhoneModel(contact.phoneModel || '');
    const stats = contactStats[contact.id];
    const cost = contact.totalCost || contact.targetAmount || stats?.totalCredit || '';
    const adv = contact.advancePayment || stats?.totalPayment || '';
    setAddTotalCost(cost ? cost.toString() : '');
    setAddAdvancePayment(adv ? adv.toString() : '');
    setAddServiceStatus(contact.serviceStatus || 'Pending');
    setTargetAmount(contact.targetAmount?.toString() || '30000');

    const costTx = transactions.find(t => t.contactId === contact.id && t.description === 'Service Total Cost');
    setAddOrderDate(costTx?.date || contact.orderDate || new Date().toISOString().slice(0, 10));

    const advTx = transactions.find(t => t.contactId === contact.id && t.description === 'Advance Payment');
    setAddAdvanceDate(advTx?.date || contact.advanceDate || new Date().toISOString().slice(0, 10));

    navigateTo('CONTACT_FORM');
  };

  const renderPreviewModal = () => {
    if (!isPreviewModalOpen || !previewServiceOrder) return null;
    const stats = contactStats[previewServiceOrder.id];
    const totalCost = stats?.totalCredit || previewServiceOrder.targetAmount || previewServiceOrder.totalCost || 0;
    
    const contactTransactions = transactions
      .filter(t => t.contactId === previewServiceOrder.id)
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const paymentTransactions = contactTransactions.filter(t => t.type === 'PAYMENT');
    const paymentsToRender = paymentTransactions.length > 0
      ? paymentTransactions.map(p => ({
          id: p.id,
          date: p.date,
          desc: p.description || 'Payment Received',
          amount: p.amount
        }))
      : ((previewServiceOrder.advancePayment || 0) > 0 ? [{
          id: 'init-adv',
          date: previewServiceOrder.advanceDate || (previewServiceOrder.lastUpdated ? previewServiceOrder.lastUpdated.slice(0, 10) : new Date().toISOString().slice(0, 10)),
          desc: 'Advance Payment',
          amount: previewServiceOrder.advancePayment || 0
        }] : []);

    const totalPaid = paymentsToRender.reduce((sum, p) => sum + p.amount, 0);
    const balanceDue = totalCost - totalPaid;
    const orderNo = `SO-${previewServiceOrder.id.slice(0, 6).toUpperCase()}`;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <div className="fixed inset-0 bg-black/70 z-[110] flex items-center justify-center p-3 sm:p-5 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-slate-100 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] border border-slate-200">
          {/* Header */}
          <div className="bg-white px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-lg">Service Order Preview</h3>
                <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                  #{orderNo}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">{previewServiceOrder.name} • {previewServiceOrder.phoneModel || 'Device'}</p>
            </div>
            <button 
              onClick={() => setIsPreviewModalOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Format Switcher Tabs */}
          <div className="bg-white px-5 py-2.5 border-b border-slate-200 flex gap-2 shrink-0">
            <button
              onClick={() => setPreviewFormat('POS')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                previewFormat === 'POS'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Receipt size={15} /> POS Thermal (80mm)
            </button>
            <button
              onClick={() => setPreviewFormat('A4')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                previewFormat === 'A4'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText size={15} /> A4 Invoice PDF
            </button>
          </div>

          {/* Scrollable Preview Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex justify-center items-start bg-slate-200/70">
            {previewFormat === 'POS' ? (
              /* POS 80mm Receipt Style */
              <div className="w-full max-w-[340px] bg-white rounded-xl shadow-lg border border-slate-300 p-5 font-mono text-[13px] leading-relaxed relative text-slate-800">
                <div className="text-center pb-3 border-b border-dashed border-slate-300">
                  <h4 className="font-black text-base tracking-wider uppercase text-slate-900">{shopName}</h4>
                  <p className="text-[10px] text-slate-500 font-bold tracking-tight uppercase mt-0.5">Mobile Phone Repair & Service</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Service Center Receipt</p>
                  <div className="mt-2 text-center inline-block bg-slate-100 px-3 py-1 rounded text-xs font-bold text-slate-700 tracking-wider">
                    SERVICE ORDER #{orderNo}
                  </div>
                </div>

                <div className="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Date/Time:</span><span className="font-semibold">{dateStr} {timeStr}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Customer:</span><span className="font-bold text-slate-900">{previewServiceOrder.name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Phone:</span><span>{previewServiceOrder.phone || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Device:</span><span className="font-bold text-indigo-700">{previewServiceOrder.phoneModel || '-'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-slate-500">Status:</span>
                    <span className="font-bold uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                      {previewServiceOrder.serviceStatus || 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="py-2.5 border-b border-dashed border-slate-300">
                  <div className="flex justify-between text-xs font-bold text-slate-800 mb-2">
                    <span>Total Service Cost:</span>
                    <span className="text-red-600">LKR {totalCost.toLocaleString()}</span>
                  </div>
                  
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Payment History (With Date)</span>
                      <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">{paymentsToRender.length} payment(s)</span>
                    </p>
                    {paymentsToRender.length === 0 ? (
                      <p className="text-slate-400 text-[11px] italic text-center py-1">No payments recorded yet</p>
                    ) : (
                      <div className="space-y-1">
                        {paymentsToRender.map((p, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-600 font-medium">{formatDisplayDate(p.date)} • {p.desc}</span>
                            <span className="font-bold text-green-700">LKR {p.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-slate-300 flex justify-between text-xs font-semibold text-slate-600">
                  <span>Total Paid to Date:</span>
                  <span className="font-bold text-green-700">LKR {totalPaid.toLocaleString()}</span>
                </div>

                <div className="py-3 bg-slate-50 rounded-lg px-3 my-2 border border-slate-200 flex justify-between items-center">
                  <span className="font-black text-xs uppercase text-slate-700">BALANCE DUE:</span>
                  <span className="font-black text-base text-red-700">LKR {Math.abs(balanceDue).toLocaleString()}</span>
                </div>

                <div className="pt-2 text-center text-[10px] text-slate-400 space-y-1 font-sans">
                  <p>• Please present this receipt upon pickup</p>
                  <p>• Repaired devices kept up to 30 days</p>
                  <p className="font-bold text-slate-600 mt-2">*** THANK YOU FOR YOUR BUSINESS! ***</p>
                </div>
              </div>
            ) : (
              /* A4 Invoice Style */
              <div className="w-full bg-white rounded-xl shadow-lg border border-slate-300 overflow-hidden text-slate-800">
                {/* A4 Header Banner */}
                <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                  <div>
                    <h4 className="text-lg font-black tracking-wide uppercase">{shopName}</h4>
                    <p className="text-[11px] text-slate-300 font-medium tracking-wide">MOBILE PHONE REPAIR & SERVICE INVOICE</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-xs bg-slate-800 text-blue-300 px-2 py-0.5 rounded uppercase">JOB #{orderNo}</div>
                    <p className="text-[11px] text-slate-400 mt-1">Date: {dateStr}</p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Two columns */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer Details</p>
                      <p className="font-bold text-sm text-slate-900">{previewServiceOrder.name}</p>
                      <p className="text-slate-600 mt-0.5">{previewServiceOrder.phone || 'No phone'}</p>
                      <p className="text-slate-400 text-[11px] mt-1">Walk-in Repair Order</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Device Details</p>
                      <p className="font-bold text-sm text-indigo-700">{previewServiceOrder.phoneModel || 'Device'}</p>
                      <p className="text-slate-600 mt-0.5 font-semibold">Status: <span className="uppercase text-slate-800">{previewServiceOrder.serviceStatus || 'Pending'}</span></p>
                      <p className="text-slate-400 text-[11px] mt-1">{timeStr}</p>
                    </div>
                  </div>

                  {/* Table 1: Service Charge */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Item Description</th>
                          <th className="p-2.5">Device</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-2.5 font-medium text-slate-800">Phone Repair & Service Charge</td>
                          <td className="p-2.5 text-slate-600">{previewServiceOrder.phoneModel || '-'}</td>
                          <td className="p-2.5 text-slate-600">{previewServiceOrder.serviceStatus || 'Pending'}</td>
                          <td className="p-2.5 text-right font-bold text-red-600">LKR {totalCost.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Table 2: Payment History With Dates */}
                  <div>
                    <h5 className="font-bold text-xs text-slate-700 mb-2 flex items-center justify-between">
                      <span>Payment History & Receipts (With Dates)</span>
                      <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">{paymentsToRender.length} recorded</span>
                    </h5>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-teal-700 text-white font-bold">
                          <tr>
                            <th className="p-2">#</th>
                            <th className="p-2">Payment Date</th>
                            <th className="p-2">Description / Note</th>
                            <th className="p-2 text-right">Amount Paid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {paymentsToRender.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-3 text-center text-slate-400 italic">No payments recorded yet</td>
                            </tr>
                          ) : (
                            paymentsToRender.map((p, idx) => (
                              <tr key={idx}>
                                <td className="p-2 text-slate-400">{idx + 1}</td>
                                <td className="p-2 font-semibold text-slate-800">{formatDisplayDate(p.date)}</td>
                                <td className="p-2 text-slate-600">{p.desc}</td>
                                <td className="p-2 text-right font-bold text-green-600">LKR {p.amount.toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="flex justify-end">
                    <div className="w-60 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Total Service Cost:</span>
                        <span className="font-bold text-slate-900">LKR {totalCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Total Paid to Date:</span>
                        <span className="font-bold text-green-700">LKR {totalPaid.toLocaleString()}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center">
                        <span className="font-black text-slate-800">BALANCE DUE:</span>
                        <span className="font-black text-sm text-red-600">LKR {Math.abs(balanceDue).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Terms */}
                  <div className="border-t border-slate-100 pt-3 text-[10px] text-slate-400 space-y-0.5">
                    <p className="font-bold text-slate-500 uppercase">Terms & Conditions:</p>
                    <p>1. Please present this receipt upon pickup.</p>
                    <p>2. Repaired items not claimed within 30 days are subject to storage charges.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar Footer */}
          <div className="bg-white p-4 border-t border-slate-200 flex flex-wrap gap-2.5 shrink-0 justify-between items-center">
            <button
              onClick={() => generateServicePDF(previewServiceOrder, 'POS')}
              className="flex-1 min-w-[120px] bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Download size={14} /> Download POS (80mm)
            </button>
            <button
              onClick={() => generateServicePDF(previewServiceOrder, 'A4')}
              className="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Download size={14} /> Download A4 PDF
            </button>
            <button
              onClick={() => generateServicePDF(previewServiceOrder, previewFormat, 'print')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
              title="Print document"
            >
              <Printer size={15} /> Print {previewFormat}
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => { contactsRef.current = contacts; }, [contacts]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (!state) { 
        setCurrentView('DASHBOARD'); 
        setSelectedContact(null); 
        setIsReportModalOpen(false);
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
      setIsReportModalOpen(false);
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
        setContacts(contactsRes.data.map((c: any) => {
          let parsedStatus = 'Pending';
          let parsedAdvance = 0;
          let parsedAdvDate = '';
          let parsedOrderDate = '';
          if (c.end_date) {
            try {
              if (c.end_date.startsWith('{')) {
                const parsed = JSON.parse(c.end_date);
                parsedStatus = parsed.status || 'Pending';
                parsedAdvance = parsed.advance || 0;
                parsedAdvDate = parsed.advanceDate || '';
                parsedOrderDate = parsed.orderDate || '';
              } else {
                parsedStatus = c.end_date;
              }
            } catch {
              parsedStatus = c.end_date;
            }
          }
          return {
            id: c.id, 
            name: c.name, 
            phone: c.phone || '', 
            type: c.type === 'SUPPLIER' ? 'VENDOR' : c.type,
            balance: c.balance || 0, 
            targetAmount: c.target_amount,
            phoneModel: c.start_date || '',
            serviceStatus: parsedStatus,
            totalCost: c.target_amount || 0,
            advancePayment: parsedAdvance,
            advanceDate: parsedAdvDate,
            orderDate: parsedOrderDate,
            lastUpdated: c.last_updated
          };
        }));
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

  const handleBack = () => { window.history.back(); };

  const handleSaveContact = async () => {
    if (!addName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const isService = editingContact ? editingContact.type === 'SERVICE' : activeTab === 'SERVICE';
      const costVal = isService ? (parseFloat(addTotalCost) || 0) : null;
      const advanceVal = isService ? (parseFloat(addAdvancePayment) || 0) : null;
      const effectiveOrderDate = addOrderDate || new Date().toISOString().slice(0, 10);
      const effectiveAdvDate = addAdvanceDate || new Date().toISOString().slice(0, 10);

      const payload: any = { 
        name: addName.trim(), 
        phone: addPhone.trim(),
        type: isService ? 'SERVICE' : activeTab, 
        target_amount: isService ? costVal : (activeTab === 'RENT' ? (parseFloat(targetAmount) || 30000) : null), 
        start_date: isService ? addPhoneModel.trim() : null,
        end_date: isService ? JSON.stringify({ 
          status: addServiceStatus, 
          advance: advanceVal || 0,
          advanceDate: effectiveAdvDate,
          orderDate: effectiveOrderDate 
        }) : null,
        last_updated: new Date().toISOString() 
      };
      
      let res;
      let contactId = editingContact?.id;
      if (editingContact) {
        res = await supabase.from('contacts').update(payload).eq('id', editingContact.id).select();
      } else {
        const newId = generateUUID();
        contactId = newId;
        res = await supabase.from('contacts').insert([{ ...payload, id: newId, balance: 0 }]).select();
      }

      if (res.error) throw res.error;
      
      if (res.data) {
        const savedData = res.data[0];
        const updatedContact: Contact = {
          id: savedData.id,
          name: savedData.name,
          phone: savedData.phone || '',
          type: savedData.type === 'SUPPLIER' ? 'VENDOR' : savedData.type,
          balance: savedData.balance || 0,
          targetAmount: savedData.target_amount,
          phoneModel: savedData.start_date || '',
          serviceStatus: addServiceStatus,
          totalCost: costVal || 0,
          advancePayment: advanceVal || 0,
          advanceDate: effectiveAdvDate,
          orderDate: effectiveOrderDate,
          lastUpdated: savedData.last_updated
        };

        // If it is a new SERVICE order, automatically record transactions for Total Cost & Advance Payment with explicit dates!
        if (isService && contactId && !editingContact) {
          const newTxList: Transaction[] = [];

          if (costVal && costVal > 0) {
            const costTx = {
              contact_id: contactId,
              date: effectiveOrderDate,
              amount: costVal,
              type: 'CREDIT' as TransactionType,
              description: 'Service Total Cost',
              balance_after: costVal
            };
            const costRes = await supabase.from('transactions').insert([costTx]).select();
            if (costRes.data?.[0]) {
              newTxList.push({
                id: costRes.data[0].id,
                contactId: costRes.data[0].contact_id,
                date: costRes.data[0].date,
                description: costRes.data[0].description,
                amount: costRes.data[0].amount,
                type: costRes.data[0].type,
                balanceAfter: costRes.data[0].balance_after
              });
            }
          }

          if (advanceVal && advanceVal > 0) {
            const balAfter = Math.max(0, (costVal || 0) - advanceVal);
            const advTx = {
              contact_id: contactId,
              date: effectiveAdvDate,
              amount: advanceVal,
              type: 'PAYMENT' as TransactionType,
              description: 'Advance Payment',
              balance_after: balAfter
            };
            const advRes = await supabase.from('transactions').insert([advTx]).select();
            if (advRes.data?.[0]) {
              newTxList.push({
                id: advRes.data[0].id,
                contactId: advRes.data[0].contact_id,
                date: advRes.data[0].date,
                description: advRes.data[0].description,
                amount: advRes.data[0].amount,
                type: advRes.data[0].type,
                balanceAfter: advRes.data[0].balance_after
              });
            }
          }

          if (newTxList.length > 0) {
            setTransactions(prev => [...newTxList, ...prev]);
          }
        } else if (isService && editingContact) {
          // If editing an existing service order, sync transactions for Total Cost and Advance Payment including updated dates!
          const existingCostTx = transactions.find(t => t.contactId === editingContact.id && t.description === 'Service Total Cost');
          if (existingCostTx) {
            if (costVal !== null && costVal > 0 && (costVal !== existingCostTx.amount || effectiveOrderDate !== existingCostTx.date)) {
              await supabase.from('transactions').update({ amount: costVal, date: effectiveOrderDate }).eq('id', existingCostTx.id);
              setTransactions(prev => prev.map(t => t.id === existingCostTx.id ? { ...t, amount: costVal, date: effectiveOrderDate } : t));
            }
          } else if (costVal && costVal > 0) {
            const costTx = {
              contact_id: editingContact.id,
              date: effectiveOrderDate,
              amount: costVal,
              type: 'CREDIT' as TransactionType,
              description: 'Service Total Cost',
              balance_after: costVal
            };
            const cRes = await supabase.from('transactions').insert([costTx]).select();
            if (cRes.data?.[0]) {
              setTransactions(prev => [{
                id: cRes.data[0].id,
                contactId: cRes.data[0].contact_id,
                date: cRes.data[0].date,
                description: cRes.data[0].description,
                amount: cRes.data[0].amount,
                type: cRes.data[0].type,
                balanceAfter: cRes.data[0].balance_after
              }, ...prev]);
            }
          }

          const existingAdvTx = transactions.find(t => t.contactId === editingContact.id && t.description === 'Advance Payment');
          if (existingAdvTx) {
            if (advanceVal !== null && advanceVal > 0 && (advanceVal !== existingAdvTx.amount || effectiveAdvDate !== existingAdvTx.date)) {
              await supabase.from('transactions').update({ amount: advanceVal, date: effectiveAdvDate }).eq('id', existingAdvTx.id);
              setTransactions(prev => prev.map(t => t.id === existingAdvTx.id ? { ...t, amount: advanceVal, date: effectiveAdvDate } : t));
            } else if (advanceVal === 0) {
              await supabase.from('transactions').delete().eq('id', existingAdvTx.id);
              setTransactions(prev => prev.filter(t => t.id !== existingAdvTx.id));
            }
          } else if (advanceVal && advanceVal > 0) {
            const advTx = {
              contact_id: editingContact.id,
              date: effectiveAdvDate,
              amount: advanceVal,
              type: 'PAYMENT' as TransactionType,
              description: 'Advance Payment',
              balance_after: 0
            };
            const aRes = await supabase.from('transactions').insert([advTx]).select();
            if (aRes.data?.[0]) {
              setTransactions(prev => [{
                id: aRes.data[0].id,
                contactId: aRes.data[0].contact_id,
                date: aRes.data[0].date,
                description: aRes.data[0].description,
                amount: aRes.data[0].amount,
                type: aRes.data[0].type,
                balanceAfter: aRes.data[0].balance_after
              }, ...prev]);
            }
          }
        }
        
        if (editingContact) {
          setContacts(contacts.map(c => c.id === editingContact.id ? updatedContact : c));
          if (selectedContact?.id === editingContact.id) setSelectedContact(updatedContact);
        } else {
          setContacts([...contacts, updatedContact]);
        }
      }
      
      setAddName(''); 
      setAddPhone(''); 
      setAddPhoneModel('');
      setAddTotalCost('');
      setAddAdvancePayment('');
      setAddOrderDate(new Date().toISOString().slice(0, 10));
      setAddAdvanceDate(new Date().toISOString().slice(0, 10));
      setAddServiceStatus('Pending');
      setTargetAmount('30000'); 
      setEditingContact(null);
      handleBack();
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteContact = async (id: string, isFromDetail: boolean = true) => {
    const contact = contacts.find(c => c.id === id);
    const itemLabel = contact?.type === 'SERVICE' ? 'Service Order' : (contact?.type === 'RENT' ? 'Rent Record' : 'Contact');
    if (!window.confirm(`Delete this ${itemLabel} entirely? All transactions will be lost.`)) return;
    setIsSubmitting(true);
    try {
      await supabase.from('transactions').delete().eq('contact_id', id);
      await supabase.from('contacts').delete().eq('id', id);
      setContacts(prev => prev.filter(c => c.id !== id));
      setTransactions(prev => prev.filter(t => t.contactId !== id));
      if (selectedContact?.id === id) {
        setSelectedContact(null);
      }
      if (isFromDetail) {
        handleBack();
      }
    } catch (err: any) { alert(err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleResetRentCycle = async (id: string) => {
    if (!window.confirm("Target achieved! Clear savings for this cycle and start fresh?")) return;
    setIsSubmitting(true);
    try {
      await supabase.from('transactions').delete().eq('contact_id', id);
      setTransactions(transactions.filter(t => t.contactId !== id));
      alert("New cycle started!");
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

  const renderReportModal = () => {
    if (!isReportModalOpen) return null;
    return (
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
                     (selectedContact?.type === 'RENT' ? 'Total Withdrawals' : (selectedContact?.type === 'CUSTOMER' ? 'Total Credit' : (selectedContact?.type === 'SERVICE' ? 'Total Charges' : 'Total Items'))) :
                     (activeTab === 'RENT' ? 'Total Withdrawals' : (activeTab === 'CUSTOMER' ? 'Total Credit' : (activeTab === 'SERVICE' ? 'Total Charges' : 'Total Items')))
                   }
                 </span>
                 <span className="font-bold text-red-600 text-sm">LKR {reportTotals.totalCredit.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                   {reportTarget === 'CONTACT' ? 
                     (selectedContact?.type === 'RENT' ? 'Total Deposits' : (selectedContact?.type === 'CUSTOMER' ? 'Total Received' : (selectedContact?.type === 'SERVICE' ? 'Total Received' : 'Total Paid'))) :
                     (activeTab === 'RENT' ? 'Total Deposits' : (activeTab === 'CUSTOMER' ? 'Total Received' : (activeTab === 'SERVICE' ? 'Total Received' : 'Total Paid')))
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
    );
  };

  const renderDashboard = () => {
    const filtered = contacts.filter(c => {
      const matchesTab = c.type === activeTab || (activeTab === 'VENDOR' && c.type as any === 'SUPPLIER');
      const q = searchQuery.toLowerCase();
      return matchesTab && (
        c.name.toLowerCase().includes(q) || 
        (c.phone && c.phone.includes(q)) ||
        (c.phoneModel && c.phoneModel.toLowerCase().includes(q))
      );
    });

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pb-20 no-scrollbar">
        <header className="bg-white px-4 py-3 pb-0 shadow-sm z-20 sticky top-0">
          <div className="flex justify-between items-center mb-2">
            <div><h1 className="text-xl font-bold text-slate-800">Ledger Book</h1><p className="text-xs font-semibold text-slate-500">{shopName}</p></div>
            <div className="flex items-center gap-3">
               <button onClick={() => { setEditingContact(null); setAddName(''); setAddPhone(''); setAddPhoneModel(''); setAddTotalCost(''); setAddAdvancePayment(''); setAddServiceStatus('Pending'); setTargetAmount('30000'); navigateTo('CONTACT_FORM'); }} className="bg-blue-600 text-white p-2 rounded-full shadow-sm active:scale-90 transition-transform flex items-center justify-center" title="Add New"><Plus size={22} /></button>
               <PlayCircle size={24} className="text-blue-600" />
            </div>
          </div>
          <div className="flex gap-4 mt-4 overflow-x-auto no-scrollbar pb-1">
            <button onClick={() => setActiveTab('CUSTOMER')} className={`flex items-center gap-2 pb-2.5 border-b-2 font-medium transition-colors shrink-0 ${activeTab === 'CUSTOMER' ? 'border-slate-800 text-slate-800 font-bold' : 'border-transparent text-gray-500'}`}><Users size={17} />Customers</button>
            <button onClick={() => setActiveTab('VENDOR')} className={`flex items-center gap-2 pb-2.5 border-b-2 font-medium transition-colors shrink-0 ${activeTab === 'VENDOR' ? 'border-slate-800 text-slate-800 font-bold' : 'border-transparent text-gray-500'}`}><Truck size={17} />Vendors</button>
            <button onClick={() => setActiveTab('RENT')} className={`flex items-center gap-2 pb-2.5 border-b-2 font-medium transition-colors shrink-0 ${activeTab === 'RENT' ? 'border-slate-800 text-slate-800 font-bold' : 'border-transparent text-gray-500'}`}><Building size={17} />Rent</button>
            <button onClick={() => setActiveTab('SERVICE')} className={`flex items-center gap-2 pb-2.5 border-b-2 font-medium transition-colors shrink-0 ${activeTab === 'SERVICE' ? 'border-slate-800 text-slate-800 font-bold' : 'border-transparent text-gray-500'}`}><Wrench size={17} />Service Order</button>
          </div>
        </header>
        <div className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f0fdf4] border border-[#dcfce7] rounded-xl p-3 shadow-sm flex flex-col justify-center min-h-[70px]">
              <p className="text-[10px] text-slate-600 font-bold mb-1 uppercase tracking-tighter">{activeTab === 'RENT' ? 'Total Saved' : (activeTab === 'VENDOR' ? 'Total Paid' : 'Total Received')}</p>
              <p className="text-xl font-bold text-[#15803d]">LKR {activeTotals.totalPayments.toLocaleString()}</p>
            </div>
            <div className="bg-[#fef2f2] border border-[#fee2e2] rounded-xl p-3 shadow-sm flex flex-col justify-center min-h-[70px]">
              <p className="text-[10px] text-slate-600 font-bold mb-1 uppercase tracking-tighter">{activeTab === 'RENT' ? 'Monthly Debt' : (activeTab === 'VENDOR' ? 'To pay' : 'To collect')}</p>
              <p className="text-xl font-bold text-[#b91c1c]">LKR {activeTotals.netBalance.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="bg-[#f1f5f9] rounded-xl px-4 py-3 flex items-center flex-1 border border-transparent focus-within:border-blue-200 transition-all shadow-sm">
              <Search size={18} className="text-slate-400 mr-3" /><input type="text" placeholder={activeTab === 'SERVICE' ? "Search name, phone, or model" : "Search name or number here"} className="bg-transparent outline-none text-[13px] w-full placeholder:text-slate-400 font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <button onClick={() => { setReportTarget('CATEGORY'); setIsReportModalOpen(true); }} className="bg-[#eff6ff] text-[#2563eb] p-3 rounded-xl border border-[#dbeafe] active:scale-95 transition-transform flex items-center justify-center shadow-sm" title="Download Report"><Download size={18} /></button>
            <button className="bg-[#eff6ff] text-[#2563eb] p-3 rounded-xl border border-[#dbeafe] active:scale-95 transition-transform flex items-center justify-center shadow-sm"><Filter size={18} /></button>
          </div>
          <div className="flex flex-col gap-2">
            {filtered.map(c => {
              const stats = contactStats[c.id];
              const displayBal = stats?.balance || 0;
              const isService = c.type === 'SERVICE';
              const leftLabel = isService ? 'Total Cost' : (c.type === 'VENDOR' ? 'Got' : (c.type === 'CUSTOMER' ? 'Gave' : 'Out'));
              const rightLabel = isService ? 'Advance' : (c.type === 'VENDOR' ? 'Paid' : (c.type === 'CUSTOMER' ? 'Got' : 'In'));
              
              if (isService) {
                const totalCost = stats.totalCredit || c.totalCost || c.targetAmount || 0;
                const advancePaid = stats.totalPayment || c.advancePayment || 0;
                const balanceDue = totalCost - advancePaid;
                const isPrintMenuOpen = printMenuContactId === c.id;

                return (
                  <div 
                    key={c.id} 
                    onClick={() => { setSelectedContact(c); navigateTo('DETAIL', c.id); }} 
                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3 active:bg-gray-50/70 cursor-pointer transition-all relative hover:border-slate-300"
                  >
                    {/* Top: Customer Name, Status Badge, Phone, Model, and Balance Due */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
                          <Smartphone size={20} />
                        </div>
                        <div className="overflow-hidden">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-800 text-base truncate leading-tight">{c.name}</h3>
                            {c.serviceStatus && (
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                c.serviceStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                                c.serviceStatus === 'Ready' ? 'bg-blue-100 text-blue-800' :
                                c.serviceStatus === 'In Progress' ? 'bg-amber-100 text-amber-800' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {c.serviceStatus}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {c.phone && <span className="text-xs text-slate-500 font-medium">{c.phone}</span>}
                            {c.phone && c.phoneModel && <span className="text-slate-300">•</span>}
                            {c.phoneModel && (
                              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                {c.phoneModel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Balance Due</p>
                        <p className={`font-black text-lg ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          LKR {Math.abs(balanceDue).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Cost and Advance breakdown */}
                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Total Cost:</span>
                        <span className="font-bold text-red-600">LKR {totalCost.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Advance Paid:</span>
                        <span className="font-bold text-green-600">LKR {advancePaid.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* 4 Action Buttons: Preview, Print (POS/A4), Edit, Delete */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 relative">
                      {/* Preview Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openPreview(c);
                        }}
                        className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors shadow-sm active:scale-95"
                        title="Preview Receipt & Invoice"
                      >
                        <Eye size={14} className="text-slate-600" />
                        <span>Preview</span>
                      </button>

                      {/* Print Button with Dropdown for POS and A4 */}
                      <div className="relative flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrintMenuContactId(isPrintMenuOpen ? null : c.id);
                          }}
                          className={`w-full py-1.5 px-2 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors shadow-sm active:scale-95 ${
                            isPrintMenuOpen ? 'bg-blue-600 text-white' : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                          }`}
                          title="Print POS or A4 PDF"
                        >
                          <Printer size={14} />
                          <span>Print</span>
                          <ChevronDown size={12} className={isPrintMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>

                        {/* Print Dropdown Menu */}
                        {isPrintMenuOpen && (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-full mb-1 left-0 right-0 sm:w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-30 animate-in fade-in zoom-in-95 duration-150"
                          >
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Choose PDF Format</p>
                            <button
                              onClick={() => {
                                setPrintMenuContactId(null);
                                generateServicePDF(c, 'POS');
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                            >
                              <Receipt size={14} className="text-indigo-600" />
                              <span>POS Receipt (80mm)</span>
                            </button>
                            <button
                              onClick={() => {
                                setPrintMenuContactId(null);
                                generateServicePDF(c, 'A4');
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                            >
                              <FileText size={14} className="text-blue-600" />
                              <span>A4 Invoice PDF</span>
                            </button>
                            <div className="border-t border-slate-100 mt-1 pt-1">
                              <button
                                onClick={() => {
                                  openPreview(c);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-slate-50 flex items-center gap-1.5"
                              >
                                <Eye size={12} />
                                <span>Preview Both First</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Edit Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditServiceOrder(c);
                        }}
                        className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors shadow-sm active:scale-95"
                        title="Edit Service Order"
                      >
                        <Pencil size={14} className="text-slate-600" />
                        <span>Edit</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteContact(c.id, false);
                        }}
                        className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors shadow-sm active:scale-95"
                        title="Delete Service Order"
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={c.id} onClick={() => { setSelectedContact(c); navigateTo('DETAIL', c.id); }} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between active:bg-gray-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-white shadow-inner ${c.type === 'RENT' ? 'bg-[#3b82f6]' : 'bg-slate-400'}`}>
                      {c.name[0]}
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-slate-800 text-base truncate leading-tight">{c.name}</h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1"><span className="text-[10px] text-gray-400 font-bold uppercase">{leftLabel}:</span><span className="text-xs font-bold text-red-600">LKR {stats.totalCredit.toLocaleString()}</span></div>
                        <div className="flex items-center gap-1"><span className="text-[10px] text-gray-400 font-bold uppercase">{rightLabel}:</span><span className="text-xs font-bold text-green-600">LKR {stats.totalPayment.toLocaleString()}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Balance</p>
                    <p className={`font-bold text-[17px] ${c.type === 'RENT' ? 'text-[#2563eb]' : (displayBal > 0 ? 'text-red-600' : 'text-green-600')}`}>LKR {Math.abs(displayBal).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-16 text-center text-slate-400">
                No {activeTab === 'SERVICE' ? 'service orders' : activeTab.toLowerCase() + 's'} recorded yet
              </div>
            )}
          </div>
        </div>
        <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme="blue" />
      </div>
    );
  };

  const renderDetail = () => {
    if (!selectedContact) return null;
    const isRent = selectedContact.type === 'RENT';
    const isService = selectedContact.type === 'SERVICE';
    const balance = contactStats[selectedContact.id]?.balance || 0;
    const target = selectedContact.targetAmount || 30000;
    const isTargetAchieved = isRent && balance >= target;

    const labelLeft = isRent ? "WITHDRAW" : (selectedContact.type === 'VENDOR' ? "GOT ITEMS" : (isService ? "SERVICE CHARGE" : "GAVE ITEMS"));
    const labelRight = isRent ? "DEPOSIT" : (selectedContact.type === 'VENDOR' ? "PAID MONEY" : (isService ? "PAYMENT RECEIVED" : "GOT MONEY"));
    
    const contactTransactions = transactions
      .filter(t => t.contactId === selectedContact.id)
      .sort((a,b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeA - timeB;
        if (a.type === b.type) return 0;
        return a.type === 'CREDIT' ? 1 : -1;
      });
    
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
            <p className="text-[11px] text-slate-400 font-medium truncate">
              {selectedContact.phone || 'No phone'}
              {isService && selectedContact.phoneModel ? ` • ${selectedContact.phoneModel}` : ''}
              {isService && selectedContact.serviceStatus ? ` (${selectedContact.serviceStatus})` : ''}
            </p>
          </div>
          {isService ? (
            <div className="flex items-center gap-1.5 relative">
              <button 
                onClick={() => openPreview(selectedContact)} 
                className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full active:scale-90 shadow-sm transition-colors" 
                title="Preview Service Order"
              >
                <Eye size={18} />
              </button>

              <button 
                onClick={() => setPrintMenuContactId(printMenuContactId === selectedContact.id ? null : selectedContact.id)} 
                className={`p-2 rounded-full active:scale-90 shadow-sm transition-colors ${
                  printMenuContactId === selectedContact.id ? 'bg-blue-600 text-white' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                }`} 
                title="Print Service Order (POS / A4)"
              >
                <Printer size={18} />
              </button>

              {printMenuContactId === selectedContact.id && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Choose PDF Format</p>
                  <button
                    onClick={() => {
                      setPrintMenuContactId(null);
                      generateServicePDF(selectedContact, 'POS');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                  >
                    <Receipt size={15} className="text-indigo-600" />
                    <span>POS Receipt (80mm)</span>
                  </button>
                  <button
                    onClick={() => {
                      setPrintMenuContactId(null);
                      generateServicePDF(selectedContact, 'A4');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                  >
                    <FileText size={15} className="text-blue-600" />
                    <span>A4 Invoice PDF</span>
                  </button>
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={() => {
                        setPrintMenuContactId(null);
                        openPreview(selectedContact);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <Eye size={12} />
                      <span>Preview Both First</span>
                    </button>
                  </div>
                </div>
              )}

              <button 
                onClick={() => handleEditServiceOrder(selectedContact)} 
                className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full active:scale-90 shadow-sm transition-colors" 
                title="Edit Service Order"
              >
                <Pencil size={18} />
              </button>
              <button 
                onClick={() => handleDeleteContact(selectedContact.id, true)} 
                className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-full active:scale-90 shadow-sm transition-colors"
                title="Delete Service Order"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button onClick={() => { setReportTarget('CONTACT'); setIsReportModalOpen(true); }} className="p-2 text-blue-600 bg-blue-50 rounded-full active:scale-90 shadow-sm" title="Download Statement"><Download size={18} /></button>
              <button onClick={() => { 
                setEditingContact(selectedContact); 
                setAddName(selectedContact.name); 
                setAddPhone(selectedContact.phone); 
                setTargetAmount(selectedContact.targetAmount?.toString() || '30000'); 
                setAddPhoneModel(selectedContact.phoneModel || ''); 
                setAddTotalCost(selectedContact.totalCost?.toString() || selectedContact.targetAmount?.toString() || (contactStats[selectedContact.id]?.totalCredit ? contactStats[selectedContact.id].totalCredit.toString() : '')); 
                setAddAdvancePayment(selectedContact.advancePayment?.toString() || (contactStats[selectedContact.id]?.totalPayment ? contactStats[selectedContact.id].totalPayment.toString() : '')); 
                setAddServiceStatus(selectedContact.serviceStatus || 'Pending'); 
                navigateTo('CONTACT_FORM'); 
              }} className="p-2 text-slate-600 bg-slate-100 rounded-full active:scale-90 shadow-sm" title="Edit Contact"><Pencil size={18} /></button>
              <button onClick={() => handleDeleteContact(selectedContact.id, true)} className="p-2 text-red-500 bg-red-50 rounded-full active:scale-90 shadow-sm"><Trash2 size={18} /></button>
            </div>
          )}
        </header>
        <div className="p-4 bg-white mb-2 shadow-sm text-center">
          <div className="bg-[#f8fafc] rounded-2xl p-6 border border-slate-100 shadow-inner relative overflow-hidden">
            {isTargetAchieved && (
              <div className="absolute top-0 right-0 bg-green-100 text-green-700 text-[8px] font-black px-2 py-1 rounded-bl-lg uppercase tracking-widest">Target Met!</div>
            )}
            {isService && (
              <div className="flex flex-col items-center gap-2 mb-3">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {selectedContact.phoneModel && (
                    <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                      <Smartphone size={13} /> {selectedContact.phoneModel}
                    </span>
                  )}
                  {selectedContact.serviceStatus && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                      selectedContact.serviceStatus === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                      selectedContact.serviceStatus === 'Ready' ? 'bg-blue-100 text-blue-800' :
                      selectedContact.serviceStatus === 'In Progress' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {selectedContact.serviceStatus}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs font-bold mt-1 bg-slate-100/70 px-3 py-1.5 rounded-xl">
                  <span className="text-red-600">Total: LKR {(contactStats[selectedContact.id]?.totalCredit || selectedContact.targetAmount || selectedContact.totalCost || 0).toLocaleString()}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-green-600">Advance/Paid: LKR {(contactStats[selectedContact.id]?.totalPayment || selectedContact.advancePayment || 0).toLocaleString()}</span>
                </div>
              </div>
            )}
            <h2 className={`text-4xl font-bold ${balance > 0 ? (isRent ? 'text-blue-600' : 'text-red-600') : 'text-green-600'}`}>LKR {Math.abs(balance).toLocaleString()}</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">{isRent ? `Saved / Target LKR ${target.toLocaleString()}` : (isService ? 'Balance Due' : 'Total Balance')}</p>

            {isService && (
              <div className="flex items-center justify-center gap-2 flex-wrap mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={() => openPreview(selectedContact)}
                  className="py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  title="Preview Receipt & Invoice"
                >
                  <Eye size={14} className="text-indigo-600" /> Preview
                </button>
                <button
                  onClick={() => generateServicePDF(selectedContact, 'POS')}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  title="Download / Print POS 80mm Receipt"
                >
                  <Receipt size={14} /> POS Receipt (80mm)
                </button>
                <button
                  onClick={() => generateServicePDF(selectedContact, 'A4')}
                  className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  title="Download / Print A4 Invoice PDF"
                >
                  <FileText size={14} /> A4 Invoice PDF
                </button>
                <button
                  onClick={() => handleEditServiceOrder(selectedContact)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  title="Edit Service Order"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => handleDeleteContact(selectedContact.id, true)}
                  className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  title="Delete Service Order"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
            {isTargetAchieved && (
              <button 
                onClick={() => handleResetRentCycle(selectedContact.id)}
                className="mt-4 bg-blue-600 text-white text-xs font-bold py-2 px-4 rounded-full flex items-center justify-center gap-2 mx-auto active:scale-95 transition-transform"
              >
                <RotateCcw size={14} /> Clear & Start New
              </button>
            )}
          </div>
        </div>
        {isService ? (
          <div className="flex-1 bg-gray-50 p-4 space-y-4">
            {/* Payment History Card with Date */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Receipt size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Payment History (With Date)</h3>
                    <p className="text-[10px] text-slate-400 font-medium">All advance & installments paid by customer</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingTransaction(null);
                    setTransType('PAYMENT');
                    setTransAmount('');
                    setTransDate(new Date().toISOString().slice(0, 10));
                    setTransDesc('Payment');
                    navigateTo('TRANSACTION_FORM', selectedContact.id);
                  }}
                  className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                >
                  <Plus size={14} /> Add Payment
                </button>
              </div>

              {/* Payments List */}
              {contactTransactions.filter(t => t.type === 'PAYMENT').length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  <p className="font-medium">No payments recorded yet</p>
                  <p className="text-[11px] text-slate-400 mt-1">Tap &ldquo;+ Add Payment&rdquo; to record an advance or payment with date.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {contactTransactions.filter(t => t.type === 'PAYMENT').map(p => (
                    <div 
                      key={p.id}
                      onClick={() => {
                        setEditingTransaction(p);
                        setTransType(p.type);
                        setTransAmount(p.amount.toString());
                        setTransDate(p.date);
                        setTransDesc(p.description || '');
                        navigateTo('TRANSACTION_FORM', selectedContact.id);
                      }}
                      className="py-2.5 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                          ✓
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-800">{p.description || 'Payment'}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                              <Calendar size={10} className="text-slate-400" />
                              {formatDisplayDate(p.date)}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">Tap to update date or amount</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-emerald-700">
                          + LKR {p.amount.toLocaleString()}
                        </span>
                        <div className="p-1.5 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 rounded-lg transition-colors">
                          <Pencil size={13} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total Paid Footer */}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Total Paid to Date:</span>
                <span className="font-black text-emerald-700">
                  LKR {contactTransactions.filter(t => t.type === 'PAYMENT').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Service & Repair Charges Section */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                    <Wrench size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Service Charges & Costs (With Date)</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Repair fees and parts cost</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingTransaction(null);
                    setTransType('CREDIT');
                    setTransAmount('');
                    setTransDate(new Date().toISOString().slice(0, 10));
                    setTransDesc('Service Total Cost');
                    navigateTo('TRANSACTION_FORM', selectedContact.id);
                  }}
                  className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                >
                  <Plus size={14} /> Add Charge
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {contactTransactions.filter(t => t.type === 'CREDIT').map(c => (
                  <div 
                    key={c.id}
                    onClick={() => {
                      setEditingTransaction(c);
                      setTransType(c.type);
                      setTransAmount(c.amount.toString());
                      setTransDate(c.date);
                      setTransDesc(c.description || '');
                      navigateTo('TRANSACTION_FORM', selectedContact.id);
                    }}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
                        🔧
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800">{c.description || 'Service Charge'}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                            <Calendar size={10} className="text-slate-400" />
                            {formatDisplayDate(c.date)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Tap to update date or cost</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-red-600">
                        LKR {c.amount.toLocaleString()}
                      </span>
                      <div className="p-1.5 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil size={13} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white">
            {computedWithBalance.map(t => (
              <TransactionRow key={t.id} transaction={t} onClick={(tx) => { setEditingTransaction(tx); setTransType(tx.type); setTransAmount(tx.amount.toString()); setTransDate(tx.date); setTransDesc(tx.description || ''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} />
            ))}
            {computedWithBalance.length === 0 && <div className="p-16 text-center text-slate-400">No transactions recorded yet</div>}
          </div>
        )}
        <div className="fixed bottom-0 left-0 right-0 bg-white px-4 pt-4 pb-10 flex gap-4 border-t border-slate-100 z-40 shadow-lg">
          <button onClick={() => { setEditingTransaction(null); setTransType('CREDIT'); setTransAmount(''); setTransDesc(isService ? 'Service Total Cost' : ''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} className="flex-1 bg-red-700 text-white font-bold py-4 rounded-xl flex flex-col items-center justify-center active:scale-95 shadow-md">
             <span className="text-[10px] opacity-90 uppercase font-black">{labelLeft}</span>
             <span className="flex items-center gap-1 font-bold text-lg">LKR <ArrowDown size={14} /></span>
          </button>
          <button onClick={() => { setEditingTransaction(null); setTransType('PAYMENT'); setTransAmount(''); setTransDesc(isService ? 'Payment' : ''); navigateTo('TRANSACTION_FORM', selectedContact.id); }} className="flex-1 bg-green-700 text-white font-bold py-4 rounded-xl flex flex-col items-center justify-center active:scale-95 shadow-md">
             <span className="text-[10px] opacity-90 uppercase font-black">{isService ? 'RECORD PAYMENT (WITH DATE)' : labelRight}</span>
             <span className="flex items-center gap-1 font-bold text-lg">LKR <ArrowUp size={14} /></span>
          </button>
        </div>
      </div>
    );
  };

  const renderTransactionForm = () => {
    if (!selectedContact) return null;
    const isRent = selectedContact.type === 'RENT';
    const isService = selectedContact.type === 'SERVICE';
    let title = editingTransaction 
      ? (isService ? (transType === 'PAYMENT' ? 'Update Payment with Date' : 'Update Service Charge with Date') : 'Edit Record') 
      : (isRent 
          ? (transType === 'PAYMENT' ? "Deposit Savings" : "Withdraw Savings") 
          : (isService 
              ? (transType === 'CREDIT' ? 'Add Service Charge' : 'Record Payment with Date') 
              : (transType === 'CREDIT' ? 'Items Sent' : 'Cash Received')
            )
        );
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-4 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button>
            <h1 className="text-lg font-bold">{title}</h1>
          </div>
          {editingTransaction && (
            <button onClick={handleDeleteTransaction} className="p-2 text-red-600 bg-red-50 rounded-full active:scale-90 transition-all">
              <Trash2 size={20} />
            </button>
          )}
        </header>
        <div className="p-6 flex-1 overflow-y-auto">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Amount</label>
          <input 
            type="number" 
            value={transAmount} 
            onChange={e => setTransAmount(e.target.value)} 
            placeholder="0.00" 
            className={`w-full text-5xl font-bold mb-8 outline-none border-none ${transType === 'CREDIT' ? 'text-red-600' : 'text-green-600'}`} 
            autoFocus 
          />
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block flex items-center justify-between">
            <span>Payment / Transaction Date</span>
            <span className="text-slate-600 font-bold">{formatDisplayDate(transDate)}</span>
          </label>
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setTransDate(new Date().toISOString().slice(0, 10))} 
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border ${transDate === new Date().toISOString().slice(0, 10) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}
              >
                TODAY
              </button>
              <button 
                type="button"
                onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setTransDate(d.toISOString().slice(0, 10)); }} 
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all border ${transDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}
              >
                YESTERDAY
              </button>
              <button 
                type="button"
                onClick={() => dateInputRef.current?.showPicker()} 
                className="flex-1 py-2 rounded-lg text-[10px] font-bold bg-white text-slate-500 border border-slate-200 flex items-center justify-center gap-1 active:bg-gray-50 transition-colors shadow-sm"
              >
                <Calendar size={12} /> CHANGE DATE
              </button>
            </div>
            <input 
              ref={dateInputRef} 
              type="date" 
              value={transDate} 
              onChange={e => setTransDate(e.target.value)} 
              className="w-full border-b py-3 font-semibold outline-none focus:border-blue-500 transition-colors" 
            />
          </div>

          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
            {isService ? (transType === 'PAYMENT' ? 'Payment Note / Reference' : 'Charge Description') : 'Notes'}
          </label>
          <textarea 
            value={transDesc} 
            onChange={e => setTransDesc(e.target.value)} 
            placeholder={isService ? (transType === 'PAYMENT' ? 'e.g. Advance Payment, Balance Payment...' : 'e.g. Screen Replacement, Battery...') : 'Add optional details...'} 
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 h-20 outline-none focus:border-slate-300 transition-colors text-sm" 
          />

          {isService && (
            <div className="mt-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Note Suggestions</p>
              <div className="flex flex-wrap gap-1.5">
                {(transType === 'PAYMENT' 
                  ? ['Advance Payment', 'Part Payment', 'Final Balance Payment', 'Cash Payment', 'Bank Transfer']
                  : ['Service Total Cost', 'Screen Replacement', 'Battery Replacement', 'Charging Port', 'Motherboard Repair']
                ).map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setTransDesc(chip)}
                    className={`text-xs px-2.5 py-1.5 rounded-xl border font-semibold transition-all ${
                      transDesc === chip ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:scale-95'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-6 pb-12">
          <button 
            disabled={isSubmitting} 
            onClick={handleSaveTransaction} 
            className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-xl flex items-center justify-center gap-2 ${transType === 'CREDIT' ? 'bg-red-700' : 'bg-green-700'} active:scale-95 transition-all`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (isService ? (transType === 'PAYMENT' ? 'Save Payment with Date' : 'Save Charge Record') : 'Confirm Record')}
          </button>
        </div>
      </div>
    );
  };

  const renderContactForm = () => {
    const isService = activeTab === 'SERVICE';
    const formHeading = editingContact 
      ? `Edit ${isService ? 'Service Order' : activeTab}` 
      : `New ${isService ? 'Service Order' : activeTab}`;

    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="px-4 py-4 flex items-center gap-4 border-b"><button onClick={handleBack} className="p-1"><ChevronLeft size={24} /></button><h1 className="text-lg font-bold">{formHeading}</h1></header>
        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{isService ? 'Customer Name' : 'Full Name'}</label>
            <input value={addName} onChange={e => setAddName(e.target.value)} placeholder={isService ? "Enter customer name" : "Enter Name"} className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
            <input value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="Enter Phone" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" />
          </div>
          {isService && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Phone Model</label>
                <input 
                  value={addPhoneModel} 
                  onChange={e => setAddPhoneModel(e.target.value)} 
                  placeholder="e.g. iPhone 13 Pro, Samsung A12" 
                  className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" 
                />
              </div>

              {/* Total Cost & Order Date */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Repair Cost (LKR)</label>
                  <input 
                    type="number"
                    value={addTotalCost} 
                    onChange={e => setAddTotalCost(e.target.value)} 
                    placeholder="0.00" 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-lg font-bold outline-none focus:border-blue-500 transition-colors text-red-600" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Order / Booking Date</span>
                    <span className="text-slate-700 font-bold">{formatDisplayDate(addOrderDate)}</span>
                  </label>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setAddOrderDate(new Date().toISOString().slice(0, 10))} 
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${addOrderDate === new Date().toISOString().slice(0, 10) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                      TODAY
                    </button>
                    <button 
                      type="button"
                      onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setAddOrderDate(d.toISOString().slice(0, 10)); }} 
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${addOrderDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                      YESTERDAY
                    </button>
                    <button 
                      type="button"
                      onClick={() => orderDateInputRef.current?.showPicker()} 
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-white text-slate-600 border border-slate-200 flex items-center justify-center gap-1 active:bg-slate-100 transition-colors shadow-sm"
                    >
                      <Calendar size={12} /> PICK DATE
                    </button>
                  </div>
                  <input 
                    ref={orderDateInputRef} 
                    type="date" 
                    value={addOrderDate} 
                    onChange={e => setAddOrderDate(e.target.value)} 
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-blue-500" 
                  />
                </div>
              </div>

              {/* Advance Payment & Payment Date */}
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Advance Payment (LKR)</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Records into Payment History</span>
                  </label>
                  <input 
                    type="number"
                    value={addAdvancePayment} 
                    onChange={e => setAddAdvancePayment(e.target.value)} 
                    placeholder="0.00" 
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2.5 text-lg font-bold outline-none focus:border-emerald-500 transition-colors text-green-700" 
                  />
                </div>
                
                {/* Advance Payment Date Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Advance Payment Date</span>
                    <span className="text-emerald-950 font-bold">{formatDisplayDate(addAdvanceDate)}</span>
                  </label>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setAddAdvanceDate(new Date().toISOString().slice(0, 10))} 
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${addAdvanceDate === new Date().toISOString().slice(0, 10) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200'}`}
                    >
                      TODAY
                    </button>
                    <button 
                      type="button"
                      onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setAddAdvanceDate(d.toISOString().slice(0, 10)); }} 
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${addAdvanceDate === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200'}`}
                    >
                      YESTERDAY
                    </button>
                    <button 
                      type="button"
                      onClick={() => advanceDateInputRef.current?.showPicker()} 
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 flex items-center justify-center gap-1 active:bg-emerald-100 transition-colors shadow-sm"
                    >
                      <Calendar size={12} /> PICK DATE
                    </button>
                  </div>
                  <input 
                    ref={advanceDateInputRef} 
                    type="date" 
                    value={addAdvanceDate} 
                    onChange={e => setAddAdvanceDate(e.target.value)} 
                    className="w-full bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-500 text-emerald-900" 
                  />
                </div>
              </div>

              {((parseFloat(addTotalCost) || 0) > 0 || (parseFloat(addAdvancePayment) || 0) > 0) && (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex justify-between items-center shadow-inner">
                  <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">Balance Due</span>
                  <span className="font-black text-lg text-red-600">
                    LKR {Math.max(0, (parseFloat(addTotalCost) || 0) - (parseFloat(addAdvancePayment) || 0)).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Order Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {['Pending', 'In Progress', 'Ready', 'Delivered'].map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setAddServiceStatus(status)}
                      className={`py-2 px-1 text-center rounded-lg text-[11px] font-bold border transition-all ${
                        addServiceStatus === status 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {activeTab === 'RENT' && (<div className="flex flex-col gap-1"><label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monthly Target (LKR)</label><input value={targetAmount} onChange={e => setTargetAmount(e.target.value)} type="number" placeholder="30000" className="w-full border-b-2 py-3 text-lg font-semibold outline-none focus:border-blue-500 transition-colors" /></div>)}
          <button disabled={isSubmitting || !addName.trim()} onClick={handleSaveContact} className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg mt-8 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">{isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingContact ? 'Update ' + (isService ? 'Service Order' : 'Contact') : 'Save ' + (isService ? 'Service Order' : 'Contact'))}</button>
        </div>
      </div>
    );
  };

  const renderProfile = () => (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20 no-scrollbar">
      <header className="bg-white px-6 py-8 shadow-sm flex flex-col items-center gap-4">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-white shadow-xl"><Store size={40} /></div>
        <div className="text-center"><h1 className="text-xl font-bold">{shopName}</h1><p className="text-sm text-slate-400">Ledger Profile</p></div>
      </header>
      <div className="p-6"><button onClick={async () => { if(!window.confirm("RESET APP? All data will be deleted.")) return; await Promise.all([supabase.from('transactions').delete().neq('id', '0'), supabase.from('contacts').delete().neq('id', '0')]); window.location.reload(); }} className="w-full flex items-center gap-4 p-4 rounded-xl bg-red-50 text-red-700 active:bg-red-100 transition-colors border border-red-100 shadow-sm"><ShieldAlert size={20} /><div className="text-left font-bold">Wipe Ledger Data</div></button></div>
      <BottomNav currentView={currentView} onNavigate={(v) => navigateTo(v)} activeTheme="blue" />
    </div>
  );

  let content;
  if (currentView === 'DASHBOARD') content = renderDashboard();
  else if (currentView === 'DETAIL') content = renderDetail();
  else if (currentView === 'TRANSACTION_FORM') content = renderTransactionForm();
  else if (currentView === 'CONTACT_FORM') content = renderContactForm();
  else if (currentView === 'PROFILE') content = renderProfile();
  else content = <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-slate-200" size={40} /></div>;

  return (
    <>
      {content}
      {renderReportModal()}
      {renderPreviewModal()}
    </>
  );
}