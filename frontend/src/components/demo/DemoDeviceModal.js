import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { DEVICE_TYPES, STATUS_STYLES } from './DemoSetupDiagram';

// ---------------------------------------------------------------------------
// Komponenten-Typen: Wechsler = Positionslisten (1-10), Shutter = Name,
// Slider = Name, custom = Name/Wert
// ---------------------------------------------------------------------------

export const COMPONENT_TYPES = [
  { value: 'filter_wheel', label: 'Filterrad', isChanger: true },
  { value: 'objective_changer', label: 'Objektivwechsler', isChanger: true },
  { value: 'light_path_changer', label: 'Lichtwegwechsler (motorisiert)', isChanger: true },
  { value: 'card_changer', label: 'Einsteckkarten-Wechsler', isChanger: true },
  { value: 'shutter', label: 'Shutter', isChanger: false },
  { value: 'slider', label: 'Slider (Intensitätsregler)', isChanger: false },
  { value: 'custom', label: 'Benutzerdefiniert', isChanger: false },
];

const MAX_SLOTS = 10;

const emptySlots = () => ({ slots: [] });

const normalizeSlots = (slotsData) => {
  const arr = (slotsData && Array.isArray(slotsData.slots)) ? slotsData.slots : [];
  return arr.slice(0, MAX_SLOTS).map((s, i) => ({
    position: s.position || i + 1,
    label: s.label || '',
    comment: s.comment || '',
  }));
};

// ---------------------------------------------------------------------------
// Slot-Editor für Wechsler-Komponenten (1-10 Positionen)
// ---------------------------------------------------------------------------

