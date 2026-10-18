import {
  Invoice,
  Transaction,
  Transfer,
  VirtualCard,
  CardExpense,
} from "@/types";

export const MOCK_USER = {
  name: "Amadou Dione",
  title: "Freelance",
  avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250",
  email: "amadou.dione@sunupay.io",
  phone: "+221 77 123 45 67",
  country: "Sénégal",
  currency: "USD",
};

export const MOCK_BALANCES = {
  totalUSD: 2875.24,
  monthlyGrowthPct: 12.5,
  crypto: {
    BTC: {
      amount: 0.0042,
      usdValue: 245.8,
      change24h: 3.2,
      symbol: "BTC",
      name: "Bitcoin",
      iconColor: "#F7931A",
    },
    USDT: {
      amount: 820.0,
      usdValue: 820.0,
      change24h: 0.01,
      symbol: "USDT",
      name: "Tether USD",
      iconColor: "#26A17B",
    },
    USDC: {
      amount: 320.0,
      usdValue: 320.0,
      change24h: 0.0,
      symbol: "USDC",
      name: "USD Coin",
      iconColor: "#2775CA",
    },
  },
  fiatEquivalentXOF: 1710767,
};

export const MOCK_CHART_DATA = [
  { month: "Jany", label: "Jan", reçus: 1200, envoyés: 450 },
  { month: "Fév", label: "Fév", reçus: 1850, envoyés: 620 },
  { month: "Mar", label: "Mar", reçus: 1400, envoyés: 780 },
  { month: "Avr", label: "Avr", reçus: 2900, envoyés: 950 },
  { month: "Mai", label: "Mai", reçus: 2100, envoyés: 1100 },
  { month: "Juin", label: "Juin", reçus: 2600, envoyés: 820 },
  { month: "Juil", label: "Juil", reçus: 3400, envoyés: 1250 },
];

export const MOCK_STATS = {
  invoicesCreated: 24,
  paymentsReceived: 18,
  paymentsGrowthPct: 28,
  pendingPayments: 3,
  pendingGrowthPct: -25,
};

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1",
    client: "TechStudio NG",
    type: "Paiement reçu",
    rawType: "payment_received",
    amount: 50.0,
    currency: "USDT",
    status: "confirmed",
    date: "17 oct. 2026, 14:32",
    txHash: "0x3f98a2...c890",
    network: "TRON (TRC20)",
    fee: 0.5,
  },
  {
    id: "tx-2",
    client: "Awa Services",
    type: "Paiement reçu",
    rawType: "payment_received",
    amount: 120.0,
    currency: "USDT",
    status: "confirmed",
    date: "16 oct. 2026, 10:21",
    txHash: "0x89e1a...110b",
    network: "TRON (TRC20)",
    fee: 0.8,
  },
  {
    id: "tx-3",
    client: "Moussa Design",
    type: "Paiement reçu",
    rawType: "payment_received",
    amount: 35.0,
    currency: "USDT",
    status: "pending",
    date: "16 oct. 2026, 08:15",
    network: "Ethereum (ERC20)",
    fee: 1.2,
  },
  {
    id: "tx-4",
    client: "Global Tech",
    type: "Paiement reçu",
    rawType: "payment_received",
    amount: 75.0,
    currency: "USDT",
    status: "confirmed",
    date: "15 oct. 2026, 19:02",
    txHash: "0x12c4b...8821",
    network: "Polygon",
    fee: 0.2,
  },
  {
    id: "tx-5",
    client: "Koffi & Partners",
    type: "Paiement reçu",
    rawType: "payment_received",
    amount: 0.0035,
    currency: "BTC",
    status: "confirmed",
    date: "14 oct. 2026, 11:45",
    txHash: "a98df0...bc99",
    network: "Bitcoin Lightning",
    fee: 0.00001,
  },
  {
    id: "tx-6",
    client: "Sadio Diallo",
    type: "Transfert envoyé",
    rawType: "transfer_sent",
    amount: 100.0,
    currency: "USDT",
    status: "confirmed",
    date: "14 oct. 2026, 09:12",
    network: "Orange Money SN",
    fee: 0.5,
  },
];

