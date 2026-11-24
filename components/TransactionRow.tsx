import React from 'react';
import { FileText, Banknote, Building2, CreditCard, Clock, CheckCircle2, AlertCircle, Receipt, Image as ImageIcon, Eye, Wallet } from 'lucide-react';
import { Transaction, PaymentMethod, ChequeStatus, ContactType, CashbookEntryItem } from '../types';

export interface ParsedTransactionMetadata {
  method?: PaymentMethod;
  chequeStatus?: ChequeStatus;
  chequeNumber?: string;
  chequeDate?: string;
  cashAmount?: number;
  chequeAmount?: number;
  attachmentUrl?: string;
  attachmentDocType?: 'Cheque' | 'Invoice';
  items?: CashbookEntryItem[];
  cleanNotes: string;
}

const ATT_TOKEN_REGEX = /\s*•?\s*\[ATT:(Cheque|Invoice)\|([^\]]+)\]/i;
const ITEMS_TOKEN_REGEX = /\s*•?\s*\[ITEMS:([A-Za-z0-9+/=]+)\]/;

export const extractItemsToken = (desc?: string): { items: CashbookEntryItem[]; cleanDesc: string } => {
  if (!desc) return { items: [], cleanDesc: '' };
  const match = desc.match(ITEMS_TOKEN_REGEX);
  if (!match) return { items: [], cleanDesc: desc };
  let items: CashbookEntryItem[] = [];
  try {
    const bin = atob(match[1]);
    const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    try {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(match[1]))));
      if (Array.isArray(parsed)) items = parsed;
    } catch {}
  }
  const cleanDesc = desc
    .replace(ITEMS_TOKEN_REGEX, '')
    .replace(/^[•\s]+|[•\s]+$/g, '')
    .trim();
  return { items, cleanDesc };
};

export const stripItemsToken = (desc?: string): string => {
  return extractItemsToken(desc).cleanDesc;
};

export const extractAttachmentToken = (desc?: string): {
  attachmentUrl?: string;
  attachmentDocType?: 'Cheque' | 'Invoice';
  rawToken?: string;
  cleanDesc: string;
} => {
  if (!desc) return { cleanDesc: '' };
  const match = desc.match(ATT_TOKEN_REGEX);
  if (!match) return { cleanDesc: desc };
  const docType = match[1]?.toLowerCase() === 'invoice' ? 'Invoice' : 'Cheque';
  const url = match[2]?.trim();
  const rawToken = `[ATT:${docType}|${url}]`;
  const cleanDesc = desc
    .replace(ATT_TOKEN_REGEX, '')
    .replace(/^[•\s]+|[•\s]+$/g, '')
    .trim();
  return {
    attachmentUrl: url || undefined,
    attachmentDocType: docType,
    rawToken,
    cleanDesc,
  };
};

export const stripAttachmentToken = (desc?: string): string => {
  return extractAttachmentToken(desc).cleanDesc;
};

export const isImageAttachment = (url?: string | null): boolean => {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  if (url.startsWith('data:application/pdf')) return false;
  if (/\.pdf(\?.*)?$/i.test(url)) return false;
  return true;
};

export const isPendingCheque = (t: Transaction): boolean => {
  if (t.chequeStatus === 'PASSED') return false;
  if (t.chequeStatus === 'BOUNCED') return false;
  if (t.chequeStatus === 'PENDING') return true;
  
  const desc = t.description || '';
  const isCheque = t.paymentMethod === 'Cheque' || t.paymentMethod === 'Cash + Cheque' || desc.toLowerCase().includes('cheque');
  if (!isCheque) return false;
  
  if (desc.includes('[PASSED]') || desc.includes('[CLEARED]') || desc.includes('Status: Passed')) return false;
  if (desc.includes('[BOUNCED]')) return false;
  return true;
};

export const getTransactionChequeAmount = (t: Transaction, parsed?: ParsedTransactionMetadata): number => {
  const p = parsed || parsePaymentMethod(t.description, t.paymentMethod, t.chequeStatus, t.chequeDate);
  const isSplit = p.method === 'Cash + Cheque' || t.paymentMethod === 'Cash + Cheque';
  if (isSplit) {
    if (p.chequeAmount !== undefined && p.chequeAmount > 0) return p.chequeAmount;
    if (p.cashAmount !== undefined) return Math.max(0, t.amount - p.cashAmount);
  }
  return t.amount;
};

