import React from 'react';

export default function SavannahLogo({ className = "", showTagline = false }) {
  return (
    <div className={`brand-lockup inline-flex items-center select-none ${className}`}>
      {/* Official Circular Seal Emblem */}
      <img
        src="/logo_seal.png"
        alt="Savannah Seedlings Logo"
        className={`brand-mark shrink-0 ${showTagline ? 'brand-mark-tagline' : ''}`}
      />
      <div className="brand-copy flex flex-col justify-center">
        <span className="brand-name font-display font-bold tracking-tight text-[#1b5e20] dark:text-[#e8f5e9]">
          <span>Savannah</span> <span className="text-[#e67e22]">Seedlings</span>
        </span>
        {showTagline && (
          <span className="brand-tagline">
            Seeding Kenya for sustainable fruit farming
          </span>
        )}
      </div>
    </div>
  );
}
