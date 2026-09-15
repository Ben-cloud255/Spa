'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface SearchResult {
  type: string;
  id: number;
  label: string;
  subtitle: string;
  path: string;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(query.trim())}`)
        .then((d) => setResults(d.results))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function goTo(result: SearchResult) {
    setOpen(false);
    setQuery('');
    router.push(result.path);
  }

  // Group results by type so the dropdown reads like "Staff / Rooms /
  // Services / ..." sections rather than one flat mixed list.
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] = acc[r.type] || []).push(r);
    return acc;
  }, {});

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <div className="relative">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search staff, rooms, services…"
          className="w-full rounded-lg border border-forest-200 bg-white pl-9 pr-3 py-2 text-sm"
        />
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-lg border border-forest-100 shadow-card max-h-96 overflow-y-auto z-50">
          {loading ? (
            <p className="text-sm text-forest-500/60 px-4 py-3">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-forest-500/60 px-4 py-3">No matches for &ldquo;{query}&rdquo;.</p>
          ) : (
            Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-forest-500/60 px-4 pt-2.5 pb-1">
                  {type}
                </p>
                {items.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => goTo(r)}
                    className="w-full text-left px-4 py-2 hover:bg-forest-50 flex flex-col"
                  >
                    <span className="text-sm font-medium text-ink">{r.label}</span>
                    {r.subtitle && <span className="text-xs text-forest-500/60">{r.subtitle}</span>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
