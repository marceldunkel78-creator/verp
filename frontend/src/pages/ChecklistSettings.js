import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  ClipboardDocumentCheckIcon,
  TruckIcon,
  PencilIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  TableCellsIcon
} from '@heroicons/react/24/outline';

const ChecklistSettings = () => {
  const navigate = useNavigate();

  // Data state
  const [categories, setCategories] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeType, setActiveType] = useState('production'); // 'production' | 'outgoing'

  // Edit state
  const [editingTemplate, setEditingTemplate] = useState(null); // template being edited
  const [sections, setSections] = useState([]);
  const [specialTables, setSpecialTables] = useState({});
  const [templateName, setTemplateName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch templates when category changes
  useEffect(() => {
    if (selectedCategory) {
      fetchTemplates(selectedCategory);
    }
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/settings/product-categories/?is_active=true&ordering=sort_order,name');
      const cats = response.data.results || response.data;
      setCategories(cats);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setLoading(false);
    }
  };

  const fetchTemplates = async (categoryId) => {
    try {
      const response = await api.get(`/settings/checklist-templates/?product_category=${categoryId}`);
      const tmpl = response.data.results || response.data;
      setTemplates(tmpl);
      // Auto-load the template for the active type
      loadTemplateForType(tmpl, activeType);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const loadTemplateForType = useCallback((tmpl, type) => {
    const template = tmpl.find(t => t.checklist_type === type);
    if (template) {
      setEditingTemplate(template);
      setSections(JSON.parse(JSON.stringify(template.sections || [])));
      setSpecialTables(JSON.parse(JSON.stringify(template.special_tables || {})));
      setTemplateName(template.name || '');
    } else {
      setEditingTemplate(null);
      setSections([]);
      setSpecialTables({});
      setTemplateName('');
    }
    setHasChanges(false);
  }, []);

  // When switching tabs, load the template for the new type
  const handleTypeChange = (type) => {
    if (hasChanges) {
      if (!window.confirm('Es gibt ungespeicherte Änderungen. Wirklich wechseln?')) return;
    }
    setActiveType(type);
    loadTemplateForType(templates, type);
  };

  // ===== Section operations =====
  const addSection = () => {
    setSections(prev => [...prev, { title: 'Neue Sektion', items: [] }]);
    setHasChanges(true);
  };

  const removeSection = (idx) => {
    setSections(prev => prev.filter((_, i) => i !== idx));
    setHasChanges(true);
  };

  const updateSectionTitle = (idx, title) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, title } : s));
    setHasChanges(true);
  };

  const moveSectionUp = (idx) => {
    if (idx === 0) return;
    setSections(prev => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr;
    });
    setHasChanges(true);
  };

  const moveSectionDown = (idx) => {
    setSections(prev => {
      if (idx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr;
    });
    setHasChanges(true);
  };

  // ===== Item operations =====
  const addItem = (sectionIdx) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) return s;
      const newId = `item_${Date.now()}`;
      return { ...s, items: [...s.items, { id: newId, label: 'Neuer Prüfpunkt' }] };
    }));
    setHasChanges(true);
  };

  const removeItem = (sectionIdx, itemIdx) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) return s;
      return { ...s, items: s.items.filter((_, j) => j !== itemIdx) };
    }));
    setHasChanges(true);
  };

  const updateItemLabel = (sectionIdx, itemIdx, label) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) return s;
      return {
        ...s,
        items: s.items.map((item, j) => j === itemIdx ? { ...item, label } : item)
      };
    }));
    setHasChanges(true);
  };

  const updateItemId = (sectionIdx, itemIdx, id) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) return s;
      return {
        ...s,
        items: s.items.map((item, j) => j === itemIdx ? { ...item, id } : item)
      };
    }));
    setHasChanges(true);
  };

  // ===== Special table operations =====
  const addGalvoTable = () => {
    setSpecialTables(prev => ({
      ...prev,
      galvo_table: {
        headers: ['Galvo-Offset', 'X-Galvo-Spannung V', 'Y-Galvo-Spannung V'],
        rows: [
          { offset: '2,49', x_voltage: '', y_voltage: '' },
          { offset: '0,00', x_voltage: '', y_voltage: '' },
          { offset: '-2,49', x_voltage: '', y_voltage: '' }
        ]
      }
    }));
    setHasChanges(true);
  };

  const addLaserTable = () => {
    setSpecialTables(prev => ({
      ...prev,
      laser_table: {
        headers: ['Laser nm', 'Modell', 'Serialnr.', 'Leistung mW', 'Output SDC mW', 'Output TIRF mW', 'Output FRAP mW'],
        rows: [
          { nm: '', modell: '', serial: '', leistung: '', output_sdc: '', output_tirf: '', output_frap: '' }
        ]
      },
      leoni_sn: ''
    }));
    setHasChanges(true);
  };

  const removeSpecialTable = (key) => {
    setSpecialTables(prev => {
      const next = { ...prev };
      delete next[key];
      if (key === 'laser_table') delete next.leoni_sn;
      return next;
    });
    setHasChanges(true);
  };

  const addGalvoRow = () => {
    setSpecialTables(prev => ({
      ...prev,
      galvo_table: {
        ...prev.galvo_table,
        rows: [...prev.galvo_table.rows, { offset: '', x_voltage: '', y_voltage: '' }]
      }
    }));
    setHasChanges(true);
  };

  const removeGalvoRow = (idx) => {
    setSpecialTables(prev => ({
      ...prev,
      galvo_table: {
        ...prev.galvo_table,
        rows: prev.galvo_table.rows.filter((_, i) => i !== idx)
      }
    }));
    setHasChanges(true);
  };

  const updateGalvoRow = (idx, field, value) => {
    setSpecialTables(prev => ({
      ...prev,
      galvo_table: {
        ...prev.galvo_table,
        rows: prev.galvo_table.rows.map((r, i) => i === idx ? { ...r, [field]: value } : r)
      }
    }));
    setHasChanges(true);
  };

  const addLaserRow = () => {
    setSpecialTables(prev => ({
      ...prev,
      laser_table: {
        ...prev.laser_table,
        rows: [...prev.laser_table.rows, { nm: '', modell: '', serial: '', leistung: '', output_sdc: '', output_tirf: '', output_frap: '' }]
      }
    }));
    setHasChanges(true);
  };

  const removeLaserRow = (idx) => {
    setSpecialTables(prev => ({
      ...prev,
      laser_table: {
        ...prev.laser_table,
        rows: prev.laser_table.rows.filter((_, i) => i !== idx)
      }
    }));
    setHasChanges(true);
  };

  // ===== Save =====
  const handleSave = async () => {
    if (!selectedCategory) return;

    setSaving(true);
    setSaveMessage(null);

    const payload = {
      product_category: selectedCategory,
      checklist_type: activeType,
      name: templateName,
      sections,
      special_tables: specialTables,
      is_active: true
    };

    try {
      if (editingTemplate) {
        // Update existing
        const response = await api.patch(`/settings/checklist-templates/${editingTemplate.id}/`, payload);
        const updated = response.data;
        setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
        setEditingTemplate(updated);
      } else {
        // Create new
        const response = await api.post('/settings/checklist-templates/', payload);
        const created = response.data;
        setTemplates(prev => [...prev, created]);
        setEditingTemplate(created);
      }
      setHasChanges(false);
      setSaveMessage({ type: 'success', text: 'Checklistenvorlage gespeichert' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving template:', error);
      const msg = error.response?.data
        ? Object.entries(error.response.data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ')
        : 'Fehler beim Speichern';
      setSaveMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  // ===== Delete template =====
  const handleDelete = async () => {
    if (!editingTemplate) return;
    if (!window.confirm('Diese Checklistenvorlage wirklich löschen?')) return;

    try {
      await api.delete(`/settings/checklist-templates/${editingTemplate.id}/`);
      setTemplates(prev => prev.filter(t => t.id !== editingTemplate.id));
      setEditingTemplate(null);
      setSections([]);
      setSpecialTables({});
      setTemplateName('');
      setHasChanges(false);
      setSaveMessage({ type: 'success', text: 'Vorlage gelöscht' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting template:', error);
      setSaveMessage({ type: 'error', text: 'Fehler beim Löschen' });
    }
  };

  // Find category display name
  const selectedCatObj = categories.find(c => c.id === selectedCategory);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse text-gray-500">Lade...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/settings')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Checklisten-Verwaltung</h1>
        </div>
      </div>

      {/* Category selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Warenkategorie auswählen</label>
        <select
          value={selectedCategory || ''}
          onChange={(e) => {
            if (hasChanges && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return;
            setSelectedCategory(e.target.value ? Number(e.target.value) : null);
            setActiveType('production');
          }}
          className="w-full max-w-md px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- Kategorie wählen --</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
          ))}
        </select>
      </div>

      {selectedCategory && (
        <>
          {/* Type tabs */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b">
              <nav className="flex">
                <button
                  onClick={() => handleTypeChange('production')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${
                    activeType === 'production'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ClipboardDocumentCheckIcon className="h-5 w-5" />
                  Fertigungscheckliste
                  {templates.find(t => t.checklist_type === 'production') && (
                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  )}
                </button>
                <button
                  onClick={() => handleTypeChange('outgoing')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${
                    activeType === 'outgoing'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <TruckIcon className="h-5 w-5" />
                  Ausgangscheckliste
                  {templates.find(t => t.checklist_type === 'outgoing') && (
                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  )}
                </button>
              </nav>
            </div>

            <div className="p-6 space-y-6">
              {/* Template name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vorlagenname
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => { setTemplateName(e.target.value); setHasChanges(true); }}
                  placeholder={`${selectedCatObj?.name || ''} ${activeType === 'production' ? 'Fertigungscheckliste' : 'Ausgangscheckliste'}`}
                  className="w-full max-w-md px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Info box */}
              {!editingTemplate && sections.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Keine Vorlage vorhanden</p>
                    <p>Für diese Kategorie existiert noch keine {activeType === 'production' ? 'Fertigungscheckliste' : 'Ausgangscheckliste'}. 
                    Fügen Sie Sektionen und Prüfpunkte hinzu und speichern Sie.</p>
                  </div>
                </div>
              )}

              {/* Sections editor */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Sektionen & Prüfpunkte</h3>
                  <button
                    onClick={addSection}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Sektion hinzufügen
                  </button>
                </div>

                {sections.map((section, sIdx) => (
                  <div key={sIdx} className="border rounded-lg">
                    {/* Section header */}
                    <div className="bg-gray-50 px-4 py-3 flex items-center gap-3 border-b">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveSectionUp(sIdx)}
                          disabled={sIdx === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ChevronUpIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveSectionDown(sIdx)}
                          disabled={sIdx === sections.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ChevronDownIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                        className="flex-1 px-2 py-1 border rounded text-sm font-medium focus:ring-2 focus:ring-blue-500"
                        placeholder="Sektionsname"
                      />
                      <span className="text-xs text-gray-500">
                        {section.items.length} {section.items.length === 1 ? 'Prüfpunkt' : 'Prüfpunkte'}
                      </span>
                      <button
                        onClick={() => removeSection(sIdx)}
                        className="text-red-400 hover:text-red-600"
                        title="Sektion entfernen"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Items */}
                    <div className="p-4 space-y-2">
                      {section.items.map((item, iIdx) => (
                        <div key={iIdx} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-6 text-right">{iIdx + 1}.</span>
                          <input
                            type="text"
                            value={item.id}
                            onChange={(e) => updateItemId(sIdx, iIdx, e.target.value)}
                            className="w-40 px-2 py-1 border rounded text-xs text-gray-600 font-mono focus:ring-2 focus:ring-blue-500"
                            placeholder="item_id"
                            title="Technische ID"
                          />
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => updateItemLabel(sIdx, iIdx, e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="Prüfpunkt-Bezeichnung"
                          />
                          <button
                            onClick={() => removeItem(sIdx, iIdx)}
                            className="text-red-400 hover:text-red-600"
                            title="Prüfpunkt entfernen"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addItem(sIdx)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Prüfpunkt hinzufügen
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Special tables (only for production checklists) */}
              {activeType === 'production' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                      <TableCellsIcon className="h-5 w-5" />
                      Spezielle Tabellen
                    </h3>
                    <div className="flex gap-2">
                      {!specialTables.galvo_table && (
                        <button
                          onClick={addGalvoTable}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 border rounded-lg hover:bg-gray-200"
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                          Galvo-Tabelle
                        </button>
                      )}
                      {!specialTables.laser_table && (
                        <button
                          onClick={addLaserTable}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 border rounded-lg hover:bg-gray-200"
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                          Laser-Tabelle
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Galvo Table Editor */}
                  {specialTables.galvo_table && (
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-800">Galvo-Offset Messung</h4>
                        <button
                          onClick={() => removeSpecialTable('galvo_table')}
                          className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1"
                        >
                          <TrashIcon className="h-3.5 w-3.5" /> Entfernen
                        </button>
                      </div>
                      <table className="min-w-full border text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {specialTables.galvo_table.headers.map((h, i) => (
                              <th key={i} className="px-3 py-2 border text-left text-xs font-medium">{h}</th>
                            ))}
                            <th className="px-2 py-2 border w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {specialTables.galvo_table.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              <td className="px-3 py-1 border">
                                <input type="text" value={row.offset}
                                  onChange={(e) => updateGalvoRow(rIdx, 'offset', e.target.value)}
                                  className="w-full px-1 py-1 border rounded text-xs" />
                              </td>
                              <td className="px-3 py-1 border bg-gray-50 text-xs text-gray-400 text-center">Eingabe</td>
                              <td className="px-3 py-1 border bg-gray-50 text-xs text-gray-400 text-center">Eingabe</td>
                              <td className="px-2 py-1 border">
                                <button onClick={() => removeGalvoRow(rIdx)} className="text-red-400 hover:text-red-600">
                                  <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button onClick={addGalvoRow} className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <PlusIcon className="h-3.5 w-3.5" /> Zeile hinzufügen
                      </button>
                    </div>
                  )}

                  {/* Laser Table Editor */}
                  {specialTables.laser_table && (
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-800">Laser-Dokumentation</h4>
                        <button
                          onClick={() => removeSpecialTable('laser_table')}
                          className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1"
                        >
                          <TrashIcon className="h-3.5 w-3.5" /> Entfernen
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              {specialTables.laser_table.headers.map((h, i) => (
                                <th key={i} className="px-2 py-2 border text-left text-xs font-medium">{h}</th>
                              ))}
                              <th className="px-2 py-2 border w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {specialTables.laser_table.rows.map((_, rIdx) => (
                              <tr key={rIdx}>
                                {specialTables.laser_table.headers.map((_, cIdx) => (
                                  <td key={cIdx} className="px-2 py-1 border bg-gray-50 text-xs text-gray-400 text-center">
                                    Eingabe
                                  </td>
                                ))}
                                <td className="px-2 py-1 border">
                                  <button onClick={() => removeLaserRow(rIdx)} className="text-red-400 hover:text-red-600">
                                    <TrashIcon className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button onClick={addLaserRow} className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <PlusIcon className="h-3.5 w-3.5" /> Zeile hinzufügen
                      </button>
                      {/* Leoni SN toggle */}
                      <div className="mt-3 flex items-center gap-2">
                        <label className="text-xs text-gray-600">Leoni SN Feld:</label>
                        <span className="text-xs text-green-600">aktiv</span>
                      </div>
                    </div>
                  )}

                  {!specialTables.galvo_table && !specialTables.laser_table && (
                    <p className="text-sm text-gray-400 italic">
                      Keine speziellen Tabellen konfiguriert. Optional für Kategorien wie Orbital (Galvo) oder VS-LMS (Laser).
                    </p>
                  )}
                </div>
              )}

              {/* Save / Delete bar */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving || (!hasChanges && editingTemplate)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 ${
                      saving || (!hasChanges && editingTemplate)
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {saving ? 'Speichere...' : 'Speichern'}
                  </button>
                  {editingTemplate && (
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 rounded-lg text-sm text-red-600 border border-red-300 hover:bg-red-50"
                    >
                      Vorlage löschen
                    </button>
                  )}
                </div>
                {saveMessage && (
                  <span className={`text-sm ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {saveMessage.text}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          {sections.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Vorschau</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-6">
                {sections.map((section, sIdx) => (
                  <div key={sIdx}>
                    <h4 className="text-md font-medium text-gray-800 mb-2 pb-1 border-b">{section.title}</h4>
                    <div className="space-y-1">
                      {section.items.map((item, iIdx) => (
                        <label key={iIdx} className="flex items-center gap-3 p-1.5 rounded">
                          <input type="checkbox" disabled className="h-4 w-4 rounded border-gray-300" />
                          <span className="text-sm text-gray-700">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ChecklistSettings;
