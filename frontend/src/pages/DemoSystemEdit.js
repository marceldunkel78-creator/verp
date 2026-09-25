import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import DemoSetupDiagram, { DEVICE_TYPES, STATUS_STYLES, SYSTEM_STATUS_STYLES } from '../components/demo/DemoSetupDiagram';
import DemoDeviceModal from '../components/demo/DemoDeviceModal';
import DemoBookingCalendar from '../components/demo/DemoBookingCalendar';

const TABS = [
  { id: 'setup', name: 'Setup', icon: '◇' },
  { id: 'devices', name: 'Geräte', icon: '▤' },
  { id: 'bookings', name: 'Belegung', icon: '▦' },
  { id: 'changelog', name: 'Änderungsprotokoll', icon: '≡' },
];

const ENTITY_LABELS = {
  system: 'Demo-System',
  device: 'Gerät',
  connection: 'Verbindung',
  component: 'Komponente',
  booking: 'Buchung',
};

const ACTION_STYLES = {
  created: 'bg-green-100 text-green-800',
  updated: 'bg-blue-100 text-blue-800',
  deleted: 'bg-red-100 text-red-800',
  status_changed: 'bg-amber-100 text-amber-800',
  connected: 'bg-purple-100 text-purple-800',
  disconnected: 'bg-gray-100 text-gray-700',
  comment: 'bg-slate-100 text-slate-700',
};

const DemoSystemEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !id;

  const [activeTab, setActiveTab] = useState('setup');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    is_active: true,
    status: 'active',
  });
  const [demoSystem, setDemoSystem] = useState(null); // rohe Detaildaten
  const originalDataRef = useRef(null);

  // Geräte-Modal
  const [deviceModal, setDeviceModal] = useState(null); // { device, isNew, position? }

  // Vorlagen
  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const canWrite = user?.is_superuser || user?.can_write_inventory_demo_systems === true;

  // -------------------------------------------------------------------------
  // Laden
  // -------------------------------------------------------------------------

  const fetchDemoSystem = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const res = await api.get(`/demo-systems/demo-systems/${id}/`);
      setDemoSystem(res.data);
      const fd = {
        name: res.data.name || '',
        description: res.data.description || '',
        location: res.data.location || '',
        status: res.data.status || 'active',
        is_active: res.data.is_active !== false,
      };
      setFormData(fd);
      originalDataRef.current = JSON.stringify(fd);
    } catch (err) {
      console.error('Fehler beim Laden des Demo-Systems:', err);
      setError('Demo-System konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/demo-systems/demo-config-templates/?page_size=1000');
      setTemplates(res.data.results || res.data);
    } catch (err) {
      console.error('Fehler beim Laden der Vorlagen:', err);
    }
  }, []);

  useEffect(() => { fetchDemoSystem(); }, [fetchDemoSystem]);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const hasChanges = originalDataRef.current !== JSON.stringify(formData);

  // -------------------------------------------------------------------------
  // Demo-System speichern
  // -------------------------------------------------------------------------

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Bitte einen Namen eingeben.');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await api.post('/demo-systems/demo-systems/', formData);
        navigate(`/inventory/demo-systems/${res.data.id}`, { replace: true });
      } else {
        await api.patch(`/demo-systems/demo-systems/${id}/`, formData);
        await fetchDemoSystem();
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert('Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  const handleSystemStatusChange = async (newStatus) => {
    try {
      await api.post(`/demo-systems/demo-systems/${id}/set_status/`, { status: newStatus });
      await fetchDemoSystem();
    } catch (err) {
      console.error('Fehler beim Statuswechsel:', err);
      alert('Status konnte nicht geändert werden.');
    }
  };

  // -------------------------------------------------------------------------
  // Geräte-Aktionen
  // -------------------------------------------------------------------------

  const handleDeviceCreate = async (deviceType, x, y) => {
    try {
      const res = await api.post('/demo-systems/demo-devices/', {
        demo_system: Number(id),
        device_type: deviceType,
        name: DEVICE_TYPES.find((t) => t.value === deviceType)?.label || 'Neues Gerät',
        status: 'active',
        position_x: x,
        position_y: y,
      });
      await fetchDemoSystem();
      setDeviceModal({ device: res.data, isNew: true });
    } catch (err) {
      console.error('Fehler beim Anlegen des Geräts:', err);
      alert('Gerät konnte nicht angelegt werden.');
    }
  };

  const handleDeviceMove = async (deviceId, x, y) => {
    try {
      await api.patch(`/demo-systems/demo-devices/${deviceId}/`, { position_x: x, position_y: y });
      // Kein Refetch nötig (Position ist Client-Status), aber Detail-Daten aktuell halten
      setDemoSystem((prev) => prev ? {
        ...prev,
        devices: prev.devices.map((d) => (d.id === deviceId ? { ...d, position_x: x, position_y: y } : d)),
      } : prev);
    } catch (err) {
      console.error('Fehler beim Verschieben:', err);
    }
  };

  const handleDeviceEdit = (device) => {
    setDeviceModal({ device, isNew: false });
  };

  const handleDeviceSave = async (form) => {
    const { device, isNew: deviceIsNew } = deviceModal;
    try {
      let savedDevice;
      const payload = {
        demo_system: Number(id),
        name: form.name,
        device_type: form.device_type,
        manufacturer: form.manufacturer,
        serial_number: form.serial_number,
        status: form.status,
        notes: form.notes,
        properties: form.properties,
        inventory_item: form.inventory_item,
        position_x: device.position_x || 0,
        position_y: device.position_y || 0,
      };
      if (deviceIsNew) {
        const res = await api.patch(`/demo-systems/demo-devices/${device.id}/`, payload);
        savedDevice = res.data;
      } else {
        const res = await api.patch(`/demo-systems/demo-devices/${device.id}/`, payload);
        savedDevice = res.data;
      }

      // Komponenten synchronisieren: vorhandene updaten, neue anlegen, entfernte löschen
      const existing = device.components || [];
      for (const comp of form.components) {
        const compPayload = {
          device: savedDevice.id,
          component_type: comp.component_type,
          name: comp.name,
          slots: comp.slots || { slots: [] },
          value: comp.value || '',
          comment: comp.comment || '',
          position: (form.components.indexOf(comp) + 1),
        };
        if (comp.id) {
          await api.patch(`/demo-systems/demo-device-components/${comp.id}/`, compPayload);
        } else {
          await api.post('/demo-systems/demo-device-components/', compPayload);
        }
      }
      for (const comp of existing) {
        if (!form.components.some((c) => c.id === comp.id)) {
          await api.delete(`/demo-systems/demo-device-components/${comp.id}/`);
        }
      }

      setDeviceModal(null);
      await fetchDemoSystem();
    } catch (err) {
      console.error('Fehler beim Speichern des Geräts:', err);
      alert('Gerät konnte nicht gespeichert werden.');
    }
  };

  const handleDeviceDelete = async () => {
    const { device } = deviceModal;
    if (!window.confirm(`Gerät "${device.name}" wirklich löschen?`)) return;
    try {
      await api.delete(`/demo-systems/demo-devices/${device.id}/`);
      setDeviceModal(null);
      await fetchDemoSystem();
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      alert('Gerät konnte nicht gelöscht werden.');
    }
  };

  const handleDeviceStatus = async (device, newStatus) => {
    try {
      await api.post(`/demo-systems/demo-devices/${device.id}/set_status/`, { status: newStatus });
      await fetchDemoSystem();
    } catch (err) {
      console.error('Fehler beim Statuswechsel:', err);
    }
  };

  // -------------------------------------------------------------------------
  // Verbindungen
  // -------------------------------------------------------------------------

  const handleConnectionCreate = async ({ from_device, from_side, to_device, to_side }) => {
    try {
      await api.post('/demo-systems/demo-connections/', {
        demo_system: Number(id),
        from_device, from_side, to_device, to_side,
      });
      await fetchDemoSystem();
    } catch (err) {
      console.error('Fehler beim Verbinden:', err);
      alert('Verbindung konnte nicht erstellt werden (Andockpunkt evtl. bereits belegt).');
    }
  };

  const handleConnectionDelete = async (connectionId) => {
    try {
      await api.delete(`/demo-systems/demo-connections/${connectionId}/`);
      await fetchDemoSystem();
    } catch (err) {
      console.error('Fehler beim Trennen:', err);
    }
  };

  // -------------------------------------------------------------------------
  // Buchungen
  // -------------------------------------------------------------------------

  const handleSaveBooking = async (form, bookingId) => {
    const payload = {
      demo_system: Number(id),
      title: form.title,
      customer: form.customer,
      start_date: form.start_date,
      end_date: form.end_date,
      notes: form.notes,
      is_cancelled: form.is_cancelled,
    };
    try {
      if (bookingId) {
        await api.patch(`/demo-systems/demo-bookings/${bookingId}/`, payload);
      } else {
        await api.post('/demo-systems/demo-bookings/', payload);
      }
      await fetchDemoSystem();
    } catch (err) {
      console.error('Fehler beim Speichern der Buchung:', err);
      alert('Buchung konnte nicht gespeichert werden.');
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    try {
      await api.delete(`/demo-systems/demo-bookings/${bookingId}/`);
      await fetchDemoSystem();
    } catch (err) {
      console.error('Fehler beim Löschen der Buchung:', err);
    }
  };

  // -------------------------------------------------------------------------
  // Änderungsprotokoll: Kommentar
  // -------------------------------------------------------------------------

  const handleCommentSave = async (logEntry, comment) => {
    try {
      await api.post(`/demo-systems/demo-change-logs/${logEntry.id}/add_comment/`, { comment });
      await fetchDemoSystem();
    } catch (err) {
      console.error('Fehler beim Speichern des Kommentars:', err);
    }
  };

  // -------------------------------------------------------------------------
  // Konfigurationsvorlagen
  // -------------------------------------------------------------------------

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      alert('Bitte einen Namen für die Vorlage eingeben.');
      return;
    }
    try {
      await api.post(`/demo-systems/demo-systems/${id}/save_as_template/`, { name });
      setTemplateName('');
      setShowTemplateMenu(false);
      await fetchTemplates();
      await fetchDemoSystem();
    } catch (err) {
      const detail = err.response?.data?.detail;
      alert(detail || 'Vorlage konnte nicht gespeichert werden.');
    }
  };

  const handleRestoreTemplate = async (templateId) => {
    const template = templates.find((t) => t.id === templateId);
    if (!window.confirm(
      `Vorlage "${template?.name}" wiederherstellen?\n\nDie aktuelle Konfiguration (Geräte, Verbindungen, Komponenten) wird ersetzt.`
    )) return;
    try {
      const res = await api.post(`/demo-systems/demo-systems/${id}/restore_template/`, { template: templateId });
      setDemoSystem(res.data);
      await fetchDemoSystem();
    } catch (err) {
      console.error('Fehler beim Wiederherstellen:', err);
      alert('Vorlage konnte nicht wiederhergestellt werden.');
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Wird geladen...</div>;
  }

  const devices = demoSystem?.devices || [];
  const connections = demoSystem?.connections || [];
  const bookings = demoSystem?.bookings || [];
  const changeLogs = demoSystem?.change_logs || [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/inventory/demo-systems" className="text-sm text-blue-600 hover:underline">
              ← Demo-Systeme
            </Link>
            {!isNew && demoSystem && (
              <span className="text-xs font-mono px-2 py-0.5 bg-gray-100 rounded">{demoSystem.demo_number}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {isNew ? 'Neues Demo-System' : (demoSystem?.name || 'Demo-System')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && canWrite && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                Vorlagen ▾
              </button>
              {showTemplateMenu && (
                <div className="absolute right-0 mt-1 w-72 bg-white border rounded-lg shadow-lg z-30 p-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Konfiguration speichern</div>
                  <div className="flex gap-1 mb-3">
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Name der Vorlage"
                      className="flex-1 px-2 py-1.5 border rounded text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="px-2 py-1.5 bg-blue-600 text-white rounded text-sm"
                    >
                      Sichern
                    </button>
                  </div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Wiederherstellen</div>
                  {templates.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Keine Vorlagen gespeichert.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => { handleRestoreTemplate(t.id); setShowTemplateMenu(false); }}
                          className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 flex items-center justify-between"
                        >
                          <span>
                            {t.is_default && <span className="text-amber-500 mr-1">★</span>}
                            {t.name}
                          </span>
                          <span className="text-xs text-gray-400">{t.device_count} Geräte</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {canWrite && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (!isNew && !hasChanges)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Speichert...' : isNew ? 'Anlegen' : 'Speichern'}
            </button>
          )}
      </div>
          </div>

      {/* Basisdaten */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={!canWrite}
              className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50"
              placeholder="z.B. Demo-Mikroskop 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Standort</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              disabled={!canWrite}
              className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={!canWrite}
              className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gesamt-Status</label>
            {isNew ? (
              <select
                value={formData.status || 'active'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50"
              >
                {Object.entries(SYSTEM_STATUS_STYLES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={demoSystem?.status || 'active'}
                  onChange={(e) => handleSystemStatusChange(e.target.value)}
                  disabled={!canWrite}
                  className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50"
                >
                  {Object.entries(SYSTEM_STATUS_STYLES).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${SYSTEM_STATUS_STYLES[demoSystem?.status || 'active']?.dot}`}
                  title={SYSTEM_STATUS_STYLES[demoSystem?.status || 'active']?.label}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      {!isNew && (
        <>
          <div className="border-b mb-4">
            <nav className="flex gap-4">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 text-sm font-medium border-b-2 -mb-px ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  {tab.name}
                  {tab.id === 'devices' && <span className="ml-1 text-xs text-gray-400">({devices.length})</span>}
                  {tab.id === 'bookings' && <span className="ml-1 text-xs text-gray-400">({bookings.length})</span>}
                  {tab.id === 'changelog' && <span className="ml-1 text-xs text-gray-400">({changeLogs.length})</span>}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab: Setup (Diagramm) */}
          {activeTab === 'setup' && (
            <DemoSetupDiagram
              devices={devices}
              connections={connections}
              onDeviceMove={handleDeviceMove}
              onDeviceCreate={handleDeviceCreate}
              onDeviceEdit={handleDeviceEdit}
              onDeviceDelete={(device) => {
                if (window.confirm(`Gerät "${device.name}" wirklich löschen?`)) {
                  api.delete(`/demo-systems/demo-devices/${device.id}/`).then(fetchDemoSystem);
                }
              }}
              onDeviceStatus={handleDeviceStatus}
              onConnectionCreate={handleConnectionCreate}
              onConnectionDelete={handleConnectionDelete}
              readOnly={!canWrite}
            />
          )}

          {/* Tab: Geräte (Listen-Fallback) */}
          {activeTab === 'devices' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="text-sm font-semibold text-gray-700">Geräte ({devices.length})</h3>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => handleDeviceCreate('custom', 0, 0)}
                    className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    + Gerät
                  </button>
                )}
              </div>
              {devices.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 italic">
                  Keine Geräte vorhanden. Über das Setup-Diagramm (Drag & Drop) oder "+ Gerät" anlegen.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b bg-gray-50">
                      <th className="py-2 px-4">Status</th>
                      <th className="py-2 px-2">Typ</th>
                      <th className="py-2 px-2">Bezeichnung</th>
                      <th className="py-2 px-2">Hersteller</th>
                      <th className="py-2 px-2">Seriennummer</th>
                      <th className="py-2 px-2">Lagerartikel</th>
                      <th className="py-2 px-2">Komponenten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((d) => {
                      const info = DEVICE_TYPES.find((t) => t.value === d.device_type) || {};
                      const st = STATUS_STYLES[d.status] || STATUS_STYLES.active;
                      return (
                        <tr
                          key={d.id}
                          onClick={() => handleDeviceEdit(d)}
                          className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="py-2 px-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border-2 ${st.border}`}>
                              <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                              {st.label}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${info.color || 'bg-gray-100'}`}>
                              {info.short || '??'}
                            </span>
                            <span className="ml-1 text-xs text-gray-500">{info.label}</span>
                          </td>
                          <td className="py-2 px-2 font-medium">{d.name}</td>
                          <td className="py-2 px-2">{d.manufacturer || '–'}</td>
                          <td className="py-2 px-2 font-mono text-xs">{d.serial_number || '–'}</td>
                          <td className="py-2 px-2 text-xs">
                            {d.inventory_item_display ? (
                              <Link
                                to={`/inventory/warehouse/${d.inventory_item}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 hover:underline"
                              >
                                {d.inventory_item_display}
                              </Link>
                            ) : '–'}
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-500">
                            {(d.components || []).length > 0
                              ? (d.components.map((c) => c.name).filter(Boolean).join(', ') || `${d.components.length}`)
                              : '–'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Tab: Belegung */}
          {activeTab === 'bookings' && (
            <DemoBookingCalendar
              bookings={bookings}
              onSaveBooking={handleSaveBooking}
              onDeleteBooking={handleDeleteBooking}
              readOnly={!canWrite}
            />
          )}

          {/* Tab: Änderungsprotokoll */}
          {activeTab === 'changelog' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h3 className="text-sm font-semibold text-gray-700">
                  Änderungsprotokoll ({changeLogs.length}{changeLogs.length >= 200 ? ', max. 200 angezeigt' : ''})
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Alle Änderungen an Setup, Geräten, Verbindungen, Komponenten und Buchungen.
                  Es werden die letzten 200 Änderungen angezeigt.
                </p>
              </div>
              {changeLogs.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 italic">Noch keine Änderungen protokolliert.</p>
              ) : (
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {changeLogs.map((log) => (
                    <ChangeLogRow
                      key={log.id}
                      log={log}
                      canComment={canWrite}
                      onCommentSave={handleCommentSave}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Geräte-Modal */}
      {deviceModal && (
        <DemoDeviceModal
          device={deviceModal.device}
          isNew={deviceModal.isNew}
          onSave={handleDeviceSave}
          onClose={() => setDeviceModal(null)}
          onDelete={deviceModal.isNew ? null : handleDeviceDelete}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Protokoll-Zeile mit Kommentar-Funktion
// ---------------------------------------------------------------------------

const ChangeLogRow = ({ log, canComment, onCommentSave }) => {
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState(log.comment || '');

  const handleSave = async () => {
    await onCommentSave(log, comment);
    setEditing(false);
  };

  const actionStyle = ACTION_STYLES[log.action] || 'bg-gray-100 text-gray-700';

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${actionStyle}`}>
              {log.action_display}
            </span>
            <span className="text-[10px] text-gray-400">
              {ENTITY_LABELS[log.entity_type] || log.entity_type}
            </span>
            <span className="text-sm font-medium text-gray-800 truncate">{log.entity_label}</span>
          </div>
          {log.field_name && (
            <div className="mt-1 text-xs text-gray-600">
              <span className="font-medium">{log.field_name}:</span>{' '}
              {log.old_value && log.new_value ? (
                <>
                  <span className="line-through text-gray-400">{log.old_value}</span>
                  <span className="mx-1">→</span>
                  <span className="text-gray-800">{log.new_value}</span>
                </>
              ) : log.new_value ? (
                <span className="text-gray-800">{log.new_value}</span>
              ) : log.old_value ? (
                <span className="line-through text-gray-400">{log.old_value}</span>
              ) : null}
            </div>
          )}
          {/* Kommentar */}
          {editing ? (
            <div className="mt-2 flex gap-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="flex-1 px-2 py-1 border rounded text-sm"
                placeholder="Kommentar zum Änderungseintrag..."
              />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => { setComment(log.comment || ''); setEditing(false); }}
                  className="px-2 py-1 text-xs border rounded"
                >
                  Abbr.
                </button>
              </div>
            </div>
          ) : (
            <>
              {log.comment && (
                <div className="mt-1.5 text-xs text-gray-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                  💬 {log.comment}
                  {log.comment_by_name && (
                    <span className="text-gray-400"> — {log.comment_by_name}</span>
                  )}
                </div>
              )}
              {canComment && !editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="mt-1 text-[11px] text-blue-600 hover:underline"
                >
                  {log.comment ? 'Kommentar bearbeiten' : 'Kommentar hinzufügen'}
                </button>
              )}
            </>
          )}
        </div>
        <div className="text-right text-xs text-gray-400 whitespace-nowrap">
          <div>{log.changed_by_name || 'System'}</div>
          <div>{new Date(log.changed_at).toLocaleString('de-DE')}</div>
        </div>
      </div>
    </div>
  );
};

export default DemoSystemEdit;