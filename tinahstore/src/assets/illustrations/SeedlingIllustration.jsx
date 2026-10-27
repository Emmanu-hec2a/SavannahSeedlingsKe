import React from 'react';

export default function SeedlingIllustration({ color = '#2e7d32', detailed = false, className = '' }) {
  return (
    <svg className={`w-full h-full ${className}`} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="54" fill="#E8F5E9" />
      {/* Soil mound */}
      <path d="M25 90 C 40 82, 80 82, 95 90 C 85 98, 35 98, 25 90 Z" fill="#795548" />
      {/* Plant stem */}
      <path d="M60 85 V 40" stroke="#2E7D32" strokeWidth="6" strokeLinecap="round" />
      {/* Left Leaf */}
      <path className="seedling-leaf seedling-leaf-left" d="M60 55 C 40 50, 30 35, 30 25 C 45 25, 58 38, 60 55 Z" fill="#2E7D32" />
      {/* Right Leaf */}
      <path className="seedling-leaf seedling-leaf-right" d="M60 45 C 80 40, 90 25, 90 15 C 75 15, 62 28, 60 45 Z" fill="#4CAF50" />
      {/* Top sprout */}
      <path className="seedling-leaf seedling-leaf-top" d="M60 40 C 55 30, 58 20, 60 18 C 62 20, 65 30, 60 40 Z" fill="#81C784" />
      {/* Sun Ray / Fruit accent */}
      {detailed && <circle cx="85" cy="30" r="8" fill="#E67E22" opacity="0.85" />}
    </svg>
  );
}
