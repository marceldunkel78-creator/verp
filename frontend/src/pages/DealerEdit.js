import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  BuildingStorefrontIcon,
  ArrowLeftIcon,
  UserGroupIcon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  PlusIcon,
  TrashIcon,
  CloudArrowUpIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

const DealerEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = id && id !== 'new';

  const [activeTab, setActiveTab] = useState('company');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    status: 'active',
    dealer_discount: 0,
    payment_terms: 'net_30',
    notes: '',
    language: 'DE'
  });

  // Related data
  const [employees, setEmployees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [customerSystems, setCustomerSystems] = useState([]);
  const [pricelistLogs, setPricelistLogs] = useState([]);
  const [quotationLogs, setQuotationLogs] = useState([]);

  // File upload
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [newDocument, setNewDocument] = useState({
    title: '',
    document_type: 'other',
    description: '',
    file: null
  });

  const tabs = [
    { id: 'company', label: 'Firmeninfo', icon: BuildingStorefrontIcon },
    { id: 'employees', label: 'Mitarbeiter', icon: UserGroupIcon },
    { id: 'customer_systems', label: 'Dealer-Kundensysteme', icon: ComputerDesktopIcon },
    { id: 'logs', label: 'Preislisten & Angebote', icon: DocumentTextIcon }
  ];

  const loadDealer = useCallback(async () => {
    if (!isEditing) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/dealers/dealers/${id}/`);
      const dealer = response.data;
      
      setFormData({
        company_name: dealer.company_name || '',
        street: dealer.street || '',
        house_number: dealer.house_number || '',
        address_supplement: dealer.address_supplement || '',
        postal_code: dealer.postal_code || '',
        city: dealer.city || '',
        state: dealer.state || '',
        country: dealer.country || 'DE',
        status: dealer.status || 'active',
        dealer_discount: dealer.dealer_discount || 0,
        payment_terms: dealer.payment_terms || 'net_30',
        notes: dealer.notes || '',
        language: dealer.language || 'DE'
      });

      setEmployees(dealer.employees || []);
      setDocuments(dealer.documents || []);
      setCustomerSystems(dealer.customer_systems || []);
      setPricelistLogs(dealer.pricelist_logs || []);
      setQuotationLogs(dealer.quotation_logs || []);
    } catch (error) {
      console.error('Fehler beim Laden des Händlers:', error);
      alert('Fehler beim Laden des Händlers');
    } finally {
      setLoading(false);
    }
  }, [id, isEditing]);

  useEffect(() => {
    loadDealer();
  }, [loadDealer]);

  const handleSave = async () => {
    if (!formData.company_name.trim()) {
      alert('Bitte geben Sie einen Firmennamen ein.');
      return;
    }

    setSaving(true);
    try {
      const submitData = {
        ...formData,
        dealer_discount: parseFloat(formData.dealer_discount) || 0
      };

      if (isEditing) {
        await api.put(`/dealers/dealers/${id}/`, submitData);
        alert('Händler erfolgreich aktualisiert');
      } else {
        const response = await api.post('/dealers/dealers/', submitData);
        alert('Händler erfolgreich erstellt');
        navigate(`/sales/dealers/${response.data.id}`);
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern: ' + JSON.stringify(error.response?.data || 'Unbekannter Fehler'));
    } finally {
      setSaving(false);
    }
  };

  // Employee functions
  const addEmployee = () => {
    setEmployees([...employees, {
      id: null,
      salutation: '',
      title: '',
      first_name: '',
      last_name: '',
      language: 'DE',
      phone: '',
      mobile: '',
      fax: '',
      email: '',
      street: '',
      house_number: '',
      postal_code: '',
      city: '',
      country: '',
      is_primary: employees.length === 0,
      is_active: true,
      notes: ''
    }]);
  };

  const updateEmployee = (index, field, value) => {
    const updated = [...employees];
    updated[index][field] = value;
    setEmployees(updated);
  };

  const removeEmployee = (index) => {
    if (window.confirm('Möchten Sie diesen Mitarbeiter wirklich entfernen?')) {
      setEmployees(employees.filter((_, i) => i !== index));
    }
  };

  const saveEmployee = async (index) => {
    const employee = employees[index];
    if (!employee.first_name || !employee.last_name) {
      alert('Bitte geben Sie Vor- und Nachname ein.');
      return;
    }

    try {
      if (employee.id) {
        await api.put(`/dealers/dealer-employees/${employee.id}/`, {
          ...employee,
          dealer: id
        });
      } else {
        const response = await api.post('/dealers/dealer-employees/', {
          ...employee,
          dealer: id
        });
        const updated = [...employees];
        updated[index].id = response.data.id;
        setEmployees(updated);
      }
      alert('Mitarbeiter gespeichert');
    } catch (error) {
      console.error('Fehler beim Speichern des Mitarbeiters:', error);
      alert('Fehler beim Speichern');
    }
  };

  const deleteEmployee = async (index) => {
    const employee = employees[index];
    if (!window.confirm('Möchten Sie diesen Mitarbeiter wirklich löschen?')) return;

    try {
      if (employee.id) {
        await api.delete(`/dealers/dealer-employees/${employee.id}/`);
      }
      setEmployees(employees.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen');
    }
  };

  // Document functions
  const handleDocumentUpload = async () => {
    if (!newDocument.file || !newDocument.title) {
      alert('Bitte wählen Sie eine Datei und geben Sie einen Titel ein.');
      return;
    }

    setUploadingDocument(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('dealer', id);
      formDataUpload.append('title', newDocument.title);
      formDataUpload.append('document_type', newDocument.document_type);
      formDataUpload.append('description', newDocument.description);
      formDataUpload.append('file', newDocument.file);

      const response = await api.post('/dealers/dealer-documents/', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setDocuments([response.data, ...documents]);
      setNewDocument({ title: '', document_type: 'other', description: '', file: null });
      alert('Dokument hochgeladen');
    } catch (error) {
      console.error('Fehler beim Hochladen:', error);
      alert('Fehler beim Hochladen');
    } finally {
      setUploadingDocument(false);
    }
  };

  const deleteDocument = async (docId) => {
    if (!window.confirm('Möchten Sie dieses Dokument wirklich löschen?')) return;

    try {
      await api.delete(`/dealers/dealer-documents/${docId}/`);
      setDocuments(documents.filter(d => d.id !== docId));
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen');
    }
  };

  // Customer System functions
  const addCustomerSystem = () => {
    setCustomerSystems([...customerSystems, {
      id: null,
      customer_name: '',
      customer_street: '',
      customer_house_number: '',
      customer_postal_code: '',
      customer_city: '',
      customer_country: 'DE',
      visiview_license_id: '',
      system_hardware: '',
      notes: '',
      tickets: []
    }]);
  };

  const updateCustomerSystem = (index, field, value) => {
    const updated = [...customerSystems];
    updated[index][field] = value;
    setCustomerSystems(updated);
  };

  const saveCustomerSystem = async (index) => {
    const system = customerSystems[index];

    try {
      if (system.id) {
        await api.put(`/dealers/dealer-customer-systems/${system.id}/`, {
          ...system,
          dealer: id
        });
      } else {
        const response = await api.post('/dealers/dealer-customer-systems/', {
          ...system,
          dealer: id
        });
        const updated = [...customerSystems];
        updated[index].id = response.data.id;
        setCustomerSystems(updated);
      }
      alert('Kundensystem gespeichert');
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern');
    }
  };

  const deleteCustomerSystem = async (index) => {
    const system = customerSystems[index];
    if (!window.confirm('Möchten Sie dieses Kundensystem wirklich löschen?')) return;

    try {
      if (system.id) {
        await api.delete(`/dealers/dealer-customer-systems/${system.id}/`);
      }
      setCustomerSystems(customerSystems.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen');
    }
  };

  // Pricelist Log functions
  const [newPricelistLog, setNewPricelistLog] = useState({
    pricelist_type: 'vs_hardware',
    sent_date: new Date().toISOString().split('T')[0],
    valid_until: '',
    notes: ''
  });

  const savePricelistLog = async () => {
    if (!newPricelistLog.sent_date) {
      alert('Bitte geben Sie ein Versanddatum ein.');
      return;
    }

    try {
      const response = await api.post('/dealers/dealer-pricelist-logs/', {
        dealer: id,
        ...newPricelistLog
      });
      setPricelistLogs([response.data, ...pricelistLogs]);
      setNewPricelistLog({
        pricelist_type: 'vs_hardware',
        sent_date: new Date().toISOString().split('T')[0],
        valid_until: '',
        notes: ''
      });
      alert('Preislisten-Eintrag gespeichert');
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern');
    }
  };

  // Quotation Log functions
  const [newQuotationLog, setNewQuotationLog] = useState({
    quotation_number: '',
    sent_date: new Date().toISOString().split('T')[0],
    subject: '',
    notes: ''
  });

  const saveQuotationLog = async () => {
    if (!newQuotationLog.sent_date) {
      alert('Bitte geben Sie ein Versanddatum ein.');
      return;
    }

    try {
      const response = await api.post('/dealers/dealer-quotation-logs/', {
        dealer: id,
        ...newQuotationLog
      });
      setQuotationLogs([response.data, ...quotationLogs]);
      setNewQuotationLog({
        quotation_number: '',
        sent_date: new Date().toISOString().split('T')[0],
        subject: '',
        notes: ''
      });
      alert('Angebots-Eintrag gespeichert');
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/sales/dealers')}
            className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <BuildingStorefrontIcon className="h-8 w-8 mr-3 text-blue-600" />
              {isEditing ? formData.company_name || 'Händler bearbeiten' : 'Neuer Händler'}
            </h1>
            {isEditing && (
              <p className="mt-1 text-sm text-gray-500">
                Händlernummer wird automatisch vergeben
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="tab-scroll -mb-px flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                disabled={!isEditing && tab.id !== 'company'}
                className={`
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                  ${!isEditing && tab.id !== 'company' ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <tab.icon className="h-5 w-5 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Tab: Firmeninfo */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              {/* Grunddaten */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Grunddaten</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Firmenname *
                    </label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="active">Aktiv</option>
                      <option value="inactive">Inaktiv</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sprache</label>
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="DE">Deutsch</option>
                      <option value="EN">English</option>
                      <option value="FR">Français</option>
                      <option value="ES">Español</option>
                      <option value="IT">Italiano</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Adresse */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Firmenadresse</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
                    <input
                      type="text"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hausnummer</label>
                    <input
                      type="text"
                      value={formData.house_number}
                      onChange={(e) => setFormData({ ...formData, house_number: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresszusatz</label>
                    <input
                      type="text"
                      value={formData.address_supplement}
                      onChange={(e) => setFormData({ ...formData, address_supplement: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                    <input
                      type="text"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
                    <select
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="DE">Deutschland</option>
                      <option value="AT">Österreich</option>
                      <option value="CH">Schweiz</option>
                      <option value="FR">Frankreich</option>
                      <option value="IT">Italien</option>
                      <option value="ES">Spanien</option>
                      <option value="GB">Großbritannien</option>
                      <option value="US">USA</option>
                      <option value="NL">Niederlande</option>
                      <option value="BE">Belgien</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Konditionen */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Konditionen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Händlerrabatt (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.dealer_discount}
                      onChange={(e) => setFormData({ ...formData, dealer_discount: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Zahlungskonditionen
                    </label>
                    <select
                      value={formData.payment_terms}
                      onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="prepayment">Vorkasse</option>
                      <option value="net_14">14 Tage netto</option>
                      <option value="net_30">30 Tage netto</option>
                      <option value="net_60">60 Tage netto</option>
                      <option value="net_90">90 Tage netto</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Notizen */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Notizen</h3>
                <textarea
                  rows={4}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Interne Notizen zum Händler..."
                />
              </div>

              {/* Dokumente */}
              {isEditing && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Dokumente & Verträge</h3>
                  
                  {/* Upload Form */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Neues Dokument hochladen</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                        <input
                          type="text"
                          value={newDocument.title}
                          onChange={(e) => setNewDocument({ ...newDocument, title: e.target.value })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                        <select
                          value={newDocument.document_type}
                          onChange={(e) => setNewDocument({ ...newDocument, document_type: e.target.value })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                          <option value="contract">Vertrag</option>
                          <option value="agreement">Vereinbarung</option>
                          <option value="certificate">Zertifikat</option>
                          <option value="other">Sonstiges</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Datei *</label>
                        <input
                          type="file"
                          onChange={(e) => setNewDocument({ ...newDocument, file: e.target.files[0] })}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={handleDocumentUpload}
                          disabled={uploadingDocument}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        >
                          <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                          {uploadingDocument ? 'Hochladen...' : 'Hochladen'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Document List */}
                  {documents.length > 0 ? (
                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titel</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hochgeladen</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {documents.map((doc) => (
                            <tr key={doc.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {doc.title}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {doc.document_type_display}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(doc.uploaded_at).toLocaleDateString('de-DE')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <a
                                  href={doc.file}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-900 mr-4"
                                >
                                  <DocumentArrowDownIcon className="h-5 w-5 inline" />
                                </a>
                                <button
                                  onClick={() => deleteDocument(doc.id)}
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
                  ) : (
                    <p className="text-gray-500 text-sm">Keine Dokumente vorhanden.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab: Mitarbeiter */}
          {activeTab === 'employees' && isEditing && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Mitarbeiter / Ansprechpartner</h3>
                <button
                  onClick={addEmployee}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Mitarbeiter hinzufügen
                </button>
              </div>

              {employees.length === 0 ? (
                <p className="text-gray-500 text-sm">Keine Mitarbeiter vorhanden.</p>
              ) : (
                <div className="space-y-6">
                  {employees.map((employee, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-sm font-medium text-gray-900">
                          {employee.first_name && employee.last_name 
                            ? `${employee.title} ${employee.first_name} ${employee.last_name}`.trim()
                            : `Mitarbeiter ${index + 1}`
                          }
                          {employee.is_primary && (
                            <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              Hauptansprechpartner
                            </span>
                          )}
                        </h4>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => saveEmployee(index)}
                            className="text-green-600 hover:text-green-900 text-sm"
                          >
                            Speichern
                          </button>
                          <button
                            onClick={() => deleteEmployee(index)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Anrede</label>
                          <select
                            value={employee.salutation}
                            onChange={(e) => updateEmployee(index, 'salutation', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          >
                            <option value="">-</option>
                            <option value="Herr">Herr</option>
                            <option value="Frau">Frau</option>
                            <option value="Mr.">Mr.</option>
                            <option value="Mrs.">Mrs.</option>
                            <option value="Ms.">Ms.</option>
                            <option value="Dr.">Dr.</option>
                            <option value="Prof.">Prof.</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
                          <input
                            type="text"
                            value={employee.title}
                            onChange={(e) => updateEmployee(index, 'title', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Vorname *</label>
                          <input
                            type="text"
                            value={employee.first_name}
                            onChange={(e) => updateEmployee(index, 'first_name', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nachname *</label>
                          <input
                            type="text"
                            value={employee.last_name}
                            onChange={(e) => updateEmployee(index, 'last_name', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sprache</label>
                          <select
                            value={employee.language}
                            onChange={(e) => updateEmployee(index, 'language', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          >
                            <option value="DE">Deutsch</option>
                            <option value="EN">English</option>
                            <option value="FR">Français</option>
                            <option value="ES">Español</option>
                            <option value="IT">Italiano</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                          <input
                            type="text"
                            value={employee.phone}
                            onChange={(e) => updateEmployee(index, 'phone', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Mobil</label>
                          <input
                            type="text"
                            value={employee.mobile}
                            onChange={(e) => updateEmployee(index, 'mobile', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                          <input
                            type="email"
                            value={employee.email}
                            onChange={(e) => updateEmployee(index, 'email', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
                          <input
                            type="text"
                            value={employee.street}
                            onChange={(e) => updateEmployee(index, 'street', e.target.value)}
                            placeholder="Falls abweichend von Firmenadresse"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                          <input
                            type="text"
                            value={employee.postal_code}
                            onChange={(e) => updateEmployee(index, 'postal_code', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                          <input
                            type="text"
                            value={employee.city}
                            onChange={(e) => updateEmployee(index, 'city', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div className="md:col-span-2 flex items-center space-x-4">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={employee.is_primary}
                              onChange={(e) => updateEmployee(index, 'is_primary', e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Hauptansprechpartner</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={employee.is_active}
                              onChange={(e) => updateEmployee(index, 'is_active', e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Aktiv</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Dealer-Kundensysteme */}
          {activeTab === 'customer_systems' && isEditing && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Dealer-Kundensysteme</h3>
                <button
                  onClick={addCustomerSystem}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Kundensystem hinzufügen
                </button>
              </div>

              <p className="text-sm text-gray-500">
                Hier können Sie Informationen über die Endkunden und deren Systeme Ihres Händlers erfassen.
              </p>

              {customerSystems.length === 0 ? (
                <p className="text-gray-500 text-sm">Keine Kundensysteme vorhanden.</p>
              ) : (
                <div className="space-y-6">
                  {customerSystems.map((system, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-sm font-medium text-gray-900">
                          {system.customer_name || `Kundensystem ${index + 1}`}
                          {system.visiview_license_id && (
                            <span className="ml-2 text-xs text-gray-500">
                              (VisiView: {system.visiview_license_id})
                            </span>
                          )}
                        </h4>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => saveCustomerSystem(index)}
                            className="text-green-600 hover:text-green-900 text-sm"
                          >
                            Speichern
                          </button>
                          <button
                            onClick={() => deleteCustomerSystem(index)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Kundenname (falls bekannt)
                          </label>
                          <input
                            type="text"
                            value={system.customer_name}
                            onChange={(e) => updateCustomerSystem(index, 'customer_name', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            VisiView Lizenz-ID
                          </label>
                          <input
                            type="text"
                            value={system.visiview_license_id}
                            onChange={(e) => updateCustomerSystem(index, 'visiview_license_id', e.target.value)}
                            placeholder="z.B. 1234"
                            maxLength={10}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                          <input
                            type="text"
                            value={system.customer_city}
                            onChange={(e) => updateCustomerSystem(index, 'customer_city', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Kundensystem-Hardware
                          </label>
                          <textarea
                            rows={3}
                            value={system.system_hardware}
                            onChange={(e) => updateCustomerSystem(index, 'system_hardware', e.target.value)}
                            placeholder="Beschreibung der Hardware beim Endkunden..."
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                          <textarea
                            rows={2}
                            value={system.notes}
                            onChange={(e) => updateCustomerSystem(index, 'notes', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      </div>

                      {/* Tickets for this customer system */}
                      {system.tickets && system.tickets.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Verknüpfte Tickets</h5>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {system.tickets.map((ticket, tIdx) => (
                              <li key={tIdx}>
                                {ticket.ticket_type_display}: {ticket.service_ticket_number || ticket.ticket_reference}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Preislisten & Angebote */}
          {activeTab === 'logs' && isEditing && (
            <div className="space-y-8">
              {/* Preislisten */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Versendete Preislisten</h3>
                
                {/* New Pricelist Log Form */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Neue Preisliste protokollieren</h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                      <select
                        value={newPricelistLog.pricelist_type}
                        onChange={(e) => setNewPricelistLog({ ...newPricelistLog, pricelist_type: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      >
                        <option value="vs_hardware">VS-Hardware Preisliste</option>
                        <option value="visiview">VisiView Produkte Preisliste</option>
                        <option value="combined">Kombinierte Preisliste</option>
                        <option value="custom">Individuelle Preisliste</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Versanddatum *</label>
                      <input
                        type="date"
                        value={newPricelistLog.sent_date}
                        onChange={(e) => setNewPricelistLog({ ...newPricelistLog, sent_date: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gültig bis</label>
                      <input
                        type="date"
                        value={newPricelistLog.valid_until}
                        onChange={(e) => setNewPricelistLog({ ...newPricelistLog, valid_until: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                      <input
                        type="text"
                        value={newPricelistLog.notes}
                        onChange={(e) => setNewPricelistLog({ ...newPricelistLog, notes: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={savePricelistLog}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                      >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Hinzufügen
                      </button>
                    </div>
                  </div>
                </div>

                {/* Pricelist Log Table */}
                {pricelistLogs.length > 0 ? (
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Versanddatum</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gültig bis</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notizen</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gesendet von</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pricelistLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {log.pricelist_type_display}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(log.sent_date).toLocaleDateString('de-DE')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {log.valid_until ? new Date(log.valid_until).toLocaleDateString('de-DE') : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {log.notes || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {log.sent_by_name || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Keine Preislisten protokolliert.</p>
                )}
              </div>

              {/* Angebote */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Versendete Angebote</h3>
                
                {/* New Quotation Log Form */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Neues Angebot protokollieren</h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Angebotsnummer</label>
                      <input
                        type="text"
                        value={newQuotationLog.quotation_number}
                        onChange={(e) => setNewQuotationLog({ ...newQuotationLog, quotation_number: e.target.value })}
                        placeholder="z.B. Q-2025-001"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Versanddatum *</label>
                      <input
                        type="date"
                        value={newQuotationLog.sent_date}
                        onChange={(e) => setNewQuotationLog({ ...newQuotationLog, sent_date: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Betreff</label>
                      <input
                        type="text"
                        value={newQuotationLog.subject}
                        onChange={(e) => setNewQuotationLog({ ...newQuotationLog, subject: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={saveQuotationLog}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                      >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Hinzufügen
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quotation Log Table */}
                {quotationLogs.length > 0 ? (
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Angebotsnr.</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Versanddatum</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Betreff</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gesendet von</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {quotationLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {log.quotation_number || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(log.sent_date).toLocaleDateString('de-DE')}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {log.subject || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {log.sent_by_name || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Keine Angebote protokolliert.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DealerEdit;
