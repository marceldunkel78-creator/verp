import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  PlusIcon, TrashIcon, BuildingOfficeIcon, 
  EnvelopeIcon, PhoneIcon, BanknotesIcon, 
  UserGroupIcon, MapPinIcon 
} from '@heroicons/react/24/outline';
import { COUNTRIES } from '../utils/countries';

const CompanySettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const canWrite = user?.is_staff || user?.is_superuser;

  const [formData, setFormData] = useState({
    company_name: '',
    email_orders: '',
    email_general: '',
    email_service: '',
    email_sales: '',
    phone_central: '',
    website: '',
    trade_register_number: '',
    professional_association: '',
    vat_id: '',
  });

  const [addresses, setAddresses] = useState([]);
  const [managers, setManagers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings/company-settings/');
      const data = response.data.results?.[0] || response.data;
      setSettings(data);
      
      setFormData({
        company_name: data.company_name || '',
        email_orders: data.email_orders || '',
        email_general: data.email_general || '',
        email_service: data.email_service || '',
        email_sales: data.email_sales || '',
        phone_central: data.phone_central || '',
        website: data.website || '',
        trade_register_number: data.trade_register_number || '',
        professional_association: data.professional_association || '',
        vat_id: data.vat_id || '',
      });
      
      setAddresses(data.addresses || []);
      setManagers(data.managers || []);
      setBankAccounts(data.bank_accounts || []);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const submitData = {
        ...formData,
        addresses: addresses.map(addr => ({
          address_type: addr.address_type,
          street: addr.street,
          house_number: addr.house_number,
          address_supplement: addr.address_supplement || '',
          postal_code: addr.postal_code,
          city: addr.city,
          state: addr.state || '',
          country: addr.country,
          is_primary: addr.is_primary || false
        })),
        managers: managers.map(mgr => ({
          title: mgr.title || '',
          first_name: mgr.first_name,
          last_name: mgr.last_name,
          position: mgr.position,
          email: mgr.email || '',
          phone: mgr.phone || ''
        })),
        bank_accounts: bankAccounts
          .filter(acc => acc.iban && acc.iban.trim() !== '') // Nur Konten mit IBAN
          .map(acc => ({
            bank_name: acc.bank_name,
            account_holder: acc.account_holder || '',
            iban: acc.iban,
            bic: acc.bic || '',
            currency: acc.currency,
            is_primary: acc.is_primary || false,
            notes: acc.notes || ''
          }))
      };
      
      await api.put('/settings/company-settings/1/', submitData);
      alert('Einstellungen erfolgreich gespeichert');
      fetchSettings();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      let errorMessage = 'Unbekannter Fehler';
      if (error.response?.data) {
        if (typeof error.response.data === 'object') {
          errorMessage = JSON.stringify(error.response.data, null, 2);
        } else {
          errorMessage = error.response.data.detail || error.response.data;
        }
      }
      alert('Fehler beim Speichern:\n' + errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Address functions
  const addAddress = () => {
    setAddresses([...addresses, {
      address_type: 'Hauptsitz',
      street: '',
      house_number: '',
      address_supplement: '',
      postal_code: '',
      city: '',
      state: '',
      country: 'DE',
      is_primary: addresses.length === 0
    }]);
  };

  const removeAddress = (index) => {
    setAddresses(addresses.filter((_, i) => i !== index));
  };

  const updateAddress = (index, field, value) => {
    const updated = [...addresses];
    updated[index][field] = value;
    setAddresses(updated);
  };

  // Manager functions
  const addManager = () => {
    setManagers([...managers, {
      title: '',
      first_name: '',
      last_name: '',
      position: 'Geschäftsführer',
      email: '',
      phone: ''
    }]);
  };

  const removeManager = (index) => {
    setManagers(managers.filter((_, i) => i !== index));
  };

  const updateManager = (index, field, value) => {
    const updated = [...managers];
    updated[index][field] = value;
    setManagers(updated);
  };

  // Bank Account functions
  const addBankAccount = () => {
    setBankAccounts([...bankAccounts, {
      bank_name: '',
      account_holder: formData.company_name,
      iban: '',
      bic: '',
      currency: 'EUR',
      is_primary: bankAccounts.length === 0,
      notes: ''
    }]);
  };

  const removeBankAccount = (index) => {
    setBankAccounts(bankAccounts.filter((_, i) => i !== index));
  };

  const updateBankAccount = (index, field, value) => {
    const updated = [...bankAccounts];
    updated[index][field] = value;
    setBankAccounts(updated);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Lade...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <BuildingOfficeIcon className="h-8 w-8 mr-3 text-blue-600" />
          Firmeneinstellungen
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Allgemeine Firmendaten, Kontaktinformationen und Registrierungen
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Grunddaten */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <BuildingOfficeIcon className="h-6 w-6 mr-2 text-blue-600" />
            Grunddaten
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Firmenname *
              </label>
              <input
                type="text"
                required
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={!canWrite}
              />
            </div>
          </div>
        </div>

        {/* Kontaktdaten */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <EnvelopeIcon className="h-6 w-6 mr-2 text-blue-600" />
            Kontaktdaten
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                E-Mail für Kundenbestellungen
              </label>
              <input
                type="email"
                value={formData.email_orders}
                onChange={(e) => setFormData({ ...formData, email_orders: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={!canWrite}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                E-Mail für allgemeine Anfragen
              </label>
              <input
                type="email"
                value={formData.email_general}
                onChange={(e) => setFormData({ ...formData, email_general: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={!canWrite}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                E-Mail für Service
              </label>
              <input
                type="email"
                value={formData.email_service}
                onChange={(e) => setFormData({ ...formData, email_service: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={!canWrite}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                E-Mail für Vertrieb
              </label>
              <input
                type="email"
                value={formData.email_sales}
                onChange={(e) => setFormData({ ...formData, email_sales: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={!canWrite}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center">
                <PhoneIcon className="h-4 w-4 mr-1" />
                Zentrale Telefonnummer
              </label>
              <input
                type="tel"
                value={formData.phone_central}
                onChange={(e) => setFormData({ ...formData, phone_central: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={!canWrite}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="https://www.firmenseite.de"
                disabled={!canWrite}
              />
            </div>
          </div>
        </div>

        {/* Adressen */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <MapPinIcon className="h-6 w-6 mr-2 text-blue-600" />
              Adressen
            </h2>
            {canWrite && (
              <button
                type="button"
                onClick={addAddress}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Adresse hinzufügen
              </button>
            )}
          </div>
          
          {addresses.map((address, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-medium text-gray-900">Adresse {index + 1}</h3>
                {canWrite && addresses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAddress(index)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Adresstyp</label>
                  <input
                    type="text"
                    value={address.address_type}
                    onChange={(e) => updateAddress(index, 'address_type', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="z.B. Hauptsitz, Niederlassung"
                    disabled={!canWrite}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={address.is_primary || false}
                      onChange={(e) => updateAddress(index, 'is_primary', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={!canWrite}
                    />
                    <span className="ml-2 text-sm text-gray-700">Hauptadresse</span>
                  </label>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Straße</label>
                  <input
                    type="text"
                    value={address.street}
                    onChange={(e) => updateAddress(index, 'street', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700">Hausnummer</label>
                  <input
                    type="text"
                    value={address.house_number}
                    onChange={(e) => updateAddress(index, 'house_number', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Adresszusatz</label>
                  <input
                    type="text"
                    value={address.address_supplement || ''}
                    onChange={(e) => updateAddress(index, 'address_supplement', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">PLZ</label>
                  <input
                    type="text"
                    value={address.postal_code}
                    onChange={(e) => updateAddress(index, 'postal_code', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stadt</label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) => updateAddress(index, 'city', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bundesland</label>
                  <input
                    type="text"
                    value={address.state || ''}
                    onChange={(e) => updateAddress(index, 'state', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Land</label>
                  <select
                    value={address.country}
                    onChange={(e) => updateAddress(index, 'country', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  >
                    {COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Geschäftsführer */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <UserGroupIcon className="h-6 w-6 mr-2 text-blue-600" />
              Geschäftsführer
            </h2>
            {canWrite && (
              <button
                type="button"
                onClick={addManager}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Geschäftsführer hinzufügen
              </button>
            )}
          </div>
          
          {managers.map((manager, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-medium text-gray-900">Geschäftsführer {index + 1}</h3>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => removeManager(index)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Titel</label>
                  <input
                    type="text"
                    value={manager.title || ''}
                    onChange={(e) => updateManager(index, 'title', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Dr., Prof."
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Vorname</label>
                  <input
                    type="text"
                    value={manager.first_name}
                    onChange={(e) => updateManager(index, 'first_name', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nachname</label>
                  <input
                    type="text"
                    value={manager.last_name}
                    onChange={(e) => updateManager(index, 'last_name', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Position</label>
                  <input
                    type="text"
                    value={manager.position}
                    onChange={(e) => updateManager(index, 'position', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">E-Mail</label>
                  <input
                    type="email"
                    value={manager.email || ''}
                    onChange={(e) => updateManager(index, 'email', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefon</label>
                  <input
                    type="tel"
                    value={manager.phone || ''}
                    onChange={(e) => updateManager(index, 'phone', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bankverbindungen */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <BanknotesIcon className="h-6 w-6 mr-2 text-blue-600" />
              Bankverbindungen
            </h2>
            {canWrite && (
              <button
                type="button"
                onClick={addBankAccount}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Konto hinzufügen
              </button>
            )}
          </div>
          
          {bankAccounts.map((account, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-medium text-gray-900">Bankkonto {index + 1}</h3>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => removeBankAccount(index)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bankname</label>
                  <input
                    type="text"
                    value={account.bank_name}
                    onChange={(e) => updateBankAccount(index, 'bank_name', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kontoinhaber</label>
                  <input
                    type="text"
                    value={account.account_holder || ''}
                    onChange={(e) => updateBankAccount(index, 'account_holder', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">IBAN</label>
                  <input
                    type="text"
                    value={account.iban}
                    onChange={(e) => updateBankAccount(index, 'iban', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">BIC/SWIFT</label>
                  <input
                    type="text"
                    value={account.bic || ''}
                    onChange={(e) => updateBankAccount(index, 'bic', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Währung</label>
                  <select
                    value={account.currency}
                    onChange={(e) => updateBankAccount(index, 'currency', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="CHF">CHF</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={account.is_primary || false}
                      onChange={(e) => updateBankAccount(index, 'is_primary', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      disabled={!canWrite}
                    />
                    <span className="ml-2 text-sm text-gray-700">Hauptkonto</span>
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Notizen</label>
                  <textarea
                    rows="2"
                    value={account.notes || ''}
                    onChange={(e) => updateBankAccount(index, 'notes', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canWrite}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Registrierungen */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Registrierungen</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Handelsregisternummer</label>
              <input
                type="text"
                value={formData.trade_register_number}
                onChange={(e) => setFormData({ ...formData, trade_register_number: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={!canWrite}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Berufsgenossenschaft</label>
              <input
                type="text"
                value={formData.professional_association}
                onChange={(e) => setFormData({ ...formData, professional_association: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                disabled={!canWrite}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Umsatzsteuer-ID</label>
              <input
                type="text"
                value={formData.vat_id}
                onChange={(e) => setFormData({ ...formData, vat_id: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="z.B. DE123456789"
                disabled={!canWrite}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        {canWrite && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
            >
              {saving ? 'Speichere...' : 'Einstellungen speichern'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default CompanySettings;
