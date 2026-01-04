import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  ComputerDesktopIcon,
  InformationCircleIcon,
  CubeIcon,
  PhotoIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowsPointingOutIcon,
  SparklesIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  WrenchScrewdriverIcon,
  FolderIcon,
  ShoppingCartIcon,
  TicketIcon,
  ArrowTopRightOnSquareIcon,
  KeyIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { id: 'basic', name: 'Basisinformationen', icon: InformationCircleIcon },
  { id: 'components', name: 'Komponenten', icon: CubeIcon },
  { id: 'photos', name: 'Fotos', icon: PhotoIcon },
  { id: 'projects', name: 'Projekte', icon: FolderIcon },
  { id: 'orders', name: 'Aufträge', icon: ShoppingCartIcon },
  { id: 'service', name: 'Service', icon: WrenchScrewdriverIcon },
  { id: 'visiview', name: 'VisiView', icon: KeyIcon }
];

const SystemEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('basic');
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  
  // Get customer from URL params (for pre-filled customer from CustomerModal)
  const urlCustomerId = searchParams.get('customer');
  
  // Basic Info State
  const [formData, setFormData] = useState({
    system_name: '',
    customer: urlCustomerId || '',
    description: '',
    status: 'active',
    location: '',
    installation_date: '',
    warranty_end: '',
    notes: '',
    visiview_license: ''
  });
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // VisiView License State
  const [licenses, setLicenses] = useState([]);
  const [licenseSearch, setLicenseSearch] = useState('');
  const [searchingLicenses, setSearchingLicenses] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState(null);
  
  // Components State
  const [components, setComponents] = useState([]);
  const [showComponentModal, setShowComponentModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  
  // Photos State
  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoCarouselOpen, setPhotoCarouselOpen] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  // Projekte Tab State
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  
  // Aufträge Tab State
  const [customerOrders, setCustomerOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  
  // Service Tab State
  const [serviceTickets, setServiceTickets] = useState([]);
  const [rmaCases, setRmaCases] = useState([]);
  const [serviceLoading, setServiceLoading] = useState(false);
  
  // VisiView Tab State
  const [visiviewTickets, setVisiviewTickets] = useState([]);
  const [visiviewLoading, setVisiviewLoading] = useState(false);
  
  // Customer inventory for component modal
  const [customerInventory, setCustomerInventory] = useState([]);
  
  // Product categories for component modal
  const [productCategories, setProductCategories] = useState([]);

  // Star name search
  const [starNameSearch, setStarNameSearch] = useState('');
  const [starNameSuggestions, setStarNameSuggestions] = useState([]);

  useEffect(() => {
    if (id) {
      fetchSystem();
    }
  }, [id]);

  // Load tab data when tab is selected
  useEffect(() => {
    if (!id) return;
    if (activeTab === 'projects' && !projects.length && !projectsLoading) {
      fetchProjects();
    } else if (activeTab === 'orders' && !customerOrders.length && !ordersLoading) {
      fetchOrders();
    } else if (activeTab === 'service' && !serviceTickets.length && !rmaCases.length && !serviceLoading) {
      fetchServiceData();
    } else if (activeTab === 'visiview' && !visiviewTickets.length && !visiviewLoading) {
      fetchVisiviewTickets();
    }
  }, [activeTab, id]);

  const fetchSystem = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/systems/systems/${id}/`);
      const data = response.data;
      setSystem(data);
      setFormData({
        system_name: data.system_name || '',
        customer: data.customer || '',
        description: data.description || '',
        status: data.status || 'active',
        location: data.location || '',
        installation_date: data.installation_date || '',
        warranty_end: data.warranty_end || '',
        notes: data.notes || '',
        visiview_license: data.visiview_license || ''
      });
      setComponents(data.components || []);
      setPhotos(data.photos || []);
      
      // Load customer details if customer is set
      if (data.customer_details) {
        setSelectedCustomer(data.customer_details);
      }
      
      // Load license details if license is set
      if (data.visiview_license_details) {
        setSelectedLicense(data.visiview_license_details);
      }
    } catch (error) {
      console.error('Error fetching system:', error);
      alert('Fehler beim Laden des Systems');
    } finally {
      setLoading(false);
    }
  };

  const searchCustomers = async () => {
    if (!customerSearch.trim()) return;
    setSearchingCustomers(true);
    try {
      const params = new URLSearchParams();
      params.append('search', customerSearch);
      params.append('is_active', 'true');
      const response = await api.get(`/customers/customers/?${params.toString()}`);
      const data = response.data.results || response.data || [];
      setCustomers(data);
    } catch (err) {
      console.error('Error searching customers:', err);
      setCustomers([]);
    } finally {
      setSearchingCustomers(false);
    }
  };

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customer: customer.id }));
    setCustomers([]);
    setCustomerSearch('');
    setHasChanges(true);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setFormData(prev => ({ ...prev, customer: '' }));
    setHasChanges(true);
  };
  
  const searchLicenses = async () => {
    if (!licenseSearch.trim()) return;
    setSearchingLicenses(true);
    try {
      const params = new URLSearchParams();
      params.append('search', licenseSearch);
      const response = await api.get(`/visiview/licenses/?${params.toString()}`);
      const data = response.data.results || response.data || [];
      setLicenses(data);
    } catch (err) {
      console.error('Error searching licenses:', err);
      setLicenses([]);
    } finally {
      setSearchingLicenses(false);
    }
  };

  const selectLicense = (license) => {
    setSelectedLicense(license);
    setFormData(prev => ({ ...prev, visiview_license: license.id }));
    setLicenses([]);
    setLicenseSearch('');
    setHasChanges(true);
  };

  const clearLicense = () => {
    setSelectedLicense(null);
    setFormData(prev => ({ ...prev, visiview_license: '' }));
    setHasChanges(true);
  };

  const fetchProjects = async () => {
    setProjectsLoading(true);
    try {
      const response = await api.get(`/projects/?linked_system=${id}`);
      setProjects(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setProjectsLoading(false);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await api.get(`/customer-orders/orders/?linked_system=${id}`);
      setCustomerOrders(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchServiceData = async () => {
    setServiceLoading(true);
    try {
      const [ticketsRes, rmaRes] = await Promise.all([
        api.get(`/service/tickets/?linked_system=${id}`),
        api.get(`/service/rma/?linked_system=${id}`)
      ]);
      setServiceTickets(ticketsRes.data.results || ticketsRes.data || []);
      setRmaCases(rmaRes.data.results || rmaRes.data || []);
    } catch (error) {
      console.error('Error fetching service data:', error);
    } finally {
      setServiceLoading(false);
    }
  };

  const fetchVisiviewTickets = async () => {
    setVisiviewLoading(true);
    try {
      const response = await api.get(`/visiview/tickets/?linked_system=${id}`);
      setVisiviewTickets(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching VisiView tickets:', error);
    } finally {
      setVisiviewLoading(false);
    }
  };
  
  const fetchCustomerInventory = async () => {
    try {
      const response = await api.get(`/systems/systems/${id}/customer_inventory/`);
      setCustomerInventory(response.data);
    } catch (error) {
      console.error('Error fetching customer inventory:', error);
    }
  };
  
  const fetchProductCategories = async () => {
    try {
      const response = await api.get('/settings/product-categories/');
      setProductCategories(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching product categories:', error);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const response = await api.get('/inventory/inventory-items/?status=available&page_size=100');
      setInventoryItems(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/systems/systems/${id}/`, formData);
      setSaveMessage({ type: 'success', text: 'Änderungen gespeichert!' });
      setHasChanges(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving system:', error);
      setSaveMessage({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  };

  // Star name search
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

  const suggestStarName = async () => {
    try {
      const response = await api.get('/systems/systems/suggest_name/');
      handleInputChange('system_name', response.data.suggested_name);
    } catch (error) {
      console.error('Error suggesting name:', error);
    }
  };

  // Component handlers
  const openComponentModal = (component = null) => {
    setEditingComponent(component || {
      component_type: 'custom',
      inventory_item: '',
      name: '',
      description: '',
      manufacturer: '',
      serial_number: '',
      version: '',
      category: 'microscope'
    });
    setShowComponentModal(true);
    if (inventoryItems.length === 0) {
      fetchInventoryItems();
    }
    // Fetch customer-specific inventory
    if (customerInventory.length === 0) {
      fetchCustomerInventory();
    }
    // Fetch product categories
    if (productCategories.length === 0) {
      fetchProductCategories();
    }
  };

  const saveComponent = async () => {
    try {
      const componentData = { ...editingComponent, system: id };
      
      if (editingComponent.id) {
        await api.patch(`/systems/components/${editingComponent.id}/`, componentData);
      } else {
        await api.post('/systems/components/', componentData);
      }
      
      fetchSystem();
      setShowComponentModal(false);
      setEditingComponent(null);
    } catch (error) {
      console.error('Error saving component:', error);
      alert('Fehler beim Speichern der Komponente');
    }
  };

  const deleteComponent = async (componentId) => {
    if (!window.confirm('Komponente wirklich löschen?')) return;
    try {
      await api.delete(`/systems/components/${componentId}/`);
      fetchSystem();
    } catch (error) {
      console.error('Error deleting component:', error);
    }
  };

  // Photo handlers
  const handlePhotoUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhoto(true);
    try {
      for (let file of files) {
        const formData = new FormData();
        formData.append('system', id);
        formData.append('image', file);
        formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
        
        await api.post('/systems/photos/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      fetchSystem();
    } catch (error) {
      console.error('Error uploading photos:', error);
      alert('Fehler beim Hochladen der Fotos');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const deletePhoto = async (photoId) => {
    if (!window.confirm('Foto wirklich löschen?')) return;
    try {
      await api.delete(`/systems/photos/${photoId}/`);
      fetchSystem();
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  };

  const setPrimaryPhoto = async (photoId) => {
    try {
      // First, unset all other primary photos
      for (let photo of photos) {
        if (photo.is_primary && photo.id !== photoId) {
          await api.patch(`/systems/photos/${photo.id}/`, { is_primary: false });
        }
      }
      await api.patch(`/systems/photos/${photoId}/`, { is_primary: true });
      fetchSystem();
    } catch (error) {
      console.error('Error setting primary photo:', error);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">System nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sales/systems')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <ComputerDesktopIcon className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold">{system.system_number}</h1>
              <span className={`px-2 py-1 text-sm rounded-full ${getStatusColor(system.status)}`}>
                {system.status_display || system.status}
              </span>
            </div>
            <p className="text-gray-600 mt-1">{system.system_name} - {system.customer_name}</p>
          </div>
        </div>
        
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <CheckIcon className="h-5 w-5" />
            {saving ? 'Speichern...' : 'Änderungen speichern'}
          </button>
        )}
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`mb-4 p-3 rounded-lg ${
          saveMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {saveMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.name}
                {tab.id === 'components' && components.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                    {components.length}
                  </span>
                )}
                {tab.id === 'photos' && photos.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                    {photos.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Systemnummer
              </label>
              <input
                type="text"
                value={system.system_number}
                disabled
                className="w-full px-3 py-2 border rounded-lg bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Systemname (IAU Sternname)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.system_name}
                  onChange={(e) => handleInputChange('system_name', e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={suggestStarName}
                  className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
                  title="Sternname vorschlagen"
                >
                  <SparklesIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kunde
              </label>
              {selectedCustomer ? (
                <div className="flex items-center gap-2 p-3 bg-gray-50 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {selectedCustomer.full_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`}
                    </div>
                    <div className="text-sm text-gray-600">{selectedCustomer.customer_number}</div>
                  </div>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-200"
                    title="Kunde entfernen"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchCustomers()}
                      placeholder="Kundenname oder -nummer suchen..."
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={searchCustomers}
                      disabled={searchingCustomers}
                      className="px-4 py-2 border rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      {searchingCustomers ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                      ) : (
                        'Suchen'
                      )}
                    </button>
                  </div>

                  {customers.length > 0 && (
                    <div className="mt-2 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {customers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => selectCustomer(c)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">
                            {c.full_name || `${c.first_name || ''} ${c.last_name || ''}`}
                          </div>
                          <div className="text-sm text-gray-600">{c.customer_number}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                VisiView Lizenz
              </label>
              {selectedLicense ? (
                <div className="flex items-center gap-2 p-3 bg-gray-50 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {selectedLicense.license_number}
                    </div>
                    <div className="text-sm text-gray-600">
                      Dongle: {selectedLicense.serial_number}
                      {selectedLicense.version && ` • Version: ${selectedLicense.version}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearLicense}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-200"
                    title="Lizenz entfernen"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={licenseSearch}
                      onChange={(e) => setLicenseSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchLicenses()}
                      placeholder="Lizenznummer oder Dongle-Seriennummer suchen..."
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={searchLicenses}
                      disabled={searchingLicenses}
                      className="px-4 py-2 border rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      {searchingLicenses ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                      ) : (
                        'Suchen'
                      )}
                    </button>
                  </div>

                  {licenses.length > 0 && (
                    <div className="mt-2 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {licenses.map((lic) => (
                        <div
                          key={lic.id}
                          onClick={() => selectLicense(lic)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{lic.license_number}</div>
                          <div className="text-sm text-gray-600">
                            Dongle: {lic.serial_number}
                            {lic.version && ` • Version: ${lic.version}`}
                            {lic.customer_name && (
                              <span className="ml-2 text-gray-500">
                                ({lic.customer_name})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Aktiv</option>
                <option value="inactive">Inaktiv</option>
                <option value="maintenance">In Wartung</option>
                <option value="decommissioned">Außer Betrieb</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Standort
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="z.B. Labor 301, Gebäude A"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Installationsdatum
              </label>
              <input
                type="date"
                value={formData.installation_date}
                onChange={(e) => handleInputChange('installation_date', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Garantie bis
              </label>
              <input
                type="date"
                value={formData.warranty_end}
                onChange={(e) => handleInputChange('warranty_end', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Beschreibung
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notizen
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Components Tab */}
        {activeTab === 'components' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Systemkomponenten</h3>
              <button
                onClick={() => openComponentModal()}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <PlusIcon className="h-5 w-5" />
                Komponente hinzufügen
              </button>
            </div>

            {components.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CubeIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Keine Komponenten vorhanden</p>
                <button
                  onClick={() => openComponentModal()}
                  className="mt-4 text-blue-600 hover:underline"
                >
                  Erste Komponente hinzufügen
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {components.map((component) => (
                  <div key={component.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            component.component_type === 'inventory' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {component.component_type === 'inventory' ? 'Warenlager' : 'Custom'}
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                            {component.category_display || component.category}
                          </span>
                        </div>
                        <h4 className="font-medium mt-2">{component.name}</h4>
                        {component.description && (
                          <p className="text-sm text-gray-600 mt-1">{component.description}</p>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-sm">
                          {component.manufacturer && (
                            <div>
                              <span className="text-gray-500">Hersteller:</span>{' '}
                              <span>{component.manufacturer}</span>
                            </div>
                          )}
                          {component.serial_number && (
                            <div>
                              <span className="text-gray-500">Seriennr.:</span>{' '}
                              <span className="font-mono">{component.serial_number}</span>
                            </div>
                          )}
                          {component.version && (
                            <div>
                              <span className="text-gray-500">Version:</span>{' '}
                              <span>{component.version}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openComponentModal(component)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => deleteComponent(component.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Systemfotos</h3>
              <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer">
                <PlusIcon className="h-5 w-5" />
                {uploadingPhoto ? 'Hochladen...' : 'Fotos hochladen'}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploadingPhoto}
                />
              </label>
            </div>

            {photos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <PhotoIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Keine Fotos vorhanden</p>
                <label className="mt-4 text-blue-600 hover:underline cursor-pointer">
                  Erstes Foto hochladen
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {photos.map((photo, index) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.image}
                      alt={photo.title}
                      className="w-full h-48 object-cover rounded-lg cursor-pointer"
                      onClick={() => {
                        setCurrentPhotoIndex(index);
                        setPhotoCarouselOpen(true);
                      }}
                    />
                    {photo.is_primary && (
                      <span className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                        Hauptbild
                      </span>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => {
                          setCurrentPhotoIndex(index);
                          setPhotoCarouselOpen(true);
                        }}
                        className="p-2 bg-white rounded-full mx-1"
                        title="Vergrößern"
                      >
                        <ArrowsPointingOutIcon className="h-5 w-5" />
                      </button>
                      {!photo.is_primary && (
                        <button
                          onClick={() => setPrimaryPhoto(photo.id)}
                          className="p-2 bg-white rounded-full mx-1"
                          title="Als Hauptbild setzen"
                        >
                          <CheckIcon className="h-5 w-5 text-blue-600" />
                        </button>
                      )}
                      <button
                        onClick={() => deletePhoto(photo.id)}
                        className="p-2 bg-white rounded-full mx-1"
                        title="Löschen"
                      >
                        <TrashIcon className="h-5 w-5 text-red-600" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 truncate">{photo.title}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projekte Tab */}
        {activeTab === 'projects' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium">Verknüpfte Projekte</h3>
              <button
                onClick={() => navigate(`/sales/projects/new?customer=${formData.customer}&system=${id}`)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <PlusIcon className="h-5 w-5" />
                Neues Projekt
              </button>
            </div>
            
            {projectsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : projects.length > 0 ? (
              <div className="space-y-2">
                {projects.map(project => (
                  <div
                    key={project.id}
                    onClick={() => navigate(`/sales/projects/${project.id}`)}
                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <span className="font-mono text-blue-600">{project.project_number}</span>
                      <span className="ml-2 font-medium">{project.name}</span>
                      {project.description && (
                        <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        project.status === 'completed' ? 'bg-green-100 text-green-700' :
                        project.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {project.status}
                      </span>
                      <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FolderIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Keine Projekte mit diesem System verknüpft</p>
              </div>
            )}
          </div>
        )}

        {/* Aufträge Tab */}
        {activeTab === 'orders' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium">Kundenaufträge</h3>
            </div>
            
            {ordersLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : customerOrders.length > 0 ? (
              <div className="space-y-2">
                {customerOrders.map(order => (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/sales/order-processing/${order.id}`)}
                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <span className="font-mono text-green-600">{order.order_number}</span>
                      {order.order_date && (
                        <span className="ml-2 text-sm text-gray-500">
                          {new Date(order.order_date).toLocaleDateString('de-DE')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {order.total && (
                        <span className="text-sm font-medium">
                          {parseFloat(order.total).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        order.status === 'completed' || order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                        order.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {order.status}
                      </span>
                      <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCartIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Keine Aufträge mit diesem System verknüpft</p>
              </div>
            )}
          </div>
        )}

        {/* Service Tab */}
        {activeTab === 'service' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium">Service & RMA</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/service/tickets/new?customer=${formData.customer}&system=${id}`)}
                  className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700"
                >
                  <PlusIcon className="h-5 w-5" />
                  Neues Ticket
                </button>
                <button
                  onClick={() => navigate(`/service/rma/new?customer=${formData.customer}&system=${id}`)}
                  className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                >
                  <PlusIcon className="h-5 w-5" />
                  Neuer RMA-Fall
                </button>
              </div>
            </div>
            
            {serviceLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Service Tickets */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-orange-50 px-4 py-3 flex items-center gap-2">
                    <TicketIcon className="h-5 w-5 text-orange-600" />
                    <h4 className="font-medium text-orange-800">Service-Tickets ({serviceTickets.length})</h4>
                  </div>
                  {serviceTickets.length > 0 ? (
                    <div className="divide-y">
                      {serviceTickets.map(ticket => (
                        <div
                          key={ticket.id}
                          onClick={() => navigate(`/service/tickets/${ticket.id}`)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <span className="font-mono text-orange-600">{ticket.ticket_number}</span>
                            <span className="ml-2">{ticket.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              ticket.priority === 'high' || ticket.priority === 'urgent' 
                                ? 'bg-red-100 text-red-700' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {ticket.priority}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              ticket.status === 'closed' || ticket.status === 'resolved'
                                ? 'bg-green-100 text-green-700'
                                : ticket.status === 'open' || ticket.status === 'new'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {ticket.status}
                            </span>
                            <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-gray-500">Keine Service-Tickets</p>
                  )}
                </div>

                {/* RMA Cases */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-purple-50 px-4 py-3 flex items-center gap-2">
                    <WrenchScrewdriverIcon className="h-5 w-5 text-purple-600" />
                    <h4 className="font-medium text-purple-800">RMA-Fälle ({rmaCases.length})</h4>
                  </div>
                  {rmaCases.length > 0 ? (
                    <div className="divide-y">
                      {rmaCases.map(rma => (
                        <div
                          key={rma.id}
                          onClick={() => navigate(`/service/rma/${rma.id}`)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <span className="font-mono text-purple-600">{rma.rma_number}</span>
                            <span className="ml-2">{rma.description || rma.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              rma.status === 'completed' || rma.status === 'closed'
                                ? 'bg-green-100 text-green-700'
                                : rma.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {rma.status}
                            </span>
                            <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-gray-500">Keine RMA-Fälle</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VisiView Tab */}
        {activeTab === 'visiview' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium">VisiView</h3>
              <div className="flex gap-2">
                {selectedLicense && (
                  <button
                    onClick={() => navigate(`/visiview/licenses/${selectedLicense.id}`)}
                    className="flex items-center gap-2 border border-blue-600 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50"
                  >
                    <KeyIcon className="h-5 w-5" />
                    Lizenz bearbeiten
                  </button>
                )}
                <button
                  onClick={() => navigate(`/visiview/tickets/new?customer=${formData.customer}&system=${id}${selectedLicense ? `&license=${selectedLicense.id}` : ''}`)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  <PlusIcon className="h-5 w-5" />
                  Neues VisiView Ticket
                </button>
              </div>
            </div>
            
            {/* Verknüpfte Lizenz Info */}
            {selectedLicense && (
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <KeyIcon className="h-6 w-6 text-indigo-600" />
                    <div>
                      <div className="font-medium text-indigo-900">Verknüpfte Lizenz: {selectedLicense.license_number}</div>
                      <div className="text-sm text-indigo-700">
                        Dongle: {selectedLicense.serial_number}
                        {selectedLicense.version && ` • Version: ${selectedLicense.version}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/visiview/licenses/${selectedLicense.id}`)}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
            
            {visiviewLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-indigo-50 px-4 py-3 flex items-center gap-2">
                  <TicketIcon className="h-5 w-5 text-indigo-600" />
                  <h4 className="font-medium text-indigo-800">VisiView Tickets ({visiviewTickets.length})</h4>
                </div>
                {visiviewTickets.length > 0 ? (
                  <div className="divide-y">
                    {visiviewTickets.map(ticket => (
                      <div
                        key={ticket.id}
                        onClick={() => navigate(`/visiview/tickets/${ticket.id}`)}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <span className="font-mono text-indigo-600">{ticket.ticket_number}</span>
                          <span className="ml-2">{ticket.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            ticket.ticket_type === 'bug' ? 'bg-red-100 text-red-700' :
                            ticket.ticket_type === 'feature' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {ticket.ticket_type}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            ticket.status === 'closed' || ticket.status === 'resolved'
                              ? 'bg-green-100 text-green-700'
                              : ticket.status === 'open' || ticket.status === 'new'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {ticket.status}
                          </span>
                          <ArrowTopRightOnSquareIcon className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <TicketIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>Keine VisiView Tickets</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Component Modal */}
      {showComponentModal && editingComponent && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black opacity-50" onClick={() => setShowComponentModal(false)}></div>
            
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {editingComponent.id ? 'Komponente bearbeiten' : 'Neue Komponente'}
                </h2>
                <button onClick={() => setShowComponentModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
                  <select
                    value={editingComponent.component_type}
                    onChange={(e) => setEditingComponent(prev => ({ 
                      ...prev, 
                      component_type: e.target.value,
                      inventory_item: e.target.value === 'inventory' ? prev.inventory_item : ''
                    }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="custom">Custom / Manuell</option>
                    <option value="inventory">Aus Warenlager</option>
                  </select>
                </div>

                {editingComponent.component_type === 'inventory' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Artikel aus Warenlager des Kunden
                    </label>
                    {customerInventory.length > 0 ? (
                      <select
                        value={editingComponent.inventory_item || ''}
                        onChange={(e) => {
                          const item = customerInventory.find(i => i.id === parseInt(e.target.value));
                          setEditingComponent(prev => ({
                            ...prev,
                            inventory_item: e.target.value,
                            name: item?.name || prev.name,
                            description: item?.description || prev.description,
                            manufacturer: item?.manufacturer || prev.manufacturer,
                            serial_number: item?.serial_number || prev.serial_number,
                            category: item?.product_category || prev.category
                          }));
                        }}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">Artikel auswählen...</option>
                        {customerInventory.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.inventory_number} - {item.name} {item.serial_number && `(SN: ${item.serial_number})`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-500 py-2">
                        Keine Warenlager-Artikel für diesen Kunden verfügbar.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warenkategorie</label>
                  <select
                    value={editingComponent.category}
                    onChange={(e) => setEditingComponent(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {productCategories.length > 0 ? (
                      productCategories.map(cat => (
                        <option key={cat.id} value={cat.code}>
                          {cat.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="MIKROSKOP">Mikroskop</option>
                        <option value="KAMERA">Kamera</option>
                        <option value="LASER">Laser</option>
                        <option value="FILTER">Filter</option>
                        <option value="FILTERRAD">Filterrad</option>
                        <option value="OBJECTIVE">Objektiv</option>
                        <option value="SCANNINGTISCH">Scanningtisch</option>
                        <option value="INKUBATION">Inkubation</option>
                        <option value="LED">LED</option>
                        <option value="CONFOCAL">Confocal</option>
                        <option value="VIRTEX">ViRTEx</option>
                        <option value="FRAP">FRAP</option>
                        <option value="ORBITAL">Orbital</option>
                        <option value="VISIVIEW">VisiView</option>
                        <option value="PC">PC</option>
                        <option value="SOFTWARE">Software</option>
                        <option value="SONSTIGES">Sonstiges</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name/Modell *</label>
                  <input
                    type="text"
                    value={editingComponent.name}
                    onChange={(e) => setEditingComponent(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                  <textarea
                    value={editingComponent.description}
                    onChange={(e) => setEditingComponent(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hersteller</label>
                    <input
                      type="text"
                      value={editingComponent.manufacturer}
                      onChange={(e) => setEditingComponent(prev => ({ ...prev, manufacturer: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Seriennummer</label>
                    <input
                      type="text"
                      value={editingComponent.serial_number}
                      onChange={(e) => setEditingComponent(prev => ({ ...prev, serial_number: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Version / Treiber</label>
                  <input
                    type="text"
                    value={editingComponent.version}
                    onChange={(e) => setEditingComponent(prev => ({ ...prev, version: e.target.value }))}
                    placeholder="z.B. FW 2.1, Driver 3.4.5"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowComponentModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={saveComponent}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Carousel Modal */}
      {photoCarouselOpen && photos.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
          <button
            onClick={() => setPhotoCarouselOpen(false)}
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/20 rounded-full"
          >
            <XMarkIcon className="h-8 w-8" />
          </button>
          
          <button
            onClick={() => setCurrentPhotoIndex(i => (i - 1 + photos.length) % photos.length)}
            className="absolute left-4 text-white p-2 hover:bg-white/20 rounded-full"
          >
            <ChevronLeftIcon className="h-8 w-8" />
          </button>
          
          <img
            src={photos[currentPhotoIndex].image}
            alt={photos[currentPhotoIndex].title}
            className="max-h-[80vh] max-w-[80vw] object-contain"
          />
          
          <button
            onClick={() => setCurrentPhotoIndex(i => (i + 1) % photos.length)}
            className="absolute right-4 text-white p-2 hover:bg-white/20 rounded-full"
          >
            <ChevronRightIcon className="h-8 w-8" />
          </button>
          
          <div className="absolute bottom-4 text-white text-center">
            <p className="text-lg">{photos[currentPhotoIndex].title}</p>
            <p className="text-sm text-gray-300">
              {currentPhotoIndex + 1} / {photos.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemEdit;
