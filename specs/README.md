# HR-Schema Spezifikation für Deutschland

Dieses Verzeichnis enthält JSON-Schema-Spezifikationen für HR-Datenfelder in einer Mitarbeiterverwaltungs-App, zugeschnitten auf deutsche Gesetze (DSGVO, HGB, AO).

## Dateien

- `hr_schema.minimal.json`: Minimalset für produktiven Einsatz. Enthält Pflichtfelder für Personalakte und Payroll. Nicht-sensible Daten.
- `hr_schema.gdpr_extensions.json`: Optionale GDPR-sensible Erweiterungen. Standardmäßig deaktiviert (Feature-Flag `gdpr_sensitive_enabled: false`).

## Implementierungshinweise

### Verschlüsselung
- Sensible Felder (`gdpr_sensitive: true`) müssen at-rest und in-transit verschlüsselt werden (z. B. AES-256).
- Besondere Kategorien (`special_category: true`) erfordern zusätzliche Schutzmaßnahmen (z. B. separate Datenbanktabellen).

### Zugriffsrechte (RBAC)
- Verwende `access_roles` als Default-Rollen (z. B. "hr", "payroll", "manager", "medical", "security").
- Implementiere rollenbasierte Zugriffssteuerung; sensible Felder nur für berechtigte Rollen sichtbar.
- Audit-Logging für alle Zugriffe auf sensible Daten.

### Aufbewahrungsfristen
- **Allgemein**: 10 Jahre nach Ende des Beschäftigungsverhältnisses (handels-/steuerrechtlich, § 257 HGB, § 147 AO).
- **Persönliche Daten**: 2 Jahre nach Ende, falls nicht steuerlich relevant.
- **Sensible Daten**: Nur solange erforderlich; automatische Lösch-/Archivierungs-Workflows implementieren.
- **Besondere Kategorien**: Strengere Regeln; Prüfung durch Datenschutzbeauftragten; Löschung bei Widerruf der Einwilligung.

### Validierung
- Verwende die `validation`-Strings für Regex und Constraints.
- Implementiere serverseitige Validierung; clientseitig als Hilfestellung.

### Feature-Flags
- Sensitive Felder standardmäßig deaktiviert; nur aktivieren nach Rechtsprüfung und Einwilligung.
- In der App-Konfiguration prüfen: `if gdpr_sensitive_enabled then merge schemas`.

### Integrationen
- Payroll: Übertrage nur notwendige Felder (z. B. via API/SCIM).
- SSO/Identity: Verwende für Authentifizierung, nicht für Datenhaltung.
- Dokumente: Datei-Uploads verschlüsselt speichern; Hashes für Integrität.

### Rechtliche Hinweise
- Einwilligungen dokumentieren (z. B. separates Feld `consent_log`).
- DSGVO-Rechte unterstützen: Auskunft, Berichtigung, Löschung, Einschränkung.
- Regelmäßige Datenschutz-Folgenabschätzung durchführen.

## Version
- Aktuell: 1.0.0
- Land: DE
- Schema: JSON Schema Draft-07

Für Fragen oder Anpassungen: Konsultiere Datenschutzbeauftragten.