const SlotEditor = ({ slots, onChange }) => {
  const addSlot = () => {
    if (slots.length >= MAX_SLOTS) return;
    onChange([...slots, { position: slots.length + 1, label: '', comment: '' }]);
  };

  const updateSlot = (idx, field, value) => {
    const next = slots.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
    onChange(next);
  };

  const removeSlot = (idx) => {
    onChange(slots.filter((_, i) => i !== idx).map((s, i) => ({ ...s, position: i + 1 })));
  };

  return (
    <div className="border rounded-lg p-2 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600">Belegung (Position 1–{MAX_SLOTS})</span>
        <button
          type="button"
          onClick={addSlot}
          disabled={slots.length >= MAX_SLOTS}
          className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          + Position
        </button>
      </div>
      {slots.length === 0 && (
        <p className="text-xs text-gray-400 italic">Noch keine Positionen belegt.</p>
      )}
      <div className="space-y-1.5">
        {slots.map((slot, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded text-xs font-bold text-gray-600">
              {slot.position}
            </span>
            <input
              type="text"
              value={slot.label}
              onChange={(e) => updateSlot(idx, 'label', e.target.value)}
              placeholder="z.B. DAPI, GFP, 10x, Kamera-Interface..."
              className="flex-1 px-2 py-1 border rounded text-sm"
            />
            <input
              type="text"
              value={slot.comment}
              onChange={(e) => updateSlot(idx, 'comment', e.target.value)}
              placeholder="Kommentar"
              className="w-32 px-2 py-1 border rounded text-sm"
            />
            <button
              type="button"
              onClick={() => removeSlot(idx)}
              className="text-red-500 hover:text-red-700 text-sm px-1"
              title="Position entfernen"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Komponenten-Zeile (eine Komponente eines Geräts)
// ---------------------------------------------------------------------------

const ComponentEditor = ({ component, onChange, onRemove }) => {
  const typeInfo = COMPONENT_TYPES.find((t) => t.value === component.component_type) || COMPONENT_TYPES[6];
  const slots = normalizeSlots(component.slots);

  return (
    <div className="border rounded-lg p-3 bg-white space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={component.component_type}
          onChange={(e) => onChange({ ...component, component_type: e.target.value, slots: emptySlots() })}
          className="px-2 py-1.5 border rounded text-sm bg-gray-50"
        >
          {COMPONENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={component.name}
          onChange={(e) => onChange({ ...component, name: e.target.value })}
          placeholder="Bezeichnung (Pflicht, z.B. Filterrad 1, Shutter ExC, Intensität)"
          className={`flex-1 px-2 py-1.5 border rounded text-sm ${!component.name || !component.name.trim() ? 'border-red-300 bg-red-50' : ''}`}
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-red-500 hover:text-red-700 px-2"
          title="Komponente entfernen"
        >
          ✕
        </button>
      </div>
      {(!component.name || !component.name.trim()) && (
        <p className="text-xs text-red-600">⚠ Bitte eine Bezeichnung eingeben — dieses Feld ist Pflicht.</p>
      )}

      {typeInfo.isChanger ? (
        <SlotEditor slots={slots} onChange={(next) => onChange({ ...component, slots: { slots: next } })} />
      ) : component.component_type === 'custom' ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={component.value}
            onChange={(e) => onChange({ ...component, value: e.target.value })}
            placeholder="Wert"
            className="w-40 px-2 py-1 border rounded text-sm"
          />
          <input
            type="text"
            value={component.comment}
            onChange={(e) => onChange({ ...component, comment: e.target.value })}
            placeholder="Kommentar"
            className="flex-1 px-2 py-1 border rounded text-sm"
          />
        </div>
      ) : (
        /* Shutter / Slider: nur Name (ggf. Kommentar) */
        <input
          type="text"
          value={component.comment}
          onChange={(e) => onChange({ ...component, comment: e.target.value })}
          placeholder="Kommentar (optional)"
          className="w-full px-2 py-1 border rounded text-sm"
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Eigenschaften-Editor (Key/Value, z.B. PC: OS/CPU/RAM)
// ---------------------------------------------------------------------------

const PropertiesEditor = ({ properties, onChange }) => {
  const entries = Object.entries(properties || {});

  const updateEntry = (idx, key, value) => {
    const next = entries.map((e, i) => (i === idx ? [key, value] : e));
    onChange(Object.fromEntries(next));
  };

  const removeEntry = (idx) => {
    onChange(Object.fromEntries(entries.filter((_, i) => i !== idx)));
  };

  return (
    <div className="border rounded-lg p-2 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600">Grundeigenschaften</span>
        <button
          type="button"
          onClick={() => onChange({ ...properties, '': '' })}
          className="text-xs px-2 py-1 bg-blue-600 text-white rounded"
        >
          + Eigenschaft
        </button>
      </div>
      {entries.length === 0 && (
        <p className="text-xs text-gray-400 italic">Keine Eigenschaften (z.B. bei PC: OS, CPU, RAM).</p>
      )}
      <div className="space-y-1.5">
        {entries.map(([key, value], idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={key}
              onChange={(e) => updateEntry(idx, e.target.value, value)}
              placeholder="Name (z.B. OS)"
              className="w-40 px-2 py-1 border rounded text-sm"
            />
            <input
              type="text"
              value={value}
              onChange={(e) => updateEntry(idx, key, e.target.value)}
              placeholder="Wert (z.B. Windows 11 Pro)"
              className="flex-1 px-2 py-1 border rounded text-sm"
            />
            <button
              type="button"
              onClick={() => removeEntry(idx)}
              className="text-red-500 hover:text-red-700 text-sm px-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Lagerartikel-Suche (einfache Suche nach Lager-Nr/Name)
// ---------------------------------------------------------------------------

const InventorySearch = ({ value, display, onChange }) => {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (term.length < 2) { setResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/inventory/inventory-items/?search=${encodeURIComponent(term)}&page_size=20`);
        if (!cancelled) {
          setResults(res.data.results || res.data);
          setOpen(true);
        }
      } catch (e) { /* ignore */ }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [term]);

  return (
    <div className="relative">
      {value ? (
        <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-green-50 text-sm">
          <span className="font-medium text-green-800">{display || `Lagerartikel #${value}`}</span>
          <button type="button" onClick={() => onChange(null, null, null)} className="ml-auto text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder="Lagerartikel suchen (Lager-Nr oder Name, ab 2 Zeichen)..."
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          {open && results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(
                      item.id,
                      `${item.inventory_number} – ${item.name}`,
                      item.serial_number || null
                    );
                    setOpen(false);
                    setTerm('');
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                >
                  <span className="font-mono text-xs text-gray-500">{item.inventory_number}</span> {item.name}
                  {item.serial_number && (
                    <span className="ml-2 text-xs text-gray-400">SN: {item.serial_number}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Haupt-Modal
// ---------------------------------------------------------------------------

const DemoDeviceModal = ({ device, isNew, onSave, onClose, onDelete }) => {
  const [form, setForm] = useState(() => ({
    name: '',
    device_type: 'custom',
    manufacturer: '',
    serial_number: '',
    status: 'active',
    notes: '',
    properties: {},
    inventory_item: null,
    inventory_item_display: null,
    components: [],
  }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (device) {
      setForm({
        name: device.name || '',
        device_type: device.device_type || 'custom',
        manufacturer: device.manufacturer || '',
        serial_number: device.serial_number || '',
        status: device.status || 'active',
        notes: device.notes || '',
        properties: device.properties || {},
        inventory_item: device.inventory_item || null,
        inventory_item_display: device.inventory_item_display || null,
        components: (device.components || []).map((c) => ({
          id: c.id,
          component_type: c.component_type,
          name: c.name,
          slots: c.slots || { slots: [] },
          value: c.value || '',
          comment: c.comment || '',
        })),
      });
    }
  }, [device]);

  const updateComponent = useCallback((idx, next) => {
    setForm((f) => ({
      ...f,
      components: f.components.map((c, i) => (i === idx ? next : c)),
    }));
  }, []);

  const removeComponent = useCallback((idx) => {
    setForm((f) => ({ ...f, components: f.components.filter((_, i) => i !== idx) }));
  }, []);

  const addComponent = () => {
    setForm((f) => ({
      ...f,
      components: [
        ...f.components,
        { component_type: 'filter_wheel', name: '', slots: emptySlots(), value: '', comment: '' },
      ],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Bitte eine Bezeichnung eingeben.');
      return;
    }
    // Validierung: jede Komponente braucht eine Bezeichnung
    const missingIdx = form.components.findIndex((c) => !c.name || !c.name.trim());
    if (missingIdx !== -1) {
      alert(
        `Bitte bei Komponente ${missingIdx + 1} eine Bezeichnung eingeben.\n` +
        'Ohne Bezeichnung kann die Komponente nicht gespeichert werden.'
      );
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const typeInfo = DEVICE_TYPES.find((t) => t.value === form.device_type) || DEVICE_TYPES[9];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-start justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-black opacity-50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {isNew ? 'Neues Gerät' : `Gerät bearbeiten: ${device?.name || ''}`}
            </h3>
            <span className={`text-xs font-bold px-2 py-1 rounded ${typeInfo.color}`}>{typeInfo.label}</span>
          </div>

          {/* Basisdaten */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gerätetyp</label>
              <select
                value={form.device_type}
                onChange={(e) => setForm({ ...form, device_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                {DEVICE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hersteller</label>
              <input
                type="text"
                placeholder="Wird bei Lagerartikel-Verknüpfung automatisch übernommen"
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seriennummer</label>
              <input
                type="text"
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                {Object.entries(STATUS_STYLES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lagerartikel (Warenlager)</label>
              <InventorySearch
                value={form.inventory_item}
                display={form.inventory_item_display}
                onChange={(id, display, serialNumber) => {
                  const next = { ...form, inventory_item: id, inventory_item_display: display };
                  if (id && serialNumber && !form.serial_number) {
                    next.serial_number = serialNumber;
                  }
                  setForm(next);
                }}
              />
              {form.inventory_item && form.serial_number && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Seriennummer wurde aus dem Lagerartikel übernommen und kann angepasst werden.
                </p>
              )}
            </div>
          </div>

          {/* Grundeigenschaften (insbesondere PC) */}
          <div className="mb-3">
            <PropertiesEditor
              properties={form.properties}
              onChange={(next) => setForm({ ...form, properties: next })}
            />
          </div>

          {/* Komponenten */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-700">
                Komponenten ({form.components.length})
              </h4>
              <button
                type="button"
                onClick={addComponent}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Komponente
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {form.components.length === 0 && (
                <p className="text-xs text-gray-400 italic">
                  Keine Komponenten. Filterräder, Objektivwechsler, Lichtwege, Einsteckkarten, Shutter oder Slider hinzufügen.
                </p>
              )}
              {form.components.map((comp, idx) => (
                <ComponentEditor
                  key={comp.id || `new-${idx}`}
                  component={comp}
                  onChange={(next) => updateComponent(idx, next)}
                  onRemove={() => removeComponent(idx)}
                />
              ))}
            </div>
          </div>

          {/* Notizen */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {/* Aktionen */}
          <div className="flex items-center justify-between">
            <div>
              {!isNew && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                >
                  Löschen
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoDeviceModal;