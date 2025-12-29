import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  TruckIcon,
  CalculatorIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { id: 'basic', name: 'Basisinfos', icon: InformationCircleIcon },
  { id: 'shipping', name: 'Wareneingang/-ausgang', icon: TruckIcon },
  { id: 'calculation', name: 'RMA-Kalkulation', icon: CalculatorIcon },
  { id: 'report', name: 'Reparaturbericht', icon: DocumentTextIcon }
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Offen' },
  { value: 'in_progress', label: 'In Bearbeitung' },
  { value: 'waiting_parts', label: 'Warte auf Teile' },
  { value: 'repaired', label: 'Repariert' },
  { value: 'not_repairable', label: 'Nicht reparierbar' },
  { value: 'returned', label: 'Zurückgesendet' },
  { value: 'closed', label: 'Abgeschlossen' }
];

const RMACaseEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('basic');
  const [rmaCase, setRmaCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Form data for all tabs
  const [formData, setFormData] = useState({
    // Basic Info
    title: '',
    description: '',
    status: 'open',
    customer_name: '',
    customer_contact: '',
    customer_email: '',
    customer_phone: '',
    product_name: '',
    product_serial: '',
    product_purchase_date: '',
    warranty_status: 'unknown',
    fault_description: '',
    
    // Shipping
    received_date: '',
    received_by: '',
    received_condition: '',
    tracking_inbound: '',
    shipped_date: '',
    shipped_by: '',
    tracking_outbound: '',
    shipping_notes: '',
    
    // Calculation
    estimated_cost: '',
    actual_cost: '',
    parts_cost: '',
    labor_cost: '',
    shipping_cost: '',
    total_cost: '',
    quote_sent: false,
    quote_accepted: false,
    
    // Report
    diagnosis: '',
    repair_actions: '',
    parts_used: '',
    repair_date: '',
    repaired_by: '',
    test_results: '',
    final_notes: ''
  });

  const fetchRMACase = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await api.get(`/service/rma/${id}/`);
      const data = response.data;
      setRmaCase(data);
      setFormData({
        // Basic Info
        title: data.title || '',
        description: data.description || '',
        status: data.status || 'open',
        customer_name: data.customer_name || '',
        customer_contact: data.customer_contact || '',
        customer_email: data.customer_email || '',
        customer_phone: data.customer_phone || '',
        product_name: data.product_name || '',
        product_serial: data.product_serial || '',
        product_purchase_date: data.product_purchase_date || '',
        warranty_status: data.warranty_status || 'unknown',
        fault_description: data.fault_description || '',
        
        // Shipping
        received_date: data.received_date || '',
        received_by: data.received_by || '',
        received_condition: data.received_condition || '',
        tracking_inbound: data.tracking_inbound || '',
        shipped_date: data.shipped_date || '',
        shipped_by: data.shipped_by || '',
        tracking_outbound: data.tracking_outbound || '',
        shipping_notes: data.shipping_notes || '',
        
        // Calculation
        estimated_cost: data.estimated_cost || '',
        actual_cost: data.actual_cost || '',
        parts_cost: data.parts_cost || '',
        labor_cost: data.labor_cost || '',
        shipping_cost: data.shipping_cost || '',
        total_cost: data.total_cost || '',
        quote_sent: data.quote_sent || false,
        quote_accepted: data.quote_accepted || false,
        
        // Report
        diagnosis: data.diagnosis || '',
        repair_actions: data.repair_actions || '',
        parts_used: data.parts_used || '',
        repair_date: data.repair_date || '',
        repaired_by: data.repaired_by || '',
        test_results: data.test_results || '',
        final_notes: data.final_notes || ''
      });
    } catch (error) {
      console.error('Error fetching RMA case:', error);
      alert('Fehler beim Laden des RMA-Falls');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRMACase();
  }, [fetchRMACase]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/service/rma/${id}/`, formData);
      setSaveMessage({ type: 'success', text: 'Änderungen gespeichert!' });
      setHasChanges(false);
      setTimeout(() => setSaveMessage(null), 3000);
      fetchRMACase();
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

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  // Calculate total cost
  const calculateTotal = () => {
    const parts = parseFloat(formData.parts_cost) || 0;
    const labor = parseFloat(formData.labor_cost) || 0;
    const shipping = parseFloat(formData.shipping_cost) || 0;
    return (parts + labor + shipping).toFixed(2);
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

  if (!rmaCase) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-gray-500">RMA-Fall nicht gefunden</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/service/rma')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Zurück zu RMA-Fälle
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <ArrowPathIcon className="h-8 w-8 text-orange-500" />
              <h1 className="text-2xl font-bold text-gray-900">
                {rmaCase.rma_number} - {rmaCase.title}
              </h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Status: {STATUS_OPTIONS.find(s => s.value === rmaCase.status)?.label || rmaCase.status} | 
              Erstellt: {formatDate(rmaCase.created_at)}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {saveMessage && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                saveMessage.type === 'success' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {saveMessage.type === 'success' 
                  ? <CheckCircleIcon className="h-4 w-4" />
                  : <ExclamationCircleIcon className="h-4 w-4" />
                }
                {saveMessage.text}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`px-4 py-2 rounded-lg text-white ${
                hasChanges 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {saving ? 'Speichere...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b overflow-x-auto">
          <nav className="flex -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
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
          {/* Tab 1: Basisinfos */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Grunddaten</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    RMA-Nummer
                  </label>
                  <input
                    type="text"
                    value={rmaCase.rma_number || ''}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titel / Betreff *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="z.B. Defektes Display"
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Allgemeine Beschreibung des Falls..."
                  />
                </div>
              </div>

              <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-8">Kundendaten</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kundenname
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => handleInputChange('customer_name', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ansprechpartner
                  </label>
                  <input
                    type="text"
                    value={formData.customer_contact}
                    onChange={(e) => handleInputChange('customer_contact', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-Mail
                  </label>
                  <input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => handleInputChange('customer_email', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-8">Produktdaten</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Produktname / Typ
                  </label>
                  <input
                    type="text"
                    value={formData.product_name}
                    onChange={(e) => handleInputChange('product_name', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seriennummer
                  </label>
                  <input
                    type="text"
                    value={formData.product_serial}
                    onChange={(e) => handleInputChange('product_serial', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kaufdatum
                  </label>
                  <input
                    type="date"
                    value={formData.product_purchase_date}
                    onChange={(e) => handleInputChange('product_purchase_date', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Garantiestatus
                  </label>
                  <select
                    value={formData.warranty_status}
                    onChange={(e) => handleInputChange('warranty_status', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="unknown">Unbekannt</option>
                    <option value="in_warranty">In Garantie</option>
                    <option value="out_of_warranty">Außerhalb Garantie</option>
                    <option value="extended_warranty">Erweiterte Garantie</option>
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fehlerbeschreibung (vom Kunden)
                  </label>
                  <textarea
                    value={formData.fault_description}
                    onChange={(e) => handleInputChange('fault_description', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Beschreibung des Fehlers wie vom Kunden angegeben..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Wareneingang/-ausgang */}
          {activeTab === 'shipping' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Wareneingang</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Eingangsdatum
                  </label>
                  <input
                    type="date"
                    value={formData.received_date}
                    onChange={(e) => handleInputChange('received_date', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Angenommen von
                  </label>
                  <input
                    type="text"
                    value={formData.received_by}
                    onChange={(e) => handleInputChange('received_by', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Name des Mitarbeiters"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sendungsverfolgung (Eingang)
                  </label>
                  <input
                    type="text"
                    value={formData.tracking_inbound}
                    onChange={(e) => handleInputChange('tracking_inbound', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Tracking-Nummer"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zustand bei Eingang
                  </label>
                  <select
                    value={formData.received_condition}
                    onChange={(e) => handleInputChange('received_condition', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">-- Auswählen --</option>
                    <option value="good">Gut / Unbeschädigt</option>
                    <option value="minor_damage">Leichte Beschädigungen</option>
                    <option value="major_damage">Starke Beschädigungen</option>
                    <option value="incomplete">Unvollständig</option>
                  </select>
                </div>
              </div>

              <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-8">Warenausgang</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Versanddatum
                  </label>
                  <input
                    type="date"
                    value={formData.shipped_date}
                    onChange={(e) => handleInputChange('shipped_date', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Versandt von
                  </label>
                  <input
                    type="text"
                    value={formData.shipped_by}
                    onChange={(e) => handleInputChange('shipped_by', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Name des Mitarbeiters"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sendungsverfolgung (Ausgang)
                  </label>
                  <input
                    type="text"
                    value={formData.tracking_outbound}
                    onChange={(e) => handleInputChange('tracking_outbound', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Tracking-Nummer"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Versandnotizen
                </label>
                <textarea
                  value={formData.shipping_notes}
                  onChange={(e) => handleInputChange('shipping_notes', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Notizen zu Wareneingang/-ausgang..."
                />
              </div>
            </div>
          )}

          {/* Tab 3: RMA-Kalkulation */}
          {activeTab === 'calculation' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Kostenvoranschlag</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Geschätzte Kosten (vorab)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estimated_cost}
                    onChange={(e) => handleInputChange('estimated_cost', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                </div>
                
                <div className="flex items-center gap-6 pt-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.quote_sent}
                      onChange={(e) => handleInputChange('quote_sent', e.target.checked)}
                      className="h-4 w-4 text-orange-600 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">KV gesendet</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.quote_accepted}
                      onChange={(e) => handleInputChange('quote_accepted', e.target.checked)}
                      className="h-4 w-4 text-orange-600 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">KV akzeptiert</span>
                  </label>
                </div>
              </div>

              <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-8">Kostenaufstellung</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Materialkosten
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.parts_cost}
                    onChange={(e) => handleInputChange('parts_cost', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Arbeitskosten
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.labor_cost}
                    onChange={(e) => handleInputChange('labor_cost', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Versandkosten
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.shipping_cost}
                    onChange={(e) => handleInputChange('shipping_cost', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Cost Summary Box */}
              <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                <h4 className="font-medium text-orange-800 mb-3">Kostenübersicht</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-orange-600">Material:</span>{' '}
                    <span className="font-medium">{formatCurrency(formData.parts_cost)}</span>
                  </div>
                  <div>
                    <span className="text-orange-600">Arbeit:</span>{' '}
                    <span className="font-medium">{formatCurrency(formData.labor_cost)}</span>
                  </div>
                  <div>
                    <span className="text-orange-600">Versand:</span>{' '}
                    <span className="font-medium">{formatCurrency(formData.shipping_cost)}</span>
                  </div>
                  <div className="border-l pl-4 border-orange-300">
                    <span className="text-orange-700 font-medium">Gesamt:</span>{' '}
                    <span className="font-bold text-orange-900">{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tatsächliche Gesamtkosten (manuell)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.actual_cost}
                    onChange={(e) => handleInputChange('actual_cost', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Überschreibt die automatische Summe bei Bedarf
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Reparaturbericht */}
          {activeTab === 'report' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Diagnose</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Diagnose / Fehleranalyse
                </label>
                <textarea
                  value={formData.diagnosis}
                  onChange={(e) => handleInputChange('diagnosis', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Technische Analyse des Fehlers..."
                />
              </div>

              <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-8">Durchgeführte Reparatur</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reparaturdatum
                  </label>
                  <input
                    type="date"
                    value={formData.repair_date}
                    onChange={(e) => handleInputChange('repair_date', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Repariert von
                  </label>
                  <input
                    type="text"
                    value={formData.repaired_by}
                    onChange={(e) => handleInputChange('repaired_by', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Name des Technikers"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Durchgeführte Maßnahmen
                </label>
                <textarea
                  value={formData.repair_actions}
                  onChange={(e) => handleInputChange('repair_actions', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Beschreibung der durchgeführten Reparaturmaßnahmen..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Verwendete Ersatzteile
                </label>
                <textarea
                  value={formData.parts_used}
                  onChange={(e) => handleInputChange('parts_used', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Liste der verwendeten Teile..."
                />
              </div>

              <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-8">Abschluss</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Testergebnisse
                </label>
                <textarea
                  value={formData.test_results}
                  onChange={(e) => handleInputChange('test_results', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Ergebnisse der Funktionsprüfung..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Abschlussnotizen
                </label>
                <textarea
                  value={formData.final_notes}
                  onChange={(e) => handleInputChange('final_notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Weitere Anmerkungen..."
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RMACaseEdit;
