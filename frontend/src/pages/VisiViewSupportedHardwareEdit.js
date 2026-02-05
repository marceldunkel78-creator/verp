import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TrashIcon,
  PlusIcon,
  PencilIcon,
  DocumentTextIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const CATEGORIES = [
  'Camera',
  'Microscope',
  'Hardware Autofocus',
  'Light source',
  'Controller',
  'Filterwheel',
  'Component',
  'Computer hardware',
  'Accessory',
  'Illumination',
  'Image Splitter',
  'Shutter',
  'Spinning Disk',
  'xy-stage',
  'z-drive',
  'Peripherals'
];

const SUPPORT_LEVELS = [
  'Official Support',
  'Tested by Visitron',
  'Untested, driver provided by manufacturer',
  'Basic Support',
  'Experimental',
  'Third-party driver',
  'Discontinued'
];

const DATA_QUALITY_OPTIONS = [
  'Complete',
  'Verified',
  'Incomplete',
  'Needs review'
];

const VisiViewSupportedHardwareEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === 'new';
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  
  const canWrite = user?.is_superuser || user?.is_staff || user?.can_write_visiview_supported_hardware || user?.can_write_visiview;

  const [formData, setFormData] = useState({
    category: 'Camera',
    manufacturer: '',
    device: '',
    driver_name: '',
    driver_version: '',
    visiview_version: '',
    limitations: '',
    comment: '',
    required_visiview_option: '',
    support_level: 'Official Support',
    service_status: '',
    data_quality: 'Incomplete',
    author: '',
    actualization_date: '',
    // Camera-specific
    dual_cam: false,
    device_streaming: false,
    virtex: false,
    splitview: false,
    // Microscope-specific
    xy_support: false,
    z_support: false,
    objective_support: false,
    beam_path_support: false,
    light_support: false,
    // Light source-specific
    ttl_shutter: false,
    sw_shutter: false,
    analog_intensity: false,
    sw_intensity: false
  });

  // Use Cases State
  const [useCases, setUseCases] = useState([]);
  const [showUseCaseModal, setShowUseCaseModal] = useState(false);
  const [editingUseCase, setEditingUseCase] = useState(null);
  const [useCaseSaving, setUseCaseSaving] = useState(false);
  
  // Customer/License/System search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [licenseSearch, setLicenseSearch] = useState('');
  const [licenseResults, setLicenseResults] = useState([]);
  const [systemSearch, setSystemSearch] = useState('');
  const [systemResults, setSystemResults] = useState([]);

  const fetchHardware = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const response = await api.get(`/visiview/supported-hardware/${id}/`);
      const data = response.data;
      setFormData({
        category: data.category || 'Camera',
        manufacturer: data.manufacturer || '',
        device: data.device || '',
        driver_name: data.driver_name || '',
        driver_version: data.driver_version || '',
        visiview_version: data.visiview_version || '',
        limitations: data.limitations || '',
        comment: data.comment || '',
        required_visiview_option: data.required_visiview_option || '',
        support_level: data.support_level || 'Official Support',
        service_status: data.service_status || '',
        data_quality: data.data_quality || 'Incomplete',
        author: data.author || '',
        actualization_date: data.actualization_date || '',
        dual_cam: data.dual_cam || false,
        device_streaming: data.device_streaming || false,
        virtex: data.virtex || false,
        splitview: data.splitview || false,
        xy_support: data.xy_support || false,
        z_support: data.z_support || false,
        objective_support: data.objective_support || false,
        beam_path_support: data.beam_path_support || false,
        light_support: data.light_support || false,
        ttl_shutter: data.ttl_shutter || false,
        sw_shutter: data.sw_shutter || false,
        analog_intensity: data.analog_intensity || false,
        sw_intensity: data.sw_intensity || false
      });
    } catch (error) {
      console.error('Error fetching hardware:', error);
      alert('Fehler beim Laden der Hardware-Daten');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  const fetchUseCases = useCallback(async () => {
    if (isNew) return;
    try {
      const response = await api.get(`/visiview/hardware-use-cases/?hardware=${id}`);
      setUseCases(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching use cases:', error);
    }
  }, [id, isNew]);

  useEffect(() => {
    fetchHardware();
    fetchUseCases();
  }, [fetchHardware, fetchUseCases]);

  // Search handlers
  const searchCustomers = async (term) => {
    if (term.length < 2) {
      setCustomerResults([]);
      return;
    }
    try {
      const response = await api.get(`/customers/?search=${term}&page_size=10`);
      setCustomerResults(response.data.results || response.data);
    } catch (error) {
      console.error('Error searching customers:', error);
    }
  };

  const searchLicenses = async (term) => {
    if (term.length < 2) {
      setLicenseResults([]);
      return;
    }
    try {
      const response = await api.get(`/visiview/licenses/?search=${term}&page_size=10`);
      setLicenseResults(response.data.results || response.data);
    } catch (error) {
      console.error('Error searching licenses:', error);
    }
  };

  const searchSystems = async (term) => {
    if (term.length < 2) {
      setSystemResults([]);
      return;
    }
    try {
      const response = await api.get(`/systems/systems/?search=${term}&page_size=10`);
      setSystemResults(response.data.results || response.data);
    } catch (error) {
      console.error('Error searching systems:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!formData.manufacturer || !formData.device) {
      setSaveMessage({ type: 'error', text: 'Hersteller und Gerät sind Pflichtfelder' });
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        ...formData,
        actualization_date: formData.actualization_date || null
      };
      
      if (isNew) {
        const response = await api.post('/visiview/supported-hardware/', payload);
        setSaveMessage({ type: 'success', text: 'Hardware erfolgreich erstellt!' });
        setHasChanges(false);
        setTimeout(() => {
          navigate(`/visiview/supported-hardware/${response.data.id}`);
        }, 1000);
      } else {
        await api.patch(`/visiview/supported-hardware/${id}/`, payload);
        setSaveMessage({ type: 'success', text: 'Änderungen gespeichert!' });
        setHasChanges(false);
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error saving:', error);
      const detail = error.response?.data?.detail || 
                     Object.values(error.response?.data || {}).flat().join(', ') ||
                     error.message;
      setSaveMessage({ type: 'error', text: 'Fehler beim Speichern: ' + detail });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Möchten Sie "${formData.manufacturer} ${formData.device}" wirklich löschen?\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    
    try {
      await api.delete(`/visiview/supported-hardware/${id}/`);
      alert('Hardware erfolgreich gelöscht');
      navigate('/visiview/supported-hardware');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen: ' + (error.response?.data?.detail || error.message));
    }
  };

  // Use Case handlers
  const openUseCaseModal = (useCase = null) => {
    if (useCase) {
      setEditingUseCase({
        ...useCase,
        date: useCase.date || new Date().toISOString().split('T')[0]
      });
      setCustomerSearch(useCase.customer_name || '');
      setLicenseSearch(useCase.license_serial_number || '');
      setSystemSearch(useCase.system_number || '');
    } else {
      setEditingUseCase({
        hardware: parseInt(id),
        date: new Date().toISOString().split('T')[0],
        customer: null,
        license: null,
        system: null,
        visiview_version: '',
        driver_version: '',
        device_firmware: '',
        comment: ''
      });
      setCustomerSearch('');
      setLicenseSearch('');
      setSystemSearch('');
    }
    setCustomerResults([]);
    setLicenseResults([]);
    setSystemResults([]);
    setShowUseCaseModal(true);
  };

  const closeUseCaseModal = () => {
    setShowUseCaseModal(false);
    setEditingUseCase(null);
    setCustomerSearch('');
    setLicenseSearch('');
    setSystemSearch('');
    setCustomerResults([]);
    setLicenseResults([]);
    setSystemResults([]);
  };

  const handleUseCaseChange = (field, value) => {
    setEditingUseCase(prev => ({ ...prev, [field]: value }));
  };

  const saveUseCase = async () => {
    if (!editingUseCase) return;
    
    setUseCaseSaving(true);
    try {
      const payload = {
        hardware: parseInt(id),
        date: editingUseCase.date || null,
        customer: editingUseCase.customer || null,
        license: editingUseCase.license || null,
        system: editingUseCase.system || null,
        visiview_version: editingUseCase.visiview_version || '',
        driver_version: editingUseCase.driver_version || '',
        device_firmware: editingUseCase.device_firmware || '',
        comment: editingUseCase.comment || ''
      };

      if (editingUseCase.id) {
        await api.patch(`/visiview/hardware-use-cases/${editingUseCase.id}/`, payload);
      } else {
        await api.post('/visiview/hardware-use-cases/', payload);
      }
      
      await fetchUseCases();
      closeUseCaseModal();
    } catch (error) {
      console.error('Error saving use case:', error);
      const detail = error.response?.data?.detail || 
                     Object.values(error.response?.data || {}).flat().join(', ') ||
                     error.message;
      alert('Fehler beim Speichern: ' + detail);
    } finally {
      setUseCaseSaving(false);
    }
  };

  const deleteUseCase = async (useCaseId) => {
    if (!window.confirm('Möchten Sie diesen Use Case wirklich löschen?')) return;
    
    try {
      await api.delete(`/visiview/hardware-use-cases/${useCaseId}/`);
      await fetchUseCases();
    } catch (error) {
      console.error('Error deleting use case:', error);
      alert('Fehler beim Löschen: ' + (error.response?.data?.detail || error.message));
    }
  };

  const getCategorySpecificFields = () => {
    switch (formData.category) {
      case 'Camera':
        return (
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-3">Kamera-Eigenschaften</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.dual_cam}
                  onChange={(e) => handleInputChange('dual_cam', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Dual Cam</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.device_streaming}
                  onChange={(e) => handleInputChange('device_streaming', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Device Streaming</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.virtex}
                  onChange={(e) => handleInputChange('virtex', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Virtex</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.splitview}
                  onChange={(e) => handleInputChange('splitview', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Splitview</span>
              </label>
            </div>
          </div>
        );
      case 'Microscope':
        return (
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-3">Mikroskop-Eigenschaften</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.xy_support}
                  onChange={(e) => handleInputChange('xy_support', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span>XY Support</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.z_support}
                  onChange={(e) => handleInputChange('z_support', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Z Support</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.objective_support}
                  onChange={(e) => handleInputChange('objective_support', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Objective</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.beam_path_support}
                  onChange={(e) => handleInputChange('beam_path_support', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Beam path</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.light_support}
                  onChange={(e) => handleInputChange('light_support', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Light</span>
              </label>
            </div>
          </div>
        );
      case 'Light source':
        return (
          <div className="bg-yellow-50 rounded-lg p-4">
            <h4 className="font-medium text-yellow-900 mb-3">Lichtquellen-Eigenschaften</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.ttl_shutter}
                  onChange={(e) => handleInputChange('ttl_shutter', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                />
                <span>TTL Shutter</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.sw_shutter}
                  onChange={(e) => handleInputChange('sw_shutter', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                />
                <span>SW Shutter</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.analog_intensity}
                  onChange={(e) => handleInputChange('analog_intensity', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                />
                <span>Analog Intensity</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.sw_intensity}
                  onChange={(e) => handleInputChange('sw_intensity', e.target.checked)}
                  disabled={!canWrite}
                  className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                />
                <span>SW Intensity</span>
              </label>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/visiview/supported-hardware')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-1" />
          Zurück zur Übersicht
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? 'Neue Hardware hinzufügen' : `${formData.manufacturer} ${formData.device}`}
            </h1>
            <p className="text-gray-500 text-sm">{formData.category}</p>
          </div>
          
          <div className="flex items-center gap-3">
            {!isNew && canWrite && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 px-3 py-2 border border-red-300 rounded-lg hover:bg-red-50"
              >
                <TrashIcon className="h-5 w-5" />
                Löschen
              </button>
            )}
            {canWrite && (
              <button
                onClick={handleSave}
                disabled={saving || (!isNew && !hasChanges)}
                className={`px-6 py-2 rounded-lg font-medium ${
                  saving || (!isNew && !hasChanges)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {saving ? 'Speichern...' : isNew ? 'Erstellen' : 'Speichern'}
              </button>
            )}
          </div>
        </div>
        
        {/* Save Message */}
        {saveMessage && (
          <div className={`mt-4 flex items-center gap-2 px-4 py-2 rounded-lg ${
            saveMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {saveMessage.type === 'success' ? (
              <CheckCircleIcon className="h-5 w-5" />
            ) : (
              <ExclamationCircleIcon className="h-5 w-5" />
            )}
            {saveMessage.text}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <InformationCircleIcon className="h-5 w-5 text-gray-400" />
            Basisinformationen
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategorie *
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Support Level
              </label>
              <select
                value={formData.support_level}
                onChange={(e) => handleInputChange('support_level', e.target.value)}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">-- Auswählen --</option>
                {SUPPORT_LEVELS.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hersteller *
              </label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="z.B. Hamamatsu"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gerät *
              </label>
              <input
                type="text"
                value={formData.device}
                onChange={(e) => handleInputChange('device', e.target.value)}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="z.B. ORCA-Flash4.0 V3"
              />
            </div>
          </div>
        </div>

        {/* Driver Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <CpuChipIcon className="h-5 w-5 text-gray-400" />
            Treiber-Informationen
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Treiber Name
              </label>
              <input
                type="text"
                value={formData.driver_name}
                onChange={(e) => handleInputChange('driver_name', e.target.value)}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Treiber Version
              </label>
              <input
                type="text"
                value={formData.driver_version}
                onChange={(e) => handleInputChange('driver_version', e.target.value)}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                VisiView Version
              </label>
              <input
                type="text"
                value={formData.visiview_version}
                onChange={(e) => handleInputChange('visiview_version', e.target.value)}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="z.B. 5.0.0.0"
              />
            </div>
            
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Benötigte VisiView Option
              </label>
              <input
                type="text"
                value={formData.required_visiview_option}
                onChange={(e) => handleInputChange('required_visiview_option', e.target.value)}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Category-Specific Fields */}
        {getCategorySpecificFields()}

        {/* Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Details</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Einschränkungen
              </label>
              <textarea
                value={formData.limitations}
                onChange={(e) => handleInputChange('limitations', e.target.value)}
                disabled={!canWrite}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="Bekannte Einschränkungen..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kommentar
              </label>
              <textarea
                value={formData.comment}
                onChange={(e) => handleInputChange('comment', e.target.value)}
                disabled={!canWrite}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="Zusätzliche Hinweise..."
              />
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Metadaten</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Status (Hersteller)
              </label>
              <input
                type="text"
                value={formData.service_status}
                onChange={(e) => handleInputChange('service_status', e.target.value)}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datenqualität
              </label>
              <select
                value={formData.data_quality}
                onChange={(e) => handleInputChange('data_quality', e.target.value)}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">-- Auswählen --</option>
                {DATA_QUALITY_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Autor
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => handleInputChange('author', e.target.value)}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Aktualisierungsdatum
              </label>
              <input
                type="date"
                value={formData.actualization_date}
                onChange={(e) => handleInputChange('actualization_date', e.target.value)}
                disabled={!canWrite}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Use Cases Section - only show for existing hardware */}
        {!isNew && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-purple-600" />
                Use Cases ({useCases.length})
              </h3>
              {canWrite && (
                <button
                  onClick={() => openUseCaseModal()}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  <PlusIcon className="h-4 w-4" />
                  Use Case hinzufügen
                </button>
              )}
            </div>

            {useCases.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Noch keine Use Cases dokumentiert</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunde</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">VisiView Lizenz</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">System</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">VV Version</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eingetragen von</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kommentar</th>
                      {canWrite && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aktionen</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {useCases.map(uc => (
                      <tr key={uc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {uc.date ? new Date(uc.date).toLocaleDateString('de-DE') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {uc.customer ? (
                            <Link 
                              to={`/customers/${uc.customer}`}
                              className="text-blue-600 hover:underline"
                            >
                              {uc.customer_name}
                            </Link>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {uc.license ? (
                            <Link 
                              to={`/visiview/licenses/${uc.license}`}
                              className="text-blue-600 hover:underline"
                            >
                              {uc.license_serial_number}
                            </Link>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {uc.system ? (
                            <Link 
                              to={`/systems/${uc.system}`}
                              className="text-blue-600 hover:underline"
                            >
                              {uc.system_number}
                            </Link>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {uc.visiview_version || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {uc.created_by_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={uc.comment}>
                          {uc.comment || '-'}
                        </td>
                        {canWrite && (
                          <td className="px-4 py-3 text-sm whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openUseCaseModal(uc)}
                                className="text-gray-400 hover:text-blue-600"
                                title="Bearbeiten"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteUseCase(uc.id)}
                                className="text-gray-400 hover:text-red-600"
                                title="Löschen"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Use Case Modal */}
        {showUseCaseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-medium">
                  {editingUseCase?.id ? 'Use Case bearbeiten' : 'Neuer Use Case'}
                </h3>
                <button onClick={closeUseCaseModal} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                  <input
                    type="date"
                    value={editingUseCase?.date || ''}
                    onChange={(e) => handleUseCaseChange('date', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Customer Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kunde</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        searchCustomers(e.target.value);
                      }}
                      placeholder="Kunde suchen..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    {customerResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {customerResults.map(customer => (
                          <button
                            key={customer.id}
                            onClick={() => {
                              handleUseCaseChange('customer', customer.id);
                              setCustomerSearch(customer.name || `${customer.first_name} ${customer.last_name}`);
                              setCustomerResults([]);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                          >
                            {customer.name || `${customer.first_name} ${customer.last_name}`}
                            {customer.city && <span className="text-gray-400 ml-2">({customer.city})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {editingUseCase?.customer && (
                      <button
                        onClick={() => {
                          handleUseCaseChange('customer', null);
                          setCustomerSearch('');
                        }}
                        className="absolute right-2 top-2 text-gray-400 hover:text-red-600"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* License Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VisiView Lizenz</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={licenseSearch}
                      onChange={(e) => {
                        setLicenseSearch(e.target.value);
                        searchLicenses(e.target.value);
                      }}
                      placeholder="Seriennummer suchen..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    {licenseResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {licenseResults.map(license => (
                          <button
                            key={license.id}
                            onClick={() => {
                              handleUseCaseChange('license', license.id);
                              setLicenseSearch(license.serial_number || license.dongle_id);
                              setLicenseResults([]);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                          >
                            {license.serial_number || license.dongle_id}
                            {license.customer_name && <span className="text-gray-400 ml-2">({license.customer_name})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {editingUseCase?.license && (
                      <button
                        onClick={() => {
                          handleUseCaseChange('license', null);
                          setLicenseSearch('');
                        }}
                        className="absolute right-2 top-2 text-gray-400 hover:text-red-600"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* System Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">System</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={systemSearch}
                      onChange={(e) => {
                        setSystemSearch(e.target.value);
                        searchSystems(e.target.value);
                      }}
                      placeholder="System suchen..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    {systemResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {systemResults.map(system => (
                          <button
                            key={system.id}
                            onClick={() => {
                              handleUseCaseChange('system', system.id);
                              setSystemSearch(system.system_number || system.name);
                              setSystemResults([]);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                          >
                            {system.system_number || system.name}
                            {system.customer_name && <span className="text-gray-400 ml-2">({system.customer_name})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {editingUseCase?.system && (
                      <button
                        onClick={() => {
                          handleUseCaseChange('system', null);
                          setSystemSearch('');
                        }}
                        className="absolute right-2 top-2 text-gray-400 hover:text-red-600"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* VisiView Version */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VisiView Version</label>
                  <input
                    type="text"
                    value={editingUseCase?.visiview_version || ''}
                    onChange={(e) => handleUseCaseChange('visiview_version', e.target.value)}
                    placeholder="z.B. 5.0.0.0"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Driver Version */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treiber Version</label>
                  <input
                    type="text"
                    value={editingUseCase?.driver_version || ''}
                    onChange={(e) => handleUseCaseChange('driver_version', e.target.value)}
                    placeholder="z.B. 2.1.0"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Device Firmware */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Geräte Firmware</label>
                  <input
                    type="text"
                    value={editingUseCase?.device_firmware || ''}
                    onChange={(e) => handleUseCaseChange('device_firmware', e.target.value)}
                    placeholder="z.B. 1.5.2"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kommentar</label>
                  <textarea
                    value={editingUseCase?.comment || ''}
                    onChange={(e) => handleUseCaseChange('comment', e.target.value)}
                    rows={3}
                    placeholder="Zusätzliche Informationen..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
                <button
                  onClick={closeUseCaseModal}
                  className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-100"
                >
                  Abbrechen
                </button>
                <button
                  onClick={saveUseCase}
                  disabled={useCaseSaving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {useCaseSaving ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisiViewSupportedHardwareEdit;
