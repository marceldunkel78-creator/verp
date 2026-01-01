import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import {
  FolderIcon,
  DocumentIcon,
  PhotoIcon,
  FilmIcon,
  MusicalNoteIcon,
  DocumentTextIcon,
  TableCellsIcon,
  ArrowLeftIcon,
  HomeIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

const Documents = () => {
  const [currentPath, setCurrentPath] = useState('');
  const [currentFolder, setCurrentFolder] = useState(null);
  const [items, setItems] = useState([]);
  const [parentPath, setParentPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  useEffect(() => {
    loadFolder(currentPath);
  }, [currentPath]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadFolder = async (path) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/core/media-browser/browse/', {
        params: { path: path || '' }
      });
      setCurrentFolder(response.data.current_folder);
      setItems(response.data.items);
      setParentPath(response.data.parent_path);
    } catch (err) {
      console.error('Error loading folder:', err);
      setError('Fehler beim Laden des Ordners');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/core/media-browser/stats/');
      setStats(response.data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const handleFolderClick = (folder) => {
    setCurrentPath(folder.path);
  };

  const handleGoUp = () => {
    if (parentPath !== null) {
      setCurrentPath(parentPath);
    }
  };

  const handleGoHome = () => {
    setCurrentPath('');
  };

  const handleDownload = async (file) => {
    try {
      const response = await api.get('/core/media-browser/download/', {
        params: { path: file.path },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
      alert('Fehler beim Herunterladen der Datei');
    }
  };

  const handleView = (file) => {
    setSelectedFile(file);
  };

  const closePreview = () => {
    setSelectedFile(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('de-DE');
  };

  const getFileIcon = (item) => {
    if (item.type === 'folder') {
      return <FolderIcon className="h-12 w-12 text-yellow-500" />;
    }

    switch (item.file_type) {
      case 'image':
        return <PhotoIcon className="h-12 w-12 text-blue-500" />;
      case 'video':
        return <FilmIcon className="h-12 w-12 text-purple-500" />;
      case 'audio':
        return <MusicalNoteIcon className="h-12 w-12 text-pink-500" />;
      case 'pdf':
        return <DocumentTextIcon className="h-12 w-12 text-red-500" />;
      case 'document':
        return <DocumentTextIcon className="h-12 w-12 text-blue-600" />;
      case 'spreadsheet':
        return <TableCellsIcon className="h-12 w-12 text-green-600" />;
      default:
        return <DocumentIcon className="h-12 w-12 text-gray-500" />;
    }
  };

  const getBreadcrumbs = () => {
    if (!currentPath) return [];
    const parts = currentPath.split('/').filter(p => p);
    const breadcrumbs = [];
    let path = '';
    
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      breadcrumbs.push({ name: part, path: path });
    }
    
    return breadcrumbs;
  };

  if (loading && !currentFolder) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <nav className="text-sm text-gray-500 mb-2">
          <Link to="/" className="hover:text-gray-700">Dashboard</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Dokumente</span>
        </nav>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <DocumentIcon className="h-8 w-8 mr-3 text-green-600" />
              Dokumentenverwaltung
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              VERP Media-Struktur durchsuchen und verwalten
            </p>
          </div>
          <button
            onClick={() => setShowStats(!showStats)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ChartBarIcon className="h-5 w-5 mr-2" />
            Statistiken
          </button>
        </div>
      </div>

      {/* Statistics Panel */}
      {showStats && stats && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Speicher-Statistiken</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Gesamtgröße</div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.total_size_gb > 1 
                  ? `${stats.total_size_gb} GB` 
                  : `${stats.total_size_mb} MB`}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Dateien</div>
              <div className="text-2xl font-bold text-green-600">{stats.file_count.toLocaleString('de-DE')}</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Ordner</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.folder_count.toLocaleString('de-DE')}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600">Top Dateityp</div>
              <div className="text-2xl font-bold text-purple-600">
                {stats.top_file_types.length > 0 ? stats.top_file_types[0].extension : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="flex items-center space-x-2 text-sm">
          <button
            onClick={handleGoHome}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <HomeIcon className="h-5 w-5" />
          </button>
          {getBreadcrumbs().map((crumb, index) => (
            <React.Fragment key={index}>
              <span className="text-gray-400">/</span>
              <button
                onClick={() => setCurrentPath(crumb.path)}
                className="text-gray-600 hover:text-gray-900 hover:underline"
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
          {parentPath !== null && (
            <button
              onClick={handleGoUp}
              className="ml-auto inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Zurück
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Items Grid */}
      <div className="bg-white shadow rounded-lg p-6">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <FolderIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Dieser Ordner ist leer</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {items.map((item, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => item.type === 'folder' ? handleFolderClick(item) : handleView(item)}
              >
                <div className="flex flex-col items-center">
                  {getFileIcon(item)}
                  <div className="mt-2 text-sm font-medium text-gray-900 text-center truncate w-full">
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {item.type === 'folder' 
                      ? `${item.item_count} Items` 
                      : formatFileSize(item.size)}
                  </div>
                </div>
                {item.type === 'file' && (
                  <div className="mt-2 flex justify-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(item);
                      }}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Anzeigen"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(item);
                      }}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                      title="Herunterladen"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedFile.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatFileSize(selectedFile.size)} • {formatDate(selectedFile.modified)}
                  </p>
                </div>
                <button
                  onClick={closePreview}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              {selectedFile.file_type === 'image' && (
                <img
                  src={`${api.defaults.baseURL}/core/media-browser/view/?path=${encodeURIComponent(selectedFile.path)}`}
                  alt={selectedFile.name}
                  className="max-w-full h-auto mx-auto"
                />
              )}
              {selectedFile.file_type === 'pdf' && (
                <iframe
                  src={`${api.defaults.baseURL}/core/media-browser/view/?path=${encodeURIComponent(selectedFile.path)}`}
                  className="w-full h-[600px] border-0"
                  title={selectedFile.name}
                />
              )}
              {selectedFile.file_type === 'text' && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Textdatei-Vorschau wird geladen...</p>
                </div>
              )}
              {!['image', 'pdf', 'text'].includes(selectedFile.file_type) && (
                <div className="text-center py-8">
                  {getFileIcon(selectedFile)}
                  <p className="mt-4 text-gray-600">Vorschau für diesen Dateityp nicht verfügbar</p>
                  <button
                    onClick={() => handleDownload(selectedFile)}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                  >
                    <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                    Herunterladen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;
