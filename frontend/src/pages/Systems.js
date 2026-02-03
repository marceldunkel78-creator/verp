import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import storage from '../utils/sessionStore';
import {
  PlusIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  ComputerDesktopIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  SparklesIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  FolderIcon,
  Squares2X2Icon,
  ListBulletIcon,
  MapPinIcon,
  UserIcon
} from '@heroicons/react/24/outline';

// Simple Map Component using Leaflet (if available) or placeholder
const SystemsMap = ({ systems, onSystemClick }) => {
  const [mapError, setMapError] = useState(false);
  const mapRef = useRef(null);
  const isInitializingRef = useRef(false);
  
  // Filter systems with valid coordinates
  const systemsWithCoords = useMemo(() => {
    console.log('Total systems received:', systems.length);
    const filtered = systems.filter(s => {
      const lat = s.location_latitude;
      const lng = s.location_longitude;
      
      // Skip if coordinates are null or undefined
      if (lat == null || lng == null) return false;
      
      // Convert to string and trim
      const latStr = String(lat).trim();
      const lngStr = String(lng).trim();
      
      // Skip if empty strings
      if (latStr === '' || lngStr === '') return false;
      
      // Try to parse as float
      const latNum = parseFloat(latStr);
      const lngNum = parseFloat(lngStr);
      
      // Check if valid numbers and finite
      const hasValidLat = !isNaN(latNum) && isFinite(latNum);
      const hasValidLng = !isNaN(lngNum) && isFinite(lngNum);
      const isValid = hasValidLat && hasValidLng;
      
      if (!isValid) {
        console.log('Invalid coordinates for system:', s.system_number, { lat, lng, latStr, lngStr, latNum, lngNum });
      }
      
      return isValid;
    });
    console.log('Systems with valid coordinates:', filtered.length, 'out of', systems.length);
    if (filtered.length > 0) {
      console.log('Sample system with coords:', filtered[0].system_number, {
        lat: filtered[0].location_latitude,
        lng: filtered[0].location_longitude
      });
    }
    return filtered;
  }, [systems]);

  useEffect(() => {
    // Cleanup function to remove map when component unmounts
    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.off();
          mapRef.current.remove();
          mapRef.current = null;
        } catch (e) {
          console.log('Error removing map on cleanup:', e);
        }
      }
    };
  }, []);

  useEffect(() => {
    // Prevent multiple simultaneous initializations
    if (isInitializingRef.current) {
      console.log('Map initialization already in progress, skipping');
      return;
    }
    
    // Check if Leaflet is available
    if (typeof window !== 'undefined' && !window.L) {
      // Load Leaflet CSS and JS dynamically
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap();
      script.onerror = () => setMapError(true);
      document.head.appendChild(script);
    } else if (window.L && systemsWithCoords.length > 0) {
      initMap();
    }
  }, [systemsWithCoords]);

  const initMap = () => {
    if (!window.L || systemsWithCoords.length === 0) return;
    if (isInitializingRef.current) return;
    
    isInitializingRef.current = true;
    
    const container = document.getElementById('systems-map');
    if (!container) {
      isInitializingRef.current = false;
      return;
    }
    
    // Remove existing map instance if it exists
    if (mapRef.current) {
      try {
        mapRef.current.off();
        mapRef.current.remove();
        mapRef.current = null;
      } catch (e) {
        console.log('Error removing old map:', e);
      }
    }
    
    // Clear container completely
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.className = 'w-full h-[500px] rounded-lg border';
    
    // Remove any Leaflet state
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }
    
    // Small delay to ensure cleanup is complete
    setTimeout(() => {
      try {
        // Double check container still exists and is clean
        const freshContainer = document.getElementById('systems-map');
        if (!freshContainer) {
          isInitializingRef.current = false;
          return;
        }
        
        // One more cleanup just to be sure
        if (freshContainer._leaflet_id) {
          delete freshContainer._leaflet_id;
        }
        
        // Calculate center
        const avgLat = systemsWithCoords.reduce((sum, s) => sum + parseFloat(s.location_latitude), 0) / systemsWithCoords.length;
        const avgLng = systemsWithCoords.reduce((sum, s) => sum + parseFloat(s.location_longitude), 0) / systemsWithCoords.length;
        
        const map = window.L.map('systems-map', {
          center: [avgLat || 50.0, avgLng || 10.0],
          zoom: 5,
          scrollWheelZoom: true
        });
        
        mapRef.current = map;
        
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);
        
        // Add markers
        systemsWithCoords.forEach(system => {
          const marker = window.L.marker([
            parseFloat(system.location_latitude),
            parseFloat(system.location_longitude)
          ]).addTo(map);
          
          marker.bindPopup(`
            <div style="min-width: 200px">
              <strong>${system.system_number}</strong><br/>
              <span style="font-size: 14px">${system.system_name}</span><br/>
              <span style="font-size: 12px; color: #666">${system.customer_name || 'Kein Kunde'}</span><br/>
              <span style="font-size: 11px; color: #888">${system.location_city || ''}</span>
            </div>
          `);
          
          marker.on('click', () => onSystemClick && onSystemClick(system.id));
        });
        
        // Fit bounds if multiple systems
        if (systemsWithCoords.length > 1) {
          const bounds = window.L.latLngBounds(
            systemsWithCoords.map(s => [parseFloat(s.location_latitude), parseFloat(s.location_longitude)])
          );
          map.fitBounds(bounds, { padding: [50, 50] });
        }
        
        isInitializingRef.current = false;
      } catch (e) {
        console.error('Map init error:', e);
        setMapError(true);
        isInitializingRef.current = false;
      }
    }, 50);
  };

  if (systemsWithCoords.length === 0) {
    return (
      <div className="bg-gray-100 rounded-lg p-12 text-center">
        <MapPinIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Keine Systeme mit Koordinaten vorhanden</p>
        <p className="text-sm text-gray-500 mt-2">
          Fügen Sie Koordinaten in den Systemdetails hinzu, um sie auf der Karte anzuzeigen.
        </p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="bg-gray-100 rounded-lg p-12 text-center">
        <MapPinIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Karte konnte nicht geladen werden</p>
      </div>
    );
  }

  return (
    <div id="systems-map" className="w-full h-[500px] rounded-lg border" />
  );
};

