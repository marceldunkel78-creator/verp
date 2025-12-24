import React, { useState, useEffect, useRef } from 'react';
/* eslint-disable react-hooks/exhaustive-deps */
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeftIcon, PlusIcon, TrashIcon, Cog6ToothIcon,
  BuildingOfficeIcon, ClipboardDocumentListIcon,
  CheckCircleIcon, DocumentTextIcon, TruckIcon,
  CurrencyEuroIcon, ClipboardDocumentCheckIcon,
  InboxArrowDownIcon
} from '@heroicons/react/24/outline';

const OrderFormNew = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Data states
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [deliveryTerms, setDeliveryTerms] = useState([]);
  const [deliveryInstructions, setDeliveryInstructions] = useState([]);
  
  const [formData, setFormData] = useState({
    supplier: '',
    status: 'angelegt',
    order_type: 'direct', // default in UI (explicit). Toggle with "Online-Bestellung" checkbox
    created_by: '',
    offer_reference: '',
    offer_document: null,
    order_date: '',
    confirmation_date: '',
    delivery_date: '',
    payment_date: '',
    payment_term: '',
    delivery_term: '',
    delivery_instruction: '',
    custom_text: '',
    order_document: null,
    notes: '',
    items: []
  });
  
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [productSearch, setProductSearch] = useState({});
  const [productDropdownOpen, setProductDropdownOpen] = useState({});
  const productInputRefs = useRef({});
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [manageModalIndex, setManageModalIndex] = useState(null);
  const [manageTemp, setManageTemp] = useState({ warefunktion: '', auftrag: null, projekt: null, system: null });
  const [manageSearchResults, setManageSearchResults] = useState({ auftrag: [], projekt: [], system: [] });
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfStatus, setPdfStatus] = useState(null); // 'opening' | 'opened' | 'failed' | null

  // Portal-based dropdown to avoid being clipped by parent containers
  const ProductDropdown = ({ anchorEl, products, searchValue, onSelect, onClose }) => {
    const [style, setStyle] = useState({});

    useEffect(() => {
      if (!anchorEl) return;
      const computeStyle = () => {
        const rect = anchorEl.getBoundingClientRect();
        const vpH = window.innerHeight;
        const spaceBelow = vpH - rect.bottom;
        const preferBelow = spaceBelow > 240; // if enough space below, render below; otherwise above
        const maxHeight = Math.floor(window.innerHeight * 0.6);
        let top;
        if (preferBelow) {
          top = rect.bottom + 6;
        } else {
          top = Math.max(6, rect.top - Math.min(480, maxHeight) - 6);
        }
        const width = Math.max(rect.width, 320);
        let left = Math.max(6, rect.left);
        // Ensure dropdown fits within viewport horizontally
        if (left + width > window.innerWidth - 6) {
          left = Math.max(6, window.innerWidth - width - 6);
        }
        setStyle({ position: 'fixed', top: `${top}px`, left: `${left}px`, width: `${width}px`, zIndex: 9999, maxHeight: `${maxHeight}px`, overflow: 'auto', background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '4px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' });
      };

      computeStyle();
      const onScroll = () => computeStyle();
      window.addEventListener('resize', onScroll);
      window.addEventListener('scroll', onScroll, true);
      return () => {
        window.removeEventListener('resize', onScroll);
        window.removeEventListener('scroll', onScroll, true);
      };
    }, [anchorEl, searchValue, products]);

    useEffect(() => {
      const onDocClick = (e) => {
        if (!anchorEl) return;
        if (!anchorEl.contains(e.target) && !e.target.closest('.product-portal-dropdown')) {
          onClose();
        }
      };
      const onKey = (e) => { if (e.key === 'Escape') onClose(); };
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('mousedown', onDocClick);
        document.removeEventListener('keydown', onKey);
      };
    }, [anchorEl, onClose]);

    const results = (products || []).filter(p => p.display_name.toLowerCase().includes((searchValue || '').toLowerCase()));

    return createPortal(
      <div className="product-portal-dropdown" style={style}>
        {results.length ? results.map(p => (
          <div key={`${p.type}-${p.id}`} onClick={() => onSelect(p)} className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-base">
            {p.display_name}
          </div>
        )) : (
          <div className="px-3 py-2 text-sm text-gray-500">Keine Treffer</div>
        )}
      </div>,
      document.body
    );
  };

  const isConfirmed = formData.status === 'bestaetigt';
  const { user: authUser } = useAuth();

  // Tab configuration
  const tabs = [
    { id: 0, name: 'Lieferant & Angebot', icon: BuildingOfficeIcon, enabled: !isConfirmed },
    { id: 1, name: 'Positionen', icon: ClipboardDocumentListIcon, enabled: !!formData.supplier && !isConfirmed },
    { id: 2, name: 'Konditionen & Kommentar', icon: DocumentTextIcon, enabled: !!formData.supplier && formData.items.length > 0 && !isConfirmed },
    { id: 3, name: 'Bestellung', icon: ClipboardDocumentCheckIcon, enabled: !!formData.supplier && formData.items.length > 0 },
    // Allow opening Auftragsbestätigung for existing orders as well (isEditMode)
    { id: 4, name: 'Auftragsbestätigung', icon: CheckCircleIcon, enabled: isEditMode || formData.status === 'bestellt' || formData.status === 'bestaetigt' || formData.status === 'geliefert' || formData.status === 'bezahlt' },
    { id: 5, name: 'Lieferung', icon: TruckIcon, enabled: isEditMode || formData.status === 'bestaetigt' || formData.status === 'geliefert' || formData.status === 'bezahlt' },
    { id: 6, name: 'Bezahlung', icon: CurrencyEuroIcon, enabled: isEditMode || formData.status === 'geliefert' || formData.status === 'bezahlt' },
  ];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchInitialData();
    
    // Warn before leaving with unsaved changes
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // If auth context becomes available, prefer the authenticated user as the default Besteller
  useEffect(() => {
    if (!isEditMode && authUser && authUser.id && !formData.created_by) {
      setFormData(prev => ({ ...prev, created_by: authUser.id }));
    }
  }, [authUser, isEditMode, formData.created_by]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (id) {
      fetchOrder();
    }
  }, [id]);

  const fetchInitialData = async () => {
    try {
      // Fetch suppliers
      const suppliersRes = await api.get('/suppliers/suppliers/?is_active=true');
      const supplierData = suppliersRes.data.results || suppliersRes.data;
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      
      // Fetch users
      const usersRes = await api.get('/users/');
      const userData = usersRes.data.results || usersRes.data;
      setUsers(Array.isArray(userData) ? userData : []);
      
      // Fetch payment terms
      const paymentRes = await api.get('/settings/payment-terms/');
      setPaymentTerms(Array.isArray(paymentRes.data) ? paymentRes.data : (paymentRes.data.results || []));
      
      // Fetch delivery terms
      const deliveryTermsRes = await api.get('/settings/delivery-terms/');
      setDeliveryTerms(Array.isArray(deliveryTermsRes.data) ? deliveryTermsRes.data : (deliveryTermsRes.data.results || []));
      
      // Fetch delivery instructions
      const deliveryInstRes = await api.get('/settings/delivery-instructions/');
      setDeliveryInstructions(Array.isArray(deliveryInstRes.data) ? deliveryInstRes.data : (deliveryInstRes.data.results || []));
      
      // Set default user as current logged in user (prefer auth context user)
      if (!isEditMode) {
        if (authUser && authUser.id) {
          setFormData(prev => ({ ...prev, created_by: authUser.id }));
        } else if (userData.length > 0) {
          setFormData(prev => ({ ...prev, created_by: userData[0].id }));
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Daten:', error);
      console.error('Error details:', error.response?.data);
      console.error('Failed URL:', error.config?.url);
      alert('Fehler beim Laden der Grunddaten: ' + (error.response?.data?.detail || error.message));
    }
  };

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/orders/orders/${id}/`);
      const order = response.data;
      
      // Ensure all item fields are properly initialized
      const normalizedItems = (order.items || []).map(item => ({
        ...item,
        article_number: item.article_number || '',
        name: item.name || '',
        description: item.description || '',
        quantity: item.quantity || 0,
        unit: item.unit || 'Stk',
        list_price: item.list_price || 0,
        discount_percent: item.discount_percent || 0,
        final_price: item.final_price || 0,
        currency: item.currency || 'EUR',
        position: item.position || 0,
        trading_product: item.trading_product || null,
        asset: item.asset || null,
        material_supply: item.material_supply || null,
        confirmed_price: item.confirmed_price || null,
        controlling_checked: item.controlling_checked || false,
        management_info: item.management_info || { warefunktion: '', auftrag: null, projekt: null, system: null }
      }));
      
      const orderData = {
        supplier: order.supplier,
        status: order.status || 'angelegt',
        status_display: order.status_display || order.status,
        order_type: order.order_type || 'direct',
        created_by: order.created_by || '',
        offer_reference: order.offer_reference || '',
        offer_document: order.offer_document || null,
        order_date: order.order_date || '',
        confirmation_date: order.confirmation_date || '',
        expected_delivery_date: order.expected_delivery_date || '',
        delivery_date: order.delivery_date || '',
        payment_date: order.payment_date || '',
        payment_term: order.payment_term || '',
        delivery_term: order.delivery_term || '',
        delivery_instruction: order.delivery_instruction || '',
        custom_text: order.custom_text || '',
        order_document: order.order_document || null,
        supplier_confirmation_document: order.supplier_confirmation_document || null,
        notes: order.notes || '',
        items: normalizedItems,
        confirmed_total: order.confirmed_total || null
      };

      setFormData(orderData);
      // Ensure id and order_number are available locally right away
      setFormData(prev => ({ ...prev, id: order.id, order_number: order.order_number || prev.order_number }));

      if (order.supplier) {
        loadSupplierProducts(order.supplier);
      }

      // Try to warm up the PDF (with retries) so user can open it immediately (unless this is an online order)
      if (order.order_type !== 'online') {
        warmupPdf(order.id).catch(() => {});
      } else {
      }
    } catch (error) {
      console.error('Fehler beim Laden der Bestellung:', error);
      alert('Fehler beim Laden der Bestellung');
    } finally {
      setLoading(false);
    }
  };

  const loadSupplierProducts = async (supplierId) => {
    if (!supplierId) {
      setSelectedSupplier(null);
      setProducts([]);
      return;
    }

    try {
      const supplierResponse = await api.get(`/suppliers/suppliers/${supplierId}/`);
      setSelectedSupplier(supplierResponse.data);

      const [tradingRes, materialsRes] = await Promise.all([
        api.get(`/suppliers/products/?supplier=${supplierId}`).catch(() => ({ data: { results: [] } })),
        api.get(`/suppliers/material-supplies/?supplier=${supplierId}`).catch(() => ({ data: { results: [] } }))
      ]);

      const tradingProducts = (tradingRes.data.results || tradingRes.data || []).map(p => ({
        ...p,
        type: 'trading',
        display_name: `${p.supplier_part_number || p.visitron_part_number || 'N/A'} - ${p.name} (Handelswaren)`
      }));

      const materials = (materialsRes.data.results || materialsRes.data || []).map(p => ({
        ...p,
        type: 'material',
        display_name: `${p.supplier_part_number || p.visitron_part_number || 'N/A'} - ${p.name} (Materialien)`
      }));

      setProducts([...tradingProducts, ...materials]);
    } catch (error) {
      console.error('Fehler beim Laden der Lieferanten-Details:', error);
    }
  };

  const handleSupplierChange = async (supplierId) => {
    const newFormData = { ...formData, supplier: supplierId };
    
    // Clear items when changing supplier
    if (!isEditMode) {
      newFormData.items = [];
    }
    
    setFormData(newFormData);
    setHasUnsavedChanges(true);
    
    if (!supplierId) {
      setSelectedSupplier(null);
      setProducts([]);
      return;
    }

    try {
      const supplierResponse = await api.get(`/suppliers/suppliers/${supplierId}/`);
      setSelectedSupplier(supplierResponse.data);
      
      // Auto-populate settings
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

      await loadSupplierProducts(supplierId);
    } catch (error) {
      console.error('Fehler beim Laden der Lieferanten-Details:', error);
    }
  };

  const updateFormData = (field, value) => {
    // Prevent edits to first three tabs when order is confirmed
    if (formData.status === 'bestaetigt' && activeTab <= 2) {
      alert('Diese Bestellung ist bestätigt — Felder in den ersten drei Tabs sind nicht editierbar.');
      return;
    }
    setFormData({ ...formData, [field]: value });
    setHasUnsavedChanges(true);
  };

  const addItem = () => {
    if (formData.status === 'bestaetigt') {
      alert('Positionen können nicht hinzugefügt werden, da die Bestellung bestätigt ist.');
      return;
    }

    const newItems = [
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
        material_supply: null,
        management_info: { warefunktion: '', auftrag: null, projekt: null, system: null }
      }
    ];
    setFormData({ ...formData, items: newItems });
    setHasUnsavedChanges(true);
  };

  const removeItem = (index) => {
    if (formData.status === 'bestaetigt') {
      alert('Positionen können nicht entfernt werden, da die Bestellung bestätigt ist.');
      return;
    }
    const newItems = formData.items.filter((_, i) => i !== index);
    newItems.forEach((item, i) => {
      item.position = i + 1;
    });
    setFormData({ ...formData, items: newItems });
    setHasUnsavedChanges(true);
  };

  const updateItem = (index, field, value) => {
    // Prevent edits to positions when order is confirmed
    if (formData.status === 'bestaetigt' && activeTab <= 2) {
      alert('Diese Bestellung ist bestätigt — Positionen können nicht bearbeitet werden.');
      return;
    }

    const newItems = [...formData.items];
    newItems[index][field] = value;

    if (field === 'list_price' || field === 'discount_percent') {
      const listPrice = parseFloat(newItems[index].list_price) || 0;
      const discount = parseFloat(newItems[index].discount_percent) || 0;
      newItems[index].final_price = (listPrice * (1 - discount / 100)).toFixed(2);
    }

    setFormData({ ...formData, items: newItems });
    setHasUnsavedChanges(true);
  };

  const selectProduct = (index, productId) => {
    const product = products.find(p => p.id === parseInt(productId));
    if (!product) return;

    const newItems = [...formData.items];
    
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

    const finalListPrice = parseFloat(newItems[index].list_price) || 0;
    const finalDiscount = parseFloat(newItems[index].discount_percent) || 0;
    newItems[index].final_price = (finalListPrice * (1 - finalDiscount / 100)).toFixed(2);

    setFormData({ ...formData, items: newItems });
    setHasUnsavedChanges(true);
  };

  // Helper for searchable product input
  const handleSelectProductFromSearch = (index, product) => {
    selectProduct(index, product.id);
    setProductSearch(prev => ({ ...prev, [index]: '' }));
    setProductDropdownOpen(prev => ({ ...prev, [index]: false }));
  };

  // Manage modal helpers
  // eslint-disable-next-line no-unused-vars
  const openManageModal = (index) => {
    setManageModalIndex(index);
    setManageTemp(formData.items[index].management_info || { warefunktion: '', auftrag: null, projekt: null, system: null });
    setManageSearchResults({ auftrag: [], projekt: [], system: [] });
    setManageModalOpen(true);
  };

  const closeManageModal = () => {
    setManageModalOpen(false);
    setManageModalIndex(null);
    setManageTemp({ warefunktion: '', auftrag: null, projekt: null, system: null });
    setManageSearchResults({ auftrag: [], projekt: [], system: [] });
  };

  const handleManageSearch = async (type, query) => {
    if (!query || query.length < 2) {
      setManageSearchResults(prev => ({ ...prev, [type]: [] }));
      return;
    }

    let url = '';
    if (type === 'auftrag') url = `/customer-orders/customer-orders/?search=${encodeURIComponent(query)}`;
    if (type === 'projekt') url = `/sales/projects/?search=${encodeURIComponent(query)}`;
    if (type === 'system') url = `/sales/systems/?search=${encodeURIComponent(query)}`;

    try {
      const res = await api.get(url);
      const results = res.data.results || res.data || [];
      setManageSearchResults(prev => ({ ...prev, [type]: results }));
    } catch (error) {
      setManageSearchResults(prev => ({ ...prev, [type]: [] }));
    }
  };

  const saveManageModal = () => {
    const idx = manageModalIndex;
    if (idx === null || idx === undefined) return;
    const newItems = [...formData.items];
    newItems[idx].management_info = manageTemp;
    setFormData(prev => ({ ...prev, items: newItems }));
    setHasUnsavedChanges(true);
    closeManageModal();
  };

  // Calculate total of all items
  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => {
      const finalPrice = parseFloat(item.final_price) || 0;
      const quantity = parseFloat(item.quantity) || 0;
      return sum + (finalPrice * quantity);
    }, 0);
  };

  const handleDownloadPDF = async () => {
    const orderId = formData.id || id;
    if (!orderId) {
      alert('Bestellung muss zuerst gespeichert werden, um PDF herunterzuladen.');
      return;
    }

    // For online orders prefer the uploaded order_document; if none, show message
    if (formData.order_type === 'online') {
      if (formData.order_document) {
        const url = formData.order_document.startsWith('http') ? formData.order_document : `${window.location.origin}${formData.order_document}`;
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Bestellnachweis_${formData.order_number || orderId}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        return;
      }
      alert('Bei Online-Bestellungen wird kein automatisch generiertes PDF bereitgestellt. Bitte laden Sie einen Bestellnachweis hoch.');
      return;
    }

    try {
      const response = await api.get(`/orders/orders/${orderId}/download_pdf/`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Bestellung_${formData.order_number || orderId}.pdf`);
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
    const orderId = formData.id || id;
    if (!orderId) {
      alert('Bestellung muss zuerst gespeichert werden, um PDF anzeigen zu können.');
      return;
    }

    // For online orders, show uploaded order_document if present
    if (formData.order_type === 'online') {
      if (formData.order_document) {
        const url = formData.order_document.startsWith('http') ? formData.order_document : `${window.location.origin}${formData.order_document}`;
        window.open(url, '_blank');
        return;
      }
      alert('Bei Online-Bestellungen ist kein automatisch generiertes PDF verfügbar. Bitte laden Sie einen Bestellnachweis hoch.');
      return;
    }

    try {
      if (pdfBlobUrl) {
        window.open(pdfBlobUrl, '_blank');
        return;
      }

      const response = await api.get(`/orders/orders/${orderId}/download_pdf/`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      setPdfBlobUrl(url);
      window.open(url, '_blank');
      setTimeout(() => {
        // keep blob for a short time; revoke later when component unmounts or on new warmup
        // window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Fehler beim Anzeigen:', error);
      alert('Fehler beim PDF-Anzeigen');
    }
  };

  // Warm-up: fetch PDF and store blob url so the user can immediately view/download
  // Retries a few times because PDF generation may be done asynchronously on the backend.
  const warmupPdf = async (orderId, attempts = 12, delayMs = 1000) => {
    if (!orderId) return null;
    let lastErr = null;

    for (let i = 0; i < attempts; i++) {
      try {
        const response = await api.get(`/orders/orders/${orderId}/download_pdf/`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        setPdfBlobUrl(prev => {
          if (prev) {
            try { window.URL.revokeObjectURL(prev); } catch (e) { /* ignore */ }
          }
          return url;
        });
    
        return url;
      } catch (error) {
        lastErr = error;

        // wait a bit
        await new Promise(res => setTimeout(res, delayMs));
      }
    }

    console.warn('PDF warmup failed after retries:', lastErr);
    return null;
  };

  const handleSave = async () => {
    if (!formData.supplier) {
      alert('Bitte wählen Sie einen Lieferanten aus');
      setActiveTab(0);
      return;
    }

    if (formData.items.length === 0) {
      alert('Bitte fügen Sie mindestens eine Position hinzu');
      setActiveTab(1);
      return;
    }

    // Global guard: if status is 'bestaetigt' and confirmation_date is set, ensure all controlling checkboxes are checked
    const allCheckedGlobal = formData.items && formData.items.length > 0 ? formData.items.every(i => !!i.controlling_checked) : false;
    if (formData.status === 'bestaetigt' && formData.confirmation_date && !allCheckedGlobal) {
      alert('Alle Controlling-Checkboxen müssen gesetzt sein, bevor die Bestellung als bestätigt gespeichert werden kann.');
      setActiveTab(4); // switch to Auftragsbestätigung tab so user can fix
      return;
    }

    // Debugging: log controlling flags when attempting to save


    setLoading(true);
    try {
      const submitData = {
        ...formData,
        order_date: formData.order_date || null,
        confirmation_date: formData.confirmation_date || null,
        delivery_date: formData.delivery_date || null,
        expected_delivery_date: formData.expected_delivery_date || null,
        payment_date: formData.payment_date || null
      };

      // Handle file uploads with FormData
      const hasNewFiles = (formData.order_document && typeof formData.order_document !== 'string') ||
                          (formData.offer_document && typeof formData.offer_document !== 'string') ||
                          (formData.supplier_confirmation_document && typeof formData.supplier_confirmation_document !== 'string');

      if (hasNewFiles) {
        const formDataObj = new FormData();

        Object.keys(submitData).forEach(key => {
          if (key !== 'items' && key !== 'order_document' && key !== 'offer_document' && key !== 'supplier_confirmation_document' && 
              submitData[key] !== null && submitData[key] !== '') {
            formDataObj.append(key, submitData[key]);
          }
        });

        if (formData.order_document && typeof formData.order_document !== 'string') {
          formDataObj.append('order_document', formData.order_document);
        }
        if (formData.offer_document && typeof formData.offer_document !== 'string') {
          formDataObj.append('offer_document', formData.offer_document);
        }
        if (formData.supplier_confirmation_document && typeof formData.supplier_confirmation_document !== 'string') {
          formDataObj.append('supplier_confirmation_document', formData.supplier_confirmation_document);
        }

        formDataObj.append('items', JSON.stringify(submitData.items));

        if (isEditMode) {
          const response = await api.put(`/orders/orders/${id}/`, formDataObj, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
  
          // If server returned updated data, ensure local state has id/order_number
          if (response?.data?.id) {
            setFormData(prev => ({ ...prev, id: response.data.id, order_number: response.data.order_number || prev.order_number, order_document: response.data.order_document || prev.order_document, supplier_confirmation_document: response.data.supplier_confirmation_document || prev.supplier_confirmation_document, status: response.data.status || prev.status, status_display: response.data.status_display || prev.status_display }));
            // warm up PDF
            if (response.data.order_type !== 'online') {
              await warmupPdf(response.data.id);
            }
          }
        } else {
          const response = await api.post('/orders/orders/', formDataObj, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (response?.data?.id) {
            // Update local state so PDF buttons and order number are immediately available
            setFormData(prev => ({ ...prev, id: response.data.id, order_number: response.data.order_number || prev.order_number, order_document: response.data.order_document || prev.order_document, supplier_confirmation_document: response.data.supplier_confirmation_document || prev.supplier_confirmation_document, status: response.data.status || prev.status, status_display: response.data.status_display || prev.status_display }));

            // Warm up PDF in background (no auto-open)
            setTimeout(() => setPdfStatus(null), 12000);
            const pdfUrl = await warmupPdf(response.data.id);
            if (pdfUrl) {
              setPdfStatus('opened');
              setTimeout(() => setPdfStatus(null), 6000);
            } else {
              setPdfStatus('failed');
              setTimeout(() => setPdfStatus(null), 12000);
            }

            // Navigate to edit route so URL reflects the saved order
            navigate(`/procurement/orders/${response.data.id}/edit`, { replace: true });
          }
        }
      } else {
        const dataToSubmit = { ...submitData };
        delete dataToSubmit.order_document;
        delete dataToSubmit.offer_document;
        delete dataToSubmit.supplier_confirmation_document;

        if (isEditMode) {
          const response = await api.put(`/orders/orders/${id}/`, dataToSubmit);

          if (response?.data?.id) {
            setFormData(prev => ({ ...prev, id: response.data.id, order_number: response.data.order_number || prev.order_number, order_document: response.data.order_document || prev.order_document, supplier_confirmation_document: response.data.supplier_confirmation_document || prev.supplier_confirmation_document, status: response.data.status || prev.status, status_display: response.data.status_display || prev.status_display }));

            // Warm up PDF in background (no auto-open) unless order_type is 'online'
            if (response.data.order_type !== 'online') {
              setPdfStatus('opening');
              setTimeout(() => setPdfStatus(null), 12000);
              const pdfUrl = await warmupPdf(response.data.id);
              if (pdfUrl) {
                setPdfStatus('opened');
                setTimeout(() => setPdfStatus(null), 6000);
              } else {
                setPdfStatus('failed');
                setTimeout(() => setPdfStatus(null), 12000);
              }
            } else {
            }
          }
        } else {
          const response = await api.post('/orders/orders/', dataToSubmit);

          // Bei neuer Bestellung: zur Edit-Seite navigieren, damit weitere Bearbeitungen möglich sind
          if (response?.data?.id) {
            setFormData(prev => ({ ...prev, id: response.data.id, order_number: response.data.order_number || prev.order_number, order_document: response.data.order_document || prev.order_document, supplier_confirmation_document: response.data.supplier_confirmation_document || prev.supplier_confirmation_document, status: response.data.status || prev.status, status_display: response.data.status_display || prev.status_display }));

            // Warm up PDF in background (no auto-open) unless order_type is 'online'
            if (response.data.order_type !== 'online') {
              setPdfStatus('opening');
              setTimeout(() => setPdfStatus(null), 12000);
              const pdfUrl = await warmupPdf(response.data.id);
              if (pdfUrl) {
                setPdfStatus('opened');
                setTimeout(() => setPdfStatus(null), 6000);
              } else {
                setPdfStatus('failed');
                setTimeout(() => setPdfStatus(null), 12000);
              }
            } else {
            }

            navigate(`/procurement/orders/${response.data.id}/edit`, { replace: true });
          }
        }
      }

      setHasUnsavedChanges(false);
      alert('Bestellung erfolgreich gespeichert!');
    } catch (error) {
      console.error('Fehler beim Speichern der Bestellung:', error);
      const errorMsg = error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message;
      alert('Fehler beim Speichern:\n\n' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const changeTab = (newTab) => {
    if (!tabs[newTab].enabled) return;
    setActiveTab(newTab);
  };

  // Whether all Controlling checkboxes across items are checked
  const allControllingChecked = formData.items && formData.items.length > 0 ? formData.items.every(i => i.controlling_checked) : false;
  // If confirmation date is set but not all controlling checks are checked, the confirmation save should be blocked
  const confirmationBlocksSave = formData.confirmation_date && !allControllingChecked;

  if (loading && isEditMode && formData.supplier === '') {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => {
            if (hasUnsavedChanges) {
              if (window.confirm('Sie haben ungespeicherte Änderungen. Möchten Sie wirklich fortfahren?')) {
                navigate('/procurement/orders');
              }
            } else {
              navigate('/procurement/orders');
            }
          }}
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zur Übersicht
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              { (isEditMode ? 'Bestellung bearbeiten' : 'Neue Bestellung') }{formData.order_number ? ` — ${formData.order_number}` : '' }
            </h1>
            {/* Current status under heading */}
            <p className="text-sm text-gray-600 mt-1">Status: <strong className="text-gray-800">{formData.status_display || formData.status}</strong></p>
            {isConfirmed && (
              <div className="mt-2 inline-flex items-center px-3 py-2 rounded bg-blue-50 border border-blue-200 text-sm text-blue-800">
                Bestellung bestätigt — erste drei Tabs sind schreibgeschützt.
              </div>
            )}
            {pdfStatus === 'opening' && (
              <div className="mt-2 inline-flex items-center px-3 py-2 rounded bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
                PDF wird erstellt…
              </div>
            )}
            {pdfStatus === 'failed' && (
              <div className="mt-2 inline-flex items-center px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-800">
                PDF konnte nicht erstellt werden
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Show button when an order_document (saved PDF) exists */}
            {formData.order_document && typeof formData.order_document === 'string' && (
              <button
                type="button"
                onClick={() => {
                  const url = formData.order_document.startsWith('http') ? formData.order_document : `${window.location.origin}${formData.order_document}`;
                  window.open(url, '_blank');
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <DocumentTextIcon className="h-5 w-5 mr-2" />
                Bestellung anzeigen
              </button>
            )}

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={loading}
              className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
            >
              <CheckCircleIcon className="h-5 w-5 mr-2" />
              {loading ? 'Speichere...' : 'Speichern'}
            </button>
          </div>
        </div>
        {hasUnsavedChanges && (
          <p className="text-sm text-orange-600 mt-2">● Nicht gespeicherte Änderungen</p>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
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

      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg p-6">
        {/* Tab 1: Lieferant & Angebot */}
        {activeTab === 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Lieferant & Angebot</h2>
            
            {/* Lieferant Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lieferant *
              </label>
              <select
                value={formData.supplier}
                onChange={(e) => handleSupplierChange(e.target.value)}
                disabled={isConfirmed}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
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

            {/* Supplier Details Display */}
            {selectedSupplier && (
              <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Lieferanteninformationen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 font-medium">Adresse:</span>
                    <div className="text-gray-900 mt-1">
                      {selectedSupplier.street} {selectedSupplier.house_number}
                      {selectedSupplier.address_supplement && <><br />{selectedSupplier.address_supplement}</>}
                      <br />
                      {selectedSupplier.postal_code} {selectedSupplier.city}
                      <br />
                      {selectedSupplier.country}
                    </div>
                  </div>
                  <div>
                    {selectedSupplier.customer_number && (
                      <div className="mb-2">
                        <span className="text-gray-600 font-medium">Unsere Kundennummer:</span>
                        <div className="text-gray-900 font-mono mt-1">{selectedSupplier.customer_number}</div>
                      </div>
                    )}
                    {selectedSupplier.email && (
                      <div className="mb-2">
                        <span className="text-gray-600 font-medium">E-Mail:</span>
                        <div className="text-gray-900 mt-1">{selectedSupplier.email}</div>
                      </div>
                    )}
                    {selectedSupplier.phone && (
                      <div>
                        <span className="text-gray-600 font-medium">Telefon:</span>
                        <div className="text-gray-900 mt-1">{selectedSupplier.phone}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Angebotsreferenz */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Angebotsreferenz
              </label>
              <input
                type="text"
                value={formData.offer_reference}
                onChange={(e) => updateFormData('offer_reference', e.target.value)}
                disabled={isConfirmed}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                placeholder="z.B. Angebot-2025-001"
              />
            </div>

            {/* Online Bestellung Checkbox */}
            <div className="mt-4">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={formData.order_type === 'online'}
                  onChange={(e) => {
                    const isOnline = e.target.checked;
                    updateFormData('order_type', isOnline ? 'online' : 'direct');
                    if (isOnline) {
                      // Remove any warmed-up PDF to avoid confusion
                      setPdfBlobUrl(null);
                      setPdfStatus(null);
                    }
                  }}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Online-Bestellung (kein automatisch generiertes PDF)</span>
              </label>

              {formData.order_type === 'online' && (
                <div className="mt-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-md p-3">
                  Bei aktivierter Option wird beim Speichern kein automatisch generiertes Bestell‑PDF erstellt oder zur Vorschau bereitgestellt. Bitte laden Sie im Tab "Bestellung" einen <strong>Bestellnachweis</strong> (z. B. PDF) hoch.
                </div>
              )}
            </div>

            {/* Angebotsdokument Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Angebotsdokument hochladen
              </label>
              {formData.offer_document && typeof formData.offer_document === 'string' && (
                <div className="mb-2 flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <span className="text-sm text-blue-800">
                    📄 {formData.offer_document.split('/').pop()}
                  </span>
                  <a
                    href={formData.offer_document.startsWith('http') ? formData.offer_document : `http://localhost:8000${formData.offer_document}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Öffnen
                  </a>
                </div>
              )}
              {formData.offer_document && typeof formData.offer_document !== 'string' && (
                <div className="mb-2 flex items-center p-3 bg-green-50 border border-green-200 rounded-md">
                  <span className="text-sm text-green-800">
                    📄 {formData.offer_document.name} (neu hochgeladen)
                  </span>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  if (e.target.files[0]) {
                    updateFormData('offer_document', e.target.files[0]);
                  }
                }}
                disabled={isConfirmed}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-gray-500">PDF, DOC, DOCX (max. 10MB)</p>
            </div>

            {/* Besteller Auswahl */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Besteller *
              </label>
              <select
                value={formData.created_by}
                onChange={(e) => updateFormData('created_by', e.target.value)}
                disabled={isConfirmed}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                required
              >
                <option value="">Bitte wählen...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} {user.first_name && user.last_name ? `(${user.first_name} ${user.last_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Navigation */}
            <div className="flex justify-end pt-4 border-t">
              <button
                type="button"
                onClick={() => changeTab(1)}
                disabled={!formData.supplier}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Weiter zu Positionen →
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Positionen */}
        {activeTab === 1 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Bestellpositionen</h2>
              <button
                type="button"
                onClick={addItem}
                disabled={isConfirmed}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Position hinzufügen
              </button>
            </div>

            {formData.items.length === 0 && (
              <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-md border-2 border-dashed border-gray-300">
                <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium mb-2">Keine Positionen vorhanden</p>
                <p className="text-sm">Klicken Sie auf "Position hinzufügen" um zu beginnen</p>
              </div>
            )}

            {formData.items.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produkt</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artikel-Nr.</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Menge</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Einheit</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Listenpreis</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rabatt %</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpreis</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gesamt</th>
                        <th className="px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {formData.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                            {item.position}
                          </td>
                          <td className="px-3 py-2 relative">
                            <input
                              ref={(el) => { productInputRefs.current[index] = el; }}
                              type="text"
                              value={productSearch[index] || ''}
                              onChange={(e) => {
                                setProductSearch(prev => ({ ...prev, [index]: e.target.value }));
                                setProductDropdownOpen(prev => ({ ...prev, [index]: true }));
                              }}
                              onFocus={() => setProductDropdownOpen(prev => ({ ...prev, [index]: true }))}
                              placeholder={item.name || 'Produkt wählen oder manuell eingeben'}
                              className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                            />
                            {productDropdownOpen[index] && productInputRefs.current[index] && (
                              <ProductDropdown
                                anchorEl={productInputRefs.current[index]}
                                products={products}
                                searchValue={productSearch[index] || ''}
                                onSelect={(p) => handleSelectProductFromSearch(index, p)}
                                onClose={() => setProductDropdownOpen(prev => ({ ...prev, [index]: false }))}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.article_number}
                              onChange={(e) => updateItem(index, 'article_number', e.target.value)}
                              className="w-32 text-sm border border-gray-300 rounded px-2 py-1"
                              placeholder="Art.-Nr."
                              disabled={isConfirmed}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => updateItem(index, 'name', e.target.value)}
                              className="w-48 text-sm border border-gray-300 rounded px-2 py-1"
                              placeholder="Name"
                              disabled={isConfirmed}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                              className="w-20 text-sm border border-gray-300 rounded px-2 py-1"
                              min="0"
                              disabled={isConfirmed}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => updateItem(index, 'unit', e.target.value)}
                              className="w-16 text-sm border border-gray-300 rounded px-2 py-1"
                              disabled={isConfirmed}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.list_price}
                              onChange={(e) => updateItem(index, 'list_price', e.target.value)}
                              className="w-24 text-sm border border-gray-300 rounded px-2 py-1"
                              min="0"
                              disabled={isConfirmed}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.discount_percent}
                              onChange={(e) => updateItem(index, 'discount_percent', e.target.value)}
                              className="w-20 text-sm border border-gray-300 rounded px-2 py-1"
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
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setManageModalIndex(index);
                                  setManageTemp(formData.items[index].management_info || { warefunktion: '', auftrag: null, projekt: null, system: null });
                                  setManageSearchResults({ auftrag: [], projekt: [], system: [] });
                                  setManageModalOpen(true);
                                }}
                                className="text-gray-600 hover:text-gray-900"
                                title="Verwaltungsinformationen"
                              >
                                <Cog6ToothIcon className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="text-red-600 hover:text-red-900"
                                disabled={isConfirmed}
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan="8" className="px-3 py-3 text-right text-sm font-medium text-gray-900">
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

                {/* Verwaltung Modal */}
                {manageModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{formData.items[manageModalIndex]?.name || 'Position'} — {formData.items[manageModalIndex]?.article_number}</h3>
                          <p className="text-sm text-gray-600">{formData.items[manageModalIndex]?.description}</p>
                        </div>
                        <button onClick={closeManageModal} className="text-gray-500 hover:text-gray-900">✖</button>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Warenfunktion</label>
                          <select
                            value={manageTemp.warefunktion}
                            onChange={(e) => setManageTemp(prev => ({ ...prev, warefunktion: e.target.value }))}
                            className="w-full border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="">Bitte wählen...</option>
                            <option value="Lager">Lager</option>
                            <option value="Asset">Asset</option>
                            <option value="Auftrag">Auftrag</option>
                            <option value="M&S">M&amp;S</option>
                          </select>
                        </div>

                        {manageTemp.warefunktion === 'Auftrag' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Auftrag (Suche)</label>
                              <input
                                type="text"
                                value={manageTemp.auftrag?.display_search || ''}
                                onChange={(e) => {
                                  setManageTemp(prev => ({ ...prev, auftrag: { ...prev.auftrag, display_search: e.target.value } }));
                                  handleManageSearch('auftrag', e.target.value);
                                }}
                                placeholder="Auftragsnummer oder Kunde..."
                                className="w-full border border-gray-300 rounded px-2 py-1"
                              />
                              <div className="mt-1 border border-gray-200 rounded max-h-40 overflow-auto">
                                {(manageSearchResults.auftrag || []).map(a => (
                                  <div key={a.id} className="px-2 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => setManageTemp(prev => ({ ...prev, auftrag: { id: a.id, display: `${a.order_number || a.id} — ${a.supplier_name || a.customer_name || a.name || ''}`, display_search: a.order_number || '' } }))}>
                                    {a.order_number || a.id} — {a.supplier_name || a.customer_name || a.name}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Projekt (Suche)</label>
                              <input
                                type="text"
                                value={manageTemp.projekt?.display_search || ''}
                                onChange={(e) => {
                                  setManageTemp(prev => ({ ...prev, projekt: { ...prev.projekt, display_search: e.target.value } }));
                                  handleManageSearch('projekt', e.target.value);
                                }}
                                placeholder="Projektnummer oder Kunde..."
                                className="w-full border border-gray-300 rounded px-2 py-1"
                              />
                              <div className="mt-1 border border-gray-200 rounded max-h-40 overflow-auto">
                                {(manageSearchResults.projekt || []).map(p => (
                                  <div key={p.id} className="px-2 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => setManageTemp(prev => ({ ...prev, projekt: { id: p.id, display: `${p.project_number || p.id} — ${p.customer_name || p.name || ''}`, display_search: p.project_number || '' } }))}>
                                    {p.project_number || p.id} — {p.customer_name || p.name}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">System (Suche)</label>
                              <input
                                type="text"
                                value={manageTemp.system?.display_search || ''}
                                onChange={(e) => {
                                  setManageTemp(prev => ({ ...prev, system: { ...prev.system, display_search: e.target.value } }));
                                  handleManageSearch('system', e.target.value);
                                }}
                                placeholder="Systemnummer oder Kunde..."
                                className="w-full border border-gray-300 rounded px-2 py-1"
                              />
                              <div className="mt-1 border border-gray-200 rounded max-h-40 overflow-auto">
                                {(manageSearchResults.system || []).map(s => (
                                  <div key={s.id} className="px-2 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => setManageTemp(prev => ({ ...prev, system: { id: s.id, display: `${s.system_number || s.id} — ${s.customer_name || s.name || ''}`, display_search: s.system_number || '' } }))}>
                                    {s.system_number || s.id} — {s.customer_name || s.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                      </div>

                      <div className="mt-4 flex justify-end space-x-2">
                        <button onClick={closeManageModal} className="px-3 py-2 border rounded">Abbrechen</button>
                        <button onClick={saveManageModal} className="px-3 py-2 bg-blue-600 text-white rounded">Speichern</button>
                      </div>

                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => changeTab(0)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    ← Zurück zu Lieferant
                  </button>
                  <button
                    type="button"
                    onClick={() => changeTab(2)}
                    disabled={loading || formData.items.length === 0}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    Weiter zu Konditionen →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Konditionen & Kommentar */}
        {activeTab === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Liefer- und Zahlungskonditionen</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Zahlungsbedingungen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zahlungsbedingungen
                </label>
                <select
                  value={formData.payment_term}
                  onChange={(e) => updateFormData('payment_term', e.target.value)}
                  disabled={isConfirmed}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Bitte wählen...</option>
                  {paymentTerms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name} ({term.days} Tage)
                    </option>
                  ))}
                </select>
              </div>

              {/* Lieferbedingungen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lieferbedingungen (Incoterm)
                </label>
                <select
                  value={formData.delivery_term}
                  onChange={(e) => updateFormData('delivery_term', e.target.value)}
                  disabled={isConfirmed}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Bitte wählen...</option>
                  {deliveryTerms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.incoterm} - {term.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lieferanweisung */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lieferanweisung
                </label>
                <select
                  value={formData.delivery_instruction}
                  onChange={(e) => updateFormData('delivery_instruction', e.target.value)}
                  disabled={isConfirmed}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">Bitte wählen...</option>
                  {deliveryInstructions.map((instruction) => (
                    <option key={instruction.id} value={instruction.id}>
                      {instruction.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Kommentarfeld */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kommentar / Besondere Hinweise
              </label>
              <textarea
                value={formData.custom_text}
                onChange={(e) => updateFormData('custom_text', e.target.value)}
                rows={6}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Besondere Hinweise, Kommentare, interne Notizen..."
              />
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <button
                type="button"
                onClick={() => changeTab(1)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                ← Zurück zu Positionen
              </button>
              <button
                type="button"
                onClick={() => changeTab(3)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Weiter zur Bestellung →
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Bestellung - Vorschau, PDF, Bestelldokument, Bestelldatum */}
        {activeTab === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Bestellung finalisieren</h2>

            {/* Vorschau der Bestellung */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Bestellübersicht</h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Lieferant:</p>
                  <p className="font-medium">{selectedSupplier?.company_name || 'Nicht ausgewählt'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Besteller:</p>
                  <p className="font-medium">{users.find(u => u.id === formData.created_by)?.username || 'Nicht ausgewählt'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Anzahl Positionen:</p>
                  <p className="font-medium">{formData.items.length}</p>
                </div>
                <div>
                  <p className="text-gray-600">Gesamtsumme:</p>
                  <p className="font-medium text-lg">{calculateTotal().toFixed(2)} €</p>
                </div>
              </div>
            </div>

            {/* PDF generieren */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-md font-medium text-gray-900 mb-3">Bestellungs-PDF</h3>
              {(formData.id || isEditMode) && formData.order_type !== 'online' && (
                <div className="space-y-2">
                  <div className="flex space-x-2 items-center">
                    <button
                      type="button"
                      onClick={handleViewPDF}
                      className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      <DocumentTextIcon className="h-5 w-5 mr-2" />
                      PDF Vorschau öffnen
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPDF}
                      className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50"
                    >
                      PDF herunterladen
                    </button>
                  </div>
                </div>
              )}

              {formData.id && formData.order_type === 'online' && (
                <div className="text-sm text-gray-600">Für Online-Bestellungen wird kein automatisch generiertes PDF erstellt. Laden Sie stattdessen einen Bestellnachweis unten hoch.</div>
              )}
              {!(formData.id || isEditMode) && (
                <p className="text-sm text-gray-500">PDF kann nach dem ersten Speichern generiert werden</p>
              )}
            </div>

            {/* Bestelldokument hochladen */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bestelldokument hochladen (optional)
              </label>
              {formData.order_document && typeof formData.order_document === 'string' && (
                <div className="mb-2 flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <span className="text-sm text-blue-800">
                    📄 {formData.order_document.split('/').pop()}
                  </span>
                  <a
                    href={formData.order_document.startsWith('http') ? formData.order_document : `http://localhost:8000${formData.order_document}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Öffnen
                  </a>
                </div>
              )}
              {formData.order_document && typeof formData.order_document !== 'string' && (
                <div className="mb-2 flex items-center p-3 bg-green-50 border border-green-200 rounded-md">
                  <span className="text-sm text-green-800">
                    📄 {formData.order_document.name} (neu hochgeladen)
                  </span>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                disabled={formData.order_type !== 'online'}
                onChange={(e) => {
                  if (e.target.files[0]) {
                    updateFormData('order_document', e.target.files[0]);
                  }
                }}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
              {formData.order_type !== 'online' && (
                <p className="mt-1 text-xs text-gray-500">Upload nur für Online-Bestellungen möglich. Deaktivieren Sie die Checkbox "Online-Bestellung", um ein generiertes PDF zu verwenden.</p>
              )}
              <p className="mt-1 text-xs text-gray-500">PDF, DOC, DOCX (max. 10MB)</p>
            </div>

            {/* Bestelldatum */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bestelldatum
              </label>
              <input
                type="date"
                value={formData.order_date}
                onChange={(e) => updateFormData('order_date', e.target.value)}
                className="w-full md:w-64 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Wenn Bestelldatum gesetzt wird, ändert sich der Status auf "bestellt"
              </p>
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <button
                type="button"
                onClick={() => changeTab(2)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                ← Zurück zu Konditionen
              </button>
              <button
                type="button"
                onClick={async () => {
                  // Automatisch Status auf 'bestellt' setzen wenn Bestelldatum vorhanden
                  if (formData.order_date && formData.status === 'angelegt') {
                    setFormData(prev => ({ ...prev, status: 'bestellt' }));
                  }
                  await handleSave();
                }}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
              >
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                {'Speichern und PDF generieren'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Auftragsbestätigung mit Controlling */}
        {activeTab === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Auftragsbestätigung</h2>

            {formData.status !== 'bestellt' && formData.status !== 'bestaetigt' && formData.status !== 'geliefert' && formData.status !== 'bezahlt' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ Dieser Tab ist erst verfügbar, wenn die Bestellung den Status "bestellt" hat.
                </p>
              </div>
            )}

            {(formData.status === 'bestellt' || formData.status === 'bestaetigt' || formData.status === 'geliefert' || formData.status === 'bezahlt') && (
              <> 
                {/* Bestellpositionen mit bearbeitbaren Preisen */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Bestätigte Positionen</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Hier können Sie die tatsächlichen Preise aus der Auftragsbestätigung des Lieferanten erfassen.
                  </p>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Beschreibung</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Menge</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bestellpreis</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Best. Preis</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Controlling</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {formData.items.map((item, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                              {item.position}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {item.description}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                              {parseFloat(item.final_price || 0).toFixed(2)} €
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={item.confirmed_price || item.final_price || 0}
                                onChange={(e) => updateItem(index, 'confirmed_price', e.target.value)}
                                className="w-28 text-sm border border-gray-300 rounded px-2 py-1"
                                min="0"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={item.controlling_checked || false}
                                onChange={(e) => updateItem(index, 'controlling_checked', e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                disabled={isConfirmed}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Berechneter bestätigter Gesamtpreis (live) */}
                  <div className="mt-4 text-right">
                    <div className="text-sm text-gray-500">Neuer bestätigter Bestellpreis (live):</div>
                    <div className="text-lg font-bold">€ {formData.items.reduce((acc, it) => acc + ((parseFloat(it.confirmed_price || it.final_price) || 0) * (parseFloat(it.quantity) || 0)), 0).toFixed(2)}</div>
                  </div>
                </div>

                {/* Bestätigungsdatum */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Datum der Auftragsbestätigung
                  </label>
                  <input
                    type="date"
                    value={formData.confirmation_date}
                    onChange={(e) => updateFormData('confirmation_date', e.target.value)}
                    className="w-full md:w-64 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Wenn Bestätigungsdatum gesetzt wird und alle Controlling-Checkboxen gesetzt sind, ändert sich der Status auf "bestätigt"
                  </p>
                </div>

                {/* Supplier AB Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Auftragsbestätigung (Lieferant) hochladen</label>

                  {formData.supplier_confirmation_document && typeof formData.supplier_confirmation_document === 'string' && (
                    <div className="mb-2 flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <span className="text-sm text-blue-800">📄 {formData.supplier_confirmation_document.split('/').pop()}</span>
                      <a
                        href={formData.supplier_confirmation_document.startsWith('http') ? formData.supplier_confirmation_document : `http://localhost:8000${formData.supplier_confirmation_document}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Öffnen
                      </a>
                    </div>
                  )}

                  {formData.supplier_confirmation_document && typeof formData.supplier_confirmation_document !== 'string' && (
                    <div className="mb-2 flex items-center p-3 bg-green-50 border border-green-200 rounded-md">
                      <span className="text-sm text-green-800">📄 {formData.supplier_confirmation_document.name} (neu hochgeladen)</span>
                    </div>
                  )}

                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        updateFormData('supplier_confirmation_document', e.target.files[0]);
                      }
                    }}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                {/* Voraussichtliches Lieferdatum */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Voraussichtliches Lieferdatum</label>
                  <input
                    type="date"
                    value={formData.expected_delivery_date || ''}
                    onChange={(e) => updateFormData('expected_delivery_date', e.target.value)}
                    className="w-full md:w-64 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Navigation */}
                <div className="flex justify-between pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => changeTab(3)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    ← Zurück zur Bestellung
                  </button>
                  <div className="flex flex-col items-end">
                    <button
                      type="button"
                      onClick={async () => {
                        // Automatisch Status auf 'bestätigt' setzen wenn Bestätigungsdatum vorhanden
                        // Only set status to 'bestaetigt' when confirmation_date present AND all controlling checkboxes are checked
                        const allChecked = formData.items.every(i => i.controlling_checked);
                        if (formData.confirmation_date && allChecked && (formData.status === 'bestellt' || formData.status === 'angelegt')) {
                          setFormData(prev => ({ ...prev, status: 'bestaetigt' }));
                        } else if (formData.confirmation_date && !allChecked) {
                          alert('Alle Controlling-Checkboxen müssen gesetzt sein, bevor die Bestellung als bestätigt markiert werden kann.');
                          return; // Abort save when confirmation date is present but not all controlling checks are set
                        }

                        await handleSave();
                      }}
                      disabled={loading || confirmationBlocksSave}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                    >
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Speichern
                    </button>
                    {confirmationBlocksSave && (
                      <p className="text-sm text-red-600 mt-2">Bestätigungsdatum ist gesetzt, aber nicht alle Controlling-Checkboxen sind markiert.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 6: Lieferung mit Wareneingang */}
        {activeTab === 5 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Lieferung & Wareneingang</h2>

            {formData.status !== 'bestaetigt' && formData.status !== 'geliefert' && formData.status !== 'bezahlt' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ Dieser Tab ist erst verfügbar, wenn die Bestellung den Status "bestätigt" hat.
                </p>
              </div>
            )}

            {(formData.status === 'bestaetigt' || formData.status === 'geliefert' || formData.status === 'bezahlt') && (
              <> 
                {/* Lieferdatum */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lieferdatum
                  </label>
                  <input
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e) => updateFormData('delivery_date', e.target.value)}
                    className="w-full md:w-64 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Wenn Lieferdatum gesetzt wird, ändert sich der Status auf "geliefert"
                  </p>
                </div>

                {/* Lieferinformationen */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-md font-medium text-gray-900 mb-3">Lieferinformationen</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Lieferbedingung:</span>
                      <span className="ml-2 font-medium">
                        {deliveryTerms.find(t => t.id === formData.delivery_term)?.incoterm || 'Nicht festgelegt'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Lieferanweisung:</span>
                      <span className="ml-2 font-medium">
                        {deliveryInstructions.find(i => i.id === formData.delivery_instruction)?.name || 'Nicht festgelegt'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Wareneingang Button */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-md font-medium text-gray-900 mb-2">Wareneingang</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Übertragen Sie die Bestellpositionen in den Wareneingang zur weiteren Verarbeitung im Lager.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!formData.items || formData.items.length === 0) {
                        alert('Keine Positionen zum Übertragen vorhanden.');
                        return;
                      }
                      
                      if (window.confirm(`Möchten Sie alle ${formData.items.length} Position(en) in den Wareneingang übertragen?`)) {
                        try {
                          const itemIds = formData.items.map(item => item.id);
                          const res = await api.post(`/orders/orders/${id}/transfer_to_incoming_goods/`, {
                            item_ids: itemIds
                          });
                          alert(res.data.message);
                          if (res.data.errors && res.data.errors.length > 0) {
                            alert('Einige Fehler sind aufgetreten:\n' + res.data.errors.join('\n'));
                          }
                          // Navigiere zum Wareneingang
                          if (window.confirm('Möchten Sie zum Wareneingang navigieren?')) {
                            navigate('/inventory/warehouse');
                          }
                        } catch (error) {
                          console.error('Error transferring to incoming goods:', error);
                          alert('Fehler beim Übertragen: ' + (error.response?.data?.error || error.message));
                        }
                      }
                    }}
                    disabled={!formData.items || formData.items.length === 0}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <InboxArrowDownIcon className="h-5 w-5 mr-2" />
                    Wareneingang erfassen
                  </button>
                </div>

                {/* Navigation */}
                <div className="flex justify-between pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => changeTab(4)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    ← Zurück zur Auftragsbestätigung
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      // Automatisch Status auf 'geliefert' setzen wenn Lieferdatum vorhanden
                      if (formData.delivery_date && formData.status === 'bestaetigt') {
                        setFormData(prev => ({ ...prev, status: 'geliefert' }));
                      }
                      await handleSave();
                    }}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                  >
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    Speichern
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 7: Bezahlung */}
        {activeTab === 6 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Bezahlung</h2>

            {formData.status !== 'geliefert' && formData.status !== 'bezahlt' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ Dieser Tab ist erst verfügbar, wenn die Bestellung den Status "geliefert" hat.
                </p>
              </div>
            )}

            {(formData.status === 'geliefert' || formData.status === 'bezahlt') && (
              <>
                {/* Zahlungsinformationen */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-md font-medium text-gray-900 mb-3">Zahlungsinformationen</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Gesamtbetrag:</span>
                      <span className="ml-2 font-medium text-lg">{calculateTotal().toFixed(2)} €</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Zahlungsbedingung:</span>
                      <span className="ml-2 font-medium">
                        {paymentTerms.find(t => t.id === formData.payment_term)?.name || 'Nicht festgelegt'}
                      </span>
                    </div>
                    {formData.order_date && (
                      <div>
                        <span className="text-gray-600">Bestelldatum:</span>
                        <span className="ml-2 font-medium">{formData.order_date}</span>
                      </div>
                    )}
                    {formData.delivery_date && (
                      <div>
                        <span className="text-gray-600">Lieferdatum:</span>
                        <span className="ml-2 font-medium">{formData.delivery_date}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Zahlungsdatum */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zahlungsdatum
                  </label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => updateFormData('payment_date', e.target.value)}
                    className="w-full md:w-64 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Wenn Zahlungsdatum gesetzt wird, ändert sich der Status auf "bezahlt"
                  </p>
                </div>

                {/* Notizen zur Zahlung */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notizen zur Zahlung
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => updateFormData('notes', e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Rechnungsnummer, Zahlungsweise, besondere Hinweise..."
                  />
                </div>

                {formData.status === 'bezahlt' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <CheckCircleIcon className="h-6 w-6 text-green-600 mr-2" />
                      <div>
                        <h3 className="text-md font-medium text-green-900">Bestellung abgeschlossen</h3>
                        <p className="text-sm text-green-700">Diese Bestellung wurde vollständig bezahlt.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => changeTab(5)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    ← Zurück zur Lieferung
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      // Automatisch Status auf 'bezahlt' setzen wenn Zahlungsdatum vorhanden
                      if (formData.payment_date && formData.status === 'geliefert') {
                        setFormData(prev => ({ ...prev, status: 'bezahlt' }));
                      }
                      await handleSave();
                    }}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                  >
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    Speichern
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderFormNew;
