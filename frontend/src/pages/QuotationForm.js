import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeftIcon, PlusIcon, TrashIcon, DocumentArrowDownIcon, DocumentIcon, ChevronDownIcon, ChevronUpIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

const QuotationForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerAddresses, setCustomerAddresses] = useState([]);
  const [tradingProducts, setTradingProducts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState([]);
  const [deliveryTerms, setDeliveryTerms] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  
  const [formData, setFormData] = useState({
    customer: '',
    created_by: '',
    commission_user: '',
    project_reference: '',
    system_reference: '',
    reference: '',
    valid_until: '',
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
    items: []
  });
  
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (id) {
      fetchQuotation();
    }
  }, [id]);
  
  useEffect(() => {
    if (formData.customer) {
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
      const [customersRes, tradingRes, assetsRes, paymentRes, deliveryTermsRes, usersRes, currentUserRes] = await Promise.all([
        api.get('/customers/customers/?is_active=true'),
        api.get('/suppliers/products/'),
        api.get('/suppliers/assets/'),
        api.get('/settings/payment-terms/'),
        api.get('/settings/delivery-terms/'),
        api.get('/users/'),
        api.get('/users/me/')
      ]);
      
      setCustomers(customersRes.data.results || customersRes.data || []);
      setTradingProducts(tradingRes.data.results || tradingRes.data || []);
      setAssets(assetsRes.data.results || assetsRes.data || []);
      setPaymentTerms(paymentRes.data.results || paymentRes.data || []);
      setDeliveryTerms(deliveryTermsRes.data.results || deliveryTermsRes.data || []);
      setUsers(usersRes.data.results || usersRes.data || []);
      
      const user = currentUserRes.data;
      setCurrentUser(user);
      
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

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/sales/quotations/${id}/`);
      const quotation = response.data;
      
      console.log('FRONTEND DEBUG: Loaded quotation:', quotation);
      console.log('FRONTEND DEBUG: Quotation items:', quotation.items);
      console.log('FRONTEND DEBUG: Items count:', quotation.items?.length || 0);
      
      // Items müssen die neuen Felder enthalten
      const mappedItems = (quotation.items || []).map(item => ({
        id: item.id,
        content_type: item.content_type_data || item.content_type,
        object_id: item.object_id,
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
        notes: item.notes || ''
      }));
      
      console.log('FRONTEND DEBUG: Mapped items:', mappedItems);
      
      // Update position numbers after loading items
      const itemsWithPositions = updatePositionNumbers(mappedItems);
      
      console.log('FRONTEND DEBUG: Items with positions:', itemsWithPositions);
      
      setFormData({
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
        notes: quotation.notes || '',
        items: itemsWithPositions
      });
    } catch (error) {
      console.error('Fehler beim Laden des Angebots:', error);
      alert('Fehler beim Laden des Angebots');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerDetails = async (customerId) => {
    if (!customerId) {
      setSelectedCustomer(null);
      setCustomerAddresses([]);
      return;
    }

    try {
      const response = await api.get(`/customers/customers/${customerId}/`);
      const customer = response.data;
      setSelectedCustomer(customer);
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
      setFormData(prev => ({
        ...prev,
        recipient_company: address.institute || '',
        recipient_name: `${address.title || ''} ${address.first_name || ''} ${address.last_name || ''}`.trim(),
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
        group_id: null,
        group_name: '',
        is_group_header: false
      }];
      return {
        ...prev,
        items: updatePositionNumbers(newItems)
      };
    });
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
        group_id: groupId,
        group_name: 'Neue Warensammlung',
        is_group_header: true
      }];
      return {
        ...prev,
        items: updatePositionNumbers(newItems)
      };
    });
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
        group_id: groupId,
        group_name: '',
        is_group_header: false
      }];
      return {
        ...prev,
        items: updatePositionNumbers(newItems)
      };
    });
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => {
      const updatedItems = prev.items.filter((_, i) => i !== index);
      return {
        ...prev,
        items: updatePositionNumbers(updatedItems)
      };
    });
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const updatedItems = prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          
          // Wenn Produkt gewechselt wird, lade Preise automatisch
          if (field === 'object_id' && value) {
            const selectedProduct = [...tradingProducts, ...assets].find(p => p.id === parseInt(value));
            if (selectedProduct) {
              // Setze Verkaufspreis (Visitron List Price)
              updatedItem.unit_price = selectedProduct.visitron_list_price || 0;
              // Setze Einkaufspreis (Purchase Price in EUR)
              updatedItem.purchase_price = selectedProduct.purchase_price_eur || selectedProduct.purchase_price || 0;
              
              // Setze content_type basierend auf dem Produkttyp
              const isTradingProduct = tradingProducts.some(p => p.id === parseInt(value));
              const isAsset = assets.some(a => a.id === parseInt(value));
              
              if (isTradingProduct) {
                updatedItem.content_type = { app_label: 'suppliers', model: 'tradingproduct' };
              } else if (isAsset) {
                updatedItem.content_type = { app_label: 'suppliers', model: 'asset' };
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

      return {
        ...prev,
        items: updatedItems
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      
      // Positionen - als JSON
      const items = formData.items.map(item => {
        // Bestimme content_type basierend auf dem ausgewählten Produkt
        let contentType = null;
        
        // Nur für normale Positionen, nicht für Gruppen-Header ohne Item
        if (item.object_id && !item.is_group_header) {
          const isTradingProduct = tradingProducts.some(p => p.id === parseInt(item.object_id));
          const isAsset = assets.some(a => a.id === parseInt(item.object_id));
          
          if (isTradingProduct) {
            contentType = { app_label: 'suppliers', model: 'tradingproduct' };
          } else if (isAsset) {
            contentType = { app_label: 'suppliers', model: 'asset' };
          }
        }
        
        return {
          id: item.id || null,
          content_type: contentType,
          object_id: item.object_id ? parseInt(item.object_id) : null,
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
          notes: item.notes || ''
        };
      });
      
      console.log('FRONTEND DEBUG: Submitting quotation with items:', items.length);
      console.log('FRONTEND DEBUG: First 2 items:', items.slice(0, 2));
      console.log('FRONTEND DEBUG: All items:', items);
      
      // Items als JSON-String senden
      const itemsJson = JSON.stringify(items);
      console.log('FRONTEND DEBUG: Items JSON:', itemsJson);
      submitData.append('items', itemsJson);

      console.log('FRONTEND DEBUG: Sending request to:', isEditMode ? `/sales/quotations/${id}/` : '/sales/quotations/');
      
      let response;
      if (isEditMode) {
        console.log('FRONTEND DEBUG: PUT request for quotation', id);
        response = await api.put(`/sales/quotations/${id}/`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        console.log('FRONTEND DEBUG: POST request for new quotation');
        response = await api.post('/sales/quotations/', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      console.log('FRONTEND DEBUG: Response received:', response.data);
      alert(`Angebot erfolgreich ${isEditMode ? 'aktualisiert' : 'erstellt'}!`);
      
      // Bei neuem Angebot zur Detail-Seite navigieren, bei Edit bleiben
      if (!isEditMode) {
        navigate(`/sales/quotations/${response.data.id}`);
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
        marginPercent: purchaseCost > 0 ? ((systemPrice - purchaseCost) / purchaseCost * 100) : 0
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
        marginPercent: purchaseCost > 0 ? ((salePrice - purchaseCost) / purchaseCost * 100) : 0
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
      marginPercent: purchaseCost > 0 ? ((subtotal - purchaseCost) / purchaseCost * 100) : 0
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
    const totalMarginPercent = totalPurchaseCost > 0 ? (totalMargin / totalPurchaseCost * 100) : 0;
    
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
          {isEditMode ? 'Angebot bearbeiten' : 'Neues Angebot'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Kunde und Grunddaten */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Kundeninformationen</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Erstellt von *</label>
              <select
                required
                value={formData.created_by}
                onChange={(e) => setFormData(prev => ({ ...prev, created_by: e.target.value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, commission_user: e.target.value }))}
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
              <label className="block text-sm font-medium text-gray-700">Kunde *</label>
              <select
                required
                value={formData.customer}
                onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Kunde auswählen</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_number} - {customer.first_name} {customer.last_name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Gültig bis *</label>
              <input
                type="date"
                required
                value={formData.valid_until}
                onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Angebotsreferenz</label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="z.B. Projekt XY, Ihre Anfrage vom..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Lieferzeit (Wochen)</label>
              <input
                type="number"
                min="0"
                value={formData.delivery_time_weeks}
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_time_weeks: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="DRAFT">In Arbeit</option>
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

            <div>
              <label className="block text-sm font-medium text-gray-700">Projekt-Referenz (intern)</label>
              <input
                type="text"
                value={formData.project_reference}
                onChange={(e) => setFormData(prev => ({ ...prev, project_reference: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="Interne Projektzuordnung"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">System-Referenz (intern)</label>
              <input
                type="text"
                value={formData.system_reference}
                onChange={(e) => setFormData(prev => ({ ...prev, system_reference: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="Interne Systemzuordnung"
              />
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
                onChange={(e) => setFormData(prev => ({ ...prev, recipient_company: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={formData.recipient_name}
                onChange={(e) => setFormData(prev => ({ ...prev, recipient_name: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Straße</label>
              <input
                type="text"
                value={formData.recipient_street}
                onChange={(e) => setFormData(prev => ({ ...prev, recipient_street: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">PLZ</label>
                <input
                  type="text"
                  value={formData.recipient_postal_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, recipient_postal_code: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Ort</label>
                <input
                  type="text"
                  value={formData.recipient_city}
                  onChange={(e) => setFormData(prev => ({ ...prev, recipient_city: e.target.value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, recipient_country: e.target.value.toUpperCase() }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="DE"
              />
            </div>
          </div>
        </div>

        {/* Konditionen */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Konditionen</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Zahlungsbedingung</label>
              <select
                value={formData.payment_term}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_term: e.target.value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_term: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Keine</option>
                {deliveryTerms.map(term => (
                  <option key={term.id} value={term.id}>{term.incoterm}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.show_terms_conditions}
                onChange={(e) => setFormData(prev => ({ ...prev, show_terms_conditions: e.target.checked }))}
                className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700">AGB-Hinweis im Angebot anzeigen</span>
            </label>
          </div>
          
          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.show_group_item_prices}
                onChange={(e) => setFormData(prev => ({ ...prev, show_group_item_prices: e.target.checked }))}
                className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700">Preise von Gruppen-Artikeln anzeigen</span>
            </label>
          </div>

          <div className="mt-4 flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.tax_enabled}
                onChange={(e) => setFormData(prev => ({ ...prev, tax_enabled: e.target.checked }))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                  className="w-20 border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                />
              </div>
            )}
          </div>
        </div>

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
                            <optgroup label="Trading Products">
                              {tradingProducts.map(product => (
                                <option key={`tp-${product.id}`} value={product.id}>
                                  {product.visitron_part_number} - {product.name}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Assets">
                              {assets.map(asset => (
                                <option key={`as-${asset.id}`} value={asset.id}>
                                  {asset.visitron_part_number} - {asset.name}
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

        {/* Notizen und Dokument */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Notizen und Dokument</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Interne Notizen</label>
              <textarea
                rows="3"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="Interne Notizen (erscheinen nicht im Angebot)"
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => navigate('/sales/quotations')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Abbrechen
          </button>
          
          <div className="flex space-x-3">
            {isEditMode && (
              <>
                <button
                  type="button"
                  onClick={handleViewPDF}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <DocumentIcon className="h-5 w-5 mr-2" />
                  PDF anzeigen
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                  PDF herunterladen
                </button>
              </>
            )}
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
