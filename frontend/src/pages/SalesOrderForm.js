import React, { useState, useEffect } from 'react';
/* eslint-disable react-hooks/exhaustive-deps */import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { 
  PlusIcon, ArrowRightIcon, ArrowLeftIcon, TrashIcon,
  UserGroupIcon, ClipboardDocumentListIcon, CheckCircleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const SalesOrderForm = () => {
  const navigate = useNavigate();
  const params = useParams();
  const [step, setStep] = useState(1);
  const [customerTerm, setCustomerTerm] = useState('');
  const [customers, setCustomers] = useState([]);
  const [quotationTerm, setQuotationTerm] = useState('');
  const [quotations, setQuotations] = useState([]);
  const [orderDraft, setOrderDraft] = useState({
    customer: null,
    quotation: null,
    documentFile: null,
    documentPreview: null,
    items: [],
    // Neue Felder für Bestellinformationen
    customer_order_number: '',
    customer_name: '',
    confirmation_address: {
      company: '',
      name: '',
      street: '',
      postal_code: '',
      city: '',
      country: 'DE'
    },
    shipping_address: {
      company: '',
      name: '',
      street: '',
      postal_code: '',
      city: '',
      country: 'DE'
    },
    billing_address: {
      company: '',
      name: '',
      street: '',
      postal_code: '',
      city: '',
      country: 'DE'
    },
    confirmation_email: '',
    billing_email: '',
    notes: '',
    // Flags für Adressen zu Kundendaten hinzufügen
    add_confirmation_to_customer: false,
    add_shipping_to_customer: false,
    add_billing_to_customer: false,
    // Umsatzsteuer-ID
    vat_id: ''
  });
  const [newItem, setNewItem] = useState({ name: '', article_number: '', quantity: 1, unit: 'Stück', list_price: 0 });

  // Additional state for product management
  const [tradingProducts, setTradingProducts] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  
  // State für Kundenadressen
  const [customerAddresses, setCustomerAddresses] = useState([]);

  // Tab configuration
  const tabs = [
    { id: 1, name: 'Kunde & Angebot', icon: UserGroupIcon, enabled: true },
    { id: 2, name: 'Positionen', icon: ClipboardDocumentListIcon, enabled: !!orderDraft.customer || !!orderDraft.quotation },
    { id: 3, name: 'Bestellinformationen', icon: CheckCircleIcon, enabled: (!!orderDraft.customer || !!orderDraft.quotation) && orderDraft.items.length > 0 },
    { id: 4, name: 'Abschluss', icon: CheckCircleIcon, enabled: (!!orderDraft.customer || !!orderDraft.quotation) && orderDraft.items.length > 0 }
  ];

  const changeTab = (tabId) => {
    setStep(tabId);
  };

  const searchCustomers = async () => {
    try {
      const params = new URLSearchParams();
      if (customerTerm) params.append('search', customerTerm);
      params.append('is_active', 'true');
      const res = await api.get(`/customers/customers/?${params.toString()}`);
      const data = res.data.results || res.data || [];
      const list = Array.isArray(data) ? data : [];
      // If exactly one result, auto-select it; otherwise show list
      if (list.length === 1) {
        setOrderDraft(prev => ({ ...prev, customer: list[0] }));
        setCustomers([]);
      } else {
        setCustomers(list);
      }
    } catch (e) {
      console.error(e);
      setCustomers([]);
    }
  };

  const searchQuotations = async () => {
    try {
      const params = new URLSearchParams();
      if (quotationTerm) params.append('search', quotationTerm);
      const res = await api.get(`/sales/quotations/?${params.toString()}`);
      const data = res.data.results || res.data || [];
      const list = Array.isArray(data) ? data : [];
      
      if (list.length === 1) {
        // auto-select full quotation
        try {
          const r = await api.get(`/sales/quotations/${list[0].id}/`);
          const full = r.data;
          
          const mapped = (full.items || []).map(i => {
            return {
              name: i.item_name || '',
              article_number: i.item_article_number || '',
              visitron_part_number: i.visitron_part_number || '',
              quantity: i.quantity,
              unit: 'Stück',
              list_price: i.unit_price || i.sale_price || 0,
              description: i.item_description || '',
              description_type: i.description_type || 'SHORT',
              purchase_price: i.purchase_price || 0,
              discount_percent: i.discount_percent || 0,
              final_price: i.unit_price || i.sale_price || 0,
              currency: 'EUR',
              position: i.position || 1  // Übernehme Position aus Angebot
            };
          });
          

          setOrderDraft(prev => ({ ...prev, quotation: full, items: mapped }));
        } catch (err) {
          console.error('Fehler beim Laden des Angebots:', err);
          setOrderDraft(prev => ({ ...prev, quotation: list[0] }));
        }
        setQuotations([]);
      } else {

        setQuotations(list);
      }
    } catch (e) {
      console.error('Search error:', e);
      setQuotations([]);
    }
  };

  // Load existing customer order when editing
  useEffect(() => {
    const id = params?.id;
    if (!id) return;
    const load = async () => {
      try {
        const res = await api.get(`/customer-orders/customer-orders/${id}/`);
        const data = res.data;
        const mappedItems = (data.items || []).map(i => ({
          name: i.name,
          article_number: i.article_number,
          quantity: i.quantity,
          unit: i.unit,
          list_price: i.list_price || 0,
          description: i.description || '',
          discount_percent: i.discount_percent || 0,
          final_price: i.final_price || 0,
          currency: i.currency || 'EUR'
        }));

        // Attempt to map customer and quotation if provided
        const customerObj = data.customer || null;
        const quotationObj = data.offer || null;

        setOrderDraft(prev => ({
          ...prev,
          customer: customerObj,
          quotation: quotationObj,
          items: mappedItems,
          documentPreview: data.order_document || null
        }));
      } catch (e) {
        console.error('Fehler beim Laden des Auftrags:', e);
        alert('Fehler beim Laden des Auftrags.');
      }
    };
    load();
  }, [params]);

  // Load products when entering items tab and no quotation is selected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (step === 2 && !orderDraft.quotation && !tradingProducts.length) {
      loadProducts();
    }
  }, [step, orderDraft.quotation]);

  const loadProducts = async () => {
    try {
      const [tradingRes] = await Promise.all([
        api.get('/suppliers/products/'),
      ]);
      
      const tradingData = tradingRes.data.results || tradingRes.data || [];
      
      setTradingProducts(tradingData);
    } catch (error) {
      console.error('Fehler beim Laden der Produkte:', error);
    }
  };

  // Product search functionality
  const searchProducts = (term) => {
    setProductSearchTerm(term);
    if (!term.trim()) {
      setFilteredProducts([]);
      return;
    }
    
    const allProducts = [
      ...tradingProducts.map(p => ({ ...p, type: 'trading', displayName: `${p.supplier_part_number || p.visitron_part_number || 'N/A'} - ${p.name} (Handelsware)` }))
    ];
    
    const filtered = allProducts.filter(p => 
      p.displayName.toLowerCase().includes(term.toLowerCase()) ||
      (p.article_number && p.article_number.toLowerCase().includes(term.toLowerCase()))
    );
    
    setFilteredProducts(filtered);
  };

  const addProductToOrder = (product) => {
    // Finde die höchste Position und erhöhe um 1
    const maxPosition = orderDraft.items.length > 0 
      ? Math.max(...orderDraft.items.map(item => item.position || 0))
      : 0;
    
    const newOrderItem = {
      name: product.name,
      article_number: product.supplier_part_number || product.visitron_part_number || '',
      visitron_part_number: product.visitron_part_number || '',
      quantity: 1,
      unit: 'Stück',
      list_price: product.visitron_list_price || product.purchase_price_eur || 0,
      description: product.description || '',
      description_type: 'SHORT',
      purchase_price: product.purchase_price_eur || product.purchase_price || 0,
      discount_percent: 0,
      final_price: product.visitron_list_price || product.purchase_price_eur || 0,
      currency: 'EUR',
      position: maxPosition + 1,
      product_type: product.type,
      product_id: product.id
    };
    
    setOrderDraft(prev => ({
      ...prev,
      items: [...prev.items, newOrderItem]
    }));
    
    setProductSearchTerm('');
    setFilteredProducts([]);
    setShowProductSearch(false);
  };

  // Price calculation functions
  const calculateItemTotal = (item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const listPrice = parseFloat(item.list_price) || 0;
    const discount = parseFloat(item.discount_percent) || 0;
    const purchasePrice = parseFloat(item.purchase_price) || 0;
    
    const priceAfterDiscount = listPrice * (1 - discount / 100);
    const totalPrice = quantity * priceAfterDiscount;
    const totalPurchaseCost = quantity * purchasePrice;
    const margin = totalPrice - totalPurchaseCost;
    const marginPercent = totalPrice > 0 ? (margin / totalPrice * 100) : 0;
    
    return {
      totalPrice: totalPrice,
      totalPurchaseCost: totalPurchaseCost,
      margin: margin,
      marginPercent: marginPercent
    };
  };

  const calculateOrderTotals = () => {
    let totalPrice = 0;
    let totalPurchaseCost = 0;
    
    orderDraft.items.forEach(item => {
      const calc = calculateItemTotal(item);
      totalPrice += calc.totalPrice;
      totalPurchaseCost += calc.totalPurchaseCost;
    });
    
    const totalMargin = totalPrice - totalPurchaseCost;
    const totalMarginPercent = totalPrice > 0 ? (totalMargin / totalPrice * 100) : 0;
    
    return {
      totalPrice: totalPrice,
      totalPurchaseCost: totalPurchaseCost,
      totalMargin: totalMargin,
      totalMarginPercent: totalMarginPercent
    };
  };

  const pickCustomer = async (c) => {
    setOrderDraft(prev => ({ ...prev, customer: c }));
    // Clear the search term and list after selection
    setCustomerTerm('');
    setCustomers([]);
    
    // Load customer addresses
    try {
      const res = await api.get(`/customers/customers/${c.id}/addresses/`);
      setCustomerAddresses(res.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Kundenadressen:', error);
      setCustomerAddresses([]);
    }
  };

  const pickQuotation = async (q) => {
    try {
      const res = await api.get(`/sales/quotations/${q.id}/`);
      const full = res.data;
      const mapped = (full.items || []).map(i => ({
        name: i.item_name || '',
        article_number: i.item_article_number || '',
        visitron_part_number: i.visitron_part_number || '',
        quantity: i.quantity,
        unit: 'Stück',
        list_price: i.unit_price || i.sale_price || 0,
        description: i.item_description || '',
        description_type: i.description_type || 'SHORT',
        purchase_price: i.purchase_price || 0,
        discount_percent: i.discount_percent || 0,
        final_price: i.unit_price || i.sale_price || 0,
        currency: 'EUR',
        position: i.position || 1  // Übernehme Position aus Angebot
      }));
      setOrderDraft(prev => ({ ...prev, quotation: full, items: mapped }));
      setQuotations([]);
    } catch (e) {
      console.error(e);
      setOrderDraft(prev => ({ ...prev, quotation: q }));
    }
  };

  const handleDocument = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setOrderDraft(prev => ({ ...prev, documentFile: file, documentPreview: url }));
  };

  // eslint-disable-next-line no-unused-vars
  const gotoNext = () => setStep(s => Math.min(3, s + 1));
  const gotoPrev = () => setStep(s => Math.max(1, s - 1));

  const handleCreateOrderGotoItems = () => {
    // Ensure items array exists
    setOrderDraft(prev => ({ ...prev, items: prev.items || [] }));
    setStep(2);
  };

  const addAddressesToCustomer = async (orderId) => {
    try {
      const addressesToAdd = [];
      
      if (orderDraft.add_confirmation_to_customer && orderDraft.confirmation_address && Object.values(orderDraft.confirmation_address).some(v => v)) {
        addressesToAdd.push({
          ...orderDraft.confirmation_address,
          type: 'confirmation'
        });
      }
      
      if (orderDraft.add_shipping_to_customer && orderDraft.shipping_address && Object.values(orderDraft.shipping_address).some(v => v)) {
        addressesToAdd.push({
          ...orderDraft.shipping_address,
          type: 'shipping'
        });
      }
      
      if (orderDraft.add_billing_to_customer && orderDraft.billing_address && Object.values(orderDraft.billing_address).some(v => v)) {
        addressesToAdd.push({
          ...orderDraft.billing_address,
          type: 'billing'
        });
      }
      
      for (const addr of addressesToAdd) {
        try {
          await api.post(`/customers/customers/${orderDraft.customer.id}/addresses/`, addr);
        } catch (error) {
          console.error('Fehler beim Hinzufügen der Adresse:', error);
        }
      }
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Adressen:', error);
    }
  };

  const handleSubmitOrder = async () => {
    // Require quotation for supplier/project inheritance for now
    if (!orderDraft.quotation) {
      alert('Bitte ein Angebot auswählen, damit Lieferant und Projekt übernommen werden können.');
      return;
    }

    try {
      const supplierField = orderDraft.quotation.supplier;
      const supplierId = (supplierField && typeof supplierField === 'object') ? supplierField.id : supplierField;

      const itemsPayload = (orderDraft.items || []).map((it, idx) => ({
        article_number: it.article_number || '',
        name: it.name || '',
        description: it.description || '',
        quantity: it.quantity || 1,
        unit: it.unit || 'Stück',
        list_price: it.list_price || 0,
        discount_percent: it.discount_percent || 0,
        final_price: (it.final_price ?? it.list_price) || 0,
        currency: it.currency || 'EUR',
        position: idx + 1,
        purchase_price: it.purchase_price || 0
      }));

      const id = params?.id;

      // Use FormData to support file upload
      const form = new FormData();
      form.append('order_type', 'customer_order');
      if (supplierId) form.append('supplier', supplierId);
      form.append('order_date', new Date().toISOString().split('T')[0]);
      // Neue Felder für Bestellinformationen
      if (orderDraft.customer_order_number) form.append('customer_order_number', orderDraft.customer_order_number);
      if (orderDraft.customer_name) form.append('customer_name', orderDraft.customer_name);
      
      // Adressen als JSON
      if (orderDraft.confirmation_address && Object.values(orderDraft.confirmation_address).some(v => v)) {
        form.append('confirmation_address', JSON.stringify(orderDraft.confirmation_address));
      }
      if (orderDraft.shipping_address && Object.values(orderDraft.shipping_address).some(v => v)) {
        form.append('shipping_address', JSON.stringify(orderDraft.shipping_address));
      }
      if (orderDraft.billing_address && Object.values(orderDraft.billing_address).some(v => v)) {
        form.append('billing_address', JSON.stringify(orderDraft.billing_address));
      }
      
      // E-Mail-Adressen
      if (orderDraft.confirmation_email) form.append('confirmation_email', orderDraft.confirmation_email);
      if (orderDraft.billing_email) form.append('billing_email', orderDraft.billing_email);
      
      // Bemerkungen (überschreibt das alte notes)
      if (orderDraft.notes) form.append('notes', orderDraft.notes);
      
      // Umsatzsteuer-ID (optional) — sende nur, wenn vorhanden, als `customer_vat_id`
      if (orderDraft.vat_id && orderDraft.vat_id.toString().trim() !== '') {
        form.append('customer_vat_id', orderDraft.vat_id.toString().trim());
      }
      form.append('items', JSON.stringify(itemsPayload));
      if (orderDraft.documentFile) {
        form.append('order_document', orderDraft.documentFile, orderDraft.documentFile.name);
      }

      if (id) {
        // Update existing
        await api.patch(`/customer-orders/customer-orders/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        alert('Kundenauftrag erfolgreich aktualisiert.');
      } else {
        const response = await api.post('/customer-orders/customer-orders/', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        alert('Kundenauftrag erfolgreich erstellt.');
        
        // Adressen zu Kundendaten hinzufügen, falls gewünscht
        await addAddressesToCustomer(response.data.id);
      }
      navigate('/sales/order-processing');
    } catch (e) {
      console.error('Fehler beim Erstellen des Auftrags:', e);
      alert('Fehler beim Erstellen des Auftrags. Details siehe Konsole.');
    }
  };

  const updateItem = (idx, field, value) => {
    setOrderDraft(prev => {
      const items = prev.items.slice();
      items[idx] = { ...items[idx], [field]: value };
      
      // Auto-calculate final_price when relevant fields change
      if (field === 'list_price' || field === 'discount_percent' || field === 'quantity') {
        const item = items[idx];
        const quantity = parseFloat(item.quantity) || 0;
        const listPrice = parseFloat(item.list_price) || 0;
        const discount = parseFloat(item.discount_percent) || 0;
        const priceAfterDiscount = listPrice * (1 - discount / 100);
        items[idx].final_price = quantity * priceAfterDiscount;
      }
      
      return { ...prev, items };
    });
  };

  const removeItem = (idx) => {
    setOrderDraft(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  // eslint-disable-next-line no-unused-vars
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(orderDraft.items);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setOrderDraft(prev => ({ ...prev, items }));
  };

  const addNewItem = () => {
    // Finde die höchste Position und erhöhe um 1
    const maxPosition = orderDraft.items.length > 0 
      ? Math.max(...orderDraft.items.map(item => item.position || 0))
      : 0;
    
    const newItemWithPosition = { 
      ...newItem, 
      position: maxPosition + 1,
      description: '',
      description_type: 'SHORT',
      visitron_part_number: ''
    };
    
    setOrderDraft(prev => ({ ...prev, items: [...prev.items, newItemWithPosition] }));
    setNewItem({ name: '', article_number: '', quantity: 1, unit: 'Stück', list_price: 0 });
  };

  const updateItemDescription = (index, description) => {
    const updatedItems = [...orderDraft.items];
    updatedItems[index] = { ...updatedItems[index], description };
    setOrderDraft({ ...orderDraft, items: updatedItems });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{params?.id ? 'Auftrag bearbeiten' : 'Neuer Auftrag'}</h1>
        <p className="text-sm text-gray-600">Workflow: Kunde → Positionen → Überprüfung</p>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="tab-scroll -mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = step === tab.id;
            const isDisabled = !tab.enabled;
            
            return (
              <button
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                disabled={isDisabled}
                className={`
                  group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    isActive 
                      ? 'border-blue-500 text-blue-600' 
                      : isDisabled
                      ? 'border-transparent text-gray-400 cursor-not-allowed'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className={`
                  -ml-0.5 mr-2 h-5 w-5
                  ${isActive ? 'text-blue-500' : isDisabled ? 'text-gray-400' : 'text-gray-400 group-hover:text-gray-500'}
                `} />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {step === 1 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="font-semibold mb-4">1) Kunde & Angebot auswählen</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Kunde suchen</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border px-2"
                  value={customerTerm}
                  onChange={e => setCustomerTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchCustomers(); } }}
                  placeholder="Name oder Kundennummer"
                />
                <button className="px-3 bg-blue-600 text-white rounded" onClick={searchCustomers}>Suchen</button>
              </div>

              {customers.length > 0 && (
                <ul className="mt-2 border rounded max-h-48 overflow-y-auto">
                  {customers.map(c => (
                    <li key={c.id} className="p-2 hover:bg-gray-50 cursor-pointer" onClick={() => { pickCustomer(c); }}>
                      <div className="font-medium">{c.full_name || `${c.first_name} ${c.last_name}`}</div>
                      <div className="text-xs text-gray-500">{c.primary_email || c.customer_number}</div>
                    </li>
                  ))}
                </ul>
              )}

              {orderDraft.customer && (
                <div className="mt-4 p-3 border rounded flex items-start justify-between">
                  <div>
                    <div className="font-semibold">Ausgewählter Kunde</div>
                    <div>{orderDraft.customer.full_name || `${orderDraft.customer.first_name} ${orderDraft.customer.last_name}`}</div>
                    <div className="text-sm text-gray-500">{orderDraft.customer.primary_email || orderDraft.customer.customer_number}</div>
                  </div>
                  <div>
                    <button className="text-sm text-gray-600 hover:text-gray-800" onClick={() => setOrderDraft(prev => ({ ...prev, customer: null }))}>Auswahl entfernen</button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Angebot suchen</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border px-2"
                  value={quotationTerm}
                  onChange={e => setQuotationTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchQuotations(); } }}
                  placeholder="Angebotsnummer oder Kunde"
                />
                <button className="px-3 bg-blue-600 text-white rounded" onClick={searchQuotations}>Suchen</button>
              </div>

              {quotations.length > 0 && (
                <ul className="mt-2 border rounded max-h-48 overflow-y-auto">
                  {quotations.map(q => (
                    <li key={q.id} className="p-2 hover:bg-gray-50 cursor-pointer" onClick={() => pickQuotation(q)}>
                      <div className="font-medium">{q.quotation_number || q.id}</div>
                      <div className="text-xs text-gray-500">{q.customer_name}</div>
                    </li>
                  ))}
                </ul>
              )}

              {orderDraft.quotation && (
                <div className="mt-4 p-3 border rounded flex items-start justify-between">
                  <div>
                    <div className="font-semibold">Ausgewähltes Angebot</div>
                    <div>{orderDraft.quotation.quotation_number}</div>
                  </div>
                  <div>
                    <button className="text-sm text-gray-600 hover:text-gray-800" onClick={() => setOrderDraft(prev => ({ ...prev, quotation: null, items: [] }))}>Auswahl entfernen</button>
                  </div>
                </div>
              )}

            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Bestelldokument (vom Kunden)</label>
              <input type="file" accept="application/pdf" onChange={handleDocument} />
              {orderDraft.documentPreview && (
                <div className="mt-2">
                  <a href={orderDraft.documentPreview} target="_blank" rel="noreferrer" className="text-blue-600">Dokument anzeigen</a>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-2">
            <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => navigate(-1)}>Abbrechen</button>
            <button
              className={`px-4 py-2 rounded flex items-center ${(!orderDraft.customer && !orderDraft.quotation) ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white'}`}
              onClick={() => {
                if (!orderDraft.customer && !orderDraft.quotation) {
                  alert('Bitte zuerst einen Kunden oder ein Angebot auswählen.');
                  return;
                }
                handleCreateOrderGotoItems();
              }}
              disabled={!orderDraft.customer && !orderDraft.quotation}
            >
              Positionen übernehmen
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="font-semibold mb-4">2) Positionen bearbeiten</h2>

          {/* Show different content based on whether quotation is selected */}
          {orderDraft.quotation ? (
            // Mode: Quotation selected - show items from quotation
            <div>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Positionen aus Angebot {orderDraft.quotation.quotation_number}:</strong> Die Positionen wurden automatisch aus dem ausgewählten Angebot übernommen.
                </p>
              </div>
              
              <div className="space-y-3">
                {orderDraft.items.map((it, idx) => {
                  const calc = calculateItemTotal(it);
                  return (
                    <div key={idx} className="border p-4 rounded">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm font-medium text-gray-700">Position {it.position || (idx + 1)}</div>
                        {/* Remove button moved to header */}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Menge</label>
                          <input 
                            type="number" 
                            className="w-full rounded border px-2 py-1" 
                            value={it.quantity} 
                            onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">VK-Preis</label>
                          <input 
                            type="number" 
                            step="0.01"
                            className="w-full rounded border px-2 py-1" 
                            value={it.list_price} 
                            onChange={e => updateItem(idx, 'list_price', parseFloat(e.target.value) || 0)} 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Rabatt %</label>
                          <input 
                            type="number" 
                            step="0.01"
                            className="w-full rounded border px-2 py-1" 
                            value={it.discount_percent || 0} 
                            onChange={e => updateItem(idx, 'discount_percent', parseFloat(e.target.value) || 0)} 
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Remove button moved to header */}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Gesamt VK:</span>
                          <span className="font-medium ml-1">{calc.totalPrice.toFixed(2)} €</span>
                        </div>
                        <div>
                          <span className="text-gray-600">EK Gesamt:</span>
                          <span className="font-medium ml-1">{calc.totalPurchaseCost.toFixed(2)} €</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Marge:</span>
                          <span className={`font-medium ml-1 ${calc.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {calc.margin.toFixed(2)} €
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Marge %:</span>
                          <span className={`font-medium ml-1 ${calc.marginPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {calc.marginPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            // Mode: Only customer selected - allow adding products
            <div>
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm text-green-800">
                  <strong>Produkte hinzufügen:</strong> Suchen Sie nach Trading Goods, um sie dem Auftrag hinzuzufügen.
                </p>
              </div>

              {/* Product Search */}
              <div className="mb-6">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      className="w-full rounded border px-3 py-2 pl-10"
                      placeholder="Produkt suchen..."
                      value={productSearchTerm}
                      onChange={(e) => searchProducts(e.target.value)}
                    />
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                  </div>
                  <button
                    onClick={() => setShowProductSearch(!showProductSearch)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {showProductSearch ? 'Ausblenden' : 'Suchen'}
                  </button>
                </div>

                {showProductSearch && filteredProducts.length > 0 && (
                  <div className="mt-2 border rounded max-h-48 overflow-y-auto bg-white">
                    {filteredProducts.map(product => (
                      <div
                        key={`${product.type}-${product.id}`}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => addProductToOrder(product)}
                      >
                        <div className="font-medium">{product.displayName}</div>
                        <div className="text-sm text-gray-600">
                          VK: {product.visitron_list_price || product.purchase_price_eur || 0} € | 
                          EK: {product.purchase_price_eur || product.purchase_price || 0} €
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Current Items */}
              <div className="space-y-3">
                {orderDraft.items.map((it, idx) => {
                  const calc = calculateItemTotal(it);
                  return (
                    <div key={idx} className="border p-4 rounded">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm font-medium text-gray-700">Position {it.position || (idx + 1)}</div>
                        <button className="text-red-600 hover:text-red-800" onClick={() => removeItem(idx)} title="Entfernen">
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">Artikel</label>
                          <div className="font-medium">{it.name || it.article_number}</div>
                          <div className="text-xs text-gray-500">
                            {it.article_number}
                            {it.visitron_part_number && it.visitron_part_number !== it.article_number && (
                              <span className="ml-2 text-blue-600">VN: {it.visitron_part_number}</span>
                            )}
                          </div>
                          <div className="mt-2">
                            <label className="block text-xs font-medium text-gray-700">Beschreibung</label>
                            <input
                              type="text"
                              value={it.description || ''}
                              onChange={(e) => updateItemDescription(idx, e.target.value)}
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                              placeholder="Positionsbeschreibung eingeben..."
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Menge</label>
                          <input 
                            type="number" 
                            className="w-full rounded border px-2 py-1" 
                            value={it.quantity} 
                            onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">VK-Preis</label>
                          <input 
                            type="number" 
                            step="0.01"
                            className="w-full rounded border px-2 py-1" 
                            value={it.list_price} 
                            onChange={e => updateItem(idx, 'list_price', parseFloat(e.target.value) || 0)} 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Rabatt %</label>
                          <input 
                            type="number" 
                            step="0.01"
                            className="w-full rounded border px-2 py-1" 
                            value={it.discount_percent || 0} 
                            onChange={e => updateItem(idx, 'discount_percent', parseFloat(e.target.value) || 0)} 
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Remove button moved to header */}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Gesamt VK:</span>
                          <span className="font-medium ml-1">{calc.totalPrice.toFixed(2)} €</span>
                        </div>
                        <div>
                          <span className="text-gray-600">EK Gesamt:</span>
                          <span className="font-medium ml-1">{calc.totalPurchaseCost.toFixed(2)} €</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Marge:</span>
                          <span className={`font-medium ml-1 ${calc.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {calc.margin.toFixed(2)} €
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Marge %:</span>
                          <span className={`font-medium ml-1 ${calc.marginPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {calc.marginPercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Item Button */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={addNewItem}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5" />
              Weitere Position hinzufügen
            </button>
          </div>

          {/* Order Totals */}
          {orderDraft.items.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h3 className="font-semibold mb-3">Auftragssummen</h3>
              {(() => {
                const totals = calculateOrderTotals();
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded">
                    <div>
                      <span className="text-gray-600">Gesamt VK:</span>
                      <div className="text-lg font-bold">{totals.totalPrice.toFixed(2)} €</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Gesamt EK:</span>
                      <div className="text-lg font-bold">{totals.totalPurchaseCost.toFixed(2)} €</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Gesamt Marge:</span>
                      <div className={`text-lg font-bold ${totals.totalMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totals.totalMargin.toFixed(2)} €
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Marge %:</span>
                      <div className={`text-lg font-bold ${totals.totalMarginPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {totals.totalMarginPercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button className="px-4 py-2 bg-gray-200 rounded flex items-center" onClick={gotoPrev}><ArrowLeftIcon className="h-4 w-4 mr-2"/> Zurück</button>
            <div>
              <button className="px-4 py-2 bg-gray-200 rounded mr-2" onClick={() => setStep(3)}>Weiter (Überprüfung)</button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="font-semibold mb-4">3) Bestellinformationen</h2>
          
          <div className="space-y-6">
            {/* Bestellnummer und Besteller */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bestellnummer des Kunden</label>
                <input
                  type="text"
                  value={orderDraft.customer_order_number}
                  onChange={(e) => setOrderDraft(prev => ({ ...prev, customer_order_number: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="z.B. PO-2025-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name des Bestellers</label>
                <input
                  type="text"
                  value={orderDraft.customer_name}
                  onChange={(e) => setOrderDraft(prev => ({ ...prev, customer_name: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="z.B. Max Mustermann"
                />
              </div>
            </div>

            {/* Adressen */}
            <div className="space-y-6">
              {/* Bestätigungsadresse */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-3">Auftragsbestätigung</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse auswählen (optional)</label>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          const addr = customerAddresses.find(a => a.id === parseInt(e.target.value));
                          if (addr) {
                            setOrderDraft(prev => ({
                              ...prev,
                              confirmation_address: {
                                company: addr.company || '',
                                name: addr.name || '',
                                street: addr.street || '',
                                postal_code: addr.postal_code || '',
                                city: addr.city || '',
                                country: addr.country || 'DE'
                              }
                            }));
                          }
                        }
                      }}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Adresse auswählen...</option>
                      {customerAddresses.map(addr => (
                        <option key={addr.id} value={addr.id}>
                          {addr.company || addr.name} - {addr.street}, {addr.city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firma</label>
                    <input
                      type="text"
                      value={orderDraft.confirmation_address.company}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        confirmation_address: { ...prev.confirmation_address, company: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={orderDraft.confirmation_address.name}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        confirmation_address: { ...prev.confirmation_address, name: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
                    <input
                      type="text"
                      value={orderDraft.confirmation_address.street}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        confirmation_address: { ...prev.confirmation_address, street: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                    <input
                      type="text"
                      value={orderDraft.confirmation_address.postal_code}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        confirmation_address: { ...prev.confirmation_address, postal_code: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                    <input
                      type="text"
                      value={orderDraft.confirmation_address.city}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        confirmation_address: { ...prev.confirmation_address, city: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
                    <input
                      type="text"
                      value={orderDraft.confirmation_address.country}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        confirmation_address: { ...prev.confirmation_address, country: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                    <input
                      type="email"
                      value={orderDraft.confirmation_email}
                      onChange={(e) => setOrderDraft(prev => ({ ...prev, confirmation_email: e.target.value }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="add_confirmation_to_customer"
                    checked={orderDraft.add_confirmation_to_customer}
                    onChange={(e) => setOrderDraft(prev => ({ ...prev, add_confirmation_to_customer: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="add_confirmation_to_customer" className="ml-2 text-sm text-gray-700">
                    Diese Adresse zu den Kundendaten hinzufügen
                  </label>
                </div>
              </div>

              {/* Versandadresse */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-3">Versand</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse auswählen (optional)</label>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          const addr = customerAddresses.find(a => a.id === parseInt(e.target.value));
                          if (addr) {
                            setOrderDraft(prev => ({
                              ...prev,
                              shipping_address: {
                                company: addr.company || '',
                                name: addr.name || '',
                                street: addr.street || '',
                                postal_code: addr.postal_code || '',
                                city: addr.city || '',
                                country: addr.country || 'DE'
                              }
                            }));
                          }
                        }
                      }}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Adresse auswählen...</option>
                      {customerAddresses.map(addr => (
                        <option key={addr.id} value={addr.id}>
                          {addr.company || addr.name} - {addr.street}, {addr.city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firma</label>
                    <input
                      type="text"
                      value={orderDraft.shipping_address.company}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        shipping_address: { ...prev.shipping_address, company: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={orderDraft.shipping_address.name}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        shipping_address: { ...prev.shipping_address, name: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
                    <input
                      type="text"
                      value={orderDraft.shipping_address.street}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        shipping_address: { ...prev.shipping_address, street: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                    <input
                      type="text"
                      value={orderDraft.shipping_address.postal_code}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        shipping_address: { ...prev.shipping_address, postal_code: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                    <input
                      type="text"
                      value={orderDraft.shipping_address.city}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        shipping_address: { ...prev.shipping_address, city: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
                    <input
                      type="text"
                      value={orderDraft.shipping_address.country}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        shipping_address: { ...prev.shipping_address, country: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="add_shipping_to_customer"
                    checked={orderDraft.add_shipping_to_customer}
                    onChange={(e) => setOrderDraft(prev => ({ ...prev, add_shipping_to_customer: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="add_shipping_to_customer" className="ml-2 text-sm text-gray-700">
                    Diese Adresse zu den Kundendaten hinzufügen
                  </label>
                </div>
              </div>

              {/* Rechnungsadresse */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-medium mb-3">Rechnung</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse auswählen (optional)</label>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          const addr = customerAddresses.find(a => a.id === parseInt(e.target.value));
                          if (addr) {
                            setOrderDraft(prev => ({
                              ...prev,
                              billing_address: {
                                company: addr.company || '',
                                name: addr.name || '',
                                street: addr.street || '',
                                postal_code: addr.postal_code || '',
                                city: addr.city || '',
                                country: addr.country || 'DE'
                              }
                            }));
                          }
                        }
                      }}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Adresse auswählen...</option>
                      {customerAddresses.map(addr => (
                        <option key={addr.id} value={addr.id}>
                          {addr.company || addr.name} - {addr.street}, {addr.city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firma</label>
                    <input
                      type="text"
                      value={orderDraft.billing_address.company}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        billing_address: { ...prev.billing_address, company: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={orderDraft.billing_address.name}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        billing_address: { ...prev.billing_address, name: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Straße</label>
                    <input
                      type="text"
                      value={orderDraft.billing_address.street}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        billing_address: { ...prev.billing_address, street: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                    <input
                      type="text"
                      value={orderDraft.billing_address.postal_code}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        billing_address: { ...prev.billing_address, postal_code: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                    <input
                      type="text"
                      value={orderDraft.billing_address.city}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        billing_address: { ...prev.billing_address, city: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
                    <input
                      type="text"
                      value={orderDraft.billing_address.country}
                      onChange={(e) => setOrderDraft(prev => ({
                        ...prev,
                        billing_address: { ...prev.billing_address, country: e.target.value }
                      }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                    <input
                      type="email"
                      value={orderDraft.billing_email}
                      onChange={(e) => setOrderDraft(prev => ({ ...prev, billing_email: e.target.value }))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="add_billing_to_customer"
                    checked={orderDraft.add_billing_to_customer}
                    onChange={(e) => setOrderDraft(prev => ({ ...prev, add_billing_to_customer: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="add_billing_to_customer" className="ml-2 text-sm text-gray-700">
                    Diese Adresse zu den Kundendaten hinzufügen
                  </label>
                </div>
              </div>

              {/* Bemerkungen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bemerkungen</label>
                <textarea
                  value={orderDraft.notes}
                  onChange={(e) => setOrderDraft(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Zusätzliche Bemerkungen zum Auftrag..."
                />
              </div>

              {/* Umsatzsteuer-ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Umsatzsteuer-ID (VAT)</label>
                <input
                  type="text"
                  value={orderDraft.vat_id}
                  onChange={(e) => setOrderDraft(prev => ({ ...prev, vat_id: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="z.B. DE123456789"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <button className="px-4 py-2 bg-gray-200 rounded flex items-center" onClick={gotoPrev}><ArrowLeftIcon className="h-4 w-4 mr-2"/> Zurück</button>
            <div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={() => setStep(4)}>Weiter (Abschluss)</button>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="font-semibold mb-4">4) Abschluss</h2>
          <p className="text-sm text-gray-600 mb-4">Überprüfen Sie alle Angaben und legen Sie den Auftrag an.</p>

          <div className="mt-6 flex justify-between">
            <button className="px-4 py-2 bg-gray-200 rounded flex items-center" onClick={() => setStep(3)}><ArrowLeftIcon className="h-4 w-4 mr-2"/> Zurück</button>
            <div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleSubmitOrder}>{params?.id ? 'Auftrag aktualisieren' : 'Auftrag anlegen'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesOrderForm;
