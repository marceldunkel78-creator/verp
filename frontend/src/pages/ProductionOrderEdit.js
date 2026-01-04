import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  CubeIcon,
  ClipboardDocumentCheckIcon,
  TruckIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  DocumentIcon,
  ArrowTopRightOnSquareIcon,
  UserIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { id: 'basic', name: 'Basisinformationen', icon: InformationCircleIcon },
  { id: 'materials', name: 'Materialsammlung', icon: CubeIcon },
  { id: 'checklist', name: 'Fertigungscheckliste', icon: ClipboardDocumentCheckIcon },
  { id: 'handover', name: 'Übergabe an Warenlager', icon: TruckIcon }
];

const ProductionOrderEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('basic');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Form data
  const [formData, setFormData] = useState({
    serial_number: '',
    estimated_completion_date: '',
    notes: '',
    observers: []
  });

  // Checklist data
  const [checklistData, setChecklistData] = useState(null);
  
  // Users for observers
  const [allUsers, setAllUsers] = useState([]);
  const [showObserverDropdown, setShowObserverDropdown] = useState(false);
  const [selectedObservers, setSelectedObservers] = useState([]);

  useEffect(() => {
    if (id) {
      fetchOrder();
      fetchUsers();
    }
  }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/manufacturing/production-orders/${id}/`);
      const data = response.data;
      setOrder(data);
      const obsIds = (data.observers && Array.isArray(data.observers))
        ? data.observers.map(o => (typeof o === 'object' && o !== null ? o.id : o))
        : (data.observers_list || []).map(o => o.id);

      setFormData({
        serial_number: data.serial_number || '',
        estimated_completion_date: data.estimated_completion_date || '',
        notes: data.notes || '',
        observers: obsIds
      });
      setSelectedObservers(obsIds.map(id => String(id)));
      setChecklistData(data.checklist_data || null);
    } catch (error) {
      console.error('Error fetching production order:', error);
      alert('Fehler beim Laden des Fertigungsauftrags');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/?is_active=true');
      setAllUsers(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Ensure observers are sent as array of IDs (numbers)
      const payload = { ...formData };
      if (payload.observers) {
        payload.observers = payload.observers.map(o => (typeof o === 'string' ? Number(o) : o));
      }
      await api.patch(`/manufacturing/production-orders/${id}/`, payload);
      setSaveMessage({ type: 'success', text: 'Änderungen gespeichert!' });
      setHasChanges(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      setSaveMessage({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  };
  
  const handleAddObserver = async (userId) => {
    // preserve behavior but also update checkbox state
    const idStr = String(userId);
    if (selectedObservers.includes(idStr)) return;
    const newSelected = [...selectedObservers, idStr];
    setSelectedObservers(newSelected);
    setFormData(prev => ({ ...prev, observers: newSelected }));
    setShowObserverDropdown(false);
  };
  
  const handleRemoveObserver = async (userId) => {
    const idStr = String(userId);
    const newSelected = selectedObservers.filter(id => id !== idStr);
    setSelectedObservers(newSelected);
    setFormData(prev => ({ ...prev, observers: newSelected }));
  };

  const handleObserverToggle = (userId) => {
    const idStr = String(userId);
    setSelectedObservers(prev => {
      if (prev.includes(idStr)) {
        const next = prev.filter(id => id !== idStr);
        setFormData(f => ({ ...f, observers: next }));
        setHasChanges(true);
        return next;
      } else {
        const next = [...prev, idStr];
        setFormData(f => ({ ...f, observers: next }));
        setHasChanges(true);
        return next;
      }
    });
  };

  const handleChecklistChange = async (sectionIndex, itemIndex, checked) => {
    const newChecklist = { ...checklistData };
    newChecklist.sections[sectionIndex].items[itemIndex].checked = checked;
    setChecklistData(newChecklist);
    
    // Auto-save checklist
    try {
      await api.patch(`/manufacturing/production-orders/${id}/update_checklist/`, {
        checklist_data: newChecklist
      });
    } catch (error) {
      console.error('Error saving checklist:', error);
    }
  };

  const handleGalvoTableChange = (rowIndex, field, value) => {
    const newChecklist = { ...checklistData };
    newChecklist.galvo_table.rows[rowIndex][field] = value;
    setChecklistData(newChecklist);
    setHasChanges(true);
  };

  const handleLaserTableChange = (rowIndex, field, value) => {
    const newChecklist = { ...checklistData };
    newChecklist.laser_table.rows[rowIndex][field] = value;
    setChecklistData(newChecklist);
    setHasChanges(true);
  };

  const handleLeoniSnChange = (value) => {
    const newChecklist = { ...checklistData };
    newChecklist.leoni_sn = value;
    setChecklistData(newChecklist);
    setHasChanges(true);
  };

  const saveChecklist = async () => {
    try {
      await api.patch(`/manufacturing/production-orders/${id}/update_checklist/`, {
        checklist_data: checklistData
      });
      setSaveMessage({ type: 'success', text: 'Checkliste gespeichert!' });
      setHasChanges(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving checklist:', error);
      setSaveMessage({ type: 'error', text: 'Fehler beim Speichern der Checkliste' });
    }
  };
  
  const areAllChecklistItemsChecked = () => {
    if (!checklistData || !checklistData.sections) return false;
    
    for (const section of checklistData.sections) {
      for (const item of section.items) {
        if (!item.checked) return false;
      }
    }
    return true;
  };
  
  const handleHandover = async () => {
    if (!areAllChecklistItemsChecked()) {
      alert('Bitte alle Checklistenpunkte abhaken, bevor Sie die Übergabe durchführen können.');
      return;
    }
    
    if (!window.confirm('Möchten Sie den Fertigungsauftrag wirklich an das Warenlager übergeben? Diese Aktion schließt den Auftrag ab.')) {
      return;
    }
    
    try {
      await api.post(`/manufacturing/production-orders/${id}/handover/`);
      setSaveMessage({ type: 'success', text: 'Fertigungsauftrag erfolgreich übergeben!' });
      await fetchOrder();
    } catch (error) {
      console.error('Error during handover:', error);
      alert(error.response?.data?.error || 'Fehler bei der Übergabe');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Laden...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Fertigungsauftrag nicht gefunden</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/manufacturing/production-orders')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {order.order_number}
            </h1>
            <p className="text-gray-500 text-sm">
              {order.vs_hardware_part_number} - {order.vs_hardware_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {saveMessage.text}
            </span>
          )}
          {(hasChanges || activeTab === 'basic') && (
            <button
              onClick={activeTab === 'checklist' ? saveChecklist : handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex -mb-px">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Basic Info Tab */}
      {activeTab === 'basic' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-6">Basisinformationen</h2>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Left column - Read-only info from VS-Hardware */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VS-Artikelnummer</label>
                <div className="px-3 py-2 bg-gray-50 rounded border font-mono">
                  {order.vs_hardware_part_number}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produktname</label>
                <div className="px-3 py-2 bg-gray-50 rounded border">
                  {order.vs_hardware_name}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <div className="px-3 py-2 bg-gray-50 rounded border min-h-[80px]">
                  {order.vs_hardware_description || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kunde</label>
                <div className="px-3 py-2 bg-gray-50 rounded border">
                  {order.customer_name || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kundenauftrag</label>
                <div className="px-3 py-2 bg-gray-50 rounded border font-mono">
                  {order.customer_order_number || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projekt</label>
                <div className="px-3 py-2 bg-gray-50 rounded border">
                  {order.project_name ? `${order.project_number} - ${order.project_name}` : '-'}
                </div>
              </div>
            </div>

            {/* Right column - Editable fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warenkategorie</label>
                <div className="px-3 py-2 bg-gray-50 rounded border">
                  {order.product_category_name || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Menge</label>
                <div className="px-3 py-2 bg-gray-50 rounded border">
                  {order.quantity}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seriennummer</label>
                <input
                  type="text"
                  value={formData.serial_number}
                  onChange={(e) => handleInputChange('serial_number', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Seriennummer eintragen"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avisiertes Fertigungsende</label>
                <input
                  type="date"
                  value={formData.estimated_completion_date}
                  onChange={(e) => handleInputChange('estimated_completion_date', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Notizen zum Fertigungsauftrag"
                />
              </div>
              
              {/* Observers (checkbox list similar to VisiView ticket) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Beobachter</label>
                <div className="border rounded p-2 max-h-48 overflow-y-auto">
                  {allUsers && allUsers.length > 0 ? (
                    allUsers.map(user => {
                      const idStr = String(user.id);
                      const label = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
                      return (
                        <label key={user.id} className="flex items-center gap-3 px-2 py-1 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={selectedObservers.includes(idStr)}
                            onChange={() => handleObserverToggle(user.id)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">{label} {user.username ? `(${user.username})` : ''}</span>
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-sm text-gray-500 p-2">Keine Benutzer gefunden</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Materials Tab */}
      {activeTab === 'materials' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium">Materialsammlung</h2>
            <a
              href={`/manufacturing/vs-hardware/${order.vs_hardware}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
            >
              VS-Hardware öffnen
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          </div>

          {order.vs_hardware_materials && order.vs_hardware_materials.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artikelnummer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bedarf/Stück</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gesamtbedarf</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lagerbestand</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {order.vs_hardware_materials.map((material, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm">
                        {material.material_supply_part_number || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {material.material_supply_name}
                        {material.notes && (
                          <div className="text-xs text-gray-500">{material.notes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {material.quantity_per_unit} {material.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {material.quantity_required} {material.unit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {material.stock_quantity} {material.unit}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {material.stock_sufficient ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-4 w-4" />
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <ExclamationCircleIcon className="h-4 w-4" />
                            Fehlt
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Keine Materialien in der Materialliste vorhanden.
            </div>
          )}

          {/* Documents / Manufacturing Plans */}
          {order.vs_hardware_documents && order.vs_hardware_documents.length > 0 && (
            <div className="mt-8">
              <h3 className="text-md font-medium mb-4">Fertigungspläne</h3>
              <div className="grid grid-cols-2 gap-4">
                {order.vs_hardware_documents.map((doc, idx) => (
                  <a
                    key={idx}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <DocumentIcon className="h-8 w-8 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium">{doc.title}</div>
                      <div className="text-sm text-gray-500">{doc.document_type_display}</div>
                    </div>
                    <ArrowTopRightOnSquareIcon className="h-5 w-5 text-gray-400" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Checklist Tab */}
      {activeTab === 'checklist' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-6">
            Fertigungscheckliste - {order.product_category_name}
          </h2>

          {checklistData && checklistData.sections ? (
            <div className="space-y-8">
              {checklistData.sections.map((section, sectionIdx) => (
                <div key={sectionIdx}>
                  <h3 className="text-md font-medium text-gray-800 mb-3 pb-2 border-b">
                    {section.title}
                  </h3>
                  <div className="space-y-2">
                    {section.items.map((item, itemIdx) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => handleChecklistChange(sectionIdx, itemIdx, e.target.checked)}
                          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={item.checked ? 'text-gray-500 line-through' : ''}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* Galvo Table for ORBITAL */}
              {checklistData.galvo_table && (
                <div className="mt-8">
                  <h3 className="text-md font-medium text-gray-800 mb-3 pb-2 border-b">
                    Galvo-Offset Messung
                  </h3>
                  <table className="min-w-full border">
                    <thead className="bg-gray-50">
                      <tr>
                        {checklistData.galvo_table.headers.map((header, idx) => (
                          <th key={idx} className="px-4 py-2 border text-left text-sm font-medium text-gray-700">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {checklistData.galvo_table.rows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          <td className="px-4 py-2 border bg-gray-50 font-mono">
                            {row.offset}
                          </td>
                          <td className="px-4 py-2 border">
                            <input
                              type="text"
                              value={row.x_voltage}
                              onChange={(e) => handleGalvoTableChange(rowIdx, 'x_voltage', e.target.value)}
                              className="w-full px-2 py-1 border rounded"
                            />
                          </td>
                          <td className="px-4 py-2 border">
                            <input
                              type="text"
                              value={row.y_voltage}
                              onChange={(e) => handleGalvoTableChange(rowIdx, 'y_voltage', e.target.value)}
                              className="w-full px-2 py-1 border rounded"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Laser Table for VS-LMS */}
              {checklistData.laser_table && (
                <div className="mt-8">
                  <h3 className="text-md font-medium text-gray-800 mb-3 pb-2 border-b">
                    Laser-Dokumentation
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border">
                      <thead className="bg-gray-50">
                        <tr>
                          {checklistData.laser_table.headers.map((header, idx) => (
                            <th key={idx} className="px-3 py-2 border text-left text-xs font-medium text-gray-700">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {checklistData.laser_table.rows.map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            <td className="px-3 py-2 border">
                              <input
                                type="text"
                                value={row.nm}
                                onChange={(e) => handleLaserTableChange(rowIdx, 'nm', e.target.value)}
                                className="w-16 px-2 py-1 border rounded"
                                placeholder="nm"
                              />
                            </td>
                            <td className="px-3 py-2 border">
                              <input
                                type="text"
                                value={row.modell}
                                onChange={(e) => handleLaserTableChange(rowIdx, 'modell', e.target.value)}
                                className="w-full px-2 py-1 border rounded"
                              />
                            </td>
                            <td className="px-3 py-2 border">
                              <input
                                type="text"
                                value={row.serial}
                                onChange={(e) => handleLaserTableChange(rowIdx, 'serial', e.target.value)}
                                className="w-full px-2 py-1 border rounded"
                              />
                            </td>
                            <td className="px-3 py-2 border">
                              <input
                                type="text"
                                value={row.leistung}
                                onChange={(e) => handleLaserTableChange(rowIdx, 'leistung', e.target.value)}
                                className="w-16 px-2 py-1 border rounded"
                              />
                            </td>
                            <td className="px-3 py-2 border">
                              <input
                                type="text"
                                value={row.output_sdc}
                                onChange={(e) => handleLaserTableChange(rowIdx, 'output_sdc', e.target.value)}
                                className="w-16 px-2 py-1 border rounded"
                              />
                            </td>
                            <td className="px-3 py-2 border">
                              <input
                                type="text"
                                value={row.output_tirf}
                                onChange={(e) => handleLaserTableChange(rowIdx, 'output_tirf', e.target.value)}
                                className="w-16 px-2 py-1 border rounded"
                              />
                            </td>
                            <td className="px-3 py-2 border">
                              <input
                                type="text"
                                value={row.output_frap}
                                onChange={(e) => handleLaserTableChange(rowIdx, 'output_frap', e.target.value)}
                                className="w-16 px-2 py-1 border rounded"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Leoni SN Field */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leoni SN</label>
                    <input
                      type="text"
                      value={checklistData.leoni_sn || ''}
                      onChange={(e) => handleLeoniSnChange(e.target.value)}
                      className="w-64 px-3 py-2 border rounded"
                      placeholder="Leoni Seriennummer"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <button
                  onClick={saveChecklist}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Checkliste speichern
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Keine Checkliste verfügbar. Bitte starten Sie zuerst den Fertigungsauftrag.
            </div>
          )}
        </div>
      )}
      
      {/* Handover Tab */}
      {activeTab === 'handover' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-6">Übergabe an Warenlager</h2>
          
          {order.status === 'completed' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-green-800 mb-2">Fertigungsauftrag abgeschlossen</h3>
              <p className="text-green-700">
                Dieser Fertigungsauftrag wurde bereits an das Warenlager übergeben.
              </p>
              {order.actual_end && (
                <p className="text-sm text-green-600 mt-2">
                  Abgeschlossen am: {new Date(order.actual_end).toLocaleDateString('de-DE')}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <InformationCircleIcon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Voraussetzungen für die Übergabe:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Alle Punkte der Fertigungscheckliste müssen abgehakt sein</li>
                      <li>Die Seriennummer sollte eingetragen sein</li>
                      <li>Nach der Übergabe wird der Status auf "Abgeschlossen" gesetzt</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {/* Checklist Status */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-3">Status der Fertigungscheckliste</h3>
                {checklistData && checklistData.sections ? (
                  <div className="space-y-2">
                    {checklistData.sections.map((section, idx) => {
                      const checkedCount = section.items.filter(item => item.checked).length;
                      const totalCount = section.items.length;
                      const isComplete = checkedCount === totalCount;
                      
                      return (
                        <div key={idx} className="flex items-center justify-between py-2">
                          <span className="text-sm">{section.title}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              {checkedCount}/{totalCount}
                            </span>
                            {isComplete ? (
                              <CheckCircleIcon className="h-5 w-5 text-green-500" />
                            ) : (
                              <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    
                    <div className="pt-4 border-t mt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Gesamt</span>
                        {areAllChecklistItemsChecked() ? (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircleIcon className="h-6 w-6" />
                            <span className="font-medium">Alle Punkte abgehakt</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <ExclamationCircleIcon className="h-6 w-6" />
                            <span className="font-medium">Noch nicht vollständig</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Keine Checkliste verfügbar</p>
                )}
              </div>
              
              {/* Serial Number Check */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">Seriennummer</h3>
                {formData.serial_number ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span className="text-sm font-mono">{formData.serial_number}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <ExclamationCircleIcon className="h-5 w-5" />
                    <span className="text-sm">Keine Seriennummer eingetragen</span>
                  </div>
                )}
              </div>
              
              {/* Handover Button */}
              <div className="pt-6 border-t">
                <button
                  onClick={handleHandover}
                  disabled={!areAllChecklistItemsChecked() || order.status === 'completed'}
                  className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 ${
                    areAllChecklistItemsChecked() && order.status !== 'completed'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <TruckIcon className="h-5 w-5" />
                  An Warenlager übergeben
                </button>
                {!areAllChecklistItemsChecked() && (
                  <p className="text-sm text-yellow-600 mt-2 text-center">
                    Bitte alle Checklistenpunkte abhaken, um die Übergabe freizuschalten.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductionOrderEdit;
