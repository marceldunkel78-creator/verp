import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  UserGroupIcon,
  ChatBubbleLeftEllipsisIcon,
  ClockIcon,
  BugAntIcon,
  LightBulbIcon,
  PaperClipIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'assigned', label: 'Zugewiesen' },
  { value: 'in_progress', label: 'In Bearbeitung' },
  { value: 'testing', label: 'Testen' },
  { value: 'resolved', label: 'Gelöst' },
  { value: 'closed', label: 'Geschlossen' },
  { value: 'rejected', label: 'Abgelehnt' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Niedrig' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Hoch' },
  { value: 'urgent', label: 'Dringend' }
];

const CATEGORY_OPTIONS = [
  { value: '', label: '-- Auswählen --' },
  { value: 'application', label: 'Applikation' },
  { value: 'data_analysis', label: 'Datenanalyse Allgemein' },
  { value: 'data_management', label: 'Datenmanagement' },
  { value: 'deconvolution', label: 'Deconvolution' },
  { value: 'hardware_camera', label: 'Hardware: Kamera' },
  { value: 'hardware_microscope', label: 'Hardware: Mikroskop' },
  { value: 'hardware_orbital', label: 'Hardware: Orbital' },
  { value: 'hardware_tirf_frap', label: 'Hardware: VisiTIRF/FRAP' },
  { value: 'hardware_other', label: 'Hardware: Sonstiges' },
  { value: 'other', label: 'Sonstiges' }
];

const VisiViewTicketEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [ticket, setTicket] = useState({
    tracker: 'feature',
    subject: '',
    description: '',
    status: 'new',
    priority: 'normal',
    category: '',
    assigned_to: '',
    target_version: '',
    affected_version: '',
    visiview_id: '',
    visiview_license: null,
    customers: [],
    watchers: []
  });
  
  const [comments, setComments] = useState([]);
  const [changeLogs, setChangeLogs] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [visiviewProducts, setVisiviewProducts] = useState([]);
  const [visiviewLicenses, setVisiviewLicenses] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [selectedWatchers, setSelectedWatchers] = useState([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      // Lade Dropdown-Daten
      const [usersRes, customersRes, productsRes, licensesRes] = await Promise.all([
        api.get('/users/'),
        api.get('/customers/customers/?page_size=1000'),
        api.get('/visiview/products/?page_size=1000'),
        api.get('/visiview/licenses/?page_size=1000')
      ]);
      
      const normalizeArray = (respData) => {
        const data = respData && (respData.results || respData);
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') return Object.values(data);
        return [];
      };

      setUsers(normalizeArray(usersRes.data));
      setCustomers(normalizeArray(customersRes.data));
      setVisiviewProducts(normalizeArray(productsRes.data));
      setVisiviewLicenses(normalizeArray(licensesRes.data));
      
      if (!isNew) {
        // Lade Ticket-Details
        const ticketRes = await api.get(`/visiview/tickets/${id}/`);
        const ticketData = ticketRes.data;
        setTicket({
          ...ticketData,
          // keep compatibility with frontend which uses `subject` as input name
          subject: ticketData.title || '',
          assigned_to: ticketData.assigned_to || '',
          visiview_id: ticketData.visiview_id || '',
          visiview_license: ticketData.visiview_license || null,
          category: ticketData.category || '',
          target_version: ticketData.target_version || '',
          affected_version: ticketData.affected_version || ''
        });
        
        // Lade Kommentare
        const commentsRes = await api.get(`/visiview/tickets/${id}/comments/`);
        setComments(commentsRes.data || []);
        
        // Lade Änderungsprotokoll
        const changeLogRes = await api.get(`/visiview/tickets/${id}/change_log/`);
        setChangeLogs(changeLogRes.data || []);
        
        const normalizeToIds = (items) => {
          if (!items) return [];
          if (Array.isArray(items)) {
            return items.map(i => (typeof i === 'object' && i !== null ? i.id : i));
          }
          // If items is a comma-separated string (legacy storage), split into array
          if (typeof items === 'string') {
            return items.split(',').map(s => s.trim()).filter(s => s !== '');
          }
          return [typeof items === 'object' && items !== null ? items.id : items];
        };

        // Resolve stored customers (may be array of ids, objects, or comma-separated legacy strings)
        const rawCustomers = ticketData.customers || ticketData.customer_ids || [];
        const customerList = normalizeArray(customersRes.data);
        const resolvedCustomerIds = [];

        const ensureCustomerInList = (custObj) => {
          if (!customerList.find(c => String(c.id) === String(custObj.id))) {
            customerList.push(custObj);
          }
        };

        const entries = Array.isArray(rawCustomers) ? rawCustomers : (typeof rawCustomers === 'string' ? rawCustomers.split(',').map(s => s.trim()).filter(Boolean) : []);
        entries.forEach(item => {
          if (!item) return;
          if (typeof item === 'object') {
            const id = item.id || item;
            resolvedCustomerIds.push(String(id));
            ensureCustomerInList(item);
            return;
          }
          const s = String(item).trim();
          // Try to match by id, customer_number, or full name
          let match = customerList.find(c => String(c.id) === s || String(c.customer_number) === s);
          if (!match) {
            match = customerList.find(c => `${c.first_name || ''} ${c.last_name || ''}`.trim() === s || (c.full_name && c.full_name === s) );
          }
          if (match) {
            resolvedCustomerIds.push(String(match.id));
          } else {
            // Fallback: add a placeholder entry so it can be displayed
            const placeholder = { id: s, first_name: s, last_name: '', customer_number: '' };
            customerList.push(placeholder);
            resolvedCustomerIds.push(String(s));
          }
        });

        setCustomers(customerList);
        setSelectedCustomers(resolvedCustomerIds);
        // Ensure watchers are stored as string IDs for consistent comparison
        const watcherIds = normalizeToIds(ticketData.watchers || ticketData.watcher_ids || []);
        setSelectedWatchers(watcherIds.map(id => String(id)));
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
    console.info('handleSave called for ticket', id, 'isNew:', isNew);
    setSaving(true);
    
    try {
      const normalizeToIds = (items) => Array.isArray(items) ? items.map(i => (typeof i === 'object' && i !== null ? i.id : i)) : (items ? [items] : []);
      const payload = {
        // ensure backend receives `title` field (backend uses `title`)
        ...ticket,
        title: ticket.subject || ticket.title || '',
        assigned_to: ticket.assigned_to || null,
        visiview_license: ticket.visiview_license || null,
        // backend expects customers as comma-separated string
        customers: Array.isArray(selectedCustomers) ? selectedCustomers.join(',') : (selectedCustomers || ''),
        watchers: normalizeToIds(selectedWatchers)
      };
      console.debug('Saving ticket payload:', payload);
      
      if (isNew) {
        const response = await api.post('/visiview/tickets/', payload);
        console.info('Ticket created, response id:', response.data.id);
        navigate(`/visiview/tickets/${response.data.id}`);
      } else {
        const response = await api.patch(`/visiview/tickets/${id}/`, payload);
        console.info('Ticket updated, status:', response.status);
        fetchData();
      }
    } catch (error) {
      console.error('Error saving ticket:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) return;
    const ok = window.confirm('Ticket endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.');
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete(`/visiview/tickets/${id}/`);
      navigate('/visiview/tickets');
    } catch (error) {
      console.error('Error deleting ticket:', error);
      alert('Fehler beim Löschen: ' + (error.response?.data?.detail || error.message));
    } finally {
      setDeleting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setAddingComment(true);
    try {
      await api.post(`/visiview/tickets/${id}/add_comment/`, { comment: newComment });
      setNewComment('');
      fetchData();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Fehler beim Hinzufügen des Kommentars');
    } finally {
      setAddingComment(false);
    }
  };

  const handleCustomerToggle = (customerId) => {
    setSelectedCustomers(prev => {
      if (prev.includes(customerId)) {
        return prev.filter(id => id !== customerId);
      } else {
        return [...prev, customerId];
      }
    });
  };

  const handleCustomerSearch = async (searchTerm) => {
    setCustomerSearchTerm(searchTerm);
    if (!searchTerm.trim()) {
      setCustomerSearchResults([]);
      return;
    }
    
    try {
      const response = await api.get(`/customers/customers/?search=${searchTerm}&page_size=10`);
      const results = response.data.results || response.data || [];
      setCustomerSearchResults(Array.isArray(results) ? results : []);
    } catch (error) {
      console.error('Error searching customers:', error);
      setCustomerSearchResults([]);
    }
  };

  const handleAddCustomer = (customerId) => {
    const id = typeof customerId === 'object' && customerId !== null ? customerId.id : customerId;
    const idStr = String(id);
    // add id as string to keep consistent
    setSelectedCustomers(prev => {
      const strs = prev.map(p => String(p));
      if (strs.includes(idStr)) return prev;
      return [...prev, idStr];
    });

    // ensure customers state contains the full object for display
    if (typeof customerId === 'object' && customerId !== null) {
      setCustomers(prev => {
        if (prev.find(c => String(c.id) === idStr)) return prev;
        return [...prev, customerId];
      });
    } else {
      const found = customerSearchResults.find(c => String(c.id) === idStr);
      if (found) {
        setCustomers(prev => {
          if (prev.find(c => String(c.id) === idStr)) return prev;
          return [...prev, found];
        });
      }
    }

    setCustomerSearchTerm('');
    setCustomerSearchResults([]);
  };

  const handleRemoveCustomer = (customerId) => {
    const idStr = String(customerId);
    setSelectedCustomers(prev => prev.filter(id => String(id) !== idStr));
  };

  const getCustomerLabel = (customer) => {
    const nameParts = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    return customer.company_name || customer.full_name || nameParts || customer.customer_number || 'Kunde';
  };

  const handleWatcherToggle = (userId) => {
    setSelectedWatchers(prev => {
      const userIdStr = String(userId);
      if (prev.some(id => String(id) === userIdStr)) {
        return prev.filter(id => String(id) !== userIdStr);
      } else {
        return [...prev, userIdStr];
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
        <ArrowPathIcon className="h-12 w-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/visiview/tickets')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zur Übersicht
        </button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center">
              {ticket.tracker === 'bug' ? (
                <BugAntIcon className="h-7 w-7 mr-3 text-red-600" />
              ) : (
                <LightBulbIcon className="h-7 w-7 mr-3 text-yellow-600" />
              )}
              <h1 className="text-2xl font-bold text-gray-900">
                {isNew ? 'Neues VisiView Ticket' : `Ticket #${ticket.ticket_number}`}
              </h1>
            </div>
            {!isNew && (
              <p className="text-sm text-gray-500 mt-1">
                Erstellt: {formatDate(ticket.created_at)} von {ticket.author_name}
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
                <div>
                  <label className="block text-sm font-medium text-gray-700">Typ *</label>
                  <select
                    name="tracker"
                    value={ticket.tracker}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="bug">Bug/Fehler</option>
                    <option value="feature">Feature Request</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Priorität</label>
                  <select
                    name="priority"
                    value={ticket.priority}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    {PRIORITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Thema/Titel *</label>
                  <input
                    type="text"
                    name="subject"
                    value={ticket.subject}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    name="status"
                    value={ticket.status}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    {STATUS_OPTIONS.map(opt => (
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
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                  <label className="block text-sm font-medium text-gray-700">VisiView Lizenz (Dongle Seriennummer)</label>
                  <select
                    name="visiview_license"
                    value={ticket.visiview_license || ''}
                    onChange={(e) => setTicket(prev => ({ ...prev, visiview_license: e.target.value || null }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">-- Keine Lizenz --</option>
                    {visiviewLicenses.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.serial_number || l.license_number} {l.customer_name_legacy ? `- ${l.customer_name_legacy}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Zielversion</label>
                  <input
                    type="text"
                    name="target_version"
                    value={ticket.target_version}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Betroffene Version</label>
                  <input
                    type="text"
                    name="affected_version"
                    value={ticket.affected_version}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Beschreibung */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Beschreibung</h3>
              <textarea
                name="description"
                value={ticket.description}
                onChange={handleChange}
                rows={8}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* Betroffene Kunden */}
            {!isNew && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Betroffene Kunden</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Wählen Sie alle Kunden aus, die von diesem Ticket betroffen sind. Nutzen Sie die Suche, um Kunden hinzuzufügen.
                </p>

                {/* Kunden-Suche */}
                <div className="mb-4 relative">
                  <input
                    type="text"
                    value={customerSearchTerm}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                    placeholder="Kundenname oder Firma suchen..."
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  {customerSearchResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                      {customerSearchResults.map(customer => (
                        <div
                          key={customer.id}
                          onClick={() => handleAddCustomer(customer.id)}
                          className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-normal block truncate">{getCustomerLabel(customer)}</span>
                            {customer.customer_number && (
                              <span className="text-xs text-gray-500 ml-2">#{customer.customer_number}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ausgewählte Kunden */}
                {Array.isArray(selectedCustomers) && selectedCustomers.length > 0 ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ausgewählte Kunden ({selectedCustomers.length})
                    </label>
                    {selectedCustomers.map(customerId => {
                      const customer = customers.find(c => String(c.id) === String(customerId));
                      if (!customer) return null;
                      return (
                        <div key={customerId} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                          <span className="text-sm text-gray-700">{getCustomerLabel(customer)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomer(customerId)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Entfernen
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Keine Kunden zugeordnet</p>
                )}
              </div>
            )}

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
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={addingComment || !newComment.trim()}
                      className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
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
                      <div key={comment.id} className="border-l-4 border-indigo-200 pl-4 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">{comment.created_by_name || 'Importiert'}</span>
                          <span className="text-xs text-gray-500">{formatDate(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                        {comment.is_imported && (
                          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            Importiert
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Anhänge */}
            {!isNew && Array.isArray(ticket.attachments) && ticket.attachments.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <PaperClipIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Anhänge ({ticket.attachments.length})
                </h3>
                <div className="space-y-2">
                  {ticket.attachments.map((attachment, index) => (
                    <div key={index} className="flex items-center text-sm text-gray-600">
                      <PaperClipIcon className="h-4 w-4 mr-2" />
                      <span>{attachment.filename || `Anhang ${index + 1}`}</span>
                    </div>
                  ))}
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
                        checked={selectedWatchers.some(id => String(id) === String(user.id))}
                        onChange={() => handleWatcherToggle(user.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {user.first_name} {user.last_name}
                        {user.id === ticket.author && (
                          <span className="ml-1 text-xs text-gray-400">(Autor)</span>
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
                        <span>{log.changed_by_name || 'System'}</span>
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

            {/* Metadaten (nur bei Import) */}
            {!isNew && ticket.imported_created_at && (
              <div className="bg-gray-50 shadow rounded-lg p-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Import-Informationen</h3>
                <div className="text-xs text-gray-600 space-y-1">
                  <p><span className="font-medium">Original erstellt:</span> {formatDate(ticket.imported_created_at)}</p>
                  <p><span className="font-medium">Original aktualisiert:</span> {formatDate(ticket.imported_updated_at)}</p>
                  {ticket.closed_at && (
                    <p><span className="font-medium">Geschlossen:</span> {formatDate(ticket.closed_at)}</p>
                  )}
                  {ticket.start_date && (
                    <p><span className="font-medium">Startdatum:</span> {formatDate(ticket.start_date)}</p>
                  )}
                  {ticket.done_ratio !== null && ticket.done_ratio !== undefined && (
                    <p><span className="font-medium">Fortschritt:</span> {ticket.done_ratio}%</p>
                  )}
                </div>
              </div>
            )}

            {/* Speichern Button */}
            <div className="bg-white shadow rounded-lg p-6 space-y-3">
              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
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

              {!isNew && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                      Löschen...
                    </>
                  ) : (
                    <>
                      <TrashIcon className="h-4 w-4 mr-2" />
                      Ticket löschen
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default VisiViewTicketEdit;
