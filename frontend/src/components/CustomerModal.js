import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { XMarkIcon, PlusIcon, TrashIcon, MapPinIcon, BuildingOfficeIcon, BeakerIcon, WrenchScrewdriverIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import AddressMap from './AddressMap';

const CustomerModal = ({ customer, onClose, onSuccess }) => {
  const isEditing = !!customer;
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    salutation: '',
    title: '',
    first_name: '',
    last_name: '',
    language: 'DE',
    notes: '',
    is_active: true
  });

  const [addresses, setAddresses] = useState([]);
  const [phones, setPhones] = useState([]);
  const [emails, setEmails] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState(0);

  // Related data for existing customers
  const [customerSystems, setCustomerSystems] = useState([]);
  const [customerProjects, setCustomerProjects] = useState([]);
  const [customerTickets, setCustomerTickets] = useState([]);

  useEffect(() => {
    if (customer) {
      setFormData({
        salutation: customer.salutation || '',
        title: customer.title || '',
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        language: customer.language || 'DE',
        notes: customer.notes || '',
        is_active: customer.is_active !== undefined ? customer.is_active : true
      });
      setAddresses(customer.addresses || []);
      setPhones(customer.phones || []);
      setEmails(customer.emails || []);
      
      // Load related data for existing customers
      loadRelatedData(customer.id);
    }
  }, [customer]);

  const loadRelatedData = async (customerId) => {
    try {
      const [systemsRes, projectsRes, ticketsRes] = await Promise.all([
        api.get(`/customers/customers/${customerId}/systems/`),
        api.get(`/customers/customers/${customerId}/projects/`),
        api.get(`/customers/customers/${customerId}/tickets/`)
      ]);
      setCustomerSystems(systemsRes.data || []);
      setCustomerProjects(projectsRes.data || []);
      setCustomerTickets(ticketsRes.data || []);
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
          .filter(addr => addr.street && addr.postal_code && addr.city) // Nur vollständige Adressen
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
          .filter(phone => phone.phone_number && phone.phone_number.trim() !== '') // Nur Telefonnummern mit Werten
          .map(phone => ({
            phone_type: phone.phone_type,
            phone_number: phone.phone_number,
            is_primary: phone.is_primary || false
          })),
        emails: emails
          .filter(email => email.email && email.email.trim() !== '') // Nur E-Mails mit Werten
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
        response = await api.put(`/customers/customers/${customer.id}/`, submitData);
      } else {
        response = await api.post('/customers/customers/', submitData);
      }
      console.log('Save response:', response && response.data);
      alert('Kunde erfolgreich gespeichert');
      onSuccess();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      console.error('Error response:', error.response?.data);
      alert('Fehler beim Speichern: ' + JSON.stringify(error.response?.data || 'Unbekannter Fehler'));
    } finally {
      setSaving(false);
    }
  };

  // Address functions
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
    setAddresses(addresses.filter((_, i) => i !== index));
    if (selectedAddressIndex >= addresses.length - 1) {
      setSelectedAddressIndex(Math.max(0, addresses.length - 2));
    }
  };

  const updateAddress = (index, field, value) => {
    const updated = [...addresses];
    if (field === 'latitude' || field === 'longitude') {
      if (value === null || value === '' || value === undefined) {
        updated[index][field] = null;
      } else {
        const num = typeof value === 'number' ? value : parseFloat(value);
        updated[index][field] = Number(num.toFixed(6));
      }
    } else {
      updated[index][field] = value;
    }
    console.log('CustomerModal address updated', index, field, updated[index]);
    setAddresses(updated);
  };



  // Phone functions
  const addPhone = () => {
    setPhones([...phones, {
      phone_type: 'Büro',
      phone_number: '',
      is_primary: phones.length === 0
    }]);
  };

  const removePhone = (index) => {
    setPhones(phones.filter((_, i) => i !== index));
  };

  const updatePhone = (index, field, value) => {
    const updated = [...phones];
    updated[index][field] = value;
    setPhones(updated);
  };

  // Email functions
  const addEmail = () => {
    setEmails([...emails, {
      email: '',
      is_primary: emails.length === 0,
      newsletter_consent: false,
      marketing_consent: false
    }]);
  };

  const removeEmail = (index) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const updateEmail = (index, field, value) => {
    const updated = [...emails];
    updated[index][field] = value;
    setEmails(updated);
  };

  const selectedAddress = addresses[selectedAddressIndex];

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Kunde bearbeiten' : 'Neuer Kunde'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Grunddaten */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Grunddaten</h3>
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
              <div className="md:col-span-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Aktiv</span>
                </label>
              </div>
            </div>
          </div>

          {/* Continued in next message due to length... */}
          {/* Adressen Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Adressen</h3>
              <button
                type="button"
                onClick={addAddress}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Adresse hinzufügen
              </button>
            </div>

            {addresses.length > 0 && (
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
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
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
                        {addresses.length > 0 && (
                          <button
                            type="button"
                            onClick={() => removeAddress(selectedAddressIndex)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
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
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
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
            )}
          </div>

          {/* Telefonnummern */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Telefonnummern</h3>
              <button
                type="button"
                onClick={addPhone}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Telefon hinzufügen
              </button>
            </div>
            {phones.map((phone, index) => (
              <div key={index} className="flex gap-4 mb-3">
                <select
                  value={phone.phone_type}
                  onChange={(e) => updatePhone(index, 'phone_type', e.target.value)}
                  className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="Büro">Büro</option>
                  <option value="Mobil">Mobil</option>
                  <option value="Lab">Labor</option>
                </select>
                <input
                  type="tel"
                  value={phone.phone_number}
                  onChange={(e) => updatePhone(index, 'phone_number', e.target.value)}
                  className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Telefonnummer"
                />
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={phone.is_primary}
                    onChange={(e) => updatePhone(index, 'is_primary', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Primär</span>
                </label>
                <button
                  type="button"
                  onClick={() => removePhone(index)}
                  className="text-red-600 hover:text-red-900"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>

          {/* E-Mails */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">E-Mail-Adressen</h3>
              <button
                type="button"
                onClick={addEmail}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                E-Mail hinzufügen
              </button>
            </div>
            {emails.map((email, index) => (
              <div key={index} className="flex gap-4 mb-3 items-center">
                <input
                  type="email"
                  value={email.email}
                  onChange={(e) => updateEmail(index, 'email', e.target.value)}
                  className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="E-Mail-Adresse"
                />
                <label className="flex items-center whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={email.is_primary}
                    onChange={(e) => updateEmail(index, 'is_primary', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Primär</span>
                </label>
                <label className="flex items-center whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={email.newsletter_consent}
                    onChange={(e) => updateEmail(index, 'newsletter_consent', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Newsletter</span>
                </label>
                <label className="flex items-center whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={email.marketing_consent}
                    onChange={(e) => updateEmail(index, 'marketing_consent', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Werbung</span>
                </label>
                <button
                  type="button"
                  onClick={() => removeEmail(index)}
                  className="text-red-600 hover:text-red-900"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>

          {/* Verknüpfte Systeme, Projekte, Tickets - nur bei bestehenden Kunden */}
          {isEditing && (
            <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Systeme */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold flex items-center">
                    <BuildingOfficeIcon className="h-5 w-5 mr-2 text-blue-600" />
                    Systeme ({customerSystems.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/sales/systems?customer=${customer.id}`);
                    }}
                    className="inline-flex items-center px-2 py-1 text-xs border border-transparent rounded text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <PlusIcon className="h-3 w-3 mr-1" />
                    Neu
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {customerSystems.length === 0 ? (
                    <p className="text-sm text-gray-500">Keine Systeme vorhanden</p>
                  ) : (
                    customerSystems.map(sys => (
                      <div key={sys.id} className="flex justify-between items-center text-sm bg-gray-50 rounded p-2">
                        <div>
                          <span className="font-medium">{sys.system_number}</span>
                          <span className="text-gray-500 ml-2">{sys.system_name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(`/sales/systems/${sys.id}`);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Projekte */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold flex items-center">
                    <BeakerIcon className="h-5 w-5 mr-2 text-green-600" />
                    Projekte ({customerProjects.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/sales/projects?customer=${customer.id}`);
                    }}
                    className="inline-flex items-center px-2 py-1 text-xs border border-transparent rounded text-white bg-green-600 hover:bg-green-700"
                  >
                    <PlusIcon className="h-3 w-3 mr-1" />
                    Neu
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {customerProjects.length === 0 ? (
                    <p className="text-sm text-gray-500">Keine Projekte vorhanden</p>
                  ) : (
                    customerProjects.map(proj => (
                      <div key={proj.id} className="flex justify-between items-center text-sm bg-gray-50 rounded p-2">
                        <div>
                          <span className="font-medium">{proj.project_number}</span>
                          <span className="text-gray-500 ml-2">{proj.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(`/sales/projects/${proj.id}`);
                          }}
                          className="text-green-600 hover:text-green-800"
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Offene Service-Tickets */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold flex items-center">
                    <WrenchScrewdriverIcon className="h-5 w-5 mr-2 text-orange-600" />
                    Offene Tickets ({customerTickets.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/service/tickets/new?customer=${customer.id}`);
                    }}
                    className="inline-flex items-center px-2 py-1 text-xs border border-transparent rounded text-white bg-orange-600 hover:bg-orange-700"
                  >
                    <PlusIcon className="h-3 w-3 mr-1" />
                    Neu
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {customerTickets.length === 0 ? (
                    <p className="text-sm text-gray-500">Keine offenen Tickets</p>
                  ) : (
                    customerTickets.map(ticket => (
                      <div key={ticket.id} className="flex justify-between items-center text-sm bg-gray-50 rounded p-2">
                        <div>
                          <span className="font-medium">{ticket.ticket_number}</span>
                          <span className="text-gray-500 ml-2 truncate max-w-[120px] inline-block align-bottom">{ticket.title}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(`/service/tickets/${ticket.id}`);
                          }}
                          className="text-orange-600 hover:text-orange-800"
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notizen */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">Notizen</label>
            <textarea
              rows="4"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
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

export default CustomerModal;
