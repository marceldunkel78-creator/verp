import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * SystemSearch - Autocomplete-Suche für Systeme (systems.System)
 * 
 * Props:
 * - customerId: Optional - filtert Systeme nach Kunde
 * - selectedSystems: Array von System-IDs die bereits ausgewählt sind
 * - onChange: Callback mit Array von System-IDs
 * - disabled: Ob das Feld deaktiviert ist
 */
const SystemSearch = ({ customerId, selectedSystems = [], onChange, disabled = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSystemsData, setSelectedSystemsData] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Debounce search
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Suche nach Systemen
  const searchSystems = async (term) => {
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Suche über alle Systeme oder gefiltert nach Kunde
      let url = `/systems/systems/?search=${encodeURIComponent(term)}`;
      if (customerId) {
        url += `&customer=${customerId}`;
      }
      const response = await api.get(url);
      // Filter bereits ausgewählte Systeme aus
      const results = (response.data.results || response.data || [])
        .filter(sys => !selectedSystems.includes(sys.id));
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching systems:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((term) => searchSystems(term), 300),
    [customerId, selectedSystems]
  );

  // Lade Details der ausgewählten Systeme
  useEffect(() => {
    const loadSelectedSystems = async () => {
      if (selectedSystems.length === 0) {
        setSelectedSystemsData([]);
        return;
      }

      try {
        // Lade alle ausgewählten Systeme
        const promises = selectedSystems.map(id => 
          api.get(`/systems/systems/${id}/`).catch(() => null)
        );
        const responses = await Promise.all(promises);
        const systems = responses
          .filter(r => r !== null)
          .map(r => r.data);
        setSelectedSystemsData(systems);
      } catch (error) {
        console.error('Error loading selected systems:', error);
      }
    };

    loadSelectedSystems();
  }, [selectedSystems]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowDropdown(true);
    debouncedSearch(value);
  };

  const handleSelectSystem = (system) => {
    const newSelected = [...selectedSystems, system.id];
    onChange(newSelected);
    setSearchTerm('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleRemoveSystem = (systemId) => {
    const newSelected = selectedSystems.filter(id => id !== systemId);
    onChange(newSelected);
  };

  return (
    <div className="relative">
      {/* Ausgewählte Systeme als Tags */}
      {selectedSystemsData.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedSystemsData.map(sys => (
            <span
              key={sys.id}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              {sys.system_number} - {sys.system_name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveSystem(sys.id)}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none"
                >
                  <span className="sr-only">Entfernen</span>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Suchfeld */}
      {!disabled && (
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder="System suchen (mind. 2 Zeichen)..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          
          {isSearching && (
            <div className="absolute right-3 top-2.5">
              <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}

          {/* Dropdown mit Suchergebnissen */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              {searchResults.map(system => (
                <button
                  key={system.id}
                  type="button"
                  onClick={() => handleSelectSystem(system)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:outline-none focus:bg-gray-100"
                >
                  <div className="font-medium text-gray-900">
                    {system.system_number} - {system.system_name}
                  </div>
                  {system.customer_name && (
                    <div className="text-sm text-gray-500">
                      Kunde: {system.customer_name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {showDropdown && searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4 text-gray-500 text-center">
              Keine Systeme gefunden
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemSearch;
