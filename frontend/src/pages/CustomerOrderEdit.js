import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddressSelector from '../components/AddressSelector';
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ClipboardDocumentCheckIcon,
  TruckIcon,
  CurrencyEuroIcon,
  BanknotesIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  ArrowUpTrayIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

/**
 * CustomerOrderEdit - Auftragsbearbeitung mit 6 Tabs:
 * 1. Basisinfos - Angebot auswählen, Kunde, Adressen, Konditionen
 * 2. Positionen - Artikelpositionen bearbeiten
 * 3. Auftragsbestätigung - AB erstellen und PDF generieren
 * 4. Lieferschein - Lieferungen erstellen
 * 5. Rechnung - Rechnungen erstellen
 * 6. Zahlung - Zahlungen erfassen
 */
const CustomerOrderEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isEditMode = !!id;

  // Tab Management
  const initialTab = searchParams.get('tab') || 'basisinfos';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Lookup Data
  const [customers, setCustomers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [deliveryTerms, setDeliveryTerms] = useState([]);
  const [warrantyTerms, setWarrantyTerms] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Search States
  const [quotationSearch, setQuotationSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchingQuotations, setSearchingQuotations] = useState(false);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Order Data
  const [order, setOrder] = useState({
    id: null,
    order_number: null,
    status: 'angelegt',
    customer: null,
    quotation: null,
    project_reference: '',
    system_reference: '',
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: '',
    customer_document: '',
    customer_order_number: '',
    confirmation_address: '',
    shipping_address: '',
    billing_address: '',
    confirmation_email: '',
    billing_email: '',
    vat_id: '',
    payment_term: '',
    delivery_term: '',
    warranty_term: '',
    tax_rate: '19.00',
    tax_included: false,
    order_notes: '',
    production_notes: '',
    delivery_notes_text: '',
    sales_person: '',
    items: [],
    delivery_notes: [],
    invoices: []
  });

  // Selected Objects for Display
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  // Delivery Note Draft State
  const [deliveryNoteDraft, setDeliveryNoteDraft] = useState({
    delivery_date: new Date().toISOString().split('T')[0],
    shipping_address: '',
    carrier: '',
    tracking_number: '',
    notes: '',
    selectedItemIds: []
  });

  // Invoice Draft State
  const [invoiceDraft, setInvoiceDraft] = useState({
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    billing_address: '',
    notes: '',
    selectedItemIds: []
  });

  // Tab Configuration
  const tabs = [
    { id: 'basisinfos', name: 'Basisinfos', icon: DocumentTextIcon, enabled: true },
    { id: 'positionen', name: 'Positionen', icon: ClipboardDocumentListIcon, enabled: true },
    { id: 'auftragsbestaetigung', name: 'Auftragsbestätigung', icon: ClipboardDocumentCheckIcon, enabled: isEditMode },
    { id: 'lieferschein', name: 'Lieferschein', icon: TruckIcon, enabled: isEditMode && order.status !== 'angelegt' },
    { id: 'rechnung', name: 'Rechnung', icon: CurrencyEuroIcon, enabled: isEditMode && order.status !== 'angelegt' },
    { id: 'zahlung', name: 'Zahlung', icon: BanknotesIcon, enabled: isEditMode && order.status !== 'angelegt' }
  ];

  // Load order data when editing
  useEffect(() => {
    if (id && id !== 'undefined') {
      loadOrder(id);
    }
    loadLookupData();
  }, [id]);

  // Update URL when tab changes
  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab]);

  const loadLookupData = async () => {
    try {
      const [paymentRes, deliveryRes, warrantyRes, employeesRes] = await Promise.all([
        api.get('/settings/payment-terms/?is_active=true'),
        api.get('/settings/delivery-terms/?is_active=true'),
        api.get('/settings/warranty-terms/?is_active=true'),
        // Mitarbeiter-Liste vom Users-App EmployeeViewSet
        api.get('/users/employees/?is_active=true&page_size=100')
      ]);
      setPaymentTerms(paymentRes.data.results || paymentRes.data || []);
      setDeliveryTerms(deliveryRes.data.results || deliveryRes.data || []);
      setWarrantyTerms(warrantyRes.data.results || warrantyRes.data || []);
      setEmployees(employeesRes.data.results || employeesRes.data || []);
    } catch (err) {
      console.error('Error loading lookup data:', err);
    }
  };

  const loadOrder = async (orderId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/customer-orders/customer-orders/${orderId}/`);
      const data = response.data;
      
      setOrder({
        ...data,
        customer: data.customer,
        quotation: data.quotation,
        payment_term: data.payment_term || '',
        delivery_term: data.delivery_term || '',
        warranty_term: data.warranty_term || '',
        // Map customer_vat_id from backend to vat_id for frontend state
        vat_id: data.customer_vat_id || '',
        items: data.items || [],
        delivery_notes: data.delivery_notes || [],
        invoices: data.invoices || []
      });

      // Set selected objects for display
      if (data.customer_data) {
        setSelectedCustomer(data.customer_data);
      } else if (data.customer) {
        // Load customer details
        try {
          const custRes = await api.get(`/customers/customers/${data.customer}/`);
          setSelectedCustomer(custRes.data);
        } catch (e) {
          console.error('Error loading customer:', e);
        }
      }

      if (data.quotation) {
        try {
          const quotRes = await api.get(`/sales/quotations/${data.quotation}/`);
          setSelectedQuotation(quotRes.data);
        } catch (e) {
          console.error('Error loading quotation:', e);
        }
      }
    } catch (err) {
      console.error('Error loading order:', err);
      setError('Fehler beim Laden des Auftrags');
    } finally {
      setLoading(false);
    }
  };

  // Search Functions
  const searchQuotations = async () => {
    if (!quotationSearch.trim()) return;
    setSearchingQuotations(true);
    try {
      const params = new URLSearchParams();
      params.append('search', quotationSearch);
      const response = await api.get(`/sales/quotations/?${params.toString()}`);
      const data = response.data.results || response.data || [];
      setQuotations(data);
    } catch (err) {
      console.error('Error searching quotations:', err);
      setQuotations([]);
    } finally {
      setSearchingQuotations(false);
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

  // Selection Handlers
  const selectQuotation = async (quotation) => {
    setSelectedQuotation(quotation);
    setQuotations([]);
    setQuotationSearch('');

    // Load full quotation with items
    try {
      const response = await api.get(`/sales/quotations/${quotation.id}/`);
      const fullQuotation = response.data;

      // Map quotation items to order items with support for sub-positions (5.01, 5.02 etc)
      const mappedItems = (fullQuotation.items || []).map((item, idx) => {
        // Determine position display string
        // Items in a group (with group_id but not is_group_header) get sub-positions like "5.01"
        let positionDisplay = '';
        if (item.position_display) {
          positionDisplay = item.position_display;
        } else if (item.group_id && !item.is_group_header) {
          // Sub-item of a group - find the group header position
          const groupHeader = (fullQuotation.items || []).find(
            i => i.group_id === item.group_id && i.is_group_header
          );
          if (groupHeader) {
            // Count items in the same group before this one
            const groupItems = (fullQuotation.items || []).filter(
              i => i.group_id === item.group_id && !i.is_group_header
            );
            const subIndex = groupItems.findIndex(i => i.id === item.id) + 1;
            positionDisplay = `${groupHeader.position}.${String(subIndex).padStart(2, '0')}`;
          } else {
            positionDisplay = String(item.position || idx + 1);
          }
        } else {
          positionDisplay = String(item.position || idx + 1);
        }

        return {
          position: item.position || idx + 1,
          position_display: positionDisplay,
          article_number: item.item_article_number || '',
          name: item.item_name || item.group_name || '',
          description: item.item_description || item.custom_description || '',
          quantity: item.quantity || 1,
          unit: item.unit || 'Stk',
          purchase_price: item.purchase_price || 0,
          list_price: item.unit_price || item.sale_price || 0,
          discount_percent: item.discount_percent || 0,
          final_price: item.unit_price || item.sale_price || 0,
          currency: 'EUR',
          quotation_position: item.position || idx + 1,
          is_group_header: item.is_group_header || false,
          group_id: item.group_id || ''
        };
      });

      // Get customer from quotation
      let customer = null;
      if (fullQuotation.customer) {
        if (typeof fullQuotation.customer === 'object') {
          customer = fullQuotation.customer;
          setSelectedCustomer(fullQuotation.customer);
        } else {
          try {
            const custRes = await api.get(`/customers/customers/${fullQuotation.customer}/`);
            customer = custRes.data;
            setSelectedCustomer(custRes.data);
          } catch (e) {
            console.error('Error loading customer from quotation:', e);
          }
        }
      }

      // Build addresses from customer
      let confirmationAddress = '';
      let shippingAddress = '';
      let billingAddress = '';
      
      if (customer) {
        const baseAddress = [
          customer.company_name,
          customer.contact_name ? `z.Hd. ${customer.contact_name}` : '',
          `${customer.street || ''} ${customer.house_number || ''}`.trim(),
          `${customer.postal_code || ''} ${customer.city || ''}`.trim(),
          customer.country && customer.country !== 'Deutschland' ? customer.country : ''
        ].filter(Boolean).join('\n');
        
        confirmationAddress = baseAddress;
        shippingAddress = baseAddress;
        billingAddress = baseAddress;
      }

      setOrder(prev => ({
        ...prev,
        quotation: quotation.id,
        customer: customer?.id || null,
        project_reference: fullQuotation.project_reference || fullQuotation.reference || '',
        confirmation_address: confirmationAddress,
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        confirmation_email: customer?.email || '',
        billing_email: customer?.billing_email || customer?.email || '',
        vat_id: customer?.vat_id || '',
        items: mappedItems,
        // Copy conditions from quotation when available
        payment_term: fullQuotation.payment_term || fullQuotation.payment_term_id || prev.payment_term || '',
        delivery_term: fullQuotation.delivery_term || fullQuotation.delivery_term_id || prev.delivery_term || '',
        warranty_term: fullQuotation.warranty_term || fullQuotation.warranty_term_id || prev.warranty_term || '',
        tax_rate: fullQuotation.tax_rate || fullQuotation.tax_rate_percent || prev.tax_rate || prev.tax_rate || '',
        // keep tax_included in UI state but do not send it to backend (backend model has no such field)
        tax_included: fullQuotation.tax_included ?? prev.tax_included ?? false
      }));

    } catch (err) {
      console.error('Error loading full quotation:', err);
    }
  };

  const selectCustomer = async (customer) => {
    // Fetch full customer details to build addresses and contact fields
    try {
      const res = await api.get(`/customers/customers/${customer.id}/`);
      const full = res.data;
      setSelectedCustomer(full);
      setCustomers([]);
      setCustomerSearch('');

      // Build a sensible base address from available fields
      let addressLines = [];
      if (full.full_name) addressLines.push(full.full_name);
      // Use first address if available
      const addr = (full.addresses && full.addresses.length > 0) ? full.addresses[0] : null;
      if (addr) {
        const street = `${addr.street || ''} ${addr.house_number || ''}`.trim();
        if (street) addressLines.push(street);
        const pcCity = `${addr.postal_code || ''} ${addr.city || ''}`.trim();
        if (pcCity) addressLines.push(pcCity);
      }
      const baseAddress = addressLines.join('\n');

      setOrder(prev => ({
        ...prev,
        customer: full.id,
        confirmation_address: baseAddress,
        shipping_address: baseAddress,
        billing_address: baseAddress,
        confirmation_email: full.primary_email || full.emails?.[0]?.email || '',
        billing_email: full.primary_email || full.emails?.[0]?.email || '',
        vat_id: full.vat_id || ''
      }));
    } catch (err) {
      console.error('Error loading customer details:', err);
      // Fallback to minimal selection
      setSelectedCustomer(customer);
      setCustomers([]);
      setCustomerSearch('');
      setOrder(prev => ({ ...prev, customer: customer.id }));
    }
  };

  const clearQuotation = () => {
    setSelectedQuotation(null);
    setOrder(prev => ({
      ...prev,
      quotation: null,
      items: []
    }));
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setOrder(prev => ({
      ...prev,
      customer: null,
      confirmation_address: '',
      shipping_address: '',
      billing_address: '',
      confirmation_email: '',
      billing_email: '',
      vat_id: ''
    }));
  };

  // Save Order
  const handleSave = async () => {
    if (!order.customer) {
      alert('Bitte wählen Sie einen Kunden aus.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        customer: order.customer,
        quotation: order.quotation || null,
        project_reference: order.project_reference,
        system_reference: order.system_reference,
        order_date: order.order_date,
        delivery_date: order.delivery_date || null,
        // customer_document wird nur mit FormData gesendet wenn eine Datei hochgeladen wird
        customer_order_number: order.customer_order_number,
        confirmation_address: order.confirmation_address,
        shipping_address: order.shipping_address,
        billing_address: order.billing_address,
        confirmation_email: order.confirmation_email,
        billing_email: order.billing_email,
        // VAT is optional and only sent when provided (mapped to `customer_vat_id` on backend)
        // Do not include an empty vat field in the payload
        payment_term: order.payment_term || null,
        delivery_term: order.delivery_term || null,
        warranty_term: order.warranty_term || null,
        tax_rate: order.tax_rate,
        order_notes: order.order_notes,
        production_notes: order.production_notes,
        delivery_notes_text: order.delivery_notes_text,
        sales_person: order.sales_person ? parseInt(order.sales_person) : null,
        items: order.items.map((item, idx) => ({
          position: item.position || idx + 1,
          position_display: item.position_display || String(item.position || idx + 1),
          article_number: item.article_number || '',
          name: item.name || '',
          description: item.description || '',
          quantity: item.quantity || 1,
          unit: item.unit || 'Stk',
          purchase_price: item.purchase_price || 0,
          list_price: item.list_price || 0,
          discount_percent: item.discount_percent || 0,
          final_price: item.final_price || item.list_price || 0,
          currency: item.currency || 'EUR',
          quotation_position: item.quotation_position || null,
          is_group_header: item.is_group_header || false,
          group_id: item.group_id || '',
          delivery_note_number: item.delivery_note_number || 1,
          invoice_number: item.invoice_number || 1
        }))
      };

      // Include VAT only when provided by the user
      if (order.vat_id && order.vat_id.toString().trim() !== '') {
        payload.customer_vat_id = order.vat_id.toString().trim();
      }

      let response;
      if (isEditMode) {
        response = await api.patch(`/customer-orders/customer-orders/${id}/`, payload);
      } else {
        response = await api.post('/customer-orders/customer-orders/', payload);
      }

      if (!isEditMode) {
        const newId = response?.data?.id;
        if (newId) {
          navigate(`/sales/order-processing/${newId}?tab=positionen`);
        } else {
          console.error('Save succeeded but response has no id:', response);
          setError('Auftrag wurde erstellt, aber der Server hat keine ID zurückgegeben.');
        }
      } else {
        // Reload order data
        loadOrder(id);
      }
      
      alert(isEditMode ? 'Auftrag gespeichert.' : 'Auftrag erstellt.');
    } catch (err) {
      console.error('Error saving order:', err);
      setError('Fehler beim Speichern: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Tab Change Handler
  const changeTab = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.enabled) {
      setActiveTab(tabId);
    }
  };

  // Status Badge
  const getStatusBadge = (status) => {
    const statusColors = {
      'angelegt': 'bg-gray-100 text-gray-800',
      'bestaetigt': 'bg-blue-100 text-blue-800',
      'in_produktion': 'bg-yellow-100 text-yellow-800',
      'geliefert': 'bg-green-100 text-green-800',
      'berechnet': 'bg-purple-100 text-purple-800',
      'bezahlt': 'bg-emerald-100 text-emerald-800',
      'abgeschlossen': 'bg-gray-200 text-gray-900',
      'storniert': 'bg-red-100 text-red-800'
    };
    const statusLabels = {
      'angelegt': 'Angelegt',
      'bestaetigt': 'Bestätigt',
      'in_produktion': 'In Produktion',
      'geliefert': 'Geliefert',
      'berechnet': 'Berechnet',
      'bezahlt': 'Bezahlt',
      'abgeschlossen': 'Abgeschlossen',
      'storniert': 'Storniert'
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <nav className="text-sm text-gray-500 mb-2">
          <Link to="/sales" className="hover:text-gray-700">Sales & Order Management</Link>
          <span className="mx-2">/</span>
          <Link to="/sales/order-processing" className="hover:text-gray-700">Auftragsabwicklung</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{isEditMode ? 'Auftrag bearbeiten' : 'Neuer Auftrag'}</span>
        </nav>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <DocumentTextIcon className="h-7 w-7 mr-2 text-blue-600" />
              {isEditMode ? (
                <>
                  Auftrag {order.order_number || `#${id}`}
                  <span className="ml-3">{getStatusBadge(order.status)}</span>
                </>
              ) : (
                'Neuer Kundenauftrag'
              )}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {isEditMode 
                ? 'Auftrag bearbeiten, Lieferscheine und Rechnungen erstellen'
                : 'Angebot auswählen und zum Auftrag umwandeln'}
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/sales/order-processing')}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Zurück
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Speichern...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Speichern
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <XCircleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isDisabled = !tab.enabled;

            return (
              <button
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                disabled={isDisabled}
                className={`
                  group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                  ${isActive
                    ? 'border-blue-500 text-blue-600'
                    : isDisabled
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                <Icon className={`-ml-0.5 mr-2 h-5 w-5 ${isActive ? 'text-blue-500' : isDisabled ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-500'}`} />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg">
        {/* ==================== TAB 1: BASISINFOS ==================== */}
        {activeTab === 'basisinfos' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Basisinformationen</h2>

            {/* Angebot suchen */}
            <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-md font-medium text-blue-900 mb-3">
                <MagnifyingGlassIcon className="h-5 w-5 inline mr-2" />
                Angebot auswählen (optional)
              </h3>
              <p className="text-sm text-blue-700 mb-4">
                Wählen Sie ein bestehendes Angebot aus, um Kunde und Positionen zu übernehmen.
              </p>

              {selectedQuotation ? (
                <div className="bg-white rounded-md p-4 border border-blue-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900">
                        {selectedQuotation.quotation_number}
                      </div>
                      <div className="text-sm text-gray-600">
                        {selectedQuotation.customer_name || selectedQuotation.customer?.company_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        vom {selectedQuotation.date ? new Date(selectedQuotation.date).toLocaleDateString('de-DE') : '-'}
                      </div>
                    </div>
                    <button
                      onClick={clearQuotation}
                      className="text-red-600 hover:text-red-800"
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={quotationSearch}
                      onChange={(e) => setQuotationSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchQuotations()}
                      placeholder="Angebotsnummer oder Kundenname..."
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <button
                      onClick={searchQuotations}
                      disabled={searchingQuotations}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                      {searchingQuotations ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <MagnifyingGlassIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Quotation Search Results */}
                  {quotations.length > 0 && (
                    <div className="mt-2 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {quotations.map((q) => (
                        <div
                          key={q.id}
                          onClick={() => selectQuotation(q)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{q.quotation_number}</div>
                          <div className="text-sm text-gray-600">{q.customer_name || q.customer?.company_name}</div>
                          <div className="text-xs text-gray-500">
                            vom {q.date ? new Date(q.date).toLocaleDateString('de-DE') : '-'} • 
                            {q.items_count || 0} Positionen
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Kunde */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-3">Kunde</h3>
                
                {selectedCustomer ? (
                  <div className="bg-gray-50 rounded-md p-4 border">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">
                          {selectedCustomer.company_name || selectedCustomer.full_name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim() || 'Unbekannter Kunde'}
                        </div>
                        {selectedCustomer.customer_number && (
                          <div className="text-xs text-gray-400">Kd.-Nr.: {selectedCustomer.customer_number}</div>
                        )}
                        {(selectedCustomer.contact_name || selectedCustomer.contact_person) && (
                          <div className="text-sm text-gray-600">{selectedCustomer.contact_name || selectedCustomer.contact_person}</div>
                        )}
                        <div className="text-sm text-gray-500">
                          {selectedCustomer.street || selectedCustomer.addresses?.[0]?.street || ''} {selectedCustomer.house_number || selectedCustomer.addresses?.[0]?.house_number || ''}<br />
                          {selectedCustomer.postal_code || selectedCustomer.addresses?.[0]?.postal_code || ''} {selectedCustomer.city || selectedCustomer.addresses?.[0]?.city || ''}
                        </div>
                        {(selectedCustomer.email || selectedCustomer.primary_email || selectedCustomer.emails?.[0]?.email) && (
                          <div className="text-sm text-blue-600">{selectedCustomer.email || selectedCustomer.primary_email || selectedCustomer.emails?.[0]?.email}</div>
                        )}
                      </div>
                      <button
                        onClick={clearCustomer}
                        className="text-red-600 hover:text-red-800"
                      >
                        <XCircleIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchCustomers()}
                        placeholder="Kundenname oder -nummer..."
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <button
                        onClick={searchCustomers}
                        disabled={searchingCustomers}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        {searchingCustomers ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                        ) : (
                          <MagnifyingGlassIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Customer Search Results */}
                    {customers.length > 0 && (
                      <div className="mt-2 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {customers.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{c.full_name || `${c.first_name || ''} ${c.last_name || ''}`}</div>
                            <div className="text-sm text-gray-600">{c.customer_number || ''}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Referenzen */}
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-3">Referenzen</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Projekt-Referenz</label>
                    <input
                      type="text"
                      value={order.project_reference}
                      onChange={(e) => setOrder(prev => ({ ...prev, project_reference: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Kunden-Bestellnummer</label>
                    <input
                      type="text"
                      value={order.customer_order_number}
                      onChange={(e) => setOrder(prev => ({ ...prev, customer_order_number: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">USt-IdNr. <span className="text-sm text-gray-400">(optional)</span></label>
                    {selectedCustomer && selectedCustomer.country === 'Deutschland' ? (
                      <div className="mt-1 text-sm text-gray-500">USt-IdNr. normalerweise nicht erforderlich für deutsche Kunden. Falls vorhanden, tragen Sie sie bitte manuell ein.</div>
                    ) : (
                      <input
                        type="text"
                        value={order.vat_id}
                        onChange={(e) => setOrder(prev => ({ ...prev, vat_id: e.target.value }))}
                        placeholder="z. B. DE123456789"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Notizen */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auftragsnotizen</label>
                <textarea
                  rows={3}
                  value={order.order_notes}
                  onChange={(e) => setOrder(prev => ({ ...prev, order_notes: e.target.value }))}
                  placeholder="Notizen für Auftragsbestätigung..."
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produktionsnotizen</label>
                <textarea
                  rows={3}
                  value={order.production_notes}
                  onChange={(e) => setOrder(prev => ({ ...prev, production_notes: e.target.value }))}
                  placeholder="Interne Notizen für Produktion..."
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lieferhinweise</label>
                <textarea
                  rows={3}
                  value={order.delivery_notes_text}
                  onChange={(e) => setOrder(prev => ({ ...prev, delivery_notes_text: e.target.value }))}
                  placeholder="Hinweise für Lieferung..."
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 pt-6 border-t flex justify-between">
              <button
                onClick={() => navigate('/sales/order-processing')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <div className="space-x-3">
                <button
                  onClick={handleSave}
                  disabled={saving || !order.customer}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Speichern...' : 'Speichern & weiter zu Positionen'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: POSITIONEN ==================== */}
        {activeTab === 'positionen' && (
          <div className="p-6">
            {/* Header with Summary */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Auftragspositionen</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {order.items.length} Position(en)
                </p>
              </div>
              <button
                onClick={() => {
                  const maxPos = order.items.length > 0 
                    ? Math.max(...order.items.map(i => i.position || 0)) 
                    : 0;
                  setOrder(prev => ({
                    ...prev,
                    items: [...prev.items, {
                      position: maxPos + 1,
                      article_number: '',
                      name: '',
                      description: '',
                      quantity: 1,
                      unit: 'Stk',
                      purchase_price: 0,
                      list_price: 0,
                      discount_percent: 0,
                      final_price: 0,
                      currency: 'EUR'
                    }]
                  }));
                }}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Position hinzufügen
              </button>
            </div>

            {/* Positions Table */}
            {order.items.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500 border-2 border-dashed border-gray-300">
                <ClipboardDocumentListIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="font-medium">Keine Positionen vorhanden</p>
                <p className="text-sm mt-1">Wählen Sie ein Angebot aus oder fügen Sie manuell Positionen hinzu.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Pos.</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Artikel-Nr.</th>
                      <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bezeichnung</th>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Menge</th>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Einh.</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">EK</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">VK</th>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Rab.%</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Endpr.</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Gesamt</th>
                      <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Akt.</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.items.map((item, index) => {
                      const quantity = parseFloat(item.quantity) || 0;
                      const listPrice = parseFloat(item.list_price) || 0;
                      const discount = parseFloat(item.discount_percent) || 0;
                      const finalPrice = listPrice * (1 - discount / 100);
                      const totalPrice = quantity * finalPrice;
                      const purchasePrice = parseFloat(item.purchase_price) || 0;
                      const totalCost = quantity * purchasePrice;
                      const margin = totalPrice - totalCost;
                      const marginPercent = totalCost > 0 ? (margin / totalCost * 100) : 0;

                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          {/* Position */}
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={item.position_display || item.position || index + 1}
                              onChange={(e) => {
                                const newItems = [...order.items];
                                newItems[index] = { 
                                  ...newItems[index], 
                                  position_display: e.target.value,
                                  // Try to parse main position number for sorting
                                  position: parseInt(e.target.value) || newItems[index].position || index + 1
                                };
                                setOrder(prev => ({ ...prev, items: newItems }));
                              }}
                              className="w-16 text-center rounded border-gray-300 text-sm"
                              title="Position (z.B. 5 oder 5.01 für Unterpositionen)"
                            />
                          </td>
                          {/* Artikel-Nr. */}
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={item.article_number || ''}
                              onChange={(e) => {
                                const newItems = [...order.items];
                                newItems[index] = { ...newItems[index], article_number: e.target.value };
                                setOrder(prev => ({ ...prev, items: newItems }));
                              }}
                              className="w-full rounded border-gray-300 text-sm"
                              placeholder="Art.-Nr."
                            />
                          </td>
                          {/* Bezeichnung */}
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={item.name || ''}
                              onChange={(e) => {
                                const newItems = [...order.items];
                                newItems[index] = { ...newItems[index], name: e.target.value };
                                setOrder(prev => ({ ...prev, items: newItems }));
                              }}
                              className={`w-full rounded border-gray-300 text-sm mb-1 ${item.is_group_header ? 'font-semibold bg-blue-50' : ''}`}
                              placeholder="Bezeichnung"
                            />
                            <textarea
                              rows={1}
                              value={item.description || ''}
                              onChange={(e) => {
                                const newItems = [...order.items];
                                newItems[index] = { ...newItems[index], description: e.target.value };
                                setOrder(prev => ({ ...prev, items: newItems }));
                              }}
                              className="w-full rounded border-gray-300 text-xs text-gray-600"
                              placeholder="Beschreibung (optional)"
                            />
                          </td>
                          {/* Menge */}
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.quantity || 1}
                              onChange={(e) => {
                                const newItems = [...order.items];
                                const qty = parseFloat(e.target.value) || 1;
                                const lp = parseFloat(newItems[index].list_price) || 0;
                                const disc = parseFloat(newItems[index].discount_percent) || 0;
                                const fp = lp * (1 - disc / 100);
                                newItems[index] = { ...newItems[index], quantity: qty, final_price: fp };
                                setOrder(prev => ({ ...prev, items: newItems }));
                              }}
                              className="w-16 text-center rounded border-gray-300 text-sm"
                            />
                          </td>
                          {/* Einheit */}
                          <td className="px-3 py-2">
                            <select
                              value={item.unit || 'Stk'}
                              onChange={(e) => {
                                const newItems = [...order.items];
                                newItems[index] = { ...newItems[index], unit: e.target.value };
                                setOrder(prev => ({ ...prev, items: newItems }));
                              }}
                              className="w-full rounded border-gray-300 text-sm"
                            >
                              <option value="Stk">Stk</option>
                              <option value="Set">Set</option>
                              <option value="m">m</option>
                              <option value="kg">kg</option>
                              <option value="Std">Std</option>
                              <option value="Psch">Psch</option>
                            </select>
                          </td>
                          {/* EK-Preis */}
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.purchase_price || ''}
                              onChange={(e) => {
                                const newItems = [...order.items];
                                newItems[index] = { ...newItems[index], purchase_price: parseFloat(e.target.value) || 0 };
                                setOrder(prev => ({ ...prev, items: newItems }));
                              }}
                              className="w-24 text-right rounded border-gray-300 text-sm"
                              placeholder="0.00"
                            />
                          </td>
                          {/* VK-Preis */}
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.list_price || ''}
                              onChange={(e) => {
                                const newItems = [...order.items];
                                const lp = parseFloat(e.target.value) || 0;
                                const disc = parseFloat(newItems[index].discount_percent) || 0;
                                const fp = lp * (1 - disc / 100);
                                newItems[index] = { ...newItems[index], list_price: lp, final_price: fp };
                                setOrder(prev => ({ ...prev, items: newItems }));
                              }}
                              className="w-24 text-right rounded border-gray-300 text-sm"
                              placeholder="0.00"
                            />
                          </td>
                          {/* Rabatt */}
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={item.discount_percent || ''}
                              onChange={(e) => {
                                const newItems = [...order.items];
                                const disc = parseFloat(e.target.value) || 0;
                                const lp = parseFloat(newItems[index].list_price) || 0;
                                const fp = lp * (1 - disc / 100);
                                newItems[index] = { ...newItems[index], discount_percent: disc, final_price: fp };
                                setOrder(prev => ({ ...prev, items: newItems }));
                              }}
                              className="w-16 text-center rounded border-gray-300 text-sm"
                              placeholder="0"
                            />
                          </td>
                          {/* Endpreis */}
                          <td className="px-3 py-2 text-right">
                            <span className="text-sm font-medium text-gray-900">
                              {finalPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </span>
                          </td>
                          {/* Gesamt */}
                          <td className="px-3 py-2 text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              {totalPrice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </div>
                            {purchasePrice > 0 && (
                              <div className={`text-xs ${marginPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                Marge: {marginPercent.toFixed(1)}%
                              </div>
                            )}
                          </td>
                          {/* Aktion */}
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => {
                                const newItems = order.items.filter((_, i) => i !== index);
                                setOrder(prev => ({ ...prev, items: newItems }));
                              }}
                              className="text-red-600 hover:text-red-800 p-1"
                              title="Position löschen"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals Summary */}
            {order.items.length > 0 && (
              <div className="mt-6 border-t pt-6">
                <div className="flex justify-end">
                  <div className="w-96 bg-gray-50 rounded-lg p-4">
                    <div className="space-y-2">
                      {/* Netto */}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Nettosumme:</span>
                        <span className="font-medium">
                          {order.items.reduce((sum, item) => {
                            const qty = parseFloat(item.quantity) || 0;
                            const lp = parseFloat(item.list_price) || 0;
                            const disc = parseFloat(item.discount_percent) || 0;
                            return sum + qty * lp * (1 - disc / 100);
                          }, 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                      </div>
                      {/* MwSt */}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">MwSt. ({order.tax_rate || 19}%):</span>
                        <span className="font-medium">
                          {(order.items.reduce((sum, item) => {
                            const qty = parseFloat(item.quantity) || 0;
                            const lp = parseFloat(item.list_price) || 0;
                            const disc = parseFloat(item.discount_percent) || 0;
                            return sum + qty * lp * (1 - disc / 100);
                          }, 0) * (parseFloat(order.tax_rate) || 19) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                      </div>
                      {/* Brutto */}
                      <div className="flex justify-between text-base font-semibold border-t pt-2 mt-2">
                        <span>Gesamtbetrag:</span>
                        <span className="text-blue-600">
                          {(order.items.reduce((sum, item) => {
                            const qty = parseFloat(item.quantity) || 0;
                            const lp = parseFloat(item.list_price) || 0;
                            const disc = parseFloat(item.discount_percent) || 0;
                            return sum + qty * lp * (1 - disc / 100);
                          }, 0) * (1 + (parseFloat(order.tax_rate) || 19) / 100)).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </span>
                      </div>
                      {/* Marge */}
                      {order.items.some(i => parseFloat(i.purchase_price) > 0) && (
                        <div className="flex justify-between text-sm border-t pt-2 mt-2">
                          <span className="text-gray-600">Gesamtmarge:</span>
                          <span className={`font-medium ${
                            order.items.reduce((sum, item) => {
                              const qty = parseFloat(item.quantity) || 0;
                              const lp = parseFloat(item.list_price) || 0;
                              const disc = parseFloat(item.discount_percent) || 0;
                              const pp = parseFloat(item.purchase_price) || 0;
                              return sum + qty * (lp * (1 - disc / 100) - pp);
                            }, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {order.items.reduce((sum, item) => {
                              const qty = parseFloat(item.quantity) || 0;
                              const lp = parseFloat(item.list_price) || 0;
                              const disc = parseFloat(item.discount_percent) || 0;
                              const pp = parseFloat(item.purchase_price) || 0;
                              return sum + qty * (lp * (1 - disc / 100) - pp);
                            }, 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 pt-6 border-t flex justify-between">
              <button
                onClick={() => setActiveTab('basisinfos')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                ← Zurück zu Basisinfos
              </button>
              <div className="space-x-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
                {isEditMode && order.status === 'angelegt' && (
                  <button
                    onClick={() => setActiveTab('auftragsbestaetigung')}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                  >
                    Weiter zur Auftragsbestätigung →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: AUFTRAGSBESTÄTIGUNG ==================== */}
        {activeTab === 'auftragsbestaetigung' && (
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Auftragsbestätigung</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {order.order_number 
                    ? `Auftrag ${order.order_number} bestätigt am ${order.confirmed_at ? new Date(order.confirmed_at).toLocaleDateString('de-DE') : '-'}`
                    : 'Auftrag noch nicht bestätigt'
                  }
                </p>
              </div>
            </div>

            {/* Kunden-Bestelldokument Upload */}
            <div className="bg-gray-50 border rounded-lg p-4 mb-6">
              <h3 className="text-md font-medium text-gray-900 mb-3">
                <ArrowUpTrayIcon className="h-5 w-5 inline mr-2" />
                Kunden-Bestelldokument
              </h3>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.png"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file || !order.id) return;
                    const formData = new FormData();
                    formData.append('customer_document', file);
                    try {
                      await api.patch(`/customer-orders/customer-orders/${order.id}/`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                      loadOrder(order.id);
                      alert('Dokument hochgeladen!');
                    } catch (err) {
                      alert('Fehler beim Hochladen');
                    }
                  }}
                  className="text-sm"
                />
                {order.customer_document && (
                  <a
                    href={order.customer_document}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 bg-blue-50 rounded"
                  >
                    <EyeIcon className="h-4 w-4 mr-1" />
                    Ansehen
                  </a>
                )}
              </div>
            </div>

            {/* Referenzen & Termine */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-md font-medium text-gray-900 mb-3">Referenzen</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Projekt-Referenz</label>
                    <input
                      type="text"
                      value={order.project_reference}
                      onChange={(e) => setOrder(prev => ({ ...prev, project_reference: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Kunden-Bestellnummer</label>
                    <input
                      type="text"
                      value={order.customer_order_number}
                      onChange={(e) => setOrder(prev => ({ ...prev, customer_order_number: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">USt-IdNr. Kunde</label>
                    <input
                      type="text"
                      value={order.vat_id}
                      onChange={(e) => setOrder(prev => ({ ...prev, vat_id: e.target.value }))}
                      placeholder="z. B. DE123456789"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-md font-medium text-gray-900 mb-3">Termine</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Auftragsdatum</label>
                    <input
                      type="date"
                      value={order.order_date}
                      onChange={(e) => setOrder(prev => ({ ...prev, order_date: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Liefertermin</label>
                    <input
                      type="date"
                      value={order.delivery_date}
                      onChange={(e) => setOrder(prev => ({ ...prev, delivery_date: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Konditionen & Steuer */}
            <div className="bg-white border rounded-lg p-4 mb-6">
              <h3 className="text-md font-medium text-gray-900 mb-3">Konditionen</h3>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Zahlungsbedingung</label>
                  <select
                    value={order.payment_term}
                    onChange={(e) => setOrder(prev => ({ ...prev, payment_term: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="">-- Auswählen --</option>
                    {paymentTerms.map(term => (
                      <option key={term.id} value={term.id}>{term.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lieferbedingung</label>
                  <select
                    value={order.delivery_term}
                    onChange={(e) => setOrder(prev => ({ ...prev, delivery_term: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="">-- Auswählen --</option>
                    {deliveryTerms.map(term => (
                      <option key={term.id} value={term.id}>{term.incoterm}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Garantie</label>
                  <select
                    value={order.warranty_term}
                    onChange={(e) => setOrder(prev => ({ ...prev, warranty_term: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="">-- Auswählen --</option>
                    {warrantyTerms.map(term => (
                      <option key={term.id} value={term.id}>{term.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">MwSt. %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={order.tax_rate}
                    onChange={(e) => setOrder(prev => ({ ...prev, tax_rate: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={order.tax_included}
                      onChange={(e) => setOrder(prev => ({ ...prev, tax_included: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">inkl. MwSt.</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Bestätigungsadresse */}
            <div className="bg-white border rounded-lg p-4 mb-6">
              <h3 className="text-md font-medium text-gray-900 mb-3">Bestätigungsadresse</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AddressSelector
                  customer={selectedCustomer}
                  value={order.confirmation_address}
                  onChange={(val) => setOrder(prev => ({ ...prev, confirmation_address: val }))}
                  label="Adresse für Auftragsbestätigung"
                  addressType="Einkauf"
                  email={true}
                  emailValue={order.confirmation_email}
                  onEmailChange={(val) => setOrder(prev => ({ ...prev, confirmation_email: val }))}
                />
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sachbearbeiter (für AB & Unterschrift)</label>
                    <select
                      value={order.sales_person || ''}
                      onChange={(e) => setOrder(prev => ({ ...prev, sales_person: e.target.value || '' }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    >
                      <option value="">-- Auswählen --</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={String(emp.user_id || emp.id)}>
                          {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Auftragsnotizen (für Kunden)</label>
                    <textarea
                      rows={4}
                      value={order.order_notes}
                      onChange={(e) => setOrder(prev => ({ ...prev, order_notes: e.target.value }))}
                      placeholder="Hinweise die auf der AB erscheinen..."
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Status Info Card */}
            <div className={`rounded-lg p-6 mb-6 ${
              order.status === 'angelegt' ? 'bg-yellow-50 border border-yellow-200' :
              order.status === 'bestaetigt' ? 'bg-green-50 border border-green-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <div className="flex items-center">
                <div className={`flex-shrink-0 ${
                  order.status === 'angelegt' ? 'text-yellow-600' :
                  order.status === 'bestaetigt' ? 'text-green-600' :
                  'text-blue-600'
                }`}>
                  {order.status === 'angelegt' ? (
                    <ExclamationTriangleIcon className="h-8 w-8" />
                  ) : (
                    <CheckCircleIcon className="h-8 w-8" />
                  )}
                </div>
                <div className="ml-4">
                  <h3 className={`text-lg font-medium ${
                    order.status === 'angelegt' ? 'text-yellow-800' :
                    order.status === 'bestaetigt' ? 'text-green-800' :
                    'text-blue-800'
                  }`}>
                    {order.status === 'angelegt' && 'Auftrag bereit zur Bestätigung'}
                    {order.status === 'bestaetigt' && 'Auftrag bestätigt'}
                    {order.status !== 'angelegt' && order.status !== 'bestaetigt' && `Status: ${order.status}`}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    order.status === 'angelegt' ? 'text-yellow-700' :
                    order.status === 'bestaetigt' ? 'text-green-700' :
                    'text-blue-700'
                  }`}>
                    {order.status === 'angelegt' && 'Mit der Bestätigung wird eine Auftragsnummer generiert.'}
                    {order.status !== 'angelegt' && order.order_number && `Auftragsnummer: ${order.order_number}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Confirm Button or PDF Actions */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => setActiveTab('positionen')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                ← Zurück zu Positionen
              </button>
              
              <div className="space-x-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  {saving ? 'Speichern...' : 'Speichern'}
                </button>
                {order.status === 'angelegt' ? (
                  <button
                    onClick={async () => {
                      if (!order.customer || order.items.length === 0) {
                        alert('Bitte wählen Sie einen Kunden und fügen Sie mindestens eine Position hinzu.');
                        return;
                      }
                      if (!window.confirm('Möchten Sie diesen Auftrag bestätigen? Eine Auftragsnummer wird generiert.')) {
                        return;
                      }
                      try {
                        await api.post(`/customer-orders/customer-orders/${order.id}/confirm/`, {});
                        // Reload full order details (includes sales_person)
                        await loadOrder(order.id);
                        alert(`Auftrag bestätigt!`);
                      } catch (err) {
                        const errMsg = err.response?.data?.error || err.response?.data?.detail || 'Unbekannter Fehler';
                        alert(`Fehler: ${errMsg}`);
                      }
                    }}
                    disabled={!order.customer || order.items.length === 0}
                    className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    Auftrag bestätigen
                  </button>
                ) : (
                  <>
                    <button
                      onClick={async () => {
                        try {
                          const response = await api.post(
                            `/customer-orders/customer-orders/${order.id}/generate_confirmation_pdf/`,
                            {},
                            { responseType: 'blob' }
                          );
                          const blob = new Blob([response.data], { type: 'application/pdf' });
                          const url = window.URL.createObjectURL(blob);
                          window.open(url, '_blank');
                        } catch (err) {
                          alert('Fehler beim Generieren der PDF');
                        }
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700"
                    >
                      <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                      AB als PDF
                    </button>
                    <button
                      onClick={() => setActiveTab('lieferschein')}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Weiter zu Lieferschein →
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: LIEFERSCHEIN ==================== */}
        {activeTab === 'lieferschein' && (
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Lieferscheine</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {order.delivery_notes?.length || 0} Lieferschein(e) erstellt
                </p>
              </div>
            </div>

            {order.status !== 'angelegt' && order.status !== 'storniert' && (
              <>
                {/* Neuer Lieferschein Formular */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="text-md font-medium text-blue-900 mb-4">Neuen Lieferschein erstellen</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    {/* Lieferadresse */}
                    <div>
                      <AddressSelector
                        customer={selectedCustomer}
                        value={deliveryNoteDraft.shipping_address}
                        onChange={(val) => setDeliveryNoteDraft(prev => ({ ...prev, shipping_address: val }))}
                        label="Lieferadresse"
                        addressType="Lieferung"
                      />
                    </div>
                    
                    {/* Lieferdaten */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Lieferdatum</label>
                        <input
                          type="date"
                          value={deliveryNoteDraft.delivery_date}
                          onChange={(e) => setDeliveryNoteDraft(prev => ({ ...prev, delivery_date: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Spediteur/Versand</label>
                        <input
                          type="text"
                          value={deliveryNoteDraft.carrier}
                          onChange={(e) => setDeliveryNoteDraft(prev => ({ ...prev, carrier: e.target.value }))}
                          placeholder="z. B. DHL, UPS, Selbstabholung"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Tracking-Nr.</label>
                        <input
                          type="text"
                          value={deliveryNoteDraft.tracking_number}
                          onChange={(e) => setDeliveryNoteDraft(prev => ({ ...prev, tracking_number: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notizen */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">Lieferhinweise</label>
                    <textarea
                      rows={2}
                      value={deliveryNoteDraft.notes}
                      onChange={(e) => setDeliveryNoteDraft(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Hinweise für den Lieferschein..."
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {/* Positionen auswählen */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">Positionen für diesen Lieferschein</label>
                      <div className="space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allOpen = order.items.filter(item => !item.is_delivered && !item.is_group_header).map(i => i.id);
                            setDeliveryNoteDraft(prev => ({ ...prev, selectedItemIds: allOpen }));
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Alle offenen
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveryNoteDraft(prev => ({ ...prev, selectedItemIds: [] }))}
                          className="text-xs text-gray-600 hover:text-gray-800"
                        >
                          Keine
                        </button>
                      </div>
                    </div>
                    <div className="border rounded-md max-h-48 overflow-y-auto bg-white">
                      {order.items.filter(item => !item.is_group_header).map((item, idx) => {
                        const isDelivered = item.is_delivered;
                        const isSelected = deliveryNoteDraft.selectedItemIds.includes(item.id);
                        return (
                          <label 
                            key={item.id || idx} 
                            className={`flex items-center px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${isDelivered ? 'bg-green-50 opacity-60' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isDelivered}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDeliveryNoteDraft(prev => ({
                                    ...prev,
                                    selectedItemIds: [...prev.selectedItemIds, item.id]
                                  }));
                                } else {
                                  setDeliveryNoteDraft(prev => ({
                                    ...prev,
                                    selectedItemIds: prev.selectedItemIds.filter(id => id !== item.id)
                                  }));
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-3 text-sm flex-1">
                              <span className="font-medium">{item.position || idx + 1}.</span>{' '}
                              {item.name}
                              <span className="text-gray-500 ml-2">({item.quantity} {item.unit})</span>
                            </span>
                            {isDelivered && (
                              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                                ✓ Geliefert ({item.delivery_note_number})
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {deliveryNoteDraft.selectedItemIds.length} Position(en) ausgewählt
                    </p>
                  </div>

                  {/* Erstellen Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        if (deliveryNoteDraft.selectedItemIds.length === 0) {
                          alert('Bitte wählen Sie mindestens eine Position aus.');
                          return;
                        }
                        try {
                          const response = await api.post('/customer-orders/delivery-notes/', {
                            order: order.id,
                            delivery_date: deliveryNoteDraft.delivery_date || null,
                            shipping_address: deliveryNoteDraft.shipping_address || order.shipping_address,
                            carrier: deliveryNoteDraft.carrier,
                            tracking_number: deliveryNoteDraft.tracking_number,
                            notes: deliveryNoteDraft.notes,
                            item_ids: deliveryNoteDraft.selectedItemIds
                          });
                          const data = response.data;
                          // Reload order to get updated items
                          const orderRes = await api.get(`/customer-orders/customer-orders/${order.id}/`);
                          setOrder(prev => ({
                            ...prev,
                            ...orderRes.data,
                            items: orderRes.data.items || [],
                            delivery_notes: orderRes.data.delivery_notes || [],
                            invoices: orderRes.data.invoices || []
                          }));
                          // Reset draft
                          setDeliveryNoteDraft({
                            delivery_date: new Date().toISOString().split('T')[0],
                            shipping_address: '',
                            carrier: '',
                            tracking_number: '',
                            notes: '',
                            selectedItemIds: []
                          });
                          alert(`Lieferschein ${data.delivery_note_number} erstellt!`);
                        } catch (err) {
                          const errMsg = err.response?.data ? JSON.stringify(err.response.data) : 'Netzwerkfehler';
                          alert(`Fehler: ${errMsg}`);
                        }
                      }}
                      disabled={deliveryNoteDraft.selectedItemIds.length === 0}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Lieferschein erstellen
                    </button>
                  </div>
                </div>
              </>
            )}

            {order.status === 'angelegt' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 text-sm">
                  <ExclamationTriangleIcon className="h-5 w-5 inline mr-2" />
                  Der Auftrag muss zuerst bestätigt werden, bevor Lieferscheine erstellt werden können.
                </p>
              </div>
            )}

            {/* Erstellte Lieferscheine */}
            {order.delivery_notes && order.delivery_notes.length > 0 && (
              <div className="bg-white border rounded-lg overflow-hidden mb-6">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h3 className="text-sm font-medium text-gray-900">Erstellte Lieferscheine</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {order.delivery_notes.map((dn, idx) => (
                    <div key={idx} className="p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{dn.delivery_note_number}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Lieferdatum: {dn.delivery_date ? new Date(dn.delivery_date).toLocaleDateString('de-DE') : '-'} • 
                            Erstellt: {new Date(dn.created_at).toLocaleDateString('de-DE')}
                          </p>
                          {dn.carrier && <p className="text-xs text-gray-500">Versand: {dn.carrier}</p>}
                          {dn.tracking_number && <p className="text-xs text-gray-500">Tracking: {dn.tracking_number}</p>}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={async () => {
                              try {
                                const response = await api.post(
                                  `/customer-orders/delivery-notes/${dn.id}/generate_pdf/`,
                                  {},
                                  { responseType: 'blob' }
                                );
                                const blob = new Blob([response.data], { type: 'application/pdf' });
                                const url = window.URL.createObjectURL(blob);
                                window.open(url, '_blank');
                              } catch (err) {
                                alert('Fehler beim PDF-Download');
                              }
                            }}
                            className="inline-flex items-center px-2 py-1 text-sm text-blue-600 hover:text-blue-800 bg-blue-50 rounded"
                          >
                            <DocumentArrowDownIcon className="h-4 w-4 mr-1" /> PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => setActiveTab('auftragsbestaetigung')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                ← Zurück zur AB
              </button>
              <button
                onClick={() => setActiveTab('rechnung')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Weiter zu Rechnung →
              </button>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: RECHNUNG ==================== */}
        {activeTab === 'rechnung' && (
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Rechnungen</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {order.invoices?.length || 0} Rechnung(en) erstellt
                </p>
              </div>
            </div>

            {order.status !== 'angelegt' && order.status !== 'storniert' && (
              <>
                {/* Neue Rechnung Formular */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <h3 className="text-md font-medium text-green-900 mb-4">Neue Rechnung erstellen</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    {/* Rechnungsadresse */}
                    <div>
                      <AddressSelector
                        customer={selectedCustomer}
                        value={invoiceDraft.billing_address || order.billing_address}
                        onChange={(val) => setInvoiceDraft(prev => ({ ...prev, billing_address: val }))}
                        label="Rechnungsadresse"
                        addressType="Rechnung"
                      />
                    </div>
                    
                    {/* Rechnungsdaten */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Rechnungsdatum</label>
                        <input
                          type="date"
                          value={invoiceDraft.invoice_date}
                          onChange={(e) => setInvoiceDraft(prev => ({ ...prev, invoice_date: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Fälligkeitsdatum</label>
                        <input
                          type="date"
                          value={invoiceDraft.due_date}
                          onChange={(e) => setInvoiceDraft(prev => ({ ...prev, due_date: e.target.value }))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Rechnungshinweise</label>
                        <textarea
                          rows={2}
                          value={invoiceDraft.notes}
                          onChange={(e) => setInvoiceDraft(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Hinweise für die Rechnung..."
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Positionen auswählen */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">Positionen für diese Rechnung</label>
                      <div className="space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allOpen = order.items.filter(item => !item.is_invoiced && !item.is_group_header).map(i => i.id);
                            setInvoiceDraft(prev => ({ ...prev, selectedItemIds: allOpen }));
                          }}
                          className="text-xs text-green-600 hover:text-green-800"
                        >
                          Alle offenen
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvoiceDraft(prev => ({ ...prev, selectedItemIds: [] }))}
                          className="text-xs text-gray-600 hover:text-gray-800"
                        >
                          Keine
                        </button>
                      </div>
                    </div>
                    <div className="border rounded-md max-h-48 overflow-y-auto bg-white">
                      {order.items.filter(item => !item.is_group_header).map((item, idx) => {
                        const isInvoiced = item.is_invoiced;
                        const isSelected = invoiceDraft.selectedItemIds.includes(item.id);
                        const lp = parseFloat(item.list_price) || 0;
                        const disc = parseFloat(item.discount_percent) || 0;
                        const fp = lp * (1 - disc / 100);
                        const total = fp * (parseFloat(item.quantity) || 0);
                        return (
                          <label 
                            key={item.id || idx} 
                            className={`flex items-center px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 ${isInvoiced ? 'bg-green-50 opacity-60' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isInvoiced}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setInvoiceDraft(prev => ({
                                    ...prev,
                                    selectedItemIds: [...prev.selectedItemIds, item.id]
                                  }));
                                } else {
                                  setInvoiceDraft(prev => ({
                                    ...prev,
                                    selectedItemIds: prev.selectedItemIds.filter(id => id !== item.id)
                                  }));
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="ml-3 text-sm flex-1">
                              <span className="font-medium">{item.position || idx + 1}.</span>{' '}
                              {item.name}
                              <span className="text-gray-500 ml-2">
                                ({item.quantity} {item.unit} × {fp.toFixed(2)} € = {total.toFixed(2)} €)
                              </span>
                            </span>
                            {isInvoiced && (
                              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                                ✓ Berechnet
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {invoiceDraft.selectedItemIds.length} Position(en) ausgewählt
                    </p>
                  </div>

                  {/* Erstellen Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        if (invoiceDraft.selectedItemIds.length === 0) {
                          alert('Bitte wählen Sie mindestens eine Position aus.');
                          return;
                        }
                        try {
                          const response = await api.post('/customer-orders/invoices/', {
                            order: order.id,
                            invoice_date: invoiceDraft.invoice_date || null,
                            due_date: invoiceDraft.due_date || null,
                            billing_address: invoiceDraft.billing_address || order.billing_address,
                            notes: invoiceDraft.notes,
                            item_ids: invoiceDraft.selectedItemIds
                          });
                          const data = response.data;
                          // Reload order to get updated items
                          const orderRes = await api.get(`/customer-orders/customer-orders/${order.id}/`);
                          setOrder(prev => ({
                            ...prev,
                            ...orderRes.data,
                            items: orderRes.data.items || [],
                            delivery_notes: orderRes.data.delivery_notes || [],
                            invoices: orderRes.data.invoices || []
                          }));
                          // Reset draft
                          setInvoiceDraft({
                            invoice_date: new Date().toISOString().split('T')[0],
                            due_date: '',
                            billing_address: '',
                            notes: '',
                            selectedItemIds: []
                          });
                          alert(`Rechnung ${data.invoice_number} erstellt!`);
                        } catch (err) {
                          const errMsg = err.response?.data ? JSON.stringify(err.response.data) : 'Netzwerkfehler';
                          alert(`Fehler: ${errMsg}`);
                        }
                      }}
                      disabled={invoiceDraft.selectedItemIds.length === 0}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Rechnung erstellen
                    </button>
                  </div>
                </div>
              </>
            )}

            {order.status === 'angelegt' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-yellow-800 text-sm">
                  <ExclamationTriangleIcon className="h-5 w-5 inline mr-2" />
                  Der Auftrag muss zuerst bestätigt werden, bevor Rechnungen erstellt werden können.
                </p>
              </div>
            )}

            {/* Erstellte Rechnungen */}
            {order.invoices && order.invoices.length > 0 && (
              <div className="bg-white border rounded-lg overflow-hidden mb-6">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h3 className="text-sm font-medium text-gray-900">Erstellte Rechnungen</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {order.invoices.map((inv, idx) => (
                    <div key={idx} className="p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{inv.invoice_number}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Rechnungsdatum: {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('de-DE') : '-'} • 
                            Fällig: {inv.due_date ? new Date(inv.due_date).toLocaleDateString('de-DE') : '-'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Betrag: {parseFloat(inv.gross_amount || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} € •
                            Status: <span className={inv.status === 'paid' ? 'text-green-600' : inv.status === 'overdue' ? 'text-red-600' : 'text-yellow-600'}>{inv.status}</span>
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* PDF Download */}
                          <button
                            onClick={async () => {
                              try {
                                const response = await api.post(
                                  `/customer-orders/invoices/${inv.id}/generate_pdf/`,
                                  {},
                                  { responseType: 'blob' }
                                );
                                const blob = new Blob([response.data], { type: 'application/pdf' });
                                const url = window.URL.createObjectURL(blob);
                                window.open(url, '_blank');
                              } catch (err) {
                                alert('Fehler beim PDF-Download');
                              }
                            }}
                            className="inline-flex items-center px-2 py-1 text-sm text-blue-600 hover:text-blue-800 bg-blue-50 rounded"
                            title="PDF-Rechnung herunterladen"
                          >
                            <DocumentArrowDownIcon className="h-4 w-4 mr-1" /> PDF
                          </button>
                          {/* XRechnung erstellen/herunterladen */}
                          <button
                            onClick={async () => {
                              try {
                                // Erst generieren
                                await api.post(`/customer-orders/invoices/${inv.id}/generate_xrechnung/`);
                                // Dann herunterladen
                                const response = await api.get(
                                  `/customer-orders/invoices/${inv.id}/download_xrechnung/`,
                                  { responseType: 'blob' }
                                );
                                const blob = new Blob([response.data], { type: 'application/xml' });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `XRechnung_${inv.invoice_number}.xml`;
                                a.click();
                                window.URL.revokeObjectURL(url);
                              } catch (err) {
                                const errMsg = err.response?.data?.error || err.response?.data?.message || 'Unbekannter Fehler';
                                alert(`Fehler bei XRechnung: ${errMsg}`);
                              }
                            }}
                            className="inline-flex items-center px-2 py-1 text-sm text-green-600 hover:text-green-800 bg-green-50 rounded"
                            title="XRechnung (XML nach EN 16931) erstellen und herunterladen"
                          >
                            <DocumentArrowDownIcon className="h-4 w-4 mr-1" /> XML
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => setActiveTab('lieferschein')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                ← Zurück zu Lieferschein
              </button>
              <button
                onClick={() => setActiveTab('zahlung')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Weiter zu Zahlung →
              </button>
            </div>
          </div>
        )}

        {/* ==================== TAB 6: ZAHLUNG ==================== */}
        {activeTab === 'zahlung' && (
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Zahlungen</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {order.payments?.length || 0} Zahlung(en) erfasst
                </p>
              </div>
              {order.invoices && order.invoices.length > 0 && (
                <button
                  onClick={() => {
                    const amount = prompt('Zahlungsbetrag eingeben:');
                    if (!amount) return;
                    const invoiceId = order.invoices[0]?.id;
                    if (!invoiceId) {
                      alert('Keine Rechnung vorhanden');
                      return;
                    }
                    fetch(`${process.env.REACT_APP_API_URL}/customer-orders/payments/`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        invoice: invoiceId,
                        amount: parseFloat(amount),
                        payment_date: new Date().toISOString().split('T')[0],
                        payment_method: 'ueberweisung'
                      })
                    }).then(r => r.json()).then(data => {
                      if (data.id) {
                        setOrder(prev => ({
                          ...prev,
                          payments: [...(prev.payments || []), data]
                        }));
                        alert('Zahlung erfasst!');
                      } else {
                        alert(`Fehler: ${JSON.stringify(data)}`);
                      }
                    }).catch(() => alert('Netzwerkfehler'));
                  }}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Zahlung erfassen
                </button>
              )}
            </div>

            {/* Payment Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-600">Gesamtbetrag</p>
                <p className="text-2xl font-bold text-blue-700">
                  {(order.items.reduce((sum, item) => {
                    const qty = parseFloat(item.quantity) || 0;
                    const lp = parseFloat(item.list_price) || 0;
                    const disc = parseFloat(item.discount_percent) || 0;
                    return sum + qty * lp * (1 - disc / 100);
                  }, 0) * (1 + (parseFloat(order.tax_rate) || 19) / 100)).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-600">Bezahlt</p>
                <p className="text-2xl font-bold text-green-700">
                  {(order.payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                </p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <p className="text-sm text-orange-600">Offen</p>
                <p className="text-2xl font-bold text-orange-700">
                  {((order.items.reduce((sum, item) => {
                    const qty = parseFloat(item.quantity) || 0;
                    const lp = parseFloat(item.list_price) || 0;
                    const disc = parseFloat(item.discount_percent) || 0;
                    return sum + qty * lp * (1 - disc / 100);
                  }, 0) * (1 + (parseFloat(order.tax_rate) || 19) / 100)) - (order.payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                </p>
              </div>
            </div>

            {/* Invoice Payment Status */}
            {order.invoices && order.invoices.length > 0 && (
              <div className="bg-white border rounded-lg overflow-hidden mb-6">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h3 className="text-sm font-medium text-gray-900">Rechnungen & Zahlungsstatus</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {order.invoices.map((inv, idx) => {
                    const invPayments = (order.payments || []).filter(p => p.invoice === inv.id);
                    const paid = invPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                    const total = parseFloat(inv.total_amount) || 0;
                    const open = total - paid;
                    return (
                      <div key={idx} className="p-4">
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <span className="font-medium">{inv.invoice_number}</span>
                            <span className="text-gray-500 text-sm ml-2">
                              Fällig: {new Date(inv.due_date).toLocaleDateString('de-DE')}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">{total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</span>
                            <span className={`ml-2 text-sm ${open <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                              {open <= 0 ? '✓ Bezahlt' : `Offen: ${open.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${paid >= total ? 'bg-green-500' : 'bg-yellow-500'}`}
                            style={{ width: `${Math.min((paid / total) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment History */}
            {order.payments && order.payments.length > 0 && (
              <div className="bg-white border rounded-lg overflow-hidden mb-6">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h3 className="text-sm font-medium text-gray-900">Zahlungshistorie</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rechnung</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Zahlungsart</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Referenz</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Betrag</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.payments.map((payment, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm">{new Date(payment.payment_date).toLocaleDateString('de-DE')}</td>
                        <td className="px-4 py-2 text-sm">{order.invoices?.find(i => i.id === payment.invoice)?.invoice_number || '-'}</td>
                        <td className="px-4 py-2 text-sm capitalize">{payment.payment_method?.replace('_', ' ') || '-'}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{payment.reference || '-'}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-green-600">
                          +{parseFloat(payment.amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* No Invoices Warning */}
            {(!order.invoices || order.invoices.length === 0) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center mb-6">
                <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                <p className="text-yellow-800 font-medium">Keine Rechnungen vorhanden</p>
                <p className="text-yellow-700 text-sm mt-1">
                  Erstellen Sie zuerst eine Rechnung, bevor Sie Zahlungen erfassen können.
                </p>
                <button
                  onClick={() => setActiveTab('rechnung')}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-yellow-300 rounded-md text-sm font-medium text-yellow-800 bg-white hover:bg-yellow-50"
                >
                  Zur Rechnungserstellung
                </button>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => setActiveTab('rechnung')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                ← Zurück zu Rechnung
              </button>
              <button
                onClick={() => navigate('/sales/order-processing')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700"
              >
                Zur Auftragsübersicht
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerOrderEdit;
