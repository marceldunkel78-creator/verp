import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import FileUpload from '../components/FileUpload';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  ChatBubbleLeftEllipsisIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'in_progress', label: 'In Bearbeitung' },
  { value: 'resolved', label: 'Gelöst' },
  { value: 'closed', label: 'Geschlossen' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Niedrig' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Hoch' },
  { value: 'urgent', label: 'Dringend' }
];

const CATEGORY_OPTIONS = [
  { value: 'hardware', label: 'Hardware' },
  { value: 'software', label: 'Software' },
  { value: 'application', label: 'Applikation' },
  { value: 'other', label: 'Sonstiges' }
];

const TroubleshootingEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [ticket, setTicket] = useState({
    title: '',
    description: '',
    status: 'new',
    priority: 'normal',
    category: 'other',
    assigned_to: '',
    affected_version: '',
    root_cause: '',
    corrective_action: '',
    related_tickets: '',
    files: '',
    last_comments: ''
  });
  
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [users, setUsers] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      // Lade User für Dropdown
      const usersRes = await api.get('/users/');
      const userData = usersRes.data.results || usersRes.data || [];
      setUsers(Array.isArray(userData) ? userData : []);
      
      if (!isNew) {
        const ticketRes = await api.get(`/service/troubleshooting/${id}/`);
        const ticketData = ticketRes.data;
        setTicket({
          ...ticketData,
          assigned_to: ticketData.assigned_to || '',
        });
        setComments(ticketData.comments || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTicket(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const payload = {
        ...ticket,
        assigned_to: ticket.assigned_to || null,
      };
      
      if (isNew) {
        const response = await api.post('/service/troubleshooting/', payload);
        navigate(`/service/troubleshooting/${response.data.id}`);
      } else {
        await api.patch(`/service/troubleshooting/${id}/`, payload);
        fetchData();
      }
    } catch (error) {
      console.error('Error saving ticket:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setAddingComment(true);
    try {
      await api.post(`/service/troubleshooting/${id}/add_comment/`, { comment: newComment });
      setNewComment('');
      fetchData();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Fehler beim Hinzufügen des Kommentars');
    } finally {
      setAddingComment(false);
    }
  };

  const formatDate = (dateStr) => {
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
      <div className="flex justify-center items-center h-64">
        <ArrowPathIcon className="h-12 w-12 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/service/troubleshooting')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zur Übersicht
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <WrenchScrewdriverIcon className="h-7 w-7 mr-2 text-orange-600" />
              {isNew ? 'Neues Troubleshooting-Ticket' : `Ticket ${ticket.ticket_number || ticket.legacy_id}`}
            </h1>
            {!isNew && (
              <p className="text-sm text-gray-500">
                Erstellt: {formatDate(ticket.created_at)} {ticket.author_name && `von ${ticket.author_name}`}
              </p>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Linke Spalte - Hauptformular */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basis-Infos */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Ticket-Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Thema/Titel *</label>
                  <input
                    type="text"
                    name="title"
                    value={ticket.title}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    name="status"
                    value={ticket.status}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priorität</label>
                  <select
                    name="priority"
                    value={ticket.priority}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  >
                    {PRIORITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kategorie</label>
                  <select
                    name="category"
                    value={ticket.category}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  >
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Zugewiesen an</label>
                  <select
                    name="assigned_to"
                    value={ticket.assigned_to}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  >
                    <option value="">-- Nicht zugewiesen --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.username})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Betroffene Version</label>
                  <input
                    type="text"
                    name="affected_version"
                    value={ticket.affected_version}
                    onChange={handleChange}
                    placeholder="z.B. VisiView 7.0.8"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Zugehörige Tickets</label>
                  <input
                    type="text"
                    name="related_tickets"
                    value={ticket.related_tickets}
                    onChange={handleChange}
                    placeholder="z.B. #1234, #5678"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                  <textarea
                    name="description"
                    value={ticket.description}
                    onChange={handleChange}
                    rows={6}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Troubleshooting Details */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Troubleshooting</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Root Cause (Ursache)</label>
                  <textarea
                    name="root_cause"
                    value={ticket.root_cause}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Was ist die Ursache des Problems?"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Corrective Action (Lösung)</label>
                  <textarea
                    name="corrective_action"
                    value={ticket.corrective_action}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Wie kann das Problem behoben werden?"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Dateien</label>
                  <textarea
                    name="files"
                    value={ticket.files}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Dateinamen oder Links"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Dateien */}
            {!isNew && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Dateien
                </h3>
                <FileUpload
                  attachments={ticket.attachments || []}
                  ticketId={ticket.id}
                  ticketType="troubleshooting"
                  onUploadSuccess={(newAttachment) => {
                    setTicket(prev => ({
                      ...prev,
                      attachments: [...(prev.attachments || []), newAttachment]
                    }));
                  }}
                  onDeleteSuccess={(attachmentId) => {
                    setTicket(prev => ({
                      ...prev,
                      attachments: prev.attachments.filter(att => att.id !== attachmentId)
                    }));
                  }}
                />
              </div>
            )}

            {/* Kommentare (nur bei bestehenden Tickets) */}
            {!isNew && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <ChatBubbleLeftEllipsisIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Kommentare ({comments.length})
                </h3>
                
                {/* Neuer Kommentar */}
                <div className="mb-4">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Neuen Kommentar hinzufügen..."
                    rows={3}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={addingComment || !newComment.trim()}
                      className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                    >
                      <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                      {addingComment ? 'Speichern...' : 'Kommentar hinzufügen'}
                    </button>
                  </div>
                </div>
                
                {/* Kommentarliste */}
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Keine Kommentare vorhanden</p>
                  ) : (
                    comments.map(comment => (
                      <div key={comment.id} className="border-l-4 border-orange-200 pl-4 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">{comment.created_by_name}</span>
                          <span className="text-xs text-gray-500">{formatDate(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {/* Letzte Kommentare (importiert) */}
            {ticket.last_comments && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Importierte Kommentare</h3>
                <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-md">
                  {ticket.last_comments}
                </div>
              </div>
            )}
          </div>

          {/* Rechte Spalte - Metadaten & Speichern */}
          <div className="space-y-6">
            {/* Info Box */}
            {!isNew && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Info</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Ticket-Nr.</dt>
                    <dd className="text-gray-900 font-medium">{ticket.ticket_number}</dd>
                  </div>
                  {ticket.legacy_id && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Legacy ID</dt>
                      <dd className="text-gray-900">#{ticket.legacy_id}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Erstellt</dt>
                    <dd className="text-gray-900">{formatDate(ticket.created_at)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Aktualisiert</dt>
                    <dd className="text-gray-900">{formatDate(ticket.updated_at)}</dd>
                  </div>
                  {ticket.author_name && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Autor</dt>
                      <dd className="text-gray-900">{ticket.author_name}</dd>
                    </div>
                  )}
                  {ticket.last_changed_by_name && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Zuletzt geändert von</dt>
                      <dd className="text-gray-900">{ticket.last_changed_by_name}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Speichern Button */}
            <div className="bg-white shadow rounded-lg p-6">
              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                    Speichern...
                  </>
                ) : (
                  isNew ? 'Ticket erstellen' : 'Änderungen speichern'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default TroubleshootingEdit;
