import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
/* eslint-disable react-hooks/exhaustive-deps */
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const Assets = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [sortBy, setSortBy] = useState('visitron_part_number');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  
  const canWrite = user?.is_staff || user?.is_superuser || user?.can_write_assets;

  const statusChoices = [
    { value: 'in_progress', label: 'In Bearbeitung' },
    { value: 'ordered', label: 'Bestellt' },
    { value: 'confirmed', label: 'Bestätigt' },
    { value: 'in_stock', label: 'Auf Lager' },
    { value: 'sold', label: 'Verkauft' }
  ];

  const [formData, setFormData] = useState({
    name: '',
    visitron_part_number: '',
    supplier_part_number: '',
    supplier: '',
    product_group: null,
    serial_number: '',
    description: '',
    purchase_price: '',
    purchase_currency: 'EUR',
    sale_price: '',
    current_value: '',
    purchase_date: '',
    expected_delivery_date: '',
    actual_delivery_date: '',
    warranty_months: '',
    status: 'in_progress',
    notes: '',
    is_active: true,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchAssets();
    fetchSuppliers();
    fetchProductGroups();
  }, [sortBy, filterSupplier, filterStatus, filterActive, refreshKey]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      let url = '/suppliers/assets/?ordering=' + sortBy;
      
      if (filterSupplier) {
        url += `&supplier=${filterSupplier}`;
      }
      
      if (filterStatus) {
        url += `&status=${filterStatus}`;
      }
      
      if (filterActive !== 'all') {
        url += `&is_active=${filterActive === 'active'}`;
      }
      
      const response = await api.get(url);
      // Handle both paginated and non-paginated responses
      const data = response.data.results || response.data;
      setAssets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching assets:', error);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers/suppliers/');
      const data = response.data.results || response.data;
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]);
    }
  };

  const fetchProductGroups = async () => {
    try {
      const response = await api.get('/suppliers/product-groups/');
      const data = response.data.results || response.data;
      setProductGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching product groups:', error);
      setProductGroups([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
        current_value: formData.current_value ? parseFloat(formData.current_value) : null,
        warranty_months: formData.warranty_months ? parseInt(formData.warranty_months) : null,
        purchase_date: formData.purchase_date || null,
        expected_delivery_date: formData.expected_delivery_date || null,
        actual_delivery_date: formData.actual_delivery_date || null,
      };

      if (editingAsset) {
        await api.put(`/suppliers/assets/${editingAsset.id}/`, submitData);
      } else {
        await api.post('/suppliers/assets/', submitData);
      }
      
      setShowModal(false);
      setRefreshKey(prev => prev + 1);
      resetForm();
    } catch (error) {
      console.error('Error saving asset:', error);
      if (error.response?.data) {
        alert('Fehler beim Speichern: ' + JSON.stringify(error.response.data));
      }
    }
  };

  const handleEdit = (asset) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name || '',
      visitron_part_number: asset.visitron_part_number || '',
      supplier_part_number: asset.supplier_part_number || '',
      supplier: asset.supplier || '',
      product_group: asset.product_group || '',
      serial_number: asset.serial_number || '',
      description: asset.description || '',
      purchase_price: asset.purchase_price || '',
      purchase_currency: asset.purchase_currency || 'EUR',
      sale_price: asset.sale_price || '',
      current_value: asset.current_value || '',
      purchase_date: asset.purchase_date || '',
      expected_delivery_date: asset.expected_delivery_date || '',
      actual_delivery_date: asset.actual_delivery_date || '',
      warranty_months: asset.warranty_months || '',
      status: asset.status || 'in_progress',
      notes: asset.notes || '',
      is_active: asset.is_active !== undefined ? asset.is_active : true,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Möchten Sie diese Anlage wirklich löschen?')) {
      try {
        await api.delete(`/suppliers/assets/${id}/`);
        setRefreshKey(prev => prev + 1);
      } catch (error) {
        console.error('Error deleting asset:', error);
        alert('Fehler beim Löschen der Anlage');
      }
    }
  };

  const resetForm = () => {
    // Find the "Anlage" product group
    const anlageGroup = productGroups.find(g => g.name === 'Anlage');
    
    setFormData({
      name: '',
      visitron_part_number: '',
      supplier_part_number: '',
      supplier: '',
      product_group: anlageGroup ? anlageGroup.id : null,
      serial_number: '',
      description: '',
      purchase_price: '',
      purchase_currency: 'EUR',
      sale_price: '',
      current_value: '',
      purchase_date: '',
      expected_delivery_date: '',
      actual_delivery_date: '',
      warranty_months: '',
      status: 'in_progress',
      notes: '',
      is_active: true,
    });
    setEditingAsset(null);
  };

  const formatCurrency = (value, currency = 'EUR') => {
    if (!value) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const getStatusLabel = (status) => {
    const choice = statusChoices.find(c => c.value === status);
    return choice ? choice.label : status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'in_progress': 'bg-yellow-100 text-yellow-800',
      'ordered': 'bg-blue-100 text-blue-800',
      'confirmed': 'bg-purple-100 text-purple-800',
      'in_stock': 'bg-green-100 text-green-800',
      'sold': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      {/* Breadcrumb Navigation */}
      <div className="mb-4 text-sm text-gray-600">
        <Link to="/procurement" className="hover:text-gray-900">Procurement</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-900">Assets</span>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assets</h1>
          <p className="text-gray-600 mt-1">Verwalte deine Anlagen und deren Lifecycle</p>
        </div>
        {canWrite && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neue Anlage
          </button>
        )}
      </div>

      {/* Filter Section */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sortierung
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="visitron_part_number">Visitron-Partnr.</option>
              <option value="name">Name</option>
              <option value="purchase_date">Kaufdatum</option>
              <option value="status">Status</option>
              <option value="-created_at">Neueste zuerst</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lieferant
            </label>
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Alle Lieferanten</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.company_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Alle Status</option>
              {statusChoices.map(choice => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aktiv
            </label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">Alle</option>
              <option value="active">Nur aktiv</option>
              <option value="inactive">Nur inaktiv</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assets Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visitron-Partnr.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Seriennummer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lieferant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kaufdatum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Einkaufspreis
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assets.map(asset => (
                  <tr key={asset.id} className={!asset.is_active ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {asset.visitron_part_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {asset.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {asset.serial_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {asset.supplier_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(asset.status)}`}>
                        {getStatusLabel(asset.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(asset.purchase_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(asset.purchase_price, asset.purchase_currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {canWrite && (
                          <>
                            <button
                              onClick={() => handleEdit(asset)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Bearbeiten"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(asset.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Löschen"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {assets.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Keine Anlagen gefunden
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal for Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {editingAsset ? 'Anlage bearbeiten' : 'Neue Anlage'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Grundinformationen */}
                <div className="col-span-2">
                  <h4 className="text-md font-semibold text-gray-700 mb-3 border-b pb-2">
                    Grundinformationen
                  </h4>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {editingAsset && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visitron-Partnummer
                    </label>
                    <input
                      type="text"
                      value={formData.visitron_part_number}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lieferanten-Partnummer
                  </label>
                  <input
                    type="text"
                    name="supplier_part_number"
                    value={formData.supplier_part_number}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seriennummer
                  </label>
                  <input
                    type="text"
                    name="serial_number"
                    value={formData.serial_number}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lieferant *
                  </label>
                  <select
                    name="supplier"
                    value={formData.supplier || ''}
                    onChange={handleInputChange}
                    required
                    style={{ color: '#111827', backgroundColor: '#ffffff' }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="" style={{ color: '#111827' }}>Bitte wählen</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id} style={{ color: '#111827' }}>
                        {supplier.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status *
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    {statusChoices.map(choice => (
                      <option key={choice.value} value={choice.value} className="text-gray-900">
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Preise */}
                <div className="col-span-2">
                  <h4 className="text-md font-semibold text-gray-700 mb-3 border-b pb-2 mt-4">
                    Preise und Kosten
                  </h4>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Einkaufspreis
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      name="purchase_price"
                      value={formData.purchase_price}
                      onChange={handleInputChange}
                      step="0.01"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      name="purchase_currency"
                      value={formData.purchase_currency}
                      onChange={handleInputChange}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    >
                      <option value="EUR" className="text-gray-900">EUR</option>
                      <option value="USD" className="text-gray-900">USD</option>
                      <option value="GBP" className="text-gray-900">GBP</option>
                      <option value="CHF" className="text-gray-900">CHF</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Verkaufspreis (EUR)
                  </label>
                  <input
                    type="number"
                    name="sale_price"
                    value={formData.sale_price}
                    onChange={handleInputChange}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Aktueller Restwert (EUR)
                  </label>
                  <input
                    type="number"
                    name="current_value"
                    value={formData.current_value}
                    onChange={handleInputChange}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Daten */}
                <div className="col-span-2">
                  <h4 className="text-md font-semibold text-gray-700 mb-3 border-b pb-2 mt-4">
                    Daten und Termine
                  </h4>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kaufdatum
                  </label>
                  <input
                    type="date"
                    name="purchase_date"
                    value={formData.purchase_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Erwartetes Lieferdatum
                  </label>
                  <input
                    type="date"
                    name="expected_delivery_date"
                    value={formData.expected_delivery_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tatsächliches Lieferdatum
                  </label>
                  <input
                    type="date"
                    name="actual_delivery_date"
                    value={formData.actual_delivery_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Garantiezeitraum (Monate)
                  </label>
                  <input
                    type="number"
                    name="warranty_months"
                    value={formData.warranty_months}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Notizen */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notizen
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Aktiv</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingAsset ? 'Aktualisieren' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assets;
