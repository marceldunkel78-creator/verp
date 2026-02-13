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

const MYVERP_WIDGET_IDS = Object.keys(myverpTabMapping);

// Alle verfügbaren Module (gleiche Definition wie in MyVERP)
// permission: null oder undefined = immer sichtbar
// permission: 'can_read_xyz' = nur sichtbar wenn User diese Berechtigung hat
const allModules = [
  // Sales / Orders
  { id: 'customers', name: 'Kunden', route: '/sales/customers', icon: '👤', category: 'Vertrieb', permission: 'can_read_customers' },
  { id: 'systems', name: 'Systeme', route: '/sales/systems', icon: '🖥️', category: 'Vertrieb', permission: 'can_read_sales_systems' },
  { id: 'quotations', name: 'Angebote', route: '/sales/quotations', icon: '📋', category: 'Vertrieb', permission: 'can_read_sales_quotations' },
  { id: 'orders', name: 'Aufträge', route: '/sales/order-processing', icon: '📑', category: 'Vertrieb', permission: 'can_read_sales_order_processing' },
  { id: 'dealers', name: 'Distributors', route: '/sales/dealers', icon: '🤝', category: 'Vertrieb', permission: 'can_read_sales_dealers' },
  { id: 'pricelists', name: 'Preislisten', route: '/sales/pricelists', icon: '💲', category: 'Vertrieb', permission: 'can_read_sales_pricelists' },
  { id: 'projects', name: 'Projekte', route: '/sales/projects', icon: '📁', category: 'Vertrieb', permission: 'can_read_sales_projects' },
  { id: 'marketing', name: 'Marketing', route: '/sales/marketing', icon: '📣', category: 'Vertrieb', permission: 'can_read_sales_marketing' },
  // Procurement
  { id: 'procurement', name: 'Beschaffung', route: '/procurement', icon: '📦', category: 'Beschaffung', permission: 'can_read_procurement' },
  { id: 'suppliers', name: 'Lieferanten', route: '/procurement/suppliers', icon: '🏢', category: 'Beschaffung', permission: 'can_read_suppliers' },
  { id: 'trading', name: 'Handelsware', route: '/procurement/trading-goods', icon: '📦', category: 'Beschaffung', permission: 'can_read_trading' },
  { id: 'materials-supplies', name: 'Material & Verbrauchsmaterial', route: '/procurement/materials-supplies', icon: '🧪', category: 'Beschaffung', permission: 'can_read_procurement' },
  { id: 'purchase-orders', name: 'Bestellungen', route: '/procurement/orders', icon: '🛒', category: 'Beschaffung', permission: 'can_read_procurement_orders' },
  { id: 'loans', name: 'Leihgeräte', route: '/procurement/loans', icon: '🔄', category: 'Beschaffung', permission: 'can_read_loans' },
  // VisiView / Produkte
  { id: 'visiview', name: 'VisiView Produkte', route: '/visiview/products', icon: '🔬', category: 'Produkte', permission: 'can_read_visiview_products' },
  { id: 'visiview-products', name: 'VisiView Produkte', route: '/visiview/products', icon: '🔬', category: 'Produkte', permission: 'can_read_visiview_products' },
  { id: 'visiview-licenses', name: 'VisiView Lizenzen', route: '/visiview/licenses', icon: '🔑', category: 'Produkte', permission: 'can_read_visiview_licenses' },
  { id: 'visiview-macros', name: 'VisiView Makros', route: '/visiview/macros', icon: '📜', category: 'Produkte', permission: 'can_read_visiview_macros' },
  { id: 'visiview-tickets', name: 'VisiView Tickets', route: '/visiview/tickets', icon: '🎫', category: 'Produkte', permission: 'can_read_visiview_tickets' },
  { id: 'visiview-supported-hardware', name: 'Unterstützte Hardware', route: '/visiview/supported-hardware', icon: '🖥️', category: 'Produkte', permission: 'can_read_visiview_supported_hardware' },
  { id: 'visiview-maintenance-time', name: 'Maintenance Zeiterfassung', route: '/visiview/maintenance-time', icon: '⏱️', category: 'Produkte', permission: 'can_read_visiview_maintenance_time' },
  { id: 'vshardware', name: 'VS-Hardware', route: '/manufacturing/vs-hardware', icon: '🔧', category: 'Produkte', permission: 'can_read_manufacturing_vs_hardware' },
  // Kalender & Meetings
  { id: 'calendar', name: 'Firmenkalender', route: '/calendar', icon: '📅', category: 'Kalender', permission: 'can_read_company_calendar' },
  { id: 'meetings', name: 'Meetings', route: '/meetings', icon: '🤝', category: 'Kalender', permission: 'can_read_meetings' },
  // Service
  { id: 'vsservice', name: 'VS-Service', route: '/service/vs-service', icon: '🛠️', category: 'Service', permission: 'can_read_service_vs_service' },
  { id: 'rma', name: 'RMA-Fälle', route: '/service/rma', icon: '🔄', category: 'Service', permission: 'can_read_service_rma' },
  { id: 'service-tickets', name: 'Service Tickets', route: '/service/tickets', icon: '🎫', category: 'Service', permission: 'can_read_service_tickets' },
  // Lager
  { id: 'inventory', name: 'Lagerverwaltung', route: '/inventory', icon: '📊', category: 'Lager', permission: 'can_read_inventory' },
  // Fertigung
  { id: 'production', name: 'Fertigungsaufträge', route: '/manufacturing/production-orders', icon: '🏭', category: 'Fertigung', permission: 'can_read_manufacturing_production_orders' },
  { id: 'production-orders', name: 'Fertigungsaufträge', route: '/manufacturing/production-orders', icon: '🏭', category: 'Fertigung', permission: 'can_read_manufacturing_production_orders' },
  // Entwicklung
  { id: 'development-projects', name: 'Entwicklung', route: '/development/projects', icon: '🧪', category: 'Entwicklung', permission: 'can_read_development_projects' },
  // System
  { id: 'documents', name: 'Dokumente', route: '/documents', icon: '📄', category: 'System', permission: 'can_read_documents' },
  { id: 'settings', name: 'Einstellungen', route: '/settings', icon: '⚙️', category: 'System', permission: 'can_read_settings' },
  { id: 'users', name: 'Benutzer', route: '/settings/users', icon: '👥', category: 'System', permission: 'can_read_settings' },
  { id: 'exchange-rates', name: 'Wechselkurse', route: '/settings/currency-exchange-rates', icon: '💱', category: 'System', permission: 'can_read_finance' },
  { id: 'company', name: 'Firmendaten', route: '/settings/company-info', icon: '🏛️', category: 'System', permission: 'can_read_settings' },
  // VS-Hardware
  { id: 'vs-hardware', name: 'VS-Hardware', route: '/manufacturing/vs-hardware', icon: '🔧', category: 'Fertigung', permission: 'can_read_manufacturing_vs_hardware' },
  // VS-Service
  { id: 'vs-service', name: 'VS-Service Produkte', route: '/service/vs-service', icon: '🛠️', category: 'Service', permission: 'can_read_service_vs_service' },
];

