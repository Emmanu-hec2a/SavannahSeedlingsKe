import React, { useState, useEffect, useContext } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { Store, ShieldCheck, User, Save, Truck, Sprout } from 'lucide-react';
import { authService } from '../services/auth';
import { AdminContext } from '../context/AdminContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { clearAdminSession } from '../services/adminSession';

const Settings = () => {
  const { user } = useContext(AdminContext);
  const [passData, setPassData] = useState({ old: '', new: '', confirm: '' });
  const [isChanging, setChanging] = useState(false);

  const [deliveryData, setDeliveryData] = useState({ nairobi_delivery_fee: '0.00', upcountry_delivery_fee: '250.00' });
  const [isUpdatingDelivery, setUpdatingDelivery] = useState(false);

  useEffect(() => {
    async function fetchDeliverySettings() {
      try {
        const res = await api.get('/orders/delivery-settings/');
        if (res.data) {
          setDeliveryData({
            nairobi_delivery_fee: res.data.nairobi_delivery_fee,
            upcountry_delivery_fee: res.data.upcountry_delivery_fee,
          });
        }
      } catch (err) {
        console.warn('Failed to load delivery settings', err);
      }
    }
    fetchDeliverySettings();
  }, []);

  const handlePassChange = async (e) => {
    e.preventDefault();
    if (passData.new !== passData.confirm) {
        toast.error('New passwords do not match');
        return;
    }
    setChanging(true);
    try {
        await authService.changePassword(passData.old, passData.new);
        toast.success('Password updated. Sign in again with your new password.');
        setPassData({ old: '', new: '', confirm: '' });
        clearAdminSession();
    } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally {
        setChanging(false);
    }
  };

  const handleDeliverySave = async (e) => {
    e.preventDefault();
    setUpdatingDelivery(true);
    try {
      const response = await api.patch('/orders/delivery-settings/', {
        nairobi_delivery_fee: deliveryData.nairobi_delivery_fee,
        upcountry_delivery_fee: deliveryData.upcountry_delivery_fee,
      });
      setDeliveryData({
        nairobi_delivery_fee: response.data.nairobi_delivery_fee,
        upcountry_delivery_fee: response.data.upcountry_delivery_fee,
      });
      toast.success('Delivery rates updated successfully!');
    } catch (err) {
      const errors = err.response?.data;
      const fieldError = errors?.nairobi_delivery_fee?.[0]
        ? `Nairobi delivery fee: ${errors.nairobi_delivery_fee[0]}`
        : errors?.upcountry_delivery_fee?.[0]
          ? `Upcountry delivery fee: ${errors.upcountry_delivery_fee[0]}` : null;
      toast.error(errors?.detail || fieldError || 'Failed to update delivery settings');
    } finally {
      setUpdatingDelivery(false);
    }
  };

  return (
    <AdminLayout title="Settings & Business Logic">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
            {/* Delivery & Rates Settings */}
            <div className="card space-y-6">
                <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Truck size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-neutral-900">Delivery Rates Management</h3>
                      <p className="text-xs text-neutral-400">Legacy M-PESA rates only. WhatsApp orders use the delivery quote saved on each order.</p>
                    </div>
                </div>

                <form onSubmit={handleDeliverySave} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="label" htmlFor="nairobi-delivery-fee">Nairobi Region Delivery Fee (KSh)</label>
                    <input
                      id="nairobi-delivery-fee"
                      type="number"
                      min="0"
                      max="99999999.99"
                      step="0.01"
                      required
                      className="input font-mono"
                      value={deliveryData.nairobi_delivery_fee}
                      onChange={(e) => setDeliveryData({ ...deliveryData, nairobi_delivery_fee: e.target.value })}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-emerald-600">Set to 0.00 for FREE Nairobi Delivery</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="label" htmlFor="upcountry-delivery-fee">Upcountry / Rest of Kenya Delivery Fee (KSh)</label>
                    <input
                      id="upcountry-delivery-fee"
                      type="number"
                      min="0"
                      max="99999999.99"
                      step="0.01"
                      required
                      className="input font-mono"
                      value={deliveryData.upcountry_delivery_fee}
                      onChange={(e) => setDeliveryData({ ...deliveryData, upcountry_delivery_fee: e.target.value })}
                      placeholder="250.00"
                    />
                  </div>

                  <button type="submit" disabled={isUpdatingDelivery} className="btn bg-emerald-700 text-white hover:bg-emerald-800 w-full gap-2 mt-4">
                    <Save size={18} />
                    {isUpdatingDelivery ? 'Updating Delivery Settings...' : 'Save Delivery Settings'}
                  </button>
                </form>
            </div>

            {/* Store Config */}
            <div className="card space-y-6">
                <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                        <Store size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900">Business Logic & Payment System</h3>
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-neutral-50">
                        <span className="text-sm text-neutral-500">Checkout Payment Model</span>
                        <span className="font-bold text-emerald-700">100% Full Payment</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-neutral-50">
                        <span className="text-sm text-neutral-500">M-PESA Receiving Phone</span>
                        <span className="font-bold text-neutral-900">0710583989 (SAVANNAH SEEDLINGS)</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-neutral-500">WhatsApp Inquiries</span>
                        <span className="font-bold text-neutral-900">+254 710 583 989</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="space-y-8">
            {/* Nursery Info */}
            <div className="card space-y-6">
                <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Sprout size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900">Nursery Locations & Info</h3>
                </div>
                <div className="space-y-4 text-sm">
                    <div>
                        <label className="label">Brand Tagline</label>
                        <p className="font-semibold text-emerald-800">"Seeding Africa for Sustainable fruit farming"</p>
                    </div>
                    <div className="border-t border-neutral-100 pt-3">
                        <label className="label">Nairobi Nursery Location</label>
                        <p className="text-neutral-700 font-medium">Kasarani Kastemil Junction, Nairobi</p>
                    </div>
                    <div className="border-t border-neutral-100 pt-3">
                        <label className="label">Murang'a Nursery Location</label>
                        <p className="text-neutral-700 font-medium">Kwa Samaki Murang'a along Nairobi-Nyeri Highway</p>
                    </div>
                    <div className="border-t border-neutral-100 pt-3">
                        <label className="label">Support Email</label>
                        <p className="text-neutral-700 font-medium">savannahseedlings@gmail.com</p>
                    </div>
                </div>
            </div>

            {/* Security */}
            <div className="card space-y-6">
                <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
                    <div className="p-2 bg-neutral-100 text-neutral-700 rounded-lg">
                        <ShieldCheck size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900">Security & Password</h3>
                </div>
                <form onSubmit={handlePassChange} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="label">Current Password</label>
                        <input
                            type="password" required className="input"
                            value={passData.old} onChange={(e) => setPassData({ ...passData, old: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="label">New Password</label>
                        <input
                            type="password" required className="input"
                            value={passData.new} onChange={(e) => setPassData({ ...passData, new: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="label">Confirm New Password</label>
                        <input
                            type="password" required className="input"
                            value={passData.confirm} onChange={(e) => setPassData({ ...passData, confirm: e.target.value })}
                        />
                    </div>
                    <button type="submit" disabled={isChanging} className="btn btn-outline w-full gap-2 mt-4">
                        <Save size={18} />
                        {isChanging ? 'Updating Password...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Settings;
