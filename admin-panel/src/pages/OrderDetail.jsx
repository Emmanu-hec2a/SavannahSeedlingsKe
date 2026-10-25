import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import Badge from '../components/ui/Badge';
import StatusTimeline from '../components/ui/StatusTimeline';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
    ChevronLeft, Mail, Phone, MapPin, Package,
    CreditCard, Truck, CheckCircle, XCircle, RefreshCw
} from 'lucide-react';
import { ordersService } from '../services/orders';
import { paymentsService } from '../services/payments';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

const OrderDetail = () => {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [isActionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [deliveryQuote, setDeliveryQuote] = useState('');

  useEffect(() => {
    setDeliveryQuote(order?.delivery_fee ?? '');
  }, [order?.delivery_fee]);

  const saveDeliveryQuote = async (event) => {
    event.preventDefault();
    setActionLoading(true);
    try {
      const updated = await ordersService.quoteDelivery(orderNumber, deliveryQuote);
      setOrder(updated);
      toast.success('Delivery fee saved. Confirm the final total with the buyer on WhatsApp.');
    } catch (err) {
      const detail = err.response?.data;
      toast.error(detail?.delivery_fee?.[0] || detail?.detail || 'Could not save the delivery quote.');
    } finally { setActionLoading(false); }
  };

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const data = await ordersService.get(orderNumber);
      setOrder(data);
    } catch (err) {
      toast.error('Failed to load order');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderNumber]);

  const handleAction = async (action) => {
    setActionLoading(true);
    try {
      if (action === 'ship') {
        await ordersService.updateStatus(orderNumber, 'shipped');
        toast.success('Order marked as Shipped');
      } else if (action === 'deliver') {
        await ordersService.markDelivered(orderNumber);
        toast.success('Order delivered & balance collected');
      } else if (action === 'cancel') {
        await ordersService.cancel(orderNumber);
        toast.success('Order cancelled');
      } else if (action === 'manual_pay') {
        await ordersService.updateStatus(orderNumber, 'confirmed', { deposit_paid: true });
        toast.success('Manual payment confirmed');
      } else if (action === 'balance_pay') {
        await ordersService.updateStatus(orderNumber, order.status, { balance_collected: true });
        toast.success('Balance marked as collected');
      } else if (action === 'query') {
        // Find latest transaction checkout request id
        const tx = order.transactions?.[0];
        if (tx) {
            const res = await paymentsService.query(tx.checkout_request_id);
            toast.success(res.deposit_paid ? 'Payment confirmed!' : 'Payment still pending');
        }
      } else if (action === 'stk') {
        await paymentsService.retriggerStk(orderNumber);
        toast.success('STK Push sent to customer');
      }
      fetchOrder();
    } catch (err) {
      toast.error('Action failed');
    } finally {
      setActionLoading(false);
      setConfirmOpen(false);
    }
  };

  if (isLoading || !order) {
    return (
      <AdminLayout title="Order Details">
        <div className="skeleton h-8 w-48 mb-6"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <div className="card h-64 skeleton"></div>
                <div className="card h-48 skeleton"></div>
            </div>
            <div className="space-y-8">
                <div className="card h-48 skeleton"></div>
                <div className="card h-48 skeleton"></div>
            </div>
        </div>
      </AdminLayout>
    );
  }

  const steps = [
    ...(order.payment_method === 'whatsapp' ? [{ label: 'Delivery quote', status: 'pending_confirmation' }] : []),
    { label: 'Awaiting Payment', status: 'pending_deposit' },
    { label: 'Confirmed', status: 'confirmed' },
    { label: 'Shipped', status: 'shipped' },
    { label: 'Delivered', status: 'delivered' },
  ];

  const subtotal = order.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  return (
    <AdminLayout title={`Order ${order.order_number}`}>
      <Link to="/orders" className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-cyan-600 mb-6 transition-colors group">
        <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-1" />
        Back to Orders
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header Card */}
          <div className="card !p-0 overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-mono font-bold text-neutral-900 tracking-tight">{order.order_number}</h1>
                <p className="text-xs text-neutral-400 mt-1">
                  Placed on {(() => {
                    if (!order.created_at) return '—';
                    const d = new Date(order.created_at);
                    if (isNaN(d.getTime())) return '—';
                    return format(d, 'MMMM dd, yyyy @ HH:mm');
                  })()}
                </p>
              </div>
              <Badge status={order.status} />
            </div>
            <div className="p-8">
              <StatusTimeline steps={steps} currentStep={order.status} />
            </div>
          </div>

          {/* Customer & Shipping */}
          <div className="card grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-md font-bold text-neutral-800 flex items-center gap-2">
                <Mail size={18} className="text-cyan-500" />
                Customer Contact
              </h3>
              <div className="space-y-2">
                <p className="text-md font-semibold text-neutral-900">{order.customer_name}</p>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <Mail size={14} /> {order.customer_email}
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <Phone size={14} /> {order.customer_phone}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-md font-bold text-neutral-800 flex items-center gap-2">
                <MapPin size={18} className="text-cyan-500" />
                Delivery Address
              </h3>
              <div className="space-y-1">
                <p className="text-sm text-neutral-700 leading-relaxed">{order.delivery_address}</p>
                <p className="text-sm text-neutral-900 font-medium">{order.city}, {order.county}</p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="card !p-0 overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex items-center gap-2">
                <Package size={20} className="text-cyan-500" />
                <h3 className="text-md font-bold text-neutral-800">Order Items</h3>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th className="!pl-6">Product</th>
                  <th>Variant</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right !pr-6">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {order.items.map((item, i) => (
                  <tr key={i}>
                    <td className="!pl-6 font-medium text-neutral-900">{item.product_slug}</td>
                    <td className="text-xs text-neutral-500">{item.variant_id || 'Standard'}</td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-right font-mono text-xs">KSh {Number(item.unit_price).toLocaleString()}</td>
                    <td className="text-right !pr-6 font-mono text-sm font-bold">KSh {(item.unit_price * item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-6 bg-neutral-50 space-y-3">
                <div className="flex justify-between text-sm text-neutral-500">
                    <span>Subtotal</span>
                    <span className="font-mono">KSh {Number(subtotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-neutral-500">
                    <span>Delivery Fee</span>
                    <span className="font-mono">{order.delivery_fee == null ? 'Not quoted — agree on WhatsApp' : `KSh ${Number(order.delivery_fee).toLocaleString()}`}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-neutral-900 pt-3 border-top border-neutral-200">
                    <span>Total Amount</span>
                    <span className="font-mono text-cyan-600">{order.total_amount == null ? 'Awaiting delivery quote' : `KSh ${Number(order.total_amount).toLocaleString()}`}</span>
                </div>
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-8">
            {!order.deposit_paid && ['pending_confirmation', 'pending_deposit'].includes(order.status) && (
              <form className="card space-y-4" onSubmit={saveDeliveryQuote}>
                <h3 className="font-bold text-neutral-800">Agreed delivery fee</h3>
                <p className="text-sm text-neutral-500">Agree delivery with the buyer on WhatsApp, then record the fee here. Enter 0 only if free delivery was explicitly agreed.</p>
                <label className="block text-sm font-medium" htmlFor="delivery-quote">Delivery fee (KES)</label>
                <input id="delivery-quote" className="w-full border border-neutral-200 rounded-lg px-3 py-2" type="number" min="0" max="99999999.99" step="0.01" value={deliveryQuote} onChange={event => setDeliveryQuote(event.target.value)} placeholder="Not yet quoted" required disabled={isActionLoading} />
                <button className="btn btn-primary w-full" type="submit" disabled={isActionLoading}>{isActionLoading ? 'Saving…' : 'Save delivery quote'}</button>
              </form>
            )}
            {/* Payment Summary */}
            <div className="card space-y-6">
                <h3 className="text-md font-bold text-neutral-800 flex items-center gap-2">
                    <CreditCard size={18} className="text-cyan-500" />
                    Payment Summary
                </h3>
                <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-green-50 border border-green-100">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-green-700 uppercase">Full order payment</span>
                            {order.deposit_paid ? (
                                <span className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">PAID</span>
                            ) : (
                                <span className="bg-orange-400 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">PENDING</span>
                            )}
                        </div>
                        <p className="text-xl font-mono font-bold text-green-700">{order.deposit_amount == null ? 'Final total not yet agreed' : `KSh ${Number(order.deposit_amount).toLocaleString()}`}</p>
                    </div>

                    {Number(order.balance_amount) > 0 && <div className="p-4 rounded-lg bg-orange-50 border border-orange-100">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-orange-700 uppercase">Balance on Delivery</span>
                            {order.balance_collected ? (
                                <span className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">COLLECTED</span>
                            ) : (
                                <span className="bg-orange-400 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">DUE</span>
                            )}
                        </div>
                        <p className="text-xl font-mono font-bold text-orange-700">KSh {Number(order.balance_amount).toLocaleString()}</p>
                        {!order.balance_collected && order.status !== 'cancelled' && (
                            <button
                                onClick={() => { setConfirmAction('balance_pay'); setConfirmOpen(true); }}
                                className="mt-3 w-full py-2 text-xs font-bold bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                            >
                                Mark as Collected
                            </button>
                        )}
                    </div>}
                </div>

                <div className="text-xs space-y-1">
                    <p className="flex justify-between text-neutral-400">
                        Method: <span className="text-neutral-700 font-medium">{order.payment_method === 'whatsapp' ? 'Arrange on WhatsApp' : order.payment_method.toUpperCase()}</span>
                    </p>
                </div>
            </div>

            {/* M-PESA Card */}
            {order.transactions?.length > 0 && (
                <div className="card space-y-4">
                    <h3 className="text-sm font-bold text-neutral-800">Latest Transaction</h3>
                    <div className="space-y-3 text-xs">
                        <div className="flex flex-col gap-1">
                            <span className="text-neutral-400 uppercase font-bold text-[10px]">Checkout ID</span>
                            <span className="font-mono text-neutral-700 break-all">{order.transactions[0].checkout_request_id}</span>
                        </div>
                        {order.transactions[0].mpesa_receipt_number && (
                            <div className="flex flex-col gap-1">
                                <span className="text-neutral-400 uppercase font-bold text-[10px]">Receipt Number</span>
                                <span className="font-mono font-bold text-green-600">{order.transactions[0].mpesa_receipt_number}</span>
                            </div>
                        )}
                        <div className="flex flex-col gap-1">
                            <span className="text-neutral-400 uppercase font-bold text-[10px]">Result</span>
                            <span className="text-neutral-700">{order.transactions[0].result_desc || 'Pending callback...'}</span>
                        </div>
                    </div>
                    {!order.deposit_paid && (
                        <button
                            onClick={() => handleAction('query')}
                            disabled={isActionLoading}
                            className="btn btn-outline w-full py-2 text-xs gap-2"
                        >
                            <RefreshCw size={14} className={isActionLoading ? 'animate-spin' : ''} />
                            Sync Payment Status
                        </button>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="card space-y-4 bg-neutral-900 text-white">
                <h3 className="text-sm font-bold text-neutral-400 flex items-center gap-2">
                    Available Actions
                </h3>
                <div className="space-y-2">
                    {order.status === 'pending_deposit' && order.delivery_fee != null && (
                        <button
                            onClick={() => { setConfirmAction('manual_pay'); setConfirmOpen(true); }}
                            disabled={isActionLoading}
                            className="btn btn-primary bg-green-600 w-full py-3 gap-2"
                        >
                            <CheckCircle size={18} />
                            Confirm Verified Payment
                        </button>
                    )}
                    {order.payment_method === 'mpesa' && order.status === 'pending_deposit' && !order.deposit_paid && (
                        <button
                            onClick={() => handleAction('stk')}
                            disabled={isActionLoading}
                            className="btn btn-primary w-full py-3 gap-2"
                        >
                            <RefreshCw size={18} />
                            Re-send STK Push
                        </button>
                    )}
                    {order.status === 'confirmed' && (
                        <button
                            onClick={() => { setConfirmAction('ship'); setConfirmOpen(true); }}
                            className="btn btn-primary bg-cyan-500 w-full py-3 gap-2"
                        >
                            <Truck size={18} />
                            Mark as Shipped
                        </button>
                    )}
                    {order.status === 'shipped' && (
                        <button
                            onClick={() => { setConfirmAction('deliver'); setConfirmOpen(true); }}
                            className="btn btn-primary bg-green-500 w-full py-3 gap-2"
                        >
                            <CheckCircle size={18} />
                            Mark Delivered
                        </button>
                    )}
                    {order.status !== 'cancelled' && order.status !== 'delivered' && (
                        <button
                            onClick={() => { setConfirmAction('cancel'); setConfirmOpen(true); }}
                            className="btn bg-white/10 hover:bg-red-500/20 text-red-400 w-full py-3 gap-2"
                        >
                            <XCircle size={18} />
                            Cancel Order
                        </button>
                    )}
                </div>
            </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Are you sure?"
        message={
            confirmAction === 'cancel' ? "This will permanently cancel the order. This action cannot be undone." :
            confirmAction === 'ship' ? "Confirm that items are packaged and handed to the courier." :
            confirmAction === 'manual_pay' ? "Confirm that you have received and independently verified the full agreed order payment, including delivery." :
            confirmAction === 'balance_pay' ? "Confirm that the outstanding balance has been received." :
            "Confirm that the seedlings have been delivered to the buyer."
        }
        onConfirm={() => handleAction(confirmAction)}
        onCancel={() => setConfirmOpen(false)}
      />
    </AdminLayout>
  );
};

export default OrderDetail;
