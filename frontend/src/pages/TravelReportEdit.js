import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  ArrowLeftIcon, 
  PhotoIcon, 
  PlusIcon,
  TrashIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const TravelReportEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState(null);
  
  const [formData, setFormData] = useState({
    report_type: 'travel',
    date: new Date().toISOString().split('T')[0],
    location: '',
    customer: '',
    linked_system: '',
    linked_order: '',
    notes: ''
  });
  
  // Selection states
  const [customers, setCustomers] = useState([]);
  const [systems, setSystems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  
  // Search states
  const [customerSearch, setCustomerSearch] = useState('');
  const [systemSearch, setSystemSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [searchingSystems, setSearchingSystems] = useState(false);
  const [searchingOrders, setSearchingOrders] = useState(false);
  
  // Selected display names
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Dropdown visibility
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showSystemDropdown, setShowSystemDropdown] = useState(false);
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  
  // Table creation modal
  const [showTableModal, setShowTableModal] = useState(false);
  const [newTableRows, setNewTableRows] = useState(5);
  const [newTableCols, setNewTableCols] = useState(3);
  const [newTableTitle, setNewTableTitle] = useState('Lasermessungen');

  useEffect(() => {
    if (id && id !== 'new') {
      fetchReport();
    } else {
      // Pre-fill from URL params
      const params = new URLSearchParams(window.location.search);
      const system = params.get('system');
      const customer = params.get('customer');
      const order = params.get('order');
      
      if (system || customer || order) {
        setFormData(prev => ({
          ...prev,
          linked_system: system || '',
          customer: customer || '',
          linked_order: order || ''
        }));
        // Load pre-filled data
        if (customer) fetchCustomerById(customer);
        if (system) fetchSystemById(system);
        if (order) fetchOrderById(order);
      }
      setLoading(false);
    }
  }, [id]);

  const fetchReport = async () => {
    try {
      const response = await api.get(`/service/travel-reports/${id}/`);
      setReport(response.data);
      setFormData({
        report_type: response.data.report_type || 'travel',
        date: response.data.date || '',
        location: response.data.location || '',
        customer: response.data.customer || '',
        linked_system: response.data.linked_system || '',
        linked_order: response.data.linked_order || '',
        notes: response.data.notes || ''
      });
      setPhotos(response.data.photos || []);
      setMeasurements(response.data.measurements || []);
      
      // Load selected names
      if (response.data.customer) fetchCustomerById(response.data.customer);
      if (response.data.linked_system) fetchSystemById(response.data.linked_system);
      if (response.data.linked_order) fetchOrderById(response.data.linked_order);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
      alert('Fehler beim Laden des Berichts');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerById = async (customerId) => {
    try {
      const response = await api.get(`/customers/customers/${customerId}/`);
      setSelectedCustomer(response.data);
    } catch (error) {
      console.error('Fehler beim Laden des Kunden:', error);
    }
  };

  const fetchSystemById = async (systemId) => {
    try {
      const response = await api.get(`/systems/systems/${systemId}/`);
      setSelectedSystem(response.data);
    } catch (error) {
      console.error('Fehler beim Laden des Systems:', error);
    }
  };

  const fetchOrderById = async (orderId) => {
    try {
      const response = await api.get(`/customer-orders/orders/${orderId}/`);
      setSelectedOrder(response.data);
    } catch (error) {
      console.error('Fehler beim Laden des Auftrags:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (id && id !== 'new') {
        await api.put(`/service/travel-reports/${id}/`, formData);
        alert('Bericht aktualisiert');
      } else {
        const response = await api.post('/service/travel-reports/', formData);
        navigate(`/travel-reports/${response.data.id}`);
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  // Customer search
  const searchCustomers = async (query) => {
    if (!query.trim()) {
      setCustomers([]);
      return;
    }
    setSearchingCustomers(true);
    try {
      const response = await api.get(`/customers/customers/?search=${query}`);
      setCustomers(response.data.results || response.data || []);
    } catch (error) {
      console.error('Fehler bei Kundensuche:', error);
    } finally {
      setSearchingCustomers(false);
    }
  };

  // System search - filtered by customer if selected
  const searchSystems = async (query) => {
    if (!query.trim() && !formData.customer) {
      setSystems([]);
      return;
    }
    setSearchingSystems(true);
    try {
      let url = `/systems/systems/?search=${query}`;
      if (formData.customer) {
        url += `&customer=${formData.customer}`;
      }
      const response = await api.get(url);
      setSystems(response.data.results || response.data || []);
    } catch (error) {
      console.error('Fehler bei Systemsuche:', error);
    } finally {
      setSearchingSystems(false);
    }
  };

  // Order search
  const searchOrders = async (query) => {
    if (!query.trim()) {
      setOrders([]);
      return;
    }
    setSearchingOrders(true);
    try {
      const response = await api.get(`/customer-orders/orders/?search=${query}`);
      setOrders(response.data.results || response.data || []);
    } catch (error) {
      console.error('Fehler bei Auftragssuche:', error);
    } finally {
      setSearchingOrders(false);
    }
  };

  // Selection handlers
  const selectCustomer = (customer) => {
    setFormData(prev => ({ ...prev, customer: customer.id, linked_system: '' }));
    setSelectedCustomer(customer);
    setSelectedSystem(null);
    setShowCustomerDropdown(false);
    setCustomerSearch('');
    // Load systems for this customer
    searchSystems('');
  };

  const selectSystem = (system) => {
    setFormData(prev => ({ ...prev, linked_system: system.id }));
    setSelectedSystem(system);
    setShowSystemDropdown(false);
    setSystemSearch('');
  };

  const selectOrder = (order) => {
    setFormData(prev => ({ ...prev, linked_order: order.id }));
    setSelectedOrder(order);
    setShowOrderDropdown(false);
    setOrderSearch('');
  };

  const clearCustomer = () => {
    setFormData(prev => ({ ...prev, customer: '', linked_system: '' }));
    setSelectedCustomer(null);
    setSelectedSystem(null);
  };

  const clearSystem = () => {
    setFormData(prev => ({ ...prev, linked_system: '' }));
    setSelectedSystem(null);
  };

  const clearOrder = () => {
    setFormData(prev => ({ ...prev, linked_order: '' }));
    setSelectedOrder(null);
  };

  // Photo handling
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !id || id === 'new') return;

    const uploadData = new FormData();
    uploadData.append('photo', file);

    try {
      await api.post(`/service/travel-reports/${id}/upload_photo/`, uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchReport();
    } catch (error) {
      console.error('Fehler beim Hochladen:', error);
      alert('Fehler beim Hochladen des Fotos');
    }
  };

  const deletePhoto = async (photoId) => {
    if (!window.confirm('Foto löschen?')) return;
    try {
      await api.delete(`/service/travel-reports/${id}/delete_photo/`, { data: { photo_id: photoId } });
      fetchReport();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  // Measurement table handling
  const addMeasurementTable = async () => {
    if (!id || id === 'new') {
      alert('Bitte speichern Sie den Bericht zuerst.');
      return;
    }
    
    // Create empty table data
    const headers = [];
    for (let i = 0; i < newTableCols; i++) {
      headers.push(`Spalte ${i + 1}`);
    }
    
    const rows = [];
    for (let i = 0; i < newTableRows; i++) {
      const row = [];
      for (let j = 0; j < newTableCols; j++) {
        row.push('');
      }
      rows.push(row);
    }
    
    try {
      await api.post(`/service/travel-reports/${id}/add_measurement/`, {
        title: newTableTitle,
        data: { headers, rows }
      });
      fetchReport();
      setShowTableModal(false);
      setNewTableTitle('Lasermessungen');
      setNewTableRows(5);
      setNewTableCols(3);
    } catch (error) {
      console.error('Fehler beim Erstellen der Tabelle:', error);
      alert('Fehler beim Erstellen der Tabelle');
    }
  };

  const updateMeasurement = async (measurementId, data) => {
    try {
      await api.put(`/service/travel-reports/${id}/update_measurement/`, {
        measurement_id: measurementId,
        ...data
      });
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
    }
  };

  const deleteMeasurement = async (measurementId) => {
    if (!window.confirm('Tabelle wirklich löschen?')) return;
    try {
      await api.delete(`/service/travel-reports/${id}/delete_measurement/`, {
        data: { measurement_id: measurementId }
      });
      fetchReport();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  const updateTableCell = (measurementIndex, rowIndex, colIndex, value) => {
    const updated = [...measurements];
    const measurement = updated[measurementIndex];
    if (measurement.data && measurement.data.rows) {
      measurement.data.rows[rowIndex][colIndex] = value;
      setMeasurements(updated);
      // Debounced save
      clearTimeout(window.measurementSaveTimeout);
      window.measurementSaveTimeout = setTimeout(() => {
        updateMeasurement(measurement.id, { data: measurement.data });
      }, 500);
    }
  };

  const updateTableHeader = (measurementIndex, colIndex, value) => {
    const updated = [...measurements];
    const measurement = updated[measurementIndex];
    if (measurement.data && measurement.data.headers) {
      measurement.data.headers[colIndex] = value;
      setMeasurements(updated);
      clearTimeout(window.measurementSaveTimeout);
      window.measurementSaveTimeout = setTimeout(() => {
        updateMeasurement(measurement.id, { data: measurement.data });
      }, 500);
    }
  };

  const updateMeasurementTitle = (measurementIndex, value) => {
    const updated = [...measurements];
    updated[measurementIndex].title = value;
    setMeasurements(updated);
    clearTimeout(window.measurementSaveTimeout);
    window.measurementSaveTimeout = setTimeout(() => {
      updateMeasurement(updated[measurementIndex].id, { title: value });
    }, 500);
  };

  // PDF generation
  const generatePDF = async () => {
    if (formData.report_type !== 'service') {
      alert('PDF-Generierung ist nur für Serviceberichte verfügbar.');
      return;
    }
    try {
      const response = await api.get(`/service/travel-reports/${id}/generate_pdf/`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const orderNum = selectedOrder?.order_number || id;
      link.setAttribute('download', `Servicebericht_${orderNum}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Fehler bei PDF-Generierung:', error);
      alert('Fehler bei der PDF-Generierung');
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
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück
        </button>
        <div className="sm:flex sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            {id === 'new' ? 'Neuer Bericht' : 'Bericht bearbeiten'}
          </h1>
          {id !== 'new' && formData.report_type === 'service' && (
            <button
              onClick={generatePDF}
              className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
              PDF erstellen
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">Basisinformationen</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Typ *</label>
              <select
                value={formData.report_type}
                onChange={(e) => setFormData({...formData, report_type: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              >
                <option value="travel">Reisebericht</option>
                <option value="service">Servicebericht</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Datum *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Ort *</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Customer/System/Order Selection */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">Verknüpfungen</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Customer Selection */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Kunde</label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <span className="text-sm text-blue-800">{selectedCustomer.company_name || selectedCustomer.name}</span>
                  <button type="button" onClick={clearCustomer} className="text-blue-600 hover:text-blue-800">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      searchCustomers(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Kunde suchen..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10"
                  />
                  <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
              )}
              {showCustomerDropdown && customers.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto border border-gray-200">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      {customer.company_name || customer.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* System Selection */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">System</label>
              {selectedSystem ? (
                <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-md">
                  <span className="text-sm text-green-800">{selectedSystem.system_name}</span>
                  <button type="button" onClick={clearSystem} className="text-green-600 hover:text-green-800">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={systemSearch}
                    onChange={(e) => {
                      setSystemSearch(e.target.value);
                      searchSystems(e.target.value);
                      setShowSystemDropdown(true);
                    }}
                    onFocus={() => {
                      setShowSystemDropdown(true);
                      if (formData.customer) searchSystems('');
                    }}
                    placeholder={formData.customer ? "System suchen..." : "Erst Kunde wählen..."}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10"
                  />
                  <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
              )}
              {showSystemDropdown && systems.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto border border-gray-200">
                  {systems.map((system) => (
                    <button
                      key={system.id}
                      type="button"
                      onClick={() => selectSystem(system)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      {system.system_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Order Selection */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Auftrag</label>
              {selectedOrder ? (
                <div className="flex items-center justify-between p-2 bg-purple-50 border border-purple-200 rounded-md">
                  <span className="text-sm text-purple-800">{selectedOrder.order_number}</span>
                  <button type="button" onClick={clearOrder} className="text-purple-600 hover:text-purple-800">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={(e) => {
                      setOrderSearch(e.target.value);
                      searchOrders(e.target.value);
                      setShowOrderDropdown(true);
                    }}
                    onFocus={() => setShowOrderDropdown(true)}
                    placeholder="Auftragsnummer suchen..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10"
                  />
                  <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
              )}
              {showOrderDropdown && orders.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto border border-gray-200">
                  {orders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => selectOrder(order)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      <span className="font-medium">{order.order_number}</span>
                      {order.customer_name && <span className="text-gray-500 ml-2">- {order.customer_name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">Notizen</h3>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            rows={6}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Beschreibung, Beobachtungen, durchgeführte Arbeiten..."
          />
        </div>

        {/* Measurement Tables - only for saved reports */}
        {id && id !== 'new' && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Messtabellen</h3>
              <button
                type="button"
                onClick={() => setShowTableModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <TableCellsIcon className="h-5 w-5 mr-2" />
                Tabelle hinzufügen
              </button>
            </div>

            {measurements.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Keine Messtabellen vorhanden</p>
            ) : (
              <div className="space-y-6">
                {measurements.map((measurement, mIndex) => (
                  <div key={measurement.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <input
                        type="text"
                        value={measurement.title || ''}
                        onChange={(e) => updateMeasurementTitle(mIndex, e.target.value)}
                        className="text-lg font-medium border-0 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 bg-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => deleteMeasurement(measurement.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                    
                    {measurement.data && measurement.data.headers && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead>
                            <tr>
                              {measurement.data.headers.map((header, hIndex) => (
                                <th key={hIndex} className="px-3 py-2 bg-gray-50">
                                  <input
                                    type="text"
                                    value={header}
                                    onChange={(e) => updateTableHeader(mIndex, hIndex, e.target.value)}
                                    className="w-full text-xs font-medium text-gray-700 uppercase border-0 bg-transparent text-center focus:ring-0"
                                  />
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {measurement.data.rows && measurement.data.rows.map((row, rIndex) => (
                              <tr key={rIndex}>
                                {row.map((cell, cIndex) => (
                                  <td key={cIndex} className="px-3 py-2">
                                    <input
                                      type="text"
                                      value={cell}
                                      onChange={(e) => updateTableCell(mIndex, rIndex, cIndex, e.target.value)}
                                      className="w-full text-sm border-gray-200 rounded focus:border-blue-500 focus:ring-blue-500"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Photos Section - only for saved reports */}
        {id && id !== 'new' && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Fotos</h3>
              <label className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 cursor-pointer">
                <PhotoIcon className="h-5 w-5 mr-2" />
                Foto hochladen
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
            
            {photos.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Keine Fotos vorhanden</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.photo_url || photo.photo}
                      alt={photo.caption || 'Foto'}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => deletePhoto(photo.id)}
                      className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Save Buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </form>

      {/* Table Creation Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Neue Messtabelle erstellen</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Titel</label>
                <input
                  type="text"
                  value={newTableTitle}
                  onChange={(e) => setNewTableTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Zeilen</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={newTableRows}
                    onChange={(e) => setNewTableRows(parseInt(e.target.value) || 1)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Spalten</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={newTableCols}
                    onChange={(e) => setNewTableCols(parseInt(e.target.value) || 1)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={addMeasurementTable}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                Tabelle erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TravelReportEdit;
