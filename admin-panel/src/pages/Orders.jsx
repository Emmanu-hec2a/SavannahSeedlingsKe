import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import SearchInput from '../components/ui/SearchInput';
import SelectFilter from '../components/ui/SelectFilter';
import DateRangePicker from '../components/ui/DateRangePicker';
import Pagination from '../components/ui/Pagination';
import { Eye, Truck, CheckCircle, RefreshCcw } from 'lucide-react';
import { ordersService } from '../services/orders';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

const STATUS_OPTIONS = [
  { label: 'All Statuses',    value: 'all' },
  { label: 'Awaiting WhatsApp', value: 'pending_confirmation' },
  { label: 'Pending Deposit', value: 'pending_deposit' },
  { label: 'Confirmed',       value: 'confirmed' },
  { label: 'Shipped',         value: 'shipped' },
  { label: 'Delivered',       value: 'delivered' },
  { label: 'Cancelled',       value: 'cancelled' },
];

const Orders = () => {
  const [orders, setOrders]       = useState([]);
  const [total, setTotal]         = useState(0);
  const [isLoading, setLoading]   = useState(true);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [status, setStatus]       = useState('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const fetchOrders = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const params = {
        page,
        search: search || undefined,
        status: status === 'all' ? undefined : status,
        created_at_after:  dateRange.from || undefined,
        created_at_before: dateRange.to   || undefined,
      };

      const data = await ordersService.list(params);

      // DRF paginated response: { count, next, previous, results: [...] }
      // Guard against both shapes so the page never crashes
      const list  = Array.isArray(data) ? data : (data.results ?? []);
      const count = Array.isArray(data) ? data.length : (data.count ?? 0);

      setOrders(list);
      setTotal(count);
    } catch (err) {
      if (!isBackground) toast.error('Failed to load orders');
      console.error(err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [page, search, status, dateRange]);

  // Fetch on filter / page change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Background auto-refresh every 30 s
  useEffect(() => {
    const interval = setInterval(() => fetchOrders(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Reset to page 1 whenever filters change so pagination stays consistent
  useEffect(() => {
    setPage(1);
  }, [search, status, dateRange]);

  const handleStatusUpdate = async (orderNumber, newStatus) => {
    try {
      await ordersService.updateStatus(orderNumber, newStatus);
      toast.success(`Order ${orderNumber} marked as ${newStatus}`);
      fetchOrders(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatus('all');
    setDateRange({ from: '', to: '' });
    setPage(1);
  };

  const columns = [
    {
      header: 'Order #',
      accessor: 'order_number',
      className: 'font-mono font-medium text-cyan-600',
    },
    {
      header: 'Customer',
      accessor: 'customer_name',
    },
    {
      header: 'Phone',
      accessor: 'customer_phone',
      className: 'text-neutral-500',
    },
    {
      header: 'Items',
      // items may be a nested array or just a count integer depending on serializer
      render: (row) => {
        if (Array.isArray(row.items)) return row.items.length;
        if (typeof row.items_count === 'number') return row.items_count;
        return '—';
      },
    },
    {
      header: 'Total',
      render: (row) => (
        <span className="font-mono text-sm">
          {row.total_amount == null ? 'Awaiting delivery quote' : `KSh ${Number(row.total_amount).toLocaleString()}`}
        </span>
      ),
    },
    {
      header: 'Payment',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs">
            {row.deposit_amount == null ? 'Total not yet agreed' : `KSh ${Number(row.deposit_amount).toLocaleString()}`}
          </span>
          <span className={`text-[10px] font-semibold ${row.deposit_paid ? 'text-green-600' : 'text-orange-500'}`}>
            {row.deposit_paid ? 'Paid' : 'Pending'}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => <Badge status={row.status} />,
    },
    {
      header: 'Date',
      render: (row) => {
        if (!row.created_at) return '—';
        try {
          const date = new Date(row.created_at);
          if (isNaN(date.getTime())) return '—';
          return format(date, 'MMM dd, yyyy');
        } catch {
          return '—';
        }
      },
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Link
            to={`/orders/${row.order_number}`}
            className="p-1.5 text-neutral-400 hover:text-cyan-500 hover:bg-cyan-50 rounded-md transition-all"
            title="View Details"
          >
            <Eye size={18} />
          </Link>

          {row.status === 'confirmed' && (
            <button
              onClick={() => handleStatusUpdate(row.order_number, 'shipped')}
              className="p-1.5 text-neutral-400 hover:text-teal-500 hover:bg-teal-50 rounded-md transition-all"
              title="Mark Shipped"
            >
              <Truck size={18} />
            </button>
          )}

          {row.status === 'shipped' && (
            <button
              onClick={() => handleStatusUpdate(row.order_number, 'delivered')}
              className="p-1.5 text-neutral-400 hover:text-green-500 hover:bg-green-50 rounded-md transition-all"
              title="Mark Delivered"
            >
              <CheckCircle size={18} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Orders">
      <div className="flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-neutral-900">Orders</h2>
            <span className="bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full text-xs font-bold">
              {total}
            </span>
          </div>
          <button
            onClick={() => fetchOrders()}
            className="btn btn-outline gap-2 py-1.5"
            disabled={isLoading}
          >
            <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-card shadow-sm border border-neutral-100">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Order # or customer name..."
          />
          <SelectFilter
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onChange={setDateRange}
          />
          <button
            onClick={handleClearFilters}
            className="text-sm font-medium text-cyan-600 hover:text-cyan-700 ml-auto"
          >
            Clear Filters
          </button>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          emptyMessage="No orders found matching your filters."
        />

        {/* Pagination — only rendered when there's something to page through */}
        {total > 20 && (
          <Pagination
            page={page}
            total={total}
            perPage={20}
            onChange={setPage}
          />
        )}

      </div>
    </AdminLayout>
  );
};

export default Orders;
