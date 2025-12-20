import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const DeliveryInstructionModal = ({ isOpen, onClose, onSave, editingItem }) => {
  const [formData, setFormData] = useState({
    name: '',
    instruction_text: '',
    is_active: true
  });

  useEffect(() => {
    if (editingItem) {
      setFormData(editingItem);
    } else {
      setFormData({
        name: '',
        instruction_text: '',
        is_active: true
      });
    }
  }, [editingItem, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Bitte geben Sie einen Namen an');
      return;
    }

    if (!formData.instruction_text.trim()) {
      alert('Bitte geben Sie eine Lieferanweisung ein');
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
            {editingItem ? 'Lieferanweisung bearbeiten' : 'Neue Lieferanweisung'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="z.B. Lieferung an Lager, Lieferung an Baustelle..."
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Kurze Bezeichnung zur Identifikation der Lieferanweisung
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Lieferanweisung *</label>
              <textarea
                value={formData.instruction_text}
                onChange={(e) => setFormData({ ...formData, instruction_text: e.target.value })}
                rows="8"
                placeholder={`Beispiel:
Lieferung erfolgt an unser Lager:
Musterfirma GmbH
Lagerstraße 123
12345 Musterstadt

Öffnungszeiten: Mo-Fr 8:00-16:00 Uhr
Ansprechpartner: Max Mustermann
Tel: +49 123 456789

Bitte Lieferung 2 Tage vorher anmelden.`}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Vollständige Lieferanweisung mit allen relevanten Details (Adresse, Öffnungszeiten, Ansprechpartner, etc.)
              </p>
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

export default DeliveryInstructionModal;
