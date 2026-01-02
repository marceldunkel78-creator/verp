import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeBracketIcon,
  ArrowDownTrayIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';

// Status mapping
const STATUS_LABELS = {
  'new': { label: 'Neu', color: 'bg-blue-100 text-blue-800' },
  'released': { label: 'Freigegeben', color: 'bg-green-100 text-green-800' },
  'deprecated': { label: 'Veraltet', color: 'bg-gray-100 text-gray-800' }
};

const VisiViewMacros = () => {
  const navigate = useNavigate();
  const [macros, setMacros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [sortBy, setSortBy] = useState('-macro_id');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statistics, setStatistics] = useState(null);
  const [categories, setCategories] = useState([]);
  const [keywords, setKeywords] = useState([]);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await api.get('/visiview/macros/statistics/');
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/visiview/macros/categories/');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  const fetchKeywords = useCallback(async () => {
    try {
      const response = await api.get('/visiview/macros/keywords_list/');
      setKeywords(response.data || []);
    } catch (error) {
      console.error('Error fetching keywords:', error);
    }
  }, []);

  const fetchMacros = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', 20);
      if (searchTerm) params.append('search', searchTerm);
      if (sortBy) params.append('ordering', sortBy);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);

      const response = await api.get(`/visiview/macros/?${params.toString()}`);
      let results = response.data.results || response.data;

      // Client-side keyword filter
      if (keywordFilter && Array.isArray(results)) {
        results = results.filter(m => 
          m.keywords && m.keywords.toLowerCase().includes(keywordFilter.toLowerCase())
        );
      }

      setMacros(results);
      if (response.data.count !== undefined) {
        setTotalCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 20));
      }
    } catch (error) {
      console.error('Error fetching macros:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter, categoryFilter, keywordFilter, sortBy]);

  useEffect(() => {
    fetchStatistics();
    fetchCategories();
    fetchKeywords();
  }, [fetchStatistics, fetchCategories, fetchKeywords]);

  useEffect(() => {
    fetchMacros();
  }, [fetchMacros]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchMacros();
  };

  const handleNewMacro = () => {
    navigate('/visiview/macros/new');
  };

  const handleDownload = async (macroId, e) => {
    e.stopPropagation();
    try {
      const response = await api.get(`/visiview/macros/${macroId}/download/`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'macro.txt';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading macro:', error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CodeBracketIcon className="h-7 w-7 text-indigo-600" />
            VisiView Macros
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Python Macros für VisiView verwalten
          </p>
        </div>
        <button
          onClick={handleNewMacro}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Neues Macro
        </button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Gesamt</div>
            <div className="text-2xl font-bold text-gray-900">{statistics.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Neu</div>
            <div className="text-2xl font-bold text-blue-600">
              {statistics.by_status?.new || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Freigegeben</div>
            <div className="text-2xl font-bold text-green-600">
              {statistics.by_status?.released || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Veraltet</div>
            <div className="text-2xl font-bold text-gray-600">
              {statistics.by_status?.deprecated || 0}
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Search Row */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[250px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Suche
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Macro-ID, Titel, Autor, Keywords..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">Alle</option>
                <option value="new">Neu</option>
                <option value="released">Freigegeben</option>
                <option value="deprecated">Veraltet</option>
              </select>
            </div>

            <div className="min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategorie
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Alle Kategorien</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Keyword
              </label>
              <select
                value={keywordFilter}
                onChange={(e) => {
                  setKeywordFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Alle Keywords</option>
                {keywords.map((kw) => (
                  <option key={kw} value={kw}>{kw}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setCategoryFilter('');
                  setKeywordFilter('');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Sorting */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Sortierung:</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="-macro_id">Macro-ID (absteigend)</option>
              <option value="macro_id">Macro-ID (aufsteigend)</option>
              <option value="title">Titel (A-Z)</option>
              <option value="-title">Titel (Z-A)</option>
              <option value="-created_at">Erstelldatum (neueste)</option>
              <option value="created_at">Erstelldatum (älteste)</option>
              <option value="-updated_at">Aktualisiert (neueste)</option>
            </select>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
            <p className="mt-2 text-gray-500">Lade Macros...</p>
          </div>
        ) : macros.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CodeBracketIcon className="h-12 w-12 mx-auto text-gray-300 mb-2" />
            Keine Macros gefunden
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Macro-ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Titel
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Autor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kategorie
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VV Version
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Keywords
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aktualisiert
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {macros.map((macro) => (
                <tr
                  key={macro.id}
                  onClick={() => navigate(`/visiview/macros/${macro.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium text-indigo-600">
                      {macro.macro_id}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                      {macro.title}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {macro.author || macro.author_user_name || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {macro.category || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {macro.visiview_version || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      STATUS_LABELS[macro.status]?.color || 'bg-gray-100 text-gray-800'
                    }`}>
                      {STATUS_LABELS[macro.status]?.label || macro.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {macro.keywords && macro.keywords.split(',').slice(0, 3).map((kw, idx) => (
                        <span key={idx} className="inline-flex px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                          {kw.trim()}
                        </span>
                      ))}
                      {macro.keywords && macro.keywords.split(',').length > 3 && (
                        <span className="text-xs text-gray-400">+{macro.keywords.split(',').length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(macro.updated_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={(e) => handleDownload(macro.id, e)}
                      className="text-indigo-600 hover:text-indigo-900"
                      title="Download"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-500">
              {totalCount} Macro{totalCount !== 1 ? 's' : ''} gefunden
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <span className="text-sm text-gray-700">
                Seite {currentPage} von {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisiViewMacros;
