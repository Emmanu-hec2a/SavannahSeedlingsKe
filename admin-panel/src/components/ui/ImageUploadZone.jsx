import React, { useRef } from 'react';
import { Upload, X, Star } from 'lucide-react';

const ImageUploadZone = ({ onUpload, previews = [], onRemove, onSetPrimary, disabled = false }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0 && !disabled) {
      onUpload(files);
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current.click()}
        className="w-full border-2 border-dashed border-neutral-200 rounded-card p-6 flex flex-col items-center justify-center hover:border-emerald-400 hover:bg-emerald-50 transition-colors disabled:opacity-60"
      >
        <Upload size={24} className="text-emerald-600 mb-3" aria-hidden="true" />
        <span className="text-sm font-medium text-neutral-600">Click to upload product images</span>
        <span className="text-xs text-neutral-400 mt-1">PNG, JPG or WebP (max. 5MB)</span>
      </button>
      <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/*" disabled={disabled} onChange={handleFileChange} aria-label="Upload product images" />

      <div className="grid grid-cols-2 gap-3">
        {previews.map((photo, i) => (
          <div key={photo.id ?? photo.preview} className="min-w-0 rounded-lg border border-neutral-200 bg-white overflow-hidden" data-product-photo>
            <div className="relative aspect-square">
              <img src={photo.preview} alt={`Product photo ${i + 1}`} className="w-full h-full object-cover" />
              {photo.is_primary && <span className="absolute top-2 left-2 px-2 py-1 bg-emerald-700 text-white text-xs font-semibold rounded">Primary</span>}
            </div>
            <div className="p-2 space-y-1">
              <button
                type="button" disabled={disabled} aria-pressed={photo.is_primary}
                onClick={() => onSetPrimary(i)} aria-label={`Make photo ${i + 1} primary`}
                className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
              >
                <Star size={14} fill={photo.is_primary ? 'currentColor' : 'none'} aria-hidden="true" />
                {photo.is_primary ? 'Primary photo' : 'Make primary'}
              </button>
              <button
                type="button" disabled={disabled} title="Remove" aria-label={`Remove photo ${i + 1}`}
                onClick={() => onRemove(i)}
                className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              ><X size={14} aria-hidden="true" /> Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageUploadZone;
