from pathlib import Path
p=Path('backend/src/controllers/categoryController.js');s=p.read_text(encoding='utf-8');s=s.replace('module.exports = { listCategories, createCategory };', '''async function removeCategory(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid category.' });
  try {
    // The category foreign key uses ON DELETE SET NULL: services and their
    // historical references remain intact and appear under Other.
    const result = await db.query('DELETE FROM service_categories WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Category not found.' });
    return res.json({ success: true });
  } catch (err) {
    console.error('Remove category error:', err);
    return res.status(500).json({ error: 'Could not remove the category.' });
  }
}

module.exports = { listCategories, createCategory, removeCategory };''');p.write_text(s,encoding='utf-8')
p=Path('backend/src/routes/categoryRoutes.js');s=p.read_text(encoding='utf-8').replace('listCategories, createCategory }','listCategories, createCategory, removeCategory }').replace('module.exports = router;', "router.delete('/:id', requireAuth, requireRole('admin'), removeCategory);\n\nmodule.exports = router;");p.write_text(s,encoding='utf-8')
p=Path('frontend/app/admin/services/page.tsx');s=p.read_text(encoding='utf-8');s=s.replace("  const [busy, setBusy]", "  const [removingCategory, setRemovingCategory] = useState<number | null>(null);\n  const [busy, setBusy]")
pos=s.index('  async function toggleActive')
s=s[:pos]+'''  async function removeCategory(category: ServiceCategory) {
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

'''+s[pos:]
s=s.replace('            const activeCount = items.filter((s) => s.is_active).length;', '            const activeCount = items.filter((s) => s.is_active).length;\n            const category = categories.find(c => c.name === groupName);')
s=s.replace('''              <button
                key={groupName}
                onClick''', '''              <div key={groupName} className="service-category-wrapper">
              <button
                onClick''')
s=s.replace('''                className="service-category-card text-left''', '''                className="service-category-card w-full text-left''')
s=s.replace('''              </button>
            );''', '''              </button>
              {category && <button type="button" disabled={removingCategory !== null} onClick={() => removeCategory(category)} className="service-category-remove">{removingCategory === category.id ? 'Removing…' : 'Remove category'}</button>}
              </div>
            );''')
s=s.replace('''            ← All categories
          </button>''', '''            ← All categories
          </button>
          {categories.find(c => c.name === openGroup) && <button type="button" disabled={removingCategory !== null} onClick={() => { const category = categories.find(c => c.name === openGroup); if (category) removeCategory(category); }} className="service-category-remove ml-4">{removingCategory !== null ? 'Removing…' : 'Remove category'}</button>}''')
p.write_text(s,encoding='utf-8')