const categoryColors = {
  'Vertrieb': 'bg-blue-500 hover:bg-blue-600',
  'Beschaffung': 'bg-green-500 hover:bg-green-600',
  'Produkte': 'bg-cyan-500 hover:bg-cyan-600',
  'Service': 'bg-orange-500 hover:bg-orange-600',
  'Lager': 'bg-violet-500 hover:bg-violet-600',
  'Fertigung': 'bg-gray-500 hover:bg-gray-600',
  'Kalender': 'bg-teal-500 hover:bg-teal-600',
  'Projekte': 'bg-indigo-500 hover:bg-indigo-600',
  'System': 'bg-purple-500 hover:bg-purple-600',
};

const defaultModules = ['customers', 'quotations', 'orders', 'suppliers', 'trading', 'inventory'];

// ID-Mapping für Kompatibilität zwischen MyVERP und Dashboard
// Falls in MyVERP andere IDs verwendet werden, hier mappen
const MODULE_ID_MAP = {
  // keine Mappings mehr nötig - IDs sind jetzt konsistent
};

// Normalisiere Module-IDs aus localStorage
const normalizeModuleIds = (ids) => {
  if (!Array.isArray(ids)) return [];
  const validIds = new Set(allModules.map(m => m.id));
  return ids
    .map(id => MODULE_ID_MAP[id] || id)  // Mappe bekannte IDs
    .filter(id => validIds.has(id));  // Filtere unbekannte IDs
};

const Dashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myverpSelection, setMyverpSelection] = useState([]);
  const [myverpData, setMyverpData] = useState({});
  const [loadingMyVerp, setLoadingMyVerp] = useState(false);
  const [selectedModules, setSelectedModules] = useState([]);
  const [overdueContactSystems, setOverdueContactSystems] = useState([]);
  const [loadingOverdueContact, setLoadingOverdueContact] = useState(false);
  const [maintenanceExpiredSystems, setMaintenanceExpiredSystems] = useState([]);
  const [loadingMaintenanceExpired, setLoadingMaintenanceExpired] = useState(false);

  const visibleTabIds = user?.myverp_visible_tabs || [];
  const allowedMyverpIds = new Set(
    (visibleTabIds.length === 0
      ? MYVERP_WIDGET_IDS
      : visibleTabIds.filter((id) => MYVERP_WIDGET_IDS.includes(id)))
  );

  const normalizeMyverpSelection = (ids) => {
    if (!Array.isArray(ids)) return [];
    return Array.from(new Set(ids.filter((id) => allowedMyverpIds.has(id))));
  };

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
    fetchOverdueContactSystems();
    fetchMaintenanceExpiredSystems();
  }, []);

  const loadModuleSelection = () => {
    try {
      const saved = localStorage.getItem(MODULE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSelectedModules(normalizeModuleIds(parsed));
      } else {
        setSelectedModules(defaultModules);
      }
    } catch (err) {
      console.warn('Could not load module selection from localStorage', err);
      setSelectedModules(defaultModules);
    }
  };

  const fetchOverdueContactSystems = async () => {
    setLoadingOverdueContact(true);
    try {
      const response = await api.get('/systems/systems/contact_overdue/');
      setOverdueContactSystems(response.data.systems || []);
    } catch (error) {
      console.error('Error fetching overdue contact systems:', error);
      setOverdueContactSystems([]);
    } finally {
      setLoadingOverdueContact(false);
    }
  };

  const fetchMaintenanceExpiredSystems = async () => {
    setLoadingMaintenanceExpired(true);
    try {
      const response = await api.get('/systems/systems/maintenance_expired/');
      setMaintenanceExpiredSystems(response.data.systems || []);
    } catch (error) {
      console.error('Error fetching maintenance expired systems:', error);
      setMaintenanceExpiredSystems([]);
    } finally {
      setLoadingMaintenanceExpired(false);
    }
  };

  const loadMyverpSelection = async () => {
    try {
      const raw = localStorage.getItem(MAIN_DASHBOARD_KEY);
      if (raw) {
        const sel = normalizeMyverpSelection(JSON.parse(raw));
        if (sel.length > 0) {
          setMyverpSelection(sel);
          fetchMyverpWidgets(sel);
        }
      } else {
        // Default widgets
        const defaultWidgets = normalizeMyverpSelection(['time-tracking', 'messages', 'reminders']);
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
        {/* Kunden */}
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

        {/* Systeme */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-cyan-500 text-white">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Systeme</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {dashboardData?.stats?.active_systems} / {dashboardData?.stats?.total_systems}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Lieferanten */}
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

        {/* VisiView Lizenzen */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-purple-500 text-white">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">VisiView Lizenzen</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {dashboardData?.stats?.active_licenses} / {dashboardData?.stats?.total_licenses}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MyVERP Schnellzugriff - Kombiniert Widgets und Module */}
      {(myverpSelection.length > 0 || activeModules.length > 0) && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">MyVERP Schnellzugriff</h2>
            <Link to="/myverp?tab=dashboard" className="text-sm text-blue-600 hover:underline">
              Anpassen →
            </Link>
          </div>
          {loadingMyVerp ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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

              {/* Modul-Schnellzugriff Kacheln */}
              {activeModules.map((module) => {
                const colorClass = categoryColors[module.category] || 'bg-gray-500 hover:bg-gray-600';
                return (
                  <Link
                    key={module.id}
                    to={module.route}
                    className={`${colorClass} text-white p-4 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">{module.icon}</div>
                      <div className="text-sm font-semibold">{module.name}</div>
                      <div className="text-xs opacity-75 mt-1">{module.category}</div>
                    </div>
                  </Link>
                );
              })}

              {myverpSelection.length === 0 && activeModules.length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                  Keine Widgets oder Module ausgewählt. <Link to="/myverp?tab=dashboard" className="text-blue-600 hover:underline">Klicken Sie hier</Link>, um diese hinzuzufügen.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Systeme mit abgelaufener Maintenance */}
      {maintenanceExpiredSystems.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-red-500">🛠️</span>
              System Maintenance abgelaufen
            </h2>
            <Link to="/sales/systems" className="text-sm text-blue-600 hover:underline">
              Alle Systeme →
            </Link>
          </div>
          
          {loadingMaintenanceExpired ? (
            <div className="text-center py-4 text-gray-500">Lade...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-red-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">System</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lizenz</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wartung bis</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zeitguthaben</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verantwortlich</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {maintenanceExpiredSystems.slice(0, 20).map((system) => (
                    <tr key={system.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/sales/systems/${system.id}`} className="text-blue-600 hover:underline">
                          <div className="font-medium">{system.system_number}</div>
                          <div className="text-sm text-gray-500">{system.system_name}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {system.customer_id ? (
                          <Link to={`/sales/customers/${system.customer_id}`} className="text-blue-600 hover:underline">
                            {system.customer_name || '-'}
                          </Link>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link to={`/visiview/licenses/${system.license_id}`} className="text-purple-600 hover:underline font-mono">
                          {system.license_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-sm ${system.maintenance_date_expired ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                          {system.maintenance_date
                            ? new Date(system.maintenance_date).toLocaleDateString('de-DE')
                            : '—'}
                        </div>
                        {system.maintenance_date_expired && (
                          <div className="text-xs text-red-500">Abgelaufen</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {system.total_hours != null ? (
                          <div>
                            <div className={`text-sm ${system.credit_exhausted ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                              {system.remaining_hours}h / {system.total_hours}h
                            </div>
                            {system.credit_exhausted && (
                              <div className="text-xs text-red-500">Aufgebraucht</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {system.maintenance_date_expired && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              Wartung
                            </span>
                          )}
                          {system.credit_exhausted && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              Stunden
                            </span>
                          )}
                          {system.maintenance_offer_received && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              Angebot
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {system.responsible_employee || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {maintenanceExpiredSystems.length > 20 && (
                <div className="px-4 py-2 bg-gray-50 text-sm text-gray-500 text-center">
                  + {maintenanceExpiredSystems.length - 20} weitere Systeme
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Systeme mit überfälligem Kontakt */}
      {overdueContactSystems.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-orange-500">⚠️</span>
              Systeme mit überfälligem Kontakt
              <span className="text-sm font-normal text-gray-500">(&gt; 6 Monate)</span>
            </h2>
            <Link to="/sales/systems" className="text-sm text-blue-600 hover:underline">
              Alle Systeme →
            </Link>
          </div>
          
          {loadingOverdueContact ? (
            <div className="text-center py-4 text-gray-500">Lade...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-orange-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">System</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Letzter Kontakt</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verantwortlich</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {overdueContactSystems.slice(0, 10).map((system) => (
                    <tr key={system.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/sales/systems/${system.id}`} className="text-blue-600 hover:underline">
                          <div className="font-medium">{system.system_number}</div>
                          <div className="text-sm text-gray-500">{system.system_name}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {system.customer_name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900">
                          {system.last_contact_date 
                            ? new Date(system.last_contact_date).toLocaleDateString('de-DE')
                            : 'Noch nie'
                          }
                        </div>
                        <div className="text-xs text-orange-600">
                          {system.days_since_contact 
                            ? `vor ${system.days_since_contact} Tagen`
                            : 'Kein Kontakt'
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {system.responsible_employee || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {overdueContactSystems.length > 10 && (
                <div className="px-4 py-2 bg-gray-50 text-sm text-gray-500 text-center">
                  + {overdueContactSystems.length - 10} weitere Systeme
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
