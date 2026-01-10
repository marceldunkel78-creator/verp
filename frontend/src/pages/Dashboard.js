import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const MAIN_DASHBOARD_KEY = 'myverp_main_dashboard_widgets';
const MODULE_STORAGE_KEY = 'myverp_dashboard_modules';

// Tab-Mapping für MyVERP Widgets
const myverpTabMapping = {
  'time-tracking': 'time-tracking',
  'messages': 'messages',
  'reminders': 'reminders',
  'vacation': 'vacation',
  'travel-expenses': 'travel-expenses',
};

// Alle verfügbaren Module (gleiche Definition wie in MyVERP)
// permission: null oder undefined = immer sichtbar
// permission: 'can_read_xyz' = nur sichtbar wenn User diese Berechtigung hat
const allModules = [
  { id: 'customers', name: 'Kunden', route: '/sales/customers', icon: '👤', category: 'Vertrieb', permission: 'can_read_customers' },
  { id: 'quotations', name: 'Angebote', route: '/sales/quotations', icon: '📋', category: 'Vertrieb', permission: 'can_read_sales_quotations' },
  { id: 'orders', name: 'Aufträge', route: '/sales/order-processing', icon: '📑', category: 'Vertrieb', permission: 'can_read_sales_order_processing' },
  { id: 'procurement', name: 'Beschaffung', route: '/procurement', icon: '📦', category: 'Beschaffung', permission: 'can_read_procurement' },
  { id: 'suppliers', name: 'Lieferanten', route: '/procurement/suppliers', icon: '🏢', category: 'Beschaffung', permission: 'can_read_suppliers' },
  { id: 'trading', name: 'Handelsware', route: '/procurement/trading-goods', icon: '📦', category: 'Beschaffung', permission: 'can_read_trading' },
  { id: 'purchase-orders', name: 'Bestellungen', route: '/procurement/orders', icon: '🛒', category: 'Beschaffung', permission: 'can_read_procurement_orders' },
  { id: 'visiview', name: 'VisiView Produkte', route: '/products/visiview', icon: '🔬', category: 'Produkte', permission: 'can_read_visiview_products' },
  { id: 'vshardware', name: 'VS-Hardware', route: '/products/vs-hardware', icon: '🔧', category: 'Produkte', permission: 'can_read_manufacturing_vs_hardware' },
  { id: 'vsservice', name: 'VS-Service', route: '/service/vs-service', icon: '🛠️', category: 'Service', permission: 'can_read_service_vs_service' },
  { id: 'rma', name: 'RMA-Fälle', route: '/service/rma', icon: '🔄', category: 'Service', permission: 'can_read_service_rma' },
  { id: 'inventory', name: 'Lagerverwaltung', route: '/inventory', icon: '📊', category: 'Lager', permission: 'can_read_inventory' },
  { id: 'production', name: 'Fertigungsaufträge', route: '/manufacturing/production-orders', icon: '🏭', category: 'Fertigung', permission: 'can_read_manufacturing_production_orders' },
  { id: 'development-projects', name: 'Entwicklung', route: '/development/projects', icon: '🧪', category: 'Entwicklung', permission: 'can_read_development_projects' },
  { id: 'projects', name: 'Projekte', route: '/projects', icon: '📁', category: 'Projekte', permission: 'can_read_sales_projects' },
  { id: 'documents', name: 'Dokumente', route: '/documents', icon: '📄', category: 'System', permission: 'can_read_documents' },
  { id: 'settings', name: 'Einstellungen', route: '/settings', icon: '⚙️', category: 'System', permission: 'can_read_settings' },
  { id: 'users', name: 'Benutzer', route: '/settings/users', icon: '👥', category: 'System', permission: 'can_read_settings' },
  { id: 'exchange-rates', name: 'Wechselkurse', route: '/settings/currency-exchange-rates', icon: '💱', category: 'System', permission: 'can_read_finance' },
  { id: 'company', name: 'Firmendaten', route: '/settings/company-info', icon: '🏛️', category: 'System', permission: 'can_read_settings' },
];

