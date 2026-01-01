import React, { useState, useEffect, useRef } from 'react';
/* eslint-disable react-hooks/exhaustive-deps */
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeftIcon, PlusIcon, TrashIcon, DocumentArrowDownIcon, DocumentIcon, ChevronDownIcon, ChevronUpIcon, ArrowUpIcon, ArrowDownIcon, UserIcon, ClipboardDocumentListIcon, CogIcon, DocumentTextIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';

const QuotationForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerAddresses, setCustomerAddresses] = useState([]);
  const [tradingProducts, setTradingProducts] = useState([]);
  const [visiviewProducts, setVisiviewProducts] = useState([]);
  const [vsHardwareProducts, setVsHardwareProducts] = useState([]);
  const [vsServiceProducts, setVsServiceProducts] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [deliveryTerms, setDeliveryTerms] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [systems, setSystems] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [activeTab, setActiveTab] = useState(1);
  
  // Customer search
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const lastLoadedCustomerRef = useRef(null);
  
  // Product filter for item selection
  const [productFilter, setProductFilter] = useState('');
  
  // Tab configuration
  const tabs = [
    { id: 1, name: 'Basisinfos', icon: UserIcon },
    { id: 2, name: 'Positionen', icon: ClipboardDocumentListIcon },
    { id: 3, name: 'Konditionen', icon: CogIcon },
    { id: 4, name: 'PDF erstellen', icon: DocumentTextIcon },
    { id: 5, name: 'Auftrag', icon: ShoppingCartIcon }
  ];
  
  const [formData, setFormData] = useState({
    customer: '',
    created_by: '',
    commission_user: '',
    project_reference: '',
    system_reference: '',
    reference: '',
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 Tage ab heute
    delivery_time_weeks: 0,
    status: 'DRAFT',
    language: 'DE',
    payment_term: '',
    delivery_term: '',
    show_terms_conditions: true,
    show_group_item_prices: false,
    tax_enabled: true,
    tax_rate: 19,
    system_price: '',
    delivery_cost: 0,
    recipient_company: '',
    recipient_name: '',
    recipient_street: '',
    recipient_postal_code: '',
    recipient_city: '',
    recipient_country: 'DE',
    notes: '',
    description_text: '',
    footer_text: '',
    pdf_file_url: '',
    quotation_date: new Date().toISOString().split('T')[0],
    items: []
  });
  
  // Track if form has unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Wrapper function to update formData and mark as having unsaved changes
  const updateFormData = (updater) => {
    setFormData(updater);
    setHasUnsavedChanges(true);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchInitialData();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (id) {
      fetchQuotation();
    }
  }, [id]);
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (formData.customer && formData.customer !== lastLoadedCustomerRef.current) {
      lastLoadedCustomerRef.current = formData.customer;
      loadCustomerDetails(formData.customer);
    }
  }, [formData.customer]);

  const updatePositionNumbers = (items) => {
    let mainPosition = 0;
    const positionMap = new Map(); // Speichert die Hauptposition für jede group_id
    
    // Erster Durchlauf: Hauptpositionen zuweisen und in Map speichern
    const itemsWithMainPositions = items.map((item) => {
      if (item.is_group_header || !item.group_id) {
        mainPosition++;
        if (item.is_group_header) {
          positionMap.set(item.group_id, mainPosition);
        }
        return {
          ...item,
          position: mainPosition,
          display_position: String(mainPosition)
        };
      }
      return item;
    });
    
    // Zweiter Durchlauf: Unterpositionen für Gruppenmitglieder
    return itemsWithMainPositions.map((item) => {
      if (!item.is_group_header && item.group_id) {
        const headerPosition = positionMap.get(item.group_id);
        if (headerPosition) {
          // Zähle wie viele Gruppenmitglieder vor diesem Item kommen
          const itemIndex = itemsWithMainPositions.indexOf(item);
          const groupMembers = itemsWithMainPositions.filter((i, idx) => 
            idx < itemIndex && 
            i.group_id === item.group_id && 
            !i.is_group_header
          );
          const subPosition = groupMembers.length + 1;
          
          return {
            ...item,
            position: headerPosition,
            display_position: `${headerPosition}.${String(subPosition).padStart(2, '0')}`
          };
        }
      }
      return item;
    });
  };

  const handleMoveItem = (index, direction) => {
    const newItems = [...formData.items];
    const item = newItems[index];
    
    if (direction === 'up' && index > 0) {
      // Wenn es ein Gruppenmitglied ist, nur innerhalb der Gruppe verschieben
      if (!item.is_group_header && item.group_id) {
        const prevItem = newItems[index - 1];
        if (prevItem.group_id === item.group_id && !prevItem.is_group_header) {
          [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
        }
      } else {
        // Hauptposition oder Gruppe verschieben (mit allen Mitgliedern)
        if (item.is_group_header) {
          const groupItems = newItems.filter(i => i.group_id === item.group_id);
          const groupEnd = index + groupItems.length;
          const groupBlock = newItems.splice(index, groupEnd - index);
          newItems.splice(index - 1, 0, ...groupBlock);
        } else {
          [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
        }
      }
    } else if (direction === 'down' && index < newItems.length - 1) {
      // Wenn es ein Gruppenmitglied ist, nur innerhalb der Gruppe verschieben
      if (!item.is_group_header && item.group_id) {
        const nextItem = newItems[index + 1];
        if (nextItem.group_id === item.group_id && !nextItem.is_group_header) {
          [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
        }
      } else {
        // Hauptposition oder Gruppe verschieben (mit allen Mitgliedern)
        if (item.is_group_header) {
          const groupItems = newItems.filter(i => i.group_id === item.group_id);
          const groupEnd = index + groupItems.length;
          const groupBlock = newItems.splice(index, groupEnd - index);
          newItems.splice(index + 1, 0, ...groupBlock);
        } else {
          [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
        }
      }
    }
    
    setFormData(prev => ({
      ...prev,
      items: updatePositionNumbers(newItems)
    }));
  };

  const toggleGroupCollapse = (groupId) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const fetchInitialData = async () => {
    try {
      const [tradingRes, visiviewRes, vsHardwareRes, vsServiceRes, paymentRes, deliveryTermsRes, usersRes, projectsRes, systemsRes, currentUserRes] = await Promise.all([
        api.get('/suppliers/products/'),
        api.get('/visiview/products/?is_active=true'),
        api.get('/manufacturing/vs-hardware/?is_active=true'),
        api.get('/service/vs-service/?is_active=true'),
        api.get('/settings/payment-terms/'),
        api.get('/settings/delivery-terms/'),
        api.get('/users/'),
        api.get('/projects/projects/?is_active=true'),
        api.get('/systems/systems/?is_active=true'),
        api.get('/users/me/')
      ]);
      
      setTradingProducts(tradingRes.data.results || tradingRes.data || []);
      setVisiviewProducts(visiviewRes.data.results || visiviewRes.data || []);
      setVsHardwareProducts(vsHardwareRes.data.results || vsHardwareRes.data || []);
      setVsServiceProducts(vsServiceRes.data.results || vsServiceRes.data || []);
      setPaymentTerms(paymentRes.data.results || paymentRes.data || []);
      setDeliveryTerms(deliveryTermsRes.data.results || deliveryTermsRes.data || []);
      setUsers(usersRes.data.results || usersRes.data || []);
      setProjects(projectsRes.data.results || projectsRes.data || []);
      setSystems(systemsRes.data.results || systemsRes.data || []);
      
      const user = currentUserRes.data;
      // Set default user for new quotations
      if (!isEditMode) {
        setFormData(prev => ({
          ...prev,
          created_by: user.id,
          commission_user: user.id
        }));
      }
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      alert('Fehler beim Laden der Daten');
    }
  };
  
  // Customer search function
  const searchCustomers = async () => {
    if (!customerSearchTerm.trim()) {
      setCustomerSearchResults([]);
      return;
    }
    try {
      const response = await api.get(`/customers/customers/?search=${encodeURIComponent(customerSearchTerm)}&is_active=true`);
      setCustomerSearchResults(response.data.results || response.data || []);
    } catch (error) {
      console.error('Fehler bei Kundensuche:', error);
    }
  };
  
  // Select customer from search results
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customer: customer.id }));
    setCustomerSearchResults([]);
    setCustomerSearchTerm('');
  };

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/sales/quotations/${id}/`);
      const quotation = response.data;
      
      // Items müssen die neuen Felder enthalten
      const mappedItems = (quotation.items || []).map(item => {
        // Bestimme object_id Format für das Frontend
        let frontendObjectId = null;
        if (item.object_id && item.content_type_data) {
          if (item.content_type_data.model === 'tradingproduct') {
            frontendObjectId = `tp-${item.object_id}`;
          } else if (item.content_type_data.model === 'visiviewproduct') {
            frontendObjectId = `vv-${item.object_id}`;
          } else if (item.content_type_data.model === 'vshardware') {
            frontendObjectId = `vs-${item.object_id}`;
          } else if (item.content_type_data.model === 'vsservice') {
            frontendObjectId = `vss-${item.object_id}`;
          }
        }
        
        return {
          id: item.id,
          content_type: item.content_type_data || item.content_type,
          object_id: frontendObjectId,
          actual_object_id: item.object_id,
          group_id: item.group_id || null,
          group_name: item.group_name || '',
          is_group_header: item.is_group_header || false,
          position: item.position,
          description_type: item.description_type,
          uses_system_price: item.uses_system_price || false,
          quantity: item.quantity,
          unit_price: item.unit_price,
          purchase_price: item.purchase_price || 0,
          sale_price: item.sale_price || null,
          discount_percent: item.discount_percent,
          tax_rate: item.tax_rate,
          notes: item.notes || '',
          custom_description: item.custom_description || ''
        };
      });
      

      
      // Update position numbers after loading items
      const itemsWithPositions = updatePositionNumbers(mappedItems);
      

      
      setFormData({
        quotation_number: quotation.quotation_number || '',
        customer: quotation.customer || '',
        created_by: quotation.created_by || '',
        commission_user: quotation.commission_user || '',
        project_reference: quotation.project_reference || '',
        system_reference: quotation.system_reference || '',
        reference: quotation.reference || '',
        valid_until: quotation.valid_until || '',
        delivery_time_weeks: quotation.delivery_time_weeks || 0,
        status: quotation.status || 'DRAFT',
        language: quotation.language || 'DE',
        payment_term: quotation.payment_term || '',
        delivery_term: quotation.delivery_term || '',
        show_terms_conditions: quotation.show_terms_conditions !== false,
        show_group_item_prices: quotation.show_group_item_prices || false,
        tax_enabled: quotation.tax_enabled !== false,
        tax_rate: quotation.tax_rate || 19,
        system_price: quotation.system_price || '',
        delivery_cost: quotation.delivery_cost || 0,
        recipient_company: quotation.recipient_company || '',
        recipient_name: quotation.recipient_name || '',
        recipient_street: quotation.recipient_street || '',
        recipient_postal_code: quotation.recipient_postal_code || '',
        recipient_city: quotation.recipient_city || '',
        recipient_country: quotation.recipient_country || 'DE',
        description_text: quotation.description_text || '',
        footer_text: quotation.footer_text || '',
        pdf_file_url: quotation.pdf_file_url || '',
        quotation_date: quotation.date || new Date().toISOString().split('T')[0],
        notes: quotation.notes || '',
        items: itemsWithPositions
      });
      
      // Load selected customer for display
      if (quotation.customer) {
        try {
          const customerRes = await api.get(`/customers/customers/${quotation.customer}/`);
          setSelectedCustomer(customerRes.data);
        } catch (err) {
          console.warn('Kunde konnte nicht geladen werden:', err);
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden des Angebots:', error);
      alert('Fehler beim Laden des Angebots');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerDetails = async (customerId) => {
    if (!customerId) {
      setCustomerAddresses([]);
      return;
    }

    try {
      const response = await api.get(`/customers/customers/${customerId}/`);
      const customer = response.data;
setCustomerAddresses(customer.addresses || []);
      
      // Setze Kundensprache als Standard
      if (customer.language && !isEditMode) {
        setFormData(prev => ({ ...prev, language: customer.language }));
      }
      
      // Übernehme Kundennamen standardmäßig als Empfängername
      if (!isEditMode) {
        const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.company || '';
        setFormData(prev => ({
          ...prev,
          recipient_name: customerName,
          recipient_company: customer.company || ''
        }));
      }
    } catch (error) {
      console.error('Fehler beim Laden der Kundendetails:', error);
    }
  };

  const handleCustomerAddressSelect = (addressId) => {
    const address = customerAddresses.find(a => a.id === parseInt(addressId));
    if (address) {
      // Include the selected customer's display name as well as the address name
      const customerDisplay = selectedCustomer ? (`${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim() || selectedCustomer.company || '') : '';
      const addressName = `${address.title || ''} ${address.first_name || ''} ${address.last_name || ''}`.trim();
      const combinedName = [customerDisplay, addressName].filter(Boolean).join(' - ');

      updateFormData(prev => ({
        ...prev,
        recipient_company: address.institute || (selectedCustomer ? selectedCustomer.company || '' : ''),
        recipient_name: combinedName || (selectedCustomer ? (selectedCustomer.company || '') : ''),
        recipient_street: `${address.street || ''} ${address.house_number || ''}`.trim(),
        recipient_postal_code: address.postal_code || '',
        recipient_city: address.city || '',
        recipient_country: address.country || 'DE'
      }));
    }
  };

  const handleAddItem = () => {
    setFormData(prev => {
      const newItems = [...prev.items, {
        content_type: '',
        object_id: '',
        position: prev.items.length + 1,
        description_type: 'SHORT',
        uses_system_price: false,
        quantity: 1,
        unit_price: 0,
        purchase_price: 0,
        sale_price: null,
        discount_percent: 0,
        tax_rate: prev.tax_rate || 19,
        notes: '',
        custom_description: '',
        group_id: null,
        group_name: '',
        is_group_header: false
      }];
      return {
        ...prev,
        items: updatePositionNumbers(newItems)
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleAddItemGroup = () => {
    const groupId = `group_${Date.now()}`;
    setFormData(prev => {
      const newItems = [...prev.items, {
        content_type: null,
        object_id: null,
        position: prev.items.length + 1,
        description_type: 'SHORT',
        uses_system_price: false,
        quantity: 1,
        unit_price: 0,
        purchase_price: 0,
        sale_price: 0,
        discount_percent: 0,
        tax_rate: prev.tax_rate || 19,
        notes: '',
        custom_description: '',
        group_id: groupId,
        group_name: 'Neue Warensammlung',
        is_group_header: true
      }];
      return {
        ...prev,
        items: updatePositionNumbers(newItems)
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleAddItemToGroup = (groupId) => {
    setFormData(prev => {
      const newItems = [...prev.items, {
        content_type: '',
        object_id: '',
        position: prev.items.length + 1,
        description_type: 'SHORT',
        uses_system_price: false,
        quantity: 1,
        unit_price: 0,
        purchase_price: 0,
        sale_price: null,
        discount_percent: 0,
        tax_rate: prev.tax_rate || 19,
        notes: '',
        custom_description: '',
        group_id: groupId,
        group_name: '',
        is_group_header: false
      }];
      return {
        ...prev,
        items: updatePositionNumbers(newItems)
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => {
      const updatedItems = prev.items.filter((_, i) => i !== index);
      return {
        ...prev,
        items: updatePositionNumbers(updatedItems)
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const updatedItems = prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          
          // Wenn Produkt gewechselt wird, lade Preise und Beschreibung automatisch
          if (field === 'object_id' && value) {
            // Parse the value - format: "tp-123" or "vv-456"
            const [productType, productId] = value.split('-');
            const numericId = parseInt(productId);
            
            if (productType === 'tp') {
              const selectedProduct = tradingProducts.find(p => p.id === numericId);
              if (selectedProduct) {
                updatedItem.unit_price = selectedProduct.visitron_list_price || 0;
                updatedItem.purchase_price = selectedProduct.purchase_price_eur || selectedProduct.purchase_price || 0;
                updatedItem.content_type = { app_label: 'suppliers', model: 'tradingproduct' };
                updatedItem.actual_object_id = numericId;
                
                // Lade Beschreibung basierend auf Sprache und Beschreibungstyp
                const isEnglish = prev.language === 'EN';
                const isShort = updatedItem.description_type === 'SHORT';
                if (isShort) {
                  updatedItem.custom_description = isEnglish 
                    ? (selectedProduct.short_description_en || selectedProduct.short_description || '')
                    : (selectedProduct.short_description || '');
                } else {
                  updatedItem.custom_description = isEnglish 
                    ? (selectedProduct.description_en || selectedProduct.description || '')
                    : (selectedProduct.description || '');
                }
              }
            } else if (productType === 'vv') {
              const selectedProduct = visiviewProducts.find(p => p.id === numericId);
              if (selectedProduct) {
                updatedItem.unit_price = selectedProduct.current_list_price || 0;
                updatedItem.purchase_price = selectedProduct.current_purchase_price || 0;
                updatedItem.content_type = { app_label: 'visiview', model: 'visiviewproduct' };
                updatedItem.actual_object_id = numericId;
                
                // Lade Beschreibung basierend auf Sprache
                const isEnglish = prev.language === 'EN';
                updatedItem.custom_description = isEnglish 
                  ? (selectedProduct.description_en || selectedProduct.description || '')
                  : (selectedProduct.description || '');
              }
            } else if (productType === 'vs') {
              // VS-Hardware
              const selectedProduct = vsHardwareProducts.find(p => p.id === numericId);
              if (selectedProduct) {
                updatedItem.unit_price = selectedProduct.current_sales_price || 0;
                updatedItem.purchase_price = selectedProduct.current_purchase_price || 0;
                updatedItem.content_type = { app_label: 'manufacturing', model: 'vshardware' };
                updatedItem.actual_object_id = numericId;
                
                // Lade Beschreibung basierend auf Sprache
                const isEnglish = prev.language === 'EN';
                updatedItem.custom_description = isEnglish 
                  ? (selectedProduct.description_en || selectedProduct.description || '')
                  : (selectedProduct.description || '');
              }
            } else if (productType === 'vss') {
              // VS-Service Produkte
              const selectedProduct = vsServiceProducts.find(p => p.id === numericId);
              if (selectedProduct) {
                updatedItem.unit_price = selectedProduct.current_list_price || selectedProduct.current_sales_price || 0;
                updatedItem.purchase_price = selectedProduct.current_purchase_price || 0;
                updatedItem.content_type = { app_label: 'service', model: 'vsservice' };
                updatedItem.actual_object_id = numericId;
                
                // Lade Beschreibung basierend auf Sprache und Beschreibungstyp
                const isEnglish = prev.language === 'EN';
                const isShort = updatedItem.description_type === 'SHORT';
                if (isShort) {
                  updatedItem.custom_description = isEnglish 
                    ? (selectedProduct.short_description_en || selectedProduct.short_description || '')
                    : (selectedProduct.short_description || '');
                } else {
                  updatedItem.custom_description = isEnglish 
                    ? (selectedProduct.description_en || selectedProduct.description || '')
                    : (selectedProduct.description || '');
                }
              }
            }
          }
          
          // Wenn Beschreibungstyp gewechselt wird, lade entsprechende Beschreibung
          if (field === 'description_type' && item.object_id) {
            const [productType, productId] = item.object_id.split('-');
            const numericId = parseInt(productId);
            const isEnglish = prev.language === 'EN';
            const isShort = value === 'SHORT';
            
            if (productType === 'tp') {
              const selectedProduct = tradingProducts.find(p => p.id === numericId);
              if (selectedProduct) {
                if (isShort) {
                  updatedItem.custom_description = isEnglish 
                    ? (selectedProduct.short_description_en || selectedProduct.short_description || '')
                    : (selectedProduct.short_description || '');
                } else {
                  updatedItem.custom_description = isEnglish 
                    ? (selectedProduct.description_en || selectedProduct.description || '')
                    : (selectedProduct.description || '');
                }
              }
            } else if (productType === 'vv') {
              const selectedProduct = visiviewProducts.find(p => p.id === numericId);
              if (selectedProduct) {
                updatedItem.custom_description = isEnglish 
                  ? (selectedProduct.description_en || selectedProduct.description || '')
                  : (selectedProduct.description || '');
              }
            } else if (productType === 'vs') {
              // VS-Hardware - hat keine Kurzbeschreibung, nur description
              const selectedProduct = vsHardwareProducts.find(p => p.id === numericId);
              if (selectedProduct) {
                updatedItem.custom_description = isEnglish 
                  ? (selectedProduct.description_en || selectedProduct.description || '')
                  : (selectedProduct.description || '');
              }
            } else if (productType === 'vss') {
              // VS-Service - hat short/long description
              const selectedProduct = vsServiceProducts.find(p => p.id === numericId);
              if (selectedProduct) {
                if (isShort) {
                  updatedItem.custom_description = isEnglish 
                    ? (selectedProduct.short_description_en || selectedProduct.short_description || '')
                    : (selectedProduct.short_description || '');
                } else {
                  updatedItem.custom_description = isEnglish 
                    ? (selectedProduct.description_en || selectedProduct.description || '')
                    : (selectedProduct.description || '');
                }
              }
            }
          }
          
          return updatedItem;
        }
        return item;
      });

      // Auto-update sale_price für Gruppen-Header wenn sich Mitglieder ändern
      const groupHeaders = updatedItems.filter(item => item.is_group_header);
      groupHeaders.forEach(header => {
        const headerIndex = updatedItems.findIndex(item => item === header);
        if (headerIndex !== -1) {
          const groupMembers = updatedItems.filter(item => item.group_id === header.group_id && !item.is_group_header);
          
          // Summiere Listenpreise (VK-Preise)
          const listPriceSum = groupMembers.reduce((sum, item) => {
            const quantity = parseFloat(item.quantity) || 0;
            const unitPrice = parseFloat(item.unit_price) || 0;
            const discount = parseFloat(item.discount_percent) || 0;
            const priceAfterDiscount = unitPrice * (1 - discount / 100);
            return sum + (quantity * priceAfterDiscount);
          }, 0);
          
          // Summiere Einkaufspreise
          const purchasePriceSum = groupMembers.reduce((sum, item) => {
            const quantity = parseFloat(item.quantity) || 0;
            const purchasePrice = parseFloat(item.purchase_price) || 0;
            return sum + (quantity * purchasePrice);
          }, 0);
          
          // Aktualisiere sale_price (VK-Summe) im Header
          updatedItems[headerIndex].sale_price = listPriceSum;
          // Speichere auch die EK-Summe zur Marge-Berechnung
          updatedItems[headerIndex].purchase_price = purchasePriceSum;
        }
      });

      // If system price is used, recalculate unit_price proportionally for all system price items
      const systemPrice = parseFloat(prev.system_price) || 0;
      const hasSystemPriceItems = updatedItems.some(item => item.uses_system_price);
      
      if (systemPrice > 0 && hasSystemPriceItems) {
        // Calculate total purchase cost of all system price items
        const totalPurchaseCost = updatedItems.reduce((sum, item) => {
          if (item.uses_system_price) {
            const quantity = parseFloat(item.quantity) || 0;
            const purchasePrice = parseFloat(item.purchase_price) || 0;
            return sum + (quantity * purchasePrice);
          }
          return sum;
        }, 0);
        
        // Distribute system price proportionally based on purchase cost
        if (totalPurchaseCost > 0) {
          updatedItems.forEach(item => {
            if (item.uses_system_price) {
              const quantity = parseFloat(item.quantity) || 1;
              const purchasePrice = parseFloat(item.purchase_price) || 0;
              const itemPurchaseCost = quantity * purchasePrice;
              const proportion = itemPurchaseCost / totalPurchaseCost;
              const allocatedSystemPrice = systemPrice * proportion;
              
              // Calculate unit price from allocated system price and round to 2 decimals
              const rawUnitPrice = quantity > 0 ? allocatedSystemPrice / quantity : 0;
              // Round to 2 decimal places
              item.unit_price = Number(rawUnitPrice.toFixed(2));
            }
          });
        }
      }

      return {
        ...prev,
        items: updatedItems
      };
    });
    setHasUnsavedChanges(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Warnung wenn Angebot bereits verschickt wurde
    if (isEditMode && formData.status === 'SENT') {
      const confirmed = window.confirm(
        'Achtung: Dieses Angebot wurde bereits verschickt.\n\n' +
        'Möchten Sie die Änderungen trotzdem speichern?\n' +
        'Das PDF muss danach erneut erstellt werden.'
      );
      if (!confirmed) {
        return;
      }
    }
    
    // Prüfe auf leere Positionen (ohne Produkt und kein Gruppen-Header)
    const emptyPositions = formData.items.filter(item => 
      !item.is_group_header && !item.object_id
    );
    
    if (emptyPositions.length > 0) {
      const positionNumbers = emptyPositions.map(item => item.display_position || item.position).join(', ');
      alert(`Das Angebot kann nicht erstellt werden.\n\nFolgende Positionen haben kein Produkt ausgewählt:\nPosition(en): ${positionNumbers}\n\nBitte wählen Sie für alle Positionen ein Produkt aus oder entfernen Sie die leeren Positionen.`);
      return;
    }
    
    setLoading(true);

    try {
      const submitData = new FormData();
      
      // Basis-Felder
      submitData.append('customer', formData.customer);
      if (formData.created_by) submitData.append('created_by', formData.created_by);
      if (formData.commission_user) submitData.append('commission_user', formData.commission_user);
      submitData.append('project_reference', formData.project_reference);
      submitData.append('system_reference', formData.system_reference);
      submitData.append('reference', formData.reference);
      if (formData.quotation_date) submitData.append('date', formData.quotation_date);
      submitData.append('valid_until', formData.valid_until);
      submitData.append('delivery_time_weeks', formData.delivery_time_weeks);
      submitData.append('status', formData.status);
      submitData.append('language', formData.language);
      submitData.append('show_terms_conditions', formData.show_terms_conditions);
      submitData.append('show_group_item_prices', formData.show_group_item_prices);
      submitData.append('tax_enabled', formData.tax_enabled);
      submitData.append('tax_rate', formData.tax_rate);
      if (formData.system_price) submitData.append('system_price', formData.system_price);
      submitData.append('delivery_cost', formData.delivery_cost || 0);
      
      // Optionale Felder
      if (formData.payment_term) submitData.append('payment_term', formData.payment_term);
      if (formData.delivery_term) submitData.append('delivery_term', formData.delivery_term);
      
      // Empfängeradresse
      submitData.append('recipient_company', formData.recipient_company);
      submitData.append('recipient_name', formData.recipient_name);
      submitData.append('recipient_street', formData.recipient_street);
      submitData.append('recipient_postal_code', formData.recipient_postal_code);
      submitData.append('recipient_city', formData.recipient_city);
      submitData.append('recipient_country', formData.recipient_country);
      submitData.append('notes', formData.notes);
      
      // Angebotsbeschreibung und Fußtext
      submitData.append('description_text', formData.description_text || '');
      submitData.append('footer_text', formData.footer_text || '');
      
      // Positionen - als JSON
      const items = formData.items.map(item => {
        // Bestimme content_type basierend auf dem ausgewählten Produkt
        let contentType = item.content_type || null;
        let objectId = item.actual_object_id || null;
        
        // Parse object_id wenn es im neuen Format ist (tp-123 oder vv-456 oder vs-789)
        if (item.object_id && typeof item.object_id === 'string' && item.object_id.includes('-')) {
          const [productType, productId] = item.object_id.split('-');
          objectId = parseInt(productId);
          if (productType === 'tp') {
            contentType = { app_label: 'suppliers', model: 'tradingproduct' };
          } else if (productType === 'vv') {
            contentType = { app_label: 'visiview', model: 'visiviewproduct' };
          } else if (productType === 'vs') {
            contentType = { app_label: 'manufacturing', model: 'vshardware' };
          }
        } else if (item.object_id && !item.is_group_header) {
          // Legacy-Format (nur ID)
          objectId = parseInt(item.object_id);
          if (!contentType) {
            contentType = { app_label: 'suppliers', model: 'tradingproduct' };
          }
        }
        
        return {
          id: item.id || null,
          content_type: contentType,
          object_id: objectId,
          group_id: item.group_id || null,
          group_name: item.group_name || '',
          is_group_header: item.is_group_header || false,
          position: item.position,
          description_type: item.description_type,
          uses_system_price: item.uses_system_price || false,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          purchase_price: parseFloat(item.purchase_price) || 0,
          sale_price: item.sale_price ? parseFloat(item.sale_price) : null,
          discount_percent: parseFloat(item.discount_percent),
          tax_rate: parseFloat(item.tax_rate) || 19,
          notes: item.notes || '',
          custom_description: item.custom_description || ''
        };
      });
      



      
      // Items als JSON-String senden
      const itemsJson = JSON.stringify(items);
      submitData.append('items', itemsJson);


      
      let response;
      if (isEditMode) {

        response = await api.put(`/sales/quotations/${id}/`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {

        response = await api.post('/sales/quotations/', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }


      alert(`Angebot erfolgreich ${isEditMode ? 'aktualisiert' : 'erstellt'}!`);
      setHasUnsavedChanges(false);
      
      // Bei neuem Angebot zur Edit-Seite des erstellten Angebots navigieren
      if (!isEditMode && response.data.id) {
        navigate(`/sales/quotations/${response.data.id}/edit`, { replace: true });
      } else {
        // Aktualisiere das Formular mit den gespeicherten Daten
        await fetchQuotation();
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      console.error('Error details:', error.response?.data);
      alert('Fehler beim Speichern des Angebots: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get(`/sales/quotations/${id}/download_pdf/`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Angebot_${formData.quotation_number || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Fehler beim PDF-Download:', error);
      alert('Fehler beim Herunterladen des PDFs');
    }
  };

  const handleViewPDF = async () => {
    try {
      const response = await api.get(`/sales/quotations/${id}/download_pdf/`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Fehler beim PDF-Anzeigen:', error);
      alert('Fehler beim Anzeigen des PDFs');
    }
  };

  const handleCreateAndSavePDF = async () => {
    try {
      // Generiere PDF und speichere es auf dem Server, dann öffne es
      const response = await api.post(`/sales/quotations/${id}/create_and_save_pdf/`, {}, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Aktualisiere das Angebot um den neuen Status und PDF-Link zu laden
      await fetchQuotation();
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Fehler beim PDF-Erstellen:', error);
      alert('Fehler beim Erstellen des PDFs: ' + (error.response?.data?.error || error.message));
    }
  };

  const calculateItemTotal = (item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const discount = parseFloat(item.discount_percent) || 0;
    const taxRate = parseFloat(item.tax_rate) || 0;
    const systemPrice = parseFloat(formData.system_price) || 0;
    
    // Wenn Position Systempreis verwendet (normale Position oder Gruppe)
    if (item.uses_system_price && systemPrice > 0) {
      const purchaseCost = item.is_group_header 
        ? getGroupPurchaseCost(item.group_id)
        : quantity * (parseFloat(item.purchase_price) || 0);
      
      const tax = systemPrice * (taxRate / 100);
      return {
        subtotal: systemPrice,
        tax: tax,
        total: systemPrice + tax,
        purchaseCost: purchaseCost,
        margin: systemPrice - purchaseCost,
        marginPercent: systemPrice > 0 ? ((systemPrice - purchaseCost) / systemPrice * 100) : 0
      };
    }
    
    // Für Gruppen-Header mit manuellem Verkaufspreis
    if (item.is_group_header && item.sale_price) {
      const salePrice = parseFloat(item.sale_price) || 0;
      const tax = salePrice * (taxRate / 100);
      const purchaseCost = getGroupPurchaseCost(item.group_id);
      return {
        subtotal: salePrice,
        tax: tax,
        total: salePrice + tax,
        purchaseCost: purchaseCost,
        margin: salePrice - purchaseCost,
        marginPercent: salePrice > 0 ? ((salePrice - purchaseCost) / salePrice * 100) : 0
      };
    }
    
    // Normale Positionen
    const priceAfterDiscount = unitPrice * (1 - discount / 100);
    const subtotal = quantity * priceAfterDiscount;
    const tax = subtotal * (taxRate / 100);
    const purchaseCost = quantity * (parseFloat(item.purchase_price) || 0);
    
    return {
      subtotal: subtotal,
      tax: tax,
      total: subtotal + tax,
      purchaseCost: purchaseCost,
      margin: subtotal - purchaseCost,
      marginPercent: subtotal > 0 ? ((subtotal - purchaseCost) / subtotal * 100) : 0
    };
  };

  const getGroupItems = (groupId) => {
    return formData.items.filter(item => item.group_id === groupId);
  };

  const getGroupPurchaseCost = (groupId) => {
    const groupItems = getGroupItems(groupId).filter(item => !item.is_group_header);
    return groupItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const purchasePrice = parseFloat(item.purchase_price) || 0;
      return sum + (quantity * purchasePrice);
    }, 0);
  };

  const getGroupListPriceSum = (groupId) => {
    const groupItems = getGroupItems(groupId).filter(item => !item.is_group_header);
    return groupItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unit_price) || 0;
      const discount = parseFloat(item.discount_percent) || 0;
      const priceAfterDiscount = unitPrice * (1 - discount / 100);
      return sum + (quantity * priceAfterDiscount);
    }, 0);
  };

  const calculateGroupMargin = (groupHeader) => {
    if (!groupHeader.is_group_header) {
      return { absolute: 0, percent: 0, totalCost: 0 };
    }
    
    // Wenn Systempreis verwendet wird
    const systemPrice = parseFloat(formData.system_price) || 0;
    const salePrice = groupHeader.uses_system_price && systemPrice > 0
      ? systemPrice
      : parseFloat(groupHeader.sale_price) || 0;
    
    if (!salePrice) {
      return { absolute: 0, percent: 0, totalCost: 0 };
    }
    
    const totalCost = getGroupPurchaseCost(groupHeader.group_id);
    const margin = salePrice - totalCost;
    const marginPercent = totalCost > 0 ? (margin / totalCost * 100) : 0;
    
    return {
      absolute: margin,
      percent: marginPercent,
      totalCost: totalCost
    };
  };

  const calculateTotals = () => {
    let totalNet = 0;
    let totalTax = 0;
    let totalGross = 0;
    let totalPurchaseCost = 0;
    let systemPriceUsed = false;
    const systemPrice = parseFloat(formData.system_price) || 0;
    
    // Nur Positionen zählen, die im Angebot erscheinen (nicht Gruppen-Mitglieder)
    formData.items.forEach(item => {
      // Gruppen-Header oder Einzelpositionen zählen
      if (item.is_group_header || !item.group_id) {
        // Prüfe ob diese Position Systempreis verwendet
        if (item.uses_system_price && systemPrice > 0) {
          // Systempreis nur einmal hinzufügen
          if (!systemPriceUsed) {
            totalNet += systemPrice;
            systemPriceUsed = true;
          }
          // Einkaufskosten trotzdem zählen
          if (item.is_group_header && item.group_id) {
            totalPurchaseCost += getGroupPurchaseCost(item.group_id);
          } else {
            const quantity = parseFloat(item.quantity) || 0;
            const purchasePrice = parseFloat(item.purchase_price) || 0;
            totalPurchaseCost += quantity * purchasePrice;
          }
        } else {
          // Normale Berechnung für Positionen ohne Systempreis
          const itemTotals = calculateItemTotal(item);
          totalNet += itemTotals.subtotal;
          
          // Einkaufskosten
          if (item.is_group_header && item.group_id) {
            totalPurchaseCost += getGroupPurchaseCost(item.group_id);
          } else {
            totalPurchaseCost += itemTotals.purchaseCost || 0;
          }
        }
      }
    });
    
    // Lieferkosten hinzufügen (vor MwSt)
    const deliveryCost = parseFloat(formData.delivery_cost) || 0;
    const netWithDelivery = totalNet + deliveryCost;
    
    // MwSt berechnen
    if (formData.tax_enabled) {
      totalTax = netWithDelivery * (parseFloat(formData.tax_rate) / 100);
    }
    totalGross = netWithDelivery + totalTax;
    
    const totalMargin = totalNet - totalPurchaseCost;
    const totalMarginPercent = totalNet > 0 ? (totalMargin / totalNet * 100) : 0;
    
    return { 
      totalNet, 
      totalTax, 
      totalGross, 
      totalPurchaseCost,
      totalMargin,
      totalMarginPercent,
      deliveryCost,
      netWithDelivery
    };
  };

  const totals = calculateTotals();

  if (loading && isEditMode) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Lade Angebot...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          to="/sales/quotations"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Zurück zur Übersicht
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? `Angebot ${formData.quotation_number || id} bearbeiten` : 'Neues Angebot'}
        </h1>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className={`
                  -ml-0.5 mr-2 h-5 w-5
                  ${activeTab === tab.id ? 'text-green-500' : 'text-gray-400 group-hover:text-gray-500'}
                `} />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* TAB 1: Basisinfos */}
        {activeTab === 1 && (
          <>
        {/* Kunde und Grunddaten */}
        <div className="bg-white shadow rounded-lg p-6" style={{ width: 'calc(100% - 4cm)', marginLeft: '2cm', marginRight: '2cm' }}>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Kundeninformationen</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Erstellt von *</label>
              <select
                required
                value={formData.created_by}
                onChange={(e) => updateFormData(prev => ({ ...prev, created_by: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Mitarbeiter auswählen</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Provisionsempfänger *</label>
              <select
                required
                value={formData.commission_user}
                onChange={(e) => updateFormData(prev => ({ ...prev, commission_user: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Mitarbeiter auswählen</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.username})
                  </option>
                ))}
              </select>
            </div>

            {/* Kundensuche */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Kunde suchen *</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchCustomers(); } }}
                  className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                  placeholder="Name, Firma oder Kundennummer eingeben..."
                />
                <button
                  type="button"
                  onClick={searchCustomers}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Suchen
                </button>
              </div>
              
              {/* Suchergebnisse */}
              {customerSearchResults.length > 0 && (
                <ul className="mt-2 border border-gray-200 rounded-md max-h-48 overflow-y-auto bg-white shadow-lg">
                  {customerSearchResults.map(customer => (
                    <li
                      key={customer.id}
                      className="p-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      onClick={() => handleSelectCustomer(customer)}
                    >
                      <div className="font-medium text-gray-900">
                        {customer.customer_number} - {customer.first_name} {customer.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {customer.company && `${customer.company} • `}
                        {customer.primary_email || customer.email}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              
              {/* Ausgewählter Kunde */}
              {selectedCustomer && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-green-800">Ausgewählter Kunde</div>
                    <div className="text-gray-900">
                      {selectedCustomer.customer_number} - {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {selectedCustomer.company && `${selectedCustomer.company} • `}
                      {selectedCustomer.primary_email || selectedCustomer.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      updateFormData(prev => ({ ...prev, customer: '' }));
                    }}
                    className="text-sm text-gray-600 hover:text-red-600"
                  >
                    Entfernen
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Angebotsreferenz</label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => updateFormData(prev => ({ ...prev, reference: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="z.B. Projekt XY, Ihre Anfrage vom..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => updateFormData(prev => ({ ...prev, status: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="DRAFT">In Arbeit</option>
                <option value="SENT">Verschickt</option>
                <option value="ACTIVE">Aktiv</option>
                <option value="EXPIRED">Abgelaufen</option>
                <option value="ORDERED">Bestellt</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Sprache</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="DE">Deutsch</option>
                <option value="EN">English</option>
              </select>
            </div>

            {/* Projekt-Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Projekt zuordnen</label>
              <select
                value={formData.project_reference}
                onChange={(e) => updateFormData(prev => ({ ...prev, project_reference: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Kein Projekt</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.project_number || project.id} - {project.name} {project.customer_name && `(${project.customer_name})`}
                  </option>
                ))}
              </select>
            </div>

            {/* System-Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700">System zuordnen</label>
              <select
                value={formData.system_reference}
                onChange={(e) => updateFormData(prev => ({ ...prev, system_reference: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Kein System</option>
                {systems.map(system => (
                  <option key={system.id} value={system.id}>
                    {system.system_number || system.id} - {system.name} {system.customer_name && `(${system.customer_name})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Empfängeradresse */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Empfängeradresse</h2>
          
          {customerAddresses.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Adresse übernehmen</label>
              <select
                onChange={(e) => handleCustomerAddressSelect(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Kundenadresse auswählen...</option>
                {customerAddresses.map(address => (
                  <option key={address.id} value={address.id}>
                    {address.institute || `${address.first_name} ${address.last_name}`} - {address.city}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Firma/Institut</label>
              <input
                type="text"
                value={formData.recipient_company}
                onChange={(e) => updateFormData(prev => ({ ...prev, recipient_company: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={formData.recipient_name}
                onChange={(e) => updateFormData(prev => ({ ...prev, recipient_name: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Straße</label>
              <input
                type="text"
                value={formData.recipient_street}
                onChange={(e) => updateFormData(prev => ({ ...prev, recipient_street: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">PLZ</label>
                <input
                  type="text"
                  value={formData.recipient_postal_code}
                  onChange={(e) => updateFormData(prev => ({ ...prev, recipient_postal_code: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Ort</label>
                <input
                  type="text"
                  value={formData.recipient_city}
                  onChange={(e) => updateFormData(prev => ({ ...prev, recipient_city: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Land</label>
              <input
                type="text"
                maxLength="2"
                value={formData.recipient_country}
                onChange={(e) => updateFormData(prev => ({ ...prev, recipient_country: e.target.value.toUpperCase() }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="DE"
              />
            </div>
          </div>
        </div>

        {/* Angebotsbeschreibung (erscheint über Positionsliste im PDF) */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Angebotsbeschreibung</h2>
          <p className="text-sm text-gray-500 mb-4">Dieser Text erscheint im PDF über der Positionsliste.</p>
          <textarea
            rows="4"
            value={formData.description_text}
            onChange={(e) => updateFormData(prev => ({ ...prev, description_text: e.target.value }))}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
            placeholder="z.B. Wir freuen uns, Ihnen folgendes Angebot unterbreiten zu dürfen..."
          />
        </div>
        </>
        )}

        {/* TAB 2: Positionen */}
        {activeTab === 2 && (
          <>
        {/* Angebotspositionen */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Angebotspositionen</h2>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Neue Ware hinzufügen
              </button>
              <button
                type="button"
                onClick={handleAddItemGroup}
                className="inline-flex items-center px-3 py-2 border border-green-300 shadow-sm text-sm leading-4 font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Neue Warensammlung hinzufügen
              </button>
            </div>
          </div>

          {formData.items.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Keine Positionen vorhanden</p>
          ) : (
            <div className="space-y-4">
              {formData.items.map((item, index) => {
                const itemTotals = calculateItemTotal(item);
                const isGroupHeader = item.is_group_header;
                const isGroupMember = !isGroupHeader && item.group_id;
                const groupMargin = isGroupHeader && item.sale_price ? calculateGroupMargin(item) : null;
                const listPriceSum = isGroupHeader ? getGroupListPriceSum(item.group_id) : 0;
                const isCollapsed = isGroupHeader && collapsedGroups[item.group_id];
                
                // Überspringe Gruppenmitglieder wenn die Gruppe eingeklappt ist
                if (isGroupMember && collapsedGroups[item.group_id]) {
                  return null;
                }
                
                return (
                  <div 
                    key={index} 
                    className={`border rounded-lg p-4 ${
                      isGroupHeader ? 'border-green-400 bg-green-50' : 
                      isGroupMember ? 'border-gray-200 ml-8' : 
                      'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="w-16 border border-gray-300 rounded px-2 py-1 text-sm font-medium bg-gray-50">
                          {item.display_position || item.position}
                        </span>
                        
                        {/* Einklapp-Button für Gruppen */}
                        {isGroupHeader && (
                          <button
                            type="button"
                            onClick={() => toggleGroupCollapse(item.group_id)}
                            className="text-green-700 hover:text-green-900"
                            title={isCollapsed ? "Gruppe aufklappen" : "Gruppe einklappen"}
                          >
                            {isCollapsed ? (
                              <ChevronDownIcon className="h-5 w-5" />
                            ) : (
                              <ChevronUpIcon className="h-5 w-5" />
                            )}
                          </button>
                        )}
                        
                        {isGroupHeader ? (
                          <h3 className="text-sm font-bold text-green-800">
                            📦 Warensammlung: {item.group_name}
                          </h3>
                        ) : (
                          <h3 className="text-sm font-medium text-gray-900">
                            {isGroupMember ? '↳ Gruppenware' : 'Position'}
                          </h3>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {/* Auf/Ab-Buttons */}
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => handleMoveItem(index, 'up')}
                            disabled={index === 0 || (isGroupMember && formData.items[index - 1]?.is_group_header)}
                            className="text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Nach oben verschieben"
                          >
                            <ArrowUpIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveItem(index, 'down')}
                            disabled={
                              index === formData.items.length - 1 ||
                              (isGroupMember && !formData.items[index + 1]?.group_id)
                            }
                            className="text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Nach unten verschieben"
                          >
                            <ArrowDownIcon className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Inhalt nur anzeigen wenn nicht eingeklappt (oder kein Header) */}
                    {!isCollapsed && (
                      <>
                    {/* Gruppen-Header: Gruppenname und Verkaufspreis */}
                    {isGroupHeader ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Gruppenname *</label>
                            <input
                              type="text"
                              required
                              value={item.group_name}
                              onChange={(e) => handleItemChange(index, 'group_name', e.target.value)}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                              placeholder="z.B. Komplettes System XY"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Verkaufspreis € *
                              <span className="text-xs text-gray-500 ml-1">(∑ Listen: {listPriceSum.toFixed(2)})</span>
                            </label>
                            <div className="flex">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={item.sale_price || ''}
                                onChange={(e) => handleItemChange(index, 'sale_price', parseFloat(e.target.value) || 0)}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                                disabled={item.uses_system_price}
                              />
                              <button
                                type="button"
                                onClick={() => handleItemChange(index, 'sale_price', listPriceSum)}
                                className="ml-2 mt-1 px-2 text-xs bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
                                title="Summe der Listenpreise übernehmen"
                                disabled={item.uses_system_price}
                              >
                                Σ
                              </button>
                            </div>
                          </div>
                          
                          {/* Systempreis-Option für Warensammlung */}
                          <div>
                            <label className="flex items-center mt-6">
                              <input
                                type="checkbox"
                                checked={item.uses_system_price || false}
                                onChange={(e) => handleItemChange(index, 'uses_system_price', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                Systempreis verwenden
                                {formData.system_price && ` (€ ${parseFloat(formData.system_price).toFixed(2)})`}
                              </span>
                            </label>
                          </div>
                        </div>
                        
                        {/* Marge-Anzeige für Gruppe */}
                        {groupMargin && (
                          <div className="bg-white border border-green-200 p-3 rounded">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Gesamt-EK:</span>
                                <span className="ml-2 font-medium text-blue-900">€ {groupMargin.totalCost.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Gesamt-VK:</span>
                                <span className="ml-2 font-medium">
                                  € {item.uses_system_price 
                                    ? (parseFloat(formData.system_price) || 0).toFixed(2)
                                    : (parseFloat(item.sale_price) || 0).toFixed(2)
                                  }
                                  {item.uses_system_price && <span className="text-xs text-blue-600 ml-1">(Systempreis)</span>}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Marge:</span>
                                <span className={`ml-2 font-bold ${groupMargin.absolute >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  € {groupMargin.absolute.toFixed(2)} ({groupMargin.percent.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Button: Ware zur Gruppe hinzufügen */}
                        <button
                          type="button"
                          onClick={() => handleAddItemToGroup(item.group_id)}
                          className="inline-flex items-center px-3 py-1 border border-green-300 shadow-sm text-xs font-medium rounded text-green-700 bg-white hover:bg-green-50"
                        >
                          <PlusIcon className="h-4 w-4 mr-1" />
                          Ware zur Gruppe hinzufügen
                        </button>
                      </div>
                    ) : (
                      /* Normale Position oder Gruppenmitglied */
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <div className="md:col-span-3">
                          <label className="block text-sm font-medium text-gray-700">Produkt/Anlage *</label>
                          {/* Product Filter */}
                          <input
                            type="text"
                            placeholder="Filter: Artikelnummer oder Name..."
                            value={productFilter}
                            onChange={(e) => setProductFilter(e.target.value)}
                            className="mt-1 mb-1 block w-full border border-gray-200 rounded-md shadow-sm py-1 px-2 text-xs focus:outline-none focus:ring-green-500 focus:border-green-500 bg-gray-50"
                          />
                          <select
                            required
                            value={item.object_id || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              handleItemChange(index, 'object_id', value);
                            }}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                          >
                            <option value="">Auswählen...</option>
                            <optgroup label="🛒 Trading Products (Handelswaren)">
                              {tradingProducts
                                .filter(p => {
                                  if (!productFilter) return true;
                                  const search = productFilter.toLowerCase();
                                  return (
                                    (p.visitron_part_number || '').toLowerCase().includes(search) ||
                                    (p.name || '').toLowerCase().includes(search) ||
                                    (p.supplier_part_number || '').toLowerCase().includes(search)
                                  );
                                })
                                .map(product => (
                                <option key={`tp-${product.id}`} value={`tp-${product.id}`}>
                                  {product.visitron_part_number} - {product.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="💻 VisiView Software">
                              {visiviewProducts
                                .filter(p => {
                                  if (!productFilter) return true;
                                  const search = productFilter.toLowerCase();
                                  return (
                                    (p.article_number || '').toLowerCase().includes(search) ||
                                    (p.name || '').toLowerCase().includes(search)
                                  );
                                })
                                .map(product => (
                                <option key={`vv-${product.id}`} value={`vv-${product.id}`}>
                                  {product.article_number} - {product.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="🔧 VS-Hardware (Eigenprodukte)">
                              {vsHardwareProducts
                                .filter(p => {
                                  if (!productFilter) return true;
                                  const search = productFilter.toLowerCase();
                                  return (
                                    (p.part_number || '').toLowerCase().includes(search) ||
                                    (p.name || '').toLowerCase().includes(search) ||
                                    (p.model_designation || '').toLowerCase().includes(search)
                                  );
                                })
                                .map(product => (
                                <option key={`vs-${product.id}`} value={`vs-${product.id}`}>
                                  {product.part_number} - {product.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="🛠️ VS-Service (Dienstleistungen)">
                              {vsServiceProducts
                                .filter(p => {
                                  if (!productFilter) return true;
                                  const search = productFilter.toLowerCase();
                                  return (
                                    (p.article_number || '').toLowerCase().includes(search) ||
                                    (p.name || '').toLowerCase().includes(search) ||
                                    (p.short_description || '').toLowerCase().includes(search)
                                  );
                                })
                                .map(product => (
                                <option key={`vss-${product.id}`} value={`vss-${product.id}`}>
                                  {product.article_number} - {product.name}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
                          <select
                            value={item.description_type}
                            onChange={(e) => handleItemChange(index, 'description_type', e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                          >
                            <option value="SHORT">Kurz</option>
                            <option value="LONG">Lang</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Menge</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 1)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">VK-Preis €</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">EK-Preis €</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.purchase_price}
                            onChange={(e) => handleItemChange(index, 'purchase_price', parseFloat(e.target.value) || 0)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm bg-blue-50"
                            title="Einkaufspreis für Marge-Berechnung"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Rabatt %</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={item.discount_percent}
                            onChange={(e) => handleItemChange(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                          />
                        </div>

                        {/* Beschreibungstext */}
                        <div className="md:col-span-6">
                          <label className="block text-sm font-medium text-gray-700">
                            Beschreibungstext ({formData.language === 'DE' ? 'Deutsch' : 'Englisch'})
                          </label>
                          <textarea
                            rows="2"
                            value={item.custom_description || ''}
                            onChange={(e) => handleItemChange(index, 'custom_description', e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                            placeholder="Beschreibung für das Angebot (wird aus Produktdaten geladen, kann bearbeitet werden)"
                          />
                        </div>

                        {/* Systempreis-Option nur für Positionen ohne Gruppe */}
                        {!isGroupMember && (
                          <div className="md:col-span-2">
                            <label className="flex items-center mt-6">
                              <input
                                type="checkbox"
                                checked={item.uses_system_price || false}
                                onChange={(e) => handleItemChange(index, 'uses_system_price', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                              />
                              <span className="ml-2 text-sm text-gray-700">
                                Systempreis verwenden
                                {formData.system_price && ` (€ ${parseFloat(formData.system_price).toFixed(2)})`}
                              </span>
                            </label>
                          </div>
                        )}

                        {/* Totale und Marge */}
                        <div className={`bg-gray-50 p-3 rounded ${isGroupMember ? 'md:col-span-6' : 'md:col-span-4'}`}>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">Gesamt-EK:</span>
                              <span className="ml-2 font-medium text-blue-900">€ {(itemTotals.purchaseCost || 0).toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Gesamt-VK:</span>
                              <span className="ml-2 font-medium">€ {itemTotals.subtotal.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Marge:</span>
                              <span className={`ml-2 font-bold ${(itemTotals.margin || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                € {(itemTotals.margin || 0).toFixed(2)} ({(itemTotals.marginPercent || 0).toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Systempreis */}
          <div className="mt-6 border-t pt-4">
            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Systempreis (optional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.system_price}
                onChange={(e) => setFormData(prev => ({ ...prev, system_price: e.target.value }))}
                placeholder="Systempreis für ausgewählte Positionen"
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
              <p className="mt-1 text-sm text-gray-500">
                Positionen können individuell auf Systempreis gesetzt werden. Der Systempreis ersetzt dann den Verkaufspreis dieser Positionen.
              </p>
            </div>
          </div>

          {/* Lieferkosten */}
          <div className="mt-6 border-t pt-4">
            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lieferkosten (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.delivery_cost}
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_cost: e.target.value }))}
                placeholder="0.00"
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
              <p className="mt-1 text-sm text-gray-500">
                Lieferkosten werden zur Nettosumme addiert, bevor die MwSt berechnet wird.
              </p>
            </div>
          </div>

          {/* Gesamtsummen */}
          {formData.items.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <div className="flex justify-end">
                <div className="w-96 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Gesamt-EK:</span>
                    <span className="font-medium text-blue-900">€ {totals.totalPurchaseCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Gesamt-VK (Netto):</span>
                    <span className="font-medium">€ {totals.totalNet.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className={`font-bold ${totals.totalMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      Gesamtmarge:
                    </span>
                    <span className={`font-bold ${totals.totalMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      € {totals.totalMargin.toFixed(2)} ({totals.totalMarginPercent.toFixed(1)}%)
                    </span>
                  </div>
                  {totals.deliveryCost > 0 && (
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-gray-600">Lieferkosten:</span>
                      <span className="font-medium">€ {totals.deliveryCost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Zwischensumme:</span>
                    <span className="font-medium">€ {totals.netWithDelivery.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">MwSt ({formData.tax_rate}%):</span>
                    <span className="font-medium">€ {totals.totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2 border-gray-800">
                    <span>Gesamtsumme:</span>
                    <span>€ {totals.totalGross.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Interne Notizen in Tab 2 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Interne Notizen</h2>
          <textarea
            rows="3"
            value={formData.notes}
            onChange={(e) => updateFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
            placeholder="Interne Notizen (erscheinen nicht im Angebot)"
          />
        </div>
        </>
        )}

        {/* TAB 3: Konditionen */}
        {activeTab === 3 && (
          <>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Angebotskonditionen</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Zahlungsbedingung</label>
              <select
                value={formData.payment_term}
                onChange={(e) => updateFormData(prev => ({ ...prev, payment_term: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Keine</option>
                {paymentTerms.map(term => (
                  <option key={term.id} value={term.id}>{term.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Lieferbedingung (Incoterm)</label>
              <select
                value={formData.delivery_term}
                onChange={(e) => updateFormData(prev => ({ ...prev, delivery_term: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Keine</option>
                {deliveryTerms.map(term => (
                  <option key={term.id} value={term.id}>{term.incoterm}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Lieferzeit (Wochen)</label>
              <input
                type="number"
                min="0"
                value={formData.delivery_time_weeks}
                onChange={(e) => updateFormData(prev => ({ ...prev, delivery_time_weeks: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Angebots-Gültigkeit bis *</label>
              <input
                type="date"
                required
                value={formData.valid_until}
                onChange={(e) => updateFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>
          
          <div className="mt-6 space-y-4">
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.show_terms_conditions}
                  onChange={(e) => updateFormData(prev => ({ ...prev, show_terms_conditions: e.target.checked }))}
                  className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">AGB-Hinweis im Angebot anzeigen</span>
              </label>
            </div>
            
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.show_group_item_prices}
                  onChange={(e) => updateFormData(prev => ({ ...prev, show_group_item_prices: e.target.checked }))}
                  className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">Preise von Gruppen-Artikeln anzeigen</span>
              </label>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.tax_enabled}
                  onChange={(e) => updateFormData(prev => ({ ...prev, tax_enabled: e.target.checked }))}
                  className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">MwSt aktiviert</span>
              </label>
              
              {formData.tax_enabled && (
                <div className="flex items-center">
                  <label className="text-sm text-gray-700 mr-2">MwSt-Satz (%):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.tax_rate}
                    onChange={(e) => updateFormData(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                    className="w-20 border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fußtext für PDF */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Fußtext (Ende des Angebots)</h2>
          <p className="text-sm text-gray-500 mb-4">Dieser Text erscheint im PDF am Ende des Angebots.</p>
          <textarea
            rows="4"
            value={formData.footer_text}
            onChange={(e) => updateFormData(prev => ({ ...prev, footer_text: e.target.value }))}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
            placeholder="z.B. Wir freuen uns auf Ihre Bestellung und stehen für Rückfragen gerne zur Verfügung."
          />
        </div>
        </>
        )}

        {/* TAB 4: PDF erstellen */}
        {activeTab === 4 && (
          <>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">PDF-Dokument erstellen</h2>
          
          {/* Warnung bei ungespeicherten Änderungen */}
          {hasUnsavedChanges && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800 font-medium">
                ⚠️ Sie haben ungespeicherte Änderungen. Bitte speichern Sie das Angebot bevor Sie ein PDF erstellen.
              </p>
            </div>
          )}
          
          {/* Existierendes PDF anzeigen */}
          {formData.pdf_file_url && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-green-800 font-medium mb-2">
                ✅ PDF wurde bereits erstellt
              </p>
              <a 
                href={formData.pdf_file_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-green-700 hover:text-green-900 underline"
              >
                <DocumentArrowDownIcon className="h-5 w-5 mr-1" />
                PDF herunterladen
              </a>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Angebotsdatum</label>
              <input
                type="date"
                value={formData.quotation_date}
                onChange={(e) => updateFormData(prev => ({ ...prev, quotation_date: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Sprache</label>
              <select
                value={formData.language}
                onChange={(e) => updateFormData(prev => ({ ...prev, language: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="DE">Deutsch</option>
                <option value="EN">English</option>
              </select>
            </div>
          </div>

          {isEditMode ? (
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleCreateAndSavePDF}
                disabled={hasUnsavedChanges}
                className={`inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  hasUnsavedChanges 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                {formData.pdf_file_url ? 'PDF neu erstellen' : 'PDF erstellen'}
              </button>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                Bitte speichern Sie das Angebot zuerst, um ein PDF zu erstellen.
              </p>
            </div>
          )}
        </div>
        </>
        )}

        {/* TAB 5: Auftrag erstellen */}
        {activeTab === 5 && (
          <>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Auftrag aus Angebot erstellen</h2>
          
          {isEditMode ? (
            <div className="space-y-4">
              <p className="text-gray-600">
                Erstellen Sie einen neuen Kundenauftrag basierend auf diesem Angebot. 
                Alle Informationen werden automatisch übernommen.
              </p>
              
              {formData.status === 'ORDERED' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800">
                    Dieses Angebot wurde bereits in einen Auftrag umgewandelt.
                  </p>
                </div>
              )}
              
              <button
                type="button"
                onClick={() => navigate(`/sales/order-processing/new?from_quotation=${id}`)}
                disabled={formData.status === 'ORDERED'}
                className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
              >
                <ShoppingCartIcon className="h-5 w-5 mr-2" />
                Neuen Auftrag anlegen
              </button>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                Bitte speichern Sie das Angebot zuerst, um einen Auftrag daraus zu erstellen.
              </p>
            </div>
          )}
        </div>
        </>
        )}

        {/* Buttons - immer sichtbar */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => navigate('/sales/quotations')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Abbrechen
          </button>
          
          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Speichere...' : (isEditMode ? 'Aktualisieren' : 'Erstellen')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default QuotationForm;