export const getTransactionCashAmount = (t: Transaction, parsed?: ParsedTransactionMetadata): number => {
  const p = parsed || parsePaymentMethod(t.description, t.paymentMethod, t.chequeStatus, t.chequeDate);
  const isSplit = p.method === 'Cash + Cheque' || t.paymentMethod === 'Cash + Cheque';
  if (isSplit) {
    if (p.cashAmount !== undefined) return p.cashAmount;
    if (p.chequeAmount !== undefined) return Math.max(0, t.amount - p.chequeAmount);
  }
  return 0;
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

export const parsePaymentMethod = (
  desc?: string, 
  explicitMethod?: PaymentMethod, 
  explicitStatus?: ChequeStatus,
  explicitChequeDate?: string
): ParsedTransactionMetadata => {
  const { attachmentUrl, attachmentDocType, cleanDesc: descNoAtt } = extractAttachmentToken(desc);
  const { items, cleanDesc } = extractItemsToken(descNoAtt);
  const result: ParsedTransactionMetadata = {
    method: explicitMethod,
    chequeStatus: explicitStatus,
    chequeDate: explicitChequeDate,
    attachmentUrl,
    attachmentDocType,
    items: items.length > 0 ? items : undefined,
    cleanNotes: cleanDesc
  };

  if (!cleanDesc) return result;
  const trimmed = cleanDesc.trim();

  // Check Cash + Cheque (Split Payment) format
  if (explicitMethod === 'Cash + Cheque' || trimmed.startsWith('Cash + Cheque') || (trimmed.toLowerCase().includes('cash') && trimmed.toLowerCase().includes('cheque'))) {
    result.method = 'Cash + Cheque';
    
    if (!result.chequeStatus) {
      if (trimmed.includes('[PASSED]') || trimmed.includes('[CLEARED]') || trimmed.includes('Status: Passed')) {
        result.chequeStatus = 'PASSED';
      } else if (trimmed.includes('[BOUNCED]')) {
        result.chequeStatus = 'BOUNCED';
      } else {
        result.chequeStatus = 'PENDING';
      }
    }

    const cashMatch = trimmed.match(/Cash:\s*(?:LKR\s*)?([0-9,]+(?:\.[0-9]+)?)/i);
    if (cashMatch) {
      result.cashAmount = parseFloat(cashMatch[1].replace(/,/g, ''));
    }

    const chqMatch = trimmed.match(/Cheque:\s*(?:LKR\s*)?([0-9,]+(?:\.[0-9]+)?)/i);
    if (chqMatch) {
      result.chequeAmount = parseFloat(chqMatch[1].replace(/,/g, ''));
    }

    const chqNumMatch = trimmed.match(/#([A-Za-z0-9-]+)/);
    if (chqNumMatch) {
      result.chequeNumber = chqNumMatch[1];
    }

    const dueDateMatch = trimmed.match(/(?:Due|Date):\s*(\d{4}-\d{2}-\d{2})/);
    if (dueDateMatch) {
      result.chequeDate = dueDateMatch[1];
    } else if (explicitChequeDate) {
      result.chequeDate = explicitChequeDate;
    }

    let notes = trimmed
      .replace(/^Cash\s*\+\s*Cheque\s*(\[(PENDING|PASSED|BOUNCED)\])?/i, '')
      .replace(/•\s*#(?:[A-Za-z0-9-]+)/g, '')
      .replace(/•\s*(?:Due|Date):\s*\d{4}-\d{2}-\d{2}/g, '')
      .replace(/^[•\s-]+|[•\s-]+$/g, '')
      .trim();

    result.cleanNotes = notes;
    return result;
  }

  // Check Cheque format
  if (explicitMethod === 'Cheque' || trimmed.startsWith('Cheque')) {
    result.method = 'Cheque';
    
    // Status
    if (!result.chequeStatus) {
      if (trimmed.includes('[PASSED]') || trimmed.includes('[CLEARED]') || trimmed.includes('Status: Passed')) {
        result.chequeStatus = 'PASSED';
      } else if (trimmed.includes('[BOUNCED]')) {
        result.chequeStatus = 'BOUNCED';
      } else {
        result.chequeStatus = 'PENDING';
      }
    }

    // Cheque Number: #12345
    const chqNumMatch = trimmed.match(/#([A-Za-z0-9-]+)/);
    if (chqNumMatch) {
      result.chequeNumber = chqNumMatch[1];
    }

    // Due / Maturity Date: Due: 2026-11-15
    const dueDateMatch = trimmed.match(/(?:Due|Date):\s*(\d{4}-\d{2}-\d{2})/);
    if (dueDateMatch) {
      result.chequeDate = dueDateMatch[1];
    } else if (explicitChequeDate) {
      result.chequeDate = explicitChequeDate;
    }

    // Clean notes by removing technical prefixes
    let notes = trimmed
      .replace(/^Cheque\s*(\[(PENDING|PASSED|BOUNCED)\])?/i, '')
      .replace(/•\s*#(?:[A-Za-z0-9-]+)/g, '')
      .replace(/•\s*(?:Due|Date):\s*\d{4}-\d{2}-\d{2}/g, '')
      .replace(/^[•\s-]+|[•\s-]+$/g, '')
      .trim();

    result.cleanNotes = notes;
    return result;
  }

  if (explicitMethod === 'Credit' || trimmed.startsWith('Credit • ') || trimmed.startsWith('Credit Sale') || trimmed.toLowerCase() === 'credit' || trimmed.toLowerCase() === 'credit (pay later)') {
    let cleanNotes = trimmed;
    if (trimmed.startsWith('Credit Sale • ')) {
      cleanNotes = trimmed.substring(14).trim();
    } else if (trimmed.startsWith('Credit • ')) {
      cleanNotes = trimmed.substring(9).trim();
    } else if (trimmed.toLowerCase() === 'credit' || trimmed.toLowerCase() === 'credit sale' || trimmed.toLowerCase() === 'credit (pay later)') {
      cleanNotes = '';
    }
    return { ...result, method: 'Credit', cleanNotes };
  }

  if (trimmed.startsWith('Bank Transfer • ')) {
    return { ...result, method: 'Bank Transfer', cleanNotes: trimmed.substring(16).trim() };
  }
  if (trimmed === 'Bank Transfer') {
    return { ...result, method: 'Bank Transfer', cleanNotes: '' };
  }
  if (trimmed.startsWith('Card • ')) {
    return { ...result, method: 'Card', cleanNotes: trimmed.substring(7).trim() };
  }
  if (trimmed === 'Card') {
    return { ...result, method: 'Card', cleanNotes: '' };
  }
  if (trimmed.startsWith('Cash • ')) {
    return { ...result, method: 'Cash', cleanNotes: trimmed.substring(7).trim() };
  }
  if (trimmed === 'Cash') {
    return { ...result, method: 'Cash', cleanNotes: '' };
  }

  return result;
};

interface TransactionRowProps {
  transaction: Transaction;
  contactType?: ContactType;
  onClick?: (transaction: Transaction) => void;
  onPassCheque?: (transaction: Transaction) => void;
  onViewInvoice?: (transaction: Transaction) => void;
  onViewAttachment?: (url: string, docType?: 'Cheque' | 'Invoice') => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({ transaction, contactType, onClick, onPassCheque, onViewInvoice, onViewAttachment }) => {
  const isPayment = transaction.type === 'PAYMENT';
  const parsed = parsePaymentMethod(
    transaction.description, 
    transaction.paymentMethod, 
    transaction.chequeStatus,
    transaction.chequeDate
  );
  const pendingCheque = isPendingCheque(transaction);
  const isCheque = parsed.method === 'Cheque' || transaction.paymentMethod === 'Cheque';
  const chqDueDate = parsed.chequeDate || transaction.chequeDate || transaction.date;
  const resolvedAttachmentUrl = transaction.attachmentUrl || parsed.attachmentUrl;
  const resolvedAttachmentDocType = transaction.attachmentDocType || parsed.attachmentDocType || 'Cheque';

  return (
    <div 
      onClick={() => onClick?.(transaction)}
      className={`p-4 border-b border-slate-100 dark:border-[#1e2a3c] flex flex-col gap-2 transition-colors cursor-pointer hover:bg-slate-50/70 dark:hover:bg-[#172235] ${
        pendingCheque ? 'bg-amber-50/50 dark:bg-amber-950/25 ring-1 ring-inset ring-amber-300/60 dark:ring-amber-700/40' : 'bg-white dark:bg-[#131b2a]'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="font-bold text-base text-slate-800 dark:text-slate-100">{formatDisplayDate(transaction.date)}</span>
          {pendingCheque && (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800/50">
              <Clock size={11} />
              Post-Dated Cheque (On Hold)
            </span>
          )}
        </div>
        <div className="text-right tabular-nums">
          <span className={`font-bold text-base tabular-nums ${
            pendingCheque 
              ? 'text-amber-800 dark:text-amber-400 font-extrabold' 
              : isPayment 
              ? 'text-emerald-700 dark:text-emerald-400' 
              : 'text-rose-600 dark:text-rose-400'
          }`}>
            {pendingCheque ? '⏳ ' : (isPayment ? '+' : '-')} LKR {transaction.amount.toLocaleString()}
          </span>
          {pendingCheque && (
            <div className="text-[10px] text-amber-800 dark:text-amber-400 font-bold tracking-wider space-y-0.5">
              {parsed.method === 'Cash + Cheque' ? (
                <>
                  <p className="font-extrabold text-amber-900 dark:text-amber-300">
                    Cheque on Hold: LKR {getTransactionChequeAmount(transaction, parsed).toLocaleString()}
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400 font-bold">
                    Cash Paid: LKR {getTransactionCashAmount(transaction, parsed).toLocaleString()}
                  </p>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                    Due Date: {formatDisplayDate(chqDueDate)}
                  </p>
                </>
              ) : (
                <p>Due Date: {formatDisplayDate(chqDueDate)} • Amount On Hold</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end gap-2">
        <div className="flex flex-col gap-1.5 flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 flex-wrap">
            {parsed.method === 'Cash + Cheque' ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60">
                <Wallet size={12} className="text-indigo-600 dark:text-indigo-400" />
                <span>Cash + Cheque (Split)</span>
                {parsed.chequeNumber && (
                  <span className="opacity-90 font-mono">#{parsed.chequeNumber}</span>
                )}
              </span>
            ) : isCheque ? (
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                pendingCheque
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800/60'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60'
              }`}>
                {pendingCheque ? <Clock size={12} className="text-amber-700 dark:text-amber-400" /> : <CheckCircle2 size={12} className="text-emerald-700 dark:text-emerald-400" />}
                <span>Cheque {pendingCheque ? '(Pending Clearance)' : '(Passed / Cleared)'}</span>
                {parsed.chequeNumber && (
                  <span className="opacity-90 font-mono">#{parsed.chequeNumber}</span>
                )}
              </span>
            ) : (
              (isPayment || Boolean(parsed.method)) && parsed.method && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                  parsed.method === 'Bank Transfer' 
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50' 
                    : parsed.method === 'Card'
                    ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                }`}>
                  {parsed.method === 'Bank Transfer' ? <Building2 size={12} /> : parsed.method === 'Card' ? <CreditCard size={12} /> : <Banknote size={12} />}
                  {parsed.method}
                </span>
              )
            )}

            {(isPayment || (contactType === 'RENT' && transaction.type === 'CREDIT')) && contactType && (
              <span className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                contactType === 'CUSTOMER'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                  : contactType === 'RENT'
                  ? (transaction.type === 'CREDIT' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50')
                  : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50'
              }`}>
                {contactType === 'CUSTOMER' ? 'Linked to Sales' :
                 contactType === 'RENT' ? (transaction.type === 'CREDIT' ? 'Rent Withdrawal (+ Sale)' : 'Rent Deposit') :
                 'Linked to Sales'}
              </span>
            )}

            {isCheque && chqDueDate && (
              <span className="text-[10px] font-bold bg-amber-100 dark:bg-[#1a2538] text-amber-950 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-300 dark:border-[#2b3a54] flex items-center gap-1">
                <Clock size={10} className="text-amber-700 dark:text-amber-400" />
                <span>Due Date: {formatDisplayDate(chqDueDate)}</span>
              </span>
            )}

            {parsed.cleanNotes ? (
              <span className="text-sm text-slate-600 dark:text-slate-300 font-medium truncate">{parsed.cleanNotes}</span>
            ) : (!parsed.method && stripItemsToken(stripAttachmentToken(transaction.description)) ? (
              <span className="text-sm text-slate-500 dark:text-slate-400 uppercase font-medium truncate">{stripItemsToken(stripAttachmentToken(transaction.description))}</span>
            ) : null)}
          </div>

          {parsed.items && parsed.items.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {parsed.items.map((it, idx) => {
                const retail = Number(it.retailPrice) || 0;
                const wholesale = Number(it.wholesalePrice) || 0;
                const cost = Number(it.cost) || 0;
                const unitPrice = it.priceType === 'WHOLESALE'
                  ? (wholesale > 0 ? wholesale : (retail > 0 ? retail : cost))
                  : (retail > 0 ? retail : (wholesale > 0 ? wholesale : cost));
                const lineTotal = (Number(it.qty) || 0) * unitPrice;
                return (
                  <div
                    key={it.id || idx}
                    className="inline-flex items-center gap-1.5 flex-wrap px-2 py-0.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/50 text-[10px] font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <span className="font-extrabold text-slate-900 dark:text-white">{it.item || it.sku}</span>
                    {it.category && (
                      <span className="text-blue-700 dark:text-blue-300 bg-white/80 dark:bg-[#131b2a] px-1 rounded font-bold">
                        {it.category}
                      </span>
                    )}
                    {it.sku && (
                      <span className="font-mono text-indigo-700 dark:text-indigo-300">
                        SKU:{it.sku}
                      </span>
                    )}
                    <span className="font-bold text-slate-700 dark:text-slate-300">× {it.qty}</span>
                    {lineTotal > 0 && (
                      <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                        LKR {lineTotal.toLocaleString()}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {(resolvedAttachmentUrl || transaction.hasAttachment) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (resolvedAttachmentUrl && onViewAttachment) {
                  onViewAttachment(resolvedAttachmentUrl, resolvedAttachmentDocType);
                }
              }}
              className="mt-1 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100/80 dark:hover:bg-amber-950/50 transition-all w-fit active:scale-95"
              title="View Attached Cheque / Invoice"
            >
              {resolvedAttachmentUrl && isImageAttachment(resolvedAttachmentUrl) ? (
                <img
                  src={resolvedAttachmentUrl}
                  alt={resolvedAttachmentDocType}
                  className="w-8 h-6 object-cover rounded border border-amber-300 dark:border-amber-700 shrink-0"
                />
              ) : (
                <div className="w-7 h-6 rounded bg-white dark:bg-[#1a2538] border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
                  {resolvedAttachmentUrl && !isImageAttachment(resolvedAttachmentUrl) ? (
                    <FileText size={13} className="text-rose-600" />
                  ) : (
                    <ImageIcon size={13} className="text-amber-600" />
                  )}
                </div>
              )}
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                <span>{resolvedAttachmentDocType}</span>
                {resolvedAttachmentUrl && <Eye size={11} className="opacity-75" />}
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            {onViewInvoice && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewInvoice(transaction);
                }}
                className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
                title="View & Print Invoice / POS Receipt"
              >
                <Receipt size={13} />
                <span>Invoice</span>
              </button>
            )}

            {pendingCheque && onPassCheque && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPassCheque(transaction);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                title="Pass / Clear this cheque and apply amount to balance"
              >
                <CheckCircle2 size={13} />
                <span>Pass Cheque</span>
              </button>
            )}
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
            Bal. LKR {transaction.balanceAfter.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};