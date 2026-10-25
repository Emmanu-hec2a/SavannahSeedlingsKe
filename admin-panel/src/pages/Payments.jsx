import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import DataTable from '../components/ui/DataTable';
import SearchInput from '../components/ui/SearchInput';
import DateRangePicker from '../components/ui/DateRangePicker';
import { CreditCard, RefreshCw, Eye } from 'lucide-react';
import { paymentsService } from '../services/payments';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const data = await paymentsService.list({ search, ...dateRange });
      setPayments(data.results || data);

      const statsData = await paymentsService.getStats();
      setStats(statsData);
    } catch (err) {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [search, dateRange]);

  const handleQuery = async (id) => {
    try {
        const res = await paymentsService.query(id);
        toast.success(res.deposit_paid ? 'Payment confirmed!' : 'Payment still pending');
        fetchPayments();
    } catch (err) {
        toast.error('Query failed');
    }
  };

  const columns = [
    {
        header: 'Order #',
        render: (row) => (
            <Link to={`/orders/${row.order_number}`} className="font-mono font-bold text-cyan-600 hover:underline">
                {row.order_number}
            </Link>
        )
    },
    { header: 'Customer', accessor: 'customer_name' },
    {
        header: 'Deposit Amount',
        render: (row) => `KSh ${Number(row.amount).toLocaleString()}`
    },
    { header: 'Receipt #', accessor: 'mpesa_receipt_number', className: 'font-mono text-xs font-bold text-green-600' },
    {
        header: 'Result',
        render: (row) => {
            if (row.result_code === 0) return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Success</span>;
            if (row.result_code === null) return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Pending</span>;
            return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Failed</span>;
        }
    },
    {
        header: 'Balance',
        render: (row) => (
            <div className="flex flex-col">
                <span className="text-xs">KSh {Number(row.balance_amount).toLocaleString()}</span>
                {row.balance_collected ? (
                    <span className="text-[9px] text-green-500 font-bold uppercase">Collected</span>
                ) : (
                    <span className="text-[9px] text-orange-400 font-bold uppercase">Pending</span>
                )}
            </div>
        )
    },
    {
        header: 'Date',
        render: (row) => {
            if (!row.created_at) return '—';
            try {
                const date = new Date(row.created_at);
                if (isNaN(date.getTime())) return '—';
                return format(date, 'MMM dd, HH:mm');
            } catch (e) {
                return '—';
            }
        }
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <button
          onClick={() => handleQuery(row.checkout_request_id)}
          className="p-1.5 text-neutral-400 hover:text-cyan-500 hover:bg-cyan-50 rounded-md transition-all"
          title="Query Status"
        >
          <RefreshCw size={18} />
        </button>
      )
    }
  ];

  return (
    <AdminLayout title="Payments">
      <div className="space-y-6">
        {stats && (
            <div className="flex flex-wrap gap-4 p-4 bg-teal-ink text-white rounded-card shadow-lg">
                <div className="flex-1 min-w-[200px]">
                    <p className="text-xs text-neutral-400 uppercase font-bold tracking-widest mb-1">Deposits Collected</p>
                    <p className="text-2xl font-mono font-bold">KSh {stats.revenue_today.toLocaleString()}</p>
                </div>
                <div className="flex-1 min-w-[200px] border-l border-white/10 pl-6">
                    <p className="text-xs text-neutral-400 uppercase font-bold tracking-widest mb-1">Outstanding Balance</p>
                    <p className="text-2xl font-mono font-bold text-orange-400">KSh {stats.balance_outstanding.toLocaleString()}</p>
                </div>
                <div className="flex-1 min-w-[200px] border-l border-white/10 pl-6">
                    <p className="text-xs text-neutral-400 uppercase font-bold tracking-widest mb-1">Awaiting Confirmation / Payment</p>
                    <p className="text-2xl font-mono font-bold text-cyan-400">{stats.pending_deposits_count} orders</p>
                </div>
            </div>
        )}

        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-card shadow-sm border border-neutral-100">
            <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Order # or Receipt..."
            />
            <DateRangePicker
                from={dateRange.from}
                to={dateRange.to}
                onChange={setDateRange}
            />
        </div>

        <DataTable
            columns={columns}
            data={payments}
            isLoading={isLoading}
            emptyMessage="No payments found"
        />
      </div>
    </AdminLayout>
  );
};

export default Payments;
