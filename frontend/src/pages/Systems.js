import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ComputerDesktopIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  SparklesIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  FolderIcon
} from '@heroicons/react/24/outline';

const Systems = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [newSystem, setNewSystem] = useState({
    customer: '',
    system_name: '',
    description: ''
  });
  const [suggestedName, setSuggestedName] = useState('');
  const [starNameSearch, setStarNameSearch] = useState('');
  const [starNameSuggestions, setStarNameSuggestions] = useState([]);
  const [showStarSearch, setShowStarSearch] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Check for customer URL parameter on mount
  useEffect(() => {
    const urlCustomerId = searchParams.get('customer');
    if (urlCustomerId) {
      // Pre-fill customer and open create modal
      setNewSystem(prev => ({ ...prev, customer: urlCustomerId }));
      setShowCreateModal(true);
      // Fetch customers to populate the dropdown
      fetchCustomers();
    }
  }, [searchParams]);

  useEffect(() => {
    fetchSystems();
  }, [currentPage, statusFilter]);

  useEffect(() => {
    if (showCreateModal && customers.length === 0) {
      fetchCustomers();
    }
  }, [showCreateModal]);

  const fetchSystems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', '10');
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      
      const response = await api.get(`/systems/systems/?${params.toString()}`);
      setSystems(response.data.results || response.data);
      if (response.data.count) {
        setTotalCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 10));
      }
    } catch (error) {
      console.error('Error fetching systems:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers/customers/?is_active=true');
      setCustomers(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchSystems();
  };

  const suggestStarName = async () => {
    try {
      const response = await api.get('/systems/systems/suggest_name/');
      setSuggestedName(response.data.suggested_name);
      setNewSystem(prev => ({ ...prev, system_name: response.data.suggested_name }));
    } catch (error) {
      console.error('Error suggesting name:', error);
    }
  };

  const searchStarNames = async (query) => {
    if (!query || query.length < 2) {
      setStarNameSuggestions([]);
      return;
    }
    try {
      const response = await api.get(`/systems/systems/search_star_names/?q=${encodeURIComponent(query)}`);
      setStarNameSuggestions(response.data.results || []);
    } catch (error) {
      console.error('Error searching star names:', error);
    }
  };

  const handleStarNameSearch = (e) => {
    const query = e.target.value;
    setStarNameSearch(query);
    searchStarNames(query);
  };

  const selectStarName = (name) => {
    setNewSystem(prev => ({ ...prev, system_name: name }));
    setStarNameSearch('');
    setStarNameSuggestions([]);
    setShowStarSearch(false);
  };

  const handleCreateSystem = async (e) => {
    e.preventDefault();
    if (!newSystem.customer) {
      alert('Bitte wählen Sie einen Kunden aus.');
      return;
    }
    if (!newSystem.system_name) {
      alert('Bitte geben Sie einen Systemnamen ein.');
      return;
    }

    setCreateLoading(true);
    try {
      const response = await api.post('/systems/systems/', newSystem);
      setShowCreateModal(false);
      setNewSystem({ customer: '', system_name: '', description: '' });
      navigate(`/sales/systems/${response.data.id}`);
    } catch (error) {
      console.error('Error creating system:', error);
      alert('Fehler beim Erstellen des Systems: ' + (error.response?.data?.detail || error.message));
    } finally {
      setCreateLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-green-100 text-green-800',
      'inactive': 'bg-gray-100 text-gray-800',
      'maintenance': 'bg-yellow-100 text-yellow-800',
      'decommissioned': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'active': 'Aktiv',
      'inactive': 'Inaktiv',
      'maintenance': 'In Wartung',
      'decommissioned': 'Außer Betrieb'
    };
    return labels[status] || status;
  };

  const handleEdit = (systemId) => {
    navigate(`/sales/systems/${systemId}`);
  };

  const handleDelete = async (systemId, systemName) => {
    if (window.confirm(`Möchten Sie das System "${systemName || systemId}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      try {
        await api.delete(`/systems/systems/${systemId}/`);
        setSystems(systems.filter(s => s.id !== systemId));
      } catch (error) {
        console.error('Error deleting system:', error);
        alert('Fehler beim Löschen des Systems. Möglicherweise ist es mit anderen Daten verknüpft.');
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <ComputerDesktopIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Systeme</h1>
        </div>
        <button
          onClick={() => {
            setShowCreateModal(true);
            suggestStarName();
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Neues System
        </button>
      </div>

      {/* Search and Filter */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Suche nach Systemnummer, Name oder Kunde..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="inactive">Inaktiv</option>
            <option value="maintenance">In Wartung</option>
            <option value="decommissioned">Außer Betrieb</option>
          </select>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Suchen
          </button>
        </div>
      </form>

      {/* Systems Grid (Kachelansicht) */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laden...</p>
        </div>
      ) : (
        <>
          {systems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ComputerDesktopIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Keine Systeme gefunden</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {systems.map((system) => (
                  <div
                    key={system.id}
                    onClick={() => navigate(`/sales/systems/${system.id}`)}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                  >
                  {/* Header mit Systemnummer und Status */}
                  <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
                    <span className="font-mono font-medium text-blue-600">{system.system_number}</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(system.status)}`}>
                      {getStatusLabel(system.status)}
                    </span>
                  </div>
                  
                  {/* Inhalt */}
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-1 truncate" title={system.system_name}>
                      {system.system_name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2 truncate" title={system.customer_name}>
                      {system.customer_name || 'Kein Kunde'}
                    </p>
                    {system.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-3" title={system.description}>
                        {system.description}
                      </p>
                    )}
                    
                    {/* Counts */}
                    <div className="flex items-center gap-4 pt-3 border-t">
                      <div className="flex items-center gap-1" title="Komponenten">
                        <CubeIcon className="h-4 w-4 text-purple-500" />
                        <span className="text-sm font-medium">{system.component_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Service-Tickets">
                        <WrenchScrewdriverIcon className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium">{system.service_ticket_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Projekte">
                        <FolderIcon className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">{system.project_count || 0}</span>
                      </div>
                    </div>
                    
                    {/* Actions (Edit / Delete) */}
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEdit(system.id); }}
                        className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200"
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Bearbeiten
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(system.id, system.system_name); }}
                        className="flex items-center px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200"
                      >
                        <TrashIcon className="h-4 w-4 mr-1" />
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Zeige {(currentPage - 1) * 10 + 1} - {Math.min(currentPage * 10, totalCount)} von {totalCount} Systemen
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <span className="px-4 py-2 border rounded-lg bg-gray-50">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setShowCreateModal(false)}></div>
            
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Neues System erstellen</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleCreateSystem}>
                {/* Kunde */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kunde *
                  </label>
                  <select
                    value={newSystem.customer}
                    onChange={(e) => setNewSystem(prev => ({ ...prev, customer: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Kunde auswählen...</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.customer_number} - {customer.title} {customer.first_name} {customer.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Systemname */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Systemname (IAU Sternname) *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSystem.system_name}
                      onChange={(e) => setNewSystem(prev => ({ ...prev, system_name: e.target.value }))}
                      placeholder="z.B. Sirius, Vega, Aldebaran..."
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={suggestStarName}
                      className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 flex items-center gap-1"
                      title="Sternname vorschlagen"
                    >
                      <SparklesIcon className="h-5 w-5" />
                    </button>
                  </div>
                  
                  {/* Star Name Search */}
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowStarSearch(!showStarSearch)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {showStarSearch ? 'Suche ausblenden' : 'Sternnamen suchen...'}
                    </button>
                    
                    {showStarSearch && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={starNameSearch}
                          onChange={handleStarNameSearch}
                          placeholder="Sternname eingeben..."
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                        {starNameSuggestions.length > 0 && (
                          <div className="mt-1 border rounded-lg bg-white shadow-lg max-h-40 overflow-y-auto">
                            {starNameSuggestions.map((name, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => selectStarName(name)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Beschreibung */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={newSystem.description}
                    onChange={(e) => setNewSystem(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Kurze Beschreibung des Systems..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createLoading ? 'Erstelle...' : 'System erstellen'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Systems;