const categoryColors = {
  'Vertrieb': 'bg-blue-500 hover:bg-blue-600',
  'Beschaffung': 'bg-green-500 hover:bg-green-600',
  'Produkte': 'bg-cyan-500 hover:bg-cyan-600',
  'Service': 'bg-orange-500 hover:bg-orange-600',
  'Lager': 'bg-violet-500 hover:bg-violet-600',
  'Fertigung': 'bg-gray-500 hover:bg-gray-600',
  'Projekte': 'bg-indigo-500 hover:bg-indigo-600',
  'System': 'bg-purple-500 hover:bg-purple-600',
};

const defaultModules = ['customers', 'quotations', 'orders', 'suppliers', 'trading', 'inventory'];

const Dashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myverpSelection, setMyverpSelection] = useState([]);
  const [myverpData, setMyverpData] = useState({});
  const [loadingMyVerp, setLoadingMyVerp] = useState(false);
  const [selectedModules, setSelectedModules] = useState([]);

  // Filtere Module basierend auf Benutzerberechtigungen
  const permittedModules = allModules.filter(module => {
    if (!module.permission) return true; // Keine Berechtigung erforderlich
    if (user?.is_superuser) return true; // Superuser kann alles sehen
    return user?.[module.permission] === true;
  });

  useEffect(() => {
    fetchDashboardData();
    loadMyverpSelection();
    loadModuleSelection();
  }, []);

  const loadModuleSelection = () => {
    try {
      const saved = localStorage.getItem(MODULE_STORAGE_KEY);
      if (saved) {
        setSelectedModules(JSON.parse(saved));
      } else {
        setSelectedModules(defaultModules);
      }
    } catch (err) {
      console.warn('Could not load module selection from localStorage', err);
      setSelectedModules(defaultModules);
    }
  };

  const loadMyverpSelection = async () => {
    try {
      const raw = localStorage.getItem(MAIN_DASHBOARD_KEY);
      if (raw) {
        const sel = JSON.parse(raw);
        if (Array.isArray(sel) && sel.length > 0) {
          setMyverpSelection(sel);
          fetchMyverpWidgets(sel);
        }
      } else {
        // Default widgets
        const defaultWidgets = ['time-tracking', 'messages', 'reminders'];
        setMyverpSelection(defaultWidgets);
        fetchMyverpWidgets(defaultWidgets);
      }
    } catch (err) {
      console.warn('Could not load MyVERP selection from localStorage', err);
    }
  };

  const fetchMyverpWidgets = async (selection) => {
    if (!selection || selection.length === 0) return;
    setLoadingMyVerp(true);
    const collected = {};
    const promises = [];

    if (selection.includes('time-tracking')) {
      promises.push(
        api.get('/users/time-entries/weekly_report/')
          .then((res) => { collected.timeTracking = res.data; })
          .catch(() => { collected.timeTracking = null; })
      );
    }

    if (selection.includes('messages')) {
      promises.push(
        api.get('/users/messages/')
          .then((res) => { collected.messages = res.data.results || res.data; })
          .catch(() => { collected.messages = []; })
      );
    }

    if (selection.includes('reminders')) {
      promises.push(
        api.get('/users/reminders/')
          .then((res) => { collected.reminders = res.data.results || res.data; })
          .catch(() => { collected.reminders = []; })
      );
    }

    if (selection.includes('vacation')) {
      promises.push(
        Promise.all([
          api.get('/users/vacation-requests/'),
          api.get('/users/employees/me/').catch(() => ({ data: null }))
        ]).then(([vacRes, empRes]) => {
          collected.vacation = {
            requests: vacRes.data.results || vacRes.data || [],
            employee: empRes.data
          };
        }).catch(() => { collected.vacation = { requests: [], employee: null }; })
      );
    }

    if (selection.includes('travel-expenses')) {
      promises.push(
        api.get('/users/travel-expenses/')
          .then((res) => { collected.travelExpenses = res.data.results || res.data || []; })
          .catch(() => { collected.travelExpenses = []; })
      );
    }

    try {
      await Promise.all(promises);
      setMyverpData(collected);
    } catch (err) {
      console.warn('Fehler beim Laden der MyVERP Widgets', err);
    } finally {
      setLoadingMyVerp(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/core/dashboard/');
      setDashboardData(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Dashboard-Daten:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Aktive Module aus der Benutzerauswahl (nur erlaubte Module)
  const activeModules = permittedModules.filter(m => selectedModules.includes(m.id));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Willkommen, {dashboardData?.user?.full_name || dashboardData?.user?.username}!
        </h1>
        <p className="mt-2 text-gray-600">
          Übersicht über Ihr VERP System
        </p>
      </div>

      {/* Statistiken */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Kunden</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {dashboardData?.stats?.active_customers} / {dashboardData?.stats?.total_customers}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Lieferanten</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {dashboardData?.stats?.active_suppliers} / {dashboardData?.stats?.total_suppliers}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-orange-500 text-white">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Produkte</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {dashboardData?.stats?.active_products} / {dashboardData?.stats?.total_products}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-purple-500 text-white">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Module</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {activeModules.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MyVERP Schnellzugriff */}
      {myverpSelection.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">MyVERP Schnellzugriff</h2>
            <Link to="/myverp" className="text-sm text-blue-600 hover:underline">
              Anpassen →
            </Link>
          </div>
          {loadingMyVerp ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {myverpSelection.includes('time-tracking') && (
                <Link 
                  to={`/myverp?tab=${myverpTabMapping['time-tracking']}`} 
                  className="bg-sky-500 hover:bg-sky-600 text-white p-4 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">⏱️</div>
                    <div className="text-sm font-semibold">Zeiterfassung</div>
                    <div className="text-xs opacity-75 mt-1">
                      {myverpData.timeTracking ? `${myverpData.timeTracking.actual_hours ?? 0}h` : '—'}
                    </div>
                  </div>
                </Link>
              )}

              {myverpSelection.includes('messages') && (
                <Link 
                  to={`/myverp?tab=${myverpTabMapping['messages']}`}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white p-4 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">💬</div>
                    <div className="text-sm font-semibold">Nachrichten</div>
                    <div className="text-xs opacity-75 mt-1">
                      {Array.isArray(myverpData.messages) ? `${myverpData.messages.filter(m => !m.is_read).length} ungelesen` : '—'}
                    </div>
                  </div>
                </Link>
              )}

              {myverpSelection.includes('reminders') && (
                <Link 
                  to={`/myverp?tab=${myverpTabMapping['reminders']}`}
                  className="bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">🔔</div>
                    <div className="text-sm font-semibold">Erinnerungen</div>
                    <div className="text-xs opacity-75 mt-1">
                      {Array.isArray(myverpData.reminders) ? `${myverpData.reminders.filter(r => !r.is_completed).length} offen` : '—'}
                    </div>
                  </div>
                </Link>
              )}

              {myverpSelection.includes('vacation') && (
                <Link 
                  to={`/myverp?tab=${myverpTabMapping['vacation']}`}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">🏖️</div>
                    <div className="text-sm font-semibold">Urlaub</div>
                    <div className="text-xs opacity-75 mt-1">
                      {myverpData.vacation?.employee?.vacation_balance ?? '—'} Tage
                    </div>
                  </div>
                </Link>
              )}

              {myverpSelection.includes('travel-expenses') && (
                <Link 
                  to={`/myverp?tab=${myverpTabMapping['travel-expenses']}`}
                  className="bg-rose-500 hover:bg-rose-600 text-white p-4 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">✈️</div>
                    <div className="text-sm font-semibold">Reisekosten</div>
                    <div className="text-xs opacity-75 mt-1">
                      {Array.isArray(myverpData.travelExpenses) ? `${myverpData.travelExpenses.filter(r => r.status === 'draft').length} Entwürfe` : '—'}
                    </div>
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modul-Schnellzugriff (aus MyVERP Einstellungen) */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Modul-Schnellzugriff</h2>
          <Link to="/myverp?tab=dashboard" className="text-sm text-blue-600 hover:underline">
            Anpassen →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {activeModules.map((module) => {
            const colorClass = categoryColors[module.category] || 'bg-gray-500 hover:bg-gray-600';
            return (
              <Link
                key={module.id}
                to={module.route}
                className={`${colorClass} text-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-2">{module.icon}</div>
                  <div className="text-lg font-semibold">{module.name}</div>
                  <div className="text-xs opacity-75">{module.category}</div>
                </div>
              </Link>
            );
          })}
          {activeModules.length === 0 && (
            <div className="col-span-full text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
              Keine Module ausgewählt. <Link to="/myverp?tab=dashboard" className="text-blue-600 hover:underline">Klicken Sie hier</Link>, um Module hinzuzufügen.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
