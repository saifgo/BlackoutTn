import { useEffect, useMemo, useRef, useState } from 'react';
import type { ZoneFeatureCollection, ZoneProperties } from '../types';

interface SearchBoxProps {
  zones: ZoneFeatureCollection | null;
  onSelect: (zoneId: string) => void;
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function SearchBox({ zones, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => {
    if (!zones) return [];
    return zones.features.map((f) => f.properties as ZoneProperties);
  }, [zones]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [] as ZoneProperties[];
    const items: { z: ZoneProperties; score: number }[] = [];
    for (const z of options) {
      const nName = normalize(z.name);
      const nDeleg = normalize(z.delegation);
      const nGov = normalize(z.governorate);
      let score = -1;
      if (nName.startsWith(q)) score = 0;
      else if (nName.includes(q)) score = 1;
      else if (nDeleg.startsWith(q)) score = 2;
      else if (nDeleg.includes(q)) score = 3;
      else if (nGov.startsWith(q)) score = 4;
      else if (nGov.includes(q)) score = 5;
      if (score >= 0) items.push({ z, score });
    }
    items.sort((a, b) => a.score - b.score || a.z.name.localeCompare(b.z.name));
    return items.slice(0, 8).map((x) => x.z);
  }, [options, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function commit(zone: ZoneProperties) {
    onSelect(zone.id);
    setQuery(`${zone.name} (${zone.delegation})`);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <label htmlFor="zone-search" className="sr-only">
        لوّج على قطاع، معتمدية ولا ولاية
      </label>
      <input
        id="zone-search"
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="zone-search-list"
        aria-activedescendant={
          open && results.length > 0 ? `zone-search-option-${highlight}` : undefined
        }
        placeholder="لوّج على قطاع (مثال: المرناقية، صفاقس)..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open) setOpen(true);
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, Math.max(0, results.length - 1)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter' && results[highlight]) {
            e.preventDefault();
            commit(results[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="w-full rounded-lg border-0 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 shadow-inner ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500"
      />
      {open && results.length > 0 && (
        <ul
          id="zone-search-list"
          role="listbox"
          className="absolute left-0 right-0 top-full z-[1000] mt-1 max-h-64 overflow-auto rounded-lg bg-slate-900/95 py-1 shadow-xl ring-1 ring-white/10 backdrop-blur"
        >
          {results.map((z, idx) => (
            <li
              key={z.id}
              id={`zone-search-option-${idx}`}
              role="option"
              aria-selected={idx === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(z);
              }}
              onMouseEnter={() => setHighlight(idx)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                idx === highlight ? 'bg-slate-700 text-white' : 'text-slate-100'
              }`}
            >
              <div className="font-semibold">{z.name}</div>
              <div className="text-xs text-slate-400">
                {z.delegation} &middot; {z.governorate}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
