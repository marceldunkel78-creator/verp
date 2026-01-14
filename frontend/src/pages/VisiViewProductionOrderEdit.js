import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import CustomerSearch from '../components/CustomerSearch';
import CustomerOrderSearch from '../components/CustomerOrderSearch';
import VisiViewLicenseSearch from '../components/VisiViewLicenseSearch';
import {
  ArrowLeftIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

const VisiViewProductionOrderEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [productionOrder, setProductionOrder] = useState({
    customer_order: null,
    customer: null,
    status: 'DRAFT',
    processing_type: 'NEW_LICENSE',
    target_license: null,
    notes: ''
  });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);

  // New License Form
  const [newLicenseForm, setNewLicenseForm] = useState({
    serial_number: '',
    internal_serial: '',
    version: '',
    delivery_date: new Date().toISOString().split('T')[0]
  });

  // Extend License Form
  const [extendLicenseForm, setExtendLicenseForm] = useState({
    update_major_version: false,
    new_version: ''
  });

  useEffect(() => {
    if (!isNew) {
      fetchProductionOrder();
    }
  }, [id]);

  // Auto-fill next serial number when creating a new license
  useEffect(() => {
    const shouldSuggestSerial =
      !isNew &&
      productionOrder?.processing_type === 'NEW_LICENSE' &&
      productionOrder?.status !== 'COMPLETED' &&
      productionOrder?.status !== 'CANCELLED' &&
      !newLicenseForm.serial_number;

    if (shouldSuggestSerial) {
      (async () => {
        try {
          const res = await api.get('/visiview/licenses/next_serial/');
          const suggested = res?.data?.next_serial;
          if (suggested) {
            setNewLicenseForm((prev) => ({ ...prev, serial_number: prev.serial_number || suggested }));
          }
        } catch (e) {
          // Silently ignore if suggestion fails
          console.error('Failed to fetch next serial suggestion', e);
        }
      })();
    }
  }, [isNew, productionOrder.processing_type, productionOrder.status, newLicenseForm.serial_number]);

  const fetchProductionOrder = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/visiview/production-orders/${id}/`);
      setProductionOrder(response.data);
      setItems(response.data.items || []);
    } catch (error) {
      console.error('Error fetching production order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (isNew) {
        const response = await api.post('/visiview/production-orders/', productionOrder);
        navigate(`/visiview/production-orders/${response.data.id}`);
      } else {
        await api.patch(`/visiview/production-orders/${id}/`, productionOrder);
        await fetchProductionOrder();
      }
    } catch (error) {
      console.error('Error saving production order:', error);
      alert('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleProcessNewLicense = async () => {
    if (!window.confirm('Möchten Sie eine neue Lizenz erstellen?')) return;

    try {
      setProcessing(true);
      const response = await api.post(`/visiview/production-orders/${id}/process_new_license/`, {
        license_data: newLicenseForm
      });
      alert(response.data.message);
      navigate(`/visiview/licenses/${response.data.license.id}`);
    } catch (error) {
      console.error('Error processing new license:', error);
      alert('Fehler beim Erstellen der Lizenz');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessExtendLicense = async () => {
    if (!window.confirm('Möchten Sie die Lizenz erweitern?')) return;

    try {
      setProcessing(true);
      const response = await api.post(`/visiview/production-orders/${id}/process_extend_license/`, extendLicenseForm);
      alert(response.data.message);
      if (response.data.license) {
        navigate(`/visiview/licenses/${response.data.license.id}`);
      }
    } catch (error) {
      console.error('Error extending license:', error);
      alert('Fehler beim Erweitern der Lizenz');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessMaintenanceCredit = async () => {
    if (!window.confirm('Möchten Sie die Maintenance-Gutschrift hinzufügen?')) return;

    try {
      setProcessing(true);
      const response = await api.post(`/visiview/production-orders/${id}/process_maintenance_credit/`);
      alert(response.data.message);
      if (response.data.license) {
        navigate(`/visiview/licenses/${response.data.license.id}`);
      }
    } catch (error) {
      console.error('Error processing maintenance credit:', error);
      alert('Fehler beim Hinzufügen der Maintenance-Gutschrift');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Möchten Sie den Fertigungsauftrag wirklich stornieren?')) return;

    try {
      const response = await api.post(`/visiview/production-orders/${id}/cancel/`);
      alert(response.data.message);
      await fetchProductionOrder();
    } catch (error) {
      console.error('Error cancelling production order:', error);
      alert('Fehler beim Stornieren');
    }
  };

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
            onClick={() => navigate('/visiview/production-orders')}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNew ? 'Neuer Fertigungsauftrag' : productionOrder.order_number}
          </h1>
        </div>
        
        <div className="flex gap-2">
          {!isNew && productionOrder.status !== 'COMPLETED' && productionOrder.status !== 'CANCELLED' && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <XMarkIcon className="h-5 w-5 inline mr-2" />
              Stornieren
            </button>
          )}
          
          <button
            onClick={handleSave}
            disabled={saving || productionOrder.status === 'COMPLETED'}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300"
          >
            <CheckIcon className="h-5 w-5 mr-2" />
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Auftragsdaten</h2>
        
        {(() => { /* Determine editability for form fields */ })()}
        { /* Editable in new orders or when status is DRAFT */ }
        { /* eslint-disable-next-line */ }
        { /* no-op to keep JSX valid */ }
        { /* compute isEditable inline */ }
        { /* this avoids adding extra state */ }

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kunde *
            </label>
            <CustomerSearch
              value={productionOrder.customer}
              onChange={(customerId, customerData) => {
                setProductionOrder({
                  ...productionOrder,
                  customer: customerId
                });
              }}
              disabled={!(isNew || productionOrder.status === 'DRAFT')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kundenauftrag *
            </label>
            <CustomerOrderSearch
              value={productionOrder.customer_order}
              onChange={(orderId, orderData) => {
                setProductionOrder({
                  ...productionOrder,
                  customer_order: orderId,
                  customer: orderData?.customer || productionOrder.customer
                });
              }}
              customerId={productionOrder.customer}
              disabled={!(isNew || productionOrder.status === 'DRAFT')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bearbeitungstyp *
            </label>
            <select
              value={productionOrder.processing_type}
              onChange={(e) => setProductionOrder({ ...productionOrder, processing_type: e.target.value })}
              disabled={!(isNew || productionOrder.status === 'DRAFT')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            >
              <option value="NEW_LICENSE">Neue Lizenz</option>
              <option value="EXTEND_LICENSE">Lizenz erweitern</option>
              <option value="MAINTENANCE_CREDIT">Maintenance-Gutschrift</option>
            </select>
          </div>

          {productionOrder.processing_type !== 'NEW_LICENSE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ziel-Lizenz *
              </label>
              <VisiViewLicenseSearch
                value={productionOrder.target_license}
                onChange={(licenseId, licenseData) => {
                  setProductionOrder({
                    ...productionOrder,
                    target_license: licenseId
                  });
                }}
                disabled={!(isNew || productionOrder.status === 'DRAFT')}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={productionOrder.status}
              onChange={(e) => setProductionOrder({ ...productionOrder, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="DRAFT">Entwurf</option>
              <option value="IN_PROGRESS">In Bearbeitung</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notizen
            </label>
            <textarea
              value={productionOrder.notes}
              onChange={(e) => setProductionOrder({ ...productionOrder, notes: e.target.value })}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Processing Section */}
      {!isNew && productionOrder.status !== 'COMPLETED' && productionOrder.status !== 'CANCELLED' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Verarbeitung</h2>

          {productionOrder.processing_type === 'NEW_LICENSE' && (
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900">Neue Lizenz erstellen</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seriennummer *
                  </label>
                  <input
                    type="text"
                    value={newLicenseForm.serial_number}
                    onChange={(e) => setNewLicenseForm({ ...newLicenseForm, serial_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interne Seriennummer
                  </label>
                  <input
                    type="text"
                    value={newLicenseForm.internal_serial}
                    onChange={(e) => setNewLicenseForm({ ...newLicenseForm, internal_serial: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    value={newLicenseForm.version}
                    onChange={(e) => setNewLicenseForm({ ...newLicenseForm, version: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lieferdatum
                  </label>
                  <input
                    type="date"
                    value={newLicenseForm.delivery_date}
                    onChange={(e) => setNewLicenseForm({ ...newLicenseForm, delivery_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <button
                onClick={handleProcessNewLicense}
                disabled={processing || !newLicenseForm.serial_number}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
              >
                <CheckIcon className="h-5 w-5 mr-2" />
                {processing ? 'Verarbeite...' : 'Lizenz erstellen'}
              </button>
            </div>
          )}

          {productionOrder.processing_type === 'EXTEND_LICENSE' && (
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900">Lizenz erweitern</h3>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={extendLicenseForm.update_major_version}
                    onChange={(e) => setExtendLicenseForm({
                      ...extendLicenseForm,
                      update_major_version: e.target.checked
                    })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Major Version Update durchführen</span>
                </label>
                
                {extendLicenseForm.update_major_version && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Neue Version *
                    </label>
                    <input
                      type="text"
                      value={extendLicenseForm.new_version}
                      onChange={(e) => setExtendLicenseForm({ ...extendLicenseForm, new_version: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="z.B. 7.0"
                    />
                  </div>
                )}
              </div>
              <button
                onClick={handleProcessExtendLicense}
                disabled={processing}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
              >
                <CheckIcon className="h-5 w-5 mr-2" />
                {processing ? 'Verarbeite...' : 'Lizenz erweitern'}
              </button>
            </div>
          )}

          {productionOrder.processing_type === 'MAINTENANCE_CREDIT' && (
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900">Maintenance-Gutschrift hinzufügen</h3>
              <p className="text-sm text-gray-600">
                Die Maintenance-Gutschriften werden basierend auf den hinterlegten Maintenance-Monaten der Positionen erstellt.
              </p>
              <button
                onClick={handleProcessMaintenanceCredit}
                disabled={processing}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
              >
                <CheckIcon className="h-5 w-5 mr-2" />
                {processing ? 'Verarbeite...' : 'Maintenance-Gutschrift hinzufügen'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VisiViewProductionOrderEdit;
