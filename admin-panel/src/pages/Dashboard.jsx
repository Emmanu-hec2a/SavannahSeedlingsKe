import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import StatCard from '../components/ui/StatCard';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import OrdersAreaChart from '../components/charts/OrdersAreaChart';
import RevenueBarChart from '../components/charts/RevenueBarChart';
import { ShoppingBag, TrendingUp, Clock, Truck, ArrowRight, Eye } from 'lucide-react';
import { paymentsService } from '../services/payments';
import { format } from 'date-fns';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await paymentsService.getStats();
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const columns = [
    { header: 'Order #', accessor: 'order_number', className: 'font-mono font-medium text-cyan-600' },
    { header: 'Customer', accessor: 'customer_name' },
    {
        header: 'Items',
        render: (row) => row.items.reduce((sum, item) => sum + item.quantity, 0)
    },
    {
        header: 'Total',
        render: (row) => row.total_amount == null ? 'Awaiting delivery quote' : `KSh ${Number(row.total_amount).toLocaleString()}`
    },
    {
        header: 'Payment',
        render: (row) => (
            <div className="flex flex-col">
                <span className="text-xs font-semibold">{row.deposit_amount == null ? 'Total not yet agreed' : `KSh ${Number(row.deposit_amount).toLocaleString()}`}</span>
                {row.deposit_paid ? (
                    <span className="text-[10px] text-green-500 font-bold uppercase">Paid</span>
                ) : (
                    <span className="text-[10px] text-orange-400 font-bold uppercase">Pending</span>
                )}
            </div>
        )
    },
    { header: 'Status', render: (row) => <Badge status={row.status} /> },
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
      header: 'Action',
      render: (row) => (
        <Link
            to={`/orders/${row.order_number}`}
            className="p-1.5 text-neutral-400 hover:text-cyan-500 hover:bg-cyan-50 rounded-md transition-all inline-flex"
        >
          <Eye size={18} />
        </Link>
      )
    }
  ];

  if (isLoading || !stats) {
      return (
          <AdminLayout title="Dashboard">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {[...Array(4)].map((_, i) => <div key={i} className="card h-24 skeleton"></div>)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <div className="card h-[400px] skeleton"></div>
                  <div className="card h-[400px] skeleton"></div>
              </div>
              <div className="card h-64 skeleton"></div>
          </AdminLayout>
      );
  }

  const diffOrders = stats.orders_today - stats.orders_yesterday;
  const subTextOrders = diffOrders >= 0 ? `+${diffOrders} from yesterday` : `${diffOrders} from yesterday`;

  return (
    <AdminLayout title="Dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Today's Orders"
          value={stats.orders_today}
          sub={subTextOrders}
          icon={ShoppingBag}
          accentColor="cyan"
        />
        <StatCard
          label="Revenue Today"
          value={`KSh ${stats.revenue_today.toLocaleString()}`}
          sub="Deposits collected"
          icon={TrendingUp}
          accentColor="green"
        />
        <StatCard
          label="Orders Awaiting Confirmation / Payment"
          value={stats.pending_deposits_count}
          sub="Requires attention"
          icon={Clock}
          accentColor="orange"
        />
        <StatCard
          label="Balance to Collect"
          value={`KSh ${stats.balance_outstanding.toLocaleString()}`}
          sub={`Across ${stats.balance_orders_count} shipped orders`}
          icon={Truck}
          accentColor="teal"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="text-md font-bold text-neutral-800">Orders over last 30 days</h3>
          <OrdersAreaChart data={stats.orders_last_30_days} />
        </div>
        <div className="card">
          <h3 className="text-md font-bold text-neutral-800">Revenue Breakdown (Deposits vs Balances)</h3>
          <RevenueBarChart data={stats.revenue_last_30_days} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-neutral-900">Recent Orders</h3>
            <Link to="/orders" className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 flex items-center gap-1 group">
                View all orders <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </Link>
        </div>

        <DataTable
            columns={columns}
            data={stats.recent_orders}
            emptyMessage="No orders found yet"
        />
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
