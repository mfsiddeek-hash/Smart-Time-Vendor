import { Contact, Transaction } from './types';

export const MOCK_CONTACTS: Contact[] = [
  {
    id: '1',
    name: 'Fazlan 7to7',
    phone: '770771513',
    type: 'VENDOR',
    balance: 13395,
    lastUpdated: '2025-12-06'
  },
  {
    id: '2',
    name: 'M4U',
    phone: '0754664556',
    type: 'VENDOR',
    balance: 14000,
    lastUpdated: '2025-12-06'
  },
  {
    id: '3',
    name: 'Manazeer 7to7',
    phone: '94779493930',
    type: 'VENDOR',
    balance: 6810,
    lastUpdated: '2025-12-05'
  },
  {
    id: '4',
    name: 'Maxcell',
    phone: '0773196784',
    type: 'VENDOR',
    balance: 10000,
    lastUpdated: '2025-12-02'
  },
  {
    id: '5',
    name: 'John Customer',
    phone: '0771234567',
    type: 'CUSTOMER',
    balance: 5000,
    lastUpdated: '2025-12-01'
  }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    contactId: '2', // M4U
    date: '6th Dec 2025',
    type: 'CREDIT',
    amount: 2000,
    balanceAfter: 14000,
    hasAttachment: true
  },
  {
    id: 't2',
    contactId: '2', // M4U
    date: '5th Dec 2025',
    description: 'Cash BY MOHAMED',
    type: 'PAYMENT',
    amount: 1000,
    balanceAfter: 16000,
    hasAttachment: false
  },
  {
    id: 't3',
    contactId: '2', // M4U
    date: '4th Dec 2025',
    type: 'CREDIT',
    amount: 2000,
    balanceAfter: 17000,
    hasAttachment: true
  },
  {
    id: 't4',
    contactId: '2', // M4U
    date: '2nd Dec 2025',
    type: 'PAYMENT',
    amount: 1000,
    balanceAfter: 19000,
    hasAttachment: true
  },
  {
    id: 't5',
    contactId: '2', // M4U
    date: '1st Dec 2025',
    description: 'Cash by Mohamed',
    type: 'PAYMENT',
    amount: 1000,
    balanceAfter: 20000,
    hasAttachment: false
  },
  {
    id: 't6',
    contactId: '2', // M4U
    date: '30th Nov 2025',
    type: 'CREDIT',
    amount: 2000,
    balanceAfter: 21000,
    hasAttachment: true
  }
];