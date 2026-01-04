import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

// Status mapping
const STATUS_LABELS = {
  'new': { label: 'Neu', color: 'bg-blue-100 text-blue-800' },
  'in_progress': { label: 'In Bearbeitung', color: 'bg-yellow-100 text-yellow-800' },
  'resolved': { label: 'Gelöst', color: 'bg-green-100 text-green-800' },
  'closed': { label: 'Geschlossen', color: 'bg-gray-100 text-gray-800' }
};

const PRIORITY_LABELS = {
  'low': { label: 'Niedrig', color: 'bg-gray-100 text-gray-700' },
  'normal': { label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  'high': { label: 'Hoch', color: 'bg-orange-100 text-orange-700' },
  'urgent': { label: 'Dringend', color: 'bg-red-100 text-red-700' }
};

const CATEGORY_LABELS = {
  'hardware': { label: 'Hardware', color: 'bg-purple-100 text-purple-800' },
  'software': { label: 'Software', color: 'bg-indigo-100 text-indigo-800' },
  'application': { label: 'Applikation', color: 'bg-cyan-100 text-cyan-800' },
  'other': { label: 'Sonstiges', color: 'bg-gray-100 text-gray-800' }
};

const Troubleshooting = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statistics, setStatistics] = useState(null);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await api.get('/service/troubleshooting/statistics/');
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', '20');
      if (searchTerm) params.append('search', searchTerm);
      
      // Status-Filter
      if (statusFilter === 'open') {
        params.append('is_open', 'true');
      } else if (statusFilter === 'closed') {
        params.append('is_open', 'false');
      } else if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      // Kategorie-Filter
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      
      const response = await api.get(`/service/troubleshooting/?${params.toString()}`);
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
  }, [currentPage, searchTerm, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchStatistics();
    fetchTickets();
  }, [fetchStatistics, fetchTickets]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchTickets();
  };

  const handleNewTicket = () => {
    navigate('/service/troubleshooting/new');
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
    const priorityInfo = PRIORITY_LABELS[priority] || { label: priority, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityInfo.color}`}>
        {priorityInfo.label}
      </span>
    );
  };

  const getCategoryBadge = (category) => {
    const categoryInfo = CATEGORY_LABELS[category] || { label: category, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryInfo.color}`}>
        {categoryInfo.label}
      </span>
    );
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <WrenchScrewdriverIcon className="h-8 w-8 mr-3 text-orange-600" />
            Troubleshooting
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Wissensdatenbank für häufige Probleme und Lösungen
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={handleNewTicket}
            className="inline-flex items-center rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500"
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
                  <WrenchScrewdriverIcon className="h-6 w-6 text-gray-400" />
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
                <div className="flex-shrink-0 text-purple-600">🖥️</div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Hardware</dt>
                    <dd className="text-lg font-medium text-gray-900">{statistics.by_category?.hardware || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 text-indigo-600">💾</div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Software</dt>
                    <dd className="text-lg font-medium text-gray-900">{statistics.by_category?.software || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 text-cyan-600">🔬</div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Applikation</dt>
                    <dd className="text-lg font-medium text-gray-900">{statistics.by_category?.application || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter und Suche */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Suche nach Thema, Beschreibung, Root Cause, Lösung..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
            />
          </div>
        </form>
        
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="block rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
          >
            <option value="all">Alle Status</option>
            <option value="open">Offen</option>
            <option value="closed">Geschlossen</option>
            <option value="new">Neu</option>
            <option value="in_progress">In Bearbeitung</option>
            <option value="resolved">Gelöst</option>
          </select>
          
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="block rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
          >
            <option value="all">Alle Kategorien</option>
            <option value="hardware">Hardware</option>
            <option value="software">Software</option>
            <option value="application">Applikation</option>
            <option value="other">Sonstiges</option>
          </select>
          
          <button
            onClick={fetchTickets}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabelle */}
      <div className="mt-6 bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thema
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kategorie
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priorität
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Autor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktualisiert
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center">
                  <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-orange-600" />
                  <p className="mt-2 text-sm text-gray-500">Lade Tickets...</p>
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  Keine Tickets gefunden
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => navigate(`/service/troubleshooting/${ticket.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {ticket.legacy_id || ticket.ticket_number}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-md truncate">{ticket.title}</div>
                    {ticket.affected_version && (
                      <div className="text-xs text-gray-500">Version: {ticket.affected_version}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getCategoryBadge(ticket.category)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(ticket.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getPriorityBadge(ticket.priority)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {ticket.author_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
          <p className="text-sm text-gray-700">
            Zeige Seite {currentPage} von {totalPages} ({totalCount} Tickets)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Troubleshooting;
