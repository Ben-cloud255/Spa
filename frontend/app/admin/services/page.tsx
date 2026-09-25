'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useBranches } from '@/lib/useBranches';
import type { Service, ServiceCategory } from '@/lib/types';

const EMPTY_FORM = { name: '', duration_minutes: '', price: '', description: '', category_id: '', branch_id: '' };

export default function AdminServicesPage() {
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [search, setSearch] = useState('');
  const [removingCategory, setRemovingCategory] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { branches } = useBranches();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus');
  const focusCategory = searchParams.get('category');
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  // Drill-down: null shows the category list; a name shows that category's
  // services (or "Other" for services with no category assigned).
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // Filters (apply within the currently open group)
  const [filterBranch, setFilterBranch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'duration'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  async function load(includeHidden: boolean) {
    setLoading(true);
    try {
    const query = includeHidden ? '?includeInactive=true' : '';
    const [servicesData, categoriesData] = await Promise.all([
      api.get<{ services: Service[] }>(`/services${query}`),
      api.get<{ categories: ServiceCategory[] }>('/service-categories'),
    ]);
    setServices(servicesData.services);
    setCategories(categoriesData.categories);
    } catch { setError('Could not load the service catalog. Please refresh to try again.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    load(showHidden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

  // Arriving from global search: make sure hidden services aren't excluded,
  // jump straight into the right category, then scroll to and highlight
  // the exact row once it's rendered.
  useEffect(() => {
    if (!focusId) return;
    setShowHidden(true);
    setFilterBranch('');
    setSearch('');
    if (focusCategory) setOpenGroup(focusCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, focusCategory]);

  useEffect(() => {
    if (!focusId || loading) return;
    const id = Number(focusId);
    setHighlightId(id);
    const el = document.getElementById(`service-row-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timer);
  }, [focusId, loading, services, openGroup]);

  async function createService(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
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
      setShowServiceForm(false);
      load(showHidden);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the service.');
    } finally { setBusy(false); }
  }

  async function createCategory(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/service-categories', { name: newCategoryName });
      setNewCategoryName('');
      setShowCategoryForm(false);
      load(showHidden);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the category.');
    } finally { setBusy(false); }
  }

  async function removeCategory(category: ServiceCategory) {
    if (removingCategory !== null) return;
    if (!window.confirm(`Remove the category "${category.name}"? Any services inside it will move to Other. Their availability, prices and visit history will stay unchanged.`)) return;
    setRemovingCategory(category.id);
    setError(null);
    try {
      await api.del(`/service-categories/${category.id}`);
      if (openGroup === category.name) setOpenGroup(null);
      setForm(previous => previous.category_id === String(category.id) ? { ...previous, category_id: '' } : previous);
      await load(showHidden);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove the category.');
    } finally { setRemovingCategory(null); }
  }

  async function toggleActive(service: Service) {
    setError(null);
    try { await api.patch(`/services/${service.id}`, { is_active: !service.is_active }); await load(showHidden); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not update the service.'); }
  }

  async function updateServiceField(service: Service, field: 'category_id' | 'branch_id', value: string) {
    setError(null);
    try { await api.patch(`/services/${service.id}`, { [field]: value ? Number(value) : null }); await load(showHidden); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Could not update the service.'); }
  }

  // Group everything by category name first — this is what powers both the
  // category-cards view and each category's own count.
  const allGrouped = new Map<string, Service[]>();
  categories.forEach(category => allGrouped.set(category.name, []));
  for (const s of services) {
    if (search.trim() && !`${s.name} ${s.category_name || 'Other'}`.toLowerCase().includes(search.trim().toLowerCase())) continue;
    const key = s.category_name || 'Other';
    if (!allGrouped.has(key)) allGrouped.set(key, []);
    allGrouped.get(key)!.push(s);
  }
  const groupNames = [...allGrouped.keys()].filter(name => !search.trim() || allGrouped.get(name)!.length > 0 || name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));

  // Services shown once a category card is opened — filtered + sorted.
  const openServices = openGroup
    ? (allGrouped.get(openGroup) || [])
        .filter((s) => !filterBranch || !s.branch_id || String(s.branch_id) === filterBranch)
        .sort((a, b) => {
          let cmp = 0;
          if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
          else if (sortBy === 'price') cmp = Number(a.price) - Number(b.price);
          else cmp = a.duration_minutes - b.duration_minutes;
          return sortDir === 'asc' ? cmp : -cmp;
        })
    : [];

  return (
    <div className="service-catalog-page">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <div><p className="visits-eyebrow">TREATMENT CATALOG</p><h1 className="font-display text-3xl">Services</h1></div>
        <div className="flex gap-2"><button className="visits-button" aria-expanded={showServiceForm} aria-controls="service-create-form" onClick={() => setShowServiceForm(!showServiceForm)}>{showServiceForm ? 'Close form' : '+ Add service'}</button>
        <button
          onClick={() => setShowCategoryForm((v) => !v)}
          className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium hover:bg-forest-700"
        >
          {showCategoryForm ? 'Cancel' : '+ New category'}
        </button></div>
      </div>
      <p className="text-forest-500/70 text-sm mb-6">
        Organize treatments, prices and duration. Open a category to manage its services and branch availability.
      </p>

      <div className="service-catalog-summary"><span><strong>{services.filter(s => s.is_active).length}</strong> active services</span><span><strong>{categories.length}</strong> categories</span><span>Prices in TZS · Duration in minutes</span></div>
      {error && <p role="alert" className="visits-error mb-4">{error}</p>}
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
          <button type="submit" disabled={busy} className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium hover:bg-forest-700">
            Add category
          </button>
        </form>
      )}

      {showServiceForm && <form id="service-create-form" onSubmit={createService} className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 items-end">
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
          <button type="submit" disabled={busy} className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium hover:bg-forest-700">
            Add service
          </button>

        </div>
      </form>}

      <div className="service-catalog-toolbar"><input type="search" aria-label="Search services and categories" placeholder="Search services or categories" value={search} onChange={e => setSearch(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-forest-600 mb-4">
        <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
        Show hidden services
      </label></div>

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : openGroup === null ? (
        // --- Category list: one card per category, showing how many
        // services (and how many active) sit inside, tap to drill in. ---
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupNames.map((groupName) => {
            const items = allGrouped.get(groupName)!;
            const activeCount = items.filter((s) => s.is_active).length;
            const category = categories.find(c => c.name === groupName);
            return (
              <div key={groupName} className="service-category-wrapper">
              <button
                onClick={() => setOpenGroup(groupName)}
                className="service-category-card w-full text-left bg-white rounded-xl2 border border-forest-100 shadow-card p-5 hover:border-forest-300 hover:-translate-y-0.5 transition-transform"
              >
                <div className="service-category-top"><span aria-hidden="true">✦</span><span aria-hidden="true">↗</span></div><h2 className="font-display text-lg mb-1">{groupName}</h2>
                <p className="text-sm text-forest-500/70">
                  {items.length} service{items.length === 1 ? '' : 's'}
                  {activeCount !== items.length ? ` · ${activeCount} active` : ''}
                </p>
                <p className="service-category-price">{items.length ? `From ${new Intl.NumberFormat('en-TZ').format(Math.min(...items.map(s => Number(s.price))))} TZS` : 'Ready for your first service'}</p>
              </button>
              {category && <button type="button" disabled={removingCategory !== null} onClick={() => removeCategory(category)} className="service-category-remove">{removingCategory === category.id ? 'Removing…' : 'Remove category'}</button>}
              </div>
            );
          })}
          {groupNames.length === 0 && <p className="text-forest-500/60 text-sm">No matching categories or services. Add a service or adjust your search.</p>}
        </div>
      ) : (
        // --- One category's services, with the usual filters + table. ---
        <div>
          <button
            onClick={() => setOpenGroup(null)}
            className="text-sm font-medium text-forest-600 hover:text-forest-800 mb-4 inline-flex items-center gap-1"
          >
            ← All categories
          </button>
          {categories.find(c => c.name === openGroup) && <button type="button" disabled={removingCategory !== null} onClick={() => { const category = categories.find(c => c.name === openGroup); if (category) removeCategory(category); }} className="service-category-remove ml-4">{removingCategory !== null ? 'Removing…' : 'Remove category'}</button>}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              aria-label="Filter services by branch"
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort services"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white"
            >
              <option value="name">Sort by name</option>
              <option value="price">Sort by price</option>
              <option value="duration">Sort by duration</option>
            </select>
            <button
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white hover:bg-forest-50"
            >
              {sortDir === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
            </button>
          </div>

          <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
            <h2 className="font-display text-lg px-5 py-3 border-b border-forest-100 bg-sand-100/50">{openGroup}</h2>
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
                  {openServices.map((s) => (
                    <tr key={s.id} id={`service-row-${s.id}`} className={`transition-colors ${s.is_active ? '' : 'opacity-50'} ${highlightId === s.id ? 'bg-honey-500/20' : ''}`}>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {s.name}
                        {!s.is_active && <span className="ml-2 text-xs text-clay font-normal">Hidden</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{s.duration_minutes} min</td>
                      <td className="px-4 py-3 whitespace-nowrap">{new Intl.NumberFormat('en-TZ').format(s.price)} TZS</td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Category for ${s.name}`}
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
                          aria-label={`Branch for ${s.name}`}
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
                  {openServices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-forest-500/60">
                        No services match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
