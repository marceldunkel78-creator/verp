import React, { useState } from 'react';
import {
  ChevronDownIcon,
  PlusIcon,
  CheckIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';

/**
 * AddressSelector - Wiederverwendbare Komponente zur Adressauswahl und -erstellung
 * 
 * Features:
 * - Auswahl aus vorhandenen Kundenadressen
 * - Manuelle Eingabe/Bearbeitung
 * - Speichern neuer Adressen in Kundendatenbank
 * 
 * Props:
 * - customer: Kundenobjekt mit addresses Array
 * - value: Aktueller Adresstext
 * - onChange: Callback wenn sich Adresse ändert
 * - label: Label für das Feld
 * - addressType: 'Lieferung' | 'Rechnung' | 'Einkauf' - Typ für neue Adressen
 * - email: Optional - E-Mail Feld anzeigen
 * - emailValue: E-Mail Wert
 * - onEmailChange: E-Mail Callback
 */
const AddressSelector = ({
  customer,
  value,
  onChange,
  label = 'Adresse',
  addressType = 'Lieferung',
  email = false,
  emailValue = '',
  onEmailChange = null
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Parse customer addresses
  const addresses = customer?.addresses || [];

  // Format address object to string
  const formatAddress = (addr) => {
    if (!addr) return '';
    const lines = [];
    if (addr.university) lines.push(addr.university);
    if (addr.institute) lines.push(addr.institute);
    if (addr.department) lines.push(addr.department);
    
    // Contact name from customer
    if (customer) {
      const contactName = [customer.salutation, customer.title, customer.first_name, customer.last_name]
        .filter(Boolean).join(' ').trim();
      if (contactName) lines.push(contactName);
    }
    
    const street = `${addr.street || ''} ${addr.house_number || ''}`.trim();
    if (street) lines.push(street);
    if (addr.address_supplement) lines.push(addr.address_supplement);
    
    const cityLine = `${addr.postal_code || ''} ${addr.city || ''}`.trim();
    if (cityLine) lines.push(cityLine);
    
    if (addr.country && addr.country !== 'DE' && addr.country !== 'Deutschland') {
      lines.push(addr.country);
    }
    
    return lines.join('\n');
  };

  // Select an existing address
  const selectAddress = (addr) => {
    const formatted = formatAddress(addr);
    onChange(formatted);
    setShowDropdown(false);
  };

  // Parse textarea back to address components (best effort)
  const parseAddressText = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Simple heuristic parsing
    const result = {
      university: '',
      institute: '',
      department: '',
      street: '',
      house_number: '',
      address_supplement: '',
      postal_code: '',
      city: '',
      country: 'DE'
    };
    
    if (lines.length === 0) return result;
    
    // Last line is usually PLZ + City
    const lastLine = lines[lines.length - 1];
    const plzMatch = lastLine.match(/^(\d{4,5})\s+(.+)$/);
    if (plzMatch) {
      result.postal_code = plzMatch[1];
      result.city = plzMatch[2];
      lines.pop();
    }
    
    // Check if any remaining line is a country
    if (lines.length > 0) {
      const possibleCountry = lines[lines.length - 1];
      const countries = ['Deutschland', 'Germany', 'Österreich', 'Austria', 'Schweiz', 'Switzerland', 'France', 'Frankreich'];
      if (countries.some(c => possibleCountry.toLowerCase().includes(c.toLowerCase()))) {
        result.country = possibleCountry;
        lines.pop();
      }
    }
    
    // Second to last is usually street
    if (lines.length > 0) {
      const streetLine = lines[lines.length - 1];
      // Try to extract house number
      const streetMatch = streetLine.match(/^(.+?)\s+(\d+\s*[a-zA-Z]?)$/);
      if (streetMatch) {
        result.street = streetMatch[1];
        result.house_number = streetMatch[2];
      } else {
        result.street = streetLine;
      }
      lines.pop();
    }
    
    // Remaining lines could be university/institute/department/name
    if (lines.length >= 1) result.university = lines[0];
    if (lines.length >= 2) result.institute = lines[1];
    if (lines.length >= 3) result.department = lines[2];
    
    return result;
  };

  // Save address to customer
  const saveAddressToCustomer = async () => {
    if (!customer?.id || !value?.trim()) {
      alert('Kein Kunde ausgewählt oder Adresse leer.');
      return;
    }
    
    setSaving(true);
    setSaveSuccess(false);
    
    try {
      const parsed = parseAddressText(value);
      
      // Determine address type
      let type = addressType;
      if (type === 'Einkauf') type = 'Office'; // Map to existing type
      
      const payload = {
        customer: customer.id,
        address_type: type,
        is_active: true,
        ...parsed
      };
      
      await api.post('/customers/addresses/', payload);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      alert(`Adresse als "${addressType}" beim Kunden gespeichert.`);
    } catch (err) {
      console.error('Error saving address:', err);
      alert('Fehler beim Speichern der Adresse: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Label and Dropdown */}
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {addresses.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded"
            >
              <MapPinIcon className="h-3 w-3 mr-1" />
              Adresse wählen
              <ChevronDownIcon className="h-3 w-3 ml-1" />
            </button>
            
            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute right-0 mt-1 w-72 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                {addresses.map((addr, idx) => (
                  <div
                    key={addr.id || idx}
                    onClick={() => selectAddress(addr)}
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <div className="text-xs font-medium text-gray-500 mb-1">
                      {addr.address_type || 'Adresse'}
                      {addr.is_primary && <span className="ml-1 text-blue-600">(Primär)</span>}
                    </div>
                    <div className="text-sm text-gray-900 whitespace-pre-line">
                      {formatAddress(addr).split('\n').slice(0, 3).join('\n')}
                      {formatAddress(addr).split('\n').length > 3 && '...'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Textarea */}
      <textarea
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${label} eingeben oder auswählen...`}
        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
      />
      
      {/* Email Input (optional) */}
      {email && (
        <input
          type="email"
          value={emailValue}
          onChange={(e) => onEmailChange && onEmailChange(e.target.value)}
          placeholder={`E-Mail für ${label}`}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
        />
      )}
      
      {/* Save Button */}
      {customer?.id && (
        <button
          type="button"
          onClick={saveAddressToCustomer}
          disabled={saving || !value?.trim()}
          className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded border ${
            saveSuccess 
              ? 'text-green-700 bg-green-50 border-green-200' 
              : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
          } disabled:opacity-50`}
        >
          {saving ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1"></div>
          ) : saveSuccess ? (
            <CheckIcon className="h-3 w-3 mr-1 text-green-600" />
          ) : (
            <PlusIcon className="h-3 w-3 mr-1" />
          )}
          {saveSuccess ? 'Gespeichert!' : `Als ${addressType} speichern`}
        </button>
      )}
    </div>
  );
};

export default AddressSelector;
