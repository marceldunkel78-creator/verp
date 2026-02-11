import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import storage from '../utils/sessionStore';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  WrenchScrewdriverIcon,
  Squares2X2Icon,
  ListBulletIcon
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
  'artefakte': { label: 'Artefakte', color: 'bg-amber-100 text-amber-800' },
  'other': { label: 'Sonstiges', color: 'bg-gray-100 text-gray-800' }
};

const SESSION_KEY = 'troubleshooting_search_state';

const Troubleshooting = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statistics, setStatistics] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const topScrollRef = useRef(null);
  const tableScrollRef = useRef(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const restoredRef = useRef(false);

  const loadSearchState = useCallback(() => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return false;
      if (st.searchTerm !== undefined) setSearchTerm(st.searchTerm);
      if (st.statusFilter !== undefined) setStatusFilter(st.statusFilter);
      if (st.categoryFilter !== undefined) setCategoryFilter(st.categoryFilter);
      if (st.viewMode !== undefined) setViewMode(st.viewMode);
      if (st.tickets) setTickets(st.tickets);
      if (st.statistics) setStatistics(st.statistics);
      if (st.totalPages) setTotalPages(st.totalPages);
      if (st.totalCount !== undefined) setTotalCount(st.totalCount);
      if (st.currentPage) setCurrentPage(st.currentPage);
      return true;
    } catch (e) {
      console.warn('Failed to load troubleshooting search state', e);
      return false;
    }
  }, []);

  const saveSearchState = useCallback(() => {
    try {
      const st = {
        searchTerm,
        statusFilter,
        categoryFilter,
        viewMode,
        currentPage,
        tickets,
        statistics,
        totalPages,
        totalCount
      };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save troubleshooting search state', e);
    }
  }, [searchTerm, statusFilter, categoryFilter, viewMode, currentPage, tickets, statistics, totalPages, totalCount]);

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

  // Mount: restore from URL or sessionStorage
  useEffect(() => {
    const urlParams = Object.fromEntries([...searchParams]);
    const hasRelevantParams = ['search', 'status', 'category', 'page'].some(k => urlParams[k]);

    if (hasRelevantParams) {
      // URL params take priority
      if (urlParams.search) setSearchTerm(urlParams.search);
      if (urlParams.status) setStatusFilter(urlParams.status);
      if (urlParams.category) setCategoryFilter(urlParams.category);
      if (urlParams.page) setCurrentPage(parseInt(urlParams.page, 10));
      restoredRef.current = true;
    } else {
      // Fall back to sessionStorage
      try {
        const st = storage.get(SESSION_KEY);
        if (st) {
          if (st.searchTerm !== undefined) setSearchTerm(st.searchTerm);
          if (st.statusFilter !== undefined) setStatusFilter(st.statusFilter);
          if (st.categoryFilter !== undefined) setCategoryFilter(st.categoryFilter);
          if (st.currentPage) setCurrentPage(st.currentPage);
          restoredRef.current = true;
        }
      } catch (e) {
        console.warn('Failed to load search state from storage', e);
      }
    }
    fetchStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // URL ← state: sync to URL whenever filters change
  useEffect(() => {
    if (restoredRef.current) {
      restoredRef.current = false;
      return; // Skip first update after mount to avoid overwriting restored params
    }
    const params = {};
    if (searchTerm) params.search = searchTerm;
    if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
    if (categoryFilter && categoryFilter !== 'all') params.category = categoryFilter;
    if (currentPage > 1) params.page = String(currentPage);
    setSearchParams(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, categoryFilter, currentPage]);

  // Fetch tickets when filters/page change; skip once if restored
  useEffect(() => {
    if (restoredRef.current) {
      restoredRef.current = false;
      return;
    }
    fetchTickets();
  }, [fetchTickets]);

  // Persist state
  useEffect(() => {
    saveSearchState();
  }, [saveSearchState]);

  useEffect(() => {
    if (tableScrollRef.current) {
      setTableScrollWidth(tableScrollRef.current.scrollWidth || 0);
    }
  }, [tickets, viewMode]);

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
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
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
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 text-amber-600">🧩</div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Artefakte</dt>
                    <dd className="text-lg font-medium text-gray-900">{statistics.by_category?.artefakte || 0}</dd>
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
          <div className="flex border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-2 ${viewMode === 'cards' ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Kachelansicht"
            >
              <Squares2X2Icon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-orange-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Listenansicht"
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>
          </div>
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
            <option value="artefakte">Artefakte</option>
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

      {/* Content */}
      {viewMode === 'cards' && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12">
              <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-orange-600" />
              <p className="mt-2 text-sm text-gray-500">Lade Tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              Keine Tickets gefunden
            </div>
          ) : (
            tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => navigate(`/service/troubleshooting/${ticket.id}`)}
                className="bg-white rounded-lg shadow hover:shadow-md transition cursor-pointer overflow-hidden"
              >
                {ticket.category === 'artefakte' && ticket.main_photo_url ? (
                  <div className="h-36 bg-gray-100">
                    <img
                      src={ticket.main_photo_url}
                      alt={ticket.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-2 bg-orange-600" />
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-gray-500">
                      {ticket.legacy_id || ticket.ticket_number}
                    </span>
                    {getStatusBadge(ticket.status)}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 truncate" title={ticket.title}>
                    {ticket.title}
                  </h3>
                  {ticket.affected_version && (
                    <div className="text-xs text-gray-500 mt-1">Version: {ticket.affected_version}</div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    {getCategoryBadge(ticket.category)}
                    {getPriorityBadge(ticket.priority)}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    {ticket.author_name || '-'} • {formatDate(ticket.updated_at)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="mt-6 bg-white shadow-sm rounded-lg overflow-hidden">
          <div
            ref={topScrollRef}
            className="overflow-x-auto"
            onScroll={() => {
              if (!topScrollRef.current || !tableScrollRef.current) return;
              if (tableScrollRef.current.scrollLeft !== topScrollRef.current.scrollLeft) {
                tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
              }
            }}
          >
            <div style={{ width: tableScrollWidth || 900, height: 1 }} />
          </div>
          <div
            ref={tableScrollRef}
            className="overflow-x-auto"
            onScroll={() => {
              if (!topScrollRef.current || !tableScrollRef.current) return;
              if (topScrollRef.current.scrollLeft !== tableScrollRef.current.scrollLeft) {
                topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
              }
            }}
          >
            <table className="min-w-full divide-y divide-gray-200 table-fixed min-w-[900px]">
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
        </div>
      )}

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
