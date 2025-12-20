import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const PaymentTermModal = ({ isOpen, onClose, onSave, editingItem }) => {
  const [formData, setFormData] = useState({
    name: '',
    is_prepayment: false,
    payment_days: '',
    discount_days: '',
    discount_percent: '',
    has_custom_terms: false,
    down_payment_percent: '',
    down_payment_description: '',
    delivery_payment_percent: '',
    delivery_payment_description: '',
    acceptance_payment_percent: '',
    acceptance_payment_description: '',
    notes: '',
    is_active: true
  });

  useEffect(() => {
    if (editingItem) {
      setFormData(editingItem);
    } else {
      setFormData({
        name: '',
        is_prepayment: false,
        payment_days: '',
        discount_days: '',
        discount_percent: '',
        has_custom_terms: false,
        down_payment_percent: '',
        down_payment_description: '',
        delivery_payment_percent: '',
        delivery_payment_description: '',
        acceptance_payment_percent: '',
        acceptance_payment_description: '',
        notes: '',
        is_active: true
      });
    }
  }, [editingItem, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validierung
    if (!formData.name.trim()) {
      alert('Bitte geben Sie einen Namen an');
      return;
    }

    // Bei Custom-Terms: Prozente müssen 100% ergeben
    if (formData.has_custom_terms) {
      const total = 
        parseFloat(formData.down_payment_percent || 0) +
        parseFloat(formData.delivery_payment_percent || 0) +
        parseFloat(formData.acceptance_payment_percent || 0);
      
      if (Math.abs(total - 100) > 0.01) {
        alert(`Die Zahlungsanteile müssen 100% ergeben (aktuell: ${total}%)`);
        return;
      }
    }

    // Daten vorbereiten: leere Strings zu null konvertieren
    const dataToSave = {
      ...formData,
      payment_days: formData.payment_days === '' ? null : formData.payment_days,
      discount_days: formData.discount_days === '' ? null : formData.discount_days,
      discount_percent: formData.discount_percent === '' ? null : formData.discount_percent,
      down_payment_percent: formData.down_payment_percent === '' ? null : formData.down_payment_percent,
      delivery_payment_percent: formData.delivery_payment_percent === '' ? null : formData.delivery_payment_percent,
      acceptance_payment_percent: formData.acceptance_payment_percent === '' ? null : formData.acceptance_payment_percent,
    };

    onSave(dataToSave);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            {editingItem ? 'Zahlungsbedingung bearbeiten' : 'Neue Zahlungsbedingung'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Grunddaten */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Aktiv</span>
              </label>
            </div>
          </div>

          {/* Zahlungstyp */}
          <div className="mb-6 p-4 bg-gray-50 rounded-md">
            <h4 className="font-medium text-gray-900 mb-3">Zahlungstyp</h4>
            
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_prepayment}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    is_prepayment: e.target.checked,
                    has_custom_terms: false
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Vorkasse</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.has_custom_terms}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    has_custom_terms: e.target.checked,
                    is_prepayment: false
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Individuelle Zahlungsziele (3-teilig)</span>
              </label>
            </div>
          </div>

          {/* Vorkasse Hinweis */}
          {formData.is_prepayment && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Vorkasse:</strong> Zahlung erfolgt vor Lieferung. Keine weiteren Zahlungsziele erforderlich.
              </p>
            </div>
          )}

          {/* Standard-Zahlungsbedingungen */}
          {!formData.is_prepayment && !formData.has_custom_terms && (
            <div className="mb-6 p-4 bg-blue-50 rounded-md">
              <h4 className="font-medium text-gray-900 mb-3">Standard-Zahlungsbedingungen</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Zahlungsfrist (Tage)</label>
                  <input
                    type="number"
                    value={formData.payment_days || ''}
                    onChange={(e) => setFormData({ ...formData, payment_days: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Skontofrist (Tage)</label>
                  <input
                    type="number"
                    value={formData.discount_days || ''}
                    onChange={(e) => setFormData({ ...formData, discount_days: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Skonto (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discount_percent || ''}
                    onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Custom-Zahlungsziele (3-teilig) */}
          {formData.has_custom_terms && (
            <div className="mb-6 p-4 bg-green-50 rounded-md">
              <h4 className="font-medium text-gray-900 mb-3">Individuelle Zahlungsziele (müssen 100% ergeben)</h4>
              
              <div className="space-y-4">
                {/* Anzahlung */}
                <div className="border-b border-green-200 pb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">1. Anzahlung</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600">Prozent</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.down_payment_percent}
                        onChange={(e) => setFormData({ ...formData, down_payment_percent: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600">Beschreibung</label>
                      <input
                        type="text"
                        value={formData.down_payment_description}
                        onChange={(e) => setFormData({ ...formData, down_payment_description: e.target.value })}
                        placeholder="z.B. bei Auftragsbestätigung"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Zahlung bei Lieferung */}
                <div className="border-b border-green-200 pb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">2. Zahlung bei Lieferung</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600">Prozent</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.delivery_payment_percent}
                        onChange={(e) => setFormData({ ...formData, delivery_payment_percent: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600">Beschreibung</label>
                      <input
                        type="text"
                        value={formData.delivery_payment_description}
                        onChange={(e) => setFormData({ ...formData, delivery_payment_description: e.target.value })}
                        placeholder="z.B. bei Warenübergabe"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Zahlung bei Abnahme */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">3. Zahlung bei Abnahme</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600">Prozent</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.acceptance_payment_percent}
                        onChange={(e) => setFormData({ ...formData, acceptance_payment_percent: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600">Beschreibung</label>
                      <input
                        type="text"
                        value={formData.acceptance_payment_description}
                        onChange={(e) => setFormData({ ...formData, acceptance_payment_description: e.target.value })}
                        placeholder="z.B. nach Abnahmeprotokoll"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Summen-Anzeige */}
                <div className="pt-2">
                  <div className="text-sm font-medium text-gray-700">
                    Summe: {
                      (parseFloat(formData.down_payment_percent || 0) +
                      parseFloat(formData.delivery_payment_percent || 0) +
                      parseFloat(formData.acceptance_payment_percent || 0)).toFixed(2)
                    }%
                    {Math.abs(
                      parseFloat(formData.down_payment_percent || 0) +
                      parseFloat(formData.delivery_payment_percent || 0) +
                      parseFloat(formData.acceptance_payment_percent || 0) - 100
                    ) > 0.01 && (
                      <span className="ml-2 text-red-600">(muss 100% ergeben)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notizen */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">Notizen</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentTermModal;
