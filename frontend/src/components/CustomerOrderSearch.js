import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * Customer Order Search Component mit Autocomplete
 * 
 * @param {Object} props
 * @param {number|null} props.value - Aktuell ausgewählte Order ID
 * @param {Function} props.onChange - Callback (orderId, orderData) => void
 * @param {number|null} props.customerId - Optional: Filter nach Customer ID
 * @param {string} props.placeholder - Placeholder Text
 * @param {string} props.className - CSS Klassen
 * @param {boolean} props.required - Pflichtfeld
 * @param {boolean} props.disabled - Disabled State
 */
const CustomerOrderSearch = ({ 
  value, 
  onChange, 
  customerId = null,
  placeholder = "Auftragsnummer suchen (min. 2 Zeichen)...", 
  className = "", 
  required = false,
  disabled = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const wrapperRef = useRef(null);

  // Schließe Dropdown wenn außerhalb geklickt wird
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lade initial ausgewählten Auftrag
  useEffect(() => {
    const loadSelected = async () => {
      if (value && !selectedOrder) {
        try {
          const res = await api.get(`/customer-orders/${value}/`);
          setSelectedOrder(res.data);
          setSearchTerm(`${res.data.order_number} - ${res.data.customer_name || ''}`);
        } catch (error) {
          console.error('Error loading selected order:', error);
        }
      }
    };
    loadSelected();
  }, [value, selectedOrder]);

  // Reset wenn customerId sich ändert
  useEffect(() => {
    if (customerId !== null && selectedOrder && selectedOrder.customer !== customerId) {
      handleClear();
    }
  }, [customerId]);

  // Suche Kundenaufträge
  useEffect(() => {
    const searchOrders = async () => {
      if (searchTerm.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      // Nicht suchen wenn ein Auftrag ausgewählt ist und der Suchtext dem Anzeigenamen entspricht
      if (selectedOrder) {
        const displayText = `${selectedOrder.order_number} - ${selectedOrder.customer_name || ''}`;
        if (searchTerm === displayText) {
          return;
        }
      }

      setIsLoading(true);
      try {
        let url = `/customer-orders/?search=${encodeURIComponent(searchTerm)}&page_size=20`;
        if (customerId) {
          url += `&customer=${customerId}`;
        }
        const res = await api.get(url);
        const data = res.data.results || res.data || [];
        setResults(Array.isArray(data) ? data : []);
        setIsOpen(true);
      } catch (error) {
        console.error('Error searching orders:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchOrders, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedOrder, customerId]);

  const handleSelect = (order) => {
    setSelectedOrder(order);
    setSearchTerm(`${order.order_number} - ${order.customer_name || ''}`);
    setIsOpen(false);
    onChange(order.id, order);
  };

  const handleClear = () => {
    setSelectedOrder(null);
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
    onChange(null, null);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // Wenn Input geleert wird, auch Auswahl löschen
    if (!newValue) {
      handleClear();
    } else if (selectedOrder) {
      // Wenn der User tippt und eine Auswahl existiert, Auswahl zurücksetzen
      setSelectedOrder(null);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'DRAFT': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Entwurf' },
      'CONFIRMED': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Bestätigt' },
      'IN_PRODUCTION': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'In Fertigung' },
      'DELIVERED': { bg: 'bg-green-100', text: 'text-green-800', label: 'Geliefert' },
      'COMPLETED': { bg: 'bg-green-100', text: 'text-green-800', label: 'Abgeschlossen' },
      'CANCELLED': { bg: 'bg-red-100', text: 'text-red-800', label: 'Storniert' }
    };
    const badge = badges[status] || badges.DRAFT;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => searchTerm.length >= 2 && !selectedOrder && setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full border border-gray-300 rounded-md px-3 py-2 pr-8 ${className}`}
          required={required}
          disabled={disabled}
          autoComplete="off"
        />
        {selectedOrder && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            title="Auswahl löschen"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Suche...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {searchTerm.length < 2 
                ? "Mindestens 2 Zeichen eingeben..." 
                : "Keine Aufträge gefunden"}
            </div>
          ) : (
            results.map(order => (
              <div
                key={order.id}
                onClick={() => handleSelect(order)}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">
                    {order.order_number}
                  </div>
                  {getStatusBadge(order.status)}
                </div>
                <div className="text-xs text-gray-500">
                  {order.customer_name || 'Kein Kunde'}
                </div>
                {order.order_date && (
                  <div className="text-xs text-gray-400">
                    Datum: {new Date(order.order_date).toLocaleDateString('de-DE')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerOrderSearch;
