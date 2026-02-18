import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import FileUpload from '../components/FileUpload';
import {
  ArrowLeftIcon,
  CheckIcon,
  TrashIcon,
  PlusIcon,
  ArrowPathIcon,
  BeakerIcon,
  ClockIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { id: 'details', label: 'Basisdaten' },
  { id: 'todos', label: 'ToDo-Liste' },
  { id: 'comments', label: 'Kommentare' },
  { id: 'materials', label: 'Material & Kalkulation' },
  { id: 'files', label: 'Dokumente' },
  { id: 'time', label: 'Zeiterfassung' }
];

const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'testing', label: 'Im Test' },
  { value: 'paused', label: 'Pausiert' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'rejected', label: 'Abgelehnt' }
];

const DevelopmentProjectEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id; // Treat undefined id as new

  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);

  // Project data
  const [project, setProject] = useState({
    name: '',
    description: '',
    status: 'new',
    assigned_to: '',
    planned_end: '',
    todos: [],
    comments: [],
    material_items: [],
    cost_calculations: [],
    attachments: [],
    time_entries: []
  });

  // Form states for adding new items
  const [newTodo, setNewTodo] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newMaterial, setNewMaterial] = useState({ material_supply: '', quantity: 1, notes: '' });
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialSearchResults, setMaterialSearchResults] = useState([]);
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [selectedMaterialLabel, setSelectedMaterialLabel] = useState('');
  const materialDropdownRef = useRef(null);
  const [newTimeEntry, setNewTimeEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    employee: '',
    hours_spent: '',
    description: ''
  });

  // Cost calculation
  const [costCalc, setCostCalc] = useState({
    name: 'Standard',
    labor_hours: 0,
    labor_rate: 65,
    development_cost_total: 0,
    expected_sales_volume: 1,
    notes: ''
  });

  // Loading states
  const [addingTodo, setAddingTodo] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [addingTimeEntry, setAddingTimeEntry] = useState(false);
  const [creatingVSHardware, setCreatingVSHardware] = useState(false);

  // Fetch users and material supplies
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const usersRes = await api.get('/users/');
        setUsers(usersRes.data.results || usersRes.data);
      } catch (error) {
        console.error('Error fetching options:', error);
      }
    };
    fetchOptions();
  }, []);

  // Search materials with 3+ character minimum
  useEffect(() => {
    if (materialSearch.length < 3) {
      setMaterialSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/suppliers/material-supplies/?search=${encodeURIComponent(materialSearch)}&page_size=50`);
        setMaterialSearchResults(res.data.results || res.data);
        setShowMaterialDropdown(true);
      } catch (e) {
        console.error('Error searching materials:', e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [materialSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (materialDropdownRef.current && !materialDropdownRef.current.contains(e.target)) {
        setShowMaterialDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch project data when ID changes
  useEffect(() => {
    const fetchProject = async () => {
      // If there's no id param, do nothing. This prevents accidental requests
      // when the component mounts without a route parameter (avoids `/undefined/`).
      if (!id) {
        setLoading(false);
        return;
      }

      // Reset state when creating a new project
      if (id === 'new') {
        setProject({
          name: '',
          description: '',
          status: 'new',
          assigned_to: '',
          planned_end: '',
          todos: [],
          comments: [],
          material_items: [],
          cost_calculations: [],
          attachments: [],
          time_entries: []
        });
        setCostCalc({
          name: 'Standard',
          labor_hours: 0,
          labor_rate: 65,
          development_cost_total: 0,
          expected_sales_volume: 1,
          notes: ''
        });
        setActiveTab('details');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const response = await api.get(`/development/projects/${id}/`);
        setProject(response.data);
        
        // Set active cost calculation if exists
        const activCalc = response.data.cost_calculations?.find(c => c.is_active);
        if (activCalc) {
          setCostCalc({
            id: activCalc.id,
            name: activCalc.name,
            labor_hours: activCalc.labor_hours,
            labor_rate: activCalc.labor_rate,
            development_cost_total: activCalc.development_cost_total,
            expected_sales_volume: activCalc.expected_sales_volume,
            notes: activCalc.notes || ''
          });
        }
      } catch (error) {
        console.error('Error fetching project:', error);
        alert('Fehler beim Laden des Projekts');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProject();
  }, [id]);

  // Refetch function for use after updates
  const refetchProject = useCallback(async () => {
    // Don't attempt to refetch if no id or when on the 'new' form
    if (!id || id === 'new') return;
    try {
      const response = await api.get(`/development/projects/${id}/`);
      setProject(response.data);
    } catch (error) {
      console.error('Error refetching project:', error);
    }
  }, [id]);

  // Save project
  const handleSave = async () => {
    if (!project.name.trim()) {
      alert('Bitte geben Sie einen Projektnamen ein');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: project.name,
        description: project.description,
        status: project.status,
        assigned_to: project.assigned_to || null,
        planned_end: project.planned_end || null
      };

      if (isNew) {
        const response = await api.post('/development/projects/', payload);
        // After creating, navigate to the new project and let it load fresh
        setSaving(false);
        navigate(`/development/projects/${response.data.id}`, { replace: true });
        return;
      } else {
        // Ensure we have a valid id for existing projects
        if (!id) {
          alert('Fehler: Projekt-ID fehlt. Bitte laden Sie die Seite neu.');
          setSaving(false);
          return;
        }
        const response = await api.patch(`/development/projects/${id}/`, payload);
        setProject(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  // TODO Actions
  const handleAddTodo = async () => {
    if (!id || id === 'new') { alert('Bitte speichern Sie das Projekt zuerst'); return; }
    if (!newTodo.trim()) return;
    setAddingTodo(true);
    try {
      const response = await api.post(`/development/projects/${id}/add_todo/`, { text: newTodo });
      setProject(prev => ({ ...prev, todos: [...prev.todos, response.data] }));
      setNewTodo('');
    } catch (error) {
      alert('Fehler beim Hinzufügen: ' + error.message);
    } finally {
      setAddingTodo(false);
    }
  };

  const handleToggleTodo = async (todoId, isCompleted) => {
    if (!id || id === 'new') { alert('Bitte speichern Sie das Projekt zuerst'); return; }
    try {
      await api.patch(`/development/projects/${id}/update_todo/${todoId}/`, { is_completed: !isCompleted });
      setProject(prev => ({
        ...prev,
        todos: prev.todos.map(t => t.id === todoId ? { ...t, is_completed: !isCompleted } : t)
      }));
    } catch (error) {
      alert('Fehler beim Aktualisieren: ' + error.message);
    }
  };

  const handleDeleteTodo = async (todoId) => {
    if (!id || id === 'new') { alert('Bitte speichern Sie das Projekt zuerst'); return; }
    if (!window.confirm('ToDo wirklich löschen?')) return;
    try {
      await api.delete(`/development/projects/${id}/delete_todo/${todoId}/`);
      setProject(prev => ({ ...prev, todos: prev.todos.filter(t => t.id !== todoId) }));
    } catch (error) {
      alert('Fehler beim Löschen: ' + error.message);
    }
  };

  // Comment Actions
  const handleAddComment = async () => {
    if (!id || id === 'new') { alert('Bitte speichern Sie das Projekt zuerst'); return; }
    if (!newComment.trim()) return;
    setAddingComment(true);
    try {
      const response = await api.post(`/development/projects/${id}/add_comment/`, { comment: newComment });
      setProject(prev => ({ ...prev, comments: [response.data, ...prev.comments] }));
      setNewComment('');
    } catch (error) {
      alert('Fehler beim Hinzufügen: ' + error.message);
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!id || id === 'new') { alert('Bitte speichern Sie das Projekt zuerst'); return; }
    if (!window.confirm('Kommentar wirklich löschen?')) return;
    try {
      await api.delete(`/development/projects/${id}/delete_comment/${commentId}/`);
      setProject(prev => ({ ...prev, comments: prev.comments.filter(c => c.id !== commentId) }));
    } catch (error) {
      alert('Fehler beim Löschen: ' + error.message);
    }
  };

  // Material Actions
  const handleAddMaterial = async () => {
    if (!id || id === 'new') { alert('Bitte speichern Sie das Projekt zuerst'); return; }
    if (!newMaterial.material_supply) {
      alert('Bitte Material auswählen');
      return;
    }
    setAddingMaterial(true);
    try {
      const response = await api.post(`/development/projects/${id}/add_material_item/`, newMaterial);
      setProject(prev => ({ ...prev, material_items: [...prev.material_items, response.data] }));
      setNewMaterial({ material_supply: '', quantity: 1, notes: '' });
      setMaterialSearch('');
      setSelectedMaterialLabel('');
      setMaterialSearchResults([]);
    } catch (error) {
      alert('Fehler beim Hinzufügen: ' + error.message);
    } finally {
      setAddingMaterial(false);
    }
  };

  const handleUpdateMaterialQuantity = async (itemId, quantity) => {
    if (!id || id === 'new') { alert('Bitte speichern Sie das Projekt zuerst'); return; }
    try {
      const response = await api.patch(`/development/projects/${id}/update_material_item/${itemId}/`, { quantity });
      setProject(prev => ({
        ...prev,
        material_items: prev.material_items.map(m => m.id === itemId ? response.data : m)
      }));
    } catch (error) {
      alert('Fehler beim Aktualisieren: ' + error.message);
    }
  };

  const handleDeleteMaterial = async (itemId) => {
    if (!id || id === 'new') { alert('Bitte speichern Sie das Projekt zuerst'); return; }
    if (!window.confirm('Material wirklich entfernen?')) return;
    try {
      await api.delete(`/development/projects/${id}/delete_material_item/${itemId}/`);
      setProject(prev => ({ ...prev, material_items: prev.material_items.filter(m => m.id !== itemId) }));
    } catch (error) {
      alert('Fehler beim Löschen: ' + error.message);
    }
  };

  // Cost Calculation Actions
  const handleSaveCostCalculation = async () => {
    if (!id || id === 'new') { alert('Bitte speichern Sie das Projekt zuerst'); return; }
    try {
      if (costCalc.id) {
        const response = await api.patch(`/development/projects/${id}/update_cost_calculation/${costCalc.id}/`, costCalc);
        setCostCalc(prev => ({ ...prev, ...response.data }));
      } else {
        const response = await api.post(`/development/projects/${id}/add_cost_calculation/`, costCalc);
        setCostCalc(response.data);
      }
      refetchProject(); // Refresh to get updated calculations
    } catch (error) {
      alert('Fehler beim Speichern der Kalkulation: ' + error.message);
    }
  };

  // Create VS-Hardware from materials
  const handleCreateVSHardware = async () => {
    if (!id || id === 'new') { alert('Bitte speichern Sie das Projekt zuerst'); return; }
    if (project.material_items.length === 0) {
      alert('Es sind keine Materialien vorhanden');
      return;
    }

    const name = window.prompt('Name der neuen VS-Hardware:', project.name);
    if (!name) return;

    setCreatingVSHardware(true);
    try {
      const response = await api.post(`/development/projects/${id}/create_vshardware_from_materials/`, {
        name: name,
        description: `Erstellt aus Entwicklungsprojekt ${project.project_number}\n\n${project.description}`
      });
      alert(`VS-Hardware ${response.data.vs_hardware_part_number} erfolgreich erstellt!`);
      if (window.confirm('Zur VS-Hardware wechseln?')) {
        navigate(`/manufacturing/vs-hardware/${response.data.vs_hardware_id}`);
      }
    } catch (error) {
      alert('Fehler beim Erstellen: ' + error.message);
    } finally {
      setCreatingVSHardware(false);
    }
  };

  // Time Entry Actions
  const handleAddTimeEntry = async () => {
    if (!id || id === 'new') { alert('Bitte speichern Sie das Projekt zuerst'); return; }
    if (!newTimeEntry.hours_spent || !newTimeEntry.description.trim()) {
      alert('Bitte Zeit und Beschreibung eingeben');
      return;
    }
    setAddingTimeEntry(true);
    try {
      const payload = {
        date: newTimeEntry.date || new Date().toISOString().split('T')[0],
        time: newTimeEntry.time || new Date().toTimeString().split(' ')[0],
        employee: newTimeEntry.employee || project.assigned_to || null,
        hours_spent: newTimeEntry.hours_spent,
        description: newTimeEntry.description
      };
      const response = await api.post(`/development/projects/${id}/add_time_entry/`, payload);
      setProject(prev => ({ ...prev, time_entries: [response.data, ...prev.time_entries] }));
      setNewTimeEntry({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        employee: '',
        hours_spent: '',
        description: ''
      });
    } catch (error) {
      alert('Fehler beim Hinzufügen: ' + error.message);
    } finally {
      setAddingTimeEntry(false);
    }
  };

  const handleDeleteTimeEntry = async (entryId) => {
    if (!id || id === 'new') { alert('Bitte speichern Sie das Projekt zuerst'); return; }
    if (!window.confirm('Zeiteintrag wirklich löschen?')) return;
    try {
      await api.delete(`/development/projects/${id}/delete_time_entry/${entryId}/`);
      setProject(prev => ({ ...prev, time_entries: prev.time_entries.filter(e => e.id !== entryId) }));
    } catch (error) {
      alert('Fehler beim Löschen: ' + error.message);
    }
  };

  // Calculate totals
  const totalMaterialCost = project.material_items?.reduce((sum, item) => sum + (item.item_cost || 0), 0) || 0;
  const totalTimeSpent = project.time_entries?.reduce((sum, entry) => sum + parseFloat(entry.hours_spent || 0), 0) || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/development/projects')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Zurück zur Übersicht
        </button>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BeakerIcon className="h-10 w-10 text-purple-600 mr-4" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isNew ? 'Neues Entwicklungsprojekt' : `${project.project_number} - ${project.name}`}
              </h1>
              {!isNew && project.status_display && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                  project.status === 'completed' ? 'bg-green-100 text-green-800' :
                  project.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  project.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                  project.status === 'testing' ? 'bg-purple-100 text-purple-800' :
                  project.status === 'paused' ? 'bg-orange-100 text-orange-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {project.status_display}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" /> : <CheckIcon className="h-5 w-5 mr-2" />}
            Speichern
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      {!isNew && (
        <div className="border-b border-gray-200 mb-6">
          <nav className="tab-scroll -mb-px flex space-x-8">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                {tab.label}
                {tab.id === 'todos' && project.todos?.length > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                    {project.todos.filter(t => !t.is_completed).length}/{project.todos.length}
                  </span>
                )}
                {tab.id === 'time' && totalTimeSpent > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                    {totalTimeSpent.toFixed(1)}h
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg">
        {/* Details Tab */}
        {(activeTab === 'details' || isNew) && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Projektname *
                </label>
                <input
                  type="text"
                  value={project.name}
                  onChange={(e) => setProject(prev => ({ ...prev, name: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Name des Projekts"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={project.status}
                  onChange={(e) => setProject(prev => ({ ...prev, status: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zugewiesen an
                </label>
                <select
                  value={project.assigned_to || ''}
                  onChange={(e) => setProject(prev => ({ ...prev, assigned_to: e.target.value || null }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">-- Nicht zugewiesen --</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Geplantes Projektende
                </label>
                <input
                  type="date"
                  value={project.planned_end || ''}
                  onChange={(e) => setProject(prev => ({ ...prev, planned_end: e.target.value || null }))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              {!isNew && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Projektbeginn
                  </label>
                  <input
                    type="date"
                    value={project.project_start || ''}
                    disabled
                    className="block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beschreibung
              </label>
              <textarea
                rows={6}
                value={project.description}
                onChange={(e) => setProject(prev => ({ ...prev, description: e.target.value }))}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500"
                placeholder="Projektbeschreibung..."
              />
            </div>
          </div>
        )}

        {/* ToDo Tab */}
        {activeTab === 'todos' && !isNew && (
          <div className="p-6">
            {/* Add new ToDo */}
            <div className="mb-6 flex gap-2">
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500"
                placeholder="Neue Aufgabe hinzufügen..."
              />
              <button
                onClick={handleAddTodo}
                disabled={addingTodo || !newTodo.trim()}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                {addingTodo ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <PlusIcon className="h-5 w-5" />}
              </button>
            </div>

            {/* ToDo List */}
            <div className="space-y-2">
              {project.todos?.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Keine Aufgaben vorhanden</p>
              ) : (
                project.todos?.map(todo => (
                  <div
                    key={todo.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      todo.is_completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                    }`}
                  >
                    <button
                      onClick={() => handleToggleTodo(todo.id, todo.is_completed)}
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        todo.is_completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-purple-500'
                      }`}
                    >
                      {todo.is_completed && <CheckIcon className="h-4 w-4" />}
                    </button>
                    <span className={`flex-1 ${todo.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {todo.text}
                    </span>
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Comments Tab */}
        {activeTab === 'comments' && !isNew && (
          <div className="p-6">
            {/* Add Comment */}
            <div className="mb-6">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500 mb-2"
                placeholder="Neuen Kommentar hinzufügen..."
              />
              <button
                onClick={handleAddComment}
                disabled={addingComment || !newComment.trim()}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                {addingComment ? <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" /> : <PlusIcon className="h-5 w-5 mr-2" />}
                Kommentar hinzufügen
              </button>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {project.comments?.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Keine Kommentare vorhanden</p>
              ) : (
                project.comments?.map(comment => (
                  <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">{comment.created_by_name}</span>
                        <span className="text-gray-500 ml-2">
                          {new Date(comment.created_at).toLocaleString('de-DE')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Materials & Cost Calculation Tab */}
        {activeTab === 'materials' && !isNew && (
          <div className="p-6">
            {/* Material List */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Materialliste</h3>
                <button
                  onClick={() => refetchProject()}
                  disabled={!id || id === 'new'}
                  className="inline-flex items-center px-3 py-1.5 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 disabled:opacity-50 text-sm"
                  title="Materialpreise vom Server neu laden"
                >
                  <ArrowPathIcon className="h-4 w-4 mr-1.5" />
                  Preise aktualisieren
                </button>
              </div>
              
              {/* Add Material */}
              <div className="grid grid-cols-12 gap-2 mb-4">
                <div className="col-span-6 relative" ref={materialDropdownRef}>
                  <input
                    type="text"
                    value={selectedMaterialLabel || materialSearch}
                    onChange={(e) => {
                      setMaterialSearch(e.target.value);
                      setSelectedMaterialLabel('');
                      setNewMaterial(prev => ({ ...prev, material_supply: '' }));
                      if (e.target.value.length < 3) setShowMaterialDropdown(false);
                    }}
                    onFocus={() => { if (materialSearchResults.length > 0 && materialSearch.length >= 3) setShowMaterialDropdown(true); }}
                    placeholder="Mind. 3 Zeichen eingeben (Nr., Name, Lief.-Artikelnr.)..."
                    className="w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                  />
                  {showMaterialDropdown && materialSearchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {materialSearchResults.map(ms => (
                        <div
                          key={ms.id}
                          onClick={() => {
                            setNewMaterial(prev => ({ ...prev, material_supply: ms.id }));
                            setSelectedMaterialLabel(`${ms.visitron_part_number} - ${ms.name}`);
                            setMaterialSearch(ms.visitron_part_number);
                            setShowMaterialDropdown(false);
                          }}
                          className="px-3 py-2 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-0"
                        >
                          <div className="text-sm font-medium text-gray-900">{ms.visitron_part_number} — {ms.name}</div>
                          {ms.supplier_part_number && (
                            <div className="text-xs text-gray-500">Lief.-Artikelnr.: {ms.supplier_part_number}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {materialSearch.length > 0 && materialSearch.length < 3 && (
                    <div className="text-xs text-gray-400 mt-1">Noch {3 - materialSearch.length} Zeichen für Suche...</div>
                  )}
                </div>
                <input
                  type="number"
                  value={newMaterial.quantity}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  min="1"
                  step="1"
                  className="col-span-2 rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                  placeholder="Menge"
                />
                <input
                  type="text"
                  value={newMaterial.notes}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, notes: e.target.value }))}
                  className="col-span-3 rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                  placeholder="Notizen"
                />
                <button
                  onClick={handleAddMaterial}
                  disabled={addingMaterial || !newMaterial.material_supply}
                  className="col-span-1 inline-flex items-center justify-center px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {addingMaterial ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <PlusIcon className="h-5 w-5" />}
                </button>
              </div>

              {/* Material Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artikelnr.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lief.-Artikelnr.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" style={{minWidth: '200px'}}>Bezeichnung</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Menge</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stückpreis</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gesamt</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notizen</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {project.material_items?.map(item => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.material_supply_part_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.supplier_part_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500" style={{minWidth: '200px', maxWidth: '300px', whiteSpace: 'normal', wordWrap: 'break-word'}}>{item.material_supply_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateMaterialQuantity(item.id, parseInt(e.target.value) || 1)}
                            min="1"
                            step="1"
                            className="w-20 text-right rounded border-gray-300 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-right">
                          {item.unit_price?.toFixed(2)} €
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                          {item.item_cost?.toFixed(2)} €
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.notes}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleDeleteMaterial(item.id)} className="text-red-400 hover:text-red-600">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {project.material_items?.length > 0 && (
                      <tr className="bg-gray-50 font-medium">
                        <td colSpan="5" className="px-4 py-3 text-sm text-right">Summe Materialkosten:</td>
                        <td className="px-4 py-3 text-sm text-right">{totalMaterialCost.toFixed(2)} €</td>
                        <td colSpan="2"></td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {project.material_items?.length === 0 && (
                  <p className="text-gray-500 text-center py-8">Keine Materialien hinzugefügt</p>
                )}
              </div>
            </div>

            {/* Cost Calculation */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Kostenkalkulation</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arbeitsstunden</label>
                  <input
                    type="number"
                    value={costCalc.labor_hours}
                    onChange={(e) => setCostCalc(prev => ({ ...prev, labor_hours: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="0.5"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stundensatz (€)</label>
                  <input
                    type="number"
                    value={costCalc.labor_rate}
                    onChange={(e) => setCostCalc(prev => ({ ...prev, labor_rate: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    step="1"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arbeitskosten</label>
                  <div className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-700">
                    {(costCalc.labor_hours * costCalc.labor_rate).toFixed(2)} €
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entwicklungskosten gesamt (€)</label>
                  <input
                    type="number"
                    value={costCalc.development_cost_total}
                    onChange={(e) => setCostCalc(prev => ({ ...prev, development_cost_total: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Erwarteter Absatz (Stück)</label>
                  <input
                    type="number"
                    value={costCalc.expected_sales_volume}
                    onChange={(e) => setCostCalc(prev => ({ ...prev, expected_sales_volume: parseInt(e.target.value) || 1 }))}
                    min="1"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entwicklungskosten pro Stück</label>
                  <div className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-700">
                    {(costCalc.development_cost_total / (costCalc.expected_sales_volume || 1)).toFixed(2)} €
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Materialkosten</div>
                    <div className="text-lg font-semibold">{totalMaterialCost.toFixed(2)} €</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Arbeitskosten</div>
                    <div className="text-lg font-semibold">{(costCalc.labor_hours * costCalc.labor_rate).toFixed(2)} €</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Entwicklung/Stück</div>
                    <div className="text-lg font-semibold">{(costCalc.development_cost_total / (costCalc.expected_sales_volume || 1)).toFixed(2)} €</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Gesamtkosten/Stück</div>
                    <div className="text-xl font-bold text-purple-600">
                      {(totalMaterialCost + (costCalc.labor_hours * costCalc.labor_rate) + (costCalc.development_cost_total / (costCalc.expected_sales_volume || 1))).toFixed(2)} €
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveCostCalculation}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  <CheckIcon className="h-5 w-5 mr-2" />
                  Kalkulation speichern
                </button>
                <button
                  onClick={handleCreateVSHardware}
                  disabled={creatingVSHardware || project.material_items?.length === 0}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {creatingVSHardware ? <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" /> : <CpuChipIcon className="h-5 w-5 mr-2" />}
                  VS-Hardware erstellen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && !isNew && (
          <div className="p-6">
            <FileUpload
              attachments={project.attachments || []}
              ticketId={id}
              ticketType="development"
              onUploadSuccess={(newAttachment) => {
                setProject(prev => ({
                  ...prev,
                  attachments: [...(prev.attachments || []), newAttachment]
                }));
              }}
              onDeleteSuccess={(deletedId) => {
                setProject(prev => ({
                  ...prev,
                  attachments: (prev.attachments || []).filter(a => a.id !== deletedId)
                }));
              }}
            />
          </div>
        )}

        {/* Time Tracking Tab */}
        {activeTab === 'time' && !isNew && (
          <div className="p-6">
            {/* Summary */}
            <div className="bg-purple-50 rounded-lg p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center">
                <ClockIcon className="h-8 w-8 text-purple-600 mr-3" />
                <div>
                  <div className="text-sm text-gray-500">Gesamte Arbeitszeit</div>
                  <div className="text-2xl font-bold text-purple-600">{totalTimeSpent.toFixed(1)} Stunden</div>
                </div>
              </div>
            </div>

            {/* Add Time Entry */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Neuer Zeiteintrag</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <input
                  type="date"
                  value={newTimeEntry.date}
                  onChange={(e) => setNewTimeEntry(prev => ({ ...prev, date: e.target.value }))}
                  className="rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
                <input
                  type="time"
                  value={newTimeEntry.time}
                  onChange={(e) => setNewTimeEntry(prev => ({ ...prev, time: e.target.value }))}
                  className="rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
                <select
                  value={newTimeEntry.employee}
                  onChange={(e) => setNewTimeEntry(prev => ({ ...prev, employee: e.target.value }))}
                  className="rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                >
                  <option value="">-- Mitarbeiter --</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={newTimeEntry.hours_spent}
                  onChange={(e) => setNewTimeEntry(prev => ({ ...prev, hours_spent: e.target.value }))}
                  min="0.25"
                  step="0.25"
                  placeholder="Stunden"
                  className="rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
                <button
                  onClick={handleAddTimeEntry}
                  disabled={addingTimeEntry}
                  className="inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {addingTimeEntry ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <PlusIcon className="h-5 w-5" />}
                </button>
              </div>
              <div className="mt-3">
                <input
                  type="text"
                  value={newTimeEntry.description}
                  onChange={(e) => setNewTimeEntry(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Beschreibung der Tätigkeit..."
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
              </div>
            </div>

            {/* Time Entries List */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uhrzeit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mitarbeiter</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stunden</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Beschreibung</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {project.time_entries?.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                        Keine Zeiteinträge vorhanden
                      </td>
                    </tr>
                  ) : (
                    project.time_entries?.map(entry => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(entry.date).toLocaleDateString('de-DE')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{entry.time?.substring(0, 5)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{entry.employee_name}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                          {parseFloat(entry.hours_spent).toFixed(2)}h
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{entry.description}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDeleteTimeEntry(entry.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DevelopmentProjectEdit;
