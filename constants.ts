import { Contact, Transaction } from './types';

export const MOCK_CONTACTS: Contact[] = [
  {
    id: '1',
    name: 'Kasun Perera',
    phone: '0770771513',
    city: 'Colombo',
    type: 'CUSTOMER',
    balance: 13395,
    lastUpdated: '2025-12-06'
  },
  {
    id: '2',
    name: 'Nimal Silva',
    phone: '0754664556',
    city: 'Kandy',
    type: 'CUSTOMER',
    balance: 14000,
    lastUpdated: '2025-12-06'
  },
  {
    id: '3',
    name: 'Amal Fernando',
    phone: '0773196784',
    city: 'Matale',
    type: 'CUSTOMER',
    balance: 6810,
    lastUpdated: '2025-12-05'
  },
  {
    id: '4',
    name: 'John Customer',
    phone: '0771234567',
    city: 'Galle',
    type: 'CUSTOMER',
    balance: 5000,
    lastUpdated: '2025-12-01'
  }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    contactId: '2',
    date: '6th Dec 2025',
    type: 'CREDIT',
    amount: 15000,
    balanceAfter: 15000,
    hasAttachment: false
  },
  {
    id: 't2',
    contactId: '2',
    date: '6th Dec 2025',
    description: 'Cash',
    paymentMethod: 'Cash',
    type: 'PAYMENT',
    amount: 1000,
    balanceAfter: 14000,
    hasAttachment: false
  }
];