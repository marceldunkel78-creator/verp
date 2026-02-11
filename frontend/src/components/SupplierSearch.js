import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const BACKEND_BASE = process.env.REACT_APP_BACKEND_BASE || '';

/**
 * Supplier Search Component mit Autocomplete
 * 
 * @param {Object} props
 * @param {number|null} props.value - Aktuell ausgewählte Supplier ID
 * @param {Function} props.onChange - Callback (supplierId) => void
 * @param {string} props.placeholder - Placeholder Text
 * @param {string} props.className - CSS Klassen
 * @param {boolean} props.required - Pflichtfeld
 */
const SupplierSearch = ({ value, onChange, placeholder = "Lieferant suchen (min. 3 Zeichen)...", className = "", required = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
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

  // Lade initial ausgewählten Lieferanten
  useEffect(() => {
    const loadSelected = async () => {
      if (value && !selectedSupplier) {
        try {
          const res = await axios.get(`${BACKEND_BASE}/api/suppliers/suppliers/${value}/`, { withCredentials: true });
          setSelectedSupplier(res.data);
          setSearchTerm(`${res.data.supplier_number} - ${res.data.company_name}`);
        } catch (error) {
          console.error('Error loading selected supplier:', error);
        }
      }
    };
    loadSelected();
  }, [value, selectedSupplier]);

  // Suche Lieferanten
  useEffect(() => {
    const searchSuppliers = async () => {
      if (searchTerm.length < 3) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const res = await axios.get(
          `${BACKEND_BASE}/api/suppliers/suppliers/?search=${encodeURIComponent(searchTerm)}`,
          { withCredentials: true }
        );
        setResults(res.data.results || res.data);
        setIsOpen(true);
      } catch (error) {
        console.error('Error searching suppliers:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchSuppliers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  const handleSelect = (supplier) => {
    setSelectedSupplier(supplier);
    setSearchTerm(`${supplier.supplier_number} - ${supplier.company_name}`);
    setIsOpen(false);
    onChange(supplier.id);
  };

  const handleClear = () => {
    setSelectedSupplier(null);
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
    onChange(null);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // Wenn Input geleert wird, auch Auswahl löschen
    if (!newValue) {
      handleClear();
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => searchTerm.length >= 3 && setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full border border-gray-300 rounded-md px-3 py-2 pr-8 ${className}`}
          required={required}
          autoComplete="off"
        />
        {selectedSupplier && (
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

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Suche...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {searchTerm.length < 3 
                ? "Mindestens 3 Zeichen eingeben..." 
                : "Keine Lieferanten gefunden"}
            </div>
          ) : (
            results.map(supplier => (
              <div
                key={supplier.id}
                onClick={() => handleSelect(supplier)}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-900">
                  {supplier.supplier_number} - {supplier.company_name}
                </div>
                {supplier.city && (
                  <div className="text-xs text-gray-500">{supplier.city}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SupplierSearch;
