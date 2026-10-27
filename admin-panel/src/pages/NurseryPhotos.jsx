import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import AdminLayout from '../components/layout/AdminLayout';
import { nurseryPhotosService } from '../services/nurseryPhotos';

const empty = () => ({ caption: '', alt_text: '', position: 0, is_active: true, is_featured: false });

function errorMessage(error) {
  const data = error.response?.data;
  if (!data) return 'Could not confirm the change. Your draft is still here. Refresh the photo list to check the saved state before retrying.';
  return Object.entries(data).map(([key, value]) => `${key === 'detail' ? '' : `${key}: `}${Array.isArray(value) ? value.join(' ') : value}`).join(' ');
}

export default function NurseryPhotos() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');
  const fileInput = useRef(null);
  const formRef = useRef(null);

  async function load() {
    setLoading(true);
    setLoadError('');
    try { setPhotos(await nurseryPhotosService.list()); }
    catch { setLoadError('Could not load nursery photos. Please retry before editing.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function startEdit(photo = null, checkDirty = true) {
    if (checkDirty && dirty && !window.confirm('Discard your unsaved nursery photo changes?')) return;
    setEditing(photo);
    setForm(photo ? { caption: photo.caption, alt_text: photo.alt_text, position: photo.position,
      is_active: photo.is_active, is_featured: photo.is_featured } : empty());
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
    setDirty(false);
    setSaveError('');
  }
  function change(key, value) {
    setForm(current => ({ ...current, [key]: value }));
    setDirty(true);
  }
  function chooseFile(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024) {
      toast.error('Choose a JPEG, PNG or WebP photo, up to 5 MB.');
      event.target.value = '';
      return;
    }
    setFile(selected);
    setDirty(true);
  }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, String(value)));
    if (file) data.append('image', file);
    setBusy(true);
    setSaveError('');
    try {
      await nurseryPhotosService.save(editing?.id, data);
      startEdit(null, false);
      toast.success('Nursery photo saved');
      await load();
    } catch (error) { setSaveError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  async function remove(photo) {
    if (busy || (dirty && !window.confirm('Discard your unsaved changes before removing this photo?'))) return;
    if (!window.confirm('Permanently remove this nursery photo? Hide it instead if you may use it again.')) return;
    setBusy(true);
    try {
      await nurseryPhotosService.remove(photo.id);
      startEdit(null, false);
      toast.success('Nursery photo removed');
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return (
    <AdminLayout title="Nursery Photos">
      <p className="text-neutral-600 mb-8 max-w-3xl">Manage the photos shown in the homepage nursery section. The featured photo appears first, followed by display order (lowest first). Hidden photos stay available here. Photos are compressed and location metadata is removed on upload.</p>
      <button type="button" className="btn btn-outline mb-6" onClick={load} disabled={busy || loading}>Refresh photos</button>
      {loadError && <div role="alert" className="card mb-6 text-red-700">{loadError} <button type="button" onClick={load} className="underline" disabled={busy}>Retry</button></div>}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-2 space-y-6" aria-busy={loading}>
          {loading ? <p role="status">Loading nursery photos…</p> : !loadError && photos.length === 0 ? <div className="card text-neutral-600">No nursery photos yet. The storefront keeps its current illustration until you publish a photo.</div> : null}
          {photos.map(photo => (
            <article key={photo.id} className="card flex flex-col sm:flex-row gap-5">
              <img src={photo.image} alt={photo.alt_text} className="w-full sm:w-40 aspect-[4/3] object-cover rounded-lg" loading="lazy" />
              <div className="min-w-0 flex-1 space-y-3">
                <p className="font-semibold break-words">{photo.caption || photo.alt_text}</p>
                <p className="text-sm text-neutral-600">{photo.is_active ? 'Published' : 'Hidden'}{photo.is_featured ? ' · Featured' : ''} · Order {photo.position}</p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="btn btn-outline" disabled={busy || loading || !!loadError} onClick={() => {
                    startEdit(photo);
                    formRef.current?.scrollIntoView({ block: 'nearest' });
                  }}>Edit photo</button>
                  <button type="button" className="btn btn-outline text-red-700" disabled={busy || loading || !!loadError} onClick={() => remove(photo)}>Remove</button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <form ref={formRef} onSubmit={save} className="card space-y-5" aria-busy={busy}>
          <h2 className="text-lg font-bold">{editing ? 'Edit nursery photo' : 'Add nursery photo'}</h2>
          <fieldset disabled={busy || loading || !!loadError} className="space-y-5 disabled:opacity-60">
            {(preview || editing?.image) && <img src={preview || editing.image} alt="Selected photo preview" className="w-full aspect-[4/3] object-cover rounded-lg" />}
            <div className="space-y-2">
              <label htmlFor="nursery-image" className="label">{editing ? 'Replace photo (optional)' : 'Nursery photo'}</label>
              <input id="nursery-image" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" required={!editing && !file} onChange={chooseFile} className="block w-full text-sm" aria-describedby="nursery-image-help" />
              <p id="nursery-image-help" className="text-xs text-neutral-500">JPEG, PNG or WebP · up to 5 MB. Replacements keep the saved photo until the new upload succeeds.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="nursery-caption" className="label">Caption (optional)</label>
              <input id="nursery-caption" className="input" maxLength={200} value={form.caption} onChange={e => change('caption', e.target.value)} placeholder="Grafted seedlings at our Nairobi nursery" />
            </div>
            <div className="space-y-2">
              <label htmlFor="nursery-alt" className="label">Photo description (accessibility)</label>
              <textarea id="nursery-alt" className="input" required maxLength={200} rows={3} value={form.alt_text} onChange={e => change('alt_text', e.target.value)} placeholder="Describe what is visible in the photo" />
            </div>
            <div className="space-y-2">
              <label htmlFor="nursery-position" className="label">Display order</label>
              <input id="nursery-position" className="input" type="number" required min={0} max={2147483647} step={1} value={form.position} onChange={e => change('position', e.target.value)} />
            </div>
            <label className="flex gap-3 items-center"><input type="checkbox" checked={form.is_active} onChange={e => change('is_active', e.target.checked)} />Published on storefront</label>
            <label className="flex gap-3 items-center"><input type="checkbox" checked={form.is_featured} onChange={e => change('is_featured', e.target.checked)} />Featured photo (shown first)</label>
            {saveError && <p role="alert" className="text-sm text-red-700 break-words">{saveError}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn btn-primary">{busy ? 'Saving…' : 'Save photo'}</button>
              {(editing || dirty) && <button type="button" className="btn btn-outline" onClick={() => startEdit()}>Cancel</button>}
            </div>
          </fieldset>
        </form>
      </div>
    </AdminLayout>
  );
}
