import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * Autocomplete fuer Einkaufsbestellungen (Procurement/Order).
 *
 * Abgrenzung zu `CustomerOrderSearch`: dort werden KUNDENAUFTRAEGE gesucht
 * (eigene Nummer, geht raus zum Kunden). Hier geht es um BESTELLUNGEN AN
 * LIEFERANTEN - das ist die Nummer, die der Hersteller auf seinem
 * Kostenvoranschlag oder Lieferschein ausweist.
 *
 * @param {Object} props
 * @param {number|null} props.value            - Aktuell gewaehlte Order-ID
 * @param {Function}     props.onChange         - (orderId|null, orderData|null) => void
 * @param {number|null} props.supplierId       - Optional: nur Bestellungen dieses Lieferanten
 * @param {string}       props.placeholder
 * @param {string}       props.className
 */
const ProcurementOrderSearch = ({
  value = null,
  onChange,
  supplierId = null,
  placeholder = 'Bestellnummer suchen (min. 2 Zeichen)...',
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatLabel = (order) => {
    if (!order) return '';
    const num = order.order_number || '';
    const supplier = order.supplier_name ||
      (order.supplier && order.supplier.company_name) || '';
    return [num, supplier].filter(Boolean).join(' - ');
  };

  // Gewaehlte Bestellung nachladen (z.B. beim Oeffnen eines RMA-Falls).
  // `selected` ist bewusst NICHT in den Abhaengigkeiten: wuerde der User
  // weitertippen, wuerde der Effekt zuruecksetzen und die Eingabe ueberschreiben.
  // Stattdessen wird ueber ein Ref verglichen, ob schon die richtige
  // Bestellung geladen ist.
  const selectedIdRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      selectedIdRef.current = null;
      setSearchTerm('');
      return;
    }
    if (selectedIdRef.current === value) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/orders/orders/${value}/`);
        if (cancelled) return;
        setSelected(res.data);
        selectedIdRef.current = value;
        setSearchTerm(formatLabel(res.data));
      } catch (error) {
        console.error('Bestellung konnte nicht geladen werden:', error);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('de-DE');
  };

  useEffect(() => {
    if (searchTerm.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const params = { search: searchTerm.trim(), page_size: 20 };
        if (supplierId) params.supplier = supplierId;
        const res = await api.get('/orders/orders/', { params });
        const data = res.data.results || res.data || [];
        if (cancelled) return;
        setResults(Array.isArray(data) ? data : []);
        setIsOpen(true);
      } catch (error) {
        console.error('Bestellsuche fehlgeschlagen:', error);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, supplierId]);

  const handleSelect = (order) => {
    setSelected(order);
    selectedIdRef.current = order.id;
    setSearchTerm(formatLabel(order));
    setResults([]);
    setIsOpen(false);
    if (onChange) onChange(order.id, order);
  };

  const handleClear = () => {
    setSelected(null);
    selectedIdRef.current = null;
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
    if (onChange) onChange(null, null);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          // Tippen nach Auswahl hebt die Verknuepfung wieder auf
          if (selected && e.target.value !== formatLabel(selected)) {
            setSelected(null);
            selectedIdRef.current = null;
            if (onChange) onChange(null, null);
          }
        }}
        onFocus={() => { if (results.length) setIsOpen(true); }}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
      />
      {isLoading && (
        <div className="absolute right-3 top-2.5">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500" />
        </div>
      )}
      {selected && !isLoading && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
          title="Auswahl entfernen"
        >
          ×
        </button>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => handleSelect(order)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                value === order.id ? 'bg-orange-50' : ''
              }`}
            >
              <span className="font-mono text-xs text-gray-600 flex-shrink-0">
                {order.order_number}
              </span>
              <span className="text-gray-900 truncate">
                {order.supplier_name ||
                  (order.supplier && order.supplier.company_name) ||
                  order.title ||
                  ''}
              </span>
              {order.order_date && (
                <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                  {formatDate(order.order_date)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {isOpen && !isLoading && searchTerm.length >= 2 && results.length === 0 && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-500">
          Keine Bestellung gefunden.
        </div>
      )}
    </div>
  );
};

export default ProcurementOrderSearch;
