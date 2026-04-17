import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area
} from 'recharts';
import api from '../services/api';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const BusinessIntelligence = () => {
  const [activeTab, setActiveTab] = useState('statistics');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tab 1: Statistics State
  const [salesData, setSalesData] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [supplierData, setSupplierData] = useState(null);
  const [inventoryCategoryData, setInventoryCategoryData] = useState(null);

  // Tab 2: Forecast State
  const [projectForecast, setProjectForecast] = useState(null);
  const [quotationForecast, setQuotationForecast] = useState(null);
  const [combinedForecast, setCombinedForecast] = useState(null);

  // Tab 3: Payments State
  const [paymentsData, setPaymentsData] = useState(null);

  // Tab 4: SQL-Forecast State
  const [sqlForecastData, setSqlForecastData] = useState(null);
  const [sqlForecastLookups, setSqlForecastLookups] = useState(null);
  const [sqlForecastFilters, setSqlForecastFilters] = useState({
    datum_von: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    datum_bis: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    min_wahrscheinlichkeit: 0,
    verkaeufer: '',
    prioritaet: [],
    include_angebote: false,
    angebote_zustand: [],
  });

  // Filter Options State
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [availableProductCategories, setAvailableProductCategories] = useState([]);

  // Filter State
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 12)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    groupBy: 'month',
    metric: 'revenue',
    dataView: 'orders', // 'orders', 'supplier', 'inventoryCategory'
    selectedSuppliers: [], // Array of supplier IDs
    selectedCategories: [], // Array of category IDs
    monthsAhead: 12,
    minProbability: 0
  });

  // Draft filter state (for manual apply) and auto-update toggle
  const [filtersDraft, setFiltersDraft] = useState(filters);
  const [autoReload, setAutoReload] = useState(true);

  // Keep draft in sync when filters are applied externally
  useEffect(() => {
    setFiltersDraft(filters);
  }, [filters]);

  const updateDraft = (changes) => {
    const newDraft = { ...filtersDraft, ...changes };
    setFiltersDraft(newDraft);
    if (autoReload) {
      setFilters(newDraft);
    }
  };

  const applyFilters = async () => {
    setFilters(filtersDraft);
    // If currently on statistics tab, re-fetch immediately
    if (activeTab === 'statistics') {
      await fetchStatisticsData();
    }
  };

  const tabs = [
    { id: 'statistics', label: '📊 Statistiken', icon: '📊' },
    { id: 'forecast', label: '📈 Forecast', icon: '📈' },
    { id: 'sql-forecast', label: '🗄️ SQL-Forecast', icon: '🗄️' },
    { id: 'payments', label: '💰 Zahlungseingänge', icon: '💰' }
  ];

  // Fetch filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [suppliersRes, categoriesRes] = await Promise.all([
          api.get('/bi/filters/suppliers/'),
          api.get('/bi/filters/product-categories/')
        ]);
        setAvailableSuppliers(suppliersRes.data);
        setAvailableProductCategories(categoriesRes.data);
      } catch (err) {
        console.error('Error fetching filter options:', err);
      }
    };
    fetchFilterOptions();
  }, []);

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'statistics') {
      fetchStatisticsData();
    } else if (activeTab === 'forecast') {
      fetchForecastData();
    } else if (activeTab === 'sql-forecast') {
      fetchSqlForecastData();
    } else if (activeTab === 'payments') {
      fetchPaymentsData();
    }
  }, [activeTab, filters]);

  const fetchStatisticsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        start_date: filters.startDate,
        end_date: filters.endDate,
        group_by: filters.groupBy,
        metric: filters.metric
      });

      // Add supplier filter if selected
      const supplierParams = new URLSearchParams(params);
      if (filters.selectedSuppliers.length > 0) {
        supplierParams.append('supplier_ids', filters.selectedSuppliers.join(','));
      }

      // Add category filter if selected
      const categoryParams = new URLSearchParams(params);
      if (filters.selectedCategories.length > 0) {
        categoryParams.append('category_ids', filters.selectedCategories.join(','));
      }

      const [salesRes, categoryRes, customerRes, supplierRes, invCategoryRes] = await Promise.all([
        api.get(`/bi/statistics/sales/?${params}`),
        api.get(`/bi/statistics/sales/by-category/?${params}`),
        api.get(`/bi/statistics/sales/by-customer/?${params}&limit=10`),
        api.get(`/bi/statistics/sales/by-supplier/?${supplierParams}&limit=20`),
        api.get(`/bi/statistics/sales/by-inventory-category/?${categoryParams}`)
      ]);

      setSalesData(salesRes.data);
      setCategoryData(categoryRes.data);
      setCustomerData(customerRes.data);
      setSupplierData(supplierRes.data);
      setInventoryCategoryData(invCategoryRes.data);
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setError('Fehler beim Laden der Statistiken');
    } finally {
      setLoading(false);
    }
  };

  const fetchForecastData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectRes, quotationRes, combinedRes] = await Promise.all([
        api.get(`/bi/forecast/projects/?months_ahead=${filters.monthsAhead}&min_probability=${filters.minProbability}`),
        api.get(`/bi/forecast/quotations/?months_ahead=${filters.monthsAhead}`),
        api.get(`/bi/forecast/combined/?months_ahead=${filters.monthsAhead}&min_probability=${filters.minProbability}`)
      ]);

      setProjectForecast(projectRes.data);
      setQuotationForecast(quotationRes.data);
      setCombinedForecast(combinedRes.data);
    } catch (err) {
      console.error('Error fetching forecast:', err);
      setError('Fehler beim Laden des Forecasts');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/bi/payments/expected/?months_ahead=6`);
      setPaymentsData(response.data);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError('Fehler beim Laden der Zahlungseingänge');
    } finally {
      setLoading(false);
    }
  };

  const fetchSqlForecastLookups = async () => {
    if (sqlForecastLookups) return;
    try {
      const res = await api.get('/sql-projekte/lookups/');
      setSqlForecastLookups(res.data);
    } catch (err) {
      console.error('Error fetching SQL lookups:', err);
    }
  };

  const fetchSqlForecastData = async () => {
    setLoading(true);
    setError(null);
    fetchSqlForecastLookups();
    try {
      const params = new URLSearchParams({
        datum_von: sqlForecastFilters.datum_von,
        datum_bis: sqlForecastFilters.datum_bis,
        min_wahrscheinlichkeit: sqlForecastFilters.min_wahrscheinlichkeit,
      });
      if (sqlForecastFilters.verkaeufer) params.set('verkaeufer', sqlForecastFilters.verkaeufer);
      if (sqlForecastFilters.prioritaet.length > 0) params.set('prioritaet', sqlForecastFilters.prioritaet.join(','));
      if (sqlForecastFilters.include_angebote) {
        params.set('include_angebote', '1');
        if (sqlForecastFilters.angebote_zustand.length > 0) params.set('angebote_zustand', sqlForecastFilters.angebote_zustand.join(','));
      }
      const res = await api.get(`/sql-projekte/forecast/?${params}`);
      setSqlForecastData(res.data);
    } catch (err) {
      console.error('Error fetching SQL forecast:', err);
      setError('Fehler beim Laden des SQL-Forecasts');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatMonth = (dateStr) => {
    if (!dateStr || dateStr === 'Überfällig') return dateStr;
    try {
      const [year, month] = dateStr.split('-');
      return `${month}/${year.slice(2)}`;
    } catch {
      return dateStr;
    }
  };

  // Statistics Tab Content
  const renderStatisticsTab = () => {
    // Daten für Hauptchart basierend auf dataView
    const getChartData = () => {
      // Helper to get allowed names from selected ids or top N
      const getAllowedNames = (selectedIds, availableList, dataList, keyName, defaultTop = 6) => {
        if (selectedIds && selectedIds.length > 0) {
          // Map ids to names using availableList
          return availableList
            .filter(a => selectedIds.includes(a.id))
            .map(a => a.name);
        }
        // Fallback: top entries from server-provided dataList
        return (dataList || []).slice(0, defaultTop).map(d => d[keyName]);
      };

      if (filters.dataView === 'supplier' && supplierData?.time_series) {
        const allowed = getAllowedNames(filters.selectedSuppliers, availableSuppliers, supplierData.data, 'supplier');
        const periodMap = {};
        supplierData.time_series.forEach(item => {
          // If allowed list is non-empty, filter series
          if (allowed && allowed.length > 0 && !allowed.includes(item.supplier)) return;
          if (!periodMap[item.period]) {
            periodMap[item.period] = { period: item.period };
          }
          periodMap[item.period][item.supplier] = filters.metric === 'revenue' ? item.revenue : item.count;
        });
        return Object.values(periodMap).sort((a, b) => a.period.localeCompare(b.period));
      } else if (filters.dataView === 'inventoryCategory' && inventoryCategoryData?.time_series) {
        const allowed = getAllowedNames(filters.selectedCategories, availableProductCategories, inventoryCategoryData.data, 'category');
        const periodMap = {};
        inventoryCategoryData.time_series.forEach(item => {
          if (allowed && allowed.length > 0 && !allowed.includes(item.category)) return;
          if (!periodMap[item.period]) {
            periodMap[item.period] = { period: item.period };
          }
          periodMap[item.period][item.category] = filters.metric === 'revenue' ? item.revenue : item.count;
        });
        return Object.values(periodMap).sort((a, b) => a.period.localeCompare(b.period));
      }
      return salesData?.data || [];
    };

    const getChartKeys = () => {
      if (filters.dataView === 'supplier' && supplierData?.data) {
        if (filters.selectedSuppliers && filters.selectedSuppliers.length > 0) {
          return availableSuppliers
            .filter(s => filters.selectedSuppliers.includes(s.id))
            .map(s => s.name)
            .slice(0, 12);
        }
        return supplierData.data.slice(0, 6).map(d => d.supplier);
      } else if (filters.dataView === 'inventoryCategory' && inventoryCategoryData?.data) {
        if (filters.selectedCategories && filters.selectedCategories.length > 0) {
          return availableProductCategories
            .filter(c => filters.selectedCategories.includes(c.id))
            .map(c => c.name)
            .slice(0, 12);
        }
        return inventoryCategoryData.data.slice(0, 6).map(d => d.category);
      }
      return ['value'];
    };

    const chartData = getChartData();
    const chartKeys = getChartKeys();
    const isMultiLine = filters.dataView !== 'orders';

    return (
    <div className="space-y-6">
      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Filter</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Von</label>
            <input
              type="date"
              value={filtersDraft.startDate}
              onChange={(e) => updateDraft({ startDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bis</label>
            <input
              type="date"
              value={filtersDraft.endDate}
              onChange={(e) => updateDraft({ endDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gruppierung</label>
            <select
              value={filtersDraft.groupBy}
              onChange={(e) => updateDraft({ groupBy: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="month">Monatlich</option>
              <option value="year">Jährlich</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metrik</label>
            <select
              value={filtersDraft.metric}
              onChange={(e) => updateDraft({ metric: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="revenue">Umsatz</option>
              <option value="count">Anzahl</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datenansicht</label>
            <select
              value={filtersDraft.dataView}
              onChange={(e) => updateDraft({ dataView: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="orders">Aufträge</option>
              <option value="supplier">Nach Lieferant</option>
              <option value="inventoryCategory">Nach Warenkategorie</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 col-span-2 md:col-span-1">
            <label className="inline-flex items-center text-sm gap-2">
              <input type="checkbox" checked={autoReload} onChange={(e) => setAutoReload(e.target.checked)} />
              <span>Auto-Update</span>
            </label>
            <button
              onClick={applyFilters}
              disabled={JSON.stringify(filtersDraft) === JSON.stringify(filters) || loading}
              className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              Aktualisieren
            </button>
          </div>
        </div>
        
        {/* Additional filters for supplier/category views */}
        {filtersDraft.dataView === 'supplier' && (
          <div className="mt-4 pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lieferanten auswählen (leer = alle)
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md bg-gray-50">
              {availableSuppliers.map(supplier => (
                <label 
                  key={supplier.id}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${
                    (filtersDraft.selectedSuppliers || []).includes(supplier.id)
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={filtersDraft.selectedSuppliers.includes(supplier.id)}
                    onChange={(e) => {
                      const current = filtersDraft.selectedSuppliers || [];
                      if (e.target.checked) {
                        updateDraft({ selectedSuppliers: [...current, supplier.id] });
                      } else {
                        updateDraft({ selectedSuppliers: current.filter(id => id !== supplier.id) });
                      }
                    }}
                  />
                  {supplier.name}
                </label>
              ))}
              {availableSuppliers.length === 0 && (
                <span className="text-gray-500 text-sm">Keine Lieferanten mit Produkten gefunden</span>
              )}
            </div>
            {filtersDraft.selectedSuppliers && filtersDraft.selectedSuppliers.length > 0 && (
              <button
                onClick={() => updateDraft({ selectedSuppliers: [] })}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Auswahl zurücksetzen
              </button>
            )}
          </div>
        )}

        {filters.dataView === 'inventoryCategory' && (
          <div className="mt-4 pt-4 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Warenkategorien auswählen (leer = alle)
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md bg-gray-50">
              {availableProductCategories.map(category => (
                <label 
                  key={category.id}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm cursor-pointer transition-colors ${
                    (filtersDraft.selectedCategories || []).includes(category.id)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={filtersDraft.selectedCategories.includes(category.id)}
                    onChange={(e) => {
                      const current = filtersDraft.selectedCategories || [];
                      if (e.target.checked) {
                        updateDraft({ selectedCategories: [...current, category.id] });
                      } else {
                        updateDraft({ selectedCategories: current.filter(id => id !== category.id) });
                      }
                    }}
                  />
                  {category.name}
                </label>
              ))}
              {availableProductCategories.length === 0 && (
                <span className="text-gray-500 text-sm">Keine Kategorien gefunden</span>
              )}
            </div>
            {filtersDraft.selectedCategories && filtersDraft.selectedCategories.length > 0 && (
              <button
                onClick={() => updateDraft({ selectedCategories: [] })}
                className="mt-2 text-sm text-green-600 hover:text-green-800"
              >
                Auswahl zurücksetzen
              </button>
            )}
          </div>
        )}
      </div>

      {/* Matching Statistics Info */}
      {(filters.dataView === 'supplier' && supplierData?.matching_stats) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-blue-800">Daten-Matching:</span>
            <span className="text-blue-700">
              📊 {supplierData.matching_stats.matched_by_serial} über Seriennummer (Legacy) |
              📄 {supplierData.matching_stats.matched_by_article} über Artikelnummer |
              ❓ {supplierData.matching_stats.unmatched} nicht zugeordnet
            </span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Hinweis: Legacy-Daten (bis 2025) werden über Seriennummern gematcht, neue Daten über Artikelnummern.
          </p>
        </div>
      )}

      {(filters.dataView === 'inventoryCategory' && inventoryCategoryData?.matching_stats) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-green-800">Daten-Matching:</span>
            <span className="text-green-700">
              📊 {inventoryCategoryData.matching_stats.matched_by_serial} über Seriennummer (Legacy) |
              📄 {inventoryCategoryData.matching_stats.matched_by_article} über Artikelnummer |
              ❓ {inventoryCategoryData.matching_stats.unmatched} nicht zugeordnet
            </span>
          </div>
          <p className="text-xs text-green-600 mt-1">
            Hinweis: Legacy-Daten (bis 2025) werden über Seriennummern gematcht, neue Daten über Artikelnummern.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {salesData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Gesamtumsatz</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(salesData.summary?.total_revenue || 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Anzahl Aufträge</div>
            <div className="text-2xl font-bold text-green-600">
              {salesData.summary?.total_orders || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Durchschn. Auftragswert</div>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency((salesData.summary?.total_revenue || 0) / (salesData.summary?.total_orders || 1))}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Zeitraum</div>
            <div className="text-lg font-semibold text-gray-700">
              {salesData.filters?.start_date} - {salesData.filters?.end_date}
            </div>
          </div>
        </div>
      )}

      {/* Main Chart - Sales over Time */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">
          {filters.metric === 'revenue' ? 'Umsatz' : 'Anzahl'} im Zeitverlauf
          {filters.dataView === 'supplier' && ' (nach Lieferant)'}
          {filters.dataView === 'inventoryCategory' && ' (nach Warenkategorie)'}
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {isMultiLine ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tickFormatter={formatMonth} />
                <YAxis tickFormatter={filters.metric === 'revenue' ? (v) => `${(v/1000).toFixed(0)}k€` : undefined} />
                <Tooltip 
                  formatter={(value) => filters.metric === 'revenue' ? formatCurrency(value) : value}
                  labelFormatter={formatMonth}
                />
                <Legend />
                {chartKeys.map((key, index) => (
                  <Line 
                    key={key}
                    type="monotone" 
                    dataKey={key} 
                    stroke={COLORS[index % COLORS.length]} 
                    strokeWidth={2} 
                    dot={false}
                    name={key}
                  />
                ))}
              </LineChart>
            ) : (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tickFormatter={formatMonth} />
                <YAxis tickFormatter={filters.metric === 'revenue' ? (v) => `${(v/1000).toFixed(0)}k€` : undefined} />
                <Tooltip 
                  formatter={(value) => filters.metric === 'revenue' ? formatCurrency(value) : value}
                  labelFormatter={formatMonth}
                />
                <Legend />
                <Bar dataKey="value" fill="#3B82F6" name={filters.metric === 'revenue' ? 'Umsatz' : 'Anzahl'} />
                <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={false} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Umsatz nach Kategorie</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData?.data?.slice(0, 8) || []}
                  dataKey="revenue"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {(categoryData?.data || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Top 10 Kunden</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerData?.data?.slice(0, 10) || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} />
                <YAxis type="category" dataKey="customer_name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="total_revenue" fill="#10B981" name="Umsatz" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Table */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Detailübersicht nach Kategorie</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategorie</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Umsatz</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Anzahl</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Anteil</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categoryData?.data?.map((cat, index) => {
                const totalRevenue = categoryData.data.reduce((sum, c) => sum + c.revenue, 0);
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {cat.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatCurrency(cat.revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {cat.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {totalRevenue > 0 ? ((cat.revenue / totalRevenue) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
  };

  // Forecast Tab Content
  const renderForecastTab = () => (
    <div className="space-y-6">
      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Monate voraus:</label>
            <select
              value={filtersDraft.monthsAhead}
              onChange={(e) => updateDraft({ monthsAhead: parseInt(e.target.value) })}
              className="px-3 py-2 border rounded-md"
            >
              <option value={3}>3 Monate</option>
              <option value={6}>6 Monate</option>
              <option value={12}>12 Monate</option>
              <option value={18}>18 Monate</option>
              <option value={24}>24 Monate</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Min. Wahrscheinlichkeit:</label>
            <select
              value={filtersDraft.minProbability}
              onChange={(e) => updateDraft({ minProbability: parseInt(e.target.value) })}
              className="px-3 py-2 border rounded-md"
            >
              <option value={0}>Alle</option>
              <option value={25}>≥ 25%</option>
              <option value={50}>≥ 50%</option>
              <option value={75}>≥ 75%</option>
              <option value={90}>≥ 90%</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {combinedForecast && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-sm text-gray-500">Projekt-Forecast</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(combinedForecast.summary?.total_project_forecast || 0)}
            </div>
            <div className="text-xs text-gray-400">
              {filters.minProbability > 0 ? `≥ ${filters.minProbability}% Wahrsch.` : 'Alle Projekte'}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="text-sm text-gray-500">Angebots-Forecast</div>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(combinedForecast.summary?.total_quotation_forecast || 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="text-sm text-gray-500">Kombiniert</div>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(combinedForecast.summary?.total_combined || 0)}
            </div>
          </div>
        </div>
      )}

      {/* Combined Forecast Chart */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Kombinierter Forecast</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={combinedForecast?.data || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tickFormatter={formatMonth} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                labelFormatter={formatMonth}
              />
              <Legend />
              <Bar dataKey="project_forecast" stackId="a" fill="#3B82F6" name="Projekte" />
              <Bar dataKey="quotation_forecast" stackId="a" fill="#F59E0B" name="Angebote" />
              <Line type="monotone" dataKey="combined" stroke="#8B5CF6" strokeWidth={2} name="Gesamt" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Charts Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Forecast Details */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">
            Projekt-Forecast ({projectForecast?.summary?.project_count || 0} Projekte)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectForecast?.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tickFormatter={formatMonth} />
                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} />
                <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={formatMonth} />
                <Legend />
                <Bar dataKey="total_revenue" fill="#3B82F6" name="Forecast" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quotation Forecast Details */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">
            Angebots-Forecast ({quotationForecast?.summary?.quotation_count || 0} Angebote)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quotationForecast?.data || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tickFormatter={formatMonth} />
                <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} />
                <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={formatMonth} />
                <Bar dataKey="value" fill="#F59E0B" name="Angebotswert" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Project Details Table */}
      {projectForecast?.projects && projectForecast.projects.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Projekt-Details</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projekt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Datum</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Forecast</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Wahrsch.</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projectForecast.projects.map((project, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">{project.project_number}</div>
                      <div className="text-xs text-gray-500">{project.name}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {project.customer__name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {project.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                      {project.forecast_date}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                      {formatCurrency(project.forecast_revenue)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                      <span className={`px-2 py-1 rounded ${
                        project.forecast_probability >= 70 ? 'bg-green-100 text-green-800' :
                        project.forecast_probability >= 40 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {project.forecast_probability}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // SQL-Forecast Tab Content
  const SQL_FORECAST_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#14B8A6'];

  const einstufungOptions = [
    { id: 1, label: 'VS-Kauf' },
    { id: 2, label: 'Konkurrenzkauf' },
    { id: 3, label: 'kein Interesse' },
    { id: 4, label: 'neu/unbekannt' },
    { id: 5, label: 'Prospektsammler' },
    { id: 6, label: 'geringes Interesse' },
    { id: 7, label: 'mittleres Interesse' },
    { id: 8, label: 'starkes Interesse' },
    { id: 9, label: 'Geld beantragt' },
    { id: 10, label: 'will in Kürze kaufen' },
    { id: 11, label: 'Probleme offen' },
  ];

  const zustandOptions = [
    { id: 1, label: 'Entwurf' },
    { id: 2, label: 'Erstellt' },
    { id: 3, label: 'Versendet' },
    { id: 4, label: 'Abgelehnt' },
    { id: 5, label: 'Angenommen' },
    { id: 6, label: 'Auftrag' },
  ];

  const toggleSqlFilter = (field, value) => {
    setSqlForecastFilters(prev => {
      const arr = prev[field];
      const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
      return { ...prev, [field]: next };
    });
  };

  const renderSqlForecastTab = () => (
    <div className="space-y-6">
      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum von</label>
            <input
              type="date"
              value={sqlForecastFilters.datum_von}
              onChange={(e) => setSqlForecastFilters(prev => ({ ...prev, datum_von: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum bis</label>
            <input
              type="date"
              value={sqlForecastFilters.datum_bis}
              onChange={(e) => setSqlForecastFilters(prev => ({ ...prev, datum_bis: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min. Wahrscheinlichkeit</label>
            <select
              value={sqlForecastFilters.min_wahrscheinlichkeit}
              onChange={(e) => setSqlForecastFilters(prev => ({ ...prev, min_wahrscheinlichkeit: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value={0}>Alle</option>
              <option value={10}>≥ 10%</option>
              <option value={25}>≥ 25%</option>
              <option value={50}>≥ 50%</option>
              <option value={75}>≥ 75%</option>
              <option value={90}>≥ 90%</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Verkäufer</label>
            <select
              value={sqlForecastFilters.verkaeufer}
              onChange={(e) => setSqlForecastFilters(prev => ({ ...prev, verkaeufer: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="">Alle</option>
              {(sqlForecastLookups?.verkaeufer || []).map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Einstufung Multi-Select */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Einstufung (Mehrfachauswahl)</label>
          <div className="flex flex-wrap gap-2">
            {einstufungOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => toggleSqlFilter('prioritaet', opt.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  sqlForecastFilters.prioritaet.includes(opt.id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {sqlForecastFilters.prioritaet.length > 0 && (
              <button
                onClick={() => setSqlForecastFilters(prev => ({ ...prev, prioritaet: [] }))}
                className="px-3 py-1.5 rounded-full text-sm text-red-600 border border-red-300 hover:bg-red-50"
              >
                ✕ Alle zurücksetzen
              </button>
            )}
          </div>
        </div>

        {/* Angebote Toggle */}
        <div className="border-t pt-4 mt-2">
          <div className="flex items-center gap-3 mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sqlForecastFilters.include_angebote}
                onChange={(e) => setSqlForecastFilters(prev => ({ ...prev, include_angebote: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">SQL-Angebote in Grafik einbeziehen</span>
            </label>
          </div>
          {sqlForecastFilters.include_angebote && (
            <div className="ml-6">
              <label className="block text-sm text-gray-600 mb-2">Angebots-Status filtern:</label>
              <div className="flex flex-wrap gap-2">
                {zustandOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => toggleSqlFilter('angebote_zustand', opt.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      sqlForecastFilters.angebote_zustand.includes(opt.id)
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={fetchSqlForecastData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {sqlForecastData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="text-sm text-gray-500">Projekte</div>
              <div className="text-2xl font-bold text-blue-600">{sqlForecastData.summary?.total_projekte || 0}</div>
              <div className="text-xs text-gray-400">im Zeitraum</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-500">Gesamtsumme</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(sqlForecastData.summary?.total_summe || 0)}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
              <div className="text-sm text-gray-500">Gewichteter Forecast</div>
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(sqlForecastData.summary?.total_gewichtet || 0)}</div>
              <div className="text-xs text-gray-400">Summe × Wahrscheinlichkeit</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500">
              <div className="text-sm text-gray-500">Ø Wahrscheinlichkeit</div>
              <div className="text-2xl font-bold text-amber-600">{sqlForecastData.summary?.avg_wahrscheinlichkeit || 0}%</div>
            </div>
          </div>

          {/* Status-Aufschlüsselung */}
          {sqlForecastData.summary?.by_status && Object.keys(sqlForecastData.summary.by_status).length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-3">Aufschlüsselung nach Einstufung</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {(sqlForecastData.statuses || []).map((st, idx) => {
                  const d = sqlForecastData.summary.by_status[st];
                  if (!d) return null;
                  return (
                    <div key={st} className="p-3 rounded-lg border" style={{ borderLeftColor: SQL_FORECAST_COLORS[idx % SQL_FORECAST_COLORS.length], borderLeftWidth: '4px' }}>
                      <div className="text-xs text-gray-500 truncate">{st}</div>
                      <div className="text-lg font-bold">{d.count}×</div>
                      <div className="text-sm text-gray-700">{formatCurrency(d.summe)}</div>
                      <div className="text-xs text-gray-500">gew. {formatCurrency(d.gewichtet)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Angebote Summary */}
          {sqlForecastData.angebote && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
                <div className="text-sm text-gray-500">SQL-Angebote</div>
                <div className="text-2xl font-bold text-orange-600">{sqlForecastData.angebote.summary?.total_angebote || 0}</div>
                <div className="text-xs text-gray-400">nur letzte Version je Angebot</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-400">
                <div className="text-sm text-gray-500">Angebotssumme</div>
                <div className="text-2xl font-bold text-orange-500">{formatCurrency(sqlForecastData.angebote.summary?.total_summe || 0)}</div>
              </div>
            </div>
          )}

          {/* Chart: Stacked Bars per Status + Line for weighted total */}
          {sqlForecastData.chart_data?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Forecast nach Monat & Status (gewichtet)</h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={(() => {
                    // Merge Angebote data into chart_data if present
                    if (!sqlForecastData.angebote?.chart_data) return sqlForecastData.chart_data;
                    const angMap = {};
                    sqlForecastData.angebote.chart_data.forEach(d => { angMap[d.period] = d.angebote_summe; });
                    return sqlForecastData.chart_data.map(d => ({
                      ...d,
                      angebote_summe: angMap[d.period] || 0,
                    }));
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tickFormatter={formatMonth} />
                    <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} />
                    <Tooltip
                      formatter={(value, name) => [formatCurrency(value), name]}
                      labelFormatter={formatMonth}
                    />
                    <Legend />
                    {(sqlForecastData.status_keys || []).map((key, idx) => (
                      <Bar
                        key={key}
                        dataKey={`${key}_gewichtet`}
                        stackId="projekte"
                        fill={SQL_FORECAST_COLORS[idx % SQL_FORECAST_COLORS.length]}
                        name={(sqlForecastData.statuses || [])[idx] || key}
                      />
                    ))}
                    {sqlForecastData.angebote && (
                      <Bar dataKey="angebote_summe" fill="#F97316" name="SQL-Angebote" opacity={0.6} />
                    )}
                    <Line
                      type="monotone"
                      dataKey="total_gewichtet"
                      stroke="#111827"
                      strokeWidth={2}
                      dot={false}
                      name="Gesamt (gewichtet)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Chart: Ungewichtet (absolute Summen) */}
          {sqlForecastData.chart_data?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Auftragssummen nach Monat (ungewichtet)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sqlForecastData.chart_data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tickFormatter={formatMonth} />
                    <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} />
                    <Tooltip
                      formatter={(value, name) => [formatCurrency(value), name]}
                      labelFormatter={formatMonth}
                    />
                    <Legend />
                    {(sqlForecastData.status_keys || []).map((key, idx) => (
                      <Bar
                        key={key}
                        dataKey={`${key}_summe`}
                        stackId="summe"
                        fill={SQL_FORECAST_COLORS[idx % SQL_FORECAST_COLORS.length]}
                        name={(sqlForecastData.statuses || [])[idx] || key}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Projekt-Details Table */}
          {sqlForecastData.projekte?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">Projekte ({sqlForecastData.projekte.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Systemgruppe</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Einstufung</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verkäufer</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Auftragsdatum</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Summe</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Wahrsch.</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gewichtet</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sqlForecastData.projekte.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          <a href={`/sales/sql-projekte/${p.id}`} className="text-blue-600 hover:underline">{p.id}</a>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          <div className="font-medium">{p.kunde?.firma || '-'}</div>
                          {p.kunde?.name && <div className="text-xs text-gray-600">{p.kunde.name}</div>}
                          {p.kunde?.ort && <div className="text-xs text-gray-500">{p.kunde.ort}</div>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{p.system_gruppe}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">{p.einstufung || p.aktions_status}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{p.verkaeufer}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-500">{p.auftragsdatum}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium">{formatCurrency(parseFloat(p.auftragssumme || 0))}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                          <span className={`px-2 py-1 rounded ${
                            p.auftragswahrscheinlichkeit >= 70 ? 'bg-green-100 text-green-800' :
                            p.auftragswahrscheinlichkeit >= 40 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {p.auftragswahrscheinlichkeit}%
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-purple-700">
                          {formatCurrency(parseFloat(p.gewichtete_summe || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Angebote Table */}
          {sqlForecastData.angebote?.angebote?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4">SQL-Angebote ({sqlForecastData.angebote.angebote.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nr.</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Beschreibung</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zustand</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verkäufer</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Datum</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gesamtpreis</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sqlForecastData.angebote.angebote.map((a) => (
                      <tr key={a.angebot_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          <a href={`/sales/sql-angebote/${a.angebot_id}`} className="text-blue-600 hover:underline">
                            {a.angebot_nummer}/{a.versions_nummer}
                          </a>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          <div className="font-medium">{a.firma || a.kunde_name || '-'}</div>
                          {a.ort && <div className="text-xs text-gray-500">{a.ort}</div>}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 max-w-xs truncate">{a.kurzbeschreibung}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">{a.zustand}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{a.verkaeufer}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-500">{a.datum}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium">{formatCurrency(parseFloat(a.gesamtpreis || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  // Payments Tab Content
  const renderPaymentsTab = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      {paymentsData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-sm text-gray-500">Erwartete Zahlungen (Gesamt)</div>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(paymentsData.summary?.total_expected || 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="text-sm text-gray-500">Überfällig</div>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(paymentsData.summary?.total_overdue || 0)}
            </div>
            <div className="text-xs text-gray-500">{paymentsData.summary?.overdue_count || 0} Rechnungen</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-sm text-gray-500">Offene Rechnungen</div>
            <div className="text-2xl font-bold text-green-600">
              {paymentsData.summary?.total_count || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="text-sm text-gray-500">Durchschn. Betrag</div>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency((paymentsData.summary?.total_expected || 0) / (paymentsData.summary?.total_count || 1))}
            </div>
          </div>
        </div>
      )}

      {/* Payments Chart */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Erwartete Zahlungseingänge</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={paymentsData?.data || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tickFormatter={formatMonth} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} />
              <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={formatMonth} />
              <Legend />
              <Bar 
                dataKey="amount" 
                name="Betrag"
                fill={(entry) => entry?.is_overdue ? '#EF4444' : '#10B981'}
              >
                {(paymentsData?.data || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.is_overdue ? '#EF4444' : '#10B981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payments Details Table */}
      {paymentsData?.payments && paymentsData.payments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Offene Rechnungen</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Auftrag</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rechnungsdatum</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fällig</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Betrag</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paymentsData.payments.map((payment, index) => (
                  <tr key={index} className={`hover:bg-gray-50 ${payment.days_overdue > 0 ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                      {payment.order_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {payment.customer_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                      {payment.invoice_date}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                      {payment.expected_payment_date}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {payment.days_overdue > 0 ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                          {payment.days_overdue} Tage überfällig
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          Offen
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📊 Business Intelligence</h1>
        <p className="text-gray-500">Statistiken, Forecasts und Zahlungsübersicht</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Tab Content */}
      {!loading && !error && (
        <>
          {activeTab === 'statistics' && renderStatisticsTab()}
          {activeTab === 'forecast' && renderForecastTab()}
          {activeTab === 'sql-forecast' && renderSqlForecastTab()}
          {activeTab === 'payments' && renderPaymentsTab()}
        </>
      )}
    </div>
  );
};

export default BusinessIntelligence;
