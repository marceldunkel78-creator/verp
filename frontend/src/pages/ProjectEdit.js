import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import SystemSearch from '../components/SystemSearch';
import {
  ChatBubbleLeftEllipsisIcon,
  PaperAirplaneIcon,
  TrashIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserIcon,
  DocumentTextIcon,
  PlusIcon,
  CheckIcon,
  ClockIcon,
  DocumentArrowUpIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  PlayIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';

const ProjectEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basisinformationen');
  const [isEditing, setIsEditing] = useState(false);
  const [editedProject, setEditedProject] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Employee list for responsible employee selection
  const [employees, setEmployees] = useState([]);
  
  // Comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  
  // Calendar expansion state
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  
  // Quotations state
  const [quotations, setQuotations] = useState([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  
  // Demo planning / ToDos state
  const [todos, setTodos] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);
  const [isDemoEditing, setIsDemoEditing] = useState(false);
  const [demoFormData, setDemoFormData] = useState({});
  const [savingDemo, setSavingDemo] = useState(false);
  
  // Ausschreibung / Documents state
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isTenderEditing, setIsTenderEditing] = useState(false);
  const [tenderFormData, setTenderFormData] = useState({});
  const [savingTender, setSavingTender] = useState(false);

  const statusOptions = [
    { value: 'NEU', label: 'Neu' },
    { value: 'IN_BEARBEITUNG', label: 'In Bearbeitung' },
    { value: 'ANGEBOT_ERSTELLT', label: 'Angebot erstellt' },
    { value: 'DEMO_GEPLANT', label: 'Demo geplant' },
    { value: 'AUSSCHREIBUNG', label: 'Ausschreibung' },
    { value: 'AUFTRAG_ERTEILT', label: 'Auftrag erteilt' },
    { value: 'IN_FERTIGUNG', label: 'In Fertigung' },
    { value: 'LIEFERUNG', label: 'Lieferung' },
    { value: 'INSTALLATION', label: 'Installation' },
    { value: 'ABGESCHLOSSEN', label: 'Abgeschlossen' },
    { value: 'STORNIERT', label: 'Storniert' }
  ];

  const tabs = [
    { id: 'basisinformationen', label: 'Basisinformationen' },
    { id: 'kommunikation', label: 'Kommunikation' },
    { id: 'angebote', label: 'Angebote' },
    { id: 'demoplanung', label: 'Demoplanung' },
    { id: 'ausschreibung', label: 'Ausschreibung' },
    { id: 'auftragsabwicklung', label: 'Auftragsabwicklung' },
    { id: 'fertigung', label: 'Fertigung' },
    { id: 'lieferung', label: 'Lieferung' },
    { id: 'installation', label: 'Installation' }
  ];

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await api.get('/users/employees/');
      const data = response.data.results || response.data || [];
      setEmployees(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
    }
  }, []);

  const fetchProject = useCallback(async () => {
    if (!id || id === 'new') {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await api.get(`/projects/projects/${id}/`);
      const data = response.data;
      setProject(data);
      setComments(data.comments || []);
      setQuotations(data.linked_quotations || []);
      
      // Normalize for editing
      setEditedProject({
        ...data,
        systems: data.systems || (data.systems_data ? data.systems_data.map(s => s.id) : []),
        responsible_employee: data.responsible_employee || ''
      });
      
      // Initialize demo form data
      setDemoFormData({
        demo_date_from: data.demo_date_from || '',
        demo_date_to: data.demo_date_to || '',
      });
      
      // Initialize tender form data
      setTenderFormData({
        tender_bidder_questions_deadline: data.tender_bidder_questions_deadline || '',
        tender_submission_deadline: data.tender_submission_deadline || '',
        tender_award_deadline: data.tender_award_deadline || '',
      });
    } catch (error) {
      console.error('Error fetching project:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);
  
  const fetchTodos = useCallback(async () => {
    if (!id) return;
    try {
      const response = await api.get(`/projects/projects/${id}/todos/`);
      setTodos(response.data || []);
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  }, [id]);
  
  const fetchDocuments = useCallback(async () => {
    if (!id) return;
    setLoadingDocuments(true);
    try {
      const response = await api.get(`/projects/projects/${id}/documents/`);
      setDocuments(response.data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEmployees();
    fetchProject();
  }, [fetchEmployees, fetchProject]);
  
  useEffect(() => {
    if (id && activeTab === 'demoplanung') {
      fetchTodos();
    }
  }, [id, activeTab, fetchTodos]);
  
  useEffect(() => {
    if (id && activeTab === 'ausschreibung') {
      fetchDocuments();
    }
  }, [id, activeTab, fetchDocuments]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (project) {
      setEditedProject({
        ...project,
        systems: project.systems || (project.systems_data ? project.systems_data.map(s => s.id) : []),
        responsible_employee: project.responsible_employee || ''
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        status: editedProject.status,
        name: editedProject.name,
        description: editedProject.description,
        responsible_employee: editedProject.responsible_employee || null,
        forecast_date: editedProject.forecast_date || null,
        forecast_revenue: editedProject.forecast_revenue || null,
        forecast_probability: editedProject.forecast_probability || null,
      };

      if (editedProject.systems && editedProject.systems.length > 0) {
        payload.systems = editedProject.systems;
      } else {
        payload.systems = [];
      }

      const response = await api.patch(`/projects/projects/${id}/`, payload);
      setProject(response.data);
      setComments(response.data.comments || []);
      
      setEditedProject({
        ...response.data,
        systems: response.data.systems || (response.data.systems_data ? response.data.systems_data.map(s => s.id) : []),
        responsible_employee: response.data.responsible_employee || ''
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Fehler beim Aktualisieren des Projekts: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditedProject(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // === Comment Functions ===
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setAddingComment(true);
    try {
      await api.post(`/projects/projects/${id}/add_comment/`, { comment: newComment });
      setNewComment('');
      // Refresh comments
      const response = await api.get(`/projects/projects/${id}/comments/`);
      setComments(response.data);
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Fehler beim Hinzufügen des Kommentars');
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Kommentar wirklich löschen?')) return;
    
    try {
      await api.delete(`/projects/projects/${id}/delete_comment/${commentId}/`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Fehler beim Löschen des Kommentars');
    }
  };

  // === ToDo Functions ===
  const handleAddTodo = async () => {
    if (!newTodoText.trim()) return;
    
    setAddingTodo(true);
    try {
      await api.post(`/projects/projects/${id}/add_todo/`, { text: newTodoText });
      setNewTodoText('');
      fetchTodos();
    } catch (error) {
      console.error('Error adding todo:', error);
      alert('Fehler beim Hinzufügen des ToDos');
    } finally {
      setAddingTodo(false);
    }
  };
  
  const handleToggleTodo = async (todoId, currentStatus) => {
    try {
      await api.patch(`/projects/projects/${id}/update_todo/${todoId}/`, {
        is_completed: !currentStatus
      });
      setTodos(prev => prev.map(t => 
        t.id === todoId ? { ...t, is_completed: !currentStatus } : t
      ));
    } catch (error) {
      console.error('Error updating todo:', error);
      alert('Fehler beim Aktualisieren des ToDos');
    }
  };
  
  const handleDeleteTodo = async (todoId) => {
    if (!window.confirm('ToDo wirklich löschen?')) return;
    
    try {
      await api.delete(`/projects/projects/${id}/delete_todo/${todoId}/`);
      setTodos(prev => prev.filter(t => t.id !== todoId));
    } catch (error) {
      console.error('Error deleting todo:', error);
      alert('Fehler beim Löschen des ToDos');
    }
  };
  
  // === Demo Planning Save ===
  const handleSaveDemo = async () => {
    setSavingDemo(true);
    try {
      const response = await api.patch(`/projects/projects/${id}/`, {
        demo_date_from: demoFormData.demo_date_from || null,
        demo_date_to: demoFormData.demo_date_to || null,
      });
      setProject(prev => ({
        ...prev,
        demo_date_from: response.data.demo_date_from,
        demo_date_to: response.data.demo_date_to,
        all_dates: response.data.all_dates,
      }));
      setIsDemoEditing(false);
    } catch (error) {
      console.error('Error saving demo dates:', error);
      alert('Fehler beim Speichern der Demo-Daten');
    } finally {
      setSavingDemo(false);
    }
  };
  
  // === Tender Save ===
  const handleSaveTender = async () => {
    setSavingTender(true);
    try {
      const response = await api.patch(`/projects/projects/${id}/`, {
        tender_bidder_questions_deadline: tenderFormData.tender_bidder_questions_deadline || null,
        tender_submission_deadline: tenderFormData.tender_submission_deadline || null,
        tender_award_deadline: tenderFormData.tender_award_deadline || null,
      });
      setProject(prev => ({
        ...prev,
        tender_bidder_questions_deadline: response.data.tender_bidder_questions_deadline,
        tender_submission_deadline: response.data.tender_submission_deadline,
        tender_award_deadline: response.data.tender_award_deadline,
        all_dates: response.data.all_dates,
      }));
      setIsTenderEditing(false);
    } catch (error) {
      console.error('Error saving tender dates:', error);
      alert('Fehler beim Speichern der Ausschreibungsdaten');
    } finally {
      setSavingTender(false);
    }
  };
  
  // === Document Functions ===
  const handleFileUpload = async (file) => {
    if (!file) return;
    
    setUploadingDocument(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      await api.post(`/projects/projects/${id}/upload_document/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      fetchDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Fehler beim Hochladen: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploadingDocument(false);
    }
  };
  
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };
  
  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };
  
  const handleDownloadDocument = async (docId, filename) => {
    try {
      const response = await api.get(`/projects/projects/${id}/download_document/${docId}/`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Fehler beim Herunterladen');
    }
  };
  
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Dokument wirklich löschen?')) return;
    
    try {
      await api.delete(`/projects/projects/${id}/delete_document/${docId}/`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Fehler beim Löschen des Dokuments');
    }
  };
  
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const isDeadlineSoon = (dateStr) => {
    if (!dateStr) return false;
    const deadline = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  };
  
  const isDeadlinePassed = (dateStr) => {
    if (!dateStr) return false;
    const deadline = new Date(dateStr);
    const today = new Date();
    return deadline < today;
  };

  const getStatusColor = (status) => {
    const colors = {
      'NEU': 'bg-green-100 text-green-800',
      'IN_BEARBEITUNG': 'bg-blue-100 text-blue-800',
      'ANGEBOT_ERSTELLT': 'bg-yellow-100 text-yellow-800',
      'DEMO_GEPLANT': 'bg-purple-100 text-purple-800',
      'AUSSCHREIBUNG': 'bg-orange-100 text-orange-800',
      'AUFTRAG_ERTEILT': 'bg-indigo-100 text-indigo-800',
      'IN_FERTIGUNG': 'bg-cyan-100 text-cyan-800',
      'LIEFERUNG': 'bg-teal-100 text-teal-800',
      'INSTALLATION': 'bg-lime-100 text-lime-800',
      'ABGESCHLOSSEN': 'bg-gray-100 text-gray-800',
      'STORNIERT': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getDateTypeColor = (type) => {
    const colors = {
      'forecast': 'bg-blue-100 text-blue-800',
      'demo': 'bg-purple-100 text-purple-800',
      'tender': 'bg-orange-100 text-orange-800',
      'delivery': 'bg-teal-100 text-teal-800',
      'installation': 'bg-green-100 text-green-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600">Projekt nicht gefunden</p>
          <button
            onClick={() => navigate('/sales/projects')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Zurück zur Liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header mit Projektinformationen und Kalender */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-2xl font-bold">{project.project_number}</h1>
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(project.status)}`}>
                {project.status_display}
              </span>
            </div>
            <div className="text-gray-600 space-y-1">
              <p className="text-lg font-medium">{project.customer_name}</p>
              {project.name && <p className="text-gray-700">{project.name}</p>}
              {project.responsible_employee_name && (
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <UserIcon className="h-4 w-4" />
                  Zuständig: {project.responsible_employee_name}
                </p>
              )}
              {project.systems_data && project.systems_data.length > 0 && (
                <div className="mt-2">
                  <span className="text-sm font-medium">Systeme: </span>
                  <span className="text-sm">
                    {project.systems_data.map(sys => sys.system_number).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Kalender-Widget */}
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => navigate('/sales/projects')}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Zurück zur Liste
            </button>
            
            {/* Expandierbarer Kalender */}
            <div className="relative">
              <button
                onClick={() => setCalendarExpanded(!calendarExpanded)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
              >
                <CalendarIcon className="h-5 w-5" />
                Termine
                {calendarExpanded ? (
                  <ChevronUpIcon className="h-4 w-4" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4" />
                )}
              </button>
              
              {calendarExpanded && project.all_dates && project.all_dates.length > 0 && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border rounded-lg shadow-lg z-10 p-4">
                  <h4 className="font-semibold mb-3 text-gray-700">Projekttermine</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {project.all_dates.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className={`text-xs px-2 py-1 rounded ${getDateTypeColor(item.type)}`}>
                          {item.label}
                        </span>
                        <span className="text-sm font-medium">
                          {formatDate(item.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {calendarExpanded && (!project.all_dates || project.all_dates.length === 0) && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border rounded-lg shadow-lg z-10 p-4">
                  <p className="text-gray-500 text-sm text-center">Keine Termine eingetragen</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* ==================== BASISINFORMATIONEN TAB ==================== */}
          {activeTab === 'basisinformationen' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Basisinformationen</h2>
                {!isEditing ? (
                  <button
                    onClick={handleEdit}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Bearbeiten
                  </button>
                ) : (
                  <div className="space-x-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? 'Speichern...' : 'Speichern'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
                    >
                      Abbrechen
                    </button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Projektnummer (readonly) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Projektnummer</label>
                  <p className="text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded">{project.project_number}</p>
                </div>
                
                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  {isEditing ? (
                    <select
                      value={editedProject.status || ''}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {statusOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900">
                      <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(project.status)}`}>
                        {project.status_display}
                      </span>
                    </p>
                  )}
                </div>
                
                {/* Kunde (readonly) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kunde</label>
                  <p className="text-gray-900">{project.customer_name}</p>
                  <p className="text-xs text-gray-500">Kundennummer: {project.customer_number}</p>
                </div>
                
                {/* Zuständiger Mitarbeiter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zuständiger Mitarbeiter</label>
                  {isEditing ? (
                    <select
                      value={editedProject.responsible_employee || ''}
                      onChange={(e) => handleInputChange('responsible_employee', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Nicht zugewiesen --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} {emp.employee_id ? `(${emp.employee_id})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900">
                      {project.responsible_employee_name || (
                        <span className="text-gray-400 italic">Nicht zugewiesen</span>
                      )}
                    </p>
                  )}
                </div>
                
                {/* Projektname */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Projektname</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedProject.name || ''}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Projektname eingeben..."
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{project.name || <span className="text-gray-400 italic">Kein Name</span>}</p>
                  )}
                </div>
                
                {/* Systemauswahl */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Zugeordnete Systeme</label>
                  {isEditing ? (
                    <SystemSearch
                      customerId={project.customer}
                      selectedSystems={editedProject.systems || []}
                      onChange={(systemIds) => setEditedProject(prev => ({ ...prev, systems: systemIds }))}
                    />
                  ) : (
                    project.systems_data && project.systems_data.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {project.systems_data.map(sys => (
                          <div key={sys.id} className="bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg">
                            <p className="font-medium text-blue-800">{sys.system_number}</p>
                            {sys.system_name && (
                              <p className="text-sm text-blue-600">{sys.system_name}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 italic">Keine Systeme zugeordnet</p>
                    )
                  )}
                </div>
                
                {/* Beschreibung */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Projektbeschreibung</label>
                  {isEditing ? (
                    <textarea
                      value={editedProject.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={4}
                      placeholder="Projektbeschreibung eingeben..."
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                      {project.description || <span className="text-gray-400 italic">Keine Beschreibung</span>}
                    </p>
                  )}
                </div>
                
                {/* Erstellt am / Erstellt von */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Erstellt am</label>
                  <p className="text-gray-900">{formatDateTime(project.created_at)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Erstellt von</label>
                  <p className="text-gray-900">{project.created_by_name || '-'}</p>
                </div>
              </div>

              {/* Forecast Abschnitt */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-blue-600">📊 Forecast / Prognose</h3>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Erwartetes Auftragsdatum
                    </label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editedProject.forecast_date || ''}
                        onChange={(e) => handleInputChange('forecast_date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {project.forecast_date ? formatDate(project.forecast_date) : '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Erwarteter Umsatz (€)
                    </label>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editedProject.forecast_revenue || ''}
                        onChange={(e) => handleInputChange('forecast_revenue', e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {project.forecast_revenue 
                          ? Number(project.forecast_revenue).toLocaleString('de-DE', {
                              style: 'currency',
                              currency: 'EUR'
                            })
                          : '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wahrscheinlichkeit (%)
                    </label>
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editedProject.forecast_probability || ''}
                        onChange={(e) => handleInputChange('forecast_probability', e.target.value)}
                        placeholder="0-100"
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900">
                        {project.forecast_probability !== null && project.forecast_probability !== undefined
                          ? `${project.forecast_probability}%`
                          : '-'}
                      </p>
                    )}
                  </div>
                </div>
                {!isEditing && project.forecast_revenue && project.forecast_probability && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Gewichteter Forecast:</span>{' '}
                      {(Number(project.forecast_revenue) * Number(project.forecast_probability) / 100).toLocaleString('de-DE', {
                        style: 'currency',
                        currency: 'EUR'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== KOMMUNIKATION TAB ==================== */}
          {activeTab === 'kommunikation' && (
            <div>
              <div className="flex items-center gap-2 mb-6">
                <ChatBubbleLeftEllipsisIcon className="h-6 w-6 text-blue-600" />
                <h2 className="text-xl font-bold">Kommunikation</h2>
              </div>
              
              {/* Neuen Kommentar hinzufügen */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Neuen Kommentar hinzufügen
                </label>
                <div className="flex gap-3">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    placeholder="Kommentar eingeben..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={addingComment || !newComment.trim()}
                    className="self-end px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                    {addingComment ? 'Senden...' : 'Senden'}
                  </button>
                </div>
              </div>
              
              {/* Kommentarliste */}
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <ChatBubbleLeftEllipsisIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">Noch keine Kommentare vorhanden</p>
                    <p className="text-sm text-gray-400">Fügen Sie den ersten Kommentar hinzu</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <UserIcon className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {comment.created_by_name || 'Unbekannt'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(comment.created_at)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50"
                          title="Kommentar löschen"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="pl-10">
                        <p className="text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ==================== ANGEBOTE TAB ==================== */}
          {activeTab === 'angebote' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                  <h2 className="text-xl font-bold">Angebote</h2>
                </div>
                <button
                  onClick={() => navigate(`/sales/quotations/new?customer=${project.customer}&project=${id}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <PlusIcon className="h-5 w-5" />
                  Neues Angebot erstellen
                </button>
              </div>
              
              {/* Verknüpfte Angebote */}
              {quotations && quotations.length > 0 ? (
                <div className="space-y-4">
                  {quotations.map((quote) => (
                    <div 
                      key={quote.id} 
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/sales/customer-orders/${quote.id}`)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono font-semibold text-blue-600">{quote.order_number}</span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              quote.status === 'ANGEBOT' ? 'bg-yellow-100 text-yellow-800' :
                              quote.status === 'AUFTRAG' ? 'bg-green-100 text-green-800' :
                              quote.status === 'STORNIERT' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {quote.status_display || quote.status}
                            </span>
                          </div>
                          {quote.description && (
                            <p className="text-gray-600 text-sm mb-2">{quote.description}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            Erstellt: {formatDate(quote.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg">
                            {quote.total_amount ? Number(quote.total_amount).toLocaleString('de-DE', {
                              style: 'currency',
                              currency: 'EUR'
                            }) : '-'}
                          </p>
                          <LinkIcon className="h-5 w-5 text-gray-400 ml-auto mt-2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 mb-2">Noch keine Angebote vorhanden</p>
                  <p className="text-sm text-gray-400">Erstellen Sie ein neues Angebot für dieses Projekt</p>
                </div>
              )}
              
              {/* Info-Box */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Hinweis:</strong> Angebote werden automatisch mit dem Projekt verknüpft, 
                  wenn Sie über den Button "Neues Angebot erstellen" ein Angebot anlegen.
                </p>
              </div>
            </div>
          )}

          {/* ==================== DEMOPLANUNG TAB ==================== */}
          {activeTab === 'demoplanung' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <PlayIcon className="h-6 w-6 text-purple-600" />
                  <h2 className="text-xl font-bold">Demoplanung</h2>
                </div>
                {!isDemoEditing ? (
                  <button
                    onClick={() => setIsDemoEditing(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Bearbeiten
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveDemo}
                      disabled={savingDemo}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {savingDemo ? 'Speichern...' : 'Speichern'}
                    </button>
                    <button
                      onClick={() => {
                        setIsDemoEditing(false);
                        setDemoFormData({
                          demo_date_from: project.demo_date_from || '',
                          demo_date_to: project.demo_date_to || '',
                        });
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      Abbrechen
                    </button>
                  </div>
                )}
              </div>
              
              {/* Demo-Termine */}
              <div className="bg-purple-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-purple-800 mb-4 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Demo-Termine
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Demo-Datum von</label>
                    {isDemoEditing ? (
                      <input
                        type="date"
                        value={demoFormData.demo_date_from || ''}
                        onChange={(e) => setDemoFormData(prev => ({ ...prev, demo_date_from: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <p className="text-gray-900 bg-white px-3 py-2 rounded-lg">
                        {project.demo_date_from ? formatDate(project.demo_date_from) : '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Demo-Datum bis</label>
                    {isDemoEditing ? (
                      <input
                        type="date"
                        value={demoFormData.demo_date_to || ''}
                        onChange={(e) => setDemoFormData(prev => ({ ...prev, demo_date_to: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    ) : (
                      <p className="text-gray-900 bg-white px-3 py-2 rounded-lg">
                        {project.demo_date_to ? formatDate(project.demo_date_to) : '-'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* ToDo-Liste */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <ListBulletIcon className="h-5 w-5" />
                  ToDo-Liste für Demo
                </h3>
                
                {/* Neues ToDo hinzufügen */}
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    value={newTodoText}
                    onChange={(e) => setNewTodoText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                    placeholder="Neues ToDo eingeben..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleAddTodo}
                    disabled={addingTodo || !newTodoText.trim()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <PlusIcon className="h-5 w-5" />
                    {addingTodo ? 'Hinzufügen...' : 'Hinzufügen'}
                  </button>
                </div>
                
                {/* ToDo-Liste */}
                {todos.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ListBulletIcon className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                    <p>Noch keine ToDos vorhanden</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todos.map((todo) => (
                      <div 
                        key={todo.id} 
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          todo.is_completed 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <button
                          onClick={() => handleToggleTodo(todo.id, todo.is_completed)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            todo.is_completed 
                              ? 'bg-green-500 border-green-500 text-white' 
                              : 'border-gray-300 hover:border-purple-500'
                          }`}
                        >
                          {todo.is_completed && <CheckIcon className="h-4 w-4" />}
                        </button>
                        <span className={`flex-1 ${todo.is_completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                          {todo.text}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(todo.created_at)}
                        </span>
                        <button
                          onClick={() => handleDeleteTodo(todo.id)}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Statistik */}
                {todos.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {todos.filter(t => t.is_completed).length} von {todos.length} erledigt
                      </span>
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${(todos.filter(t => t.is_completed).length / todos.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== AUSSCHREIBUNG TAB ==================== */}
          {activeTab === 'ausschreibung' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-6 w-6 text-orange-600" />
                  <h2 className="text-xl font-bold">Ausschreibung</h2>
                </div>
                {!isTenderEditing ? (
                  <button
                    onClick={() => setIsTenderEditing(true)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Fristen bearbeiten
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTender}
                      disabled={savingTender}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {savingTender ? 'Speichern...' : 'Speichern'}
                    </button>
                    <button
                      onClick={() => {
                        setIsTenderEditing(false);
                        setTenderFormData({
                          tender_bidder_questions_deadline: project.tender_bidder_questions_deadline || '',
                          tender_submission_deadline: project.tender_submission_deadline || '',
                          tender_award_deadline: project.tender_award_deadline || '',
                        });
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      Abbrechen
                    </button>
                  </div>
                )}
              </div>
              
              {/* Ausschreibungsfristen */}
              <div className="bg-orange-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-orange-800 mb-4 flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Ausschreibungsfristen
                </h3>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ende Bieterfragen
                    </label>
                    {isTenderEditing ? (
                      <input
                        type="date"
                        value={tenderFormData.tender_bidder_questions_deadline || ''}
                        onChange={(e) => setTenderFormData(prev => ({ ...prev, tender_bidder_questions_deadline: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    ) : (
                      <div className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
                        isDeadlinePassed(project.tender_bidder_questions_deadline) 
                          ? 'bg-red-100 text-red-800' 
                          : isDeadlineSoon(project.tender_bidder_questions_deadline) 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-white text-gray-900'
                      }`}>
                        {isDeadlinePassed(project.tender_bidder_questions_deadline) && (
                          <ExclamationTriangleIcon className="h-4 w-4" />
                        )}
                        {project.tender_bidder_questions_deadline ? formatDate(project.tender_bidder_questions_deadline) : '-'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Angebotsabgabefrist
                    </label>
                    {isTenderEditing ? (
                      <input
                        type="date"
                        value={tenderFormData.tender_submission_deadline || ''}
                        onChange={(e) => setTenderFormData(prev => ({ ...prev, tender_submission_deadline: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    ) : (
                      <div className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
                        isDeadlinePassed(project.tender_submission_deadline) 
                          ? 'bg-red-100 text-red-800' 
                          : isDeadlineSoon(project.tender_submission_deadline) 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-white text-gray-900'
                      }`}>
                        {isDeadlinePassed(project.tender_submission_deadline) && (
                          <ExclamationTriangleIcon className="h-4 w-4" />
                        )}
                        {project.tender_submission_deadline ? formatDate(project.tender_submission_deadline) : '-'}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Zuschlagsfrist
                    </label>
                    {isTenderEditing ? (
                      <input
                        type="date"
                        value={tenderFormData.tender_award_deadline || ''}
                        onChange={(e) => setTenderFormData(prev => ({ ...prev, tender_award_deadline: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    ) : (
                      <div className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
                        isDeadlinePassed(project.tender_award_deadline) 
                          ? 'bg-red-100 text-red-800' 
                          : isDeadlineSoon(project.tender_award_deadline) 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-white text-gray-900'
                      }`}>
                        {isDeadlinePassed(project.tender_award_deadline) && (
                          <ExclamationTriangleIcon className="h-4 w-4" />
                        )}
                        {project.tender_award_deadline ? formatDate(project.tender_award_deadline) : '-'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Dokumente hochladen */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <DocumentArrowUpIcon className="h-5 w-5" />
                  Ausschreibungsunterlagen
                </h3>
                
                {/* Upload-Bereich */}
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${
                    isDragging 
                      ? 'border-orange-500 bg-orange-50' 
                      : 'border-gray-300 hover:border-orange-400'
                  }`}
                >
                  {uploadingDocument ? (
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mb-3"></div>
                      <p className="text-gray-600">Datei wird hochgeladen...</p>
                    </div>
                  ) : (
                    <>
                      <DocumentArrowUpIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-600 mb-2">
                        Dateien hier ablegen oder{' '}
                        <label className="text-orange-600 hover:text-orange-700 cursor-pointer underline">
                          durchsuchen
                          <input
                            type="file"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </label>
                      </p>
                      <p className="text-xs text-gray-400">
                        PDF, Word, Excel, Bilder bis 50 MB
                      </p>
                    </>
                  )}
                </div>
                
                {/* Dokumentenliste */}
                {loadingDocuments ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <DocumentTextIcon className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                    <p>Noch keine Dokumente hochgeladen</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div 
                        key={doc.id} 
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100"
                      >
                        <DocumentTextIcon className="h-8 w-8 text-orange-500" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{doc.filename}</p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(doc.file_size)} • Hochgeladen am {formatDate(doc.uploaded_at)}
                            {doc.uploaded_by_name && ` von ${doc.uploaded_by_name}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownloadDocument(doc.id, doc.filename)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="Herunterladen"
                        >
                          <ArrowDownTrayIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Löschen"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Info-Box für Fristen */}
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    <strong>Hinweis:</strong> Bei gesetzten Fristen werden automatisch Erinnerungen 
                    an den zuständigen Mitarbeiter erstellt (1 Tag vor Ablauf).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ==================== PLACEHOLDER TABS ==================== */}
          {activeTab === 'auftragsabwicklung' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Auftragsabwicklung</h2>
              <p className="text-gray-500">Auftragsabwicklung-Modul wird noch entwickelt...</p>
            </div>
          )}

          {activeTab === 'fertigung' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Fertigung</h2>
              <p className="text-gray-500">Fertigungs-Modul wird noch entwickelt...</p>
            </div>
          )}

          {activeTab === 'lieferung' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Lieferung</h2>
              <p className="text-gray-500">Lieferungs-Modul wird noch entwickelt...</p>
            </div>
          )}

          {activeTab === 'installation' && (
            <div>
              <h2 className="text-xl font-bold mb-4">Installation</h2>
              <p className="text-gray-500">Installations-Modul wird noch entwickelt...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectEdit;
