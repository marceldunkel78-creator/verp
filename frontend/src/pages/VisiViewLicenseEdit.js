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
  LinkIcon,
  ClockIcon,
  PlusIcon,
  TrashIcon
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
  
  // Maintenance state
  const [maintenanceData, setMaintenanceData] = useState({
    total_expenditures: 0,
    total_credits: 0,
    current_balance: 0,
    time_credits: [],
    time_expenditures: []
  });
  const [employees, setEmployees] = useState([]);
  const [showExpenditureModal, setShowExpenditureModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [editingExpenditure, setEditingExpenditure] = useState(null);
  const [editingCredit, setEditingCredit] = useState(null);
  const [expenditureForm, setExpenditureForm] = useState({
    date: '', time: '', user: '', activity: '', task_type: '', 
    hours_spent: '', comment: '', is_goodwill: false
  });
  const [creditForm, setCreditForm] = useState({
    start_date: '', end_date: '', user: '', credit_hours: ''
  });

  useEffect(() => {
    fetchOptions();
    fetchEmployees();
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
      
      // Fetch maintenance data
      await fetchMaintenance();
    } catch (error) {
      console.error('Error fetching license:', error);
      setError('Lizenz konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenance = async () => {
    if (isNew) return;
    try {
      const response = await api.get(`/visiview/licenses/${id}/maintenance/`);
      setMaintenanceData(response.data);
    } catch (error) {
      console.error('Error fetching maintenance data:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/users/?is_active=true');
      setEmployees(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
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

  // Maintenance handlers
  const openExpenditureModal = (expenditure = null) => {
    if (expenditure) {
      setEditingExpenditure(expenditure);
      setExpenditureForm({
        date: expenditure.date || '',
        time: expenditure.time || '',
        user: expenditure.user || '',
        activity: expenditure.activity || '',
        task_type: expenditure.task_type || '',
        hours_spent: expenditure.hours_spent || '',
        comment: expenditure.comment || '',
        is_goodwill: expenditure.is_goodwill || false
      });
    } else {
      setEditingExpenditure(null);
      setExpenditureForm({
        date: '', time: '', user: '', activity: '', task_type: '',
        hours_spent: '', comment: '', is_goodwill: false
      });
    }
    setShowExpenditureModal(true);
  };

  const openCreditModal = (credit = null) => {
    if (credit) {
      setEditingCredit(credit);
      setCreditForm({
        start_date: credit.start_date || '',
        end_date: credit.end_date || '',
        user: credit.user || '',
        credit_hours: credit.credit_hours || ''
      });
    } else {
      setEditingCredit(null);
      setCreditForm({
        start_date: '', end_date: '', user: '', credit_hours: ''
      });
    }
    setShowCreditModal(true);
  };

  const handleSaveExpenditure = async () => {
    try {
      if (editingExpenditure) {
        await api.patch(`/visiview/licenses/${id}/update_time_expenditure/${editingExpenditure.id}/`, expenditureForm);
      } else {
        await api.post(`/visiview/licenses/${id}/add_time_expenditure/`, expenditureForm);
      }
      setShowExpenditureModal(false);
      await fetchMaintenance();
    } catch (error) {
      console.error('Error saving expenditure:', error);
      alert('Fehler beim Speichern der Zeitaufwendung');
    }
  };

  const handleDeleteExpenditure = async (expenditureId) => {
    if (!window.confirm('Möchten Sie diese Zeitaufwendung wirklich löschen?')) return;
    try {
      await api.delete(`/visiview/licenses/${id}/delete_time_expenditure/${expenditureId}/`);
      await fetchMaintenance();
    } catch (error) {
      console.error('Error deleting expenditure:', error);
      alert('Fehler beim Löschen');
    }
  };

  const handleSaveCredit = async () => {
    try {
      if (editingCredit) {
        await api.patch(`/visiview/licenses/${id}/update_time_credit/${editingCredit.id}/`, creditForm);
      } else {
        await api.post(`/visiview/licenses/${id}/add_time_credit/`, creditForm);
      }
      setShowCreditModal(false);
      await fetchMaintenance();
    } catch (error) {
      console.error('Error saving credit:', error);
      alert('Fehler beim Speichern der Zeitgutschrift');
    }
  };

  const handleDeleteCredit = async (creditId) => {
    if (!window.confirm('Möchten Sie diese Zeitgutschrift wirklich löschen?')) return;
    try {
      await api.delete(`/visiview/licenses/${id}/delete_time_credit/${creditId}/`);
      await fetchMaintenance();
    } catch (error) {
      console.error('Error deleting credit:', error);
      alert('Fehler beim Löschen');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  const formatDecimal = (value) => {
    if (value === null || value === undefined) return '0.00';
    return parseFloat(value).toFixed(2);
  };

  const tabs = [
    { id: 'details', name: 'Details', icon: DocumentTextIcon },
    { id: 'options', name: 'Optionen', icon: CogIcon },
    { id: 'customer', name: 'Kunde', icon: UserIcon },
    { id: 'maintenance', name: 'Maintenance', icon: ClockIcon },
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

        {/* Maintenance Tab */}
        {activeTab === 'maintenance' && !isNew && (
          <div className="space-y-6">
            {/* Summary Section */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">
                  {formatDecimal(maintenanceData.total_expenditures)} h
                </div>
                <div className="text-sm text-gray-600">Zeitaufwendungen</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatDecimal(maintenanceData.total_credits)} h
                </div>
                <div className="text-sm text-gray-600">Zeitgutschriften</div>
              </div>
              <div className={`p-4 rounded-lg text-center ${parseFloat(maintenanceData.current_balance) >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <div className={`text-2xl font-bold ${parseFloat(maintenanceData.current_balance) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {parseFloat(maintenanceData.current_balance) >= 0 ? '+' : ''}{formatDecimal(maintenanceData.current_balance)} h
                </div>
                <div className="text-sm text-gray-600">Zeitguthaben</div>
              </div>
            </div>

            {/* Two column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Zeitaufwendungen */}
              <div className="bg-white border rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Zeitaufwendungen</h3>
                  <button
                    onClick={() => openExpenditureModal()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Neu
                  </button>
                </div>
                
                {maintenanceData.time_expenditures.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">Keine Zeitaufwendungen</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {maintenanceData.time_expenditures.map(exp => (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                        onClick={() => openExpenditureModal(exp)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatDate(exp.date)}</span>
                            {exp.time && <span className="text-gray-500">{exp.time}</span>}
                            {exp.is_goodwill && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">Kulanz</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {exp.activity_display} - {exp.task_type_display}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-red-600">{exp.hours_spent} h</div>
                          <div className="text-xs text-gray-500">{exp.user_name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Zeitgutschriften */}
              <div className="bg-white border rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Zeitgutschriften</h3>
                  <button
                    onClick={() => openCreditModal()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Neu
                  </button>
                </div>
                
                {maintenanceData.time_credits.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">Keine Zeitgutschriften</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {maintenanceData.time_credits.map(credit => (
                      <div
                        key={credit.id}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${
                          credit.is_expired ? 'bg-gray-100 opacity-60' : credit.is_active ? 'bg-green-50 hover:bg-green-100' : 'bg-yellow-50'
                        }`}
                        onClick={() => openCreditModal(credit)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Gültig bis: {formatDate(credit.end_date)}</span>
                            {credit.is_expired && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Abgelaufen</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            Ab {formatDate(credit.start_date)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-600">{credit.credit_hours} h</div>
                          <div className="text-sm text-gray-500">
                            Rest: <span className={parseFloat(credit.remaining_hours) > 0 ? 'text-green-600' : 'text-gray-400'}>{credit.remaining_hours} h</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && isNew && (
          <div className="text-center py-12 text-gray-500">
            Maintenance-Daten sind erst nach dem Speichern der Lizenz verfügbar.
          </div>
        )}
      </div>

      {/* Expenditure Modal */}
      {showExpenditureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingExpenditure ? 'Zeitaufwendung bearbeiten' : 'Neue Zeitaufwendung'}
              </h3>
              <button onClick={() => setShowExpenditureModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
                  <input
                    type="date"
                    value={expenditureForm.date}
                    onChange={(e) => setExpenditureForm({...expenditureForm, date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Uhrzeit</label>
                  <input
                    type="time"
                    value={expenditureForm.time}
                    onChange={(e) => setExpenditureForm({...expenditureForm, time: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter *</label>
                <select
                  value={expenditureForm.user}
                  onChange={(e) => setExpenditureForm({...expenditureForm, user: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Auswählen...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aktivität *</label>
                  <select
                    value={expenditureForm.activity}
                    onChange={(e) => setExpenditureForm({...expenditureForm, activity: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Auswählen...</option>
                    <option value="email_support">Email Support</option>
                    <option value="remote_support">Remote Support</option>
                    <option value="phone_support">Telefon Support</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tätigkeit *</label>
                  <select
                    value={expenditureForm.task_type}
                    onChange={(e) => setExpenditureForm({...expenditureForm, task_type: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Auswählen...</option>
                    <option value="training">Schulung</option>
                    <option value="testing">Test</option>
                    <option value="bugs">Bugs</option>
                    <option value="other">Sonstiges</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aufgewendete Zeit (h) *</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={expenditureForm.hours_spent}
                    onChange={(e) => setExpenditureForm({...expenditureForm, hours_spent: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="z.B. 1.5"
                    required
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expenditureForm.is_goodwill}
                      onChange={(e) => setExpenditureForm({...expenditureForm, is_goodwill: e.target.checked})}
                      className="h-4 w-4 text-indigo-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Kulanz</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kommentar</label>
                <textarea
                  value={expenditureForm.comment}
                  onChange={(e) => setExpenditureForm({...expenditureForm, comment: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Beschreibung der Tätigkeit..."
                />
              </div>

              {editingExpenditure && editingExpenditure.deductions && editingExpenditure.deductions.length > 0 && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-2">Abzüge von Gutschriften</div>
                  <div className="space-y-1">
                    {editingExpenditure.deductions.map(d => (
                      <div key={d.id} className="flex justify-between items-center text-sm text-gray-700">
                        <div>
                          Gutschrift #{d.credit_id} (bis {d.credit_end || '-'})
                        </div>
                        <div className="font-semibold text-gray-900">- {parseFloat(d.hours_deducted).toFixed(2)} h</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-between mt-6">
              {editingExpenditure && (
                <button
                  onClick={() => { handleDeleteExpenditure(editingExpenditure.id); setShowExpenditureModal(false); }}
                  className="px-4 py-2 text-red-600 hover:text-red-700"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={() => setShowExpenditureModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveExpenditure}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingCredit ? 'Zeitgutschrift bearbeiten' : 'Neue Zeitgutschrift'}
              </h3>
              <button onClick={() => setShowCreditModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beginn-Datum *</label>
                  <input
                    type="date"
                    value={creditForm.start_date}
                    onChange={(e) => setCreditForm({...creditForm, start_date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ende-Datum *</label>
                  <input
                    type="date"
                    value={creditForm.end_date}
                    onChange={(e) => setCreditForm({...creditForm, end_date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter</label>
                <select
                  value={creditForm.user}
                  onChange={(e) => setCreditForm({...creditForm, user: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Auswählen...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zeitgutschrift (h) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={creditForm.credit_hours}
                  onChange={(e) => setCreditForm({...creditForm, credit_hours: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="z.B. 10"
                  required
                />
              </div>

              {editingCredit && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Rest-Zeitgutschrift:</span> {editingCredit.remaining_hours} h
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-between mt-6">
              {editingCredit && (
                <button
                  onClick={() => { handleDeleteCredit(editingCredit.id); setShowCreditModal(false); }}
                  className="px-4 py-2 text-red-600 hover:text-red-700"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={() => setShowCreditModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveCredit}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisiViewLicenseEdit;
