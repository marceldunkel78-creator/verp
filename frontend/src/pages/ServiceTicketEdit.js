import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import FileUpload from '../components/FileUpload';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  PlusIcon,
  PaperAirplaneIcon,
  UserGroupIcon,
  ChatBubbleLeftEllipsisIcon,
  ClockIcon,
  LinkIcon,
  TrashIcon
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

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'links', label: 'Verknüpfungen' },
  { id: 'files', label: 'Dateien' },
  { id: 'comments', label: 'Kommentare' },
  { id: 'time', label: 'Zeiterfassung' }
];

const ServiceTicketEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = id === 'new' || !id;
  
  const urlCustomerId = searchParams.get('customer');
  const urlSystemId = searchParams.get('system');

  const [activeTab, setActiveTab] = useState('details');
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
    linked_system: urlSystemId || '',
    linked_visiview_ticket: '',
    ticket_attachments: [],
    time_entries: [],
    total_hours_spent: 0
  });
  
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  const [systemSearch, setSystemSearch] = useState('');
  const [searchingSystems, setSearchingSystems] = useState(false);
  const [systemResults, setSystemResults] = useState([]);
  const [selectedSystem, setSelectedSystem] = useState(null);

  const [visiviewSearch, setVisiviewSearch] = useState('');
  const [searchingVisiview, setSearchingVisiview] = useState(false);
  const [visiviewResults, setVisiviewResults] = useState([]);
  const [selectedVisiviewTicket, setSelectedVisiviewTicket] = useState(null);
  
  const [comments, setComments] = useState([]);
  const [changeLogs, setChangeLogs] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  
  const [users, setUsers] = useState([]);
  const [rmaCases, setRmaCases] = useState([]);
  const [watchers, setWatchers] = useState([]);
  const [selectedWatchers, setSelectedWatchers] = useState([]);

  // Time Entry State
  const [timeEntries, setTimeEntries] = useState([]);
  const [newTimeEntry, setNewTimeEntry] = useState({
    date: '',
    time: '',
    employee: '',
    hours_spent: '',
    description: ''
  });
  const [addingTimeEntry, setAddingTimeEntry] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, rmaRes] = await Promise.all([
        api.get('/users/'),
        api.get('/service/rma/?page_size=1000')
      ]);
      
      const normalizeArray = (respData) => {
        const data = respData && (respData.results || respData);
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') return Object.values(data);
        return [];
      };

      setUsers(normalizeArray(usersRes.data));
      setRmaCases(normalizeArray(rmaRes.data));
      
      if (!isNew) {
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
        setTimeEntries(ticketData.time_entries || []);
        setSelectedWatchers(ticketData.watchers || ticketData.watcher_ids || []);

        if (ticketData.customer) {
          try {
            const custRes = await api.get(`/customers/customers/${ticketData.customer}/`);
            setSelectedCustomer(custRes.data);
          } catch (err) {
            console.error('Error loading customer:', err);
          }
        }
        
        if (ticketData.linked_system) {
          try {
            const sysRes = await api.get(`/systems/systems/${ticketData.linked_system}/`);
            setSelectedSystem(sysRes.data);
          } catch (err) {
            console.error('Error loading system:', err);
          }
        }
        if (ticketData.linked_visiview_ticket) {
          try {
            const vvRes = await api.get(`/visiview/tickets/${ticketData.linked_visiview_ticket}/`);
            setSelectedVisiviewTicket(vvRes.data);
          } catch (err) {
            console.error('Error loading linked VisiView ticket:', err);
          }
        }
      } else {
        if (urlCustomerId) {
          try {
            const custRes = await api.get(`/customers/customers/${urlCustomerId}/`);
            setSelectedCustomer(custRes.data);
          } catch (err) {
            console.error('Error loading URL customer:', err);
          }
        }
        if (urlSystemId) {
          try {
            const sysRes = await api.get(`/systems/systems/${urlSystemId}/`);
            setSelectedSystem(sysRes.data);
          } catch (err) {
            console.error('Error loading URL system:', err);
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [id, isNew, urlCustomerId, urlSystemId]);

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

  const searchCustomers = async () => {
    if (!customerSearch.trim()) return;
    setSearchingCustomers(true);
    try {
      const response = await api.get(`/customers/customers/?search=${customerSearch}&page_size=10`);
      setCustomerResults(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setSearchingCustomers(false);
    }
  };

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setTicket(prev => ({ ...prev, customer: customer.id }));
    setCustomerResults([]);
    setCustomerSearch('');
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setTicket(prev => ({ ...prev, customer: '' }));
  };

  const searchSystems = async () => {
    if (!systemSearch.trim()) return;
    setSearchingSystems(true);
    try {
      const response = await api.get(`/systems/systems/?search=${systemSearch}&page_size=10`);
      setSystemResults(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error searching systems:', error);
    } finally {
      setSearchingSystems(false);
    }
  };

  const selectSystem = (system) => {
    setSelectedSystem(system);
    setTicket(prev => ({ ...prev, linked_system: system.id }));
    setSystemResults([]);
    setSystemSearch('');
  };

  const clearSystem = () => {
    setSelectedSystem(null);
    setTicket(prev => ({ ...prev, linked_system: '' }));
  };

  const searchVisiview = async () => {
    if (!visiviewSearch.trim()) return;
    setSearchingVisiview(true);
    try {
      const response = await api.get(`/visiview/tickets/?search=${visiviewSearch}&page_size=10`);
      setVisiviewResults(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error searching VisiView tickets:', error);
    } finally {
      setSearchingVisiview(false);
    }
  };

  const selectVisiview = (vvTicket) => {
    setSelectedVisiviewTicket(vvTicket);
    setTicket(prev => ({ ...prev, linked_visiview_ticket: vvTicket.id }));
    setVisiviewResults([]);
    setVisiviewSearch('');
  };

  const clearVisiview = () => {
    setSelectedVisiviewTicket(null);
    setTicket(prev => ({ ...prev, linked_visiview_ticket: '' }));
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

  const handleAddTimeEntry = async () => {
    if (!newTimeEntry.hours_spent || !newTimeEntry.description.trim()) {
      alert('Bitte Zeit und Beschreibung eingeben');
      return;
    }

    setAddingTimeEntry(true);
    try {
      const now = new Date();
      const payload = {
        date: newTimeEntry.date || now.toISOString().split('T')[0],
        time: newTimeEntry.time || now.toTimeString().split(' ')[0],
        employee: newTimeEntry.employee || users.find(u => u.id === ticket.assigned_to)?.id || users[0]?.id,
        hours_spent: newTimeEntry.hours_spent,
        description: newTimeEntry.description
      };

      await api.post(`/service/tickets/${id}/add_time_entry/`, payload);
      
      setNewTimeEntry({
        date: '',
        time: '',
        employee: '',
        hours_spent: '',
        description: ''
      });
      
      fetchData();
    } catch (error) {
      console.error('Error adding time entry:', error);
      alert('Fehler beim Hinzufügen des Zeiteintrags');
    } finally {
      setAddingTimeEntry(false);
    }
  };

  const handleDeleteTimeEntry = async (entryId) => {
    if (!window.confirm('Zeiteintrag wirklich löschen?')) return;
    
    try {
      await api.delete(`/service/tickets/${id}/delete_time_entry/${entryId}/`);
      fetchData();
    } catch (error) {
      console.error('Error deleting time entry:', error);
      alert('Fehler beim Löschen des Zeiteintrags');
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

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    return timeStr.substring(0, 5);
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
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'Neues Service Ticket' : `Ticket #${ticket.ticket_number}`}
        </h1>
        {!isNew && (
          <p className="text-sm text-gray-500 mt-1">
            Erstellt: {formatDate(ticket.created_at)}
          </p>
        )}
      </div>

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Linke Spalte - Tab Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tabs */}
            {!isNew && (
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                        ${activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }
                      `}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
            )}

            {/* Tab Content */}
            {(isNew || activeTab === 'details') && (
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
                    {selectedCustomer ? (
                      <div className="mt-1 flex items-center gap-2 p-3 bg-gray-50 border rounded-md">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {selectedCustomer.full_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`}
                          </div>
                          <div className="text-sm text-gray-600">{selectedCustomer.customer_number}</div>
                        </div>
                        <button
                          type="button"
                          onClick={clearCustomer}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="mt-1 flex gap-2">
                          <input
                            type="text"
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchCustomers())}
                            placeholder="Kundenname oder -nummer..."
                            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                          <button
                            type="button"
                            onClick={searchCustomers}
                            disabled={searchingCustomers}
                            className="px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50"
                          >
                            {searchingCustomers ? '...' : 'Suchen'}
                          </button>
                        </div>
                        {customerResults.length > 0 && (
                          <div className="mt-2 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {customerResults.map((c) => (
                              <div
                                key={c.id}
                                onClick={() => selectCustomer(c)}
                                className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">
                                  {c.full_name || `${c.first_name || ''} ${c.last_name || ''}`}
                                </div>
                                <div className="text-sm text-gray-600">{c.customer_number}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
                      rows={6}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'links' && !isNew && (
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
                    {selectedSystem ? (
                      <div className="mt-1 flex items-center gap-2 p-3 bg-gray-50 border border-gray-300 rounded-md">
                        <div className="flex-1">
                          <div className="font-medium">{selectedSystem.system_name || selectedSystem.name}</div>
                          <div className="text-sm text-gray-600">{selectedSystem.system_number}</div>
                        </div>
                        <button
                          type="button"
                          onClick={clearSystem}
                          className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="mt-1 flex gap-2">
                          <input
                            type="text"
                            value={systemSearch}
                            onChange={(e) => setSystemSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                searchSystems();
                              }
                            }}
                            placeholder="System suchen..."
                            className="block flex-1 rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          />
                          <button
                            type="button"
                            onClick={searchSystems}
                            disabled={searchingSystems}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                          >
                            {searchingSystems ? 'Suchen...' : 'Suchen'}
                          </button>
                        </div>
                        {systemResults.length > 0 && (
                          <div className="mt-2 border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                            {systemResults.map((sys) => (
                              <div
                                key={sys.id}
                                onClick={() => selectSystem(sys)}
                                className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-200 last:border-b-0"
                              >
                                <div className="font-medium">{sys.system_name || sys.name}</div>
                                <div className="text-sm text-gray-600">{sys.system_number}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {selectedSystem && (
                      <button
                        type="button"
                        onClick={() => navigate(`/systems/${selectedSystem.id}`)}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                      >
                        → Zum System wechseln
                      </button>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">VisiView Ticket</label>
                    {selectedVisiviewTicket ? (
                      <div className="mt-1 flex items-center gap-2 p-3 bg-gray-50 border border-gray-300 rounded-md">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{selectedVisiviewTicket.title}</div>
                          <div className="text-sm text-gray-600">#{selectedVisiviewTicket.ticket_number || selectedVisiviewTicket.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/visiview/tickets/${selectedVisiviewTicket.id}`)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            → VisiView öffnen
                          </button>
                          <button
                            type="button"
                            onClick={clearVisiview}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="mt-1 flex gap-2">
                          <input
                            type="text"
                            value={visiviewSearch}
                            onChange={(e) => setVisiviewSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                searchVisiview();
                              }
                            }}
                            placeholder="Ticketnummer oder Titel suchen..."
                            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          />
                          <button
                            type="button"
                            onClick={searchVisiview}
                            disabled={searchingVisiview}
                            className="px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50"
                          >
                            {searchingVisiview ? '...' : 'Suchen'}
                          </button>
                        </div>
                        {visiviewResults.length > 0 && (
                          <div className="mt-2 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {visiviewResults.map((vv) => (
                              <div
                                key={vv.id}
                                onClick={() => selectVisiview(vv)}
                                className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">#{vv.ticket_number || vv.id} - {vv.title}</div>
                                {vv.description && <div className="text-sm text-gray-600">{vv.description.substring(0, 120)}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'files' && !isNew && (
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Dateien
                </h3>
                <FileUpload
                  attachments={ticket.ticket_attachments || []}
                  ticketId={ticket.id}
                  ticketType="service"
                  onUploadSuccess={(newAttachment) => {
                    setTicket(prev => ({
                      ...prev,
                      ticket_attachments: [...(prev.ticket_attachments || []), newAttachment]
                    }));
                  }}
                  onDeleteSuccess={(attachmentId) => {
                    setTicket(prev => ({
                      ...prev,
                      ticket_attachments: prev.ticket_attachments.filter(att => att.id !== attachmentId)
                    }));
                  }}
                />
              </div>
            )}

            {activeTab === 'comments' && !isNew && (
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

            {activeTab === 'time' && !isNew && (
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <ClockIcon className="h-5 w-5 mr-2 text-gray-500" />
                    Zeiterfassung
                  </h3>
                  <div className="text-lg font-bold text-blue-600">
                    Gesamt: {ticket.total_hours_spent || 0}h
                  </div>
                </div>

                {/* Neuer Zeiteintrag */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Neuer Zeiteintrag</h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Datum</label>
                      <input
                        type="date"
                        value={newTimeEntry.date}
                        onChange={(e) => setNewTimeEntry(prev => ({ ...prev, date: e.target.value }))}
                        placeholder="Heute"
                        className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Uhrzeit</label>
                      <input
                        type="time"
                        value={newTimeEntry.time}
                        onChange={(e) => setNewTimeEntry(prev => ({ ...prev, time: e.target.value }))}
                        placeholder="Jetzt"
                        className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Mitarbeiter</label>
                      <select
                        value={newTimeEntry.employee}
                        onChange={(e) => setNewTimeEntry(prev => ({ ...prev, employee: e.target.value }))}
                        className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">-- Zugewiesener --</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.first_name} {u.last_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Stunden *</label>
                      <input
                        type="number"
                        step="0.25"
                        value={newTimeEntry.hours_spent}
                        onChange={(e) => setNewTimeEntry(prev => ({ ...prev, hours_spent: e.target.value }))}
                        placeholder="z.B. 2.5"
                        className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Beschreibung *</label>
                      <textarea
                        value={newTimeEntry.description}
                        onChange={(e) => setNewTimeEntry(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Was wurde getan?"
                        rows={2}
                        className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddTimeEntry}
                        disabled={addingTimeEntry}
                        className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                      >
                        <PlusIcon className="h-4 w-4 mr-1" />
                        {addingTimeEntry ? 'Speichern...' : 'Hinzufügen'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Zeiteinträge Liste */}
                <div className="space-y-2">
                  {timeEntries.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">Keine Zeiteinträge vorhanden</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uhrzeit</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mitarbeiter</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stunden</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beschreibung</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {timeEntries.map(entry => (
                            <tr key={entry.id} className="hover:bg-gray-50">
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                                {new Date(entry.date).toLocaleDateString('de-DE')}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                                {formatTime(entry.time)}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                                {entry.employee_name}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {entry.hours_spent}h
                              </td>
                              <td className="px-3 py-3 text-sm text-gray-700">
                                {entry.description}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-right text-sm">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTimeEntry(entry.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
