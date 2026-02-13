import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { XMarkIcon, PlusIcon, TrashIcon, MapPinIcon, BuildingOfficeIcon, BeakerIcon, WrenchScrewdriverIcon, ArrowTopRightOnSquareIcon, DocumentTextIcon, UserIcon, KeyIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
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
  const [customerLicenses, setCustomerLicenses] = useState([]);
  const [customerLicensesPage, setCustomerLicensesPage] = useState(1);
  const [customerLicensesPageSize] = useState(9);
  const [customerLicensesTotal, setCustomerLicensesTotal] = useState(0);

  // Contact History State
  const [contactHistory, setContactHistory] = useState([]);
  const [contactHistoryLoading, setContactHistoryLoading] = useState(false);
  const [showContactHistoryModal, setShowContactHistoryModal] = useState(false);
  const [editingContactHistory, setEditingContactHistory] = useState(null);
  const [contactHistoryForm, setContactHistoryForm] = useState({
    contact_date: new Date().toISOString().split('T')[0],
    contact_type: 'EMAIL',
    comment: '',
    system_ids: []
  });

  const resolveSystemIdFromNumber = (systemNumber) => {
    if (!systemNumber || !customerSystems.length) return null;
    const match = customerSystems.find((sys) => sys.system_number === systemNumber);
    return match ? match.id : null;
  };

  useEffect(() => {
    loadUsers();
    if (isEditing) {
      loadCustomer();
    }
  }, [id]);

  // Refetch customer's licenses when the page changes
  useEffect(() => {
    if (isEditing) {
      fetchCustomerLicenses(id, customerLicensesPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerLicensesPage]);

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
      setAddresses((customer.addresses || []).map(a => ({
        ...a,
        latitude: a.latitude !== null && a.latitude !== undefined ? parseFloat(a.latitude) : null,
        longitude: a.longitude !== null && a.longitude !== undefined ? parseFloat(a.longitude) : null
      })));
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

  const fetchCustomerLicenses = async (customerId, page = 1) => {
    try {
      const params = new URLSearchParams();
      params.append('customer', customerId);
      params.append('page_size', String(customerLicensesPageSize));
      params.append('page', String(page));
      const resp = await api.get(`/visiview/licenses/?${params.toString()}`).catch(() => ({ data: { results: [], count: 0 } }));
      if (resp.data && resp.data.results) {
        setCustomerLicenses(resp.data.results || []);
        setCustomerLicensesTotal(resp.data.count || resp.data.results.length);
      } else {
        setCustomerLicenses(resp.data || []);
        setCustomerLicensesTotal((resp.data && resp.data.length) ? resp.data.length : 0);
      }
    } catch (error) {
      console.error('Error fetching customer licenses:', error);
    }
  };

  // Contact History Functions
  const fetchContactHistory = async () => {
    setContactHistoryLoading(true);
    try {
      const response = await api.get(`/customers/contact-history/?customer=${id}`);
      setContactHistory(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching contact history:', error);
    } finally {
      setContactHistoryLoading(false);
    }
  };

  const handleContactHistorySubmit = async (e) => {
    e.preventDefault();
    if (!contactHistoryForm.comment.trim()) {
      alert('Bitte geben Sie einen Kommentar ein.');
      return;
    }

    const selectedSystemIds = Array.isArray(contactHistoryForm.system_ids)
      ? contactHistoryForm.system_ids
      : [];

    if (editingContactHistory && selectedSystemIds.length > 1) {
      alert('Beim Bearbeiten kann nur ein System ausgewählt werden.');
      return;
    }
    
    try {
      const basePayload = {
        ...contactHistoryForm,
        customer: id
      };

      delete basePayload.system_ids;
      
      if (editingContactHistory) {
        const payload = {
          ...basePayload,
          systems_system_id: selectedSystemIds[0] || null
        };
        await api.patch(`/customers/contact-history/${editingContactHistory.id}/`, payload);
      } else {
        if (selectedSystemIds.length > 0) {
          await Promise.all(
            selectedSystemIds.map((systemId) => api.post('/customers/contact-history/', {
              ...basePayload,
              systems_system_id: systemId
            }))
          );
        } else {
          await api.post('/customers/contact-history/', {
            ...basePayload,
            systems_system_id: null
          });
        }
      }
      
      setShowContactHistoryModal(false);
      setEditingContactHistory(null);
      setContactHistoryForm({
        contact_date: new Date().toISOString().split('T')[0],
        contact_type: 'EMAIL',
        comment: '',
        system_ids: []
      });
      fetchContactHistory();
    } catch (error) {
      console.error('Error saving contact history:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteContactHistory = async (entryId) => {
    if (!window.confirm('Diesen Eintrag wirklich löschen?')) return;
    try {
      await api.delete(`/customers/contact-history/${entryId}/`);
      fetchContactHistory();
    } catch (error) {
      console.error('Error deleting contact history:', error);
      alert('Fehler beim Löschen');
    }
  };

  const openEditContactHistory = (entry) => {
    const resolvedSystemId = resolveSystemIdFromNumber(entry.system_number);
    setEditingContactHistory(entry);
    setContactHistoryForm({
      contact_date: entry.contact_date,
      contact_type: entry.contact_type,
      comment: entry.comment,
      system_ids: resolvedSystemId ? [resolvedSystemId] : []
    });
    setShowContactHistoryModal(true);
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
      // Load first page of licenses
      fetchCustomerLicenses(customerId, 1);
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
            ...(addr.id && { id: addr.id }), // Include ID if exists for updates
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
            ...(phone.id && { id: phone.id }),
            phone_type: phone.phone_type,
            phone_number: phone.phone_number,
            is_primary: phone.is_primary || false
          })),
        emails: emails
          .filter(email => email.email && email.email.trim() !== '')
          .map(email => ({
            ...(email.id && { id: email.id }),
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
        console.log('Save response:', response && response.data);
        // Reload customer data after update
        loadCustomer();
      } else {
        response = await api.post('/customers/customers/', submitData);
        console.log('Save response:', response && response.data);
        // Navigate to list only after creating new customer
        navigate('/sales/customers');
      }
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
    setAddresses(newAddresses);
  };

  // Update both coordinates at once to avoid race condition
  const updateAddressCoordinates = (index, lat, lng) => {
    setAddresses(prev => {
      const newAddresses = [...prev];
      const latVal = (lat === null || lat === '' || lat === undefined) ? null : Number(parseFloat(lat).toFixed(6));
      const lngVal = (lng === null || lng === '' || lng === undefined) ? null : Number(parseFloat(lng).toFixed(6));
      newAddresses[index] = { ...newAddresses[index], latitude: latVal, longitude: lngVal };
      return newAddresses;
    });
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
      { id: 'quotations', label: 'Angebote', icon: DocumentTextIcon, count: customerQuotations.length },
      { id: 'visiview', label: 'VisiView', icon: KeyIcon, count: customerLicensesTotal },
      { id: 'contact-history', label: 'Kontakthistorie', icon: ChatBubbleLeftRightIcon, count: contactHistory.length }
    ] : [])
  ];

  // Load contact history when tab is selected
  useEffect(() => {
    if (activeTab === 'contact-history' && isEditing && !contactHistory.length && !contactHistoryLoading) {
      fetchContactHistory();
    }
  }, [activeTab, isEditing]);

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
          <nav className="tab-scroll -mb-px flex space-x-4">
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
                              updateAddressCoordinates(selectedAddressIndex, lat, lng);
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

            {/* VisiView Lizenzen Tab */}
            {activeTab === 'visiview' && isEditing && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">VisiView Lizenzen ({customerLicensesTotal})</h3>
                </div>
                {customerLicenses.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Keine VisiView Lizenzen vorhanden</p>
                ) : (
                  <div className="space-y-2">
                    {customerLicenses.map(license => (
                      <div key={license.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-medium text-purple-700">{license.serial_number}</span>
                            {license.is_active ? (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">Aktiv</span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">Inaktiv</span>
                            )}
                            {license.is_maintenance_valid && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">Wartung</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {license.options_count || 0} Optionen
                            {license.version && ` • Version ${license.version}`}
                            {license.delivery_date && ` • Ausgeliefert: ${new Date(license.delivery_date).toLocaleDateString('de-DE')}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/visiview/licenses/${license.id}`)}
                          className="text-purple-600 hover:text-purple-800"
                        >
                          <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}

                    {/* Pagination for customer licenses */}
                    {customerLicensesTotal > customerLicensesPageSize && (
                      (() => {
                        const totalPages = Math.ceil(customerLicensesTotal / customerLicensesPageSize);
                        const start = Math.max(1, customerLicensesPage - 2);
                        const end = Math.min(totalPages, customerLicensesPage + 2);
                        const pages = [];
                        for (let p = start; p <= end; p++) pages.push(p);

                        return (
                          <div className="mt-4 flex justify-center items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setCustomerLicensesPage(prev => Math.max(1, prev - 1))}
                              disabled={customerLicensesPage === 1}
                              className={`px-3 py-1 rounded ${customerLicensesPage === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                            >
                              Zurück
                            </button>

                            {start > 1 && (
                              <button type="button" onClick={() => setCustomerLicensesPage(1)} className="px-3 py-1 rounded bg-white text-gray-700 hover:bg-gray-100">1</button>
                            )}

                            {start > 2 && <span className="px-2">…</span>}

                            {pages.map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setCustomerLicensesPage(p)}
                                className={`px-3 py-1 rounded ${p === customerLicensesPage ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                              >
                                {p}
                              </button>
                            ))}

                            {end < totalPages - 1 && <span className="px-2">…</span>}

                            {end < totalPages && (
                              <button type="button" onClick={() => setCustomerLicensesPage(totalPages)} className="px-3 py-1 rounded bg-white text-gray-700 hover:bg-gray-100">{totalPages}</button>
                            )}

                            <button
                              type="button"
                              onClick={() => setCustomerLicensesPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={customerLicensesPage === totalPages}
                              className={`px-3 py-1 rounded ${customerLicensesPage === totalPages ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                            >
                              Weiter
                            </button>
                          </div>
                        );
                      })()
                    )}

                  </div>
                )}
              </div>
            )}

            {/* Contact History Tab */}
            {activeTab === 'contact-history' && isEditing && (
              <div className="px-6 py-4">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-medium">Kontakthistorie</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingContactHistory(null);
                      setContactHistoryForm({
                        contact_date: new Date().toISOString().split('T')[0],
                        contact_type: 'EMAIL',
                        comment: '',
                        system_ids: []
                      });
                      setShowContactHistoryModal(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Neuer Eintrag
                  </button>
                </div>

                {contactHistoryLoading ? (
                  <div className="text-center py-8 text-gray-500">Lade Kontakthistorie...</div>
                ) : contactHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Keine Kontakthistorie vorhanden</div>
                ) : (
                  <div className="bg-white shadow-md rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Art</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kommentar</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">System</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Erstellt von</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {contactHistory.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(entry.contact_date).toLocaleDateString('de-DE')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                entry.contact_type === 'EMAIL' ? 'bg-blue-100 text-blue-800' :
                                entry.contact_type === 'PHONE' ? 'bg-green-100 text-green-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {entry.contact_type_display}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                              <div className="line-clamp-2">{entry.comment}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {entry.system_name ? (
                                <span className="text-blue-600">{entry.system_number} - {entry.system_name}</span>
                              ) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {entry.created_by_name || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                type="button"
                                onClick={() => openEditContactHistory(entry)}
                                className="text-blue-600 hover:text-blue-900 mr-3"
                              >
                                Bearbeiten
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteContactHistory(entry.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <TrashIcon className="h-5 w-5 inline" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Contact History Modal */}
                {showContactHistoryModal && (
                  <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                      <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowContactHistoryModal(false)} />
                      
                      <div className="inline-block w-full max-w-lg my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {editingContactHistory ? 'Kontakt bearbeiten' : 'Neuer Kontakteintrag'}
                          </h3>
                          <button type="button" onClick={() => setShowContactHistoryModal(false)} className="text-gray-400 hover:text-gray-500">
                            <XMarkIcon className="h-6 w-6" />
                          </button>
                        </div>
                        
                        <div className="px-6 py-4 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Datum <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              required
                              value={contactHistoryForm.contact_date}
                              onChange={(e) => setContactHistoryForm({ ...contactHistoryForm, contact_date: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Kontaktart <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={contactHistoryForm.contact_type}
                              onChange={(e) => setContactHistoryForm({ ...contactHistoryForm, contact_type: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="EMAIL">E-Mail</option>
                              <option value="PHONE">Telefon</option>
                              <option value="MEETING">Treffen</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Kommentar <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              required
                              rows={4}
                              value={contactHistoryForm.comment}
                              onChange={(e) => setContactHistoryForm({ ...contactHistoryForm, comment: e.target.value })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Beschreiben Sie den Kontakt..."
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Systeme (optional)
                            </label>
                            {customerSystems.length === 0 ? (
                              <div className="text-sm text-gray-500">Keine Systeme vorhanden.</div>
                            ) : (
                              <select
                                multiple
                                value={contactHistoryForm.system_ids.map(String)}
                                onChange={(e) => {
                                  const selected = Array.from(e.target.selectedOptions).map((opt) => parseInt(opt.value, 10));
                                  setContactHistoryForm({ ...contactHistoryForm, system_ids: selected });
                                }}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                size={Math.min(6, customerSystems.length)}
                              >
                                {customerSystems.map((sys) => (
                                  <option key={sys.id} value={sys.id}>
                                    {sys.system_number} - {sys.system_name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <p className="mt-1 text-xs text-gray-500">
                              Ohne Auswahl erscheint der Eintrag nur in der Kunden-Kontakthistorie.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                          <button
                            type="button"
                            onClick={() => setShowContactHistoryModal(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Abbrechen
                          </button>
                          <button
                            type="button"
                            onClick={handleContactHistorySubmit}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                          >
                            {editingContactHistory ? 'Aktualisieren' : 'Speichern'}
                          </button>
                        </div>
                      </div>
                    </div>
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
