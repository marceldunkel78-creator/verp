import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  KeyIcon,
  UserIcon,
  CogIcon,
  DocumentTextIcon,
  ArrowLeftIcon,
  CheckIcon,
  XMarkIcon,
  LinkIcon
} from '@heroicons/react/24/outline';

const VisiViewLicenseEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  
  const [license, setLicense] = useState({
    serial_number: '',
    internal_serial: '',
    customer: null,
    customer_name_legacy: '',
    customer_address_legacy: '',
    distributor: '',
    version: '',
    options_bitmask: 0,
    options_upper_32bit: 0,
    delivery_date: '',
    expire_date: '',
    maintenance_date: '',
    purchase_order: '',
    status: 'active',
    is_demo: false,
    is_loaner: false,
    is_defect: false,
    is_returned: false,
    is_cancelled: false,
    is_lost: false,
    is_outdated: false,
    return_date: '',
    demo_options: 0,
    demo_options_expire_date: '',
    dongle_batch_id: null,
    dongle_version: 1,
    dongle_mod_count: 0,
    support_end: '',
    support_warning: false,
    info: '',
    todo: ''
  });
  
  const [activeOptions, setActiveOptions] = useState([]);
  const [allOptions, setAllOptions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOptions();
    if (!isNew) {
      fetchLicense();
    }
  }, [id]);

  const fetchLicense = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/visiview/licenses/${id}/`);
      const data = response.data;
      
      // Format dates
      ['delivery_date', 'expire_date', 'maintenance_date', 'return_date', 'demo_options_expire_date', 'support_end'].forEach(field => {
        if (data[field]) {
          data[field] = data[field].split('T')[0];
        }
      });
      
      setLicense(data);
      setActiveOptions(data.active_options || []);
    } catch (error) {
      console.error('Error fetching license:', error);
      setError('Lizenz konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const response = await api.get('/visiview/options/?is_active=true');
      setAllOptions(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  const searchCustomers = async (query) => {
    if (query.length < 2) {
      setCustomers([]);
      return;
    }
    try {
      const response = await api.get(`/customers/customers/?search=${encodeURIComponent(query)}`);
      setCustomers(response.data.results || response.data);
    } catch (error) {
      console.error('Error searching customers:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLicense(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCustomerSelect = (customer) => {
    setLicense(prev => ({
      ...prev,
      customer: customer.id,
      customer_name_legacy: `${customer.title || ''} ${customer.first_name} ${customer.last_name}`.trim()
    }));
    setCustomerSearch('');
    setCustomers([]);
  };

  const handleToggleOption = async (bitPosition) => {
    const isEnabled = license.options_bitmask & (1 << bitPosition) || 
                      license.options_upper_32bit & (1 << (bitPosition - 32));
    
    if (!isNew && license.id) {
      try {
        await api.post(`/visiview/licenses/${license.id}/toggle_option/`, {
          bit_position: bitPosition,
          enabled: !isEnabled
        });
        await fetchLicense();
      } catch (error) {
        console.error('Error toggling option:', error);
        alert('Fehler beim Ändern der Option.');
      }
    } else {
      // Local update for new licenses
      if (bitPosition < 32) {
        const newMask = isEnabled 
          ? license.options_bitmask & ~(1 << bitPosition)
          : license.options_bitmask | (1 << bitPosition);
        setLicense(prev => ({ ...prev, options_bitmask: newMask }));
      } else {
        const newMask = isEnabled
          ? license.options_upper_32bit & ~(1 << (bitPosition - 32))
          : license.options_upper_32bit | (1 << (bitPosition - 32));
        setLicense(prev => ({ ...prev, options_upper_32bit: newMask }));
      }
    }
  };

  const isOptionEnabled = (bitPosition) => {
    if (bitPosition < 32) {
      return Boolean(license.options_bitmask & (1 << bitPosition));
    } else {
      return Boolean(license.options_upper_32bit & (1 << (bitPosition - 32)));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const payload = { ...license };
      // Clean up empty dates
      ['delivery_date', 'expire_date', 'maintenance_date', 'return_date', 'demo_options_expire_date', 'support_end'].forEach(field => {
        if (!payload[field]) {
          payload[field] = null;
        }
      });
      
      if (isNew) {
        const response = await api.post('/visiview/licenses/', payload);
        navigate(`/visiview/licenses/${response.data.id}`);
      } else {
        await api.put(`/visiview/licenses/${id}/`, payload);
        await fetchLicense();
      }
    } catch (error) {
      console.error('Error saving license:', error);
      setError(error.response?.data?.detail || 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'details', name: 'Details', icon: DocumentTextIcon },
    { id: 'options', name: 'Optionen', icon: CogIcon },
    { id: 'customer', name: 'Kunde', icon: UserIcon },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/visiview/licenses')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <KeyIcon className="h-8 w-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isNew ? 'Neue Lizenz' : `Lizenz ${license.serial_number}`}
              </h1>
              {!isNew && license.license_number && (
                <p className="text-sm text-gray-500">{license.license_number}</p>
              )}
            </div>
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Seriennummer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seriennummer (Dongle) *
                </label>
                <input
                  type="text"
                  name="serial_number"
                  value={license.serial_number}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              
              {/* Interne Seriennummer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interne Seriennummer
                </label>
                <input
                  type="text"
                  name="internal_serial"
                  value={license.internal_serial}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="z.B. 0x7"
                />
              </div>
              
              {/* Version */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Version
                </label>
                <input
                  type="text"
                  name="version"
                  value={license.version}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="z.B. 2.1.0"
                />
              </div>
              
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={license.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Aktiv</option>
                  <option value="demo">Demo</option>
                  <option value="loaner">Leihgerät</option>
                  <option value="returned">Zurückgegeben</option>
                  <option value="cancelled">Storniert</option>
                  <option value="defect">Defekt</option>
                  <option value="lost">Verloren</option>
                </select>
              </div>
              
              {/* Lieferdatum */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lieferdatum
                </label>
                <input
                  type="date"
                  name="delivery_date"
                  value={license.delivery_date || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              {/* Ablaufdatum */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ablaufdatum
                </label>
                <input
                  type="date"
                  name="expire_date"
                  value={license.expire_date || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              {/* Wartung bis */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Wartung bis
                </label>
                <input
                  type="date"
                  name="maintenance_date"
                  value={license.maintenance_date || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              {/* Bestellnummer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bestellnummer
                </label>
                <input
                  type="text"
                  name="purchase_order"
                  value={license.purchase_order}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              {/* Distributor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Distributor
                </label>
                <input
                  type="text"
                  name="distributor"
                  value={license.distributor}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            
            {/* Status Flags */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Status-Flags</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { name: 'is_demo', label: 'Demo' },
                  { name: 'is_loaner', label: 'Leihgerät' },
                  { name: 'is_defect', label: 'Defekt' },
                  { name: 'is_returned', label: 'Zurückgegeben' },
                  { name: 'is_cancelled', label: 'Storniert' },
                  { name: 'is_lost', label: 'Verloren' },
                  { name: 'is_outdated', label: 'Veraltet' },
                  { name: 'support_warning', label: 'Support-Warnung' },
                ].map((flag) => (
                  <label key={flag.name} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name={flag.name}
                      checked={license[flag.name]}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">{flag.label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Info & Todo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Info/Notizen
                </label>
                <textarea
                  name="info"
                  value={license.info}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To-Do
                </label>
                <textarea
                  name="todo"
                  value={license.todo}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Options Tab */}
        {activeTab === 'options' && (
          <div>
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Freigeschaltete Optionen ({activeOptions.length || 
                  allOptions.filter(o => isOptionEnabled(o.bit_position)).length})
              </h3>
              <div className="text-sm text-gray-500">
                Bitmask: {license.options_bitmask} | Upper: {license.options_upper_32bit}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allOptions.map((option) => {
                const enabled = isOptionEnabled(option.bit_position);
                return (
                  <div
                    key={option.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      enabled
                        ? 'bg-indigo-50 border-indigo-300'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => handleToggleOption(option.bit_position)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        enabled ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}>
                        {enabled ? (
                          <CheckIcon className="h-5 w-5 text-white" />
                        ) : (
                          <XMarkIcon className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{option.name}</div>
                        <div className="text-xs text-gray-500">Bit {option.bit_position}</div>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-700">
                      {option.price && parseFloat(option.price) > 0 ? `${parseFloat(option.price).toFixed(2)} €` : '-'}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {allOptions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Keine Optionen verfügbar. Bitte importieren Sie zuerst die VisiView-Optionen.
              </div>
            )}
          </div>
        )}

        {/* Customer Tab */}
        {activeTab === 'customer' && (
          <div className="space-y-6">
            {/* Kundenverknüpfung */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kunde verknüpfen
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    searchCustomers(e.target.value);
                  }}
                  placeholder="Kundenname oder Kundennummer suchen..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                {customers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                    {customers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => handleCustomerSelect(customer)}
                        className="w-full px-4 py-2 text-left hover:bg-indigo-50 flex justify-between items-center"
                      >
                        <span>
                          {customer.title} {customer.first_name} {customer.last_name}
                        </span>
                        <span className="text-sm text-gray-500">{customer.customer_number}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Aktueller Kunde */}
            {license.customer && (
              <div className="bg-indigo-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LinkIcon className="h-5 w-5 text-indigo-600" />
                    <div>
                      <div className="font-medium text-gray-900">
                        Verknüpft mit Kunde
                      </div>
                      <button
                        onClick={() => navigate(`/customers/${license.customer}`)}
                        className="text-indigo-600 hover:underline"
                      >
                        {license.customer_name_legacy || 'Kunde anzeigen'}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setLicense(prev => ({ ...prev, customer: null }))}
                    className="text-red-600 hover:text-red-700"
                  >
                    Verknüpfung entfernen
                  </button>
                </div>
              </div>
            )}
            
            {/* Legacy-Daten */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Importierte Kundendaten (Legacy)</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kundenname (Import)
                  </label>
                  <input
                    type="text"
                    name="customer_name_legacy"
                    value={license.customer_name_legacy}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kundenadresse (Import)
                  </label>
                  <textarea
                    name="customer_address_legacy"
                    value={license.customer_address_legacy}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisiViewLicenseEdit;
