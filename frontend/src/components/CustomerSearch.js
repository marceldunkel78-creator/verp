import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * Customer Search Component mit Autocomplete
 * 
 * @param {Object} props
 * @param {number|null} props.value - Aktuell ausgewählte Customer ID
 * @param {Function} props.onChange - Callback (customerId, customerData) => void
 * @param {string} props.placeholder - Placeholder Text
 * @param {string} props.className - CSS Klassen
 * @param {boolean} props.required - Pflichtfeld
 * @param {boolean} props.disabled - Disabled State
 */
const CustomerSearch = ({ 
  value, 
  onChange, 
  placeholder = "Kundenname oder Firma suchen (min. 2 Zeichen)...", 
  className = "", 
  required = false,
  disabled = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
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

  // Lade initial ausgewählten Kunden
  useEffect(() => {
    const loadSelected = async () => {
      if (value && !selectedCustomer) {
        try {
          const res = await api.get(`/customers/customers/${value}/`);
          setSelectedCustomer(res.data);
          const displayName = res.data.company || `${res.data.first_name} ${res.data.last_name}`;
          setSearchTerm(displayName);
        } catch (error) {
          console.error('Error loading selected customer:', error);
        }
      }
    };
    loadSelected();
  }, [value, selectedCustomer]);

  // Suche Kunden
  useEffect(() => {
    const searchCustomers = async () => {
      if (searchTerm.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      // Nicht suchen wenn ein Kunde ausgewählt ist und der Suchtext dem Anzeigenamen entspricht
      if (selectedCustomer) {
        const displayName = selectedCustomer.company || `${selectedCustomer.first_name} ${selectedCustomer.last_name}`;
        if (searchTerm === displayName) {
          return;
        }
      }

      setIsLoading(true);
      try {
        const res = await api.get(`/customers/customers/?search=${encodeURIComponent(searchTerm)}&page_size=20`);
        setResults(res.data.results || res.data);
        setIsOpen(true);
      } catch (error) {
        console.error('Error searching customers:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchCustomers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedCustomer]);

  const handleSelect = (customer) => {
    setSelectedCustomer(customer);
    const displayName = customer.company || `${customer.first_name} ${customer.last_name}`;
    setSearchTerm(displayName);
    setIsOpen(false);
    onChange(customer.id, customer);
  };

  const handleClear = () => {
    setSelectedCustomer(null);
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
    } else if (selectedCustomer) {
      // Wenn der User tippt und eine Auswahl existiert, Auswahl zurücksetzen
      setSelectedCustomer(null);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => searchTerm.length >= 2 && !selectedCustomer && setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full border border-gray-300 rounded-md px-3 py-2 pr-8 ${className}`}
          required={required}
          disabled={disabled}
          autoComplete="off"
        />
        {selectedCustomer && !disabled && (
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
                : "Keine Kunden gefunden"}
            </div>
          ) : (
            results.map(customer => (
              <div
                key={customer.id}
                onClick={() => handleSelect(customer)}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-900">
                  {customer.company || `${customer.first_name} ${customer.last_name}`}
                </div>
                {customer.company && (
                  <div className="text-xs text-gray-500">
                    {customer.first_name} {customer.last_name}
                  </div>
                )}
                {customer.customer_number && (
                  <div className="text-xs text-gray-400">Kundennummer: {customer.customer_number}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;
