import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  PlusIcon, PencilIcon, TrashIcon, 
  BanknotesIcon, TruckIcon, DocumentTextIcon
} from '@heroicons/react/24/outline';
import PaymentTermModal from '../components/PaymentTermModal';
import DeliveryTermModal from '../components/DeliveryTermModal';
import DeliveryInstructionModal from '../components/DeliveryInstructionModal';

const PaymentDeliverySettings = () => {
  const [activeTab, setActiveTab] = useState('payment');
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [deliveryTerms, setDeliveryTerms] = useState([]);
  const [deliveryInstructions, setDeliveryInstructions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalType, setModalType] = useState('payment');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentRes, deliveryTermsRes, deliveryInstRes] = await Promise.all([
        api.get('/settings/payment-terms/'),
        api.get('/settings/delivery-terms/'),
        api.get('/settings/delivery-instructions/')
      ]);
      // Handle paginated responses
      setPaymentTerms(paymentRes.data.results || paymentRes.data);
      setDeliveryTerms(deliveryTermsRes.data.results || deliveryTermsRes.data);
      setDeliveryInstructions(deliveryInstRes.data.results || deliveryInstRes.data);
    } catch (error) {
      console.error('Fehler beim Laden der Einstellungen:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSave = async (data) => {
    try {
      const endpoint = {
        payment: '/settings/payment-terms/',
        deliveryTerm: '/settings/delivery-terms/',
        deliveryInstruction: '/settings/delivery-instructions/'
      }[modalType];

      if (editingItem) {
        await api.put(`${endpoint}${editingItem.id}/`, data);
      } else {
        await api.post(endpoint, data);
      }
      
      fetchData();
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern: ' + JSON.stringify(error.response?.data));
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Wirklich löschen?')) return;

    try {
      const endpoint = {
        payment: '/settings/payment-terms/',
        deliveryTerm: '/settings/delivery-terms/',
        deliveryInstruction: '/settings/delivery-instructions/'
      }[type];

      await api.delete(`${endpoint}${id}/`);
      fetchData();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen');
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Zahlungs- und Lieferbedingungen</h1>
        <p className="mt-2 text-sm text-gray-600">
          Verwaltung von Zahlungsbedingungen, Incoterms und Lieferanweisungen
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="tab-scroll -mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('payment')}
            className={`${
              activeTab === 'payment'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <BanknotesIcon className="h-5 w-5 mr-2" />
            Zahlungsbedingungen
          </button>
          <button
            onClick={() => setActiveTab('deliveryTerms')}
            className={`${
              activeTab === 'deliveryTerms'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <TruckIcon className="h-5 w-5 mr-2" />
            Lieferbedingungen (Incoterms)
          </button>
          <button
            onClick={() => setActiveTab('deliveryInstructions')}
            className={`${
              activeTab === 'deliveryInstructions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <DocumentTextIcon className="h-5 w-5 mr-2" />
            Lieferanweisungen
          </button>
        </nav>
      </div>

      {/* Payment Terms Tab */}
      {activeTab === 'payment' && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Zahlungsbedingungen</h2>
            <button
              onClick={() => openModal('payment')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Neue Zahlungsbedingung
            </button>
          </div>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {paymentTerms.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <p>Keine Zahlungsbedingungen vorhanden.</p>
                <p className="text-sm mt-2">Klicken Sie auf "Neue Zahlungsbedingung", um eine anzulegen.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {paymentTerms.map((term) => (
                  <li key={term.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{term.name}</h3>
                        <p className="mt-1 text-sm text-gray-600">{term.formatted_terms}</p>
                        {!term.is_active && (
                          <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inaktiv
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openModal('payment', term)}
                          className="p-2 text-blue-600 hover:text-blue-900"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete('payment', term.id)}
                          className="p-2 text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Delivery Terms (Incoterms) Tab */}
      {activeTab === 'deliveryTerms' && (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Lieferbedingungen (Incoterms 2020)</h2>
            <p className="text-sm text-gray-600 mt-1">
              Aktivieren/Deaktivieren Sie die gewünschten Incoterms für die Lieferantenauswahl
            </p>
          </div>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {deliveryTerms.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <p>Keine Lieferbedingungen (Incoterms) vorhanden.</p>
                <p className="text-sm mt-2">Die Incoterms sollten automatisch bei der Initialisierung angelegt worden sein.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {deliveryTerms.map((term) => (
                  <li key={term.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{term.incoterm_display}</h3>
                        {term.description && (
                          <p className="mt-1 text-sm text-gray-600">{term.description}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={term.is_active}
                            onChange={async (e) => {
                              await api.patch(`/settings/delivery-terms/${term.id}/`, {
                                is_active: e.target.checked
                              });
                              fetchData();
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Aktiv</span>
                        </label>
                        <button
                          onClick={() => openModal('deliveryTerm', term)}
                          className="p-2 text-blue-600 hover:text-blue-900"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Delivery Instructions Tab */}
      {activeTab === 'deliveryInstructions' && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Lieferanweisungen</h2>
            <button
              onClick={() => openModal('deliveryInstruction')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Neue Lieferanweisung
            </button>
          </div>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {deliveryInstructions.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <p>Keine Lieferanweisungen vorhanden.</p>
                <p className="text-sm mt-2">Klicken Sie auf "Neue Lieferanweisung", um eine anzulegen.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {deliveryInstructions.map((instruction) => (
                  <li key={instruction.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{instruction.name}</h3>
                        <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">
                          {instruction.instruction_text}
                        </p>
                        {!instruction.is_active && (
                          <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inaktiv
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openModal('deliveryInstruction', instruction)}
                          className="p-2 text-blue-600 hover:text-blue-900"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete('deliveryInstruction', instruction.id)}
                          className="p-2 text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {isModalOpen && modalType === 'payment' && (
        <PaymentTermModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSave}
          editingItem={editingItem}
        />
      )}

      {isModalOpen && modalType === 'deliveryTerm' && (
        <DeliveryTermModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSave}
          editingItem={editingItem}
        />
      )}

      {isModalOpen && modalType === 'deliveryInstruction' && (
        <DeliveryInstructionModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSave}
          editingItem={editingItem}
        />
      )}
    </div>
  );
};

export default PaymentDeliverySettings;