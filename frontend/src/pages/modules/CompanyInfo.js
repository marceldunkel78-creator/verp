import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { 
  BuildingOfficeIcon, 
  PhoneIcon, 
  BanknotesIcon,
  DocumentTextIcon,
  PhotoIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const CompanyInfo = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [managingDirectors, setManagingDirectors] = useState(['']);
  
  const [formData, setFormData] = useState({
    company_name: '',
    street: '',
    house_number: '',
    postal_code: '',
    city: '',
    country: 'Deutschland',
    phone: '',
    fax: '',
    email: '',
    website: '',
    bank_name: '',
    iban: '',
    bic: '',
    managing_director: '',
    commercial_register: '',
    register_court: '',
    tax_number: '',
    vat_id: '',
    fiscal_year_start_month: 4,
    fiscal_year_start_day: 1,
    document_header: null
  });

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      const response = await api.get('/company-info/');
      
      if (response.data && response.data.length > 0) {
        const settings = response.data[0];
        
        // Extrahiere document_header URL, aber setze nicht das File-Objekt
        const { document_header, managing_director, ...otherSettings } = settings;
        
        setFormData(prevData => ({
          ...prevData,
          ...otherSettings,
          // document_header nicht setzen, nur Preview
        }));
        
        if (document_header) {
          setImagePreview(document_header);
        }
        
        // Parse managing_director string to array
        if (managing_director) {
          const directors = managing_director.split(',').map(d => d.trim()).filter(d => d);
          setManagingDirectors(directors.length > 0 ? directors : ['']);
        } else {
          setManagingDirectors(['']);
        }
      } else {
        // Keine Einstellungen gefunden - setze Defaults
        setManagingDirectors(['']);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Firmeneinstellungen:', err);
      console.error('Error details:', err.response);
      setError('Fehler beim Laden der Firmeneinstellungen');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prevData => ({
        ...prevData,
        document_header: file
      }));
      
      // Preview erstellen
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const submitData = new FormData();
      
      // Geschäftsführer zusammenführen
      const directorsString = managingDirectors.filter(d => d.trim()).join(', ');
      
      // Alle Felder hinzufügen
      Object.keys(formData).forEach(key => {
        if (key === 'managing_director') {
          submitData.append(key, directorsString);
          return;
        }
        if (key === 'document_header') {
          // Nur hinzufügen wenn es eine neue Datei ist
          if (formData[key] instanceof File) {
            submitData.append(key, formData[key]);
          }
        } else if (formData[key] !== null && formData[key] !== '' && formData[key] !== undefined) {
          // Für URL-Felder: Nur senden wenn es ein gültiges Format hat
          if (key === 'website' && formData[key]) {
            const value = formData[key].trim();
            if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
              submitData.append(key, value);
            }
          } else {
            submitData.append(key, formData[key]);
          }
        }
      });

      // Prüfe ob Einstellungen bereits existieren
      const existingSettings = await api.get('/company-info/');
      
      if (existingSettings.data && existingSettings.data.length > 0) {
        // Update - verwende die ID aus der Liste
        const settingsId = existingSettings.data[0].id;
        await api.put(
          `/company-info/${settingsId}/`,
          submitData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      } else {
        // Falls keine Einstellungen existieren, verwende PUT mit ID 1 (Singleton)
        await api.put(
          '/company-info/1/',
          submitData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      }

      setSuccessMessage('Firmeneinstellungen erfolgreich gespeichert!');
      
      // Daten neu laden
      await fetchCompanySettings();
      
      // Erfolgsmeldung nach 3 Sekunden ausblenden
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      console.error('Error Response:', err.response?.data);
      console.error('Error Status:', err.response?.status);
      console.error('Error Headers:', err.response?.headers);
      
      const errorMessage = err.response?.data?.detail 
        || err.response?.data?.error
        || err.message
        || 'Fehler beim Speichern der Firmeneinstellungen';
      
      setError(`Fehler beim Speichern: ${errorMessage} (Status: ${err.response?.status || 'unknown'})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/settings')}
          className="text-blue-600 hover:text-blue-800 mb-4"
        >
          ← Zurück zu Settings
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Firmeneinstellungen</h1>
        <p className="mt-2 text-sm text-gray-600">
          Verwalten Sie Ihre Firmendaten, Bankverbindung und Logo für Bestelldokumente
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Logo Upload */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-center mb-4">
            <PhotoIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Firmenlogo für Bestelldokumente</h2>
          </div>
          
          <div className="space-y-4">
            {imagePreview && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aktuelles Logo:
                </label>
                <img 
                  src={imagePreview} 
                  alt="Logo Preview" 
                  className="max-w-md max-h-32 border border-gray-300 rounded p-2 bg-white"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Neues Logo hochladen:
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              <p className="mt-1 text-xs text-gray-500">
                Empfohlen: PNG oder JPG, max. 2 MB, transparenter Hintergrund für beste Ergebnisse
              </p>
            </div>
          </div>
        </div>

        {/* Firmendaten */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-center mb-4">
            <BuildingOfficeIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Firmendaten</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Firmenname *
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Straße *
              </label>
              <input
                type="text"
                name="street"
                value={formData.street}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hausnummer *
              </label>
              <input
                type="text"
                name="house_number"
                value={formData.house_number}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PLZ *
              </label>
              <input
                type="text"
                name="postal_code"
                value={formData.postal_code}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ort *
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Land *
              </label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Kontaktdaten */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-center mb-4">
            <PhoneIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Kontaktdaten</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefon
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fax
              </label>
              <input
                type="text"
                name="fax"
                value={formData.fax}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                E-Mail
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="text"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://www.example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Bankverbindung */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-center mb-4">
            <BanknotesIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Bankverbindung</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank
              </label>
              <input
                type="text"
                name="bank_name"
                value={formData.bank_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IBAN
              </label>
              <input
                type="text"
                name="iban"
                value={formData.iban}
                onChange={handleChange}
                placeholder="DE89 3704 0044 0532 0130 00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                BIC
              </label>
              <input
                type="text"
                name="bic"
                value={formData.bic}
                onChange={handleChange}
                placeholder="COBADEFFXXX"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Rechtliche Informationen */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-center mb-4">
            <DocumentTextIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Rechtliche Informationen</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Geschäftsführer
              </label>
              {managingDirectors.map((director, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={director}
                    onChange={(e) => {
                      const newDirectors = [...managingDirectors];
                      newDirectors[index] = e.target.value;
                      setManagingDirectors(newDirectors);
                    }}
                    placeholder={`Geschäftsführer ${index + 1}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {managingDirectors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newDirectors = managingDirectors.filter((_, i) => i !== index);
                        setManagingDirectors(newDirectors);
                      }}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 border border-red-300 rounded-md"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setManagingDirectors([...managingDirectors, ''])}
                className="mt-2 flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 border border-blue-300 rounded-md"
              >
                <PlusIcon className="h-5 w-5" />
                Weiteren Geschäftsführer hinzufügen
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Handelsregister
              </label>
              <input
                type="text"
                name="commercial_register"
                value={formData.commercial_register}
                onChange={handleChange}
                placeholder="HRB 12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registergericht
              </label>
              <input
                type="text"
                name="register_court"
                value={formData.register_court}
                onChange={handleChange}
                placeholder="Amtsgericht Musterstadt"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Steuernummer
              </label>
              <input
                type="text"
                name="tax_number"
                value={formData.tax_number}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                USt-IdNr.
              </label>
              <input
                type="text"
                name="vat_id"
                value={formData.vat_id}
                onChange={handleChange}
                placeholder="DE123456789"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Geschäftsjahr Einstellungen */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex items-center mb-4">
            <DocumentTextIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Geschäftsjahr</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Startmonat *
              </label>
              <select
                name="fiscal_year_start_month"
                value={formData.fiscal_year_start_month}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">Januar</option>
                <option value="2">Februar</option>
                <option value="3">März</option>
                <option value="4">April</option>
                <option value="5">Mai</option>
                <option value="6">Juni</option>
                <option value="7">Juli</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">Oktober</option>
                <option value="11">November</option>
                <option value="12">Dezember</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Monat, in dem das Geschäftsjahr beginnt
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Starttag *
              </label>
              <input
                type="number"
                name="fiscal_year_start_day"
                value={formData.fiscal_year_start_day}
                onChange={handleChange}
                min="1"
                max="31"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Tag, an dem das Geschäftsjahr beginnt (1-31)
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Beispiel:</strong> Wenn das Geschäftsjahr am 1. April beginnt, wird das Jahr 2025/2026 vom 01.04.2025 bis 31.03.2026 laufen.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CompanyInfo;
