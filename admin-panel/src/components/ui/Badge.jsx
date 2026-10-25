import React from 'react';

const Badge = ({ status }) => {
  const mapping = {
    pending_confirmation: 'bg-amber-100 text-amber-800',
    pending_deposit: 'bg-orange-100 text-orange-700',
    confirmed: 'bg-cyan-100 text-cyan-700',
    shipped: 'bg-teal-100 text-teal-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-neutral-200 text-neutral-700',
    deposit_paid: 'bg-green-100 text-green-700',
    balance_pending: 'bg-orange-100 text-orange-700',
  };

  const label = status === 'pending_confirmation' ? 'Awaiting WhatsApp' : status.replaceAll('_', ' ');

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${mapping[status] || 'bg-neutral-100 text-neutral-600'}`}>
      {label}
    </span>
  );
};

export default Badge;
