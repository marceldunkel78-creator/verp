import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import storage from '../utils/sessionStore';
import { 
  PlusIcon, PencilIcon, TrashIcon,
  DocumentTextIcon, ArrowDownTrayIcon,
  DocumentArrowDownIcon, EyeIcon,
  CalendarIcon, FunnelIcon
} from '@heroicons/react/24/outline';

const PriceLists = () => {
  const navigate = useNavigate();
  const [priceLists, setPriceLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [pricelistTypes, setPricelistTypes] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    year: '',
    supplier: ''
  });
  const [generatingPdf, setGeneratingPdf] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pricelistToDelete, setPricelistToDelete] = useState(null);

  const SESSION_KEY = 'pricelists_search_state';
  const [searchParams, setSearchParams] = useSearchParams();

  const loadSearchState = () => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return false;
      if (st.filters) setFilters(st.filters);
      const page = st.currentPage || 1;
      if (st.currentPage) setCurrentPage(st.currentPage);
      if (st.priceLists) setPriceLists(st.priceLists);
      if (st.totalPages) setTotalPages(st.totalPages);
      if (st.hasSearched) setHasSearched(true);
      return { page, filters: st.filters || null };
    } catch (e) {
      console.warn('Failed to load pricelists search state', e);
      return false;
    }
  };

  const saveSearchState = () => {
    try {
      const st = { filters, currentPage, priceLists, totalPages, hasSearched };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save pricelists search state', e);
    }
  };

  // Load pricelist types and suppliers on mount
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [typesRes, suppliersRes] = await Promise.all([
          api.get('/pricelists/types/'),
          api.get('/pricelists/suppliers/')
        ]);
        setPricelistTypes(typesRes.data);
        setSuppliers(suppliersRes.data);
      } catch (err) {
        console.error('Error loading metadata:', err);
      }
    };
    loadMeta();
  }, []);

  useEffect(() => {
    const urlParams = Object.fromEntries([...searchParams]);
    if (Object.keys(urlParams).length > 0) {
      return;
    }

    const restored = loadSearchState();
    if (restored && restored.page) {
      const params = {};
      if (restored.filters) {
        if (restored.filters.search) params.search = restored.filters.search;
        if (restored.filters.type) params.type = restored.filters.type;
        if (restored.filters.year) params.year = restored.filters.year;
        if (restored.filters.supplier) params.supplier = restored.filters.supplier;
      }
      params.page = String(restored.page);
      setSearchParams(params);
    } else if (!restored && hasSearched) {
      fetchPriceLists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasSearched) {
      fetchPriceLists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  useEffect(() => {
    saveSearchState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentPage, priceLists, totalPages, hasSearched]);

  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const newFilters = {
        search: params.search || '',
        type: params.type || '',
        year: params.year || '',
        supplier: params.supplier || ''
      };
      setFilters(newFilters);
      const page = parseInt(params.page, 10) || 1;
      setCurrentPage(page);
      setHasSearched(true);
      fetchPriceLists(newFilters, page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchPriceLists = async (filterOverride = null, pageOverride = null) => {
    setLoading(true);
    try {
      const activeFilters = filterOverride || filters;
      const activePage = pageOverride || currentPage;
      
      const params = new URLSearchParams();
      params.append('page', activePage);
      if (activeFilters.search) params.append('search', activeFilters.search);
      if (activeFilters.type) params.append('type', activeFilters.type);
      if (activeFilters.year) params.append('year', activeFilters.year);
      if (activeFilters.supplier) params.append('supplier', activeFilters.supplier);

      const response = await api.get(`/pricelists/?${params.toString()}`);
      setPriceLists(response.data.results || response.data);
      const count = response.data.count || (response.data.results ? response.data.results.length : response.data.length);
      setTotalPages(Math.ceil(count / 20));
    } catch (err) {
      console.error('Error fetching price lists:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    setHasSearched(true);
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.type) params.type = filters.type;
    if (filters.year) params.year = filters.year;
    if (filters.supplier) params.supplier = filters.supplier;
    params.page = '1';
    setSearchParams(params);
    fetchPriceLists(filters, 1);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearFilters = () => {
    setFilters({ search: '', type: '', year: '', supplier: '' });
    setSearchParams({});
    setHasSearched(false);
    setPriceLists([]);
    storage.remove(SESSION_KEY);
  };

  const handleGeneratePdf = async (pricelist) => {
    setGeneratingPdf(pricelist.id);
    try {
      const response = await api.post(`/pricelists/${pricelist.id}/generate_pdf/`);
      if (response.data.success) {
        // Update the pricelist in the list
        setPriceLists(prev => prev.map(p => 
          p.id === pricelist.id ? response.data.data : p
        ));
        alert('PDF wurde erfolgreich generiert.');
      } else {
        alert(response.data.message || 'Fehler beim Generieren des PDFs');
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Fehler beim Generieren des PDFs');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleDownloadPdf = async (pricelist) => {
    try {
      const response = await api.get(`/pricelists/${pricelist.id}/download_pdf/`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${pricelist.display_name || 'pricelist'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Fehler beim Herunterladen des PDFs');
    }
  };

  const handlePreviewPdf = async (pricelist) => {
    try {
      const response = await api.get(`/pricelists/${pricelist.id}/preview_pdf/`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error previewing PDF:', err);
      alert('Fehler beim Anzeigen des PDFs');
    }
  };

  const openDeleteModal = (pricelist) => {
    setPricelistToDelete(pricelist);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!pricelistToDelete) return;
    try {
      await api.delete(`/pricelists/${pricelistToDelete.id}/`);
      setPriceLists(prev => prev.filter(p => p.id !== pricelistToDelete.id));
      setDeleteModalOpen(false);
      setPricelistToDelete(null);
    } catch (err) {
      console.error('Error deleting pricelist:', err);
      alert('Fehler beim Löschen der Preisliste');
    }
  };

  const getTypeColor = (type) => {
    const colors = {
      'vs_hardware': 'bg-blue-100 text-blue-800',
      'visiview': 'bg-purple-100 text-purple-800',
      'trading': 'bg-green-100 text-green-800',
      'vs_service': 'bg-orange-100 text-orange-800',
      'combined': 'bg-indigo-100 text-indigo-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  // Generate year options (current year - 2 to current year + 2)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Preislisten</h1>
          <p className="text-gray-600 mt-1">Verkaufs-Preislisten verwalten und PDF erstellen</p>
        </div>
        <button
          onClick={() => navigate('/sales/pricelists/new')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Neue Preisliste
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            name="search"
            placeholder="Suche..."
            value={filters.search}
            onChange={handleFilterChange}
            onKeyDown={handleKeyDown}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          
          <select
            name="type"
            value={filters.type}
            onChange={handleFilterChange}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Alle Typen</option>
            {pricelistTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          
          <select
            name="year"
            value={filters.year}
            onChange={handleFilterChange}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Alle Jahre</option>
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          
          <select
            name="supplier"
            value={filters.supplier}
            onChange={handleFilterChange}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Alle Lieferanten</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.company_name}</option>
            ))}
          </select>
          
          <div className="flex space-x-2">
            <button
              onClick={handleSearch}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Suchen
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FunnelIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {!hasSearched ? (
        <div className="text-center py-16 bg-white rounded-lg shadow-sm">
          <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">Nutzen Sie die Filter oben, um Preislisten zu suchen</p>
        </div>
      ) : loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Lade Preislisten...</p>
        </div>
      ) : priceLists.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow-sm">
          <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">Keine Preislisten gefunden</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Typ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gültigkeit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PDF</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Erstellt</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aktionen</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {priceLists.map((pricelist) => (
                  <tr key={pricelist.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(pricelist.pricelist_type)}`}>
                        {pricelist.pricelist_type_display}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{pricelist.display_name}</div>
                      {pricelist.supplier_name && (
                        <div className="text-sm text-gray-500">{pricelist.supplier_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-600">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        {pricelist.validity_period}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pricelist.has_pdf ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handlePreviewPdf(pricelist)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Vorschau"
                          >
                            <EyeIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(pricelist)}
                            className="text-green-600 hover:text-green-800"
                            title="Herunterladen"
                          >
                            <ArrowDownTrayIcon className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Kein PDF</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {pricelist.created_by_name && (
                        <div>{pricelist.created_by_name}</div>
                      )}
                      {new Date(pricelist.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleGeneratePdf(pricelist)}
                          disabled={generatingPdf === pricelist.id}
                          className="text-purple-600 hover:text-purple-800 disabled:opacity-50"
                          title="PDF generieren"
                        >
                          {generatingPdf === pricelist.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                          ) : (
                            <DocumentArrowDownIcon className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => navigate(`/sales/pricelists/${pricelist.id}`)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Bearbeiten"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(pricelist)}
                          className="text-red-600 hover:text-red-800"
                          title="Löschen"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6 space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Zurück
              </button>
              <span className="px-3 py-1">
                Seite {currentPage} von {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Weiter
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Preisliste löschen</h3>
            <p className="text-gray-600 mb-6">
              Möchten Sie die Preisliste "{pricelistToDelete?.display_name}" wirklich löschen?
              {pricelistToDelete?.has_pdf && ' Das zugehörige PDF wird ebenfalls gelöscht.'}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceLists;
