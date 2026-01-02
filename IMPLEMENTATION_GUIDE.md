# Implementierungsanleitung: Löschen und Kopieren Buttons

## Zusammenfassung der Änderungen

### 1. Backend - Kategorien ✅ FERTIG
- DIENSTLEISTUNG Kategorie zu ProductCategory CHOICES hinzugefügt
- product_category ForeignKey zu VSHardware Modell hinzugefügt  
- product_category ForeignKey zu VSService Modell hinzugefügt
- VisiView hat bereits product_category Feld
- Migrations erstellt und ausgeführt

### 2. Frontend - Edit-Seiten

#### 2.1 Kategorie-Feld hinzufügen zu VSHardwareEdit.js und VSServiceProductEdit.js

**Zuständige Dateien:**
- frontend/src/pages/VSHardwareEdit.js (Zeile 30-50 im Basisinformationen Tab)
- frontend/src/pages/VSServiceProductEdit.js (Zeile 30-50 im Basisinformationen Tab)

**Hinzufügen:**
```javascript
// Im State nach fetchProduct/fetchCategories:
const [productCategories, setProductCategories] = useState([]);

const fetchCategories = useCallback(async () => {
  try {
    const response = await api.get('/settings/product-categories/?is_active=true');
    setProductCategories(response.data.results || response.data);
  } catch (error) {
    console.error('Error fetching categories:', error);
  }
}, []);

// Im formData:
product_category: null,

// Im fetchProduct:
product_category: data.product_category,

// Im Basic Info Tab Formular:
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Warenkategorie
  </label>
  <select
    value={formData.product_category || ''}
    onChange={(e) => handleInputChange('product_category', e.target.value ? parseInt(e.target.value) : null)}
    className="w-full border border-gray-300 rounded-md px-3 py-2"
  >
    <option value="">Wählen...</option>
    {productCategories.map(cat => (
      <option key={cat.id} value={cat.id}>{cat.name}</option>
    ))}
  </select>
</div>
```

#### 2.2 Löschen-Button zu allen Edit-Seiten hinzufügen

**In allen 3 Edit-Seiten (VSHardwareEdit.js, VisiViewProductEdit.js, VSServiceProductEdit.js):**

```javascript
// Im Header-Bereich neben "Zurück"-Button:
const handleDelete = async () => {
  if (!window.confirm(`Möchten Sie dieses Produkt wirklich löschen?\n\n${product.name}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`)) {
    return;
  }
  
  try {
    // Anpassen je nach Produkt-Typ:
    // VS-Hardware: `/manufacturing/vs-hardware/${id}/`
    // VisiView: `/visiview/products/${id}/`
    // VS-Service: `/service/vs-service/${id}/`
    await api.delete(`/manufacturing/vs-hardware/${id}/`);
    alert('Produkt erfolgreich gelöscht');
    navigate('/manufacturing/vs-hardware'); // Pfad anpassen
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    alert('Fehler beim Löschen des Produkts: ' + (error.response?.data?.detail || error.message));
  }
};

// Im Header JSX:
<div className="flex justify-between items-center mb-6">
  <div className="flex items-center gap-4">
    <button onClick={() => navigate('/manufacturing/vs-hardware')} {...}>
      <ArrowLeftIcon ... />
      Zurück
    </button>
  </div>
  <div className="flex gap-2">
    {id && (
      <button
        onClick={handleDelete}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        <TrashIcon className="h-5 w-5" />
        Löschen
      </button>
    )}
    <button onClick={handleSave} disabled={saving || !hasChanges} {...}>
      Speichern
    </button>
  </div>
</div>
```

#### 2.3 Kopieren-Button zu Kacheln hinzufügen

**In allen 3 Kachel-Ansichten (VSHardware.js, VisiViewProducts.js, VSServiceProducts.js):**