export const MOCK_INVOICES: Invoice[] = [
  {
    id: "inv-1042",
    invoiceNumber: "SP-1042",
    clientName: "TechStudio NG",
    description: "Logo Design",
    amount: 50.0,
    currency: "USD",
    acceptedCryptos: ["BTC", "USDT", "USDC"],
    dueDate: "2026-10-25",
    notes: "Facturation pour la refonte complète de la charte graphique et livrables vectoriels.",
    status: "pending",
    createdAt: "2026-10-16T14:30:00Z",
    shareableUrl: "https://sunupay.io/pay/SP-1042",
    paymentAddress: {
      USDT: "TJz7XqP9kK2Wq8546bYF4tCjB2ZLm99q1a",
      BTC: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      USDC: "0x71C...4982c",
    },
  },
  {
    id: "inv-1041",
    invoiceNumber: "SP-1041",
    clientName: "Awa Services",
    description: "Intégration API Stripe & Bitnob",
    amount: 120.0,
    currency: "USD",
    acceptedCryptos: ["USDT", "USDC"],
    dueDate: "2026-10-20",
    notes: "Mission d'architecture backend et sécurisation des webhooks.",
    status: "paid",
    createdAt: "2026-10-15T09:00:00Z",
    shareableUrl: "https://sunupay.io/pay/SP-1041",
    paidAmount: 120.0,
    paidCurrency: "USDT",
  },
  {
    id: "inv-1040",
    invoiceNumber: "SP-1040",
    clientName: "Moussa Design",
    description: "Prototypage Figma UI/UX",
    amount: 35.0,
    currency: "USD",
    acceptedCryptos: ["USDT"],
    dueDate: "2026-10-18",
    notes: "Livrables haute fidélité pour application mobile.",
    status: "pending",
    createdAt: "2026-10-14T11:20:00Z",
    shareableUrl: "https://sunupay.io/pay/SP-1040",
  },
  {
    id: "inv-1039",
    invoiceNumber: "SP-1039",
    clientName: "Global Tech",
    description: "Audit de sécurité smart contract",
    amount: 75.0,
    currency: "USD",
    acceptedCryptos: ["BTC", "USDT"],
    dueDate: "2026-10-12",
    notes: "Rapport d'audit et recommandations techniques.",
    status: "paid",
    createdAt: "2026-10-10T16:00:00Z",
    shareableUrl: "https://sunupay.io/pay/SP-1039",
    paidAmount: 75.0,
    paidCurrency: "USDT",
  },
  {
    id: "inv-1038",
    invoiceNumber: "SP-1038",
    clientName: "Dakar Digital Agency",
    description: "Maintenance mensuelle infrastructure cloud",
    amount: 250.0,
    currency: "USD",
    acceptedCryptos: ["BTC", "USDT", "USDC"],
    dueDate: "2026-10-05",
    notes: "Facturation échue le 05/10/2026.",
    status: "expired",
    createdAt: "2026-09-25T10:00:00Z",
    shareableUrl: "https://sunupay.io/pay/SP-1038",
  },
];

