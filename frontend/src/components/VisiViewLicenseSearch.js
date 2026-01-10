import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * VisiView License Search Component mit Autocomplete
 * 
 * @param {Object} props
 * @param {number|null} props.value - Aktuell ausgewählte License ID
 * @param {Function} props.onChange - Callback (licenseId, licenseData) => void
 * @param {string} props.placeholder - Placeholder Text
 * @param {string} props.className - CSS Klassen
 * @param {boolean} props.required - Pflichtfeld
 * @param {boolean} props.showBalance - Zeigt Maintenance-Balance an
 */
const VisiViewLicenseSearch = ({ 
  value, 
  onChange, 
  placeholder = "Seriennummer oder Kundenname suchen (min. 3 Zeichen)...", 
  className = "", 
  required = false,
  showBalance = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [maintenanceBalance, setMaintenanceBalance] = useState(null);
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

  // Lade initial ausgewählte Lizenz
  useEffect(() => {
    const loadSelected = async () => {
      if (value && !selectedLicense) {
        try {
          const res = await api.get(`/visiview/licenses/${value}/`);
          setSelectedLicense(res.data);
          setSearchTerm(`${res.data.serial_number} - ${res.data.customer_name_legacy || 'Kein Kunde'}`);
          
          // Lade Maintenance-Balance wenn gewünscht
          if (showBalance) {
            const maintenanceRes = await api.get(`/visiview/licenses/${value}/maintenance/`);
            setMaintenanceBalance(maintenanceRes.data.current_balance);
          }
        } catch (error) {
          console.error('Error loading selected license:', error);
        }
      }
    };
    loadSelected();
  }, [value, selectedLicense, showBalance]);

  // Suche Lizenzen
  useEffect(() => {
    const searchLicenses = async () => {
      if (searchTerm.length < 3) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      // Nicht suchen wenn eine Lizenz ausgewählt ist und der Suchtext dem Anzeigenamen entspricht
      if (selectedLicense) {
        const displayText = `${selectedLicense.serial_number} - ${selectedLicense.customer_name_legacy || 'Kein Kunde'}`;
        if (searchTerm === displayText) {
          return;
        }
      }

      setIsLoading(true);
      try {
        const res = await api.get(`/visiview/licenses/?search=${encodeURIComponent(searchTerm)}&page_size=20`);
        setResults(res.data.results || res.data);
        setIsOpen(true);
      } catch (error) {
        console.error('Error searching licenses:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchLicenses, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedLicense]);

  const handleSelect = async (license) => {
    setSelectedLicense(license);
    setSearchTerm(`${license.serial_number} - ${license.customer_name_legacy || 'Kein Kunde'}`);
    setIsOpen(false);
    
    // Lade Maintenance-Balance wenn gewünscht
    if (showBalance) {
      try {
        const maintenanceRes = await api.get(`/visiview/licenses/${license.id}/maintenance/`);
        setMaintenanceBalance(maintenanceRes.data.current_balance);
      } catch (error) {
        console.error('Error loading maintenance balance:', error);
        setMaintenanceBalance(null);
      }
    }
    
    onChange(license.id, license);
  };

  const handleClear = () => {
    setSelectedLicense(null);
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
    setMaintenanceBalance(null);
    onChange(null, null);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // Wenn Input geleert wird, auch Auswahl löschen
    if (!newValue) {
      handleClear();
    } else if (selectedLicense) {
      // Wenn der User tippt und eine Auswahl existiert, Auswahl zurücksetzen
      setSelectedLicense(null);
      setMaintenanceBalance(null);
    }
  };

  const getBalanceColor = () => {
    if (maintenanceBalance === null) return '';
    const balance = parseFloat(maintenanceBalance);
    if (balance > 0) return 'text-green-600 bg-green-50';
    if (balance === 0) return 'text-red-600 bg-red-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => searchTerm.length >= 3 && !selectedLicense && setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full border border-gray-300 rounded-md px-3 py-2 pr-8 ${className}`}
          required={required}
          autoComplete="off"
        />
        {selectedLicense && (
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

      {/* Maintenance Balance Anzeige */}
      {showBalance && selectedLicense && maintenanceBalance !== null && (
        <div className={`mt-2 px-3 py-2 rounded-md text-sm font-medium ${getBalanceColor()}`}>
          Maintenance-Guthaben: {parseFloat(maintenanceBalance) >= 0 ? '+' : ''}{parseFloat(maintenanceBalance).toFixed(2)} h
        </div>
      )}

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Suche...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {searchTerm.length < 3 
                ? "Mindestens 3 Zeichen eingeben..." 
                : "Keine Lizenzen gefunden"}
            </div>
          ) : (
            results.map(license => (
              <div
                key={license.id}
                onClick={() => handleSelect(license)}
                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="text-sm font-medium text-gray-900">
                  {license.serial_number}
                </div>
                <div className="text-xs text-gray-500">
                  {license.customer_name_legacy || 'Kein Kunde zugewiesen'}
                </div>
                {license.version && (
                  <div className="text-xs text-gray-400">Version: {license.version}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default VisiViewLicenseSearch;