const Systems = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // View mode: 'cards', 'list', 'map'
  const [viewMode, setViewMode] = useState('cards');
  
  // Filter data
  const [employees, setEmployees] = useState([]);
  const [cities, setCities] = useState([]);
  const [countries, setCountries] = useState([]);
  
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

  const SESSION_KEY = 'systems_search_state';

  const loadSearchState = () => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return false;
      if (st.searchTerm !== undefined) setSearchTerm(st.searchTerm);
      if (st.statusFilter !== undefined) setStatusFilter(st.statusFilter);
      if (st.cityFilter !== undefined) setCityFilter(st.cityFilter);
      if (st.countryFilter !== undefined) setCountryFilter(st.countryFilter);
      if (st.employeeFilter !== undefined) setEmployeeFilter(st.employeeFilter);
      if (st.viewMode !== undefined) setViewMode(st.viewMode);
      const page = st.currentPage || 1;
      if (st.currentPage) setCurrentPage(st.currentPage);
      if (st.systems) setSystems(st.systems);
      if (st.totalPages) setTotalPages(st.totalPages);
      if (st.totalCount !== undefined) setTotalCount(st.totalCount);
      return { page, filters: { searchTerm: st.searchTerm, statusFilter: st.statusFilter, cityFilter: st.cityFilter, countryFilter: st.countryFilter, employeeFilter: st.employeeFilter } };
    } catch (e) {
      console.warn('Failed to load systems search state', e);
      return false;
    }
  };

  const saveSearchState = () => {
    try {
      const st = { searchTerm, statusFilter, cityFilter, countryFilter, employeeFilter, viewMode, currentPage, systems, totalPages, totalCount };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save systems search state', e);
    }
  };

  // Check for customer URL parameter on mount
  useEffect(() => {
    const urlCustomerId = searchParams.get('customer');
    if (urlCustomerId) {
      setNewSystem(prev => ({ ...prev, customer: urlCustomerId }));
      setShowCreateModal(true);
      return;
    }

    // On mount prefer URL params; otherwise restore from sessionStorage
    const urlParams = Object.fromEntries([...searchParams]);
    if (Object.keys(urlParams).length > 0) {
      return;
    }

    const restored = loadSearchState();
    if (restored && restored.page) {
      const params = {};
      if (restored.filters.searchTerm) params.search = restored.filters.searchTerm;
      if (restored.filters.statusFilter) params.status = restored.filters.statusFilter;
      if (restored.filters.cityFilter) params.city = restored.filters.cityFilter;
      if (restored.filters.countryFilter) params.country = restored.filters.countryFilter;
      if (restored.filters.employeeFilter) params.employee = restored.filters.employeeFilter;
      params.page = String(restored.page);
      setSearchParams(params);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist state whenever relevant parts change
  useEffect(() => {
    saveSearchState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, cityFilter, countryFilter, employeeFilter, viewMode, currentPage, systems, totalPages, totalCount]);

  // React to URL query param changes
  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    const hasParams = Object.keys(params).length > 0 && !params.customer;
    if (hasParams) {
      setSearchTerm(params.search || '');
      setStatusFilter(params.status || '');
      setCityFilter(params.city || '');
      setCountryFilter(params.country || '');
      setEmployeeFilter(params.employee || '');
      const page = params.page ? parseInt(params.page, 10) : 1;
      setCurrentPage(page);
      fetchSystems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    fetchSystems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, cityFilter, countryFilter, employeeFilter]);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    if (showCreateModal) {
      fetchCustomers();
    }
  }, [showCreateModal]);

  const fetchFilters = async () => {
    try {
      const empRes = await api.get('/users/employees/?employment_status=aktiv');
      const allEmployees = empRes.data.results || empRes.data || [];
      
      // Filter nur Vertrieb und Geschäftsführung
      const filteredEmployees = allEmployees.filter(emp => 
        emp.department === 'vertrieb' || emp.department === 'geschaeftsfuehrung'
      );
      setEmployees(filteredEmployees);
      
      // Get unique cities and countries from systems
      const systemsRes = await api.get('/systems/systems/?page_size=1000');
      const allSystems = systemsRes.data.results || systemsRes.data || [];
      
      const uniqueCities = [...new Set(allSystems.map(s => s.location_city).filter(Boolean))].sort();
      const uniqueCountries = [...new Set(allSystems.map(s => s.location_country).filter(Boolean))].sort();
      
      setCities(uniqueCities);
      setCountries(uniqueCountries);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const fetchSystems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // For map view, load ALL systems (no pagination)
      const pageSize = viewMode === 'map' ? 10000 : 12;
      params.append('page', currentPage);
      params.append('page_size', pageSize);
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (cityFilter) params.append('location_city', cityFilter);
      if (countryFilter) params.append('location_country', countryFilter);
      if (employeeFilter) params.append('responsible_employee', employeeFilter);
      
      console.log(`Fetching systems for ${viewMode} view with pageSize:`, pageSize);
      const response = await api.get(`/systems/systems/?${params.toString()}`);
      const systemsData = response.data.results || response.data;
      console.log(`API returned ${systemsData.length} systems (total count: ${response.data.count})`);
      setSystems(systemsData);
      
      // Debug: Log first system to check coordinate fields
      const withCoords = systemsData.filter(s => s.location_latitude && s.location_longitude);
      console.log(`Systems with coordinates in response: ${withCoords.length}`);
      if (systemsData.length > 0) {
        console.log('First system data:', systemsData[0]);
        console.log('Sample coordinates:', {
          lat: systemsData[0].location_latitude,
          lng: systemsData[0].location_longitude
        });
      }
      
      if (response.data.count) {
        setTotalCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / pageSize));
      }
    } catch (error) {
      console.error('Error fetching systems:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers/customers/?is_active=true&page_size=1000');
      setCustomers(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = {};
    if (searchTerm) params.search = searchTerm;
    if (statusFilter) params.status = statusFilter;
    if (cityFilter) params.city = cityFilter;
    if (countryFilter) params.country = countryFilter;
    if (employeeFilter) params.employee = employeeFilter;
    params.page = '1';
    setSearchParams(params);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setSearchTerm('');
    setStatusFilter('');
    setCityFilter('');
    setCountryFilter('');
    setEmployeeFilter('');
    setCurrentPage(1);
    setSystems([]);
    setSearchParams({});
    try { storage.remove(SESSION_KEY); } catch (e) { /* ignore */ }
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
      setStarNameSuggestions(response.data.names || []);
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
      'unbekannt': 'bg-gray-100 text-gray-800',
      'in_nutzung': 'bg-green-100 text-green-800',
      'in_wartung': 'bg-yellow-100 text-yellow-800',
      'ausser_betrieb': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'unbekannt': 'Unbekannt',
      'in_nutzung': 'In Nutzung',
      'in_wartung': 'In Wartung',
      'ausser_betrieb': 'Außer Betrieb'
    };
    return labels[status] || status;
  };

  const handleEdit = (systemId) => {
    navigate(`/sales/systems/${systemId}`);
  };

  const clearFilters = () => {
    handleReset();
  };

  const hasActiveFilters = statusFilter || cityFilter || countryFilter || employeeFilter || searchTerm;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <ComputerDesktopIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Systeme</h1>
          <span className="text-gray-500">({totalCount})</span>
        </div>
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 ${viewMode === 'cards' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Kachelansicht"
            >
              <Squares2X2Icon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Listenansicht"
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => { setViewMode('map'); setCurrentPage(1); }}
              className={`p-2 ${viewMode === 'map' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Kartenansicht"
            >
              <MapPinIcon className="h-5 w-5" />
            </button>
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
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <input
                type="text"
                placeholder="Suche nach Name, Nummer, Kunde..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Alle Status</option>
              <option value="unbekannt">Unbekannt</option>
              <option value="in_nutzung">In Nutzung</option>
              <option value="in_wartung">In Wartung</option>
              <option value="ausser_betrieb">Außer Betrieb</option>
            </select>
            
            {/* City Filter */}
            <select
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Alle Städte</option>
              {cities.map(city => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            
            {/* Country Filter */}
            <select
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Alle Länder</option>
              {countries.map(country => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            
            {/* Employee Filter */}
            <select
              value={employeeFilter}
              onChange={(e) => {
                setEmployeeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Alle Mitarbeiter</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Suchen
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Filter zurücksetzen
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Content based on view mode */}
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
            <>
              {/* Cards View */}
              {viewMode === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {systems.map((system) => (
                    <div
                      key={system.id}
                      onClick={() => navigate(`/sales/systems/${system.id}`)}
                      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
                        <span className="font-mono font-medium text-blue-600">{system.system_number}</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(system.status)}`}>
                          {getStatusLabel(system.status)}
                        </span>
                      </div>
                      
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-1 truncate" title={system.system_name}>
                          {system.system_name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-1 truncate" title={system.customer_name}>
                          {system.customer_name || 'Kein Kunde'}
                        </p>
                        {system.responsible_employee_name && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                            <UserIcon className="h-3 w-3" />
                            {system.responsible_employee_name}
                          </p>
                        )}
                        {system.location_city && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                            <MapPinIcon className="h-3 w-3" />
                            {system.location_city}
                          </p>
                        )}
                        
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
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* List View */}
              {viewMode === 'list' && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 table-fixed">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                          System
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Kunde
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Standort
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Zuständig
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {systems.map((system) => (
                        <tr
                          key={system.id}
                          onClick={() => navigate(`/sales/systems/${system.id}`)}
                          className="hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="px-6 py-4 w-48">
                            <div className="flex items-center">
                              <div className="truncate max-w-[160px]">
                                <div className="text-sm font-medium text-blue-600">{system.system_number}</div>
                                <div className="text-sm text-gray-900 truncate" title={system.system_name}>{system.system_name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{system.customer_name || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{system.location_city || '-'}</div>
                            <div className="text-xs text-gray-500">{system.location_university || ''}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{system.responsible_employee_name || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(system.status)}`}>
                              {getStatusLabel(system.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Map View */}
              {viewMode === 'map' && (
                <SystemsMap 
                  systems={systems} 
                  onSystemClick={(id) => navigate(`/sales/systems/${id}`)} 
                />
              )}
            </>
          )}

          {/* Pagination (not for map view) */}
          {viewMode !== 'map' && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                Zeige {(currentPage - 1) * 12 + 1} - {Math.min(currentPage * 12, totalCount)} von {totalCount} Systemen
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const newPage = Math.max(1, currentPage - 1);
                    setCurrentPage(newPage);
                    const params = {};
                    if (searchTerm) params.search = searchTerm;
                    if (statusFilter) params.status = statusFilter;
                    if (cityFilter) params.city = cityFilter;
                    if (countryFilter) params.country = countryFilter;
                    if (employeeFilter) params.employee = employeeFilter;
                    params.page = String(newPage);
                    setSearchParams(params);
                  }}
                  disabled={currentPage === 1}
                  className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <span className="px-4 py-2 border rounded-lg bg-gray-50">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => {
                    const newPage = Math.min(totalPages, currentPage + 1);
                    setCurrentPage(newPage);
                    const params = {};
                    if (searchTerm) params.search = searchTerm;
                    if (statusFilter) params.status = statusFilter;
                    if (cityFilter) params.city = cityFilter;
                    if (countryFilter) params.country = countryFilter;
                    if (employeeFilter) params.employee = employeeFilter;
                    params.page = String(newPage);
                    setSearchParams(params);
                  }}
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
