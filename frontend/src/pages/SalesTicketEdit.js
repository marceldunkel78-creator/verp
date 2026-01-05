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
    due_date: '',
    completed_date: '',
    notes: ''
  });

  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

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
      const response = await api.get('/api/users/employees/');
      setUsers(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Mitarbeiter:', error);
    }
  };

  const loadTicket = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/sales/sales-tickets/${id}/`);
      setTicket(response.data);
      setFormData({
        category: response.data.category,
        status: response.data.status,
        title: response.data.title,
        description: response.data.description || '',
        assigned_to: response.data.assigned_to || '',
        due_date: response.data.due_date || '',
        completed_date: response.data.completed_date || '',
        notes: response.data.notes || ''
      });
      setComments(response.data.comments || []);
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

      if (isNew) {
        const response = await api.post('/api/sales/sales-tickets/', formData);
        navigate(`/sales/tickets/${response.data.id}`);
      } else {
        await api.patch(`/api/sales/sales-tickets/${id}/`, formData);
        await loadTicket();
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      setError('Fehler beim Speichern des Tickets');
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await api.post(`/api/sales/sales-tickets/${id}/add_comment/`, {
        comment: newComment
      });
      setNewComment('');
      await loadTicket();
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Kommentars:', error);
      setError('Fehler beim Hinzufügen des Kommentars');
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
    <div className="container mx-auto p-6">
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

      {/* Tabs */}
      <div className="mb-6 border-b">
        <nav className="tab-scroll flex gap-4">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'general'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Allgemein
          </button>
          {!isNew && (
            <>
              <button
                onClick={() => setActiveTab('files')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'files'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Anhänge ({ticket?.attachments?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`px-4 py-2 font-medium ${
                  activeTab === 'comments'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Kommentare ({comments.length})
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Tab-Inhalte */}
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
              itemId={id}
              itemType="sales-ticket"
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
  );
};

export default SalesTicketEdit;
