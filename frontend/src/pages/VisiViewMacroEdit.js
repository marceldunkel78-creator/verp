import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  CodeBracketIcon,
  ArrowLeftIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  XMarkIcon,
  LinkIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'released', label: 'Freigegeben' },
  { value: 'deprecated', label: 'Veraltet' }
];

const VisiViewMacroEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    author_user: null,
    visiview_version: '',
    purpose: '',
    usage: '',
    code: '',
    keywords: '',
    category: '',
    status: 'new',
    changelog: '',
    dependencies: []
  });

  // Related data
  const [macro, setMacro] = useState(null);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allMacros, setAllMacros] = useState([]);
  const [exampleImages, setExampleImages] = useState([]);

  // Dependency search
  const [dependencySearch, setDependencySearch] = useState('');
  const [showDependencyDropdown, setShowDependencyDropdown] = useState(false);
  const [dependencySuggestions, setDependencySuggestions] = useState(null);
  const [dependencySearching, setDependencySearching] = useState(false);

  // Changelog entry
  const [newChangelogEntry, setNewChangelogEntry] = useState({
    version: '',
    description: ''
  });

  // Fetch macro data
  const fetchMacro = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const response = await api.get(`/visiview/macros/${id}/`);
      setMacro(response.data);
      setFormData({
        title: response.data.title || '',
        author: response.data.author || '',
        author_user: response.data.author_user || null,
        visiview_version: response.data.visiview_version || '',
        purpose: response.data.purpose || '',
        usage: response.data.usage || '',
        code: response.data.code || '',
        keywords: response.data.keywords || '',
        category: response.data.category || '',
        status: response.data.status || 'new',
        changelog: response.data.changelog || '',
        dependencies: response.data.dependencies || []
      });
      setExampleImages(response.data.example_images || []);
    } catch (err) {
      console.error('Error fetching macro:', err);
      setError('Fehler beim Laden des Macros');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/users/');
      const userData = response.data.results || response.data || [];
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/visiview/macros/categories/');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  // Fetch all macros for dependencies (handles paginated API)
  const fetchAllMacros = useCallback(async () => {
    try {
      let all = [];
      let page = 1;
      while (true) {
        const response = await api.get(`/visiview/macros/?page_size=100&page=${page}`);
        const data = response.data;
        const results = data.results || data || [];
        if (Array.isArray(results)) {
          all = all.concat(results);
        }
        // If API is paginated it returns a `next` field
        if (!data.next) break;
        page += 1;
      }
      setAllMacros(all.filter(m => m.id !== (id ? parseInt(id) : null)));
    } catch (error) {
      console.error('Error fetching macros:', error);
    }
  }, [id]);

  useEffect(() => {
    fetchMacro();
    fetchUsers();
    fetchCategories();
    fetchAllMacros();
  }, [fetchMacro, fetchUsers, fetchCategories, fetchAllMacros]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        author_user: formData.author_user || null
      };

      if (isNew) {
        const response = await api.post('/visiview/macros/', payload);
        navigate(`/visiview/macros/${response.data.id}`);
      } else {
        await api.patch(`/visiview/macros/${id}/`, payload);
        fetchMacro();
      }
    } catch (err) {
      console.error('Error saving macro:', err);
      setError('Fehler beim Speichern: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Möchten Sie dieses Macro wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/visiview/macros/${id}/`);
      navigate('/visiview/macros');
    } catch (err) {
      console.error('Error deleting macro:', err);
      setError('Fehler beim Löschen: ' + (err.response?.data?.detail || err.message));
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await api.get(`/visiview/macros/${id}/download/`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', macro?.filename || 'macro.txt');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading macro:', error);
    }
  };

  const handleDownloadWithDeps = async () => {
    try {
      const response = await api.get(`/visiview/macros/${id}/download_with_dependencies/`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${macro?.macro_id}_with_dependencies.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading macro with dependencies:', error);
    }
  };

  // Dependency management
  const addDependency = (depMacro) => {
    if (!formData.dependencies.includes(depMacro.id)) {
      setFormData(prev => ({
        ...prev,
        dependencies: [...prev.dependencies, depMacro.id]
      }));
    }
    setDependencySearch('');
    setShowDependencyDropdown(false);
  };

  const removeDependency = (depId) => {
    setFormData(prev => ({
      ...prev,
      dependencies: prev.dependencies.filter(d => d !== depId)
    }));
  };

  const filteredMacros = allMacros.filter(m => 
    !formData.dependencies.includes(m.id) &&
    (m.macro_id?.toLowerCase().includes(dependencySearch.toLowerCase()) ||
     m.title?.toLowerCase().includes(dependencySearch.toLowerCase()))
  );

  // Server-side search for dependencies (debounced)
  useEffect(() => {
    let timer;
    if (dependencySearch && dependencySearch.length >= 2) {
      setDependencySearching(true);
      timer = setTimeout(async () => {
        try {
          const response = await api.get(`/visiview/macros/?search=${encodeURIComponent(dependencySearch)}&page_size=100`);
          const results = response.data.results || response.data || [];
          setDependencySuggestions((Array.isArray(results) ? results : []).filter(m => m.id !== (id ? parseInt(id) : null) && !formData.dependencies.includes(m.id)));
        } catch (err) {
          console.error('Error searching macros:', err);
          setDependencySuggestions([]);
        } finally {
          setDependencySearching(false);
        }
      }, 300);
    } else {
      setDependencySuggestions(null);
    }
    return () => clearTimeout(timer);
  }, [dependencySearch, id, formData.dependencies]);

  const getDependencyInfo = (depId) => {
    return allMacros.find(m => m.id === depId) || 
           macro?.dependencies_list?.find(d => d.id === depId);
  };

  // Add changelog entry
  const addChangelogEntry = async () => {
    if (!newChangelogEntry.description) return;
    try {
      await api.post('/visiview/macro-changelog/', {
        macro: id,
        version: newChangelogEntry.version,
        description: newChangelogEntry.description
      });
      setNewChangelogEntry({ version: '', description: '' });
      fetchMacro();
    } catch (err) {
      console.error('Error adding changelog entry:', err);
    }
  };

  // Image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('macro', id);
    formDataUpload.append('image', file);
    formDataUpload.append('description', file.name);

    try {
      await api.post('/visiview/macro-images/', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchMacro();
    } catch (err) {
      console.error('Error uploading image:', err);
    }
  };

  const deleteImage = async (imageId) => {
    if (!window.confirm('Bild löschen?')) return;
    try {
      await api.delete(`/visiview/macro-images/${imageId}/`);
      fetchMacro();
    } catch (err) {
      console.error('Error deleting image:', err);
    }
  };

  // Get line numbers for code editor
  const getLineNumbers = () => {
    const lines = (formData.code || '').split('\n');
    return lines.map((_, i) => i + 1).join('\n');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-500">Lade Macro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/visiview/macros')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CodeBracketIcon className="h-7 w-7 text-indigo-600" />
              {isNew ? 'Neues Macro' : `${macro?.macro_id} - ${macro?.title}`}
            </h1>
            {!isNew && (
              <p className="text-sm text-gray-500">
                Erstellt: {macro?.created_at ? new Date(macro.created_at).toLocaleDateString('de-DE') : '-'}
                {macro?.updated_at && ` • Aktualisiert: ${new Date(macro.updated_at).toLocaleDateString('de-DE')}`}
              </p>
            )}
          </div>
        </div>

        {!isNew && (
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
              Download
            </button>
            {formData.dependencies.length > 0 && (
              <button
                onClick={handleDownloadWithDeps}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Mit Abhängigkeiten
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Grundinformationen</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titel *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Autor
              </label>
              <input
                type="text"
                name="author"
                value={formData.author}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Autor (User)
              </label>
              <select
                name="author_user"
                value={formData.author_user || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  author_user: e.target.value ? parseInt(e.target.value) : null 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">-- Kein User --</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                VisiView Version
              </label>
              <input
                type="text"
                name="visiview_version"
                value={formData.visiview_version}
                onChange={handleChange}
                placeholder="z.B. VV 7.0.0.10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategorie
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                list="categories-list"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <datalist id="categories-list">
                {categories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Keywords (kommasepariert)
              </label>
              <input
                type="text"
                name="keywords"
                value={formData.keywords}
                onChange={handleChange}
                placeholder="Focus, Stage, Acquisition, ..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Purpose and Usage */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Beschreibung</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zweck (Purpose)
              </label>
              <textarea
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                rows={3}
                placeholder="Wofür ist das Macro gut?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anwendung (Usage)
              </label>
              <textarea
                name="usage"
                value={formData.usage}
                onChange={handleChange}
                rows={4}
                placeholder="Schritt-für-Schritt Anleitung zur Anwendung des Macros..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Code Editor */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Macro Code</h2>
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <div className="flex bg-gray-800">
              {/* Line Numbers */}
              <div className="bg-gray-700 text-gray-400 text-sm font-mono py-3 px-3 text-right select-none border-r border-gray-600 min-w-[50px]">
                <pre>{getLineNumbers()}</pre>
              </div>
              {/* Code Area */}
              <textarea
                name="code"
                value={formData.code}
                onChange={handleChange}
                rows={20}
                className="flex-1 bg-gray-900 text-green-400 font-mono text-sm p-3 resize-none focus:outline-none"
                style={{ 
                  tabSize: 4,
                  lineHeight: '1.5'
                }}
                placeholder="# Python Macro Code hier eingeben..."
                spellCheck={false}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Python-Code für VisiView. Verwende Tab für Einrückungen.
          </p>
        </div>

        {/* Dependencies */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Abhängigkeiten
          </h2>
          
          {/* Current Dependencies */}
          <div className="mb-4">
            {formData.dependencies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {formData.dependencies.map(depId => {
                  const depInfo = getDependencyInfo(depId);
                  return (
                    <span
                      key={depId}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full"
                    >
                      <span className="font-medium">{depInfo?.macro_id || depId}</span>
                      {depInfo?.title && <span className="text-sm">- {depInfo.title}</span>}
                      <button
                        type="button"
                        onClick={() => removeDependency(depId)}
                        className="hover:text-red-600"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Keine Abhängigkeiten definiert</p>
            )}
          </div>

          {/* Add Dependency */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Abhängigkeit hinzufügen
            </label>
            <input
              type="text"
              value={dependencySearch}
              onChange={(e) => {
                setDependencySearch(e.target.value);
                setShowDependencyDropdown(true);
              }}
              onFocus={() => setShowDependencyDropdown(true)}
              placeholder="Macro-ID oder Titel suchen..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {showDependencyDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                {dependencySearching ? (
                  <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    Suchen...
                  </div>
                ) : null}

                {(!dependencySearching) && (() => {
                  const items = dependencySuggestions !== null ? dependencySuggestions : filteredMacros;
                  if (!items || items.length === 0) {
                    return <div className="px-4 py-2 text-gray-500">Keine Macros gefunden</div>;
                  }
                  return items.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => addDependency(m)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                    >
                      <span className="font-medium text-indigo-600">{m.macro_id}</span>
                      <span className="text-gray-700">{m.title}</span>
                    </button>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Example Images (only for existing macros) */}
        {!isNew && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PhotoIcon className="h-5 w-5" />
              Beispielbilder
            </h2>
            
            {/* Current Images */}
            {exampleImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {exampleImages.map(img => (
                  <div key={img.id} className="relative group">
                    <img
                      src={img.image}
                      alt={img.description}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => deleteImage(img.id)}
                      className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                    <p className="text-xs text-gray-500 mt-1 truncate">{img.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bild hochladen
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Changelog (only for existing macros) */}
        {!isNew && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Changelog</h2>
            
            {/* Text field for inline changelog */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Changelog (Freitext)
              </label>
              <textarea
                name="changelog"
                value={formData.changelog}
                onChange={handleChange}
                rows={4}
                placeholder="Änderungshistorie..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Structured changelog entries */}
            {macro?.change_logs && macro.change_logs.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Änderungsprotokoll</h3>
                <div className="space-y-2">
                  {macro.change_logs.map(log => (
                    <div key={log.id} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          {log.version && (
                            <span className="font-medium text-indigo-600 mr-2">{log.version}</span>
                          )}
                          <span className="text-gray-700">{log.description}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(log.changed_at).toLocaleDateString('de-DE')}
                          {log.changed_by_name && ` • ${log.changed_by_name}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add new changelog entry */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Neuen Eintrag hinzufügen</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newChangelogEntry.version}
                  onChange={(e) => setNewChangelogEntry(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="Version (optional)"
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="text"
                  value={newChangelogEntry.description}
                  onChange={(e) => setNewChangelogEntry(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Beschreibung der Änderung..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={addChangelogEntry}
                  disabled={!newChangelogEntry.description}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  <PlusIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center">
          <div>
            {!isNew && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <TrashIcon className="h-5 w-5 mr-2" />
                {deleting ? 'Lösche...' : 'Löschen'}
              </button>
            )}
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/visiview/macros')}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Speichere...' : isNew ? 'Erstellen' : 'Speichern'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default VisiViewMacroEdit;
