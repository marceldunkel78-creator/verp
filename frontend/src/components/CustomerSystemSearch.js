import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * Customer System Search Component mit Autocomplete
 * Sucht nur nach Systemen eines bestimmten Kunden
 * 
 * @param {Object} props
 * @param {number} props.customerId - Kunden-ID (erforderlich)
 * @param {Array<number>} props.value - Aktuell ausgewählte System-IDs (Array)
 * @param {Function} props.onChange - Callback (systemIds) => void
 * @param {string} props.placeholder - Placeholder Text
 * @param {string} props.className - CSS Klassen
 * @param {boolean} props.multiple - Mehrfachauswahl erlauben
 */
const CustomerSystemSearch = ({ 
  customerId,
  value = [], 
  onChange, 
  placeholder = "System suchen (min. 2 Zeichen)...", 
  className = "",
  multiple = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSystems, setSelectedSystems] = useState([]);
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

  // Lade initial ausgewählte Systeme
  useEffect(() => {
    const loadSelected = async () => {
      if (!customerId || !value || value.length === 0) {
        setSelectedSystems([]);
        return;
      }

      try {
        // Lade alle Systeme des Kunden
        const res = await api.get(`/customers/customers/${customerId}/systems/`);
        const allSystems = res.data;
        
        // Filtere die ausgewählten
        const selected = allSystems.filter(sys => value.includes(sys.id));
        setSelectedSystems(selected);
      } catch (error) {
        console.error('Error loading selected systems:', error);
        setSelectedSystems([]);
      }
    };
    loadSelected();
  }, [customerId, value]);

  // Suche Systeme des Kunden
  useEffect(() => {
    const searchSystems = async () => {
      if (!customerId) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      if (searchTerm.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        // Lade alle Systeme des Kunden und filtere clientseitig
        const res = await api.get(`/customers/customers/${customerId}/systems/`);
        const allSystems = res.data;
        
        // Filtere nach Suchbegriff
        const filtered = allSystems.filter(sys => {
          const searchLower = searchTerm.toLowerCase();
          return (
            sys.system_number.toLowerCase().includes(searchLower) ||
            (sys.name && sys.name.toLowerCase().includes(searchLower)) ||
            (sys.system_type && sys.system_type.toLowerCase().includes(searchLower))
          );
        });

        setResults(filtered);
        setIsOpen(filtered.length > 0);
      } catch (error) {
        console.error('Error searching systems:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchSystems, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, customerId]);

  const handleSelect = (system) => {
    if (multiple) {
      // Mehrfachauswahl
      const isAlreadySelected = selectedSystems.some(s => s.id === system.id);
      let newSelected;
      
      if (isAlreadySelected) {
        // Entfernen
        newSelected = selectedSystems.filter(s => s.id !== system.id);
      } else {
        // Hinzufügen
        newSelected = [...selectedSystems, system];
      }
      
      setSelectedSystems(newSelected);
      onChange(newSelected.map(s => s.id));
      setSearchTerm('');
      setIsOpen(false);
    } else {
      // Einzelauswahl
      setSelectedSystems([system]);
      setSearchTerm(`${system.system_number} - ${system.name || 'Unbenannt'}`);
      setIsOpen(false);
      onChange([system.id]);
    }
  };

  const handleRemove = (systemId) => {
    const newSelected = selectedSystems.filter(s => s.id !== systemId);
    setSelectedSystems(newSelected);
    onChange(newSelected.map(s => s.id));
  };

  const handleClear = () => {
    setSelectedSystems([]);
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
    onChange([]);
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
  };

  if (!customerId) {
    return (
      <div className={className}>
        <input
          type="text"
          disabled
          placeholder="Bitte zuerst einen Kunden auswählen"
          className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 cursor-not-allowed"
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Selected Systems (nur bei Mehrfachauswahl) */}
      {multiple && selectedSystems.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedSystems.map(sys => (
            <span
              key={sys.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
            >
              {sys.system_number} - {sys.name || 'Unbenannt'}
              <button
                type="button"
                onClick={() => handleRemove(sys.id)}
                className="hover:text-blue-900 font-bold"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div ref={wrapperRef} className="relative">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={() => searchTerm.length >= 2 && setIsOpen(true)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-md px-3 py-2 pr-8"
            autoComplete="off"
          />
          {(selectedSystems.length > 0 || searchTerm) && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>

        {/* Dropdown Results */}
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 text-center text-gray-500">Laden...</div>
            ) : results.length === 0 ? (
              <div className="p-3 text-center text-gray-500">Keine Systeme gefunden</div>
            ) : (
              results.map((system) => {
                const isSelected = selectedSystems.some(s => s.id === system.id);
                return (
                  <div
                    key={system.id}
                    onClick={() => handleSelect(system)}
                    className={`p-3 cursor-pointer hover:bg-gray-100 border-b last:border-b-0 ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {system.system_number}
                          {isSelected && <span className="ml-2 text-blue-600">✓</span>}
                        </div>
                        <div className="text-sm text-gray-600">
                          {system.name || 'Unbenannt'}
                        </div>
                        {system.system_type && (
                          <div className="text-xs text-gray-500">
                            Typ: {system.system_type}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerSystemSearch;
