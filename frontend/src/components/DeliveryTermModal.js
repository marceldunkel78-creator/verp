import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const DeliveryTermModal = ({ isOpen, onClose, onSave, editingItem }) => {
  const [formData, setFormData] = useState({
    incoterm: '',
    description: '',
    is_active: true
  });

  const INCOTERM_CHOICES = [
    { value: 'EXW', label: 'EXW - Ex Works (ab Werk)' },
    { value: 'FCA', label: 'FCA - Free Carrier (frei Frachtführer)' },
    { value: 'CPT', label: 'CPT - Carriage Paid To (frachtfrei)' },
    { value: 'CIP', label: 'CIP - Carriage and Insurance Paid To (frachtfrei versichert)' },
    { value: 'DAP', label: 'DAP - Delivered at Place (geliefert benannter Ort)' },
    { value: 'DPU', label: 'DPU - Delivered at Place Unloaded (geliefert benannter Ort entladen)' },
    { value: 'DDP', label: 'DDP - Delivered Duty Paid (geliefert verzollt)' },
    { value: 'FAS', label: 'FAS - Free Alongside Ship (frei Längsseite Schiff)' },
    { value: 'FOB', label: 'FOB - Free on Board (frei an Bord)' },
    { value: 'CFR', label: 'CFR - Cost and Freight (Kosten und Fracht)' },
    { value: 'CIF', label: 'CIF - Cost, Insurance and Freight (Kosten, Versicherung und Fracht)' }
  ];

  useEffect(() => {
    if (editingItem) {
      setFormData(editingItem);
    } else {
      setFormData({
        incoterm: '',
        description: '',
        is_active: true
      });
    }
  }, [editingItem, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.incoterm) {
      alert('Bitte wählen Sie einen Incoterm aus');
      return;
    }

    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            {editingItem ? 'Lieferbedingung bearbeiten' : 'Neue Lieferbedingung'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Incoterm *</label>
              <select
                value={formData.incoterm}
                onChange={(e) => setFormData({ ...formData, incoterm: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={!!editingItem} // Incoterm kann nicht geändert werden (ist unique)
              >
                <option value="">Bitte wählen...</option>
                {INCOTERM_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
              {editingItem && (
                <p className="mt-1 text-xs text-gray-500">
                  Der Incoterm kann nach dem Erstellen nicht mehr geändert werden
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Beschreibung / Notizen</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="4"
                placeholder="Zusätzliche Hinweise zu diesem Incoterm..."
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                <span className="ml-2 text-sm text-gray-700">Aktiv (für Lieferantenauswahl verfügbar)</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
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

export default DeliveryTermModal;
