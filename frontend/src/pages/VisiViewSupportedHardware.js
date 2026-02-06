import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ComputerDesktopIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  CameraIcon,
  CpuChipIcon,
  LightBulbIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

const VisiViewSupportedHardware = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hardware, setHardware] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supportLevelFilter, setSupportLevelFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState([]);
  const [supportLevels, setSupportLevels] = useState([]);
  const [statistics, setStatistics] = useState(null);
  
  // Check write permission
  const canWrite = user?.is_superuser || user?.is_staff || user?.can_write_visiview_supported_hardware || user?.can_write_visiview;

  const fetchHardware = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage);
      params.append('page_size', '20');
      if (searchTerm) params.append('search', searchTerm);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (supportLevelFilter !== 'all') params.append('support_level', supportLevelFilter);
      
      const response = await api.get(`/visiview/supported-hardware/?${params.toString()}`);
      setHardware(response.data.results || response.data);
      if (response.data.count !== undefined) {
        setTotalCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 20));
      }
    } catch (error) {
      console.error('Error fetching supported hardware:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, categoryFilter, supportLevelFilter]);

  const fetchMetadata = useCallback(async () => {
    try {
      const [catRes, levelRes, statsRes] = await Promise.all([
        api.get('/visiview/supported-hardware/categories/'),
        api.get('/visiview/supported-hardware/support_levels/'),
        api.get('/visiview/supported-hardware/statistics/')
      ]);
      setCategories(catRes.data);
      setSupportLevels(levelRes.data);
      setStatistics(statsRes.data);
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  }, []);

  useEffect(() => {
    fetchHardware();
  }, [fetchHardware]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchHardware();
  };

  const handleExportCSV = async () => {
    try {
      // Lade alle Hardware-Einträge für Export
      const params = new URLSearchParams();
      params.append('page_size', '10000');
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (supportLevelFilter !== 'all') params.append('support_level', supportLevelFilter);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await api.get(`/visiview/supported-hardware/?${params.toString()}`);
      const data = response.data.results || response.data;
      
      if (!data || data.length === 0) {
        alert('Keine Daten zum Exportieren');
        return;
      }
      
      // CSV-Header
      const headers = [
        'Kategorie', 'Hersteller', 'Gerät', 'Treiber Name', 'Treiber Version',
        'VisiView Version', 'Support Level', 'Benötigte VisiView Option',
        'Einschränkungen', 'Kommentar', 'Service Status', 'Datenqualität',
        'Autor', 'Aktualisierungsdatum', 'Use Cases'
      ];
      
      // CSV-Zeilen erstellen
      const rows = data.map(hw => [
        hw.category || '',
        hw.manufacturer || '',
        hw.device || '',
        hw.driver_name || '',
        hw.driver_version || '',
        hw.visiview_version || '',
        hw.support_level || '',
        hw.required_visiview_option || '',
        (hw.limitations || '').replace(/"/g, '""'),
        (hw.comment || '').replace(/"/g, '""'),
        hw.service_status || '',
        hw.data_quality || '',
        hw.author || '',
        hw.actualization_date || '',
        hw.use_case_count || 0
      ]);
      
      // CSV zusammenbauen
      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
      ].join('\n');
      
      // BOM für Excel-Kompatibilität
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `VisiView_Supported_Hardware_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Fehler beim Exportieren: ' + error.message);
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Camera':
        return <CameraIcon className="h-5 w-5" />;
      case 'Light source':
        return <LightBulbIcon className="h-5 w-5" />;
      case 'Microscope':
        return <Cog6ToothIcon className="h-5 w-5" />;
      case 'Controller':
      case 'Computer hardware':
        return <CpuChipIcon className="h-5 w-5" />;
      default:
        return <ComputerDesktopIcon className="h-5 w-5" />;
    }
  };

  const getSupportLevelColor = (level) => {
    switch (level) {
      case 'Official Support':
        return 'bg-green-100 text-green-800';
      case 'Tested by Visitron':
        return 'bg-blue-100 text-blue-800';
      case 'Basic Support':
        return 'bg-yellow-100 text-yellow-800';
      case 'Experimental':
        return 'bg-orange-100 text-orange-800';
      case 'Discontinued':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unterstützte Hardware</h1>
          <p className="text-gray-500 text-sm">VisiView-kompatible Hardware-Geräte</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            title="Als CSV exportieren"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            CSV Export
          </button>
          {canWrite && (
            <button
              onClick={() => navigate('/visiview/supported-hardware/new')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5" />
              Neue Hardware
            </button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-blue-600">{statistics.total}</div>
            <div className="text-sm text-gray-500">Gesamt</div>
          </div>
          {Object.entries(statistics.by_category || {}).filter(([_, count]) => count > 0).slice(0, 4).map(([cat, count]) => (
            <div key={cat} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2">
                {getCategoryIcon(cat)}
                <span className="text-2xl font-bold text-gray-900">{count}</span>
              </div>
              <div className="text-sm text-gray-500">{cat}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Suche nach Hersteller, Gerät, Treiber..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="border rounded-lg px-4 py-2"
          >
            <option value="all">Alle Kategorien</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={supportLevelFilter}
            onChange={(e) => { setSupportLevelFilter(e.target.value); setCurrentPage(1); }}
            className="border rounded-lg px-4 py-2"
          >
            <option value="all">Alle Support-Level</option>
            {supportLevels.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Suchen
          </button>
        </form>
      </div>

      {/* Hardware Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Laden...</div>
        ) : hardware.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <ComputerDesktopIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Keine Hardware gefunden</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 min-w-[900px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kategorie
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hersteller
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gerät
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Treiber
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    VisiView Version
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Support Level
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {hardware.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/visiview/supported-hardware/${item.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        {getCategoryIcon(item.category)}
                        <span>{item.category}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.manufacturer}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.device}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.driver_name || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.visiview_version || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.support_level && (
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSupportLevelColor(item.support_level)}`}>
                          {item.support_level}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t">
            <div className="text-sm text-gray-700">
              Seite {currentPage} von {totalPages} ({totalCount} Einträge)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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

export default VisiViewSupportedHardware;