```javascript
// Neue handleCopy Funktion vor dem return Statement:
const handleCopy = async (e, product) => {
  e.stopPropagation();
  
  if (!window.confirm(`Möchten Sie eine Kopie von "${product.name}" erstellen?`)) {
    return;
  }
  
  try {
    // Kopie erstellen ohne ID und mit "Kopie" im Namen
    const copyData = {
      name: `${product.name} (Kopie)`,
      model_designation: product.model_designation,
      description: product.description,
      product_category: product.product_category,
      unit: product.unit,
      is_active: product.is_active
    };
    
    // Anpassen je nach Produkt-Typ:
    const response = await api.post('/manufacturing/vs-hardware/', copyData);
    alert(`Kopie erstellt: ${response.data.part_number}`);
    fetchProducts();
  } catch (error) {
    console.error('Fehler beim Kopieren:', error);
    alert('Fehler beim Erstellen der Kopie: ' + (error.response?.data?.detail || error.message));
  }
};

// Icon import hinzufügen:
import {
  // ... existing imports
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';

// In den Kacheln - NACH dem Bearbeiten-Button:
<div className="flex gap-2 mt-2">
  <button
    onClick={(e) => {
      e.stopPropagation();
      navigate(`/manufacturing/vs-hardware/${product.id}`);
    }}
    className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50"
  >
    <PencilIcon className="h-4 w-4 mr-1" />
    Bearbeiten
  </button>
  <button
    onClick={(e) => handleCopy(e, product)}
    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
    title="Kopie erstellen"
  >
    <DocumentDuplicateIcon className="h-4 w-4" />
  </button>
</div>
```

### 3. Serializer Updates

**Sicherstellen dass die Serializer product_category enthalten:**

```python
# In manufacturing/serializers.py für VSHardwareSerializer:
class VSHardwareSerializer(serializers.ModelSerializer):
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    
    class Meta:
        model = VSHardware
        fields = [
            'id', 'part_number', 'name', 'model_designation', 'description', 'description_en',
            'product_category', 'product_category_name',
            'unit', 'is_active', 'created_at', 'updated_at',
            # ... andere Felder
        ]

# In service/serializers.py für VSServiceSerializer:
class VSServiceSerializer(serializers.ModelSerializer):
    product_category_name = serializers.CharField(source='product_category.name', read_only=True)
    
    class Meta:
        model = VSService
        fields = [
            'id', 'article_number', 'name', 'short_description', 'short_description_en',
            'description', 'description_en', 'product_category', 'product_category_name',
            'unit', 'is_active', 'created_at', 'updated_at',
            # ... andere Felder
        ]
```

### 4. Testing Checkliste

- [ ] VS-Hardware Kategorie-Dropdown funktioniert
- [ ] VS-Service Kategorie-Dropdown funktioniert
- [ ] DIENSTLEISTUNG Kategorie ist in allen Dropdowns sichtbar
- [ ] Löschen-Button auf VSHardwareEdit funktioniert
- [ ] Löschen-Button auf VisiViewProductEdit funktioniert
- [ ] Löschen-Button auf VSServiceProductEdit funktioniert
- [ ] Kopieren-Button auf VS-Hardware Kachel erstellt Kopie
- [ ] Kopieren-Button auf VisiView Kachel erstellt Kopie
- [ ] Kopieren-Button auf VS-Service Kachel erstellt Kopie
- [ ] Neue Artikelnummern werden korrekt generiert bei Kopie

## Hinweise

- **Kategorie-Feld**: Alle 4 Produkttypen (Trading Products, VS-Hardware, VisiView, VS-Service) können nun die gleichen Kategorien verwenden
- **DIENSTLEISTUNG**: Neue Kategorie ist für alle Produkttypen verfügbar
- **Löschen**: Mit Sicherheitsabfrage vor dem Löschen
- **Kopieren**: Erstellt neue Instanz mit neuer Auto-generierter Artikelnummer und " (Kopie)" im Namen
