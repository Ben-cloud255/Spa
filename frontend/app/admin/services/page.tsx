'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useBranches } from '@/lib/useBranches';
import type { Service, ServiceCategory } from '@/lib/types';

const EMPTY_FORM = { name: '', duration_minutes: '', price: '', description: '', category_id: '', branch_id: '' };

export default function AdminServicesPage() {
  const { branches } = useBranches();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  async function load() {
    const [servicesData, categoriesData] = await Promise.all([
      api.get<{ services: Service[] }>('/services?includeInactive=true'),
      api.get<{ categories: ServiceCategory[] }>('/service-categories'),
    ]);
    setServices(servicesData.services);
    setCategories(categoriesData.categories);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createService(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/services', {
        name: form.name,
        description: form.description,
        duration_minutes: Number(form.duration_minutes),
        price: Number(form.price),
        category_id: form.category_id ? Number(form.category_id) : null,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
      });
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the service.');
    }
  }

  async function createCategory(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/service-categories', { name: newCategoryName });
      setNewCategoryName('');
      setShowCategoryForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the category.');
    }
  }

  async function toggleActive(service: Service) {
    await api.patch(`/services/${service.id}`, { is_active: !service.is_active });
    load();
  }

  async function updateServiceField(service: Service, field: 'category_id' | 'branch_id', value: string) {
    await api.patch(`/services/${service.id}`, { [field]: value ? Number(value) : null });
    load();
  }

  // Group for display: category name -> services, with an "Uncategorized" bucket last.
  const grouped = new Map<string, Service[]>();
  for (const s of services) {
    const key = s.category_name || 'Uncategorized';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }
  const groupNames = [...grouped.keys()].sort((a, b) => (a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b)));

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <h1 className="font-display text-3xl">Services</h1>
        <button
          onClick={() => setShowCategoryForm((v) => !v)}
          className="text-sm text-forest-600 hover:text-forest-800 font-medium"
        >
          {showCategoryForm ? 'Cancel' : '+ New category'}
        </button>
      </div>
      <p className="text-forest-500/70 text-sm mb-6">
        The treatment menu customers can be booked into. Group similar treatments (like the different kinds of
        massage) under one category to keep booking lists short. Leave "Branch" as All branches unless a
        treatment is exclusive to one location.
      </p>

      {showCategoryForm && (
        <form onSubmit={createCategory} className="bg-white rounded-xl2 border border-forest-100 shadow-card p-4 flex flex-wrap items-end gap-3 mb-6">
          <div>
            <label className="block text-xs font-medium text-forest-600 mb-1.5">Category name</label>
            <input
              required
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Massage, Facials"
              className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-52"
            />
          </div>
          <button type="submit" className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium hover:bg-forest-700">
            Add category
          </button>
        </form>
      )}

      <form onSubmit={createService} className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 items-end">
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Service name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
            placeholder="e.g. Bamboo Massage"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Duration (min)</label>
          <input
            required
            type="number"
            min="5"
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Price (TZS)</label>
          <input
            required
            type="number"
            min="0"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Category</label>
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Branch</label>
          <select
            value={form.branch_id}
            onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3 lg:col-span-6">
          <button type="submit" className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium hover:bg-forest-700">
            Add service
          </button>
          {error && <span className="ml-3 text-sm text-clay">{error}</span>}
        </div>
      </form>

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : (
        <div className="space-y-6">
          {groupNames.map((groupName) => (
            <div key={groupName} className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
              <h2 className="font-display text-lg px-5 py-3 border-b border-forest-100 bg-sand-100/50">{groupName}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3">Service</th>
                      <th className="text-left px-4 py-3">Duration</th>
                      <th className="text-left px-4 py-3">Price</th>
                      <th className="text-left px-4 py-3">Category</th>
                      <th className="text-left px-4 py-3">Branch</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-forest-50">
                    {grouped.get(groupName)!.map((s) => (
                      <tr key={s.id} className={s.is_active ? '' : 'opacity-50'}>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{s.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{s.duration_minutes} min</td>
                        <td className="px-4 py-3 whitespace-nowrap">{new Intl.NumberFormat('en-TZ').format(s.price)} TZS</td>
                        <td className="px-4 py-3">
                          <select
                            value={s.category_id || ''}
                            onChange={(e) => updateServiceField(s, 'category_id', e.target.value)}
                            className="rounded-lg border border-forest-200 px-2 py-1.5 text-xs"
                          >
                            <option value="">No category</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={s.branch_id || ''}
                            onChange={(e) => updateServiceField(s, 'branch_id', e.target.value)}
                            className="rounded-lg border border-forest-200 px-2 py-1.5 text-xs"
                          >
                            <option value="">All branches</option>
                            {branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{s.is_active ? 'Active' : 'Hidden'}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => toggleActive(s)} className="text-xs font-medium text-forest-600 hover:text-forest-800">
                            {s.is_active ? 'Hide' : 'Restore'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
