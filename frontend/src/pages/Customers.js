import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
/* eslint-disable react-hooks/exhaustive-deps */
import api from '../services/api';
import storage from '../utils/sessionStore';
import { 
  PlusIcon, PencilIcon, UserIcon,
  PhoneIcon, EnvelopeIcon, GlobeAltIcon,
  BuildingOfficeIcon, WrenchScrewdriverIcon, BeakerIcon,
  Squares2X2Icon, ListBulletIcon, MapPinIcon,
  ArrowDownTrayIcon, FunnelIcon, ChevronDownIcon, ChevronUpIcon,
  StarIcon, CheckCircleIcon, XCircleIcon
} from '@heroicons/react/24/outline';

// Map Component for Customers
const CustomersMap = ({ customers, onCustomerClick }) => {
  const [mapError, setMapError] = useState(false);
  const mapRef = useRef(null);
  const isInitializingRef = useRef(false);
  
  // Filter customers with valid coordinates
  const customersWithCoords = useMemo(() => {
    console.log('Total customers received:', customers.length);
    const filtered = customers.filter(c => {
      const lat = c.primary_address_latitude;
      const lng = c.primary_address_longitude;
      
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
        console.log('Invalid coordinates for customer:', c.customer_number, { lat, lng, latStr, lngStr, latNum, lngNum });
      }
      
      return isValid;
    });
    console.log('Customers with valid coordinates:', filtered.length, 'out of', customers.length);
    if (filtered.length > 0) {
      console.log('Sample customer with coords:', filtered[0].customer_number, {
        lat: filtered[0].primary_address_latitude,
        lng: filtered[0].primary_address_longitude
      });
    }
    return filtered;
  }, [customers]);

  useEffect(() => {
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
    if (isInitializingRef.current) {
      console.log('Map initialization already in progress, skipping');
      return;
    }
    
    if (typeof window !== 'undefined' && !window.L) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap();
      script.onerror = () => setMapError(true);
      document.head.appendChild(script);
    } else if (window.L && customersWithCoords.length > 0) {
      initMap();
    }
  }, [customersWithCoords]);

  const initMap = () => {
    if (!window.L || customersWithCoords.length === 0) return;
    if (isInitializingRef.current) return;
    
    isInitializingRef.current = true;
    
    const container = document.getElementById('customers-map');
    if (!container) {
      isInitializingRef.current = false;
      return;
    }
    
    if (mapRef.current) {
      try {
        mapRef.current.off();
        mapRef.current.remove();
        mapRef.current = null;
      } catch (e) {
        console.log('Error removing old map:', e);
      }
    }
    
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.className = 'w-full h-[500px] rounded-lg border';
    
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }
    
    setTimeout(() => {
      try {
        const freshContainer = document.getElementById('customers-map');
        if (!freshContainer) {
          isInitializingRef.current = false;
          return;
        }
        
        if (freshContainer._leaflet_id) {
          delete freshContainer._leaflet_id;
        }
        
        const avgLat = customersWithCoords.reduce((sum, c) => sum + parseFloat(c.primary_address_latitude), 0) / customersWithCoords.length;
        const avgLng = customersWithCoords.reduce((sum, c) => sum + parseFloat(c.primary_address_longitude), 0) / customersWithCoords.length;
        
        const map = window.L.map('customers-map', {
          center: [avgLat || 50.0, avgLng || 10.0],
          zoom: 5,
          scrollWheelZoom: true
        });
        
        mapRef.current = map;
        
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);
        
        customersWithCoords.forEach(customer => {
          const marker = window.L.marker([
            parseFloat(customer.primary_address_latitude),
            parseFloat(customer.primary_address_longitude)
          ]).addTo(map);
          
          marker.bindPopup(`
            <div style="min-width: 200px">
              <strong>${customer.customer_number}</strong><br/>
              <span style="font-size: 14px">${customer.full_name}</span><br/>
              <span style="font-size: 11px; color: #888">${customer.primary_address_city || ''}</span>
            </div>
          `);
          
          marker.on('click', () => onCustomerClick && onCustomerClick(customer.id));
        });
        
        if (customersWithCoords.length > 1) {
          const bounds = window.L.latLngBounds(
            customersWithCoords.map(c => [parseFloat(c.primary_address_latitude), parseFloat(c.primary_address_longitude)])
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

  if (customersWithCoords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-gray-50 rounded-lg border">
        <MapPinIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Keine Kunden mit Standortkoordinaten gefunden</p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-gray-50 rounded-lg border">
        <MapPinIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Karte konnte nicht geladen werden</p>
      </div>
    );
  }

  return (
    <div id="customers-map" className="w-full h-[500px] rounded-lg border" />
  );
};
const Customers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // 'cards', 'list', 'map'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [users, setUsers] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    city: '',
    country: '',
    language: '',
    is_active: '',
    // Erweiterte Filter
    responsible_user: '',
    is_reference: '',
    advertising_status: '',
    has_email: '',
    has_phone: '',
    has_address: '',
    has_newsletter: '',
    has_system: ''
  });

  const SESSION_KEY = 'customers_search_state';
  const [searchParams, setSearchParams] = useSearchParams();

  // Lade Benutzer für den Filter
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/users/users/lookup/?department=vertrieb,geschaeftsfuehrung');
        setUsers(response.data || []);
      } catch (error) {
        console.error('Fehler beim Laden der Benutzer:', error);
      }
    };
    fetchUsers();
  }, []);

  const loadSearchState = () => {
    try {
      const st = storage.get(SESSION_KEY);
      if (!st) return false;
      if (st.filters) setFilters(st.filters);
      if (st.viewMode) setViewMode(st.viewMode);
      if (st.showAdvancedFilters) setShowAdvancedFilters(st.showAdvancedFilters);
      const page = st.currentPage || 1;
      if (st.currentPage) setCurrentPage(st.currentPage);
      if (st.customers) setCustomers(st.customers);
      if (st.totalPages) setTotalPages(st.totalPages);
      if (st.totalCount) setTotalCount(st.totalCount);
      if (st.hasSearched) setHasSearched(true);

      // Do NOT call fetch here (fetchCustomers may not be declared yet); return object
      return { page, filters: st.filters || null };
    } catch (e) {
      console.warn('Failed to load customers search state', e);
      return false;
    }
  };

  const saveSearchState = () => {
    try {
      const st = { filters, viewMode, showAdvancedFilters, currentPage, customers, totalPages, totalCount, hasSearched };
      storage.set(SESSION_KEY, st);
    } catch (e) {
      console.warn('Failed to save customers search state', e);
    }
  };


  useEffect(() => {
    // On mount prefer URL params; otherwise restore from localStorage and populate URL
    const urlParams = Object.fromEntries([...searchParams]);
    if (Object.keys(urlParams).length > 0) {
      // let the searchParams effect handle fetching
      return;
    }

    const restored = loadSearchState();
    if (restored && restored.page) {
      // populate URL so back/forward works and trigger fetch via effect
      const params = {};
      if (restored.filters) {
        if (restored.filters.search) params.search = restored.filters.search;
        if (restored.filters.city) params.city = restored.filters.city;
        if (restored.filters.country) params.country = restored.filters.country;
        if (restored.filters.language) params.language = restored.filters.language;
        if (restored.filters.is_active) params.is_active = restored.filters.is_active;
        // Erweiterte Filter
        if (restored.filters.responsible_user) params.responsible_user = restored.filters.responsible_user;
        if (restored.filters.is_reference) params.is_reference = restored.filters.is_reference;
        if (restored.filters.advertising_status) params.advertising_status = restored.filters.advertising_status;
        if (restored.filters.has_email) params.has_email = restored.filters.has_email;
        if (restored.filters.has_phone) params.has_phone = restored.filters.has_phone;
        if (restored.filters.has_address) params.has_address = restored.filters.has_address;
        if (restored.filters.has_newsletter) params.has_newsletter = restored.filters.has_newsletter;
        if (restored.filters.has_system) params.has_system = restored.filters.has_system;
      }
      params.page = String(restored.page);
      setSearchParams(params);
    } else if (!restored && hasSearched) {
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hasSearched) {
      fetchCustomers();
    }
  }, [currentPage]);

  // Refetch when view mode changes (for different page sizes)
  useEffect(() => {
    if (hasSearched) {
      fetchCustomers();
    }
  }, [viewMode]);

  // Persist state whenever relevant parts change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    saveSearchState();
  }, [filters, viewMode, showAdvancedFilters, currentPage, customers, totalPages, totalCount, hasSearched]);

  // React to URL query param changes (back/forward navigation)
  useEffect(() => {
    const params = Object.fromEntries([...searchParams]);
    const hasParams = Object.keys(params).length > 0;
    if (hasParams) {
      const newFilters = {
        search: params.search || '',
        city: params.city || '',
        country: params.country || '',
        language: params.language || '',
        is_active: params.is_active || '',
        // Erweiterte Filter
        responsible_user: params.responsible_user || '',
        is_reference: params.is_reference || '',
        advertising_status: params.advertising_status || '',
        has_email: params.has_email || '',
        has_phone: params.has_phone || '',
        has_address: params.has_address || '',
        has_newsletter: params.has_newsletter || '',
        has_system: params.has_system || ''
      };
      setFilters(newFilters);
      const page = params.page ? parseInt(params.page, 10) : 1;
      setCurrentPage(page);
      setHasSearched(true);
      // fetch to restore the list immediately when navigating back/forward
      fetchCustomers(page, newFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Make fetchCustomers accept filters/page so restoration can call it with saved values
  const fetchCustomers = async (pageArg = null, filtersArg = null) => {
    const page = pageArg || currentPage;
    const useFilters = filtersArg || filters;

    setLoading(true);
    try {
      let url = '/customers/customers/';
      const params = new URLSearchParams();
      
      if (useFilters.search) params.append('search', useFilters.search);
      if (useFilters.city) params.append('city', useFilters.city);
      if (useFilters.country) params.append('country', useFilters.country);
      if (useFilters.language) params.append('language', useFilters.language);
      if (useFilters.is_active) params.append('is_active', useFilters.is_active);
      // Erweiterte Filter
      if (useFilters.responsible_user) {
        if (useFilters.responsible_user === 'none') {
          params.append('no_responsible_user', 'true');
        } else {
          params.append('responsible_user', useFilters.responsible_user);
        }
      }
      if (useFilters.is_reference) params.append('is_reference', useFilters.is_reference);
      if (useFilters.advertising_status) params.append('advertising_status', useFilters.advertising_status);
      if (useFilters.has_email) params.append('has_email', useFilters.has_email);
      if (useFilters.has_phone) params.append('has_phone', useFilters.has_phone);
      if (useFilters.has_address) params.append('has_address', useFilters.has_address);
      if (useFilters.has_newsletter) params.append('has_newsletter', useFilters.has_newsletter);
      if (useFilters.has_system) params.append('has_system', useFilters.has_system);
      
      // For map view, load more customers
      const pageSize = viewMode === 'map' ? 10000 : 9;
      params.append('page', page);
      params.append('page_size', pageSize);
      
      url += `?${params.toString()}`;
      
      const response = await api.get(url);
      const results = response.data.results || [];
      setCustomers(results);
      setTotalCount(response.data.count || 0);
      setTotalPages(Math.ceil((response.data.count || 0) / pageSize));
      setHasSearched(true);

      // Persist immediately so localStorage is updated even if React effects are delayed
      try {
        saveSearchState();
      } catch (e) { console.warn('Could not persist customers search state', e); }

      if (pageArg) setCurrentPage(page);
    } catch (error) {
      console.error('Fehler beim Laden der Kunden:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    // update URL params and let the searchParams effect perform the fetch
    const params = {};
    if (filters.search) params.search = filters.search;
    if (filters.city) params.city = filters.city;
    if (filters.country) params.country = filters.country;
    if (filters.language) params.language = filters.language;
    if (filters.is_active) params.is_active = filters.is_active;
    // Erweiterte Filter
    if (filters.responsible_user) params.responsible_user = filters.responsible_user;
    if (filters.is_reference) params.is_reference = filters.is_reference;
    if (filters.advertising_status) params.advertising_status = filters.advertising_status;
    if (filters.has_email) params.has_email = filters.has_email;
    if (filters.has_phone) params.has_phone = filters.has_phone;
    if (filters.has_address) params.has_address = filters.has_address;
    if (filters.has_newsletter) params.has_newsletter = filters.has_newsletter;
    if (filters.has_system) params.has_system = filters.has_system;
    params.page = '1';
    setSearchParams(params);
    setCurrentPage(1);
    setHasSearched(true);
  };

  const handleReset = () => {
    setFilters({
      search: '',
      city: '',
      country: '',
      language: '',
      is_active: '',
      responsible_user: '',
      is_reference: '',
      advertising_status: '',
      has_email: '',
      has_phone: '',
      has_address: '',
      has_newsletter: '',
      has_system: ''
    });
    setCustomers([]);
    setCurrentPage(1);
    setTotalCount(0);
    setHasSearched(false);
    try { storage.remove(SESSION_KEY); } catch (e) { /* ignore */ }
  };

  // CSV Export
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      
      // Gleiche Filter wie bei der Suche
      if (filters.search) params.append('search', filters.search);
      if (filters.city) params.append('city', filters.city);
      if (filters.country) params.append('country', filters.country);
      if (filters.language) params.append('language', filters.language);
      if (filters.is_active) params.append('is_active', filters.is_active);
      if (filters.responsible_user) {
        if (filters.responsible_user === 'none') {
          params.append('no_responsible_user', 'true');
        } else {
          params.append('responsible_user', filters.responsible_user);
        }
      }
      if (filters.is_reference) params.append('is_reference', filters.is_reference);
      if (filters.advertising_status) params.append('advertising_status', filters.advertising_status);
      if (filters.has_email) params.append('has_email', filters.has_email);
      if (filters.has_phone) params.append('has_phone', filters.has_phone);
      if (filters.has_address) params.append('has_address', filters.has_address);
      if (filters.has_newsletter) params.append('has_newsletter', filters.has_newsletter);
      if (filters.has_system) params.append('has_system', filters.has_system);
      
      const response = await api.get(`/customers/customers/export_csv/?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Download auslösen
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'kunden_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Fehler beim Export:', error);
      alert('Fehler beim Export der Daten');
    } finally {
      setExporting(false);
    }
  };



  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <UserIcon className="h-8 w-8 mr-3 text-blue-600" />
            Kundenverwaltung
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Verwaltung von Kundenstammdaten mit Adressen und Kontaktdaten
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* View Mode Switcher */}
          {hasSearched && (
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white text-blue-600 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Kachelansicht"
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-blue-600 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Listenansicht"
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'map'
                    ? 'bg-white text-blue-600 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Kartenansicht"
              >
                <MapPinIcon className="h-5 w-5" />
              </button>
            </div>
          )}
          <button
            onClick={() => navigate('/sales/customers/new')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Neuer Kunde
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Kundensuche</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <FunnelIcon className="h-4 w-4 mr-1" />
              Erweiterte Filter
              {showAdvancedFilters ? (
                <ChevronUpIcon className="h-4 w-4 ml-1" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 ml-1" />
              )}
            </button>
          </div>
        </div>
        
        {/* Basis-Filter */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche (Name, Nummer)</label>
            <input
              type="text"
              placeholder="Name oder Kundennummer..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
            <input
              type="text"
              placeholder="Stadt..."
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
            <select
              value={filters.country}
              onChange={(e) => setFilters({ ...filters, country: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Alle Länder</option>
              <option value="DE">Deutschland</option>
              <option value="AT">Österreich</option>
              <option value="CH">Schweiz</option>
              <option value="FR">Frankreich</option>
              <option value="IT">Italien</option>
              <option value="ES">Spanien</option>
              <option value="GB">Großbritannien</option>
              <option value="US">USA</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sprache</label>
            <select
              value={filters.language}
              onChange={(e) => setFilters({ ...filters, language: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Alle Sprachen</option>
              <option value="DE">Deutsch</option>
              <option value="EN">English</option>
              <option value="FR">Français</option>
              <option value="ES">Español</option>
              <option value="IT">Italiano</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.is_active}
              onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Alle Status</option>
              <option value="true">Aktiv</option>
              <option value="false">Inaktiv</option>
            </select>
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={handleSearch}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Suchen
            </button>
            <button
              onClick={() => { handleReset(); storage.remove(SESSION_KEY); }}
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Zurücksetzen
            </button>
          </div>
        </div>
        
        {/* Erweiterte Filter */}
        {showAdvancedFilters && (
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Erweiterte Filter</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zuständiger Mitarbeiter</label>
                <select
                  value={filters.responsible_user}
                  onChange={(e) => setFilters({ ...filters, responsible_user: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Alle Mitarbeiter</option>
                  <option value="none">Kein Mitarbeiter</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referenzkunde</label>
                <select
                  value={filters.is_reference}
                  onChange={(e) => setFilters({ ...filters, is_reference: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Alle</option>
                  <option value="true">Ja - als Referenz geeignet</option>
                  <option value="false">Nein</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Werbestatus</label>
                <select
                  value={filters.advertising_status}
                  onChange={(e) => setFilters({ ...filters, advertising_status: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Alle</option>
                  <option value="neu">Neu</option>
                  <option value="zugestimmt">Zugestimmt</option>
                  <option value="abgelehnt">Abgelehnt</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Newsletter</label>
                <select
                  value={filters.has_newsletter}
                  onChange={(e) => setFilters({ ...filters, has_newsletter: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Alle</option>
                  <option value="true">Mit Newsletter-Zustimmung</option>
                  <option value="false">Ohne Newsletter-Zustimmung</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hat E-Mail</label>
                <select
                  value={filters.has_email}
                  onChange={(e) => setFilters({ ...filters, has_email: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Alle</option>
                  <option value="true">Mit E-Mail-Adresse</option>
                  <option value="false">Ohne E-Mail-Adresse</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hat Telefon</label>
                <select
                  value={filters.has_phone}
                  onChange={(e) => setFilters({ ...filters, has_phone: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Alle</option>
                  <option value="true">Mit Telefonnummer</option>
                  <option value="false">Ohne Telefonnummer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hat Adresse</label>
                <select
                  value={filters.has_address}
                  onChange={(e) => setFilters({ ...filters, has_address: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Alle</option>
                  <option value="true">Mit Adresse</option>
                  <option value="false">Ohne Adresse</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hat System</label>
                <select
                  value={filters.has_system}
                  onChange={(e) => setFilters({ ...filters, has_system: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Alle</option>
                  <option value="true">Mit System</option>
                  <option value="false">Ohne System</option>
                </select>
              </div>
            </div>
          </div>
        )}
        
        {/* Ergebnis-Anzeige und Export */}
        {hasSearched && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{totalCount}</span> Kunde(n) gefunden 
              {totalPages > 1 && ` (Seite ${currentPage} von ${totalPages})`}
            </div>
            <button
              onClick={handleExport}
              disabled={exporting || totalCount === 0}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                  Exportiere...
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  Als CSV exportieren
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Customer Display - Cards/List/Map */}
      {!hasSearched ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <UserIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Kunden angezeigt</h3>
          <p className="text-gray-500 mb-4">
            Verwenden Sie die Suchfilter oben, um Kunden anzuzeigen.
          </p>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <UserIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Kunden gefunden</h3>
          <p className="text-gray-500">
            Es wurden keine Kunden mit den angegebenen Filtern gefunden.
          </p>
        </div>
      ) : (
        <>
          {/* Map View */}
          {viewMode === 'map' ? (
            <div className="bg-white shadow rounded-lg p-6">
              <CustomersMap 
                customers={customers} 
                onCustomerClick={(id) => navigate(`/sales/customers/${id}`)} 
              />
            </div>
          ) : viewMode === 'list' ? (
            /* List View */
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kunde
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kontakt
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Standort
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statistiken
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer.id} onClick={() => navigate(`/sales/customers/${customer.id}`)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900 flex items-center">
                              {customer.full_name}
                              {!customer.is_active && (
                                <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                                  Inaktiv
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{customer.customer_number}</div>
                            <div className="flex items-center mt-1">
                              <GlobeAltIcon className="h-3 w-3 text-gray-400 mr-1" />
                              <span className="text-xs text-gray-600">{customer.language_display}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {customer.primary_email && (
                            <div className="flex items-center mb-1">
                              <EnvelopeIcon className="h-4 w-4 mr-1 text-gray-400" />
                              <span className="truncate max-w-xs">{customer.primary_email}</span>
                            </div>
                          )}
                          {customer.primary_phone && (
                            <div className="flex items-center">
                              <PhoneIcon className="h-4 w-4 mr-1 text-gray-400" />
                              <span>{customer.primary_phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {customer.primary_address_city && (
                            <div>{customer.primary_address_city}</div>
                          )}
                          {customer.primary_address_country && (
                            <div className="text-xs text-gray-500">{customer.primary_address_country}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-4 text-xs">
                          <span className="flex items-center" title="Systeme">
                            <BuildingOfficeIcon className="h-4 w-4 mr-1 text-blue-500" />
                            <span className="font-semibold text-blue-600">{customer.system_count || 0}</span>
                          </span>
                          <span className="flex items-center" title="Offene Tickets">
                            <WrenchScrewdriverIcon className="h-4 w-4 mr-1 text-orange-500" />
                            <span className="font-semibold text-orange-600">{customer.open_ticket_count || 0}</span>
                          </span>
                          <span className="flex items-center" title="Projekte">
                            <BeakerIcon className="h-4 w-4 mr-1 text-green-500" />
                            <span className="font-semibold text-green-600">{customer.project_count || 0}</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {customers.map((customer) => (
                <div key={customer.id} className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {customer.full_name}
                          </h3>
                          {!customer.is_active && (
                            <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                              Inaktiv
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{customer.customer_number}</p>
                        <div className="flex items-center mt-1">
                          <GlobeAltIcon className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-sm text-gray-600">{customer.language_display}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/sales/customers/${customer.id}`)}
                        className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2 border-t pt-4">
                      {customer.primary_email && (
                        <div className="flex items-center text-sm text-gray-600">
                          <EnvelopeIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span className="truncate">{customer.primary_email}</span>
                        </div>
                      )}
                      {customer.primary_phone && (
                        <div className="flex items-center text-sm text-gray-600">
                          <PhoneIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span>{customer.primary_phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Statistics */}
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span className="flex items-center" title="Systeme">
                          <BuildingOfficeIcon className="h-4 w-4 mr-1" />
                          <span className="font-semibold text-blue-600">{customer.system_count || 0}</span>
                        </span>
                        <span className="flex items-center" title="Offene Service-Tickets">
                          <WrenchScrewdriverIcon className="h-4 w-4 mr-1" />
                          <span className="font-semibold text-orange-600">{customer.open_ticket_count || 0}</span>
                        </span>
                        <span className="flex items-center" title="Projekte">
                          <BeakerIcon className="h-4 w-4 mr-1" />
                          <span className="font-semibold text-green-600">{customer.project_count || 0}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center space-x-2">
              <button
                onClick={() => {
                  const np = Math.max(1, currentPage - 1);
                  setCurrentPage(np);
                  setSearchParams({ ...(filters.search ? { search: filters.search } : {}), ...(filters.city ? { city: filters.city } : {}), ...(filters.country ? { country: filters.country } : {}), ...(filters.language ? { language: filters.language } : {}), ...(filters.is_active ? { is_active: filters.is_active } : {}), page: String(np) });
                  fetchCustomers(np, filters);
                }}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Zurück
              </button>
              <span className="text-sm text-gray-700">
                Seite {currentPage} von {totalPages}
              </span>
              <button
                onClick={() => {
                  const np = Math.min(totalPages, currentPage + 1);
                  setCurrentPage(np);
                  setSearchParams({ ...(filters.search ? { search: filters.search } : {}), ...(filters.city ? { city: filters.city } : {}), ...(filters.country ? { country: filters.country } : {}), ...(filters.language ? { language: filters.language } : {}), ...(filters.is_active ? { is_active: filters.is_active } : {}), page: String(np) });
                  fetchCustomers(np, filters);
                }}
                disabled={currentPage === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Weiter
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Customers;
