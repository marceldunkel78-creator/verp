import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import FileUpload from '../components/FileUpload';

const SalesTicketEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;

  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState({
    category: 'appnote',
    status: 'new',
    title: '',
    description: '',
    assigned_to: '',
    created_by: '',
    due_date: '',
    completed_date: '',
    notes: ''
  });

  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [selectedWatchers, setSelectedWatchers] = useState([]);
  const [changeLogs, setChangeLogs] = useState([]);

  // Kategorie-Optionen
  const categories = [
    { value: 'appnote', label: 'AppNote' },
    { value: 'technote', label: 'TechNote' },
    { value: 'usermanual', label: 'User Manual' },
    { value: 'fieldservicemanual', label: 'Field Service Manual' },
    { value: 'brochure', label: 'Broschüre' },
    { value: 'newsletter', label: 'Newsletter' },
    { value: 'trainingvideo', label: 'Training Video' },
    { value: 'marketingvideo', label: 'Marketing Video' },
    { value: 'helparticle', label: 'Helpeintrag' },
    { value: 'marketresearch', label: 'Markterkundung' }
  ];

  // Status-Optionen
  const statuses = [
    { value: 'new', label: 'Neu' },
    { value: 'assigned', label: 'Zugewiesen' },
    { value: 'in_progress', label: 'In Bearbeitung' },
    { value: 'review', label: 'Review' },
    { value: 'completed', label: 'Erledigt' },
    { value: 'rejected', label: 'Abgelehnt' }
  ];

  useEffect(() => {
    loadUsers();
    if (!isNew) {
      loadTicket();
    }
  }, [id]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users/employees/');
      const data = response.data.results || response.data || [];
      // Map Employees to actual User IDs when available (EmployeeSerializer provides `user_id`)
      const mapped = (data || [])
        .filter((e) => e && (e.user_id || e.user_id === 0 || e.user_id === '0'))
        .map((e) => ({ id: e.user_id, first_name: e.first_name, last_name: e.last_name }));
      setUsers(mapped);
    } catch (error) {
      console.error('Fehler beim Laden der Mitarbeiter:', error);
    }
  };

  const loadTicket = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/sales/sales-tickets/${id}/`);
      setTicket(response.data);
      setFormData({
        category: response.data.category,
        status: response.data.status,
        title: response.data.title,
        description: response.data.description || '',
        assigned_to: response.data.assigned_to || '',
        created_by: response.data.created_by || '',
        due_date: response.data.due_date || '',
        completed_date: response.data.completed_date || '',
        notes: response.data.notes || ''
      });
      setComments(response.data.comments || []);
      setSelectedWatchers(response.data.watchers || []);
      setChangeLogs(response.data.change_logs || []);
    } catch (error) {
      console.error('Fehler beim Laden des Tickets:', error);
      setError('Fehler beim Laden des Tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Normalize payload: ensure assigned_to is a single PK (number) and completed_date is YYYY-MM-DD
      const payload = { ...formData, watchers: selectedWatchers };
      if (Array.isArray(payload.assigned_to)) {
        payload.assigned_to = payload.assigned_to.length ? payload.assigned_to[0] : '';
      }
      if (payload.assigned_to === '') {
        payload.assigned_to = null;
      } else if (payload.assigned_to != null) {
        const n = Number(payload.assigned_to);
        payload.assigned_to = Number.isNaN(n) ? payload.assigned_to : n;
      }

      // Validate assigned_to exists in loaded users; if not, stop and show error
      if (payload.assigned_to != null) {
        const exists = (users || []).some((u) => Number(u.id) === Number(payload.assigned_to));
        if (!exists) {
          setError('Der ausgewählte Mitarbeiter existiert nicht. Bitte wählen Sie einen gültigen Nutzer.');
          setSaving(false);
          return;
        }
      }

      // Normalize completed_date to YYYY-MM-DD or set to null when empty
      let normalizedDate = null;
      if (payload.completed_date) {
        const str = String(payload.completed_date).trim();
        const isoMatch = str.match(/^\d{4}-\d{2}-\d{2}$/);
        if (isoMatch) {
          normalizedDate = str;
        } else {
          const ddmmyyyy = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
          if (ddmmyyyy) {
            const [, dd, mm, yyyy] = ddmmyyyy;
            normalizedDate = `${yyyy}-${mm}-${dd}`;
          } else {
            const d = new Date(str);
            if (!isNaN(d.getTime())) {
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              normalizedDate = `${yyyy}-${mm}-${dd}`;
            } else {
              setError('Das Abschlussdatum hat ein ungültiges Format. Bitte verwenden Sie YYYY-MM-DD oder DD.MM.YYYY.');
              setSaving(false);
              return;
            }
          }
        }
      }
      payload.completed_date = normalizedDate;

      // Normalize due_date similarly: accept empty -> null, DD.MM.YYYY -> YYYY-MM-DD, ISO
      let normalizedDue = null;
      if (payload.due_date) {
        const strD = String(payload.due_date).trim();
        const isoMatchD = strD.match(/^\d{4}-\d{2}-\d{2}$/);
        if (isoMatchD) {
          normalizedDue = strD;
        } else {
          const ddmmyyyyD = strD.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
          if (ddmmyyyyD) {
            const [, dd, mm, yyyy] = ddmmyyyyD;
            normalizedDue = `${yyyy}-${mm}-${dd}`;
          } else {
            const d = new Date(strD);
            if (!isNaN(d.getTime())) {
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const dd = String(d.getDate()).padStart(2, '0');
              normalizedDue = `${yyyy}-${mm}-${dd}`;
            } else {
              setError('Das Fälligkeitsdatum hat ein ungültiges Format. Bitte verwenden Sie YYYY-MM-DD oder DD.MM.YYYY.');
              setSaving(false);
              return;
            }
          }
        }
      }
      payload.due_date = normalizedDue;

      // Debug: log payload to help diagnose server validation issues
      console.debug('Saving SalesTicket payload:', payload);
      if (isNew) {
        const response = await api.post('/sales/sales-tickets/', payload);
        const newId = response.data?.id;
        if (newId) {
          navigate(`/sales/tickets/${newId}`);
        } else {
          // Backend didn't return id (legacy serializer). Fallback: go to list and show message.
          setError('Ticket wurde erstellt, konnte aber nicht geöffnet werden (ID nicht zurückgegeben). Bitte öffne die Liste.');
          navigate('/sales/tickets');
        }
      } else {
        await api.patch(`/sales/sales-tickets/${id}/`, payload);
        await loadTicket();
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      const serverData = error.response?.data;
      const msg = serverData
        ? (typeof serverData === 'string' ? serverData : JSON.stringify(serverData))
        : error.message || 'Fehler beim Speichern des Tickets';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleWatcherToggle = (userId) => {
    setSelectedWatchers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleDelete = async () => {
    if (!window.confirm('Ticket wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }
    try {
      await api.delete(`/sales/sales-tickets/${id}/`);
      navigate('/sales/tickets');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      const msg = error.response?.data
        ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
        : error.message || 'Fehler beim Löschen des Tickets';
      setError(msg);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await api.post(`/sales/sales-tickets/${id}/add_comment/`, {
        comment: newComment
      });
      setNewComment('');
      await loadTicket();
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Kommentars:', error);
      const serverData = error.response?.data;
      const msg = serverData
        ? (typeof serverData === 'string' ? serverData : JSON.stringify(serverData))
        : error.message || 'Fehler beim Hinzufügen des Kommentars';
      setError(msg);
    }
  };

  const handleFileUpload = async () => {
    await loadTicket();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('de-DE');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          {isNew ? 'Neues Sales-Ticket' : `Ticket ${ticket?.ticket_number}`}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/sales/tickets')}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
          >
            Zurück
          </button>
          {!isNew && (
            <button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
            >
              Löschen
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:bg-gray-400"
          >
            {saving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Fehleranzeige */}
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Tabs and Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Tabs */}
          {!isNew && (
            <div className="border-b border-gray-200">
              <nav className="tab-scroll -mb-px flex space-x-8">
                <button
                  type="button"
                  onClick={() => setActiveTab('general')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'general'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Allgemein
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('files')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'files'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Anhänge ({ticket?.attachments?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('comments')}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'comments'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Kommentare ({comments.length})
                </button>
              </nav>
            </div>
          )}

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow p-6">
        {/* Allgemein Tab */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Kategorie *</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status *</label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  {statuses.map(st => (
                    <option key={st.value} value={st.value}>{st.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Titel *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Titel des Tickets"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Beschreibung</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
                className="w-full border rounded px-3 py-2"
                placeholder="Beschreibung des Tickets"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Zugewiesen an</label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => handleInputChange('assigned_to', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Nicht zugewiesen</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Ersteller</label>
                <select
                  value={formData.created_by || ''}
                  onChange={(e) => handleInputChange('created_by', e.target.value)}
                  disabled={!isNew}
                  className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
                >
                  <option value="">-- Auswählen --</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Fälligkeitsdatum</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleInputChange('due_date', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            {formData.status === 'completed' && (
              <div>
                <label className="block text-sm font-medium mb-1">Abschlussdatum</label>
                <input
                  type="date"
                  value={formData.completed_date}
                  onChange={(e) => handleInputChange('completed_date', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Notizen</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
                className="w-full border rounded px-3 py-2"
                placeholder="Interne Notizen"
              />
            </div>
          </div>
        )}

        {/* Anhänge Tab */}
        {activeTab === 'files' && !isNew && (
          <div>
            <FileUpload
              ticketId={ticket?.id || (id && id !== 'new' ? id : null)}
              ticketType="sales-ticket"
              attachments={ticket?.attachments || []}
              onUploadSuccess={handleFileUpload}
            />
          </div>
        )}

        {/* Kommentare Tab */}
        {activeTab === 'comments' && !isNew && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Neuer Kommentar</label>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
                className="w-full border rounded px-3 py-2 mb-2"
                placeholder="Kommentar hinzufügen..."
              />
              <button
                onClick={handleAddComment}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                Kommentar hinzufügen
              </button>
            </div>

            <div className="space-y-3 mt-6">
              <h3 className="font-medium">Bisherige Kommentare</h3>
              {comments.length === 0 ? (
                <p className="text-gray-500">Noch keine Kommentare vorhanden</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="text-sm text-gray-600 mb-1">
                      <strong>{comment.created_by_name}</strong> • {formatDateTime(comment.created_at)}
                    </div>
                    <div className="text-gray-800">{comment.comment}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
          </div>
        </div>

        {/* Right Column - Watchers & Changelog */}
        <div className="space-y-6">
          {/* Beobachter */}
          {!isNew && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Beobachter</h3>
              <p className="text-xs text-gray-500 mb-3">
                Markierte Benutzer erhalten Benachrichtigungen bei Änderungen.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {users.map(user => (
                  <label key={user.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedWatchers.includes(user.id)}
                      onChange={() => handleWatcherToggle(user.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {user.first_name} {user.last_name}
                      {ticket && user.id === ticket.created_by && (
                        <span className="ml-1 text-xs text-gray-400">(Ersteller)</span>
                      )}
                      {ticket && user.id === parseInt(ticket.assigned_to) && (
                        <span className="ml-1 text-xs text-gray-400">(Zugewiesen)</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Änderungsprotokoll */}
          {!isNew && changeLogs.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Änderungsprotokoll</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {changeLogs.map(log => (
                  <div key={log.id} className="text-sm border-b border-gray-100 pb-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{log.changed_by_name}</span>
                      <span>{formatDateTime(log.changed_at)}</span>
                    </div>
                    <p className="text-gray-700">
                      <span className="font-medium">{log.field_name}:</span>{' '}
                      {log.old_value && <span className="line-through text-red-500">{log.old_value}</span>}
                      {log.old_value && log.new_value && ' → '}
                      {log.new_value && <span className="text-green-600">{log.new_value}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesTicketEdit;
