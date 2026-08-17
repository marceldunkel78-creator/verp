import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  TruckIcon,
  CalculatorIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ClockIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

const TABS = [
  { id: 'basic', name: 'Basisinfos', icon: InformationCircleIcon },
  { id: 'receipt', name: 'Wareneingang', icon: TruckIcon, disabledWhenNew: true },
  { id: 'time', name: 'Zeiterfassung', icon: ClockIcon },
  { id: 'report', name: 'Reparaturbericht', icon: DocumentTextIcon },
  { id: 'calculation', name: 'RMA-Kalkulation', icon: CalculatorIcon },
  { id: 'issue', name: 'Warenausgang', icon: ArrowUturnLeftIcon, disabledWhenNew: true }
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
  const [searchParams] = useSearchParams();
  const isNew = id === 'new' || !id;
  
  // Get URL params for pre-filling
  const urlCustomerId = searchParams.get('customer');
  const urlSystemId = searchParams.get('system');
  const urlInventoryItemId = searchParams.get('inventory_item');
  
  const [activeTab, setActiveTab] = useState('basic');
  const [rmaCase, setRmaCase] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  
  // Customer search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // System search state
  const [systemSearch, setSystemSearch] = useState('');
  const [searchingSystems, setSearchingSystems] = useState(false);
  const [systemResults, setSystemResults] = useState([]);
  const [selectedSystem, setSelectedSystem] = useState(null);
  
  // Inventory item search state
  const [inventorySearch, setInventorySearch] = useState('');
  const [searchingInventory, setSearchingInventory] = useState(false);
  const [inventoryResults, setInventoryResults] = useState([]);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);

  // Time tracking state
  const [timeEntries, setTimeEntries] = useState([]);
  const [newTimeEntry, setNewTimeEntry] = useState({
    date: '',
    time: '',
    employee: '',
    hours_spent: '',
    description: ''
  });
  const [addingTimeEntry, setAddingTimeEntry] = useState(false);
  const [employees, setEmployees] = useState([]);

  // Wareneingang: Positionen der Warenlieferung
  const [newItem, setNewItem] = useState({
    product_name: '',
    article_number: '',
    quantity: 1,
    unit: 'Stk',
    serial_number: '',
    notes: ''
  });
  const [uploadingPhoto, setUploadingPhoto] = useState({});
  const [creatingReceipt, setCreatingReceipt] = useState(false);
  const [uploadingDeliveryNote, setUploadingDeliveryNote] = useState(false);

  // Warenausgang: Rückversand-Formular
  const [returnForm, setReturnForm] = useState({
    return_date: new Date().toISOString().split('T')[0],
    shipping_carrier: '',
    tracking_number: '',
    notes: '',
    items: []
  });
  const [creatingReturn, setCreatingReturn] = useState(false);
  const [returnPdfLanguage, setReturnPdfLanguage] = useState('de');

  // Form data for all tabs
  const [formData, setFormData] = useState({
    // Basic Info
    title: '',
    description: '',
    status: 'open',
    customer: urlCustomerId || '',
    customer_name: '',
    customer_contact: '',
    customer_email: '',
    customer_phone: '',
    linked_system: urlSystemId || '',
    inventory_item: urlInventoryItemId || '',
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
    address_name: '',
    address_street: '',
    address_house_number: '',
    address_postal_code: '',
    address_city: '',
    address_country: 'Deutschland',
    items: [],
    
    // Calculation
    estimated_cost: '',
    actual_cost: '',
    parts_cost: '',
    labor_cost: '',
    shipping_cost: '',
    total_cost: '',
    evaluation_cost: '',
    margin_percent: 0,
    final_price: '',
    hourly_rate: '',
    admin_fee: '',
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
    try {
      if (!isNew) {
        // Load existing RMA case
        const response = await api.get(`/service/rma/${id}/`);
        const data = response.data;
        setRmaCase(data);
        
        // Load time entries
        if (data.time_entries) {
          setTimeEntries(data.time_entries);
        }
        
        setFormData({
          // Basic Info
          title: data.title || '',
          description: data.description || '',
          status: data.status || 'open',
          customer: data.customer || '',
          customer_name: data.customer_name || '',
          customer_contact: data.customer_contact || '',
          customer_email: data.customer_email || '',
          customer_phone: data.customer_phone || '',
          linked_system: data.linked_system || '',
          inventory_item: data.inventory_item || '',
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
          address_name: data.address_name || '',
          address_street: data.address_street || '',
          address_house_number: data.address_house_number || '',
          address_postal_code: data.address_postal_code || '',
          address_city: data.address_city || '',
          address_country: data.address_country || 'Deutschland',
          items: data.items || [],
          
          // Calculation
          estimated_cost: data.estimated_cost || '',
          actual_cost: data.actual_cost || '',
          parts_cost: data.parts_cost || '',
          labor_cost: data.labor_cost || '',
          shipping_cost: data.shipping_cost || '',
          total_cost: data.total_cost || '',
          evaluation_cost: data.evaluation_cost || '',
          margin_percent: data.margin_percent ?? 0,
          final_price: data.final_price || '',
          hourly_rate: data.hourly_rate || '',
          admin_fee: data.admin_fee || '',
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
        
        // Positionen für das Warenausgangs-Formular initialisieren
        if (data.items) {
          setReturnForm(prev => ({
            ...prev,
            items: data.items.map(item => ({
              rma_item_id: item.id,
              product_name: item.product_name,
              quantity_available: item.quantity,
              quantity_returned: 0,
              selected: false,
              condition_notes: ''
            }))
          }));
        }
        
        // Load customer details if set
        if (data.customer) {
          try {
            const custRes = await api.get(`/customers/customers/${data.customer}/`);
            setSelectedCustomer(custRes.data);
          } catch (err) {
            console.error('Error loading customer:', err);
          }
        }
        
        // Load system details if set
        if (data.linked_system) {
          try {
            const sysRes = await api.get(`/systems/systems/${data.linked_system}/`);
            setSelectedSystem(sysRes.data);
          } catch (err) {
            console.error('Error loading system:', err);
          }
        }
        
        // Load inventory item details if set
        if (data.inventory_item) {
          try {
            const invRes = await api.get(`/inventory/inventory-items/${data.inventory_item}/`);
            setSelectedInventoryItem(invRes.data);
          } catch (err) {
            console.error('Error loading inventory item:', err);
          }
        }
      } else {
        // For new RMA cases, load customer/system/inventory from URL params
        if (urlCustomerId) {
          try {
            const custRes = await api.get(`/customers/customers/${urlCustomerId}/`);
            setSelectedCustomer(custRes.data);
          } catch (err) {
            console.error('Error loading customer from URL:', err);
          }
        }
        if (urlSystemId) {
          try {
            const sysRes = await api.get(`/systems/systems/${urlSystemId}/`);
            setSelectedSystem(sysRes.data);
          } catch (err) {
            console.error('Error loading system from URL:', err);
          }
        }
        if (urlInventoryItemId) {
          try {
            const invRes = await api.get(`/inventory/inventory-items/${urlInventoryItemId}/`);
            setSelectedInventoryItem(invRes.data);
          } catch (err) {
            console.error('Error loading inventory item from URL:', err);
          }
        }
      }
    } catch (error) {
      console.error('Error loading RMA case:', error);
      if (!isNew) {
        alert('Fehler beim Laden des RMA-Falls');
      }
    } finally {
      setLoading(false);
    }
  }, [id, isNew, urlCustomerId, urlSystemId, urlInventoryItemId]);

  useEffect(() => {
    fetchRMACase();
  }, [fetchRMACase]);

  // Stundensatz und Verwaltungskostenpauschale aus Firmeneinstellungen laden,
  // wenn der Tab RMA-Kalkulation geöffnet wird und noch keine Werte gesetzt sind
  useEffect(() => {
    if (activeTab === 'calculation' && (!formData.hourly_rate || !formData.admin_fee)) {
      api.get('/company-info/')
        .then(res => {
          const settings = Array.isArray(res.data) ? res.data[0] : res.data;
          if (settings) {
            setFormData(prev => ({
              ...prev,
              hourly_rate: prev.hourly_rate || settings.default_hourly_rate || '',
              admin_fee: prev.admin_fee || settings.default_admin_fee || ''
            }));
          }
        })
        .catch(err => console.error('Error loading company settings:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Load employees for time tracking
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await api.get('/users/?is_active=true');
        setEmployees(response.data.results || response.data || []);
      } catch (error) {
        console.error('Error loading employees:', error);
      }
    };
    if (!isNew) {
      fetchEmployees();
    }
  }, [isNew]);

  // Warning before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Customer search functions
  const searchCustomers = async () => {
    if (!customerSearch.trim()) return;
    setSearchingCustomers(true);
    try {
      const response = await api.get(`/customers/customers/?search=${customerSearch}&is_active=true`);
      setCustomerResults(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setSearchingCustomers(false);
    }
  };

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customer: customer.id }));
    setCustomerSearch('');
    setCustomerResults([]);
    setHasChanges(true);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setFormData(prev => ({ ...prev, customer: '' }));
    setHasChanges(true);
  };

  // Kundenadressen für das Dropdown (Warenausgang & Reparaturbericht)
  const getCustomerAddresses = () => {
    if (selectedCustomer && Array.isArray(selectedCustomer.addresses)) {
      return selectedCustomer.addresses.filter(a => a.is_active);
    }
    return [];
  };

  const applyCustomerAddress = (address) => {
    if (!address) return;
    setFormData(prev => ({
      ...prev,
      address_name: selectedCustomer?.full_name || selectedCustomer?.customer_name || formData.customer_name || '',
      address_street: address.street || '',
      address_house_number: address.house_number || '',
      address_postal_code: address.postal_code || '',
      address_city: address.city || '',
      address_country: address.country === 'DE' ? 'Deutschland' : (address.country || 'Deutschland')
    }));
    setHasChanges(true);
  };

  // System search functions
  const searchSystems = async () => {
    if (!systemSearch.trim()) return;
    setSearchingSystems(true);
    try {
      const response = await api.get(`/systems/systems/?search=${systemSearch}`);
      setSystemResults(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error searching systems:', error);
    } finally {
      setSearchingSystems(false);
    }
  };

  const selectSystem = (system) => {
    setSelectedSystem(system);
    setFormData(prev => ({ ...prev, linked_system: system.id }));
    setSystemSearch('');
    setSystemResults([]);
    setHasChanges(true);
  };

  const clearSystem = () => {
    setSelectedSystem(null);
    setFormData(prev => ({ ...prev, linked_system: '' }));
    setHasChanges(true);
  };

  // Inventory item search functions
  const searchInventory = async () => {
    if (!inventorySearch.trim()) return;
    setSearchingInventory(true);
    try {
      const response = await api.get(`/inventory/inventory-items/?search=${inventorySearch}`);
      setInventoryResults(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error searching inventory:', error);
    } finally {
      setSearchingInventory(false);
    }
  };

  const selectInventoryItem = (item) => {
    setSelectedInventoryItem(item);
    setFormData(prev => ({
      ...prev,
      inventory_item: item.id,
      product_name: item.name || '',
      product_serial: item.serial_number || ''
    }));
    setInventorySearch('');
    setInventoryResults([]);
    setHasChanges(true);
  };

  const clearInventoryItem = () => {
    setSelectedInventoryItem(null);
    setFormData(prev => ({
      ...prev,
      inventory_item: '',
      product_name: '',
      product_serial: ''
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...formData };

      // Gesamtkosten und Endpreis aus der Kalkulation automatisch berechnen
      const subtotal = calcTotals.material + calcTotals.labor + calcTotals.shipping + (parseFloat(payload.admin_fee) || 0);
      const margin = parseFloat(payload.margin_percent) || 0;
      const endPrice = subtotal > 0 && (100 - margin) > 0
        ? (subtotal / (100 - margin)) * 100
        : subtotal;
      // Evaluierungskosten mit dem Endpreis (nach Marge) vergleichen
      const computedTotal = Math.max(endPrice, parseFloat(payload.evaluation_cost) || 0);
      payload.total_cost = computedTotal.toFixed(2);
      payload.final_price = computedTotal.toFixed(2);

      // Positionen bereinigen: numerische Menge sicherstellen, Foto-/Read-only-Felder entfernen
      if (Array.isArray(payload.items)) {
        payload.items = payload.items.map(it => {
          const sanitized = {
            id: it.id,
            position: it.position || undefined,
            product_name: it.product_name,
            article_number: it.article_number,
            quantity: it.quantity === '' || it.quantity === null ? 0 : parseFloat(it.quantity),
            unit: it.unit,
            serial_number: it.serial_number,
            notes: it.notes
          };
          Object.keys(sanitized).forEach(k => sanitized[k] === undefined && delete sanitized[k]);
          return sanitized;
        });
      }
      
      if (isNew) {
        // Create new RMA case
        const response = await api.post('/service/rma/', payload);
        setSaveMessage({ type: 'success', text: 'RMA-Fall erstellt!' });
        setHasChanges(false);
        // Navigate to the new RMA case
        navigate(`/service/rma/${response.data.id}`, { replace: true });
      } else {
        // Update existing RMA case
        const response = await api.patch(`/service/rma/${id}/`, payload);
        setSaveMessage({ type: 'success', text: 'Änderungen gespeichert!' });
        setHasChanges(false);
        setTimeout(() => setSaveMessage(null), 3000);
        // Response enthält bereits aktualisierte Positionen/Fotos - direkt übernehmen
        if (response.data && Array.isArray(response.data.items)) {
          setFormData(prev => ({ ...prev, items: response.data.items }));
          setRmaCase(response.data);
        } else {
          fetchRMACase();
        }
      }
    } catch (error) {
      console.error('Error saving:', error);
      setSaveMessage({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  };

  // Wareneingang: Positionen der Warenlieferung verwalten
  const handleAddItem = () => {
    if (!newItem.product_name) {
      alert('Bitte Produktname angeben');
      return;
    }
    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), { ...newItem, position: (prev.items || []).length + 1 }]
    }));
    setNewItem({ product_name: '', article_number: '', quantity: 1, unit: 'Stk', serial_number: '', notes: '' });
    setHasChanges(true);
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: (prev.items || []).filter((_, i) => i !== index)
    }));
    setHasChanges(true);
  };

  const handleCreateReceipt = async () => {
    setCreatingReceipt(true);
    try {
      await api.post(`/service/rma/${id}/create_receipt/`, {
        receipt_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      fetchRMACase();
    } catch (error) {
      console.error('Error creating receipt:', error);
      alert('Fehler beim Erfassen des Wareneingangs');
    } finally {
      setCreatingReceipt(false);
    }
  };

  const handleUploadReceiptDocument = async (file) => {
    setUploadingDeliveryNote(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      await api.post(`/service/rma/${id}/upload_receipt_document/`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchRMACase();
    } catch (error) {
      console.error('Error uploading delivery note:', error);
      alert('Fehler beim Hochladen des Eingangslieferscheins');
    } finally {
      setUploadingDeliveryNote(false);
    }
  };

  const handleUploadPhoto = async (itemId, file) => {
    setUploadingPhoto(prev => ({ ...prev, [itemId]: true }));
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('item_id', itemId);
      formDataUpload.append('photo', file);
      formDataUpload.append('description', '');
      await api.post(`/service/rma/${id}/upload_photo/`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchRMACase();
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Fehler beim Hochladen des Fotos');
    } finally {
      setUploadingPhoto(prev => {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      });
    }
  };

  // Warenausgang: Rückversand erstellen, PDF anzeigen/löschen
  const handleCreateReturn = async () => {
    const selectedItems = returnForm.items.filter(item => item.selected && item.quantity_returned > 0);

    if (selectedItems.length === 0) {
      alert('Bitte mindestens eine Position zum Versand auswählen');
      return;
    }

    setCreatingReturn(true);
    try {
      await api.post(`/service/rma/${id}/create_return/`, {
        return_date: returnForm.return_date,
        shipping_carrier: returnForm.shipping_carrier,
        tracking_number: returnForm.tracking_number,
        notes: returnForm.notes,
        language: returnPdfLanguage,
        items: selectedItems.map(item => ({
          rma_item_id: item.rma_item_id,
          quantity_returned: item.quantity_returned,
          condition_notes: item.condition_notes
        }))
      });
      setReturnForm(prev => ({
        ...prev,
        shipping_carrier: '',
        tracking_number: '',
        notes: '',
        items: prev.items.map(it => ({ ...it, selected: false, quantity_returned: 0, condition_notes: '' }))
      }));
      fetchRMACase();
    } catch (error) {
      console.error('Error creating return:', error);
      alert('Fehler beim Erstellen des Warenausgangs');
    } finally {
      setCreatingReturn(false);
    }
  };

  const handleDownloadPdf = async (returnId, returnNumber, language) => {
    try {
      const response = await api.get(`/service/rma-returns/${returnId}/download_pdf/`, {
        params: { language: language || 'de' },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Lieferschein_${returnNumber || ''}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Fehler beim Herunterladen des Lieferscheins');
    }
  };

  const handleDeleteReturn = async (returnId) => {
    if (!window.confirm('Diesen Warenausgang wirklich löschen? Der Lieferschein kann danach mit korrigierten Positionen neu erstellt werden.')) {
      return;
    }
    try {
      await api.delete(`/service/rma-returns/${returnId}/`);
      fetchRMACase();
    } catch (error) {
      console.error('Error deleting return:', error);
      alert('Fehler beim Löschen des Warenausgangs');
    }
  };

  // Lieferschein im neuen Tab anzeigen
  const handleViewReturnPdf = async (returnId, language) => {
    try {
      const response = await api.get(`/service/rma-returns/${returnId}/view_pdf/`, {
        params: { language: language || 'de' },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error('Error viewing PDF:', error);
      alert('Fehler beim Anzeigen des Lieferscheins');
    }
  };

  // Reparaturbericht PDF
  const [generatingReportPdf, setGeneratingReportPdf] = useState(false);
  const [reportPdfLanguage, setReportPdfLanguage] = useState('de');

  const handleGenerateReportPdf = async () => {
    setGeneratingReportPdf(true);
    try {
      const response = await api.post(`/service/rma/${id}/generate_report_pdf/`, {
        language: reportPdfLanguage
      });
      if (response.data) {
        setRmaCase(response.data);
      }
      alert('Reparaturbericht-PDF wurde erstellt');
    } catch (error) {
      console.error('Error generating report PDF:', error);
      alert('Fehler beim Erstellen des Reparaturberichts');
    } finally {
      setGeneratingReportPdf(false);
    }
  };

  const handleViewReportPdf = async () => {
    try {
      const response = await api.get(`/service/rma/${id}/view_report_pdf/`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error('Error viewing report PDF:', error);
      alert('Fehler beim Anzeigen des Reparaturberichts');
    }
  };

  const handleDownloadReportPdf = async () => {
    try {
      const response = await api.get(`/service/rma/${id}/download_report_pdf/`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reparaturbericht_${rmaCase?.rma_number || ''}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading report PDF:', error);
      alert('Fehler beim Herunterladen des Reparaturberichts');
    }
  };

  // RMA-Kalkulation PDF (Dokumentation)
  const [calcPdfLanguage, setCalcPdfLanguage] = useState('de');

  const handleDownloadCalculationPdf = async () => {
    try {
      const response = await api.get(`/service/rma/${id}/download_calculation_pdf/`, {
        params: { language: calcPdfLanguage },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RMA_Kalkulation_${rmaCase?.rma_number || ''}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading calculation PDF:', error);
      alert('Fehler beim Herunterladen der RMA-Kalkulation');
    }
  };

  const handleViewCalculationPdf = async () => {
    try {
      const response = await api.get(`/service/rma/${id}/view_calculation_pdf/`, {
        params: { language: calcPdfLanguage },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error('Error viewing calculation PDF:', error);
      alert('Fehler beim Anzeigen der RMA-Kalkulation');
    }
  };

  // Auftragsdokumente
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const handleUploadAttachment = async (file) => {
    setUploadingAttachment(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('description', '');
      await api.post(`/service/rma/${id}/upload_attachment/`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchRMACase();
    } catch (error) {
      console.error('Error uploading attachment:', error);
      alert('Fehler beim Hochladen des Auftragsdokuments');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Dieses Auftragsdokument wirklich löschen?')) return;
    try {
      await api.delete(`/service/rma/${id}/delete_attachment/${attachmentId}/`);
      fetchRMACase();
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert('Fehler beim Löschen des Auftragsdokuments');
    }
  };

  // RMA-Kalkulation: Kostenpositionen
  const [newCostLine, setNewCostLine] = useState({
    cost_type: 'material',
    description: '',
    quantity: 1,
    unit: 'Stk',
    unit_price: 0
  });

  const handleAddCostLine = async () => {
    if (!newCostLine.description) {
      alert('Bitte Beschreibung angeben');
      return;
    }
    try {
      await api.post(`/service/rma/${id}/add_cost_line_item/`, {
        cost_type: newCostLine.cost_type,
        description: newCostLine.description,
        quantity: newCostLine.quantity,
        unit: newCostLine.unit,
        unit_price: newCostLine.unit_price
      });
      setNewCostLine({ cost_type: 'material', description: '', quantity: 1, unit: 'Stk', unit_price: 0 });
      fetchRMACase();
    } catch (error) {
      console.error('Error adding cost line:', error);
      alert('Fehler beim Hinzufügen der Kostenposition');
    }
  };

  const handleDeleteCostLine = async (lineId) => {
    try {
      await api.delete(`/service/rma/${id}/delete_cost_line_item/${lineId}/`);
      fetchRMACase();
    } catch (error) {
      console.error('Error deleting cost line:', error);
      alert('Fehler beim Löschen der Kostenposition');
    }
  };

  const [importingTime, setImportingTime] = useState(false);

  const handleImportTimeToLabor = async () => {
    setImportingTime(true);
    try {
      const response = await api.post(`/service/rma/${id}/import_time_to_labor/`, {
        hourly_rate: formData.hourly_rate
      });
      if (response.data && response.data.rma_case) {
        setRmaCase(response.data.rma_case);
        setFormData(prev => ({ ...prev, hourly_rate: response.data.hourly_rate }));
      }
      alert(`${response.data?.imported || 0} Zeiteintrag/Zeiteinträge in Arbeitskosten importiert`);
    } catch (error) {
      console.error('Error importing time to labor:', error);
      alert('Fehler beim Importieren der Zeiterfassung');
    } finally {
      setImportingTime(false);
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
    // Summe aus den Kostenpositionen (Material + Arbeit + Versand)
    const totals = { material: 0, labor: 0, shipping: 0 };
    (rmaCase?.cost_line_items || []).forEach(line => {
      const price = parseFloat(line.total_price) || 0;
      if (line.cost_type === 'material') totals.material += price;
      else if (line.cost_type === 'labor') totals.labor += price;
      else if (line.cost_type === 'shipping') totals.shipping += price;
      else totals.material += price;
    });
    return totals;
  };

  const calcTotals = calculateTotal();
  const adminFee = parseFloat(formData.admin_fee) || 0;
  const calcSubtotal = calcTotals.material + calcTotals.labor + calcTotals.shipping + adminFee;
  const margin = parseFloat(formData.margin_percent) || 0;
  // Endpreis nach Margenaufschlag: Zwischensumme / (100 - Marge) * 100
  const calcEndPrice = calcSubtotal > 0 && (100 - margin) > 0
    ? ((calcSubtotal / (100 - margin)) * 100)
    : calcSubtotal;
  // Gesamtkosten: Evaluierungskosten werden mit dem Endpreis (nach Marge) verglichen.
  // Ist die Evaluierung höher, wird sie als Gesamtkosten eingetragen, sonst der Endpreis.
  const calcTotalCost = Math.max(calcEndPrice, parseFloat(formData.evaluation_cost) || 0);
  const calcFinalPrice = calcTotalCost.toFixed(2);

  // Time entry handlers
  const handleAddTimeEntry = async () => {
    if (!newTimeEntry.employee || !newTimeEntry.hours_spent) {
      alert('Bitte Mitarbeiter und Stunden ausfüllen');
      return;
    }
    
    setAddingTimeEntry(true);
    try {
      const response = await api.post(`/service/rma/${id}/add_time_entry/`, newTimeEntry);
      setTimeEntries([...timeEntries, response.data]);
      setNewTimeEntry({
        date: '',
        time: '',
        employee: '',
        hours_spent: '',
        description: ''
      });
      fetchRMACase(); // Reload to get updated total_hours_spent
    } catch (error) {
      console.error('Error adding time entry:', error);
      alert('Fehler beim Hinzufügen der Zeiterfassung');
    } finally {
      setAddingTimeEntry(false);
    }
  };

  const handleDeleteTimeEntry = async (entryId) => {
    if (!window.confirm('Möchten Sie diesen Zeiteintrag wirklich löschen?')) {
      return;
    }
    
    try {
      await api.delete(`/service/rma/${id}/delete_time_entry/${entryId}/`);
      setTimeEntries(timeEntries.filter(entry => entry.id !== entryId));
      fetchRMACase(); // Reload to get updated total_hours_spent
    } catch (error) {
      console.error('Error deleting time entry:', error);
      alert('Fehler beim Löschen der Zeiterfassung');
    }
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => {
            if (hasChanges && !window.confirm('Sie haben ungespeicherte Änderungen. Möchten Sie wirklich fortfahren?')) {
              return;
            }
            navigate('/service/rma');
          }}
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
                {isNew ? 'Neuer RMA-Fall' : `${rmaCase?.rma_number || ''} - ${rmaCase?.title || formData.title}`}
              </h1>
            </div>
            {!isNew && rmaCase && (
              <p className="mt-1 text-sm text-gray-500">
                Status: {STATUS_OPTIONS.find(s => s.value === rmaCase.status)?.label || rmaCase.status} | 
                Erstellt: {formatDate(rmaCase.created_at)}
              </p>
            )}
            {isNew && (
              <p className="mt-1 text-sm text-gray-500">
                Die RMA-Nummer wird beim ersten Speichern automatisch vergeben
              </p>
            )}
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
            {hasChanges && !isNew && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
                <ExclamationCircleIcon className="h-4 w-4" />
                Nicht gespeicherte Änderungen
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-white ${
                saving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {saving ? 'Speichere...' : (isNew ? 'Erstellen' : 'Speichern')}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b overflow-x-auto">
          <nav className="flex -mb-px">
            {TABS.map((tab) => {
              const disabled = tab.disabledWhenNew && isNew;
              return (
                <button
                  key={tab.id}
                  onClick={() => !disabled && setActiveTab(tab.id)}
                  disabled={disabled}
                  title={disabled ? 'Erst nach dem Speichern verfügbar' : undefined}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : disabled
                        ? 'border-transparent text-gray-300 cursor-not-allowed'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Tab 1: Basisinfos */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Grunddaten</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {!isNew && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      RMA-Nummer
                    </label>
                    <input
                      type="text"
                      value={rmaCase?.rma_number || ''}
                      disabled
                      className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-600"
                    />
                  </div>
                )}
                
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kunde
                </label>
                {selectedCustomer ? (
                  <div className="mt-1 flex items-center gap-2 p-3 bg-gray-50 border border-gray-300 rounded-md">
                    <div className="flex-1">
                      <div className="font-medium">{selectedCustomer.first_name} {selectedCustomer.last_name}</div>
                      <div className="text-sm text-gray-600">{selectedCustomer.customer_number}</div>
                    </div>
                    <button
                      type="button"
                      onClick={clearCustomer}
                      className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            searchCustomers();
                          }
                        }}
                        placeholder="Kunde suchen..."
                        className="block flex-1 rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={searchCustomers}
                        disabled={searchingCustomers}
                        className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400"
                      >
                        {searchingCustomers ? 'Suchen...' : 'Suchen'}
                      </button>
                    </div>
                    {customerResults.length > 0 && (
                      <div className="mt-2 border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                        {customerResults.map((cust) => (
                          <div
                            key={cust.id}
                            onClick={() => selectCustomer(cust)}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-200 last:border-b-0"
                          >
                            <div className="font-medium">{cust.first_name} {cust.last_name}</div>
                            <div className="text-sm text-gray-600">{cust.customer_number}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-8">Verknüpftes System</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  System (optional)
                </label>
                {selectedSystem ? (
                  <div className="mt-1 flex items-center gap-2 p-3 bg-gray-50 border border-gray-300 rounded-md">
                    <div className="flex-1">
                      <div className="font-medium">{selectedSystem.system_name || selectedSystem.name}</div>
                      <div className="text-sm text-gray-600">{selectedSystem.system_number}</div>
                    </div>
                    <button
                      type="button"
                      onClick={clearSystem}
                      className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        value={systemSearch}
                        onChange={(e) => setSystemSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            searchSystems();
                          }
                        }}
                        placeholder="System suchen..."
                        className="block flex-1 rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={searchSystems}
                        disabled={searchingSystems}
                        className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400"
                      >
                        {searchingSystems ? 'Suchen...' : 'Suchen'}
                      </button>
                    </div>
                    {systemResults.length > 0 && (
                      <div className="mt-2 border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                        {systemResults.map((sys) => (
                          <div
                            key={sys.id}
                            onClick={() => selectSystem(sys)}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-200 last:border-b-0"
                          >
                            <div className="font-medium">{sys.system_name || sys.name}</div>
                            <div className="text-sm text-gray-600">{sys.system_number}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-8">Produktdaten</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Warenlager-Artikel (optional)
                </label>
                {selectedInventoryItem ? (
                  <div className="mt-1 flex items-center gap-2 p-3 bg-gray-50 border border-gray-300 rounded-md">
                    <div className="flex-1">
                      <div className="font-medium">{selectedInventoryItem.name}</div>
                      <div className="text-sm text-gray-600">
                        {selectedInventoryItem.inventory_number}
                        {selectedInventoryItem.serial_number && ` - SN: ${selectedInventoryItem.serial_number}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearInventoryItem}
                      className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            searchInventory();
                          }
                        }}
                        placeholder="Artikel im Warenlager suchen..."
                        className="block flex-1 rounded-md border-gray-300 shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={searchInventory}
                        disabled={searchingInventory}
                        className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400"
                      >
                        {searchingInventory ? 'Suchen...' : 'Suchen'}
                      </button>
                    </div>
                    {inventoryResults.length > 0 && (
                      <div className="mt-2 border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                        {inventoryResults.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => selectInventoryItem(item)}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-200 last:border-b-0"
                          >
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-gray-600">
                              {item.inventory_number}
                              {item.serial_number && ` - SN: ${item.serial_number}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Wählen Sie einen Artikel aus dem Warenlager, um Produktdaten automatisch zu füllen
                </p>
              </div>
              
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

              {/* Auftragsdokumente */}
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-8">Auftragsdokumente</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                {rmaCase?.attachments && rmaCase.attachments.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {rmaCase.attachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between bg-white border rounded-lg p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <DocumentTextIcon className="h-5 w-5 text-orange-500 flex-shrink-0" />
                          <a
                            href={att.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-600 hover:underline truncate"
                          >
                            {att.description || att.file_url?.split('/').pop() || 'Dokument'}
                          </a>
                        </div>
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="text-red-600 hover:text-red-800 flex-shrink-0"
                          title="Löschen"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-500 hover:bg-orange-50">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files[0] && handleUploadAttachment(e.target.files[0])}
                  />
                  <span className="text-gray-500">
                    {uploadingAttachment ? 'Lade hoch...' : 'Auftragsdokument hochladen'}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Tab 2: Wareneingang */}
          {activeTab === 'receipt' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Positionen der Warenlieferung</h3>

                {/* Add Item Form */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        placeholder="Produktname *"
                        value={newItem.product_name}
                        onChange={(e) => setNewItem(prev => ({ ...prev, product_name: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Art.-Nr."
                        value={newItem.article_number}
                        onChange={(e) => setNewItem(prev => ({ ...prev, article_number: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Menge"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                        min="1"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Seriennr."
                        value={newItem.serial_number}
                        onChange={(e) => setNewItem(prev => ({ ...prev, serial_number: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-1"
                      >
                        <PlusIcon className="h-4 w-4" /> Hinzufügen
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                {formData.items && formData.items.length > 0 && (
                  <table className="w-full border rounded-lg overflow-hidden mb-2">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Pos.</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Art.-Nr.</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Produkt</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Menge</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">S/N</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, idx) => (
                        <tr key={item.id || idx} className="border-t">
                          <td className="px-4 py-2">{idx + 1}</td>
                          <td className="px-4 py-2">{item.article_number || '-'}</td>
                          <td className="px-4 py-2">{item.product_name}</td>
                          <td className="px-4 py-2">{item.quantity} {item.unit}</td>
                          <td className="px-4 py-2">{item.serial_number || '-'}</td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <TrashIcon className="h-4 w-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="text-xs text-gray-500">Neue/entfernte Positionen werden mit "Speichern" übernommen.</p>
              </div>

              <div className="border-t pt-6">
                {!rmaCase?.receipt ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">Wareneingang noch nicht erfasst</p>
                    <button
                      onClick={handleCreateReceipt}
                      disabled={creatingReceipt}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
                    >
                      {creatingReceipt ? 'Erfasse...' : 'Wareneingang jetzt erfassen'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <p className="text-green-800">
                        <strong>✓ Wareneingang erfasst:</strong> {formatDate(rmaCase.receipt.receipt_date)}
                      </p>
                    </div>

                    {/* Eingangslieferschein Upload */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Eingangslieferschein</h4>
                      {rmaCase.receipt.delivery_note_url ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={rmaCase.receipt.delivery_note_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-600 hover:underline"
                          >
                            Eingangslieferschein anzeigen
                          </a>
                          <label className="text-sm text-gray-500 hover:text-orange-600 cursor-pointer">
                            (ersetzen)
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              className="hidden"
                              onChange={(e) => e.target.files[0] && handleUploadReceiptDocument(e.target.files[0])}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-500 hover:bg-orange-50">
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            className="hidden"
                            onChange={(e) => e.target.files[0] && handleUploadReceiptDocument(e.target.files[0])}
                          />
                          <span className="text-gray-500">
                            {uploadingDeliveryNote ? 'Lade hoch...' : 'Eingangslieferschein hochladen'}
                          </span>
                        </label>
                      )}
                    </div>

                    {/* Fotos pro Position */}
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Fotos je Position</h4>
                    <div className="space-y-4">
                      {(rmaCase.items || []).map((item, idx) => (
                        <div key={item.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h5 className="font-medium">{idx + 1}. {item.product_name}</h5>
                              {item.article_number && (
                                <p className="text-sm text-gray-500">Art.-Nr.: {item.article_number}</p>
                              )}
                            </div>
                            <span className="text-sm text-gray-500">{item.quantity} {item.unit}</span>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {item.photos?.map(photo => (
                              <a
                                key={photo.id}
                                href={photo.photo_url || photo.photo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img
                                  src={photo.photo_url || photo.photo}
                                  alt=""
                                  className="h-16 w-16 object-cover rounded border"
                                />
                              </a>
                            ))}
                            <label className="h-16 w-16 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-orange-500">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => e.target.files[0] && handleUploadPhoto(item.id, e.target.files[0])}
                              />
                              <span className="text-2xl text-gray-400">
                                {uploadingPhoto[item.id] ? '…' : '+'}
                              </span>
                            </label>
                          </div>
                        </div>
                      ))}
                      {(!rmaCase.items || rmaCase.items.length === 0) && (
                        <p className="text-sm text-gray-500 italic">Keine Positionen vorhanden</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: RMA-Kalkulation */}
          {activeTab === 'calculation' && (
            <div className="space-y-6">
              {/* PDF-Aktionen (Dokumentation) */}
              <div className="bg-white border rounded-lg p-4 flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-medium text-gray-900 mr-2">Kalkulation als PDF</h3>
                <select
                  value={calcPdfLanguage}
                  onChange={(e) => setCalcPdfLanguage(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                  title="Sprache des PDFs"
                >
                  <option value="de">Deutsch</option>
                  <option value="en">Englisch</option>
                </select>
                <button
                  onClick={handleViewCalculationPdf}
                  className="border border-gray-300 text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg flex items-center gap-1"
                >
                  <EyeIcon className="h-4 w-4" /> Anzeigen
                </button>
                <button
                  onClick={handleDownloadCalculationPdf}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-1"
                >
                  <DocumentArrowDownIcon className="h-4 w-4" /> Herunterladen
                </button>
                <p className="text-xs text-gray-500">Nur zur Dokumentation, keine Rechnung</p>
              </div>

              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Kostenvoranschlag</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Evaluierungskosten
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.evaluation_cost}
                    onChange={(e) => handleInputChange('evaluation_cost', e.target.value)}
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

              {/* Materialkosten */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-8">Materialkosten</h3>
                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-3">
                      <input
                        type="text"
                        placeholder="Beschreibung"
                        value={newCostLine.cost_type === 'material' ? newCostLine.description : ''}
                        onChange={(e) => setNewCostLine(prev => ({ ...prev, cost_type: 'material', description: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Stückzahl</label>
                      <input
                        type="number"
                        placeholder="z.B. 2"
                        value={newCostLine.cost_type === 'material' ? newCostLine.quantity : 1}
                        onChange={(e) => setNewCostLine(prev => ({ ...prev, cost_type: 'material', quantity: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Einzelpreis (€)</label>
                      <input
                        type="number"
                        placeholder="z.B. 12,50"
                        value={newCostLine.cost_type === 'material' ? newCostLine.unit_price : 0}
                        onChange={(e) => setNewCostLine(prev => ({ ...prev, cost_type: 'material', unit_price: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => { setNewCostLine(prev => ({ ...prev, cost_type: 'material' })); handleAddCostLine(); }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-1"
                      >
                        <PlusIcon className="h-4 w-4" /> Hinzufügen
                      </button>
                    </div>
                  </div>
                </div>
                <CostLineTable lines={rmaCase?.cost_line_items?.filter(l => l.cost_type === 'material') || []} onDelete={handleDeleteCostLine} />
              </div>

              {/* Arbeitskosten */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-8">Arbeitskosten</h3>
                  <div className="flex items-center gap-3 mt-8">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Stundensatz (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.hourly_rate}
                        onChange={(e) => handleInputChange('hourly_rate', e.target.value)}
                        className="w-28 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <button
                      onClick={handleImportTimeToLabor}
                      disabled={importingTime}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      {importingTime ? 'Importiere...' : 'Zeiterfassung importieren'}
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-3">
                      <input
                        type="text"
                        placeholder="Beschreibung"
                        value={newCostLine.cost_type === 'labor' ? newCostLine.description : ''}
                        onChange={(e) => setNewCostLine(prev => ({ ...prev, cost_type: 'labor', description: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Stunden</label>
                      <input
                        type="number"
                        placeholder="z.B. 2,5"
                        value={newCostLine.cost_type === 'labor' ? newCostLine.quantity : 1}
                        onChange={(e) => setNewCostLine(prev => ({ ...prev, cost_type: 'labor', quantity: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Stundensatz (€/h)</label>
                      <input
                        type="number"
                        placeholder="z.B. 85,00"
                        value={newCostLine.cost_type === 'labor' ? (newCostLine.unit_price || formData.hourly_rate) : formData.hourly_rate}
                        onChange={(e) => setNewCostLine(prev => ({ ...prev, cost_type: 'labor', unit_price: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCostLine(prev => ({
                            ...prev,
                            cost_type: 'labor',
                            unit_price: prev.unit_price || formData.hourly_rate || 0
                          }));
                          handleAddCostLine();
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-1"
                      >
                        <PlusIcon className="h-4 w-4" /> Hinzufügen
                      </button>
                    </div>
                  </div>
                </div>
                <CostLineTable lines={rmaCase?.cost_line_items?.filter(l => l.cost_type === 'labor') || []} onDelete={handleDeleteCostLine} />
              </div>

              {/* Versandkosten */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mt-8">Versandkosten</h3>
                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-3">
                      <input
                        type="text"
                        placeholder="Beschreibung"
                        value={newCostLine.cost_type === 'shipping' ? newCostLine.description : ''}
                        onChange={(e) => setNewCostLine(prev => ({ ...prev, cost_type: 'shipping', description: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Stückzahl</label>
                      <input
                        type="number"
                        placeholder="z.B. 1"
                        value={newCostLine.cost_type === 'shipping' ? newCostLine.quantity : 1}
                        onChange={(e) => setNewCostLine(prev => ({ ...prev, cost_type: 'shipping', quantity: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Einzelpreis (€)</label>
                      <input
                        type="number"
                        placeholder="z.B. 6,90"
                        value={newCostLine.cost_type === 'shipping' ? newCostLine.unit_price : 0}
                        onChange={(e) => setNewCostLine(prev => ({ ...prev, cost_type: 'shipping', unit_price: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => { setNewCostLine(prev => ({ ...prev, cost_type: 'shipping' })); handleAddCostLine(); }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-1"
                      >
                        <PlusIcon className="h-4 w-4" /> Hinzufügen
                      </button>
                    </div>
                  </div>
                </div>
                <CostLineTable lines={rmaCase?.cost_line_items?.filter(l => l.cost_type === 'shipping') || []} onDelete={handleDeleteCostLine} />
              </div>

              {/* Cost Summary */}
              <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                <h4 className="font-medium text-orange-800 mb-3">Kostenübersicht</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-orange-600">Material:</span>{' '}
                    <span className="font-medium">{formatCurrency(calcTotals.material)}</span>
                  </div>
                  <div>
                    <span className="text-orange-600">Arbeit:</span>{' '}
                    <span className="font-medium">{formatCurrency(calcTotals.labor)}</span>
                  </div>
                  <div>
                    <span className="text-orange-600">Versand:</span>{' '}
                    <span className="font-medium">{formatCurrency(calcTotals.shipping)}</span>
                  </div>
                  <div>
                    <span className="text-orange-600">Verwaltung:</span>{' '}
                    <span className="font-medium">{formatCurrency(adminFee)}</span>
                  </div>
                  <div className="border-l pl-4 border-orange-300">
                    <span className="text-orange-700 font-medium">Zwischensumme:</span>{' '}
                    <span className="font-bold text-orange-900">{formatCurrency(calcSubtotal)}</span>
                  </div>
                </div>
              </div>

              {/* Gesamtkosten & Marge */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Verwaltungskostenpauschale (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.admin_fee}
                    onChange={(e) => handleInputChange('admin_fee', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Aus Firmeneinstellungen übernommen, bleibt editierbar
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endpreis nach Marge (auto)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={calcEndPrice.toFixed(2)}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Zwischensumme / (100 - Marge) * 100
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marge (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.margin_percent}
                    onChange={(e) => handleInputChange('margin_percent', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gesamtkosten / Endpreis (auto)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={calcFinalPrice}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Evaluierungskosten, falls größer als der Endpreis nach Marge
                  </p>
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
              {/* Empfängeradresse */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-medium text-gray-900">Empfängeradresse</h3>
                  {getCustomerAddresses().length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Aus Kundenadressen übernehmen:</label>
                      <select
                        value=""
                        onChange={(e) => {
                          const addr = getCustomerAddresses().find(a => a.id === parseInt(e.target.value));
                          applyCustomerAddress(addr);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">-- Adresse wählen --</option>
                        {getCustomerAddresses().map(a => (
                          <option key={a.id} value={a.id}>
                            {a.address_type_display || a.address_type}: {a.street} {a.house_number}, {a.postal_code} {a.city}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name / Firma</label>
                    <input
                      type="text"
                      value={formData.address_name}
                      onChange={(e) => handleInputChange('address_name', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
                    <input
                      type="text"
                      value={formData.address_street}
                      onChange={(e) => handleInputChange('address_street', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hausnummer</label>
                    <input
                      type="text"
                      value={formData.address_house_number}
                      onChange={(e) => handleInputChange('address_house_number', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                    <input
                      type="text"
                      value={formData.address_postal_code}
                      onChange={(e) => handleInputChange('address_postal_code', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                    <input
                      type="text"
                      value={formData.address_city}
                      onChange={(e) => handleInputChange('address_city', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
                    <input
                      type="text"
                      value={formData.address_country}
                      onChange={(e) => handleInputChange('address_country', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* PDF-Aktionen */}
              <div className="bg-white border rounded-lg p-4 flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-medium text-gray-900 mr-2">Reparaturbericht PDF</h3>
                <select
                  value={reportPdfLanguage}
                  onChange={(e) => setReportPdfLanguage(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                  title="Sprache des PDFs"
                >
                  <option value="de">Deutsch</option>
                  <option value="en">Englisch</option>
                </select>
                <button
                  onClick={handleGenerateReportPdf}
                  disabled={generatingReportPdf}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {generatingReportPdf ? 'Generiere...' : 'PDF erzeugen'}
                </button>
                {rmaCase?.report_pdf && (
                  <>
                    <button
                      onClick={handleViewReportPdf}
                      className="border border-gray-300 text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg flex items-center gap-1"
                    >
                      <EyeIcon className="h-4 w-4" /> Anzeigen
                    </button>
                    <button
                      onClick={handleDownloadReportPdf}
                      className="border border-gray-300 text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-lg flex items-center gap-1"
                    >
                      <DocumentArrowDownIcon className="h-4 w-4" /> Herunterladen
                    </button>
                  </>
                )}
                {!rmaCase?.report_pdf && (
                  <p className="text-sm text-gray-500">Noch kein Reparaturbericht generiert.</p>
                )}
              </div>

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

          {/* Tab 5: Zeiterfassung */}
          {activeTab === 'time' && (
            <div className="space-y-6">
              {/* Header with total hours */}
              <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-lg font-medium text-gray-900">Zeiterfassung</h3>
                {rmaCase?.total_hours_spent !== undefined && (
                  <div className="text-sm">
                    <span className="text-gray-600">Gesamt: </span>
                    <span className="font-semibold text-orange-600">
                      {rmaCase.total_hours_spent} Stunden
                    </span>
                  </div>
                )}
              </div>

              {/* Add new time entry form */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Neue Zeiterfassung</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Datum
                    </label>
                    <input
                      type="date"
                      value={newTimeEntry.date}
                      onChange={(e) => setNewTimeEntry({ ...newTimeEntry, date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Uhrzeit
                    </label>
                    <input
                      type="time"
                      value={newTimeEntry.time}
                      onChange={(e) => setNewTimeEntry({ ...newTimeEntry, time: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mitarbeiter *
                    </label>
                    <select
                      value={newTimeEntry.employee}
                      onChange={(e) => setNewTimeEntry({ ...newTimeEntry, employee: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      required
                    >
                      <option value="">Auswählen...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stunden *
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={newTimeEntry.hours_spent}
                      onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hours_spent: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="z.B. 2.5"
                      required
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      onClick={handleAddTimeEntry}
                      disabled={addingTimeEntry || !newTimeEntry.employee || !newTimeEntry.hours_spent}
                      className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <PlusIcon className="h-5 w-5 mr-1" />
                      Hinzufügen
                    </button>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={newTimeEntry.description}
                    onChange={(e) => setNewTimeEntry({ ...newTimeEntry, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="Beschreibung der durchgeführten Arbeiten..."
                  />
                </div>
              </div>

              {/* Time entries table */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Zeiteinträge</h4>
                {timeEntries.length === 0 ? (
                  <p className="text-gray-500 text-sm py-8 text-center">
                    Noch keine Zeiteinträge vorhanden
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Datum
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Uhrzeit
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Mitarbeiter
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Stunden
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Beschreibung
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Erfasst von
                          </th>
                          <th className="px-6 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {timeEntries.map(entry => (
                          <tr key={entry.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(entry.date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {entry.time || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {entry.employee_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {entry.hours_spent}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {entry.description || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {entry.created_by_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <button
                                onClick={() => handleDeleteTimeEntry(entry.id)}
                                className="text-red-600 hover:text-red-800"
                                title="Löschen"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 6: Warenausgang */}
          {activeTab === 'issue' && (
            <div className="space-y-6">
              {/* Bisherige Warenausgänge */}
              {rmaCase?.returns && rmaCase.returns.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-3">Bisherige Warenausgänge</h3>
                  <div className="space-y-3">
                    {rmaCase.returns.map(ret => (
                      <div key={ret.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{ret.return_number}</h4>
                            <p className="text-sm text-gray-500">
                              {formatDate(ret.return_date)}
                              {ret.shipping_carrier && ` • ${ret.shipping_carrier}`}
                              {ret.tracking_number && ` • ${ret.tracking_number}`}
                            </p>
                            <p className="text-sm mt-1">{ret.items?.length || 0} Position(en)</p>
                          </div>
                          <div className="flex gap-2 items-center">
                            <select
                              value={ret.pdf_language || 'de'}
                              onChange={async (e) => {
                                const lang = e.target.value;
                                // Lieferschein in gewünschter Sprache neu generieren/aktualisieren
                                await api.post(`/service/rma-returns/${ret.id}/regenerate_pdf/`, {
                                  language: lang
                                });
                                fetchRMACase();
                              }}
                              className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                              title="Sprache des Lieferscheins"
                            >
                              <option value="de">DE</option>
                              <option value="en">EN</option>
                            </select>
                            <button
                              onClick={() => handleViewReturnPdf(ret.id, ret.pdf_language || 'de')}
                              className="border border-gray-300 text-gray-600 hover:bg-gray-100 px-3 py-1 rounded text-sm flex items-center gap-1"
                              title="Lieferschein anzeigen"
                            >
                              <EyeIcon className="h-4 w-4" />
                              Anzeigen
                            </button>
                            <button
                              onClick={() => handleDownloadPdf(ret.id, ret.return_number, ret.pdf_language || 'de')}
                              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm"
                            >
                              Lieferschein PDF
                            </button>
                            <button
                              onClick={() => handleDeleteReturn(ret.id)}
                              className="border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1 rounded text-sm"
                              title="Löschen, um den Lieferschein neu zu erstellen"
                            >
                              Löschen
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Neuer Warenausgang */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-3">Neuen Warenausgang erstellen</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Versanddatum</label>
                    <input
                      type="date"
                      value={returnForm.return_date}
                      onChange={(e) => setReturnForm(prev => ({ ...prev, return_date: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Versanddienstleister</label>
                    <input
                      type="text"
                      value={returnForm.shipping_carrier}
                      onChange={(e) => setReturnForm(prev => ({ ...prev, shipping_carrier: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="z.B. DHL, UPS..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sendungsnummer</label>
                    <input
                      type="text"
                      value={returnForm.tracking_number}
                      onChange={(e) => setReturnForm(prev => ({ ...prev, tracking_number: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lieferschein-Sprache</label>
                    <select
                      value={returnPdfLanguage}
                      onChange={(e) => setReturnPdfLanguage(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 bg-white"
                    >
                      <option value="de">Deutsch</option>
                      <option value="en">Englisch</option>
                    </select>
                  </div>
                </div>

                {/* Empfängeradresse */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-gray-700">Empfängeradresse</h4>
                    {getCustomerAddresses().length > 0 && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Aus Kundenadressen übernehmen:</label>
                        <select
                          value=""
                          onChange={(e) => {
                            const addr = getCustomerAddresses().find(a => a.id === parseInt(e.target.value));
                            applyCustomerAddress(addr);
                          }}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="">-- Adresse wählen --</option>
                          {getCustomerAddresses().map(a => (
                            <option key={a.id} value={a.id}>
                              {a.address_type_display || a.address_type}: {a.street} {a.house_number}, {a.postal_code} {a.city}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name / Firma</label>
                      <input
                        type="text"
                        value={formData.address_name}
                        onChange={(e) => handleInputChange('address_name', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
                      <input
                        type="text"
                        value={formData.address_street}
                        onChange={(e) => handleInputChange('address_street', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hausnummer</label>
                      <input
                        type="text"
                        value={formData.address_house_number}
                        onChange={(e) => handleInputChange('address_house_number', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                      <input
                        type="text"
                        value={formData.address_postal_code}
                        onChange={(e) => handleInputChange('address_postal_code', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                      <input
                        type="text"
                        value={formData.address_city}
                        onChange={(e) => handleInputChange('address_city', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
                      <input
                        type="text"
                        value={formData.address_country}
                        onChange={(e) => handleInputChange('address_country', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                </div>

                <h4 className="font-medium text-gray-700 mb-2">Positionen zum Versand auswählen:</h4>
                <div className="space-y-2 mb-4">
                  {returnForm.items.map((item, idx) => (
                    <div key={item.rma_item_id} className="border rounded-lg p-3 flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => {
                          const newItems = [...returnForm.items];
                          newItems[idx].selected = e.target.checked;
                          if (e.target.checked && !newItems[idx].quantity_returned) {
                            newItems[idx].quantity_returned = item.quantity_available;
                          }
                          setReturnForm(prev => ({ ...prev, items: newItems }));
                        }}
                        className="h-5 w-5 text-orange-600 rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-gray-500">Verfügbar: {item.quantity_available}</p>
                      </div>
                      {item.selected && (
                        <>
                          <div className="w-24">
                            <input
                              type="number"
                              value={item.quantity_returned}
                              onChange={(e) => {
                                const newItems = [...returnForm.items];
                                newItems[idx].quantity_returned = parseFloat(e.target.value) || 0;
                                setReturnForm(prev => ({ ...prev, items: newItems }));
                              }}
                              min="0"
                              max={item.quantity_available}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder="Zustand/Bemerkung"
                              value={item.condition_notes}
                              onChange={(e) => {
                                const newItems = [...returnForm.items];
                                newItems[idx].condition_notes = e.target.value;
                                setReturnForm(prev => ({ ...prev, items: newItems }));
                              }}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {returnForm.items.length === 0 && (
                    <p className="text-sm text-gray-500 italic">Keine Positionen vorhanden - bitte zunächst im Tab "Wareneingang" erfassen.</p>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bemerkungen</label>
                  <textarea
                    value={returnForm.notes}
                    onChange={(e) => setReturnForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <button
                  onClick={handleCreateReturn}
                  disabled={creatingReturn}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
                >
                  {creatingReturn ? 'Erstelle...' : 'Warenausgang erstellen & Lieferschein generieren'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Tabelle für Kostenpositionen in der RMA-Kalkulation
function CostLineTable({ lines, onDelete }) {
  if (!lines || lines.length === 0) {
    return <p className="text-sm text-gray-500 italic mb-3">Keine Positionen vorhanden</p>;
  }
  return (
    <table className="w-full border rounded-lg overflow-hidden mb-3">
      <thead className="bg-gray-100">
        <tr>
          <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Beschreibung</th>
          <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Menge</th>
          <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Einzelpreis</th>
          <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Summe</th>
          <th className="px-4 py-2 text-right text-sm font-medium text-gray-600"></th>
        </tr>
      </thead>
      <tbody>
        {lines.map(line => (
          <tr key={line.id} className="border-t">
            <td className="px-4 py-2">{line.description || '-'}</td>
            <td className="px-4 py-2 text-right">{line.quantity} {line.unit}</td>
            <td className="px-4 py-2 text-right">
              {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(line.unit_price)}
            </td>
            <td className="px-4 py-2 text-right font-medium">
              {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(line.total_price)}
            </td>
            <td className="px-4 py-2 text-right">
              <button
                onClick={() => onDelete(line.id)}
                className="text-red-600 hover:text-red-800"
                title="Löschen"
              >
                <TrashIcon className="h-4 w-4 inline" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default RMACaseEdit;
