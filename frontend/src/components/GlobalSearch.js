import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { api } from '../utils/api';

const GlobalSearch = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get(`/core/global-search/?q=${encodeURIComponent(query.trim())}`);
        setResults(response.data.results || []);
      } catch (error) {
        console.error('Globale Suche fehlgeschlagen:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query]);

  const toggle = () => {
    setOpen(prev => !prev);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const selectResult = (result) => {
    setOpen(false);
    setQuery('');
    navigate(result.url);
  };

  return (
    <div className="fixed right-4 top-3 z-50 flex items-start gap-2">
      {open && (
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
            }}
            placeholder="VERP durchsuchen..."
            className="w-64 rounded-lg border border-white/40 bg-white/90 px-3 py-2 text-sm shadow-lg outline-none backdrop-blur"
            aria-label="VERP durchsuchen"
          />
          {(loading || results.length > 0 || (query.trim().length >= 2 && !loading)) && (
            <div className="absolute right-0 mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur">
              {loading && <div className="px-4 py-3 text-sm text-gray-500">Suche läuft...</div>}
              {!loading && results.length === 0 && query.trim().length >= 2 && (
                <div className="px-4 py-3 text-sm text-gray-500">Keine Treffer gefunden.</div>
              )}
              {!loading && results.map((result, index) => (
                <button
                  key={`${result.type}-${result.url}-${index}`}
                  type="button"
                  onClick={() => selectResult(result)}
                  className="block w-full border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-blue-50"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">{result.module}</div>
                  <div className="font-medium text-gray-900">{result.title}</div>
                  {result.subtitle && <div className="truncate text-xs text-gray-500">{result.subtitle}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        className="rounded-full bg-blue-600 p-3 text-white shadow-lg transition hover:bg-blue-700"
        title="VERP durchsuchen"
        aria-label="VERP durchsuchen"
      >
        {open ? <XMarkIcon className="h-5 w-5" /> : <MagnifyingGlassIcon className="h-5 w-5" />}
      </button>
    </div>
  );
};

export default GlobalSearch;