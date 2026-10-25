import React, { useContext } from 'react';
import { AdminContext } from '../context/AdminContext';

export default function SessionStatus() {
  const { loading, sessionError, restoreSession, logout } = useContext(AdminContext);
  if (!loading && !sessionError) return null;
  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center p-6">
      <div className="card w-full max-w-md text-center space-y-4" role={sessionError ? 'alert' : 'status'}>
        <p>{loading ? 'Verifying your staff session...' : sessionError}</p>
        {!loading && <div className="flex justify-center gap-3">
          <button className="btn btn-outline" onClick={restoreSession}>Try again</button>
          <button className="btn btn-outline" onClick={logout}>Sign out</button>
        </div>}
      </div>
    </div>
  );
}