export const MOCK_TRANSFERS: Transfer[] = [
  {
    id: "tr-1",
    recipientName: "Sadio Diallo",
    recipientCountry: "Sénégal",
    countryCode: "SN",
    method: "mobile_money",
    operator: "Orange Money",
    phoneNumber: "+221 77 450 12 34",
    amountSent: 100.0,
    currencySent: "USDT",
    amountReceived: 59500,
    currencyReceived: "XOF",
    fee: 0.5,
    exchangeRate: 595.0,
    status: "completed",
    date: "17 oct. 2026, 12:10",
    estimatedDelivery: "Instantané",
    notes: "Paiement prestataire",
  },
  {
    id: "tr-2",
    recipientName: "Awa Ndiaye",
    recipientCountry: "Sénégal",
    countryCode: "SN",
    method: "mobile_money",
    operator: "Wave",
    phoneNumber: "+221 76 890 55 22",
    amountSent: 50.0,
    currencySent: "USDT",
    amountReceived: 29750,
    currencyReceived: "XOF",
    fee: 0.5,
    exchangeRate: 595.0,
    status: "completed",
    date: "16 oct. 2026, 16:45",
    estimatedDelivery: "Instantané",
    notes: "Facture freelance",
  },
  {
    id: "tr-3",
    recipientName: "Moussa Faye",
    recipientCountry: "Mali",
    countryCode: "ML",
    method: "mobile_money",
    operator: "Orange Money Mali",
    phoneNumber: "+223 70 12 34 56",
    amountSent: 75.0,
    currencySent: "USDT",
    amountReceived: 44625,
    currencyReceived: "XOF",
    fee: 0.5,
    exchangeRate: 595.0,
    status: "processing",
    date: "16 oct. 2026, 18:20",
    estimatedDelivery: "En cours (5-10 min)",
    notes: "Fourniture matériel",
  },
];

export const MOCK_CARDS: VirtualCard[] = [
  {
    id: "card-1",
    cardNumber: "5532 9845 2314 9867",
    maskedNumber: "•••• •••• •••• 9867",
    last4: "9867",
    cardHolder: "AMADOU DIONE",
    expiryDate: "08/28",
    cvv: "842",
    brand: "mastercard",
    cardType: "virtual",
    status: "active",
    balance: 850.0,
    monthlyLimit: 1500.0,
    spentThisMonth: 185.0,
    theme: "yellow",
  },
  {
    id: "card-2",
    cardNumber: "5412 7564 8923 4321",
    maskedNumber: "•••• •••• •••• 4321",
    cardHolder: "AMADOU DIONE",
    expiryDate: "10/27",
    last4: "4321",
    cvv: "329",
    brand: "mastercard",
    cardType: "virtual",
    status: "active",
    balance: 1274.72,
    monthlyLimit: 2500.0,
    spentThisMonth: 290.72,
    theme: "black",
  },
  {
    id: "card-3",
    cardNumber: "5189 3341 5562 1123",
    maskedNumber: "•••• •••• •••• 1123",
    cardHolder: "AMADOU DIONE",
    expiryDate: "05/28",
    last4: "1123",
    cvv: "614",
    brand: "mastercard",
    cardType: "virtual",
    status: "active",
    balance: 750.0,
    monthlyLimit: 1000.0,
    spentThisMonth: 0.0,
    theme: "silver",
  },
];

export const MOCK_CARD_EXPENSES: CardExpense[] = [
  {
    id: "exp-1",
    merchant: "Amazon",
    category: "E-commerce",
    amount: 17.0,
    currency: "USD",
    cardLast4: "4321",
    date: "16 oct. 2026, 08:32",
    status: "completed",
  },
  {
    id: "exp-2",
    merchant: "Google",
    category: "Services en ligne",
    amount: 8.99,
    currency: "USD",
    cardLast4: "4321",
    date: "15 oct. 2026, 14:21",
    status: "completed",
  },
  {
    id: "exp-3",
    merchant: "Canva",
    category: "Logiciels",
    amount: 12.99,
    currency: "USD",
    cardLast4: "9867",
    date: "14 oct. 2026, 10:15",
    status: "completed",
  },
  {
    id: "exp-4",
    merchant: "Figma",
    category: "Logiciels",
    amount: 12.0,
    currency: "USD",
    cardLast4: "9867",
    date: "12 oct. 2026, 09:10",
    status: "completed",
  },
  {
    id: "exp-5",
    merchant: "Meta Ads",
    category: "Publicité",
    amount: 85.5,
    currency: "USD",
    cardLast4: "4321",
    date: "09 oct. 2026, 17:30",
    status: "completed",
  },
  {
    id: "exp-6",
    merchant: "Airbnb",
    category: "Voyage",
    amount: 57.0,
    currency: "USD",
    cardLast4: "4321",
    date: "05 oct. 2026, 13:45",
    status: "completed",
  },
];

