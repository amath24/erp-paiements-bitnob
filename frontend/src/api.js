/**
 * Client API unifie pour le frontend ERP (P4 & P5)
 */

export async function createInvoice(satoshis, description, customerName = 'Client Comptoir') {
  const res = await fetch('/api/pay/create-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ satoshis, description, customerName }),
  });
  return res.json();
}

export async function getInvoiceStatus(invoiceId) {
  const res = await fetch(`/api/pay/status/${invoiceId}`);
  return res.json();
}

export async function triggerDemoPay(invoiceId) {
  const res = await fetch(`/api/pay/demo-pay/${invoiceId}`, { method: 'POST' });
  return res.json();
}

export async function settleInvoice(invoiceId, xofAmount, beneficiary) {
  const res = await fetch(`/api/settle/${invoiceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ xofAmount, beneficiary }),
  });
  return res.json();
}

export async function fetchErpKpis() {
  const res = await fetch('/api/erp/kpis');
  return res.json();
}

export async function fetchErpInvoices(limit = 50) {
  const res = await fetch(`/api/erp/invoices?limit=${limit}`);
  return res.json();
}

export async function queryErpAi(question) {
  const res = await fetch('/api/ai/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  return res.json();
}
