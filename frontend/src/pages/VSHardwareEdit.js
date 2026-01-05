import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  CurrencyEuroIcon,
  CubeIcon,
  DocumentIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentArrowDownIcon,
  CalculatorIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { id: 'basic', name: 'Basisinformationen', icon: InformationCircleIcon },
  { id: 'prices', name: 'Preise', icon: CurrencyEuroIcon },
  { id: 'materials', name: 'Material & Kalkulation', icon: CubeIcon },
  { id: 'documents', name: 'Fertigungspläne', icon: DocumentIcon }
];

const DOCUMENT_TYPES = [
  { value: 'drawing', label: 'Zeichnung (CAD)' },
  { value: 'assembly', label: 'Aufbauanleitung' },
  { value: 'adjustment', label: 'Justageanleitung' },
  { value: 'photo', label: 'Foto' },
  { value: 'test_report', label: 'Testbericht' },
  { value: 'other', label: 'Sonstiges' }
];

const VSHardwareEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('basic');
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Basic Info Form
  const [formData, setFormData] = useState({
    name: '',
    model_designation: '',
    description: '',
    product_category: null,
    unit: 'Stück',
    is_active: true
  });

  // Prices State
  const [prices, setPrices] = useState([]);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);

  // Materials & Calculations State
  const [materials, setMaterials] = useState([]);
  const [calculations, setCalculations] = useState([]);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialSupplies, setMaterialSupplies] = useState([]);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const [editingCalculation, setEditingCalculation] = useState(null);

  // Documents State
  const [documents, setDocuments] = useState([]);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  
  // Product Categories
  const [productCategories, setProductCategories] = useState([]);

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
    fetchProductCategories();
  }, [id]);

  const fetchProductCategories = async () => {
    try {
      const response = await api.get('/settings/product-categories/?is_active=true');
      setProductCategories(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching product categories:', error);
    }
  };

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/manufacturing/vs-hardware/${id}/`);
      const data = response.data;
      setProduct(data);
      setFormData({
        name: data.name || '',
        model_designation: data.model_designation || '',
        description: data.description || '',
        product_category: data.product_category || null,
        unit: data.unit || 'Stück',
        is_active: data.is_active !== false
      });
      setPrices(data.prices || []);
      setMaterials(data.material_items || []);
      setCalculations(data.cost_calculations || []);
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error fetching VS-Hardware:', error);
      alert('Fehler beim Laden des Produkts');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/manufacturing/vs-hardware/${id}/`, formData);
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

  const handleDelete = async () => {
    if (!window.confirm(`Möchten Sie dieses Produkt wirklich löschen?\n\n${product.name}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    
    try {
      await api.delete(`/manufacturing/vs-hardware/${id}/`);
      alert('Produkt erfolgreich gelöscht');
      navigate('/manufacturing/vs-hardware');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen des Produkts: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleManualUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append(field, file);

    try {
      await api.patch(`/manufacturing/vs-hardware/${id}/`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchProduct();
      setSaveMessage({ type: 'success', text: `${field === 'release_manual' ? 'Release-Manual' : 'Draft-Manual'} hochgeladen` });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error uploading manual:', error);
      alert('Fehler beim Hochladen');
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  // =====================
  // PRICES HANDLERS
  // =====================
  const openPriceModal = (price = null) => {
    setEditingPrice(price || {
      purchase_price: '',
      sales_price: '',
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: '',
      notes: ''
    });
    setShowPriceModal(true);
  };

  const savePrice = async () => {
    try {
      const payload = {
        ...editingPrice,
        vs_hardware: id,
        valid_until: editingPrice.valid_until || null
      };
      
      if (editingPrice.id) {
        await api.put(`/manufacturing/vs-hardware-prices/${editingPrice.id}/`, payload);
      } else {
        await api.post('/manufacturing/vs-hardware-prices/', payload);
      }
      setShowPriceModal(false);
      fetchProduct();
    } catch (error) {
      console.error('Error saving price:', error);
      alert('Fehler beim Speichern: ' + (error.response?.data?.valid_from || error.message));
    }
  };

  const deletePrice = async (priceId) => {
    if (!window.confirm('Preis wirklich löschen?')) return;
    try {
      await api.delete(`/manufacturing/vs-hardware-prices/${priceId}/`);
      fetchProduct();
    } catch (error) {
      console.error('Error deleting price:', error);
    }
  };

  // =====================
  // MATERIALS HANDLERS
  // =====================
  const fetchMaterialSupplies = async () => {
    try {
      const response = await api.get('/suppliers/material-supplies/?is_active=true&page_size=500');
      setMaterialSupplies(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching material supplies:', error);
    }
  };

  const openMaterialModal = (material = null) => {
    setEditingMaterial(material || {
      material_supply: '',
      quantity: 1,
      position: materials.length + 1,
      notes: ''
    });
    setShowMaterialModal(true);
    if (materialSupplies.length === 0) {
      fetchMaterialSupplies();
    }
  };

  const saveMaterial = async () => {
    try {
      const payload = {
        ...editingMaterial,
        vs_hardware: id
      };
      
      if (editingMaterial.id) {
        await api.put(`/manufacturing/vs-hardware-materials/${editingMaterial.id}/`, payload);
      } else {
        await api.post('/manufacturing/vs-hardware-materials/', payload);
      }
      setShowMaterialModal(false);
      fetchProduct();
    } catch (error) {
      console.error('Error saving material:', error);
      alert('Fehler beim Speichern');
    }
  };

  const deleteMaterial = async (materialId) => {
    if (!window.confirm('Material wirklich entfernen?')) return;
    try {
      await api.delete(`/manufacturing/vs-hardware-materials/${materialId}/`);
      fetchProduct();
    } catch (error) {
      console.error('Error deleting material:', error);
    }
  };

  // =====================
  // CALCULATIONS HANDLERS
  // =====================
  const openCalculationModal = (calc = null) => {
    setEditingCalculation(calc || {
      name: `Kalkulation ${new Date().toLocaleDateString('de-DE')}`,
      labor_hours: 0,
      labor_rate: 65,
      development_cost_total: 0,
      expected_sales_volume: 1,
      margin_percent: 30,
      is_active: true
    });
    setShowCalculationModal(true);
  };

  const saveCalculation = async () => {
    try {
      const payload = {
        ...editingCalculation,
        vs_hardware: id
      };
      
      if (editingCalculation.id) {
        await api.put(`/manufacturing/vs-hardware-calculations/${editingCalculation.id}/`, payload);
      } else {
        await api.post('/manufacturing/vs-hardware-calculations/', payload);
      }
      setShowCalculationModal(false);
      fetchProduct();
    } catch (error) {
      console.error('Error saving calculation:', error);
      alert('Fehler beim Speichern');
    }
  };

  const recalculateCalculation = async (calcId) => {
    try {
      await api.post(`/manufacturing/vs-hardware-calculations/${calcId}/recalculate/`);
      fetchProduct();
    } catch (error) {
      console.error('Error recalculating:', error);
    }
  };

  const transferPrice = async (calcId) => {
    const validFrom = prompt('Gültig ab (JJJJ-MM-TT):', new Date().toISOString().split('T')[0]);
    if (!validFrom) return;
    
    try {
      await api.post(`/manufacturing/vs-hardware-calculations/${calcId}/transfer_price/`, {
        valid_from: validFrom
      });
      fetchProduct();
      alert('Preise erfolgreich übertragen!');
    } catch (error) {
      console.error('Error transferring price:', error);
      alert('Fehler: ' + (error.response?.data?.error || error.message));
    }
  };

  const deleteCalculation = async (calcId) => {
    if (!window.confirm('Kalkulation wirklich löschen?')) return;
    try {
      await api.delete(`/manufacturing/vs-hardware-calculations/${calcId}/`);
      fetchProduct();
    } catch (error) {
      console.error('Error deleting calculation:', error);
    }
  };

  // =====================
  // DOCUMENTS HANDLERS
  // =====================
  const openDocumentModal = (doc = null) => {
    setEditingDocument(doc || {
      document_type: 'drawing',
      title: '',
      description: '',
      version: '',
      file: null
    });
    setShowDocumentModal(true);
  };

  const saveDocument = async () => {
    setUploadingDocument(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('vs_hardware', id);
      formDataUpload.append('document_type', editingDocument.document_type);
      formDataUpload.append('title', editingDocument.title);
      formDataUpload.append('description', editingDocument.description || '');
      formDataUpload.append('version', editingDocument.version || '');
      
      if (editingDocument.file) {
        formDataUpload.append('file', editingDocument.file);
      }
      
      if (editingDocument.id) {
        await api.patch(`/manufacturing/vs-hardware-documents/${editingDocument.id}/`, formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await api.post('/manufacturing/vs-hardware-documents/', formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      setShowDocumentModal(false);
      fetchProduct();
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Fehler beim Speichern');
    } finally {
      setUploadingDocument(false);
    }
  };

  const deleteDocument = async (docId) => {
    if (!window.confirm('Dokument wirklich löschen?')) return;
    try {
      await api.delete(`/manufacturing/vs-hardware-documents/${docId}/`);
      fetchProduct();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  // =====================
  // RENDER
  // =====================
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-gray-500">Laden...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Produkt nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/manufacturing/vs-hardware')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <div className="text-sm text-gray-500">VS-Hardware bearbeiten</div>
            <h1 className="text-2xl font-bold">
              <span className="font-mono text-blue-600">{product.part_number}</span>
              {' '}{product.name}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {saveMessage.text}
            </span>
          )}
          {id && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <TrashIcon className="h-5 w-5" />
              Löschen
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`px-4 py-2 rounded-lg ${
              hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="tab-scroll flex -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* ===================== BASIC INFO TAB ===================== */}
          {activeTab === 'basic' && (
            <div className="space-y-6 max-w-3xl">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produktname *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modellbezeichnung
                  </label>
                  <input
                    type="text"
                    value={formData.model_designation}
                    onChange={(e) => handleInputChange('model_designation', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Einheit
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => handleInputChange('unit', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warenkategorie
                  </label>
                  <select
                    value={formData.product_category || ''}
                    onChange={(e) => handleInputChange('product_category', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Wählen...</option>
                    {productCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => handleInputChange('is_active', e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700">Aktiv</span>
                  </label>
                </div>
              </div>

              {/* Manuals Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Handbücher</h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* Release Manual */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">Release-Manual</span>
                      <label className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm">
                        <ArrowUpTrayIcon className="h-5 w-5 inline mr-1" />
                        Hochladen
                        <input
                          type="file"
                          onChange={(e) => handleManualUpload(e, 'release_manual')}
                          className="hidden"
                          accept=".pdf,.doc,.docx"
                        />
                      </label>
                    </div>
                    {product.release_manual_url ? (
                      <a
                        href={product.release_manual_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                      >
                        <DocumentArrowDownIcon className="h-5 w-5" />
                        {product.release_manual_name}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">Kein Dokument</span>
                    )}
                  </div>

                  {/* Draft Manual */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">Draft-Manual</span>
                      <label className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm">
                        <ArrowUpTrayIcon className="h-5 w-5 inline mr-1" />
                        Hochladen
                        <input
                          type="file"
                          onChange={(e) => handleManualUpload(e, 'draft_manual')}
                          className="hidden"
                          accept=".pdf,.doc,.docx"
                        />
                      </label>
                    </div>
                    {product.draft_manual_url ? (
                      <a
                        href={product.draft_manual_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                      >
                        <DocumentArrowDownIcon className="h-5 w-5" />
                        {product.draft_manual_name}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">Kein Dokument</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================== PRICES TAB ===================== */}
          {activeTab === 'prices' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Preisliste</h3>
                <button
                  onClick={() => openPriceModal()}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <PlusIcon className="h-5 w-5" />
                  Neuer Preis
                </button>
              </div>

              {prices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Noch keine Preise definiert
                </div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gültig von</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gültig bis</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">EK-Preis</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">VK-Preis</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notizen</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {prices.map(price => (
                      <tr key={price.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{formatDate(price.valid_from)}</td>
                        <td className="px-4 py-3">{price.valid_until ? formatDate(price.valid_until) : 'unbegrenzt'}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(price.purchase_price)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(price.sales_price)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{price.notes || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openPriceModal(price)}
                            className="text-blue-600 hover:text-blue-800 mr-3"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={() => deletePrice(price.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <TrashIcon className="h-5 w-5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ===================== MATERIALS & CALCULATION TAB ===================== */}
          {activeTab === 'materials' && (
            <div className="space-y-8">
              {/* Materials Section */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Materialsammlung</h3>
                  <button
                    onClick={() => openMaterialModal()}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Material hinzufügen
                  </button>
                </div>

                {materials.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border rounded-lg">
                    Keine Materialien zugewiesen
                  </div>
                ) : (
                  <table className="min-w-full border rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artikelnr.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bezeichnung</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Menge</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stückpreis</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gesamt</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {materials.map(mat => (
                        <tr key={mat.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{mat.position}</td>
                          <td className="px-4 py-3 font-mono text-sm">{mat.material_supply_part_number || '-'}</td>
                          <td className="px-4 py-3">{mat.material_supply_name}</td>
                          <td className="px-4 py-3 text-right">{mat.quantity} {mat.material_supply_unit}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatCurrency(mat.unit_price)}</td>
                          <td className="px-4 py-3 text-right font-mono font-medium">{formatCurrency(mat.item_cost)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openMaterialModal(mat)}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              Bearbeiten
                            </button>
                            <button
                              onClick={() => deleteMaterial(mat.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <TrashIcon className="h-5 w-5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-right font-medium">Materialkosten Summe:</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {formatCurrency(materials.reduce((sum, m) => sum + (m.item_cost || 0), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Cost Calculations Section */}
              <div className="border-t pt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Kostenkalkulationen</h3>
                  <button
                    onClick={() => openCalculationModal()}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                  >
                    <CalculatorIcon className="h-5 w-5" />
                    Neue Kalkulation
                  </button>
                </div>

                {calculations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border rounded-lg">
                    Keine Kalkulationen vorhanden
                  </div>
                ) : (
                  <div className="space-y-4">
                    {calculations.map(calc => (
                      <div key={calc.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-medium">{calc.name || 'Kalkulation'}</h4>
                            <span className={`text-xs px-2 py-1 rounded ${calc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {calc.is_active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => recalculateCalculation(calc.id)}
                              className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
                              title="Neu berechnen"
                            >
                              <CalculatorIcon className="h-4 w-4 inline mr-1" />
                              Neu berechnen
                            </button>
                            <button
                              onClick={() => transferPrice(calc.id)}
                              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              title="Preise übernehmen"
                            >
                              <ArrowRightIcon className="h-4 w-4 inline mr-1" />
                              Zu Preisen
                            </button>
                            <button
                              onClick={() => openCalculationModal(calc)}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              Bearbeiten
                            </button>
                            <button
                              onClick={() => deleteCalculation(calc.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div className="border-r pr-4">
                            <div className="text-gray-500">Materialkosten</div>
                            <div className="font-mono font-medium">{formatCurrency(calc.material_cost)}</div>
                          </div>
                          <div className="border-r pr-4">
                            <div className="text-gray-500">Arbeitskosten ({calc.labor_hours}h × {formatCurrency(calc.labor_rate)})</div>
                            <div className="font-mono font-medium">{formatCurrency(calc.labor_cost)}</div>
                          </div>
                          <div className="border-r pr-4">
                            <div className="text-gray-500">Entw.-Kosten/Stk ({formatCurrency(calc.development_cost_total)} / {calc.expected_sales_volume})</div>
                            <div className="font-mono font-medium">{formatCurrency(calc.development_cost_per_unit)}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Gesamt EK</div>
                            <div className="font-mono font-bold text-lg">{formatCurrency(calc.total_purchase_price)}</div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t flex justify-between items-center">
                          <div className="text-sm">
                            <span className="text-gray-500">Marge: </span>
                            <span className="font-medium">{calc.margin_percent}%</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Kalkulierter VK-Preis</div>
                            <div className="font-mono font-bold text-xl text-green-600">{formatCurrency(calc.calculated_sales_price)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== DOCUMENTS TAB ===================== */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Fertigungspläne & Dokumente</h3>
                <button
                  onClick={() => openDocumentModal()}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  <PlusIcon className="h-5 w-5" />
                  Dokument hinzufügen
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border rounded-lg">
                  Keine Dokumente vorhanden
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {DOCUMENT_TYPES.map(docType => {
                    const docs = documents.filter(d => d.document_type === docType.value);
                    if (docs.length === 0) return null;
                    
                    return (
                      <div key={docType.value} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-3 text-gray-700">{docType.label}</h4>
                        <div className="space-y-2">
                          {docs.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                              <div className="flex items-center gap-3">
                                <DocumentArrowDownIcon className="h-5 w-5 text-gray-400" />
                                <div>
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    {doc.title}
                                  </a>
                                  {doc.version && (
                                    <span className="text-xs text-gray-500 ml-2">v{doc.version}</span>
                                  )}
                                  {doc.description && (
                                    <p className="text-xs text-gray-500">{doc.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">
                                  {formatDate(doc.created_at)}
                                </span>
                                <button
                                  onClick={() => deleteDocument(doc.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===================== MODALS ===================== */}

      {/* Price Modal */}
      {showPriceModal && editingPrice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingPrice.id ? 'Preis bearbeiten' : 'Neuer Preis'}
              </h2>
              <button onClick={() => setShowPriceModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gültig von *</label>
                  <input
                    type="date"
                    value={editingPrice.valid_from}
                    onChange={(e) => setEditingPrice({...editingPrice, valid_from: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gültig bis</label>
                  <input
                    type="date"
                    value={editingPrice.valid_until || ''}
                    onChange={(e) => setEditingPrice({...editingPrice, valid_until: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leer = unbegrenzt gültig</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EK-Preis (EUR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingPrice.purchase_price}
                    onChange={(e) => setEditingPrice({...editingPrice, purchase_price: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VK-Preis (EUR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingPrice.sales_price}
                    onChange={(e) => setEditingPrice({...editingPrice, sales_price: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                <textarea
                  value={editingPrice.notes || ''}
                  onChange={(e) => setEditingPrice({...editingPrice, notes: e.target.value})}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button onClick={() => setShowPriceModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={savePrice} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Modal */}
      {showMaterialModal && editingMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingMaterial.id ? 'Material bearbeiten' : 'Material hinzufügen'}
              </h2>
              <button onClick={() => setShowMaterialModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">M&S Artikel *</label>
                <select
                  value={editingMaterial.material_supply}
                  onChange={(e) => setEditingMaterial({...editingMaterial, material_supply: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  <option value="">-- Artikel wählen --</option>
                  {materialSupplies.map(ms => (
                    <option key={ms.id} value={ms.id}>
                      {ms.visitron_part_number} - {ms.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Menge *</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={editingMaterial.quantity}
                    onChange={(e) => setEditingMaterial({...editingMaterial, quantity: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <input
                    type="number"
                    value={editingMaterial.position}
                    onChange={(e) => setEditingMaterial({...editingMaterial, position: parseInt(e.target.value)})}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notizen</label>
                <input
                  type="text"
                  value={editingMaterial.notes || ''}
                  onChange={(e) => setEditingMaterial({...editingMaterial, notes: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button onClick={() => setShowMaterialModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={saveMaterial} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculation Modal */}
      {showCalculationModal && editingCalculation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingCalculation.id ? 'Kalkulation bearbeiten' : 'Neue Kalkulation'}
              </h2>
              <button onClick={() => setShowCalculationModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
                <input
                  type="text"
                  value={editingCalculation.name}
                  onChange={(e) => setEditingCalculation({...editingCalculation, name: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arbeitsstunden</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingCalculation.labor_hours}
                    onChange={(e) => setEditingCalculation({...editingCalculation, labor_hours: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stundensatz (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingCalculation.labor_rate}
                    onChange={(e) => setEditingCalculation({...editingCalculation, labor_rate: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gesamte Entwicklungskosten (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingCalculation.development_cost_total}
                    onChange={(e) => setEditingCalculation({...editingCalculation, development_cost_total: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Erwarteter Absatz (Stück)</label>
                  <input
                    type="number"
                    value={editingCalculation.expected_sales_volume}
                    onChange={(e) => setEditingCalculation({...editingCalculation, expected_sales_volume: parseInt(e.target.value) || 1})}
                    className="w-full border rounded-lg px-3 py-2"
                    min="1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marge (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingCalculation.margin_percent}
                    onChange={(e) => setEditingCalculation({...editingCalculation, margin_percent: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingCalculation.is_active}
                      onChange={(e) => setEditingCalculation({...editingCalculation, is_active: e.target.checked})}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700">Aktiv</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button onClick={() => setShowCalculationModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={saveCalculation} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Modal */}
      {showDocumentModal && editingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingDocument.id ? 'Dokument bearbeiten' : 'Neues Dokument'}
              </h2>
              <button onClick={() => setShowDocumentModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dokumenttyp *</label>
                <select
                  value={editingDocument.document_type}
                  onChange={(e) => setEditingDocument({...editingDocument, document_type: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {DOCUMENT_TYPES.map(dt => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
                <input
                  type="text"
                  value={editingDocument.title}
                  onChange={(e) => setEditingDocument({...editingDocument, title: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                <input
                  type="text"
                  value={editingDocument.version || ''}
                  onChange={(e) => setEditingDocument({...editingDocument, version: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="z.B. 1.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                <textarea
                  value={editingDocument.description || ''}
                  onChange={(e) => setEditingDocument({...editingDocument, description: e.target.value})}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              {!editingDocument.id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Datei *</label>
                  <input
                    type="file"
                    onChange={(e) => setEditingDocument({...editingDocument, file: e.target.files[0]})}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button onClick={() => setShowDocumentModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
              <button
                onClick={saveDocument}
                disabled={uploadingDocument || !editingDocument.title || (!editingDocument.id && !editingDocument.file)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadingDocument ? 'Hochladen...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VSHardwareEdit;
