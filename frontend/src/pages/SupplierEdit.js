import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { COUNTRIES } from '../utils/countries';
import AddressMap from '../components/AddressMap';
import {
  XMarkIcon, PlusIcon, TrashIcon, MapPinIcon, BuildingOfficeIcon,
  DocumentTextIcon, UserGroupIcon, RectangleStackIcon, ArrowLeftIcon,
  CloudArrowUpIcon, DocumentArrowDownIcon, EyeIcon
} from '@heroicons/react/24/outline';

const SupplierEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  // Permission check
  const canWrite = user?.is_staff || user?.is_superuser || user?.can_write_suppliers;

  // Payment & Delivery Settings
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [deliveryTerms, setDeliveryTerms] = useState([]);
  const [deliveryInstructions, setDeliveryInstructions] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    company_name: '',
    street: '',
    house_number: '',
    address_supplement: '',
    postal_code: '',
    city: '',
    state: '',
    country: 'DE',
    email: '',
    phone: '',
    website: '',
    notes: '',
    is_active: true,
    customer_number: '',
    payment_term: null,
    delivery_term: null,
    delivery_instruction: null,
  });

  // Contacts
  const [contacts, setContacts] = useState([]);
  const [selectedContactIndex, setSelectedContactIndex] = useState(0);

  // Attachments
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Product Groups
  const [productGroups, setProductGroups] = useState([]);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    discount_percent: 0,
    description: '',
    is_active: true,
  });

  // Price Lists
  const [priceLists, setPriceLists] = useState([]);
  const [editingPriceList, setEditingPriceList] = useState(null);
  const [priceListFormData, setPriceListFormData] = useState({
    name: '',
    valid_from: '',
    valid_until: '',
    is_active: true,
  });

  useEffect(() => {
    fetchPaymentDeliverySettings();
    if (isEditing) {
      loadSupplier();
    }
  }, [id]);

  const fetchPaymentDeliverySettings = async () => {
    try {
      const [paymentRes, deliveryTermsRes, deliveryInstRes] = await Promise.all([
        api.get('/settings/payment-terms/?is_active=true'),
        api.get('/settings/delivery-terms/?is_active=true'),
        api.get('/settings/delivery-instructions/?is_active=true')
      ]);
      setPaymentTerms(Array.isArray(paymentRes.data) ? paymentRes.data : (paymentRes.data.results || []));
      setDeliveryTerms(Array.isArray(deliveryTermsRes.data) ? deliveryTermsRes.data : (deliveryTermsRes.data.results || []));
      setDeliveryInstructions(Array.isArray(deliveryInstRes.data) ? deliveryInstRes.data : (deliveryInstRes.data.results || []));
    } catch (error) {
      console.error('Fehler beim Laden der Payment/Delivery Settings:', error);
    }
  };

  const loadSupplier = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/suppliers/suppliers/${id}/`);
      const supplier = response.data;

      setFormData({
        company_name: supplier.company_name || '',
        street: supplier.street || '',
        house_number: supplier.house_number || '',
        address_supplement: supplier.address_supplement || '',
        postal_code: supplier.postal_code || '',
        city: supplier.city || '',
        state: supplier.state || '',
        country: supplier.country || 'DE',
        email: supplier.email || '',
        phone: supplier.phone || '',
        website: supplier.website || '',
        notes: supplier.notes || '',
        is_active: supplier.is_active !== undefined ? supplier.is_active : true,
        customer_number: supplier.customer_number || '',
        payment_term: supplier.payment_term || null,
        delivery_term: supplier.delivery_term || null,
        delivery_instruction: supplier.delivery_instruction || null,
      });

      // Load contacts with lat/lng parsing
      const loadedContacts = (supplier.contacts || []).map(c => ({
        ...c,
        latitude: c.latitude !== null && c.latitude !== undefined ? parseFloat(c.latitude) : null,
        longitude: c.longitude !== null && c.longitude !== undefined ? parseFloat(c.longitude) : null
      }));
      setContacts(loadedContacts);

      // Load attachments
      setAttachments(supplier.attachments || []);

      // Load product groups and price lists
      setProductGroups(supplier.product_groups || []);
      setPriceLists(supplier.price_lists || []);

    } catch (error) {
      console.error('Error loading supplier:', error);
      alert('Fehler beim Laden des Lieferanten: ' + (error.response?.data?.detail || error.message));
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
        contacts: contacts.map(contact => ({
          ...(contact.id && { id: contact.id }),
          contact_type: contact.contact_type || 'service',
          is_primary: contact.is_primary || false,
          contact_person: contact.contact_person || '',
          contact_function: contact.contact_function || '',
          street: contact.street || '',
          house_number: contact.house_number || '',
          address_supplement: contact.address_supplement || '',
          postal_code: contact.postal_code || '',
          city: contact.city || '',
          state: contact.state || '',
          country: contact.country || 'DE',
          latitude: contact.latitude ? parseFloat(parseFloat(contact.latitude).toFixed(6)) : null,
          longitude: contact.longitude ? parseFloat(parseFloat(contact.longitude).toFixed(6)) : null,
          email: contact.email || '',
          phone: contact.phone || '',
          mobile: contact.mobile || '',
          notes: contact.notes || '',
          is_active: contact.is_active !== undefined ? contact.is_active : true
        }))
      };

      if (isEditing) {
        await api.put(`/suppliers/suppliers/${id}/`, submitData);
        loadSupplier(); // Reload to get updated data
      } else {
        const response = await api.post('/suppliers/suppliers/', submitData);
        navigate(`/procurement/suppliers/${response.data.id}/edit`);
      }
    } catch (error) {
      console.error('Error saving supplier:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || JSON.stringify(error.response?.data) || error.message));
    } finally {
      setSaving(false);
    }
  };

  // Contact management
  const addContact = () => {
    setContacts([...contacts, {
      contact_type: 'service',
      is_primary: false,
      contact_person: '',
      contact_function: '',
      street: '',
      house_number: '',
      address_supplement: '',
      postal_code: '',
      city: '',
      state: '',
      country: 'DE',
      latitude: null,
      longitude: null,
      email: '',
      phone: '',
      mobile: '',
      notes: '',
      is_active: true
    }]);
    setSelectedContactIndex(contacts.length);
  };

  const removeContact = (index) => {
    const newContacts = contacts.filter((_, i) => i !== index);
    setContacts(newContacts);
    if (selectedContactIndex >= newContacts.length) {
      setSelectedContactIndex(Math.max(0, newContacts.length - 1));
    }
  };

  const updateContact = (index, field, value) => {
    const newContacts = [...contacts];
    if (field === 'latitude' || field === 'longitude') {
      if (value === null || value === '' || value === undefined) {
        newContacts[index] = { ...newContacts[index], [field]: null };
      } else {
        const num = typeof value === 'number' ? value : parseFloat(value);
        newContacts[index] = { ...newContacts[index], [field]: Number(num.toFixed(6)) };
      }
    } else {
      newContacts[index] = { ...newContacts[index], [field]: value };
    }
    setContacts(newContacts);
  };

  const updateContactCoordinates = (index, lat, lng) => {
    setContacts(prev => {
      const newContacts = [...prev];
      const latVal = (lat === null || lat === '' || lat === undefined) ? null : Number(parseFloat(lat).toFixed(6));
      const lngVal = (lng === null || lng === '' || lng === undefined) ? null : Number(parseFloat(lng).toFixed(6));
      newContacts[index] = { ...newContacts[index], latitude: latVal, longitude: lngVal };
      return newContacts;
    });
  };

  const selectedContact = contacts[selectedContactIndex];

  // File upload handlers
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !id) {
      alert('Bitte speichern Sie den Lieferanten zuerst, bevor Sie Dateien hochladen.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('supplier', id);
      formData.append('name', file.name);
      formData.append('attachment_type', 'other');

      const response = await api.post('/suppliers/attachments/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setAttachments([...attachments, response.data]);
    } catch (error) {
      console.error('Fehler beim Hochladen:', error);
      alert('Fehler beim Hochladen der Datei: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Möchten Sie diese Datei wirklich löschen?')) return;

    try {
      await api.delete(`/suppliers/attachments/${attachmentId}/`);
      setAttachments(attachments.filter(a => a.id !== attachmentId));
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen der Datei');
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    try {
      const response = await api.get(`/suppliers/attachments/${attachment.id}/download/`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Fehler beim Download:', error);
      alert('Fehler beim Download der Datei');
    }
  };

  // Product Group handlers
  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    if (!id) {
      alert('Bitte speichern Sie den Lieferanten zuerst.');
      return;
    }

    try {
      const submitData = { ...groupFormData, supplier: id };
      if (editingGroup) {
        await api.put(`/suppliers/product-groups/${editingGroup.id}/`, submitData);
      } else {
        await api.post('/suppliers/product-groups/', submitData);
      }
      resetGroupForm();
      loadSupplier();
    } catch (error) {
      console.error('Fehler beim Speichern der Warengruppe:', error);
      alert('Fehler beim Speichern der Warengruppe');
    }
  };

  const handleGroupDelete = async (groupId) => {
    if (!window.confirm('Möchten Sie diese Warengruppe wirklich löschen?')) return;
    try {
      await api.delete(`/suppliers/product-groups/${groupId}/`);
      loadSupplier();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen der Warengruppe');
    }
  };

  const resetGroupForm = () => {
    setGroupFormData({ name: '', discount_percent: 0, description: '', is_active: true });
    setEditingGroup(null);
  };

  const editGroup = (group) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      discount_percent: group.discount_percent,
      description: group.description || '',
      is_active: group.is_active,
    });
  };

  // Price List handlers
  const handlePriceListSubmit = async (e) => {
    e.preventDefault();
    if (!id) {
      alert('Bitte speichern Sie den Lieferanten zuerst.');
      return;
    }

    try {
      const submitData = { ...priceListFormData, supplier: id };
      if (editingPriceList) {
        await api.put(`/suppliers/price-lists/${editingPriceList.id}/`, submitData);
      } else {
        await api.post('/suppliers/price-lists/', submitData);
      }
      resetPriceListForm();
      loadSupplier();
    } catch (error) {
      console.error('Fehler beim Speichern der Preisliste:', error);
      alert('Fehler beim Speichern der Preisliste: ' + (error.response?.data ? JSON.stringify(error.response.data) : error.message));
    }
  };

  const handlePriceListDelete = async (priceListId) => {
    if (!window.confirm('Möchten Sie diese Preisliste wirklich löschen?')) return;
    try {
      await api.delete(`/suppliers/price-lists/${priceListId}/`);
      loadSupplier();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen der Preisliste');
    }
  };

  const resetPriceListForm = () => {
    setPriceListFormData({ name: '', valid_from: '', valid_until: '', is_active: true });
    setEditingPriceList(null);
  };

  const editPriceList = (priceList) => {
    setEditingPriceList(priceList);
    setPriceListFormData({
      name: priceList.name,
      valid_from: priceList.valid_from,
      valid_until: priceList.valid_until || '',
      is_active: priceList.is_active,
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getContactTypeLabel = (type) => {
    const labels = {
      main: 'Hauptansprechpartner',
      service: 'Service',
      sales: 'Vertrieb',
      orders: 'Bestellungen',
      order_processing: 'Auftragsabwicklung',
      ceo: 'Geschäftsführung',
    };
    return labels[type] || type;
  };

  const tabs = [
    { id: 'basic', label: 'Basisinfos', icon: BuildingOfficeIcon },
    { id: 'contacts', label: 'Kontakte', icon: UserGroupIcon, count: contacts.length },
    ...(isEditing ? [
      { id: 'documents', label: 'Dokumente', icon: DocumentTextIcon, count: attachments.length },
      { id: 'groups', label: 'Warengruppen', icon: RectangleStackIcon, count: productGroups.length }
    ] : [])
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Lade Lieferantendaten...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link
                to="/procurement/suppliers"
                className="inline-flex items-center text-sm text-green-600 hover:text-green-800 mb-2"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-1" />
                Zurück zur Übersicht
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing ? `Lieferant bearbeiten` : 'Neuer Lieferant'}
              </h1>
              {isEditing && formData.company_name && (
                <p className="text-sm text-gray-500 mt-1">{formData.company_name}</p>
              )}
            </div>
            <button
              onClick={() => navigate('/procurement/suppliers')}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
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
                      ? 'border-green-500 text-green-600'
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
                <div>
                  <label className="block text-sm font-medium text-gray-700">Firmenname *</label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                {/* Address Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Adresse</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700">Straße</label>
                      <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Hausnummer</label>
                      <input
                        type="text"
                        value={formData.house_number}
                        onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Adresszusatz</label>
                    <input
                      type="text"
                      value={formData.address_supplement}
                      onChange={(e) => setFormData({ ...formData, address_supplement: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">PLZ</label>
                      <input
                        type="text"
                        value={formData.postal_code}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Ort</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Bundesland/Provinz</label>
                      <input
                        type="text"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Land</label>
                      <select
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      >
                        {COUNTRIES.map(country => (
                          <option key={country.code} value={country.code}>{country.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Kontaktdaten</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">E-Mail</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Telefon</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                    />
                  </div>
                </div>

                {/* Payment & Delivery Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Zahlungs- und Lieferbedingungen</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Unsere Kundennummer beim Lieferanten</label>
                      <input
                        type="text"
                        value={formData.customer_number}
                        onChange={(e) => setFormData({ ...formData, customer_number: e.target.value })}
                        placeholder="z.B. K-12345"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">Die Kundennummer, unter der wir beim Lieferanten geführt werden</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Zahlungsbedingung</label>
                      <select
                        value={formData.payment_term || ''}
                        onChange={(e) => setFormData({ ...formData, payment_term: e.target.value === '' ? null : parseInt(e.target.value) })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      >
                        <option value="">Keine Zahlungsbedingung ausgewählt</option>
                        {paymentTerms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.name} - {term.formatted_terms}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Lieferbedingung (Incoterm)</label>
                      <select
                        value={formData.delivery_term || ''}
                        onChange={(e) => setFormData({ ...formData, delivery_term: e.target.value === '' ? null : parseInt(e.target.value) })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      >
                        <option value="">Keine Lieferbedingung ausgewählt</option>
                        {deliveryTerms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.incoterm_display}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Lieferanweisung</label>
                      <select
                        value={formData.delivery_instruction || ''}
                        onChange={(e) => setFormData({ ...formData, delivery_instruction: e.target.value === '' ? null : parseInt(e.target.value) })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                      >
                        <option value="">Keine Lieferanweisung ausgewählt</option>
                        {deliveryInstructions.map((instruction) => (
                          <option key={instruction.id} value={instruction.id}>
                            {instruction.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Notes & Status */}
                <div className="border-t pt-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Notizen</label>
                    <textarea
                      rows="4"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                    />
                  </div>

                  <div className="mt-4 flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">Aktiv</label>
                  </div>
                </div>
              </div>
            )}

            {/* Contacts Tab */}
            {activeTab === 'contacts' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Kontakte / Ansprechpartner</h3>
                  <button
                    type="button"
                    onClick={addContact}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Kontakt hinzufügen
                  </button>
                </div>

                {contacts.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Contact Form */}
                    <div className="space-y-4">
                      {/* Contact Tabs */}
                      <div className="flex flex-wrap gap-2">
                        {contacts.map((contact, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setSelectedContactIndex(index)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg ${
                              selectedContactIndex === index
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {getContactTypeLabel(contact.contact_type)} {contact.is_primary && '★'}
                          </button>
                        ))}
                      </div>

                      {selectedContact && (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-4">
                            <h4 className="font-medium">Kontakt bearbeiten</h4>
                            <button
                              type="button"
                              onClick={() => removeContact(selectedContactIndex)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Kontakttyp</label>
                                <select
                                  value={selectedContact.contact_type}
                                  onChange={(e) => updateContact(selectedContactIndex, 'contact_type', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                >
                                  <option value="main">Hauptansprechpartner</option>
                                  <option value="service">Service</option>
                                  <option value="sales">Vertrieb</option>
                                  <option value="orders">Bestellungen</option>
                                  <option value="order_processing">Auftragsabwicklung</option>
                                  <option value="ceo">Geschäftsführung</option>
                                </select>
                              </div>
                              <div className="flex items-end gap-4">
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedContact.is_primary || false}
                                    onChange={(e) => updateContact(selectedContactIndex, 'is_primary', e.target.checked)}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <span className="ml-2 text-sm text-gray-700">Hauptkontakt</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedContact.is_active !== false}
                                    onChange={(e) => updateContact(selectedContactIndex, 'is_active', e.target.checked)}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <span className="ml-2 text-sm text-gray-700">Aktiv</span>
                                </label>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Ansprechpartner</label>
                                <input
                                  type="text"
                                  value={selectedContact.contact_person || ''}
                                  onChange={(e) => updateContact(selectedContactIndex, 'contact_person', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Funktion</label>
                                <input
                                  type="text"
                                  value={selectedContact.contact_function || ''}
                                  onChange={(e) => updateContact(selectedContactIndex, 'contact_function', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Straße</label>
                                <input
                                  type="text"
                                  value={selectedContact.street || ''}
                                  onChange={(e) => updateContact(selectedContactIndex, 'street', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Nr.</label>
                                <input
                                  type="text"
                                  value={selectedContact.house_number || ''}
                                  onChange={(e) => updateContact(selectedContactIndex, 'house_number', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">Adresszusatz</label>
                              <input
                                type="text"
                                value={selectedContact.address_supplement || ''}
                                onChange={(e) => updateContact(selectedContactIndex, 'address_supplement', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">PLZ</label>
                                <input
                                  type="text"
                                  value={selectedContact.postal_code || ''}
                                  onChange={(e) => updateContact(selectedContactIndex, 'postal_code', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Stadt</label>
                                <input
                                  type="text"
                                  value={selectedContact.city || ''}
                                  onChange={(e) => updateContact(selectedContactIndex, 'city', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Bundesland/Region</label>
                                <input
                                  type="text"
                                  value={selectedContact.state || ''}
                                  onChange={(e) => updateContact(selectedContactIndex, 'state', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Land</label>
                                <select
                                  value={selectedContact.country || 'DE'}
                                  onChange={(e) => updateContact(selectedContactIndex, 'country', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                >
                                  {COUNTRIES.map(country => (
                                    <option key={country.code} value={country.code}>{country.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">E-Mail</label>
                                <input
                                  type="email"
                                  value={selectedContact.email || ''}
                                  onChange={(e) => updateContact(selectedContactIndex, 'email', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Telefon</label>
                                <input
                                  type="tel"
                                  value={selectedContact.phone || ''}
                                  onChange={(e) => updateContact(selectedContactIndex, 'phone', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Mobil</label>
                                <input
                                  type="tel"
                                  value={selectedContact.mobile || ''}
                                  onChange={(e) => updateContact(selectedContactIndex, 'mobile', e.target.value)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">Notizen</label>
                              <textarea
                                rows="2"
                                value={selectedContact.notes || ''}
                                onChange={(e) => updateContact(selectedContactIndex, 'notes', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Breitengrad</label>
                                <input
                                  type="number"
                                  step="0.000001"
                                  value={selectedContact.latitude || ''}
                                  onChange={(e) => updateContact(selectedContactIndex, 'latitude', e.target.value || null)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                                  placeholder="z.B. 48.137154"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Längengrad</label>
                                <input
                                  type="number"
                                  step="0.000001"
                                  value={selectedContact.longitude || ''}
                                  onChange={(e) => updateContact(selectedContactIndex, 'longitude', e.target.value || null)}
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
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
                            {selectedContact?.latitude && selectedContact?.longitude && (
                              <a
                                href={`https://www.openstreetmap.org/?mlat=${selectedContact.latitude}&mlon=${selectedContact.longitude}#map=15/${selectedContact.latitude}/${selectedContact.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-800 text-xs"
                              >
                                In OpenStreetMap öffnen →
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="p-4 bg-gray-50">
                          <AddressMap
                            latitude={selectedContact?.latitude}
                            longitude={selectedContact?.longitude}
                            address={selectedContact}
                            onPositionChange={(lat, lng) => {
                              updateContactCoordinates(selectedContactIndex, lat, lng);
                            }}
                            editable={true}
                            height="400px"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <UserGroupIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>Keine Kontakte vorhanden</p>
                    <button
                      type="button"
                      onClick={addContact}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm rounded-md text-white bg-green-600 hover:bg-green-700"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Ersten Kontakt hinzufügen
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && isEditing && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Preislisten & Dokumente</h3>
                </div>

                {/* Price Lists Section */}
                <div className="border rounded-lg p-4">
                  <h4 className="text-md font-semibold mb-4">Preislisten</h4>
                  
                  <form onSubmit={handlePriceListSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Name *</label>
                        <input
                          type="text"
                          required
                          value={priceListFormData.name}
                          onChange={(e) => setPriceListFormData({ ...priceListFormData, name: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                          placeholder="z.B. Preisliste 2025"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Gültig von *</label>
                        <input
                          type="date"
                          required
                          value={priceListFormData.valid_from}
                          onChange={(e) => setPriceListFormData({ ...priceListFormData, valid_from: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Gültig bis</label>
                        <input
                          type="date"
                          value={priceListFormData.valid_until}
                          onChange={(e) => setPriceListFormData({ ...priceListFormData, valid_until: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                          {editingPriceList ? 'Aktualisieren' : 'Hinzufügen'}
                        </button>
                        {editingPriceList && (
                          <button
                            type="button"
                            onClick={resetPriceListForm}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                          >
                            Abbrechen
                          </button>
                        )}
                      </div>
                    </div>
                  </form>

                  {priceLists.length === 0 ? (
                    <p className="text-sm text-gray-500">Keine Preislisten vorhanden</p>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Gültig von</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Gültig bis</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {priceLists.map((priceList) => (
                          <tr key={priceList.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">{priceList.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {new Date(priceList.valid_from).toLocaleDateString('de-DE')}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {priceList.valid_until ? new Date(priceList.valid_until).toLocaleDateString('de-DE') : 'unbegrenzt'}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                priceList.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {priceList.is_active ? 'Aktiv' : 'Inaktiv'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => editPriceList(priceList)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Bearbeiten
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePriceListDelete(priceList.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Löschen
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* File Upload Section */}
                <div className="border rounded-lg p-4">
                  <h4 className="text-md font-semibold mb-4">Dokumente & Prospekte</h4>

                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center ${
                      uploading ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-2">
                      <label className="cursor-pointer">
                        <span className="text-green-600 hover:text-green-500">Datei auswählen</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={uploading}
                        />
                      </label>
                      <span className="text-gray-500"> oder per Drag & Drop</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">PDF, Excel, Word bis 10MB</p>
                    {uploading && <p className="text-sm text-green-600 mt-2">Wird hochgeladen...</p>}
                  </div>

                  {attachments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <DocumentTextIcon className="h-8 w-8 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{attachment.name || attachment.filename}</p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(attachment.file_size)} • {attachment.attachment_type_display}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => handleDownloadAttachment(attachment)}
                              className="p-1 text-blue-600 hover:text-blue-900"
                              title="Download"
                            >
                              <DocumentArrowDownIcon className="h-5 w-5" />
                            </button>
                            {attachment.file_url && (
                              <a
                                href={attachment.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-gray-600 hover:text-gray-900"
                                title="Vorschau"
                              >
                                <EyeIcon className="h-5 w-5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(attachment.id)}
                              className="p-1 text-red-600 hover:text-red-900"
                              title="Löschen"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Product Groups Tab */}
            {activeTab === 'groups' && isEditing && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Warengruppen & Rabatte</h3>
                </div>

                {/* Add/Edit Form */}
                <form onSubmit={handleGroupSubmit} className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-md font-medium mb-4">
                    {editingGroup ? 'Warengruppe bearbeiten' : 'Neue Warengruppe'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Name *</label>
                      <input
                        type="text"
                        required
                        value={groupFormData.name}
                        onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Rabatt (%) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        required
                        value={groupFormData.discount_percent}
                        onChange={(e) => setGroupFormData({ ...groupFormData, discount_percent: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                      <input
                        type="text"
                        value={groupFormData.description}
                        onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                      >
                        {editingGroup ? 'Aktualisieren' : 'Hinzufügen'}
                      </button>
                      {editingGroup && (
                        <button
                          type="button"
                          onClick={resetGroupForm}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                        >
                          Abbrechen
                        </button>
                      )}
                    </div>
                  </div>
                </form>

                {/* Groups List */}
                {productGroups.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <RectangleStackIcon className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>Keine Warengruppen vorhanden</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rabatt</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Beschreibung</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {productGroups.map((group) => (
                        <tr key={group.id}>
                          <td className="px-4 py-2 text-sm text-gray-900 font-medium">{group.name}</td>
                          <td className="px-4 py-2 text-sm text-orange-600 font-semibold">{group.discount_percent}%</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{group.description || '-'}</td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              group.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {group.is_active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => editGroup(group)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              onClick={() => handleGroupDelete(group.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Löschen
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/procurement/suppliers')}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Abbrechen
            </button>
            {canWrite && (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
              >
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default SupplierEdit;
