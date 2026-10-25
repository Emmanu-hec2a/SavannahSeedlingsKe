import React, { useState, useContext } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import SessionStatus from '../components/SessionStatus';
import { AdminContext } from '../context/AdminContext';
import { Lock, User } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { login, user, loading, sessionError } = useContext(AdminContext);
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from;
  const from = destination?.pathname?.startsWith('/') && !destination.pathname.startsWith('//') && destination.pathname !== '/login'
    ? `${destination.pathname}${destination.search || ''}${destination.hash || ''}` : '/dashboard';

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await login(username.trim(), password);
      toast.success('Welcome back to Savannah Seedlings Nursery Admin!');

      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] ||
        (err.response ? 'Unable to sign in. Check your credentials.' : 'Unable to reach the server. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || sessionError) return <SessionStatus />;
  if (user?.is_staff) return <Navigate to={from} replace />;

  return (
    <div className="min-h-screen bg-page-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1b3a20] rounded-2xl mb-4 shadow-lg shadow-[#1b3a20]/20 p-1.5">
            <img src="/logo_seal.png" alt="Savannah Seedlings Logo" className="w-full h-full object-contain rounded-full" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Savannah <span className="text-amber-600">Seedlings</span></h1>
          <p className="text-neutral-500 mt-2 text-sm">Seeding Africa for Sustainable fruit farming</p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="space-y-1.5">
              <label className="label" htmlFor="admin-username">Admin Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  id="admin-username"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input pl-10"
                  placeholder="admin"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label" htmlFor="admin-password">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  id="admin-password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn bg-emerald-700 hover:bg-emerald-800 text-white w-full h-11 text-md font-bold"
            >
              {isLoading ? 'Signing in...' : 'Sign In to Nursery Dashboard'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-neutral-400 mt-8">
          &copy; 2026 Savannah Seedlings. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
