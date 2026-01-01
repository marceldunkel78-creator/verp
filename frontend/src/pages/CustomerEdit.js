import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { XMarkIcon, PlusIcon, TrashIcon, MapPinIcon, BuildingOfficeIcon, BeakerIcon, WrenchScrewdriverIcon, ArrowTopRightOnSquareIcon, DocumentTextIcon, UserIcon } from '@heroicons/react/24/outline';
import AddressMap from '../components/AddressMap';

const CustomerEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(isEditing);
  
  const [formData, setFormData] = useState({
    salutation: '',
    title: '',
    first_name: '',
    last_name: '',
    language: 'DE',
    advertising_status: 'neu',
    description: '',
    notes: '',
    is_active: true,
    is_reference: false,
    responsible_user: null
  });

  const [addresses, setAddresses] = useState([]);
  const [phones, setPhones] = useState([]);
  const [emails, setEmails] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);
  const [users, setUsers] = useState([]);

  // Related data for existing customers
  const [customerSystems, setCustomerSystems] = useState([]);
  const [customerProjects, setCustomerProjects] = useState([]);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerQuotations, setCustomerQuotations] = useState([]);

  useEffect(() => {
    loadUsers();
    if (isEditing) {
      loadCustomer();
    }
  }, [id]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/customers/customers/${id}/`);
      const customer = response.data;
      
      setFormData({
        salutation: customer.salutation || '',
        title: customer.title || '',
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        language: customer.language || 'DE',
        advertising_status: customer.advertising_status || 'neu',
        description: customer.description || '',
        notes: customer.notes || '',
        is_active: customer.is_active !== undefined ? customer.is_active : true,
        is_reference: customer.is_reference || false,
        responsible_user: customer.responsible_user || null
      });
      setAddresses(customer.addresses || []);
      setPhones(customer.phones || []);
      setEmails(customer.emails || []);
      
      // Load related data
      loadRelatedData(customer.id);
    } catch (error) {
      console.error('Error loading customer:', error);
      alert('Fehler beim Laden des Kunden: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/users/', { params: { is_active: true } });
      setUsers(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadRelatedData = async (customerId) => {
    try {
      const [systemsRes, projectsRes, ordersRes, quotationsRes] = await Promise.all([
        api.get(`/customers/customers/${customerId}/systems/`).catch(() => ({ data: [] })),
        api.get(`/customers/customers/${customerId}/projects/`).catch(() => ({ data: [] })),
        api.get(`/customer-orders/customer-orders/?customer=${customerId}`).catch(() => ({ data: { results: [] } })),
        api.get(`/sales/quotations/?customer=${customerId}`).catch(() => ({ data: { results: [] } }))
      ]);
      setCustomerSystems(systemsRes.data || []);
      setCustomerProjects(projectsRes.data || []);
      setCustomerOrders(ordersRes.data?.results || ordersRes.data || []);
      setCustomerQuotations(quotationsRes.data?.results || quotationsRes.data || []);
    } catch (error) {
      console.error('Error loading related data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const submitData = {
        ...formData,
        addresses: addresses
          .filter(addr => addr.street && addr.postal_code && addr.city)
          .map(addr => ({
            address_type: addr.address_type,
            is_active: addr.is_active !== undefined ? addr.is_active : true,
            university: addr.university || '',
            institute: addr.institute || '',
            department: addr.department || '',
            street: addr.street,
            house_number: addr.house_number || '',
            address_supplement: addr.address_supplement || '',
            postal_code: addr.postal_code,
            city: addr.city,
            state: addr.state || '',
            country: addr.country,
            directions: addr.directions || '',
            latitude: addr.latitude ? parseFloat(parseFloat(addr.latitude).toFixed(6)) : null,
            longitude: addr.longitude ? parseFloat(parseFloat(addr.longitude).toFixed(6)) : null
          })),
        phones: phones
          .filter(phone => phone.phone_number && phone.phone_number.trim() !== '')
          .map(phone => ({
            phone_type: phone.phone_type,
            phone_number: phone.phone_number,
            is_primary: phone.is_primary || false
          })),
        emails: emails
          .filter(email => email.email && email.email.trim() !== '')
          .map(email => ({
            email: email.email,
            is_primary: email.is_primary || false,
            newsletter_consent: email.newsletter_consent || false,
            marketing_consent: email.marketing_consent || false
          }))
      };

      console.log('Submitting customer addresses:', submitData.addresses);
      let response;
      if (isEditing) {
        response = await api.put(`/customers/customers/${id}/`, submitData);
      } else {
        response = await api.post('/customers/customers/', submitData);
      }

      console.log('Save response:', response && response.data);
      navigate('/sales/customers');
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  // Address management
  const addAddress = () => {
    setAddresses([...addresses, {
      address_type: 'Office',
      is_active: true,
      university: '',
      institute: '',
      department: '',
      street: '',
      house_number: '',
      address_supplement: '',
      postal_code: '',
      city: '',
      state: '',
      country: 'DE',
      directions: '',
      latitude: null,
      longitude: null
    }]);
    setSelectedAddressIndex(addresses.length);
  };

  const removeAddress = (index) => {
    const newAddresses = addresses.filter((_, i) => i !== index);
    setAddresses(newAddresses);
    if (selectedAddressIndex >= newAddresses.length) {
      setSelectedAddressIndex(Math.max(0, newAddresses.length - 1));
    }
  };

  const updateAddress = (index, field, value) => {
    const newAddresses = [...addresses];
    // Normalize lat/lng to numbers with 6 decimals
    if (field === 'latitude' || field === 'longitude') {
      if (value === null || value === '' || value === undefined) {
        newAddresses[index] = { ...newAddresses[index], [field]: null };
      } else {
        const num = typeof value === 'number' ? value : parseFloat(value);
        newAddresses[index] = { ...newAddresses[index], [field]: Number(num.toFixed(6)) };
      }
    } else {
      newAddresses[index] = { ...newAddresses[index], [field]: value };
    }

    console.log('Address updated', index, field, newAddresses[index]);
    setAddresses(newAddresses);
  };

  // Phone management
  const addPhone = () => {
    setPhones([...phones, { phone_type: 'Büro', phone_number: '', is_primary: false }]);
  };

  const removePhone = (index) => {
    setPhones(phones.filter((_, i) => i !== index));
  };

  const updatePhone = (index, field, value) => {
    const newPhones = [...phones];
    newPhones[index] = { ...newPhones[index], [field]: value };
    setPhones(newPhones);
  };

  // Email management
  const addEmail = () => {
    setEmails([...emails, { email: '', is_primary: false, newsletter_consent: false, marketing_consent: false }]);
  };

  const removeEmail = (index) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const updateEmail = (index, field, value) => {
    const newEmails = [...emails];
    newEmails[index] = { ...newEmails[index], [field]: value };
    setEmails(newEmails);
  };

  const selectedAddress = addresses[selectedAddressIndex];

  const tabs = [
    { id: 'basic', label: 'Basisinfos', icon: UserIcon },
    { id: 'addresses', label: 'Adressen', icon: MapPinIcon, count: addresses.length },
    ...(isEditing ? [
      { id: 'systems', label: 'Systeme', icon: BuildingOfficeIcon, count: customerSystems.length },
      { id: 'projects', label: 'Projekte', icon: BeakerIcon, count: customerProjects.length },
      { id: 'orders', label: 'Aufträge', icon: DocumentTextIcon, count: customerOrders.length },
      { id: 'quotations', label: 'Angebote', icon: DocumentTextIcon, count: customerQuotations.length }
    ] : [])
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Lade Kundendaten...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? `Kunde bearbeiten` : 'Neuer Kunde'}
          </h1>
          <button 
            onClick={() => navigate('/sales/customers')} 
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6 bg-gray-50">
          <nav className="-mb-px flex space-x-4">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    py-3 px-4 border-b-2 font-medium text-sm flex items-center whitespace-nowrap
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-200">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Anrede</label>
                    <select
                      value={formData.salutation}
                      onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">-- Wählen --</option>
                      <option value="Herr">Herr</option>
                      <option value="Frau">Frau</option>
                      <option value="Mr.">Mr.</option>
                      <option value="Ms.">Ms.</option>
                      <option value="Mrs.">Mrs.</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Titel</label>
                    <select
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">-- Kein Titel --</option>
                      <option value="Prof.">Prof.</option>
                      <option value="Dr.">Dr.</option>
                      <option value="Prof. Dr.">Prof. Dr.</option>
                      <option value="Jun-Prof.">Jun-Prof.</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Vorname *</label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nachname *</label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sprache</label>
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="DE">Deutsch</option>
                      <option value="EN">English</option>
                      <option value="FR">Français</option>
                      <option value="ES">Español</option>
                      <option value="IT">Italiano</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">Aktiv</label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_reference"
                      checked={formData.is_reference}
                      onChange={(e) => setFormData({ ...formData, is_reference: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="is_reference" className="ml-2 text-sm text-gray-700">Als Referenz geeignet</label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Werbestatus</label>
                    <select
                      value={formData.advertising_status}
                      onChange={(e) => setFormData({ ...formData, advertising_status: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="neu">Neu</option>
                      <option value="zugestimmt">Zugestimmt</option>
                      <option value="abgelehnt">Abgelehnt</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Zuständiger Mitarbeiter</label>
                    <select
                      value={formData.responsible_user || ''}
                      onChange={(e) => setFormData({ ...formData, responsible_user: e.target.value ? parseInt(e.target.value) : null })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">-- Kein Zuständiger --</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.first_name} {user.last_name} ({user.username})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                  <textarea
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Kurzbeschreibung des Kunden..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Notizen</label>
                  <textarea
                    rows="4"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Interne Notizen..."
                  />
                </div>

                {/* Contact Information in Basic Tab */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Kontaktinformationen</h3>
                  
                  {/* Telefonnummern */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-medium text-gray-700">Telefonnummern</label>
                      <button
                        type="button"
                        onClick={addPhone}
                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <PlusIcon className="h-3 w-3 mr-1" />
                        Hinzufügen
                      </button>
                    </div>
                    {phones.map((phone, index) => (
                      <div key={index} className="flex gap-3 mb-2">
                        <select
                          value={phone.phone_type}
                          onChange={(e) => updatePhone(index, 'phone_type', e.target.value)}
                          className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        >
                          <option value="Büro">Büro</option>
                          <option value="Mobil">Mobil</option>
                          <option value="Lab">Labor</option>
                        </select>
                        <input
                          type="tel"
                          value={phone.phone_number}
                          onChange={(e) => updatePhone(index, 'phone_number', e.target.value)}
                          className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          placeholder="Telefonnummer"
                        />
                        <label className="flex items-center whitespace-nowrap text-sm">
                          <input
                            type="checkbox"
                            checked={phone.is_primary}
                            onChange={(e) => updatePhone(index, 'is_primary', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-1 text-gray-700">Primär</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removePhone(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* E-Mails */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-medium text-gray-700">E-Mail-Adressen</label>
                      <button
                        type="button"
                        onClick={addEmail}
                        className="inline-flex items-center px-2 py-1 border border-transparent text-xs rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <PlusIcon className="h-3 w-3 mr-1" />
                        Hinzufügen
                      </button>
                    </div>
                    {emails.map((email, index) => (
                      <div key={index} className="flex gap-3 mb-2 items-center">
                        <input
                          type="email"
                          value={email.email}
                          onChange={(e) => updateEmail(index, 'email', e.target.value)}
                          className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          placeholder="E-Mail-Adresse"
                        />
                        <label className="flex items-center whitespace-nowrap text-sm">
                          <input
                            type="checkbox"
                            checked={email.is_primary}
                            onChange={(e) => updateEmail(index, 'is_primary', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-1 text-gray-700">Primär</span>
                        </label>
                        <label className="flex items-center whitespace-nowrap text-sm">
                          <input
                            type="checkbox"
                            checked={email.newsletter_consent}
                            onChange={(e) => updateEmail(index, 'newsletter_consent', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-1 text-gray-700">Newsletter</span>
                        </label>
                        <label className="flex items-center whitespace-nowrap text-sm">
                          <input
                            type="checkbox"
                            checked={email.marketing_consent}
                            onChange={(e) => updateEmail(index, 'marketing_consent', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-1 text-gray-700">Werbung</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeEmail(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Addresses Tab */}
            {activeTab === 'addresses' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Adressen</h3>
                  <button
                    type="button"
                    onClick={addAddress}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Adresse hinzufügen
                  </button>
                </div>

                {addresses.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Address Form */}
                    <div className="space-y-4">
                      {/* Address Tabs */}
                      <div className="flex space-x-2 overflow-x-auto">
                        {addresses.map((addr, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setSelectedAddressIndex(index)}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap ${
                              selectedAddressIndex === index
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {addr.address_type} {index + 1}
                          </button>
                        ))}
                      </div>

                      {selectedAddress && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="font-medium">Adresse {selectedAddressIndex + 1}</h4>
                            <button
                              type="button"
                              onClick={() => removeAddress(selectedAddressIndex)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Adresstyp</label>
                                <select
                                  value={selectedAddress.address_type}
                                  onChange={(e) => updateAddress(selectedAddressIndex, 'address_type', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                >
                                  <option value="Office">Büro</option>
                                  <option value="Labor">Labor</option>
                                  <option value="Post">Postanschrift</option>
                                  <option value="Lieferung">Lieferadresse</option>
                                  <option value="Rechnung">Rechnungsadresse</option>
                                </select>
                              </div>
                              <div className="flex items-end">
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedAddress.is_active}
                                    onChange={(e) => updateAddress(selectedAddressIndex, 'is_active', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2 text-sm text-gray-700">Aktiv</span>
                                </label>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">Universität</label>
                              <input
                                type="text"
                                value={selectedAddress.university}
                                onChange={(e) => updateAddress(selectedAddressIndex, 'university', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Institut</label>
                                <input
                                  type="text"
                                  value={selectedAddress.institute}
                                  onChange={(e) => updateAddress(selectedAddressIndex, 'institute', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Lehrstuhl/Abteilung</label>
                                <input
                                  type="text"
                                  value={selectedAddress.department}
                                  onChange={(e) => updateAddress(selectedAddressIndex, 'department', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Straße</label>
                                <input
                                  type="text"
                                  value={selectedAddress.street}
                                  onChange={(e) => updateAddress(selectedAddressIndex, 'street', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Nr.</label>
                                <input
                                  type="text"
                                  value={selectedAddress.house_number}
                                  onChange={(e) => updateAddress(selectedAddressIndex, 'house_number', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">Adresszusatz</label>
                              <input
                                type="text"
                                value={selectedAddress.address_supplement}
                                onChange={(e) => updateAddress(selectedAddressIndex, 'address_supplement', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">PLZ</label>
                                <input
                                  type="text"
                                  value={selectedAddress.postal_code}
                                  onChange={(e) => updateAddress(selectedAddressIndex, 'postal_code', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Stadt</label>
                                <input
                                  type="text"
                                  value={selectedAddress.city}
                                  onChange={(e) => updateAddress(selectedAddressIndex, 'city', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Bundesland/Region</label>
                                <input
                                  type="text"
                                  value={selectedAddress.state}
                                  onChange={(e) => updateAddress(selectedAddressIndex, 'state', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Land</label>
                                <select
                                  value={selectedAddress.country}
                                  onChange={(e) => updateAddress(selectedAddressIndex, 'country', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                >
                                  <option value="DE">Deutschland</option>
                                  <option value="AT">Österreich</option>
                                  <option value="CH">Schweiz</option>
                                  <option value="FR">Frankreich</option>
                                  <option value="IT">Italien</option>
                                  <option value="ES">Spanien</option>
                                  <option value="GB">Großbritannien</option>
                                  <option value="US">USA</option>
                                  <option value="CA">Kanada</option>
                                  <option value="NL">Niederlande</option>
                                  <option value="BE">Belgien</option>
                                  <option value="LU">Luxemburg</option>
                                  <option value="PL">Polen</option>
                                  <option value="CZ">Tschechien</option>
                                  <option value="SE">Schweden</option>
                                  <option value="NO">Norwegen</option>
                                  <option value="DK">Dänemark</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">Anfahrtsbeschreibung</label>
                              <textarea
                                rows="3"
                                value={selectedAddress.directions}
                                onChange={(e) => updateAddress(selectedAddressIndex, 'directions', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                placeholder="Beschreibung der Anfahrt..."
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Breitengrad</label>
                                <input
                                  type="number"
                                  step="0.000001"
                                  value={selectedAddress.latitude || ''}
                                  onChange={(e) => updateAddress(selectedAddressIndex, 'latitude', e.target.value || null)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                  placeholder="z.B. 48.137154"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Längengrad</label>
                                <input
                                  type="number"
                                  step="0.000001"
                                  value={selectedAddress.longitude || ''}
                                  onChange={(e) => updateAddress(selectedAddressIndex, 'longitude', e.target.value || null)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                  placeholder="z.B. 11.576124"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Map Preview */}
                    <div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden sticky top-4">
                        <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                          <div className="flex items-center justify-between text-sm text-gray-700">
                            <div className="flex items-center">
                              <MapPinIcon className="h-4 w-4 mr-2" />
                              Kartenansicht
                            </div>
                            {selectedAddress?.latitude && selectedAddress?.longitude && (
                              <a
                                href={`https://www.openstreetmap.org/?mlat=${selectedAddress.latitude}&mlon=${selectedAddress.longitude}#map=15/${selectedAddress.latitude}/${selectedAddress.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs"
                              >
                                In OpenStreetMap öffnen →
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="p-4 bg-gray-50">
                          <AddressMap
                            latitude={selectedAddress?.latitude}
                            longitude={selectedAddress?.longitude}
                            address={selectedAddress}
                            onPositionChange={(lat, lng) => {
                              updateAddress(selectedAddressIndex, 'latitude', lat);
                              updateAddress(selectedAddressIndex, 'longitude', lng);
                            }}
                            editable={true}
                            height="500px"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <MapPinIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>Keine Adressen vorhanden</p>
                    <button
                      type="button"
                      onClick={addAddress}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Erste Adresse hinzufügen
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Systems Tab */}
            {activeTab === 'systems' && isEditing && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Systeme ({customerSystems.length})</h3>
                  <button
                    type="button"
                    onClick={() => navigate(`/sales/systems?customer=${id}`)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Neues System
                  </button>
                </div>
                {customerSystems.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Keine Systeme vorhanden</p>
                ) : (
                  <div className="space-y-2">
                    {customerSystems.map(sys => (
                      <div key={sys.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <span className="font-medium">{sys.system_number}</span>
                          <span className="text-gray-500 ml-2">{sys.system_name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/sales/systems/${sys.id}`)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && isEditing && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Projekte ({customerProjects.length})</h3>
                  <button
                    type="button"
                    onClick={() => navigate(`/sales/projects?customer=${id}`)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Neues Projekt
                  </button>
                </div>
                {customerProjects.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Keine Projekte vorhanden</p>
                ) : (
                  <div className="space-y-2">
                    {customerProjects.map(proj => (
                      <div key={proj.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <span className="font-medium">{proj.project_number}</span>
                          <span className="text-gray-500 ml-2">{proj.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/sales/projects/${proj.id}`)}
                          className="text-green-600 hover:text-green-800"
                        >
                          <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && isEditing && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Aufträge ({customerOrders.length})</h3>
                  <button
                    type="button"
                    onClick={() => navigate(`/sales/order-processing/new?customer=${id}`)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm rounded-md text-white bg-purple-600 hover:bg-purple-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Neuer Auftrag
                  </button>
                </div>
                {customerOrders.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Keine Aufträge vorhanden</p>
                ) : (
                  <div className="space-y-2">
                    {customerOrders.map(order => (
                      <div key={order.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <span className="font-medium">{order.order_number}</span>
                          <span className="text-gray-500 ml-2">{order.title || 'Ohne Titel'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/sales/order-processing/${order.id}`)}
                          className="text-purple-600 hover:text-purple-800"
                        >
                          <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quotations Tab */}
            {activeTab === 'quotations' && isEditing && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Angebote ({customerQuotations.length})</h3>
                  <button
                    type="button"
                    onClick={() => navigate(`/sales/quotations/new?customer=${id}`)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Neues Angebot
                  </button>
                </div>
                {customerQuotations.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Keine Angebote vorhanden</p>
                ) : (
                  <div className="space-y-2">
                    {customerQuotations.map(quot => (
                      <div key={quot.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <span className="font-medium">{quot.quotation_number}</span>
                          <span className="text-gray-500 ml-2">{quot.title || 'Ohne Titel'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/sales/quotations/${quot.id}`)}
                          className="text-yellow-600 hover:text-yellow-800"
                        >
                          <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t bg-gray-50 px-6 py-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/sales/customers')}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Speichert...' : isEditing ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerEdit;
