import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  ArrowLeftIcon, DocumentArrowDownIcon, 
  EyeIcon, ArrowDownTrayIcon,
  CheckCircleIcon, ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const PriceListEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pricelistTypes, setPricelistTypes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  
  const [formData, setFormData] = useState({
    pricelist_type: 'vs_hardware',
    supplier: '',
    trading_supplier: '',
    include_vs_hardware: false,
    include_visiview: false,
    include_trading: false,
    include_vs_service: false,
    valid_from_month: new Date().getMonth() + 1,
    valid_from_year: new Date().getFullYear(),
    valid_until_month: 12,
    valid_until_year: new Date().getFullYear(),
    subtitle: ''
  });
  
  const [pricelist, setPricelist] = useState(null);

  // Load metadata
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [typesRes, suppliersRes] = await Promise.all([
          api.get('/pricelists/types/'),
          api.get('/pricelists/suppliers/')
        ]);
        setPricelistTypes(typesRes.data);
        setSuppliers(suppliersRes.data);
      } catch (err) {
        console.error('Error loading metadata:', err);
      }
    };
    loadMeta();
  }, []);

  // Load existing pricelist
  useEffect(() => {
    if (!isNew) {
      const loadPricelist = async () => {
        try {
          const response = await api.get(`/pricelists/${id}/`);
          const data = response.data;
          setPricelist(data);
          setFormData({
            pricelist_type: data.pricelist_type,
            supplier: data.supplier || '',
            trading_supplier: data.trading_supplier || '',
            include_vs_hardware: data.include_vs_hardware,
            include_visiview: data.include_visiview,
            include_trading: data.include_trading,
            include_vs_service: data.include_vs_service,
            valid_from_month: data.valid_from_month,
            valid_from_year: data.valid_from_year,
            valid_until_month: data.valid_until_month,
            valid_until_year: data.valid_until_year,
            subtitle: data.subtitle || ''
          });
        } catch (err) {
          console.error('Error loading pricelist:', err);
          alert('Fehler beim Laden der Preisliste');
          navigate('/sales/pricelists');
        } finally {
          setLoading(false);
        }
      };
      loadPricelist();
    }
  }, [id, isNew, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setSuccessMessage('');

    try {
      // Prepare data
      const submitData = {
        ...formData,
        supplier: formData.supplier || null,
        trading_supplier: formData.trading_supplier || null,
        valid_from_month: parseInt(formData.valid_from_month, 10),
        valid_from_year: parseInt(formData.valid_from_year, 10),
        valid_until_month: parseInt(formData.valid_until_month, 10),
        valid_until_year: parseInt(formData.valid_until_year, 10)
      };

      let response;
      if (isNew) {
        response = await api.post('/pricelists/', submitData);
        setSuccessMessage('Preisliste wurde erfolgreich erstellt.');
        // Navigate to edit page of newly created pricelist
        navigate(`/sales/pricelists/${response.data.id}`, { replace: true });
      } else {
        response = await api.put(`/pricelists/${id}/`, submitData);
        setPricelist(prev => ({ ...prev, ...response.data }));
        setSuccessMessage('Preisliste wurde erfolgreich gespeichert.');
      }
    } catch (err) {
      console.error('Error saving pricelist:', err);
      if (err.response?.data) {
        if (typeof err.response.data === 'object') {
          setErrors(err.response.data);
        } else {
          setErrors({ general: err.response.data });
        }
      } else {
        setErrors({ general: 'Ein Fehler ist aufgetreten.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!pricelist) return;
    setGeneratingPdf(true);
    try {
      const response = await api.post(`/pricelists/${id}/generate_pdf/`);
      if (response.data.success) {
        setPricelist(response.data.data);
        setSuccessMessage('PDF wurde erfolgreich generiert.');
      } else {
        setErrors({ general: response.data.message || 'Fehler beim Generieren des PDFs' });
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      setErrors({ general: 'Fehler beim Generieren des PDFs' });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePreviewPdf = async () => {
    if (!pricelist?.has_pdf) return;
    try {
      const response = await api.get(`/pricelists/${id}/preview_pdf/`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error previewing PDF:', err);
      alert('Fehler beim Anzeigen des PDFs');
    }
  };

  const handleDownloadPdf = async () => {
    if (!pricelist?.has_pdf) return;
    try {
      const response = await api.get(`/pricelists/${id}/download_pdf/`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', pricelist.filename || 'pricelist.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Fehler beim Herunterladen des PDFs');
    }
  };

  // Generate month options
  const monthOptions = [
    { value: 1, label: 'Januar' },
    { value: 2, label: 'Februar' },
    { value: 3, label: 'März' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Dezember' }
  ];

  // Generate year options
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 3; y++) {
    yearOptions.push(y);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Lade Preisliste...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/sales/pricelists')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? 'Neue Preisliste' : 'Preisliste bearbeiten'}
            </h1>
            {pricelist && (
              <p className="text-gray-600">{pricelist.display_name}</p>
            )}
          </div>
        </div>
        
        {/* PDF Actions */}
        {!isNew && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {generatingPdf ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              ) : (
                <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
              )}
              PDF Generieren
            </button>
            
            {pricelist?.has_pdf && (
              <>
                <button
                  onClick={handlePreviewPdf}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <EyeIcon className="w-5 h-5 mr-2" />
                  Vorschau
                </button>
                <button
                  onClick={handleDownloadPdf}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
                  Download
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
          <span className="text-green-800">{successMessage}</span>
        </div>
      )}
      
      {errors.general && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
          <span className="text-red-800">{errors.general}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
        {/* Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Preislistentyp *
          </label>
          <select
            name="pricelist_type"
            value={formData.pricelist_type}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {pricelistTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {errors.pricelist_type && (
            <p className="mt-1 text-sm text-red-600">{errors.pricelist_type}</p>
          )}
        </div>

        {/* Supplier (for Trading type) */}
        {formData.pricelist_type === 'trading' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lieferant (optional - leer = alle Trading Products)
            </label>
            <select
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Alle Lieferanten</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.company_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Combined Options */}
        {formData.pricelist_type === 'combined' && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Produkttypen einschließen *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="include_vs_hardware"
                  checked={formData.include_vs_hardware}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                VS-Hardware
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="include_visiview"
                  checked={formData.include_visiview}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                VisiView
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="include_trading"
                  checked={formData.include_trading}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                Trading Products
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="include_vs_service"
                  checked={formData.include_vs_service}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                VS-Service
              </label>
            </div>
            
            {/* Trading supplier filter for combined */}
            {formData.include_trading && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trading Products Lieferant (optional)
                </label>
                <select
                  name="trading_supplier"
                  value={formData.trading_supplier}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Alle Lieferanten</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.company_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Validity Period */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gültigkeitszeitraum *
          </label>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Von</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  name="valid_from_month"
                  value={formData.valid_from_month}
                  onChange={handleChange}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {monthOptions.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <select
                  name="valid_from_year"
                  value={formData.valid_from_year}
                  onChange={handleChange}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bis</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  name="valid_until_month"
                  value={formData.valid_until_month}
                  onChange={handleChange}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {monthOptions.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <select
                  name="valid_until_year"
                  value={formData.valid_until_year}
                  onChange={handleChange}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {(errors.valid_from_month || errors.valid_until_month) && (
            <p className="mt-1 text-sm text-red-600">
              {errors.valid_from_month || errors.valid_until_month}
            </p>
          )}
        </div>

        {/* Subtitle */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Untertitel (optional)
          </label>
          <input
            type="text"
            name="subtitle"
            value={formData.subtitle}
            onChange={handleChange}
            placeholder="Automatisch generiert wenn leer"
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Leer lassen für automatisch generierten Untertitel basierend auf dem Typ
          </p>
        </div>

        {/* Info about PDF */}
        {!isNew && pricelist && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">PDF-Information</h3>
            <p className="text-sm text-blue-800">
              {pricelist.has_pdf ? (
                <>
                  PDF vorhanden: <strong>{pricelist.filename}</strong>
                  <br />
                  Zuletzt aktualisiert: {new Date(pricelist.updated_at).toLocaleString('de-DE')}
                </>
              ) : (
                'Noch kein PDF generiert. Speichern Sie die Preisliste und klicken Sie auf "PDF Generieren".'
              )}
            </p>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/sales/pricelists')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Speichere...' : (isNew ? 'Erstellen' : 'Speichern')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PriceListEdit;
