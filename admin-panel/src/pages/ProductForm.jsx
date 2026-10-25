import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import ImageUploadZone from '../components/ui/ImageUploadZone';
import VariantRow from '../components/ui/VariantRow';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { ChevronLeft, Plus, Save, Sprout } from 'lucide-react';
import { productsService } from '../services/products';
import { categoriesService } from '../services/categories';
import { toast } from 'react-hot-toast';

const EMPTY_FORM = {
  name: '',
  slug: '',
  category_id: '',
  description: '',
  planting_procedure: '',
  material: '',
  price: '',
  original_price: '',
  is_active: true,
};

const EMPTY_VARIANT = {
  color_name: 'Grafted',
  color_hex: '#2E7D32',
  size: 'Standard',
  stock: 50,
};

const ProductForm = () => {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const isEdit     = !!slug;

  const variantKeyRef = useRef(0);
  const nextKey = () => {
    variantKeyRef.current += 1;
    return variantKeyRef.current;
  };

  const [categories, setCategories] = useState([]);
  const [isLoading, setLoading]     = useState(isEdit);
  const [isSaving, setSaving]       = useState(false);
  const [formData, setFormData]     = useState(EMPTY_FORM);

  const [variants, setVariants] = useState([]);
  const [images, setImages]     = useState([]);

  useEffect(() => {
    const init = async () => {
      try {
        const catData = await categoriesService.list();
        const catList = Array.isArray(catData)
          ? catData
          : (catData.results ?? []);
        setCategories(catList);

        if (isEdit) {
          const data = await productsService.get(slug);
          setFormData({
            name:               data.name,
            slug:               data.slug,
            category_id:        data.category?.id ?? data.category ?? '',
            description:        data.description,
            planting_procedure: data.planting_procedure ?? '',
            material:           data.material ?? '',
            price:              data.price,
            original_price:     data.original_price ?? '',
            is_active:          data.is_active,
          });
          setImages(
            (data.images ?? []).map(img => ({
              id:      img.id,
              preview: img.image,
              file:    null,
            }))
          );
          setVariants(
            (data.variants ?? []).map(v => ({ ...v, _key: nextKey() }))
          );
        }
      } catch (err) {
        toast.error('Failed to load seedling data');
        navigate('/products');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [slug, isEdit, navigate]);

  const handleNameChange = (name) => {
    const generatedSlug = name
      .toLowerCase()
      .replace(/ /g, '-')
      .replace(/[^\w-]+/g, '');
    setFormData(prev => ({ ...prev, name, slug: generatedSlug }));
  };

  const handleField = (key, value) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const handleAddVariant = () =>
    setVariants(prev => [...prev, { ...EMPTY_VARIANT, _key: nextKey() }]);

  const handleVariantChange = (key, value) =>
    setVariants(prev =>
      prev.map(v => (v._key === key ? { ...value, _key: key } : v))
    );

  const handleVariantRemove = (key) =>
    setVariants(prev => prev.filter(v => v._key !== key));

  const handleImageUpload = (files) => {
    const staged = Array.from(files).map(file => ({
      id:      null,
      preview: URL.createObjectURL(file),
      file,
    }));
    setImages(prev => [...prev, ...staged]);
    toast.success(`${files.length} image${files.length > 1 ? 's' : ''} staged`);
  };

  const handleImageRemove = (index) => {
    setImages(prev => {
      const removed = prev[index];
      if (removed.file) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = new FormData();

      data.append('name',               formData.name);
      data.append('slug',               formData.slug);
      data.append('category_id',        formData.category_id);
      data.append('description',        formData.description);
      data.append('planting_procedure', formData.planting_procedure);
      data.append('material',           formData.material);
      data.append('price',              formData.price);

      data.append('is_active', formData.is_active ? 1 : 0);

      if (formData.original_price !== '' && formData.original_price !== null) {
        data.append('original_price', formData.original_price);
      }

      const variantsForApi = variants.map(({ _key, ...rest }) => rest);
      data.append('variants_json', JSON.stringify(variantsForApi));

      images
        .filter(img => img.file !== null)
        .forEach(img => data.append('images', img.file));

      if (isEdit) {
        await productsService.update(slug, data);
        toast.success('Seedling updated successfully');
      } else {
        await productsService.create(data);
        toast.success('Seedling created successfully');
      }

      navigate('/products');
    } catch (err) {
      const detail = err?.response?.data;
      if (detail && typeof detail === 'object') {
        const firstKey = Object.keys(detail)[0];
        toast.error(`${firstKey}: ${detail[firstKey]}`);
      } else {
        toast.error('Failed to save seedling');
      }
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Loading...">
        <div className="skeleton h-[600px] w-full rounded-card" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={isEdit ? 'Edit Seedling' : 'Add New Seedling'}>
      <Link
        to="/products"
        className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-emerald-600 mb-6 transition-colors group"
      >
        <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-1" />
        Back to Seedlings Catalog
      </Link>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-8">

          {/* Basic information */}
          <div className="card space-y-6">
            <h3 className="text-lg font-bold text-neutral-900 border-b border-neutral-100 pb-4 flex items-center gap-2">
              <Sprout className="text-emerald-600" size={20} /> Seedling Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="label">Seedling Variety Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="input"
                  placeholder="e.g. Grafted Hass Avocado Seedling"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label">URL Slug</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => handleField('slug', e.target.value)}
                  className="input font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="label">Fruit Category</label>
                <select
                  required
                  value={formData.category_id}
                  onChange={(e) => handleField('category_id', e.target.value)}
                  className="input bg-white"
                >
                  <option key="placeholder" value="">Select fruit category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="label">Propagation Type / Rootstock</label>
                <input
                  type="text"
                  value={formData.material}
                  onChange={(e) => handleField('material', e.target.value)}
                  className="input"
                  placeholder="e.g. Certified Grafted / Rootstock"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="label">Description</label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => handleField('description', e.target.value)}
                className="input resize-none"
                placeholder="Describe fruiting period, yield, ecological altitude, drought tolerance..."
              />
            </div>

            <div className="space-y-1.5 bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
              <label className="label font-bold text-emerald-900 flex items-center gap-1.5">
                <Sprout size={16} className="text-emerald-600" /> Planting & Care Procedure
              </label>
              <p className="text-xs text-emerald-700 mb-2">
                Step-by-step instructions displayed on storefront product page for farmers.
              </p>
              <textarea
                rows={5}
                value={formData.planting_procedure}
                onChange={(e) => handleField('planting_procedure', e.target.value)}
                className="input bg-white resize-y font-sans text-sm"
                placeholder={"1. Dig a 2ft x 2ft x 2ft hole.\n2. Mix topsoil with 15-20kg of well-rotted manure.\n3. Remove plastic sleeve without disturbing roots.\n4. Water thoroughly immediately after planting."}
              />
            </div>
          </div>

          {/* Variants */}
          <div className="card space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Stock & Batches</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Define seedling nursery stock levels.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddVariant}
                className="btn btn-outline btn-sm gap-2 text-emerald-600 border-emerald-100 hover:bg-emerald-50"
              >
                <Plus size={16} /> Add Batch
              </button>
            </div>

            <div className="space-y-3">
              {variants.length === 0 ? (
                <div className="py-8 text-center bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
                  <p className="text-sm text-neutral-400">
                    No variants added. Click above to add stock batch details.
                  </p>
                </div>
              ) : (
                variants.map((v) => (
                  <VariantRow
                    key={v._key}
                    data={v}
                    onChange={(val) => handleVariantChange(v._key, val)}
                    onRemove={() => handleVariantRemove(v._key)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-8">

          {/* Pricing & status */}
          <div className="card space-y-4">
            <h3 className="text-lg font-bold text-neutral-900 border-b border-neutral-100 pb-4">
              Pricing & Storefront Status
            </h3>

            <div className="space-y-1.5">
              <label className="label">Price per Seedling (KSh)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleField('price', e.target.value)}
                className="input font-mono"
                placeholder="250.00"
              />
            </div>

            <div className="space-y-1.5">
              <label className="label">
                Original Price{' '}
                <span className="text-neutral-400 font-normal">
                  (optional — strike-through)
                </span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.original_price}
                onChange={(e) => handleField('original_price', e.target.value)}
                className="input font-mono"
                placeholder="300.00"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-100">
              <div>
                <p className="text-sm font-bold text-neutral-800">Available in Nursery Store</p>
                <p className="text-xs text-neutral-500">Toggle visibility on storefront</p>
              </div>
              <ToggleSwitch
                checked={formData.is_active}
                onChange={(val) => handleField('is_active', val)}
              />
            </div>
          </div>

          {/* Images */}
          <div className="card space-y-4">
            <h3 className="text-lg font-bold text-neutral-900 border-b border-neutral-100 pb-4">
              Seedling Photos
            </h3>
            <ImageUploadZone
              previews={images.map(img => img.preview)}
              onUpload={handleImageUpload}
              onRemove={handleImageRemove}
            />
            {images.length > 0 && (
              <p className="text-xs text-neutral-400">
                {images.filter(i => i.file).length} new photo(s) will be uploaded on save.
              </p>
            )}
          </div>

          {/* Sticky save actions */}
          <div className="sticky bottom-8 space-y-3">
            <button
              type="submit"
              disabled={isSaving}
              className="btn btn-primary w-full py-4 text-md shadow-xl shadow-emerald-600/20 gap-3 disabled:opacity-60 bg-emerald-700 hover:bg-emerald-800 border-none"
            >
              <Save size={20} />
              {isSaving ? 'Saving…' : isEdit ? 'Update Seedling' : 'Create Seedling'}
            </button>
            <Link
              to="/products"
              className="btn btn-outline w-full py-3 bg-white text-center"
            >
              Discard Changes
            </Link>
          </div>
        </div>

      </form>
    </AdminLayout>
  );
};

export default ProductForm;
