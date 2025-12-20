import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { COUNTRIES } from '../utils/countries';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';

const Suppliers = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [productGroups, setProductGroups] = useState([]);
  const [editingGroup, setEditingGroup] = useState(null);
  const [showPriceListModal, setShowPriceListModal] = useState(false);
  const [priceLists, setPriceLists] = useState([]);
  const [editingPriceList, setEditingPriceList] = useState(null);
  
  // Payment & Delivery Settings
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [deliveryTerms, setDeliveryTerms] = useState([]);
  const [deliveryInstructions, setDeliveryInstructions] = useState([]);
  
  // Prüfe ob der Benutzer Schreibrechte hat
  const canWrite = user?.is_staff || user?.is_superuser || user?.can_write_suppliers;
  const [formData, setFormData] = useState({
    company_name: '',
    street: '',
    house_number: '',
    address_supplement: '',
    postal_code: '',
    city: '',
    state: '',
    country: 'DE',
    address: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    is_active: true,
    customer_number: '',
    payment_term: null,
    delivery_term: null,
    delivery_instruction: null,
    contacts: [],
  });

  const [groupFormData, setGroupFormData] = useState({
    name: '',
    discount_percent: 0,
    description: '',
    is_active: true,
  });

  const [priceListFormData, setPriceListFormData] = useState({
    name: '',
    valid_from: '',
    valid_until: '',
    is_active: true,
  });

  useEffect(() => {
    fetchSuppliers();
    fetchPaymentDeliverySettings();
  }, []);

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

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers/suppliers/');
      // Handle paginated response
      const data = response.data.results || response.data;
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Lieferanten:', error);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await api.put(`/suppliers/suppliers/${editingSupplier.id}/`, formData);
      } else {
        await api.post('/suppliers/suppliers/', formData);
      }
      setShowModal(false);
      resetForm();
      fetchSuppliers();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern des Lieferanten');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Möchten Sie diesen Lieferanten wirklich löschen?')) {
      try {
        await api.delete(`/suppliers/suppliers/${id}/`);
        fetchSuppliers();
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Fehler beim Löschen des Lieferanten');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      street: '',
      house_number: '',
      address_supplement: '',
      postal_code: '',
      city: '',
      state: '',
      country: 'DE',
      address: '',
      email: '',
      phone: '',
      notes: '',
      is_active: true,
      customer_number: '',
      payment_term: null,
      delivery_term: null,
      delivery_instruction: null,
      contacts: [],
    });
    setEditingSupplier(null);
  };

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      company_name: supplier.company_name,
      street: supplier.street || '',
      house_number: supplier.house_number || '',
      address_supplement: supplier.address_supplement || '',
      postal_code: supplier.postal_code || '',
      city: supplier.city || '',
      state: supplier.state || '',
      country: supplier.country || 'DE',
      address: supplier.address || '',
      email: supplier.email,
      phone: supplier.phone,
      notes: supplier.notes,
      is_active: supplier.is_active,
      customer_number: supplier.customer_number || '',
      payment_term: supplier.payment_term || null,
      delivery_term: supplier.delivery_term || null,
      delivery_instruction: supplier.delivery_instruction || null,
      contacts: supplier.contacts || [],
    });
    setShowModal(true);
  };

  const addContact = () => {
    setFormData({
      ...formData,
      contacts: [
        ...formData.contacts,
        {
          contact_type: 'service',
          contact_person: '',
          contact_function: '',
          street: '',
          house_number: '',
          address_supplement: '',
          postal_code: '',
          city: '',
          state: '',
          country: 'DE',
          address: '',
          email: '',
          phone: '',
          notes: '',
        },
      ],
    });
  };

  const updateContact = (index, field, value) => {
    const newContacts = [...formData.contacts];
    newContacts[index][field] = value;
    setFormData({ ...formData, contacts: newContacts });
  };

  const removeContact = (index) => {
    const newContacts = formData.contacts.filter((_, i) => i !== index);
    setFormData({ ...formData, contacts: newContacts });
  };

  // Warengruppen-Funktionen
  const fetchProductGroups = async (supplierId) => {
    try {
      const response = await api.get(`/suppliers/product-groups/?supplier=${supplierId}`);
      const data = response.data.results || response.data;
      setProductGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Warengruppen:', error);
      setProductGroups([]);
    }
  };

  const openGroupModal = async (supplier) => {
    setSelectedSupplier(supplier);
    await fetchProductGroups(supplier.id);
    setShowGroupModal(true);
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...groupFormData,
        supplier: selectedSupplier.id,
      };

      if (editingGroup) {
        await api.put(`/suppliers/product-groups/${editingGroup.id}/`, submitData);
      } else {
        await api.post('/suppliers/product-groups/', submitData);
      }
      
      resetGroupForm();
      await fetchProductGroups(selectedSupplier.id);
    } catch (error) {
      console.error('Fehler beim Speichern der Warengruppe:', error);
      alert('Fehler beim Speichern der Warengruppe');
    }
  };

  const handleGroupDelete = async (groupId) => {
    if (window.confirm('Möchten Sie diese Warengruppe wirklich löschen?')) {
      try {
        await api.delete(`/suppliers/product-groups/${groupId}/`);
        await fetchProductGroups(selectedSupplier.id);
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Fehler beim Löschen der Warengruppe');
      }
    }
  };

  const resetGroupForm = () => {
    setGroupFormData({
      name: '',
      discount_percent: 0,
      description: '',
      is_active: true,
    });
    setEditingGroup(null);
  };

  // Preislisten-Funktionen
  const fetchPriceLists = async (supplierId) => {
    try {
      const response = await api.get(`/suppliers/price-lists/?supplier=${supplierId}`);
      const data = response.data.results || response.data;
      setPriceLists(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fehler beim Laden der Preislisten:', error);
      setPriceLists([]);
    }
  };

  const openPriceListModal = async (supplier) => {
    setSelectedSupplier(supplier);
    await fetchPriceLists(supplier.id);
    setShowPriceListModal(true);
  };

  const handlePriceListSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...priceListFormData,
        supplier: selectedSupplier.id,
      };

      if (editingPriceList) {
        await api.put(`/suppliers/price-lists/${editingPriceList.id}/`, submitData);
      } else {
        await api.post('/suppliers/price-lists/', submitData);
      }
      
      resetPriceListForm();
      await fetchPriceLists(selectedSupplier.id);
      await fetchSuppliers(); // Aktualisiere Lieferantenliste für Preislisten-Anzahl
    } catch (error) {
      console.error('Fehler beim Speichern der Preisliste:', error);
      if (error.response?.data) {
        const errorMsg = typeof error.response.data === 'string' 
          ? error.response.data 
          : JSON.stringify(error.response.data);
        alert('Fehler beim Speichern der Preisliste: ' + errorMsg);
      } else {
        alert('Fehler beim Speichern der Preisliste');
      }
    }
  };

  const handlePriceListDelete = async (priceListId) => {
    if (window.confirm('Möchten Sie diese Preisliste wirklich löschen?')) {
      try {
        await api.delete(`/suppliers/price-lists/${priceListId}/`);
        await fetchPriceLists(selectedSupplier.id);
        await fetchSuppliers(); // Aktualisiere Lieferantenliste für Preislisten-Anzahl
      } catch (error) {
        console.error('Fehler beim Löschen:', error);
        alert('Fehler beim Löschen der Preisliste');
      }
    }
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

  const resetPriceListForm = () => {
    setPriceListFormData({
      name: '',
      valid_from: '',
      valid_until: '',
      is_active: true,
    });
    setEditingPriceList(null);
  };

  const openEditGroupForm = (group) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      discount_percent: group.discount_percent,
      description: group.description || '',
      is_active: group.is_active,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <nav className="text-sm text-gray-500 mb-2">
            <Link to="/procurement" className="hover:text-gray-700">Procurement</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Suppliers</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-600 mt-1">Lieferantenverwaltung und Kontakte</p>
          {!canWrite && (
            <p className="text-sm text-gray-500 mt-1">
              Sie haben nur Leserechte für dieses Modul
            </p>
          )}
        </div>
        {canWrite && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neuer Lieferant
          </button>
        )}
      </div>

      <div className="bg-white shadow overflow-x-auto rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nr.
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Firmenname
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                E-Mail
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Telefon
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kontakte
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Warengruppen
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preislisten
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {supplier.supplier_number || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {supplier.company_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {supplier.email || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {supplier.phone || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {supplier.contacts?.length || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => openGroupModal(supplier)}
                    className="text-orange-600 hover:text-orange-900 underline"
                    title="Warengruppen verwalten"
                  >
                    {supplier.product_groups?.length || 0} Gruppen
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">                  <button
                    onClick={() => openPriceListModal(supplier)}
                    className="text-blue-600 hover:text-blue-900 underline"
                    title="Preislisten verwalten"
                  >
                    {supplier.price_lists?.length || 0} Listen
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      supplier.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {supplier.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    to={`/procurement/suppliers/${supplier.id}`}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                    title="Details anzeigen"
                  >
                    <EyeIcon className="h-5 w-5 inline" />
                  </Link>
                  {canWrite && (
                    <>
                      <button
                        onClick={() => openEditModal(supplier)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                        title="Bearbeiten"
                      >
                        <PencilIcon className="h-5 w-5 inline" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Löschen"
                      >
                        <TrashIcon className="h-5 w-5 inline" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {suppliers.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow mt-4">
          <p className="text-gray-500">Keine Lieferanten gefunden</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingSupplier ? 'Lieferant bearbeiten' : 'Neuer Lieferant'}
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Firmenname *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      />
                    </div>

                    {/* Adresse Felder */}
                    <div className="border-t pt-4">
                      <h4 className="text-md font-medium text-gray-900 mb-3">Adresse</h4>
                      
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="col-span-3">
                          <label className="block text-sm font-medium text-gray-700">Stra\u00dfe</label>
                          <input
                            type="text"
                            value={formData.street}
                            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Hausnummer</label>
                          <input
                            type="text"
                            value={formData.house_number}
                            onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          />
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700">Adresszusatz</label>
                        <input
                          type="text"
                          value={formData.address_supplement}
                          onChange={(e) => setFormData({ ...formData, address_supplement: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">PLZ</label>
                          <input
                            type="text"
                            value={formData.postal_code}
                            onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700">Ort</label>
                          <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Bundesland/Provinz</label>
                          <input
                            type="text"
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Land</label>
                          <select
                            value={formData.country}
                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          >
                            {COUNTRIES.map(country => (
                              <option key={country.code} value={country.code}>{country.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">E-Mail</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Telefon</label>
                        <input
                          type="text"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Notizen</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                      />
                    </div>

                    {/* Zahlungs- und Lieferbedingungen Section */}
                    <div className="border-t pt-4 mt-4">
                      <h4 className="text-md font-medium text-gray-900 mb-3">Zahlungs- und Lieferbedingungen</h4>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Unsere Kundennummer beim Lieferanten</label>
                          <input
                            type="text"
                            value={formData.customer_number}
                            onChange={(e) => setFormData({ ...formData, customer_number: e.target.value })}
                            placeholder="z.B. K-12345"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Die Kundennummer, unter der wir beim Lieferanten geführt werden
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Zahlungsbedingung</label>
                          <select
                            value={formData.payment_term || ''}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              payment_term: e.target.value === '' ? null : parseInt(e.target.value)
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              delivery_term: e.target.value === '' ? null : parseInt(e.target.value)
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              delivery_instruction: e.target.value === '' ? null : parseInt(e.target.value)
                            })}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
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

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900">Aktiv</label>
                    </div>

                    {/* Kontakte Section */}
                    <div className="border-t pt-4 mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-md font-medium text-gray-900">Kontakte</h4>
                        <button
                          type="button"
                          onClick={addContact}
                          className="text-sm text-green-600 hover:text-green-700"
                        >
                          + Kontakt hinzufügen
                        </button>
                      </div>

                      {formData.contacts.map((contact, index) => (
                        <div key={index} className="border rounded p-3 mb-3 bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <select
                              value={contact.contact_type}
                              onChange={(e) => updateContact(index, 'contact_type', e.target.value)}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="service">Service</option>
                              <option value="sales">Vertrieb</option>
                              <option value="orders">Bestellungen</option>
                              <option value="order_processing">Auftragsabwicklung</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeContact(index)}
                              className="text-red-600 hover:text-red-700 text-sm"
                            >
                              Entfernen
                            </button>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Ansprechpartner"
                                value={contact.contact_person}
                                onChange={(e) => updateContact(index, 'contact_person', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1"
                              />
                              <input
                                type="text"
                                placeholder="Funktion"
                                value={contact.contact_function}
                                onChange={(e) => updateContact(index, 'contact_function', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1"
                              />
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                type="text"
                                placeholder="Stra\u00dfe"
                                value={contact.street || ''}
                                onChange={(e) => updateContact(index, 'street', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 col-span-2"
                              />
                              <input
                                type="text"
                                placeholder="Nr."
                                value={contact.house_number || ''}
                                onChange={(e) => updateContact(index, 'house_number', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1"
                              />
                            </div>
                            
                            <input
                              type="text"
                              placeholder="Adresszusatz"
                              value={contact.address_supplement || ''}
                              onChange={(e) => updateContact(index, 'address_supplement', e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 w-full"
                            />
                            
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                type="text"
                                placeholder="PLZ"
                                value={contact.postal_code || ''}
                                onChange={(e) => updateContact(index, 'postal_code', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1"
                              />
                              <input
                                type="text"
                                placeholder="Ort"
                                value={contact.city || ''}
                                onChange={(e) => updateContact(index, 'city', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 col-span-2"
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Bundesland"
                                value={contact.state || ''}
                                onChange={(e) => updateContact(index, 'state', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1"
                              />
                              <select
                                value={contact.country || 'DE'}
                                onChange={(e) => updateContact(index, 'country', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1"
                              >
                                {COUNTRIES.map(country => (
                                  <option key={country.code} value={country.code}>{country.name}</option>
                                ))}
                              </select>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="email"
                                placeholder="E-Mail"
                                value={contact.email}
                                onChange={(e) => updateContact(index, 'email', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1"
                              />
                              <input
                                type="text"
                                placeholder="Telefon"
                                value={contact.phone}
                                onChange={(e) => updateContact(index, 'phone', e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Warengruppen Modal */}
      {showGroupModal && selectedSupplier && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Warengruppen für {selectedSupplier.company_name}
                  </h3>
                </div>

                {/* Warengruppen-Formular */}
                <form onSubmit={handleGroupSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-4">
                    {editingGroup ? 'Warengruppe bearbeiten' : 'Neue Warengruppe'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={groupFormData.name}
                        onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Rabatt (%) *
                      </label>
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

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Beschreibung
                      </label>
                      <textarea
                        value={groupFormData.description}
                        onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                        rows="2"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={groupFormData.is_active}
                          onChange={(e) => setGroupFormData({ ...groupFormData, is_active: e.target.checked })}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Aktiv</span>
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
                    >
                      {editingGroup ? 'Aktualisieren' : 'Hinzufügen'}
                    </button>
                    {editingGroup && (
                      <button
                        type="button"
                        onClick={resetGroupForm}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Abbrechen
                      </button>
                    )}
                  </div>
                </form>

                {/* Warengruppen-Liste */}
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Bestehende Warengruppen</h4>
                  {productGroups.length === 0 ? (
                    <p className="text-sm text-gray-500">Keine Warengruppen vorhanden</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rabatt</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {productGroups.map((group) => (
                            <tr key={group.id}>
                              <td className="px-4 py-2 text-sm text-gray-900">{group.name}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{group.discount_percent}%</td>
                              <td className="px-4 py-2 text-sm">
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    group.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {group.is_active ? 'Aktiv' : 'Inaktiv'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                <button
                                  onClick={() => openEditGroupForm(group)}
                                  className="text-blue-600 hover:text-blue-900 mr-3"
                                >
                                  <PencilIcon className="h-4 w-4 inline" />
                                </button>
                                <button
                                  onClick={() => handleGroupDelete(group.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <TrashIcon className="h-4 w-4 inline" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupModal(false);
                    setSelectedSupplier(null);
                    resetGroupForm();
                    fetchSuppliers(); // Aktualisiere die Lieferantenliste um neue Gruppenzahlen anzuzeigen
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:text-sm"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preislisten Modal */}
      {showPriceListModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => {
              setShowPriceListModal(false);
              setSelectedSupplier(null);
              resetPriceListForm();
            }} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Preislisten für {selectedSupplier?.company_name}
                </h3>

                {/* Formular */}
                <form onSubmit={handlePriceListSubmit} className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={priceListFormData.name}
                        onChange={(e) => setPriceListFormData({ ...priceListFormData, name: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="z.B. Preisliste 2025"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Gültig von *
                      </label>
                      <input
                        type="date"
                        required
                        value={priceListFormData.valid_from}
                        onChange={(e) => setPriceListFormData({ ...priceListFormData, valid_from: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Gültig bis
                      </label>
                      <input
                        type="date"
                        value={priceListFormData.valid_until}
                        onChange={(e) => setPriceListFormData({ ...priceListFormData, valid_until: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">Leer lassen für unbegrenzte Gültigkeit</p>
                    </div>

                    <div>
                      <label className="flex items-center mt-6">
                        <input
                          type="checkbox"
                          checked={priceListFormData.is_active}
                          onChange={(e) => setPriceListFormData({ ...priceListFormData, is_active: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Aktiv</span>
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                      {editingPriceList ? 'Aktualisieren' : 'Hinzufügen'}
                    </button>
                    {editingPriceList && (
                      <button
                        type="button"
                        onClick={resetPriceListForm}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Abbrechen
                      </button>
                    )}
                  </div>
                </form>

                {/* Preislisten-Liste */}
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Bestehende Preislisten</h4>
                  {priceLists.length === 0 ? (
                    <p className="text-sm text-gray-500">Keine Preislisten vorhanden</p>
                  ) : (
                    <div className="overflow-x-auto">
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
                                {priceList.valid_until 
                                  ? new Date(priceList.valid_until).toLocaleDateString('de-DE')
                                  : 'unbegrenzt'}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    priceList.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {priceList.is_active ? 'Aktiv' : 'Inaktiv'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-right">
                                <button
                                  onClick={() => editPriceList(priceList)}
                                  className="text-blue-600 hover:text-blue-900 mr-3"
                                >
                                  <PencilIcon className="h-4 w-4 inline" />
                                </button>
                                <button
                                  onClick={() => handlePriceListDelete(priceList.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <TrashIcon className="h-4 w-4 inline" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowPriceListModal(false);
                    setSelectedSupplier(null);
                    resetPriceListForm();
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:w-auto sm:text-sm"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
