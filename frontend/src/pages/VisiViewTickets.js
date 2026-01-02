import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TicketIcon,
  BugAntIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';

// Status mapping
const STATUS_LABELS = {
  'new': { label: 'Neu', color: 'bg-blue-100 text-blue-800' },
  'assigned': { label: 'Zugewiesen', color: 'bg-yellow-100 text-yellow-800' },
  'in_progress': { label: 'In Bearbeitung', color: 'bg-purple-100 text-purple-800' },
  'testing': { label: 'Testen', color: 'bg-orange-100 text-orange-800' },
  'resolved': { label: 'Gelöst', color: 'bg-green-100 text-green-800' },
  'closed': { label: 'Geschlossen', color: 'bg-gray-100 text-gray-800' },
  'rejected': { label: 'Abgelehnt', color: 'bg-red-100 text-red-800' }
};

const PRIORITY_LABELS = {
  'low': { label: 'Niedrig', color: 'bg-gray-100 text-gray-700' },
  'normal': { label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  'high': { label: 'Hoch', color: 'bg-orange-100 text-orange-700' },
  'urgent': { label: 'Dringend', color: 'bg-red-100 text-red-700' }
};

const VisiViewTickets = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [trackerFilter, setTrackerFilter] = useState('all'); // 'all', 'bug', 'feature'
  const [statusFilter, setStatusFilter] = useState('open'); // 'all', 'open', 'closed'
  const [assignedToFilter, setAssignedToFilter] = useState(''); // Mitarbeiter-Filter
  const [targetVersionFilter, setTargetVersionFilter] = useState(''); // Zielversion-Filter
  const [sortBy, setSortBy] = useState('-ticket_number'); // Sortierung
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statistics, setStatistics] = useState(null);
  const [users, setUsers] = useState([]);
  const [versions, setVersions] = useState([]);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await api.get('/visiview/tickets/statistics/');
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/users/');
      const userData = response.data.results || response.data || [];
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  const fetchVersions = useCallback(async () => {
    try {
      // Load many tickets and derive distinct target versions
      const response = await api.get('/visiview/tickets/?page_size=1000');
      const results = response.data.results || response.data || [];
      const set = new Set();
      (Array.isArray(results) ? results : []).forEach(t => {
        if (t.target_version) set.add(t.target_version);
      });
      setVersions(Array.from(set).sort());
    } catch (error) {
      console.error('Error fetching versions:', error);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', 20);
      if (searchTerm) params.append('search', searchTerm);
      if (sortBy) params.append('ordering', sortBy);

      // Filter für Tracker-Typ
      if (trackerFilter !== 'all') {
        params.append('tracker', trackerFilter);
      }

      // Filter für Mitarbeiter
      if (assignedToFilter) {
        params.append('assigned_to', assignedToFilter);
      }

      // Filter für Zielversion
      if (targetVersionFilter) {
        params.append('target_version', targetVersionFilter);
      }

      // Filter für offene/geschlossene Tickets
      if (statusFilter === 'open') {
        params.append('is_open', 'true');
      } else if (statusFilter === 'closed') {
        params.append('is_open', 'false');
      }

      const response = await api.get(`/visiview/tickets/?${params.toString()}`);
      setTickets(response.data.results || response.data);
      if (response.data.count !== undefined) {
        setTotalCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 20));
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, trackerFilter, statusFilter, assignedToFilter, targetVersionFilter, sortBy]);

  useEffect(() => {
    fetchStatistics();
    fetchUsers();
    fetchVersions();
    fetchTickets();
  }, [fetchStatistics, fetchUsers, fetchVersions, fetchTickets]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchTickets();
  };

  const handleNewTicket = () => {
    navigate('/visiview/tickets/new');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusInfo = STATUS_LABELS[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    if (!priority) return <span className="text-gray-400 text-sm">-</span>;
    const priorityInfo = PRIORITY_LABELS[priority] || { label: priority, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityInfo.color}`}>
        {priorityInfo.label}
      </span>
    );
  };

  const getTrackerIcon = (tracker) => {
    if (tracker === 'bug') {
      return <BugAntIcon className="h-5 w-5 text-red-600" />;
    } else {
      return <LightBulbIcon className="h-5 w-5 text-yellow-600" />;
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <TicketIcon className="h-8 w-8 mr-3 text-indigo-600" />
            VisiView Ticketsystem
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Bugs und Feature Requests für VisiView-Software
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={handleNewTicket}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neues Ticket
          </button>
        </div>
      </div>

      {/* Statistiken */}
      {statistics && (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TicketIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Gesamt</dt>
                    <dd className="text-lg font-medium text-gray-900">{statistics.total || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BugAntIcon className="h-6 w-6 text-red-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Bugs</dt>
                    <dd className="text-lg font-medium text-gray-900">{statistics.by_tracker?.bug || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <LightBulbIcon className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Features</dt>
                    <dd className="text-lg font-medium text-gray-900">{statistics.by_tracker?.feature || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ArrowPathIcon className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Offen</dt>
                    <dd className="text-lg font-medium text-gray-900">{statistics.open || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter und Suche */}
      <div className="mt-6 space-y-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Suche nach #Ticket-Nr., Thema, Beschreibung..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </form>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Typ</label>
            <select
              value={trackerFilter}
              onChange={(e) => { setTrackerFilter(e.target.value); setCurrentPage(1); }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="all">Alle Typen</option>
              <option value="bug">Nur Bugs</option>
              <option value="feature">Nur Features</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="open">Offene Tickets</option>
              <option value="closed">Geschlossene Tickets</option>
              <option value="all">Alle Tickets</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mitarbeiter</label>
            <select
              value={assignedToFilter}
              onChange={(e) => { setAssignedToFilter(e.target.value); setCurrentPage(1); }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Alle Mitarbeiter</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Zielversion</label>
            <select
              value={targetVersionFilter}
              onChange={(e) => { setTargetVersionFilter(e.target.value); setCurrentPage(1); }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Alle Versionen</option>
              {versions.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sortierung</label>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="-ticket_number">Ticket# (neuste zuerst)</option>
              <option value="ticket_number">Ticket# (älteste zuerst)</option>
              <option value="-created_at">Erstellt (neuste zuerst)</option>
              <option value="created_at">Erstellt (älteste zuerst)</option>
              <option value="-updated_at">Aktualisiert (neuste zuerst)</option>
              <option value="updated_at">Aktualisiert (älteste zuerst)</option>
              <option value="target_version">Zielversion (A-Z)</option>
              <option value="-target_version">Zielversion (Z-A)</option>
              <option value="priority">Priorität (niedrig → hoch)</option>
              <option value="-priority">Priorität (hoch → niedrig)</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={fetchTickets}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowPathIcon className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Tabelle */}
      <div className="mt-6 bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                Typ
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                Ticket
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-xs">
                Thema
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                Status
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                Priorität
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">
                Zugewiesen an
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                Version
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                Aktualisiert
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center">
                  <div className="flex justify-center">
                    <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-600" />
                  </div>
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center text-sm text-gray-500">
                  Keine Tickets gefunden
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => navigate(`/visiview/tickets/${ticket.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {getTrackerIcon(ticket.tracker)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-indigo-600">
                    #{ticket.ticket_number}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900">
                    <div className="max-w-xs truncate">{ticket.subject}</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {getStatusBadge(ticket.status)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {getPriorityBadge(ticket.priority)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 truncate">
                    {ticket.assigned_to_name || '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 truncate">
                    {ticket.target_version || '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(ticket.updated_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Zeige {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, totalCount)} von {totalCount} Tickets
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-700">
              Seite {currentPage} von {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisiViewTickets;
