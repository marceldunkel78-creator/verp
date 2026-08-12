import React from 'react';

/**
 * Zeigt HTML-Notizen read-only an.
 * Wird für die Detailansicht / PDF-Vorschau verwendet.
 *
 * Erwartet bereits bereinigtes HTML (serverseitig via bleach).
 */
const NotesDisplay = ({ html, fallback = '', className = '' }) => {
  const content = (html && html.trim()) || fallback;
  if (!content) {
    return (
      <p className="text-sm text-gray-400 italic">Keine Notizen vorhanden.</p>
    );
  }
  return (
    <div
      className={
        'prose prose-sm max-w-none text-gray-800 ' + className
      }
      // Server hat HTML bereits mit bleach bereinigt; das ist vertrauenswürdig.
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default NotesDisplay;