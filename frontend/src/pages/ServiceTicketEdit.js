import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  PlusIcon,
  PaperAirplaneIcon,
  UserGroupIcon,
  ChatBubbleLeftEllipsisIcon,
  ClockIcon,
  LinkIcon
} from '@heroicons/react/24/outline';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'assigned', label: 'Zugewiesen' },
  { value: 'waiting_customer', label: 'Warten Kunde' },
  { value: 'waiting_thirdparty', label: 'Warten Third-Party' },
  { value: 'no_solution', label: 'Keine Lösung' },
  { value: 'resolved', label: 'Gelöst' }
];

const BILLING_OPTIONS = [
  { value: '', label: '-- Auswählen --' },
  { value: 'invoice', label: 'Rechnung' },
  { value: 'warranty', label: 'Garantie' },
  { value: 'maintenance', label: 'Maintenance' }
];

const ServiceTicketEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = id === 'new';
  
  // Get customer from URL params (for pre-filled customer from CustomerModal)
  const urlCustomerId = searchParams.get('customer');

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [ticket, setTicket] = useState({
    title: '',
    description: '',
    customer: urlCustomerId || '',
    contact_email: '',
    status: 'new',
    billing: '',
    assigned_to: '',
    linked_rma: '',
    linked_visiview_ticket: ''
  });
  
  const [comments, setComments] = useState([]);
  const [changeLogs, setChangeLogs] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [rmaCases, setRmaCases] = useState([]);
  const [systems, setSystems] = useState([]);
  const [watchers, setWatchers] = useState([]);
  const [selectedWatchers, setSelectedWatchers] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      // Lade Dropdown-Daten
      const [customersRes, usersRes, rmaRes] = await Promise.all([
        api.get('/customers/?page_size=1000'),
        api.get('/users/'),
        api.get('/service/rma/?page_size=1000')
      ]);
      
      // Normalize API responses: prefer paginated `results`, but ensure arrays
      const normalizeArray = (respData) => {
        const data = respData && (respData.results || respData);
        if (Array.isArray(data)) return data;
        // If API returned an object (e.g. keyed by id), convert to array of values
        if (data && typeof data === 'object') return Object.values(data);
        return [];
      };

      setCustomers(normalizeArray(customersRes.data));
      setUsers(normalizeArray(usersRes.data));
      setRmaCases(normalizeArray(rmaRes.data));
      
      if (!isNew) {
        // Lade Ticket-Details
        const ticketRes = await api.get(`/service/tickets/${id}/`);
        const ticketData = ticketRes.data;
        setTicket({
          ...ticketData,
          customer: ticketData.customer || '',
          assigned_to: ticketData.assigned_to || '',
          linked_rma: ticketData.linked_rma || '',
          linked_system: ticketData.linked_system || '',
          billing: ticketData.billing || ''
        });
        setComments(ticketData.comments || []);
        setChangeLogs(ticketData.change_logs || []);
        setSelectedWatchers(ticketData.watchers || ticketData.watcher_ids || []);

        // If ticket has a customer, load its systems
        const customerId = ticketData.customer;
        if (customerId) {
          try {
            const sysRes = await api.get(`/customers/${customerId}/systems/`);
            setSystems(normalizeArray(sysRes.data));
          } catch (err) {
            console.error('Error loading customer systems:', err);
            setSystems([]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  // Fetch systems when customer selection changes
  useEffect(() => {
    const cid = ticket.customer;
    if (!cid) {
      setSystems([]);
      setTicket(prev => ({ ...prev, linked_system: '' }));
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/customers/${cid}/systems/`);
        if (!cancelled) setSystems(res.data.results || res.data || []);
      } catch (err) {
        console.error('Error fetching systems for customer:', err);
        if (!cancelled) setSystems([]);
      }
    })();

    return () => { cancelled = true; };
  }, [ticket.customer]);

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
        customer: ticket.customer || null,
        assigned_to: ticket.assigned_to || null,
        linked_rma: ticket.linked_rma || null,
        linked_system: ticket.linked_system || null,
        watchers: selectedWatchers
      };
      
      if (isNew) {
        const response = await api.post('/service/tickets/', payload);
        navigate(`/service/tickets/${response.data.id}`);
      } else {
        await api.patch(`/service/tickets/${id}/`, payload);
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
      await api.post(`/service/tickets/${id}/add_comment/`, { comment: newComment });
      setNewComment('');
      fetchData();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Fehler beim Hinzufügen des Kommentars');
    } finally {
      setAddingComment(false);
    }
  };

  const handleCreateRMA = async () => {
    if (!window.confirm('Neuen RMA-Fall für dieses Ticket erstellen?')) return;
    
    try {
      const response = await api.post(`/service/tickets/${id}/create_rma/`);
      alert(`RMA ${response.data.rma_number} wurde erstellt`);
      navigate(`/service/rma/${response.data.rma_id}`);
    } catch (error) {
      console.error('Error creating RMA:', error);
      alert('Fehler beim Erstellen des RMA-Falls');
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
        <ArrowPathIcon className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/service/tickets')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zur Übersicht
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? 'Neues Service-Ticket' : `Ticket ${ticket.ticket_number}`}
            </h1>
            {!isNew && (
              <p className="text-sm text-gray-500">
                Erstellt: {formatDate(ticket.created_at)} von {ticket.created_by_name}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {!isNew && (
              <>
                <button
                  onClick={handleCreateRMA}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Neuen RMA-Fall
                </button>
                <button
                  disabled
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-400 bg-gray-50 cursor-not-allowed"
                  title="Noch nicht implementiert"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Neues VisiView-Ticket
                </button>
              </>
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
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kunde/Dealer</label>
                  <select
                    name="customer"
                    value={ticket.customer}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">-- Auswählen --</option>
                    {customers.map(c => {
                      const nameParts = `${c.first_name || ''} ${c.last_name || ''}`.trim();
                      const label = c.company_name || c.full_name || nameParts || c.customer_number || 'Kunde';
                      return (
                        <option key={c.id} value={c.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">E-Mail</label>
                  <input
                    type="email"
                    name="contact_email"
                    value={ticket.contact_email}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    name="status"
                    value={ticket.status}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Abrechnung</label>
                  <select
                    name="billing"
                    value={ticket.billing}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {BILLING_OPTIONS.map(opt => (
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
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">-- Nicht zugewiesen --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.username})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                  <textarea
                    name="description"
                    value={ticket.description}
                    onChange={handleChange}
                    rows={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Verknüpfungen */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <LinkIcon className="h-5 w-5 mr-2 text-gray-500" />
                Verknüpfungen
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Verknüpfte RMA</label>
                  <select
                    name="linked_rma"
                    value={ticket.linked_rma}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">-- Keine --</option>
                    {rmaCases.map(rma => (
                      <option key={rma.id} value={rma.id}>
                        {rma.rma_number} - {rma.title}
                      </option>
                    ))}
                  </select>
                  {ticket.linked_rma && (
                    <button
                      type="button"
                      onClick={() => navigate(`/service/rma/${ticket.linked_rma}`)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      → Zur RMA wechseln
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Verknüpftes System</label>
                  <select
                    name="linked_system"
                    value={ticket.linked_system || ''}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">-- Kein System --</option>
                    {systems.map(sys => (
                      <option key={sys.id} value={sys.id}>
                        {(sys.system_number ? `${sys.system_number} - ` : '') + (sys.system_name || sys.name || sys.system_number)}
                      </option>
                    ))}
                  </select>
                  {ticket.linked_system && (
                    <button
                      type="button"
                      onClick={() => navigate(`/systems/${ticket.linked_system}`)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      → Zum System wechseln
                    </button>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">VisiView Ticket</label>
                  <input
                    type="text"
                    name="linked_visiview_ticket"
                    value={ticket.linked_visiview_ticket}
                    onChange={handleChange}
                    placeholder="z.B. VV-12345"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Kommentare */}
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
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={addingComment || !newComment.trim()}
                      className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
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
                      <div key={comment.id} className="border-l-4 border-blue-200 pl-4 py-2">
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
          </div>

          {/* Rechte Spalte - Beobachter & Änderungsprotokoll */}
          <div className="space-y-6">
            {/* Beobachter */}
            {!isNew && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <UserGroupIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Beobachter
                </h3>
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
                        {user.id === ticket.created_by && (
                          <span className="ml-1 text-xs text-gray-400">(Ersteller)</span>
                        )}
                        {user.id === parseInt(ticket.assigned_to) && (
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
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <ClockIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Änderungsprotokoll
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {changeLogs.map(log => (
                    <div key={log.id} className="text-sm border-b border-gray-100 pb-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{log.changed_by_name}</span>
                        <span>{formatDate(log.changed_at)}</span>
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

            {/* Speichern Button */}
            <div className="bg-white shadow rounded-lg p-6">
              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
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

export default ServiceTicketEdit;