export const MOCK_CARD_STATS = {
  totalSpent: 475.72,
  spentGrowthPct: 8.2,
  activeCardsCount: 3,
  maxCardsCount: 5,
  totalLimit: 5000.0,
  usedLimit: 2875.0,
  transactionsThisMonth: 24,
  categoryBreakdown: [
    { name: "Services en ligne", pct: 31, color: "#F5C200", amount: 147.47 },
    { name: "Logiciels", pct: 24, color: "#111827", amount: 114.17 },
    { name: "Publicité", pct: 18, color: "#6B7280", amount: 85.63 },
    { name: "Voyage", pct: 12, color: "#9CA3AF", amount: 57.09 },
    { name: "Autres", pct: 15, color: "#E5E7EB", amount: 71.36 },
  ],
};

export const SUPPORTED_DESTINATIONS = [
  {
    country: "Sénégal",
    countryCode: "SN",
    flag: "🇸🇳",
    currency: "XOF",
    rateToUSDT: 595.0,
    minAmount: 5,
    maxAmount: 2500,
    methods: [
      {
        id: "mobile_money",
        name: "Mobile Money",
        operators: ["Orange Money", "Wave", "Free Money"],
      },
      {
        id: "bank_account",
        name: "Compte bancaire",
        operators: ["CBAO", "SGBS", "Ecobank", "BOA"],
      },
      {
        id: "cash_pickup",
        name: "Cash pickup",
        operators: ["Wari", "Joni Joni", "Proximo"],
      },
    ],
  },
  {
    country: "Côte d'Ivoire",
    countryCode: "CI",
    flag: "🇨🇮",
    currency: "XOF",
    rateToUSDT: 595.0,
    minAmount: 5,
    maxAmount: 2500,
    methods: [
      {
        id: "mobile_money",
        name: "Mobile Money",
        operators: ["Wave CI", "Orange Money CI", "MTN MoMo", "Moov Money"],
      },
      {
        id: "bank_account",
        name: "Compte bancaire",
        operators: ["NSIA", "SGCI", "Ecobank CI"],
      },
    ],
  },
  {
    country: "Bénin",
    countryCode: "BJ",
    flag: "🇧🇯",
    currency: "XOF",
    rateToUSDT: 595.0,
    minAmount: 5,
    maxAmount: 2000,
    methods: [
      {
        id: "mobile_money",
        name: "Mobile Money",
        operators: ["MTN MoMo Bénin", "Moov Africa"],
      },
    ],
  },
  {
    country: "Mali",
    countryCode: "ML",
    flag: "🇲🇱",
    currency: "XOF",
    rateToUSDT: 595.0,
    minAmount: 5,
    maxAmount: 2000,
    methods: [
      {
        id: "mobile_money",
        name: "Mobile Money",
        operators: ["Orange Money Mali", "Moov Mali"],
      },
    ],
  },
  {
    country: "Nigéria",
    countryCode: "NG",
    flag: "🇳🇬",
    currency: "NGN",
    rateToUSDT: 1480.0,
    minAmount: 10,
    maxAmount: 5000,
    methods: [
      {
        id: "bank_account",
        name: "Compte bancaire (NIP)",
        operators: ["Access Bank", "Zenith Bank", "GTBank", "Kuda Bank"],
      },
    ],
  },
  {
    country: "Kenya",
    countryCode: "KE",
    flag: "🇰🇪",
    currency: "KES",
    rateToUSDT: 129.5,
    minAmount: 10,
    maxAmount: 3000,
    methods: [
      {
        id: "mobile_money",
        name: "Mobile Money",
        operators: ["M-Pesa (Safaricom)", "Airtel Money"],
      },
    ],
  },
  {
    country: "Ghana",
    countryCode: "GH",
    flag: "🇬🇭",
    currency: "GHS",
    rateToUSDT: 15.5,
    minAmount: 5,
    maxAmount: 2000,
    methods: [
      {
        id: "mobile_money",
        name: "Mobile Money",
        operators: ["MTN Mobile Money", "Vodafone Cash", "AirtelTigo"],
      },
    ],
  },
];

