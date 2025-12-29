import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  UserIcon,
  WrenchScrewdriverIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { id: 'basic', name: 'Basisinformationen', icon: InformationCircleIcon },
  { id: 'instance', name: 'Instanz-Details', icon: UserIcon },
  { id: 'equipment', name: 'Ausstattung/Zubehör', icon: WrenchScrewdriverIcon },
  { id: 'qm', name: 'QM-Checks', icon: ClipboardDocumentCheckIcon }
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
    firmware_version: '',
    firmware_notes: '',
    status: 'AUF_LAGER',
    notes: ''
  });

  // Form Data für Tab 3: Ausstattung
  const [equipmentData, setEquipmentData] = useState({});
  const [equipmentTemplate, setEquipmentTemplate] = useState(null);

  // Form Data für Tab 4: QM
  const [qmData, setQmData] = useState({});
  const [qmTemplate, setQmTemplate] = useState(null);

  // Dropdown-Optionen
  const [suppliers, setSuppliers] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [customers, setCustomers] = useState([]); // kept for compatibility but not eagerly loaded
  const [projects, setProjects] = useState([]);
  const [systems, setSystems] = useState([]);

  const fetchItem = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await api.get(`/inventory/inventory-items/${id}/`);
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
      
      // Tab 2: Instanz-Details
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
        firmware_version: data.firmware_version || '',
        firmware_notes: data.firmware_notes || '',
        status: data.status || 'AUF_LAGER',
        notes: data.notes || ''
      });
      
      // Tab 3 & 4: Templates und Daten laden
      setEquipmentData(data.equipment_data || {});
      setQmData(data.qm_data || {});
      setEquipmentTemplate(data.equipment_template || null);
      setQmTemplate(data.qm_template || null);
      
    } catch (error) {
      console.error('Error fetching inventory item:', error);
      alert('Fehler beim Laden des Artikels');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchDropdownOptions = useCallback(async () => {
    try {
      const [suppliersRes, categoriesRes, projectsRes, systemsRes] = await Promise.all([
        api.get('/suppliers/suppliers/'),
        api.get('/settings/product-categories/?is_active=true'),
        api.get('/projects/projects/?is_active=true'),
        api.get('/systems/systems/?is_active=true')
      ]);

      setSuppliers(suppliersRes.data.results || suppliersRes.data);
      setProductCategories(categoriesRes.data.results || categoriesRes.data);
      // don't eagerly load customers — load via search in InstanceTab for performance
      setCustomers([]); // explicit: clear customers state so setter is used
      setProjects(projectsRes.data.results || projectsRes.data);
      setSystems(systemsRes.data.results || systemsRes.data);
    } catch (error) {
      console.error('Error fetching dropdown options:', error);
    }
  }, []);

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

  const handleQmChange = (field, value) => {
    setQmData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...basicData,
        ...instanceData,
        equipment_data: equipmentData,
        qm_data: qmData
      };
      
      await api.patch(`/inventory/inventory-items/${id}/`, payload);
      setSaveMessage({ type: 'success', text: 'Änderungen gespeichert!' });
      setHasChanges(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving:', error);
      setSaveMessage({ type: 'error', text: 'Fehler beim Speichern' });
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
        <nav className="-mb-px flex space-x-8">
          {TABS.map((tab) => {
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

        {/* Tab 4: QM-Checks */}
        {activeTab === 'qm' && (
          <QmTab
            data={qmData}
            template={qmTemplate}
            onChange={handleQmChange}
            categoryCode={item.product_category_code || item.item_category}
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
          <select
            value={data.supplier || ''}
            onChange={(e) => onChange('supplier', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Wählen...</option>
            {(Array.isArray(suppliers) ? suppliers : []).map(s => (
              <option key={s.id} value={s.id}>{s.supplier_number} - {s.company_name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lieferanten-Artikelnummer
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
const InstanceTab = ({ data, onChange, customers, projects, systems }) => {
  const [customerFilter, setCustomerFilter] = useState('');
  const [customerOptions, setCustomerOptions] = useState([]);

  // Fetch customers by search query (debounced) for performance
  useEffect(() => {
    let active = true;
    if (!customerFilter || customerFilter.length < 2) {
      setCustomerOptions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.append('search', customerFilter);
        params.append('is_active', 'true');
        params.append('page_size', '20');
        const res = await api.get(`/customers/customers/?${params.toString()}`);
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

  const filteredCustomers = customerOptions;

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
        {/* Kunde */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kunde (System)
          </label>
          <input
            type="text"
            placeholder="Filter Kunde..."
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full mb-2 border border-gray-200 rounded-md px-3 py-1 text-sm"
          />
          <select
            value={data.customer || ''}
            onChange={(e) => onChange('customer', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Wählen...</option>
            {filteredCustomers.map(c => (
              <option key={c.id} value={c.id}>{labelForCustomer(c)}</option>
            ))}
          </select>
        </div>
        
        {/* removed manual customer_name field per request */}
        
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
            onChange={(e) => onChange('status', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="AUF_LAGER">Auf Lager</option>
            <option value="RMA">RMA</option>
            <option value="BEI_KUNDE">Bei Kunde</option>
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
        
        {/* Kundenauftragsnummer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kundenauftragsnummer
          </label>
          <input
            type="text"
            value={data.customer_order_number}
            onChange={(e) => onChange('customer_order_number', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          />
        </div>
        
        {/* System */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            System
          </label>
          <select
            value={data.system || ''}
            onChange={(e) => onChange('system', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Wählen...</option>
            {(Array.isArray(systems) ? systems : []).map(s => (
              <option key={s.id} value={s.id}>{labelForSystem(s)}</option>
            ))}
          </select>
        </div>

        {/* removed manual system_number field per request */}

        {/* Projekt */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Projekt
          </label>
          <select
            value={data.project || ''}
            onChange={(e) => onChange('project', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">Wählen...</option>
            {(Array.isArray(projects) ? projects : []).map(p => (
              <option key={p.id} value={p.id}>{labelForProject(p)}</option>
            ))}
          </select>
        </div>

        {/* removed manual project_number field per request */}
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

// Tab 4: QM-Checks
const QmTab = ({ data, template, onChange, categoryCode }) => {
  // Fallback-Template
  const defaultChecks = [
    { name: 'visual_inspection', label: 'Sichtprüfung', type: 'pass_fail' },
    { name: 'functional_test', label: 'Funktionstest', type: 'pass_fail' },
    { name: 'completeness_check', label: 'Vollständigkeitsprüfung', type: 'pass_fail' }
  ];
  
  const checks = template?.checks || defaultChecks;
  
  const getCheckValue = (checkName, field) => {
    return data[checkName]?.[field] || '';
  };
  
  const setCheckValue = (checkName, field, value) => {
    const currentCheck = data[checkName] || {};
    onChange(checkName, { ...currentCheck, [field]: value });
  };
  
  const renderCheck = (check) => {
    const result = getCheckValue(check.name, 'result');
    const notes = getCheckValue(check.name, 'notes');
    const measurement = getCheckValue(check.name, 'measurement');
    const date = getCheckValue(check.name, 'date');
    const tester = getCheckValue(check.name, 'tester');
    
    return (
      <div key={check.name} className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-start mb-3">
          <h4 className="font-medium text-gray-900">{check.label}</h4>
          <span className={`px-2 py-1 rounded text-xs font-semibold ${
            result === 'pass' ? 'bg-green-100 text-green-800' :
            result === 'fail' ? 'bg-red-100 text-red-800' :
            'bg-gray-200 text-gray-600'
          }`}>
            {result === 'pass' ? 'BESTANDEN' : result === 'fail' ? 'NICHT BESTANDEN' : 'OFFEN'}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Ergebnis */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ergebnis</label>
            {check.type === 'pass_fail' ? (
              <select
                value={result}
                onChange={(e) => setCheckValue(check.name, 'result', e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">Auswählen...</option>
                <option value="pass">Bestanden</option>
                <option value="fail">Nicht bestanden</option>
                <option value="na">N/A</option>
              </select>
            ) : (
              <input
                type="text"
                value={measurement}
                onChange={(e) => setCheckValue(check.name, 'measurement', e.target.value)}
                placeholder="Messwert"
                className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              />
            )}
          </div>
          
          {/* Datum */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Datum</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setCheckValue(check.name, 'date', e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
          
          {/* Prüfer */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Prüfer</label>
            <input
              type="text"
              value={tester}
              onChange={(e) => setCheckValue(check.name, 'tester', e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </div>
        </div>
        
        {/* Notizen */}
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Notizen</label>
          <textarea
            value={notes}
            onChange={(e) => setCheckValue(check.name, 'notes', e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>
    );
  };
  
  // Berechne QM-Status
  const getQmStatus = () => {
    const results = checks.map(c => getCheckValue(c.name, 'result'));
    const completed = results.filter(r => r === 'pass' || r === 'fail' || r === 'na').length;
    const passed = results.filter(r => r === 'pass' || r === 'na').length;
    const failed = results.filter(r => r === 'fail').length;
    
    return { completed, total: checks.length, passed, failed };
  };
  
  const status = getQmStatus();
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="text-lg font-medium text-gray-900">QM - Ausgangs- und Funktionschecks</h3>
        <div className="flex items-center space-x-4">
          {categoryCode && (
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
              Kategorie: {categoryCode}
            </span>
          )}
          <span className="text-sm">
            <span className={`font-semibold ${
              status.failed > 0 ? 'text-red-600' :
              status.completed === status.total ? 'text-green-600' : 'text-gray-600'
            }`}>
              {status.completed}/{status.total} geprüft
            </span>
            {status.failed > 0 && (
              <span className="text-red-600 ml-2">({status.failed} fehlgeschlagen)</span>
            )}
          </span>
        </div>
      </div>
      
      <div className="space-y-4">
        {checks.map(check => renderCheck(check))}
      </div>
    </div>
  );
};

export default InventoryItemEdit;
