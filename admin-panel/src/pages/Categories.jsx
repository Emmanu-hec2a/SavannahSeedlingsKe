import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import DataTable from '../components/ui/DataTable';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Pencil, Trash2, Save, X } from 'lucide-react';
import { categoriesService } from '../services/categories';
import { toast } from 'react-hot-toast';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [editSlug, setEditSlug] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [formData, setFormData] = useState({ name: '', slug: '', description: '' });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await categoriesService.list();
      const list = Array.isArray(data) ? data : (data.results ?? []);
      setCategories(list);
    } catch (err) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleNameChange = (name) => {
    const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    setFormData(prev => ({ ...prev, name, slug }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editSlug) {
        await categoriesService.update(editSlug, formData);
        toast.success('Category updated');
      } else {
        await categoriesService.create(formData);
        toast.success('Category created');
      }
      setFormData({ name: '', slug: '', description: '' });
      setEditSlug(null);
      fetchCategories();
    } catch (err) {
      toast.error('Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat) => {
    setEditSlug(cat.slug);
    setFormData({ name: cat.name, slug: cat.slug, description: cat.description || '' });
  };

  const handleDelete = async () => {
    try {
        await categoriesService.delete(confirmDelete);
        toast.success('Category removed');
        fetchCategories();
    } catch (err) {
        toast.error('Cannot delete category with products');
    } finally {
        setConfirmDelete(null);
    }
  };

  const columns = [
    { header: 'Name', accessor: 'name', className: 'font-bold text-neutral-900' },
    { header: 'Slug', accessor: 'slug', className: 'font-mono text-xs text-neutral-500' },
    { header: 'Product Count', render: (row) => row.products?.length || 0 },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button
            onClick={() => handleEdit(row)}
            className="p-1.5 text-neutral-400 hover:text-cyan-500 hover:bg-cyan-50 rounded-md transition-all"
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={() => setConfirmDelete(row.slug)}
            className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )
    }
  ];

  return (
    <AdminLayout title="Categories">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
            <h3 className="text-md font-bold text-neutral-800">Manage Categories</h3>
            <DataTable
                columns={columns}
                data={categories}
                isLoading={isLoading}
                emptyMessage="No categories found"
            />
        </div>

        <div className="space-y-4">
            <h3 className="text-md font-bold text-neutral-800">
                {editSlug ? 'Edit Category' : 'Create New Category'}
            </h3>
            <div className="card">
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="label">Category Name</label>
                        <input
                            type="text" required
                            value={formData.name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            className="input" placeholder="e.g. Avocado Seedlings"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="label">Slug</label>
                        <input
                            type="text" required
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                            className="input font-mono text-xs" placeholder="e.g. avocado-seedlings"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="label">Description (Optional)</label>
                        <textarea
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="input resize-none text-sm"
                            placeholder="Describe the seedlings included in this category..."
                        />
                    </div>
                    <div className="pt-4 space-y-3">
                        <button type="submit" disabled={isSaving} className="btn btn-primary w-full gap-2">
                            <Save size={18} />
                            {isSaving ? 'Saving...' : 'Save Category'}
                        </button>
                        {editSlug && (
                            <button
                                type="button"
                                onClick={() => { setEditSlug(null); setFormData({ name: '', slug: '', description: '' }); }}
                                className="btn btn-outline w-full gap-2"
                            >
                                <X size={18} /> Cancel Edit
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Category?"
        message="This will permanently remove this category. Note that you cannot delete categories that still have products assigned to them."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </AdminLayout>
  );
};

export default Categories;
