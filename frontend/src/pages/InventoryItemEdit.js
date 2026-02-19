import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../services/api';
import SupplierSearch from '../components/SupplierSearch';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  UserIcon,
  WrenchScrewdriverIcon,
  ClipboardDocumentCheckIcon,
  TruckIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

// Get backend base URL from api service
const BACKEND_BASE = process.env.REACT_APP_BACKEND_BASE || '';

const BASE_TABS = [
  { id: 'basic', name: 'Basisinformationen', icon: InformationCircleIcon },
  { id: 'instance', name: 'Instanz-Details', icon: UserIcon },
  { id: 'equipment', name: 'Ausstattung/Zubehör', icon: WrenchScrewdriverIcon }
];

const InventoryItemEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('basic');
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Form Data für Tab 1: Basisinformationen
  const [basicData, setBasicData] = useState({
    name: '',
    model_designation: '',
    description: '',
    supplier: null,
    article_number: '',
    visitron_part_number: '',
    product_category: null
  });

  // Form Data für Tab 2: Instanz-Details
  const [instanceData, setInstanceData] = useState({
    customer: null,
    customer_name: '',
    serial_number: '',
    order_number: '',
    customer_order_number: '',
    system: null,
    system_number: '',
    project: null,
    project_number: '',
    delivery_date: '',
    firmware_version: '',
    firmware_notes: '',
    status: 'FREI',
    reserved_by: null,
    reserved_until: '',
    reservation_reason: '',
    notes: ''
  });

  // Form Data für Tab 3: Ausstattung
  const [equipmentData, setEquipmentData] = useState({});
  const [equipmentTemplate, setEquipmentTemplate] = useState(null);

  // Checklisten-Daten (dynamisch aus Templates)
  const [productionChecklistData, setProductionChecklistData] = useState(null);
  const [outgoingChecklistData, setOutgoingChecklistData] = useState(null);
  const [hasProductionTemplate, setHasProductionTemplate] = useState(false);
  const [hasOutgoingTemplate, setHasOutgoingTemplate] = useState(false);

  // Dropdown-Optionen
  const [suppliers, setSuppliers] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [customers, setCustomers] = useState([]); // kept for compatibility but not eagerly loaded
  const [projects, setProjects] = useState([]);
  const [systems, setSystems] = useState([]);
  const [users, setUsers] = useState([]);

  // Normalize legacy status values to the new set
  const normalizeStatus = (status) => {
    if (!status) return 'FREI';
    switch (status) {
      case 'AUF_LAGER':
        return 'FREI';
      case 'BEI_KUNDE':
        return 'GELIEFERT';
      case 'RMA':
        return 'RMA_IN_HOUSE';
      default:
        return status;
    }
  };

  const fetchItem = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await axios.get(`${BACKEND_BASE}/api/inventory/inventory-items/${id}/`, { withCredentials: true });
      const data = response.data;
      setItem(data);
      
      // Tab 1: Basisinformationen
      setBasicData({
        name: data.name || '',
        model_designation: data.model_designation || '',
        description: data.description || '',
        supplier: data.supplier?.id || data.supplier,
        article_number: data.article_number || '',
        visitron_part_number: data.visitron_part_number || '',
        product_category: data.product_category
      });
      
      // Tab 2: Instanz-Details (normalize legacy status values)
      setInstanceData({
        customer: data.customer,
        customer_name: data.customer_name || '',
        serial_number: data.serial_number || '',
        order_number: data.order_number || '',
        customer_order_number: data.customer_order_number || '',
        system: data.system,
        system_number: data.system_number || '',
        project: data.project,
        project_number: data.project_number || '',
        delivery_date: data.delivery_date || '',
        firmware_version: data.firmware_version || '',
        firmware_notes: data.firmware_notes || '',
        status: normalizeStatus(data.status),
        reserved_by: data.reserved_by,
        reserved_until: data.reserved_until || '',
        reservation_reason: data.reservation_reason || '',
        notes: data.notes || ''
      });
      
      // Tab 3 & 4: Templates und Daten laden
      setEquipmentData(data.equipment_data || {});
      setEquipmentTemplate(data.equipment_template || null);

      // Checklisten aus gespeicherten Daten laden
      const savedProduction = data.production_checklist_data;
      const savedOutgoing = data.outgoing_checks;
      setProductionChecklistData(savedProduction && savedProduction.sections ? savedProduction : null);
      setOutgoingChecklistData(savedOutgoing && savedOutgoing.sections ? savedOutgoing : null);

      // Templates für diese Kategorie laden
      if (data.product_category) {
        fetchChecklistTemplates(data.product_category, savedProduction, savedOutgoing);
      }
      
    } catch (error) {
      console.error('Error fetching inventory item:', error);
      alert('Fehler beim Laden des Artikels');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchDropdownOptions = useCallback(async () => {
    console.log('🔍 fetchDropdownOptions called - BACKEND_BASE:', BACKEND_BASE);
    try {
      const [suppliersRes, categoriesRes, projectsRes, systemsRes, usersRes] = await Promise.all([
        axios.get(`${BACKEND_BASE}/api/suppliers/suppliers/`, { withCredentials: true }),
        axios.get(`${BACKEND_BASE}/api/settings/product-categories/?is_active=true`, { withCredentials: true }),
        axios.get(`${BACKEND_BASE}/api/projects/projects/?is_active=true`, { withCredentials: true }),
        axios.get(`${BACKEND_BASE}/api/systems/systems/?is_active=true`, { withCredentials: true }),
        axios.get(`${BACKEND_BASE}/api/users/?is_active=true`, { withCredentials: true })
      ]);

      console.log('✅ Suppliers loaded:', suppliersRes.data.results?.length || suppliersRes.data?.length);
      console.log('✅ Categories loaded:', categoriesRes.data.results?.length || categoriesRes.data?.length);
      console.log('✅ Users loaded:', usersRes.data.results?.length || usersRes.data?.length);

      setSuppliers(suppliersRes.data.results || suppliersRes.data);
      setProductCategories(categoriesRes.data.results || categoriesRes.data);
      // don't eagerly load customers — load via search in InstanceTab for performance
      setCustomers([]); // explicit: clear customers state so setter is used
      setProjects(projectsRes.data.results || projectsRes.data);
      setSystems(systemsRes.data.results || systemsRes.data);
      setUsers(usersRes.data.results || usersRes.data);
    } catch (error) {
      console.error('❌ Error fetching dropdown options:', error);
      console.error('❌ Error details:', error.response?.status, error.response?.data);
    }
  }, []);

  // Fetch checklist templates for the item's category
  const fetchChecklistTemplates = async (categoryId, savedProduction, savedOutgoing) => {
    try {
      const response = await api.get(`/settings/checklist-templates/?product_category=${categoryId}&is_active=true`);
      const templates = response.data.results || response.data;

      const prodTemplate = templates.find(t => t.checklist_type === 'production');
      const outTemplate = templates.find(t => t.checklist_type === 'outgoing');

      setHasProductionTemplate(!!prodTemplate);
      setHasOutgoingTemplate(!!outTemplate);

      // If no saved data yet, initialize from template
      if (prodTemplate && (!savedProduction || !savedProduction.sections)) {
        const initResp = await api.get(`/settings/checklist-templates/${prodTemplate.id}/initial_data/`);
        setProductionChecklistData(initResp.data);
      }
      if (outTemplate && (!savedOutgoing || !savedOutgoing.sections)) {
        const initResp = await api.get(`/settings/checklist-templates/${outTemplate.id}/initial_data/`);
        setOutgoingChecklistData(initResp.data);
      }
    } catch (error) {
      console.error('Error fetching checklist templates:', error);
    }
  };

  useEffect(() => {
    if (id) {
      fetchItem();
      fetchDropdownOptions();
    }
  }, [id, fetchItem, fetchDropdownOptions]);

  const handleBasicChange = (field, value) => {
    setBasicData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleInstanceChange = (field, value) => {
    setInstanceData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleEquipmentChange = (field, value) => {
    setEquipmentData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleChecklistChange = (dataKey, setData, sectionIdx, itemIdx, checked) => {
    setData(prev => {
      if (!prev || !prev.sections) return prev;
      const updated = JSON.parse(JSON.stringify(prev));
      updated.sections[sectionIdx].items[itemIdx].checked = checked;
      return updated;
    });
    setHasChanges(true);
  };

  const handleChecklistTableChange = (setData, tableKey, rowIdx, field, value) => {
    setData(prev => {
      if (!prev || !prev[tableKey]) return prev;
      const updated = JSON.parse(JSON.stringify(prev));
      updated[tableKey].rows[rowIdx][field] = value;
      return updated;
    });
    setHasChanges(true);
  };

  const handleLeoniSnChange = (setData, value) => {
    setData(prev => {
      if (!prev) return prev;
      return { ...prev, leoni_sn: value };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Validierung
    if (!basicData.article_number || !basicData.article_number.trim()) {
      setSaveMessage({ type: 'error', text: 'Bitte geben Sie eine Lieferanten-Artikelnummer ein.' });
      return;
    }
    if (!basicData.name || !basicData.name.trim()) {
      setSaveMessage({ type: 'error', text: 'Bitte geben Sie einen Produktnamen ein.' });
      return;
    }

    setSaving(true);
    try {
      // Ensure empty dates are sent as null (Django expects null or YYYY-MM-DD)
      const cleanedInstance = { ...instanceData };
      if (!cleanedInstance.reserved_until) cleanedInstance.reserved_until = null;
      if (!cleanedInstance.reserved_by) cleanedInstance.reserved_by = null;
      if (!cleanedInstance.delivery_date) cleanedInstance.delivery_date = null;

      const payload = {
        ...basicData,
        ...cleanedInstance,
        equipment_data: equipmentData,
        production_checklist_data: productionChecklistData || {},
        outgoing_checks: outgoingChecklistData || {}
      };

      await axios.patch(`${BACKEND_BASE}/api/inventory/inventory-items/${id}/`, payload, { withCredentials: true });
      setSaveMessage({ type: 'success', text: 'Erfolgreich gespeichert' });
      setHasChanges(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      if (error.response?.data) {
        const errors = Object.entries(error.response.data)
          .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
          .join('\n');
        setSaveMessage({ type: 'error', text: `Fehler beim Speichern:\n${errors}` });
      } else {
        setSaveMessage({ type: 'error', text: 'Fehler beim Speichern' });
      }
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-gray-500">Artikel nicht gefunden</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/inventory/warehouse')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Zurück zum Warenlager
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {item.inventory_number} - {item.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              VS-Nr: {item.visitron_part_number || '-'} | 
              Lieferant-Nr: {item.article_number} | 
              Eingelagert: {formatDate(item.stored_at)}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {saveMessage && (
              <div className={`flex items-center px-4 py-2 rounded-md ${
                saveMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {saveMessage.type === 'success' ? (
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                ) : (
                  <ExclamationCircleIcon className="h-5 w-5 mr-2" />
                )}
                {saveMessage.text}
              </div>
            )}
            
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`px-4 py-2 rounded-md font-medium ${
                hasChanges
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {saving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="tab-scroll -mb-px flex space-x-8">
          {(() => {
            const tabs = [...BASE_TABS];
            if (hasProductionTemplate || (productionChecklistData && productionChecklistData.sections)) {
              tabs.push({ id: 'production_checklist', name: 'Fertigungscheckliste', icon: ClipboardDocumentCheckIcon });
            }
            if (hasOutgoingTemplate || (outgoingChecklistData && outgoingChecklistData.sections)) {
              tabs.push({ id: 'outgoing_checklist', name: 'Ausgangscheckliste', icon: TruckIcon });
            }
            return tabs;
          })().map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <Icon className="h-5 w-5 mr-2" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg p-6">
        {/* Tab 1: Basisinformationen */}
        {activeTab === 'basic' && (
          <BasicInfoTab
            data={basicData}
            onChange={handleBasicChange}
            suppliers={suppliers}
            productCategories={productCategories}
            item={item}
          />
        )}

        {/* Tab 2: Instanz-Details */}
        {activeTab === 'instance' && (
          <InstanceTab
            data={instanceData}
            onChange={handleInstanceChange}
            customers={customers}
            projects={projects}
            systems={systems}
            users={users}
          />
        )}

        {/* Tab 3: Ausstattung/Zubehör */}
        {activeTab === 'equipment' && (
          <EquipmentTab
            data={equipmentData}
            template={equipmentTemplate}
            onChange={handleEquipmentChange}
            categoryCode={item.product_category_code || item.item_category}
          />
        )}

        {/* Tab 4: Fertigungscheckliste */}
        {activeTab === 'production_checklist' && (
          <DynamicChecklistTab
            title="Fertigungscheckliste"
            data={productionChecklistData}
            onCheckChange={(sIdx, iIdx, checked) => handleChecklistChange('production', setProductionChecklistData, sIdx, iIdx, checked)}
            onTableChange={(tableKey, rowIdx, field, value) => handleChecklistTableChange(setProductionChecklistData, tableKey, rowIdx, field, value)}
            onLeoniSnChange={(value) => handleLeoniSnChange(setProductionChecklistData, value)}
          />
        )}

        {/* Tab 5: Ausgangscheckliste */}
        {activeTab === 'outgoing_checklist' && (
          <DynamicChecklistTab
            title="Ausgangscheckliste"
            data={outgoingChecklistData}
            onCheckChange={(sIdx, iIdx, checked) => handleChecklistChange('outgoing', setOutgoingChecklistData, sIdx, iIdx, checked)}
            onTableChange={(tableKey, rowIdx, field, value) => handleChecklistTableChange(setOutgoingChecklistData, tableKey, rowIdx, field, value)}
            onLeoniSnChange={(value) => handleLeoniSnChange(setOutgoingChecklistData, value)}
          />
        )}
      </div>
    </div>
  );
};

// Tab 1: Basisinformationen
const BasicInfoTab = ({ data, onChange, suppliers, productCategories, item }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Basisinformationen</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Produktname *
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange('name', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Modellbezeichnung
          </label>
          <input
            type="text"
            value={data.model_designation}
            onChange={(e) => onChange('model_designation', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Beschreibung
          </label>
          <textarea
            value={data.description}
            onChange={(e) => onChange('description', e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lieferant
          </label>
          <SupplierSearch
            value={data.supplier}
            onChange={(supplierId) => onChange('supplier', supplierId)}
            placeholder="Lieferant suchen..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lieferanten-Artikelnummer <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.article_number}
            onChange={(e) => onChange('article_number', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            VS-Artikelnummer
          </label>
          <input
            type="text"
            value={data.visitron_part_number}
            onChange={(e) => onChange('visitron_part_number', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Warenkategorie
          </label>
          <select
            value={data.product_category || ''}
            onChange={(e) => onChange('product_category', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Wählen...</option>
            {(Array.isArray(productCategories) ? productCategories : []).map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Readonly Info */}
      <div className="mt-6 pt-4 border-t">
        <h4 className="text-sm font-medium text-gray-500 mb-3">Nur-Lesen Informationen</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Inventarnummer:</span>
            <span className="ml-2 font-medium">{item.inventory_number}</span>
          </div>
          <div>
            <span className="text-gray-500">Warenfunktion:</span>
            <span className="ml-2 font-medium">
              {item.item_function === 'TRADING_GOOD' ? 'Handelsware' : 
               item.item_function === 'ASSET' ? 'Asset' : 'Material'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">EK-Preis:</span>
            <span className="ml-2 font-medium">{item.purchase_price} {item.currency}</span>
          </div>
          <div>
            <span className="text-gray-500">Menge:</span>
            <span className="ml-2 font-medium">{item.quantity} {item.unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Tab 2: Instanz-Details
const InstanceTab = ({ data, onChange, customers, projects, systems, users }) => {
  const [customerFilter, setCustomerFilter] = useState('');
  const [customerOptions, setCustomerOptions] = useState([]);

  const [customerOrderFilter, setCustomerOrderFilter] = useState('');
  const [customerOrderOptions, setCustomerOrderOptions] = useState([]);

  const [systemFilter, setSystemFilter] = useState('');
  const [systemOptionsLocal, setSystemOptionsLocal] = useState([]);

  const [projectFilter, setProjectFilter] = useState('');
  const [projectOptionsLocal, setProjectOptionsLocal] = useState([]);

  // Fetch customers by search query (debounced, min 3 chars) for performance
  useEffect(() => {
    let active = true;
    if (!customerFilter || customerFilter.length < 3) {
      setCustomerOptions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.append('search', customerFilter);
        params.append('is_active', 'true');
        params.append('page_size', '20');
        const res = await axios.get(`${BACKEND_BASE}/api/customers/customers/?${params.toString()}`, { withCredentials: true });
        const results = res.data.results || res.data || [];
        if (active) setCustomerOptions(Array.isArray(results) ? results : []);
      } catch (err) {
        console.error('Customer search error:', err);
        if (active) setCustomerOptions([]);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [customerFilter]);

  // Customer Order search (search after 3 chars)
  useEffect(() => {
    let active = true;
    if (!customerOrderFilter || customerOrderFilter.length < 3) {
      setCustomerOrderOptions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.append('search', customerOrderFilter);
        params.append('page_size', '20');
        const res = await axios.get(`${BACKEND_BASE}/api/customer-orders/customer-orders/?${params.toString()}`, { withCredentials: true });
        const results = res.data.results || res.data || [];
        if (active) setCustomerOrderOptions(Array.isArray(results) ? results : []);
      } catch (err) {
        console.error('Customer order search error:', err);
        if (active) setCustomerOrderOptions([]);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [customerOrderFilter]);

  // System search (after 3 chars)
  useEffect(() => {
    let active = true;
    if (!systemFilter || systemFilter.length < 3) {
      setSystemOptionsLocal([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.append('search', systemFilter);
        params.append('is_active', 'true');
        params.append('page_size', '20');
        const res = await axios.get(`${BACKEND_BASE}/api/systems/systems/?${params.toString()}`, { withCredentials: true });
        const results = res.data.results || res.data || [];
        if (active) setSystemOptionsLocal(Array.isArray(results) ? results : []);
      } catch (err) {
        console.error('System search error:', err);
        if (active) setSystemOptionsLocal([]);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [systemFilter]);

  // Project search (after 3 chars)
  useEffect(() => {
    let active = true;
    if (!projectFilter || projectFilter.length < 3) {
      setProjectOptionsLocal([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.append('search', projectFilter);
        params.append('is_active', 'true');
        params.append('page_size', '20');
        const res = await axios.get(`${BACKEND_BASE}/api/projects/projects/?${params.toString()}`, { withCredentials: true });
        const results = res.data.results || res.data || [];
        if (active) setProjectOptionsLocal(Array.isArray(results) ? results : []);
      } catch (err) {
        console.error('Project search error:', err);
        if (active) setProjectOptionsLocal([]);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [projectFilter]);

  const labelForCustomer = (c) => {
    const num = c?.customer_number || '';
    const name = c?.name || c?.company_name || c?.display_name || c?.full_name || c?.customer_name || c?.contact_name || '';
    return name ? `${num}${num ? ' - ' : ''}${name}` : num;
  };
  const labelForSystem = (s) => `${s.system_number || ''}${s.system_number ? ' - ' : ''}${s.name || s.system_name || ''}`;
  const labelForProject = (p) => `${p.project_number || ''}${p.project_number ? ' - ' : ''}${p.name || p.title || ''}`;
  

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Instanz-spezifische Informationen</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kunde (Suche) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kunde
          </label>
          
          {/* Selected badge - show customer number AND name */}
          {data.customer && (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md mb-2">
              <div className="text-sm text-blue-800">
                <span className="font-mono font-medium">#{data.customer}</span>
                {data.customer_name && (
                  <span className="ml-2">- {data.customer_name}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => { onChange('customer', null); onChange('customer_name', ''); }}
                className="text-red-600 hover:text-red-800"
                title="Entfernen"
              >
                ✖
              </button>
            </div>
          )}
          
          <input
            type="text"
            placeholder="Suche Kunde (mind. 3 Zeichen)..."
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-1"
          />
          
          {/* Suggestions */}
          {customerOptions.length > 0 && (
            <div className="border border-gray-200 rounded bg-white mt-1 max-h-44 overflow-auto shadow-lg z-10 relative">
              {customerOptions.map(c => (
                <div
                  key={c.id}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                  onClick={() => {
                    onChange('customer', c.id);
                    onChange('customer_name', labelForCustomer(c));
                    setCustomerOptions([]);
                    setCustomerFilter('');
                  }}
                >
                  <div className="font-medium">{labelForCustomer(c)}</div>
                  <div className="text-xs text-gray-500">{c.contact_name || c.contact_person || ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Seriennummer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Seriennummer
          </label>
          <input
            type="text"
            value={data.serial_number}
            onChange={(e) => onChange('serial_number', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono"
          />
        </div>
        
        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={data.status}
            onChange={(e) => {
              onChange('status', e.target.value);
              // Clear reservation fields if status is not RESERVIERT
              if (e.target.value !== 'RESERVIERT') {
                onChange('reserved_by', null);
                onChange('reserved_until', '');
                onChange('reservation_reason', '');
              }
            }}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="FREI">Frei</option>
            <option value="RESERVIERT">Reserviert</option>
            <option value="GELIEFERT">Geliefert</option>
            <option value="RMA_IN_HOUSE">RMA in house</option>
            <option value="RMA_OUT_HOUSE">RMA out house</option>
          </select>
        </div>
        
        {/* Bestellnummer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bestellnummer (Order)
          </label>
          <input
            type="text"
            value={data.order_number}
            onChange={(e) => onChange('order_number', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
        
        {/* Kundenauftragsnummer (Suche) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kundenauftragsnummer</label>

          {/* Selected badge */}
          {data.customer_order_number ? (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md mb-2">
              <div className="text-sm text-blue-800 truncate">📄 {data.customer_order_number}</div>
              <button
                type="button"
                onClick={() => { onChange('customer_order_number', ''); onChange('order_number', ''); }}
                className="text-red-600 hover:text-red-800"
                title="Entfernen"
              >
                ✖
              </button>
            </div>
          ) : null}

          <input
            type="text"
            placeholder="Suche Auftrag (Nr. oder Kundenname)..."
            value={customerOrderFilter}
            onChange={(e) => setCustomerOrderFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-1"
          />

          {/* Suggestions */}
          {customerOrderOptions.length > 0 && (
            <div className="border border-gray-200 rounded bg-white mt-1 max-h-44 overflow-auto">
              {customerOrderOptions.map(co => (
                <div
                  key={co.id}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                  onClick={() => {
                    const orderNum = co.order_number || co.id;
                    onChange('customer_order_number', orderNum);
                    onChange('order_number', orderNum);
                    setCustomerOrderOptions([]);
                    setCustomerOrderFilter('');
                  }}
                >
                  <div className="font-medium">{co.order_number || co.id}</div>
                  <div className="text-xs text-gray-500">{co.customer_name || co.supplier_name || ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* System (Suche) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">System</label>

          {/* Selected badge */}
          {data.system && (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md mb-2">
              <div className="text-sm text-blue-800 truncate">{data.system_number || ''}</div>
              <button
                type="button"
                onClick={() => { onChange('system', null); onChange('system_number', ''); }}
                className="text-red-600 hover:text-red-800"
                title="Entfernen"
              >
                ✖
              </button>
            </div>
          )}

          <input
            type="text"
            placeholder="Suche System (Nr. oder Name)..."
            value={systemFilter}
            onChange={(e) => setSystemFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-1"
          />

          {/* Suggestions */}
          {systemOptionsLocal.length > 0 && (
            <div className="border border-gray-200 rounded bg-white mt-1 max-h-44 overflow-auto">
              {systemOptionsLocal.map(s => (
                <div
                  key={s.id}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                  onClick={() => {
                    onChange('system', s.id);
                    onChange('system_number', s.system_number || '');
                    setSystemOptionsLocal([]);
                    setSystemFilter('');
                  }}
                >
                  <div className="font-medium">{s.system_number || s.id}</div>
                  <div className="text-xs text-gray-500">{s.name || s.system_name || ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* removed manual system_number field per request */}

        {/* Projekt (Suche) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Projekt</label>

          {/* Selected badge */}
          {data.project && (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md mb-2">
              <div className="text-sm text-blue-800 truncate">{data.project_number || ''}</div>
              <button
                type="button"
                onClick={() => { onChange('project', null); onChange('project_number', ''); }}
                className="text-red-600 hover:text-red-800"
                title="Entfernen"
              >
                ✖
              </button>
            </div>
          )}

          <input
            type="text"
            placeholder="Suche Projekt (Nr. oder Name)..."
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 mb-1"
          />

          {/* Suggestions */}
          {projectOptionsLocal.length > 0 && (
            <div className="border border-gray-200 rounded bg-white mt-1 max-h-44 overflow-auto">
              {projectOptionsLocal.map(p => (
                <div
                  key={p.id}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                  onClick={() => {
                    onChange('project', p.id);
                    onChange('project_number', p.project_number || '');
                    setProjectOptionsLocal([]);
                    setProjectFilter('');
                  }}
                >
                  <div className="font-medium">{p.project_number || p.id}</div>
                  <div className="text-xs text-gray-500">{p.name || p.title || ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* removed manual project_number field per request */}
      </div>
      
      {/* Lieferdatum */}
      <div className="mt-6 pt-4 border-t">
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lieferdatum
          </label>
          <input
            type="date"
            value={data.delivery_date}
            onChange={(e) => onChange('delivery_date', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
      </div>
      
      {/* Firmware */}
      <div className="mt-6 pt-4 border-t">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Firmware-Informationen</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Firmware-Version
            </label>
            <input
              type="text"
              value={data.firmware_version}
              onChange={(e) => onChange('firmware_version', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Firmware-Notizen
            </label>
            <textarea
              value={data.firmware_notes}
              onChange={(e) => onChange('firmware_notes', e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </div>
      </div>
      
      {/* Reservierung (nur wenn Status FREI oder RESERVIERT) */}
      {(data.status === 'FREI' || data.status === 'RESERVIERT') && (
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">Reservierungsinformationen</h4>
            {data.status === 'FREI' && (
              <span className="text-xs text-gray-500">Status wird automatisch auf "Reserviert" gesetzt</span>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reserviert durch
              </label>
              <select
                value={data.reserved_by || ''}
                onChange={(e) => {
                  onChange('reserved_by', e.target.value ? parseInt(e.target.value) : null);
                  // Automatically change status to RESERVIERT if a user is selected
                  if (e.target.value && data.status === 'FREI') {
                    onChange('status', 'RESERVIERT');
                  }
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Nicht reserviert</option>
                {users && users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.username})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reserviert bis
              </label>
              <input
                type="date"
                value={data.reserved_until}
                onChange={(e) => onChange('reserved_until', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reservierungsgrund
              </label>
              <textarea
                value={data.reservation_reason}
                onChange={(e) => onChange('reservation_reason', e.target.value)}
                rows={3}
                placeholder="Grund für die Reservierung..."
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Notizen */}
      <div className="mt-6 pt-4 border-t">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Allgemeine Notizen
        </label>
        <textarea
          value={data.notes}
          onChange={(e) => onChange('notes', e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-md px-3 py-2"
        />
      </div>
    </div>
  );
};

// Tab 3: Ausstattung/Zubehör
const EquipmentTab = ({ data, template, onChange, categoryCode }) => {
  // Fallback-Template falls kein spezifisches vorhanden
  const defaultFields = [
    { name: 'accessories', label: 'Mitgeliefertes Zubehör', type: 'text' },
    { name: 'cables', label: 'Kabel', type: 'text' },
    { name: 'software', label: 'Software', type: 'text' },
    { name: 'manuals', label: 'Handbücher', type: 'text' },
    { name: 'notes', label: 'Ausstattungs-Notizen', type: 'textarea' }
  ];
  
  const fields = template?.fields || defaultFields;
  
  const renderField = (field) => {
    const value = data[field.name] || '';
    
    switch (field.type) {
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Wählen...</option>
            {field.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      
      case 'boolean':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={value === true || value === 'true'}
              onChange={(e) => onChange(field.name, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 mr-2"
            />
            <span className="text-sm text-gray-700">Ja</span>
          </label>
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        );
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        );
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        );
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="text-lg font-medium text-gray-900">Ausstattung / Zubehör</h3>
        {categoryCode && (
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
            Kategorie: {categoryCode}
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {fields.map(field => (
          <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
            </label>
            {renderField(field)}
          </div>
        ))}
      </div>
    </div>
  );
};

// Dynamic Checklist Tab (used for both Fertigungs- and Ausgangschecklisten)
const DynamicChecklistTab = ({ title, data, onCheckChange, onTableChange, onLeoniSnChange }) => {
  if (!data || !data.sections) {
    return (
      <div className="text-center py-8 text-gray-500">
        Keine Checkliste verfügbar. Bitte konfigurieren Sie eine Vorlage in den Einstellungen.
      </div>
    );
  }

  const totalItems = data.sections.reduce((sum, s) => sum + s.items.length, 0);
  const checkedItems = data.sections.reduce((sum, s) => sum + s.items.filter(i => i.checked).length, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <div className="flex items-center space-x-4">
          <span className="text-sm">
            <span className={`font-semibold ${
              checkedItems === totalItems && totalItems > 0 ? 'text-green-600' : 'text-gray-600'
            }`}>
              {checkedItems}/{totalItems} geprüft
            </span>
          </span>
          {checkedItems === totalItems && totalItems > 0 && (
            <CheckCircleIcon className="h-6 w-6 text-green-500" />
          )}
        </div>
      </div>

      <div className="space-y-8">
        {data.sections.map((section, sIdx) => (
          <div key={sIdx}>
            <h4 className="text-md font-medium text-gray-800 mb-3 pb-2 border-b">
              {section.title}
            </h4>
            <div className="space-y-2">
              {section.items.map((item, iIdx) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!item.checked}
                    onChange={(e) => onCheckChange(sIdx, iIdx, e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={item.checked ? 'text-gray-500 line-through' : ''}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Galvo Table */}
        {data.galvo_table && (
          <div className="mt-8">
            <h4 className="text-md font-medium text-gray-800 mb-3 pb-2 border-b">
              Galvo-Offset Messung
            </h4>
            <table className="min-w-full border">
              <thead className="bg-gray-50">
                <tr>
                  {data.galvo_table.headers.map((header, idx) => (
                    <th key={idx} className="px-4 py-2 border text-left text-sm font-medium text-gray-700">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.galvo_table.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    <td className="px-4 py-2 border bg-gray-50 font-mono">{row.offset}</td>
                    <td className="px-4 py-2 border">
                      <input
                        type="text"
                        value={row.x_voltage || ''}
                        onChange={(e) => onTableChange('galvo_table', rowIdx, 'x_voltage', e.target.value)}
                        className="w-full px-2 py-1 border rounded"
                      />
                    </td>
                    <td className="px-4 py-2 border">
                      <input
                        type="text"
                        value={row.y_voltage || ''}
                        onChange={(e) => onTableChange('galvo_table', rowIdx, 'y_voltage', e.target.value)}
                        className="w-full px-2 py-1 border rounded"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Laser Table */}
        {data.laser_table && (
          <div className="mt-8">
            <h4 className="text-md font-medium text-gray-800 mb-3 pb-2 border-b">
              Laser-Dokumentation
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead className="bg-gray-50">
                  <tr>
                    {data.laser_table.headers.map((header, idx) => (
                      <th key={idx} className="px-3 py-2 border text-left text-xs font-medium text-gray-700">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.laser_table.rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {Object.keys(row).map((field, fIdx) => (
                        <td key={fIdx} className="px-3 py-2 border">
                          <input
                            type="text"
                            value={row[field] || ''}
                            onChange={(e) => onTableChange('laser_table', rowIdx, field, e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Leoni SN */}
            {data.leoni_sn !== undefined && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Leoni SN</label>
                <input
                  type="text"
                  value={data.leoni_sn || ''}
                  onChange={(e) => onLeoniSnChange(e.target.value)}
                  className="w-64 px-3 py-2 border rounded"
                  placeholder="Leoni Seriennummer"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryItemEdit;