export const DEMO_CSV_CONTENT = `nom,telephone,montant,devise,pays,operateur
Mamadou Diallo,+221 77 450 12 34,25000,XOF,SN,Wave
Fatou Sall,+221 76 890 55 22,30000,XOF,SN,Orange Money
Ousmane Ba,+221 77 112 33 44,22000,XOF,SN,Wave
Aissatou Diop,+221 78 555 66 77,28000,XOF,SN,Orange Money
Ibrahima Fall,+221 77 999 88 11,35000,XOF,SN,Wave
Mariama Cisse,+221 76 123 98 76,20000,XOF,SN,Orange Money
Cheikh Tidiane Sow,+221 77 444 33 22,40000,XOF,SN,Wave
Babacar Ndiaye,+234 77 123 45 67,25000,XOF,SN,Orange Money
Khadija Sy,+221 78 333 22 11,27000,XOF,SN,Wave
Abdoulaye Wade,+221 76 777 88 99,32000,XOF,SN,Orange Money
Chinedu Eze,+234 803 123 4567,75000,NGN,NG,Access Bank
Ngozi Okonjo,+234 802 987 6543,90000,NGN,NG,GTBank
Emeka Obi,+234 814 555 7788,65000,NGN,NG,Zenith Bank
Chioma Adeyemi,+234 901 222 3344,80000,NGN,NG,Access Bank
Tunde Bakare,+234 805 444 1122,120000,NGN,NG,GTBank
Folake Adeleke,+234 818 333 9900,70000,NGN,NG,Zenith Bank
Chinedu Okafor,+234 806 777 5544,85000,NGN,NG,Access Bank
Ibrahim Danjuma,+234 703 111 4455,60000,NGN,NG,GTBank
Amaka Johnson,+234 809 666 2233,95000,NGN,NG,Zenith Bank
Babatunde Fashola,+234 812 888 7766,110000,NGN,NG,Access Bank
Kwame Mensah,+233 24 123 4567,1200,GHS,GH,MTN Mobile Money
Ama Serwaa,+233 20 987 6543,1500,GHS,GH,Vodafone Cash
Emmanuel Mensah,024 123,800,GHS,GH,MTN Mobile Money
Kofi Annan,+233 24 555 7788,1400,GHS,GH,MTN Mobile Money
Akosua Boateng,+233 20 333 4455,1100,GHS,GH,Vodafone Cash
Yaw Osei,+233 27 666 1122,1300,GHS,GH,AirtelTigo
Abena Appiah,+233 24 888 9900,1600,GHS,GH,MTN Mobile Money
Kwesi Pratt,+233 20 222 5566,1250,GHS,GH,Vodafone Cash
Adwoa Safo,+233 24 777 3344,1450,GHS,GH,MTN Mobile Money
Kojo Boakye,+233 27 999 8877,1000,GHS,GH,AirtelTigo`;

export const MOCK_BULK_BATCHES: any[] = [
  {
    id: "batch-oct-2026",
    title: "Commissions Marketplace — Octobre 2026",
    description: "Paiement de 30 livreurs actifs au Sénégal, Nigeria et Ghana",
    totalRecipients: 30,
    validCount: 28,
    invalidCount: 2,
    totalAmountLocal: {
      XOF: 284000,
      NGN: 850000,
      GHS: 11800,
    },
    totalAmountUSDT: 1812.85,
    estimatedFeesUSDT: 15.0,
    status: "completed",
    createdAt: "18 oct. 2026, 04:15",
    completedAt: "18 oct. 2026, 04:18",
  },
  {
    id: "batch-sep-2026",
    title: "Paie Freelances & Opérations — Septembre 2026",
    description: "Règlement des prestataires et développeurs distants",
    totalRecipients: 24,
    validCount: 24,
    invalidCount: 0,
    totalAmountLocal: {
      XOF: 520000,
      NGN: 1200000,
    },
    totalAmountUSDT: 1684.87,
    estimatedFeesUSDT: 12.0,
    status: "completed",
    createdAt: "28 sept. 2026, 10:30",
    completedAt: "28 sept. 2026, 10:32",
  },
];

