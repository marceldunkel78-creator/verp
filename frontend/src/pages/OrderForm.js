import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const OrderForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [deliveryTerms, setDeliveryTerms] = useState([]);
  const [deliveryInstructions, setDeliveryInstructions] = useState([]);
  const [formData, setFormData] = useState({
    supplier: '',
    status: 'angelegt',
    order_date: '',
    confirmation_date: '',
    delivery_date: '',
    payment_date: '',
    payment_term: '',
    delivery_term: '',
    delivery_instruction: '',
    offer_reference: '',
    custom_text: '',
    order_document: null,
    notes: '',
    items: []
  });
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Prüfe ob Bestellung geschützt ist (Status bestellt oder höher)
  const isOrderProtected = () => {
    const protectedStatuses = ['bestellt', 'bestaetigt', 'geliefert', 'bezahlt', 'zahlung_on_hold'];
    return isEditMode && protectedStatuses.includes(formData.status);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const fetchSuppliers = async () => {
    try {
      const [suppliersRes, paymentRes, deliveryTermsRes, deliveryInstRes] = await Promise.all([
        api.get('/suppliers/suppliers/?is_active=true'),
        api.get('/settings/payment-terms/'),
        api.get('/settings/delivery-terms/'),
        api.get('/settings/delivery-instructions/')
      ]);
      
      const supplierData = suppliersRes.data.results || suppliersRes.data;
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      
      setPaymentTerms(Array.isArray(paymentRes.data) ? paymentRes.data : (paymentRes.data.results || []));
      setDeliveryTerms(Array.isArray(deliveryTermsRes.data) ? deliveryTermsRes.data : (deliveryTermsRes.data.results || []));
      setDeliveryInstructions(Array.isArray(deliveryInstRes.data) ? deliveryInstRes.data : (deliveryInstRes.data.results || []));
    } catch (error) {
      console.error('Fehler beim Laden der Lieferanten:', error);
    }
  };

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/orders/orders/${id}/`);
      const order = response.data;
      
      const orderData = {
        supplier: order.supplier,
        status: order.status || 'angelegt',
        order_date: order.order_date,
        confirmation_date: order.confirmation_date || '',
        delivery_date: order.delivery_date || '',
        payment_date: order.payment_date || '',
        payment_term: order.payment_term || '',
        delivery_term: order.delivery_term || '',
        delivery_instruction: order.delivery_instruction || '',
        offer_reference: order.offer_reference || '',
        custom_text: order.custom_text || '',
        order_document: order.order_document || null,
        notes: order.notes || '',
        items: order.items || []
      };
      
      setFormData(orderData);
      
      // Load supplier details and products (but don't overwrite order data)
      if (order.supplier) {
        loadSupplierProducts(order.supplier);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Bestellung:', error);
      alert('Fehler beim Laden der Bestellung');
    } finally {
      setLoading(false);
    }
  };

  // Load supplier products only (for existing orders) - doesn't change formData
  const loadSupplierProducts = async (supplierId) => {
    if (!supplierId) {
      setSelectedSupplier(null);
      setProducts([]);
      return;
    }

    try {
      // Load supplier details
      const supplierResponse = await api.get(`/suppliers/suppliers/${supplierId}/`);
      setSelectedSupplier(supplierResponse.data);

      // Load products from this supplier
      const [tradingRes, assetsRes, materialsRes] = await Promise.all([
        api.get(`/suppliers/products/?supplier=${supplierId}`).catch(() => ({ data: { results: [] } })),
        api.get(`/suppliers/assets/?supplier=${supplierId}`).catch(() => ({ data: { results: [] } })),
        api.get(`/suppliers/material-supplies/?supplier=${supplierId}`).catch(() => ({ data: { results: [] } }))
      ]);

      const tradingProducts = (tradingRes.data.results || tradingRes.data || []).map(p => ({
        ...p,
        type: 'trading',
        display_name: `${p.supplier_part_number || p.visitron_part_number || 'N/A'} - ${p.name} (Handelswaren)`
      }));

      const assets = (assetsRes.data.results || assetsRes.data || []).map(p => ({
        ...p,
        type: 'asset',
        display_name: `${p.supplier_part_number || p.visitron_part_number || 'N/A'} - ${p.name} (Anlagen)`
      }));

      const materials = (materialsRes.data.results || materialsRes.data || []).map(p => ({
        ...p,
        type: 'material',
        display_name: `${p.supplier_part_number || p.visitron_part_number || 'N/A'} - ${p.name} (Materialien)`
      }));

      setProducts([...tradingProducts, ...assets, ...materials]);
    } catch (error) {
      console.error('Fehler beim Laden der Lieferanten-Details:', error);
    }
  };

  const handleSupplierChange = async (supplierId) => {
    // Clear items when changing supplier in a new order
    setFormData({ ...formData, supplier: supplierId, items: [] });
    
    if (!supplierId) {
      setSelectedSupplier(null);
      setProducts([]);
      return;
    }

    try {
      // Load supplier details
      const supplierResponse = await api.get(`/suppliers/suppliers/${supplierId}/`);
      setSelectedSupplier(supplierResponse.data);
      
      // Auto-populate payment/delivery settings if not already set
      const updates = {};
      if (!formData.payment_term && supplierResponse.data.payment_term) {
        updates.payment_term = supplierResponse.data.payment_term;
      }
      if (!formData.delivery_term && supplierResponse.data.delivery_term) {
        updates.delivery_term = supplierResponse.data.delivery_term;
      }
      if (!formData.delivery_instruction && supplierResponse.data.delivery_instruction) {
        updates.delivery_instruction = supplierResponse.data.delivery_instruction;
      }
      
      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({ ...prev, ...updates }));
      }

      // Load products from this supplier
      const [tradingRes, assetsRes, materialsRes] = await Promise.all([
        api.get(`/suppliers/products/?supplier=${supplierId}`).catch(() => ({ data: { results: [] } })),
        api.get(`/suppliers/assets/?supplier=${supplierId}`).catch(() => ({ data: { results: [] } })),
        api.get(`/suppliers/material-supplies/?supplier=${supplierId}`).catch(() => ({ data: { results: [] } }))
      ]);

      const tradingProducts = (tradingRes.data.results || tradingRes.data || []).map(p => ({
        ...p,
        type: 'trading',
        display_name: `${p.supplier_part_number || p.visitron_part_number || 'N/A'} - ${p.name} (Handelswaren)`
      }));

      const assets = (assetsRes.data.results || assetsRes.data || []).map(p => ({
        ...p,
        type: 'asset',
        display_name: `${p.supplier_part_number || p.visitron_part_number || 'N/A'} - ${p.name} (Anlagen)`
      }));

      const materials = (materialsRes.data.results || materialsRes.data || []).map(p => ({
        ...p,
        type: 'material',
        display_name: `${p.supplier_part_number || p.visitron_part_number || 'N/A'} - ${p.name} (Materialien)`
      }));

      setProducts([...tradingProducts, ...assets, ...materials]);
    } catch (error) {
      console.error('Fehler beim Laden der Lieferanten-Details:', error);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          customer_order_number: '',
          article_number: '',
          name: '',
          description: '',
          quantity: 1,
          unit: 'Stk',
          list_price: 0,
          discount_percent: 0,
          final_price: 0,
          currency: 'EUR',
          position: formData.items.length + 1,
          trading_product: null,
          asset: null,
          material_supply: null
        }
      ]
    });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    // Renumber positions
    newItems.forEach((item, i) => {
      item.position = i + 1;
    });
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;

    // Auto-calculate final_price when list_price or discount changes
    if (field === 'list_price' || field === 'discount_percent') {
      const listPrice = parseFloat(newItems[index].list_price) || 0;
      const discount = parseFloat(newItems[index].discount_percent) || 0;
      newItems[index].final_price = (listPrice * (1 - discount / 100)).toFixed(2);
    }

    setFormData({ ...formData, items: newItems });
  };

  const selectProduct = (index, productId) => {
    const product = products.find(p => p.id === parseInt(productId));
    if (!product) return;

    const newItems = [...formData.items];
    
    // Map product fields based on type
    let articleNumber, listPrice, discount;
    
    if (product.type === 'trading') {
      articleNumber = product.supplier_part_number || product.visitron_part_number;
      listPrice = product.purchase_price_eur || product.list_price || 0;
      discount = product.discount_percent || 0;
    } else if (product.type === 'asset') {
      articleNumber = product.supplier_part_number || product.visitron_part_number;
      listPrice = product.purchase_price || 0;
      discount = 0;
    } else if (product.type === 'material') {
      articleNumber = product.supplier_part_number || product.visitron_part_number;
      listPrice = product.purchase_price_eur || product.list_price || 0;
      discount = product.discount_percent || 0;
    }

    newItems[index] = {
      ...newItems[index],
      article_number: articleNumber,
      name: product.name,
      description: product.short_description || product.description || '',
      list_price: listPrice,
      discount_percent: discount,
      currency: 'EUR',
      unit: 'Stk',
      trading_product: product.type === 'trading' ? product.id : null,
      asset: product.type === 'asset' ? product.id : null,
      material_supply: product.type === 'material' ? product.id : null
    };

    // Recalculate final price
    const finalListPrice = parseFloat(newItems[index].list_price) || 0;
    const finalDiscount = parseFloat(newItems[index].discount_percent) || 0;
    newItems[index].final_price = (finalListPrice * (1 - finalDiscount / 100)).toFixed(2);

    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => {
      const finalPrice = parseFloat(item.final_price) || 0;
      const quantity = parseFloat(item.quantity) || 0;
      return sum + (finalPrice * quantity);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.supplier) {
      alert('Bitte wählen Sie einen Lieferanten aus');
      return;
    }

    if (formData.items.length === 0) {
      alert('Bitte fügen Sie mindestens eine Position hinzu');
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        ...formData,
        order_date: formData.order_date || null,
        confirmation_date: formData.confirmation_date || null,
        delivery_date: formData.delivery_date || null,
        payment_date: formData.payment_date || null
      };

      // Wenn ein Dokument hochgeladen wird, verwende FormData
      if (formData.order_document && typeof formData.order_document !== 'string') {
        const formDataObj = new FormData();
        
        // Füge alle Felder außer items und order_document hinzu
        Object.keys(submitData).forEach(key => {
          if (key !== 'items' && key !== 'order_document' && submitData[key] !== null && submitData[key] !== '') {
            formDataObj.append(key, submitData[key]);
          }
        });
        
        // Füge Dokument hinzu
        formDataObj.append('order_document', formData.order_document);
        
        // Füge Items als JSON-String hinzu
        formDataObj.append('items', JSON.stringify(submitData.items));
        
        if (isEditMode) {
          await api.put(`/orders/orders/${id}/`, formDataObj, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } else {
          await api.post('/orders/orders/', formDataObj, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      } else {
        // Standard JSON Request
        const dataToSubmit = { ...submitData };
        delete dataToSubmit.order_document; // Entferne das Feld wenn es nur ein String (URL) ist
        
        if (isEditMode) {
          await api.put(`/orders/orders/${id}/`, dataToSubmit);
        } else {
          await api.post('/orders/orders/', dataToSubmit);
        }
      }
      
      navigate('/procurement/orders');
    } catch (error) {
      console.error('Fehler beim Speichern der Bestellung:', error);
      console.error('Error response data:', error.response?.data);
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message;
      alert('Fehler beim Speichern:\n\n' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get(`/orders/orders/${id}/download_pdf/`, {
        responseType: 'blob'
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Bestellung_${formData.order_number || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Fehler beim Download:', error);
      alert('Fehler beim PDF-Download');
    }
  };

  const handleViewPDF = async () => {
    try {
      const response = await api.get(`/orders/orders/${id}/download_pdf/`, {
        responseType: 'blob'
      });
      
      // Create blob URL and open in new tab
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      
      // Clean up after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Fehler beim Anzeigen:', error);
      alert('Fehler beim PDF-Anzeigen');
    }
  };

  if (loading && isEditMode) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/procurement/orders')}
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zur Übersicht
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? 'Bestellung bearbeiten' : 'Neue Bestellung'}
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Warnhinweis für geschützte Bestellungen */}
        {isOrderProtected() && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              <strong>Hinweis:</strong> Diese Bestellung wurde bereits bestellt und kann nur noch in den Datumsfeldern, Status und Notizen geändert werden.
            </p>
          </div>
        )}

        {/* Lieferant & Status */}
        <div className="bg-white shadow rounded-lg p-6 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lieferant *
              </label>
              <select
                value={formData.supplier}
                onChange={(e) => handleSupplierChange(e.target.value)}
                disabled={isOrderProtected()}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                required
              >
                <option value="">Bitte wählen...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.company_name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="angelegt">Angelegt</option>
                <option value="bestellt">Bestellt</option>
                <option value="bestaetigt">Bestätigt</option>
                <option value="geliefert">Geliefert</option>
                <option value="bezahlt">Bezahlt</option>
                <option value="zahlung_on_hold">Zahlung on hold</option>
                <option value="storniert">Storniert</option>
              </select>
            </div>
          </div>

          {/* Supplier Details */}
          {selectedSupplier && (
            <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Adresse:</span>
                  <div className="text-gray-900">
                    {selectedSupplier.street} {selectedSupplier.house_number}, {selectedSupplier.postal_code} {selectedSupplier.city}, {selectedSupplier.country}
                  </div>
                </div>
                {selectedSupplier.customer_number && (
                  <div>
                    <span className="text-gray-600">Unsere Kundennr.:</span>
                    <span className="text-gray-900 font-mono ml-2">{selectedSupplier.customer_number}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Daten & Konditionen */}
        <div className="bg-white shadow rounded-lg p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Daten & Konditionen</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bestelldatum
              </label>
              <input
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                AB-Datum
              </label>
              <input
                type="date"
                value={formData.confirmation_date}
                onChange={(e) => setFormData({ ...formData, confirmation_date: e.target.value })}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lieferdatum
              </label>
              <input
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zahlungsdatum
              </label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zahlungsbedingungen
              </label>
              <select
                value={formData.payment_term}
                onChange={(e) => setFormData({ ...formData, payment_term: e.target.value })}
                disabled={isOrderProtected()}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Bitte wählen...</option>
                {paymentTerms.map(term => (
                  <option key={term.id} value={term.id}>
                    {term.formatted_terms}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lieferbedingungen (Incoterm)
              </label>
              <select
                value={formData.delivery_term}
                onChange={(e) => setFormData({ ...formData, delivery_term: e.target.value })}
                disabled={isOrderProtected()}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Bitte wählen...</option>
                {deliveryTerms.map(term => (
                  <option key={term.id} value={term.id}>
                    {term.incoterm_display}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lieferanweisungen
              </label>
              <select
                value={formData.delivery_instruction}
                onChange={(e) => setFormData({ ...formData, delivery_instruction: e.target.value })}
                disabled={isOrderProtected()}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Bitte wählen...</option>
                {deliveryInstructions.map(instr => (
                  <option key={instr.id} value={instr.id}>
                    {instr.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Angebot & Text */}
        <div className="bg-white shadow rounded-lg p-6 mb-4">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Angebot & Dokumenttext</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Angebotsreferenz
              </label>
              <input
                type="text"
                value={formData.offer_reference}
                onChange={(e) => setFormData({ ...formData, offer_reference: e.target.value })}
                disabled={isOrderProtected()}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="z.B. Angebot-2024-001"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Benutzerdefinierter Text (erscheint im Bestelldokument)
              </label>
              <textarea
                value={formData.custom_text}
                onChange={(e) => setFormData({ ...formData, custom_text: e.target.value })}
                disabled={isOrderProtected()}
                rows="2"
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Text der im Bestelldokument erscheint"
              />
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Bestellpositionen</h2>
            <button
              type="button"
              onClick={addItem}
              disabled={!formData.supplier || isOrderProtected()}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Position hinzufügen
            </button>
          </div>

          {!formData.supplier && (
            <div className="text-center py-8 text-gray-500">
              Bitte wählen Sie zuerst einen Lieferanten aus
            </div>
          )}

          {formData.supplier && formData.items.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Keine Positionen vorhanden. Klicken Sie auf "Position hinzufügen"
            </div>
          )}

          {formData.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kundenauftrag</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produkt</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artikel-Nr.</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Beschreibung</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Menge</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Einheit</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listenpreis</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rabatt %</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpreis</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gesamt</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formData.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {item.position}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.customer_order_number || ''}
                          onChange={(e) => updateItem(index, 'customer_order_number', e.target.value)}
                          disabled={isOrderProtected()}
                          className="w-32 text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="KA-Nr."
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={item.trading_product || item.asset || item.material_supply || ''}
                          onChange={(e) => selectProduct(index, e.target.value)}
                          disabled={isOrderProtected()}
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">Produkt wählen oder manuell eingeben</option>
                          {products.map((product) => (
                            <option key={`${product.type}-${product.id}`} value={product.id}>
                              {product.display_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.article_number}
                          onChange={(e) => updateItem(index, 'article_number', e.target.value)}
                          disabled={isOrderProtected()}
                          className="w-32 text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="Art.-Nr."
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          disabled={isOrderProtected()}
                          className="w-48 text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="Kurzbeschreibung"
                          title={item.description}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          disabled={isOrderProtected()}
                          className="w-20 text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          min="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          disabled={isOrderProtected()}
                          className="w-16 text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.list_price}
                          onChange={(e) => updateItem(index, 'list_price', e.target.value)}
                          disabled={isOrderProtected()}
                          className="w-24 text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          min="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.discount_percent}
                          onChange={(e) => updateItem(index, 'discount_percent', e.target.value)}
                          disabled={isOrderProtected()}
                          className="w-20 text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          min="0"
                          max="100"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {parseFloat(item.final_price || 0).toFixed(2)} €
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        {(parseFloat(item.final_price || 0) * parseFloat(item.quantity || 0)).toFixed(2)} €
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={isOrderProtected()}
                          className="text-red-600 hover:text-red-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="9" className="px-3 py-3 text-right text-sm font-medium text-gray-900">
                      Gesamtsumme:
                    </td>
                    <td className="px-3 py-3 text-sm font-bold text-gray-900">
                      {calculateTotal().toFixed(2)} €
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Notes & Dokument */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Notizen</h2>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="4"
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Zusätzliche Bemerkungen zur Bestellung..."
              />
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Bestelldokument</h2>
              <div className="space-y-3">
                {isEditMode && formData.order_document && typeof formData.order_document === 'string' && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <span className="text-sm text-blue-800">
                      📄 {formData.order_document.split('/').pop()}
                    </span>
                    <a
                      href={formData.order_document.startsWith('http') ? formData.order_document : `http://localhost:8000/media/${formData.order_document}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Öffnen
                    </a>
                  </div>
                )}
                {isEditMode && formData.order_document && typeof formData.order_document !== 'string' && (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                    <span className="text-sm text-green-800">
                      📄 {formData.order_document.name} (neu hochgeladen)
                    </span>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dokument hochladen (z.B. Online-Bestellung)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    disabled={isOrderProtected()}
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        setFormData({ ...formData, order_document: e.target.files[0] });
                      }
                    }}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                  />
                  <p className="mt-1 text-xs text-gray-500">PDF, DOC, DOCX (max. 10MB)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          {isEditMode && (
            <>
              <button
                type="button"
                onClick={handleViewPDF}
                className="px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50"
              >
                👁️ PDF anzeigen
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="px-4 py-2 border border-blue-600 rounded-md shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50"
              >
                📄 PDF herunterladen
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate('/procurement/orders')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Speichere...' : (isEditMode ? 'Speichern' : 'Bestellung anlegen')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrderForm;
