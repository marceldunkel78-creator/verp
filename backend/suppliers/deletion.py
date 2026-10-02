"""
Lieferanten-Loeschlogik: Verknuepfungen pruefen, umhaengen, dann loeschen.

Hintergrund
------------
Der Excel-Lagerabgleich (`sync_inventory_from_excel`) legte Lieferanten an, indem
er per `company_name__icontains` suchte und sonst neu erzeugte. Dadurch
existieren fuer dieselbe Firma mehrere Eintraege, z. B. "Excelitas-PCO" (Nr. 100)
und "100 - Excelitas-PCO" (Nr. 229). Beim Aufraeumen soll der Duplikat-Lieferant
geloescht und seine Daten auf den richtigen Lieferanten umgehaengt werden.

Warum nicht einfach `supplier.delete()`:
- `InventoryItem`, `Order`, `Loan`, `IncomingGoods` und `ProductCollection`
  nutzen `on_delete=PROTECT` -> der Loeschvorgang bricht hart ab.
- `CustomerOrderItem`, `RMACase` (manufacturer) und `SalesPriceList` nutzen
  `SET_NULL` -> die Verknuepfung verschwindet STILLSCHWEIGEND, es bliebe kein
  Hinweis und kein Rueckweg.
- `TradingProduct.visitron_part_number` und `MaterialSupply.visitron_part_number`
  sind `unique` und aus der Lieferantennummer aufgebaut (`229-00001`, `229-M00001`).
- `ProductGroup` hat `unique_together = ('supplier', 'name')` und `SupplierProduct`
  `unique_together = ('supplier', 'product')` -> beim Umhaengen drohen Kollisionen.

Beide Betriebsarten sind hier zusammengefasst und transaktional abgesichert:
  * MIT   `reassign_to`  -> alle Verknuepfungen wandern auf den Ziel-Lieferanten.
  * OHNE  `reassign_to`  -> nur eigene Daten (CASCADE) werden geloescht.
                             Externe Verknuepfungen blockieren mit einer
                             verstaendlichen Meldung statt mit einem Traceback.
"""

import logging

from django.apps import apps
from django.db import transaction

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Verknuepfungs-Register
# ---------------------------------------------------------------------------
# `owned`   : Datensatz gehoert dem Lieferanten (CASCADE) -> kann mitverschoben
#             oder beim Loeschen mit entfernt werden.
# `blocker` : True  = PROTECT, das Loeschen bricht ohne Umhaengen ab.
#             False = SET_NULL, das Loeschen wuerde die Verknuepfung still loeschen.
#
# Reihenfolge = Reihenfolge des Umhaengens. Eigene Modelle zuerst, damit die
# `unique_together`-Pruefungen spaeter auf bereits bereinigten Daten laufen.

LINK_GROUPS = [
    # --- eigene Daten (CASCADE) ---
    {
        'key': 'contacts',
        'label': 'Lieferanten-Kontakte',
        'model': 'suppliers.SupplierContact',
        'field': 'supplier',
        'owned': True,
        'blocker': False,
        'merge': 'delete',
    },
    {
        'key': 'product_groups',
        'label': 'Warengruppen',
        'model': 'suppliers.ProductGroup',
        'field': 'supplier',
        'owned': True,
        'blocker': False,
        'merge': 'delete',
    },
    {
        'key': 'price_lists',
        'label': 'Preislisten',
        'model': 'suppliers.PriceList',
        'field': 'supplier',
        'owned': True,
        'blocker': False,
        'merge': None,
    },
    {
        'key': 'attachments',
        'label': 'Lieferanten-Anhaenge',
        'model': 'suppliers.SupplierAttachment',
        'field': 'supplier',
        'owned': True,
        'blocker': False,
        'merge': None,
    },
    {
        'key': 'supplier_products',
        'label': 'Lieferanten-Produkt-Verknuepfungen',
        'model': 'suppliers.SupplierProduct',
        'field': 'supplier',
        'owned': True,
        'blocker': False,
        'merge': 'delete',
    },
    {
        'key': 'trading_products',
        'label': 'Handelswaren',
        'model': 'suppliers.TradingProduct',
        'field': 'supplier',
        'owned': True,
        'blocker': False,
        'merge': None,
        'renumber': 'trading',
    },
    {
        'key': 'material_supplies',
        'label': 'Material & Supplies',
        'model': 'suppliers.MaterialSupply',
        'field': 'supplier',
        'owned': True,
        'blocker': False,
        'merge': None,
        'renumber': 'material',
    },
    # --- fremde Daten (PROTECT) ---
    {
        'key': 'inventory_items',
        'label': 'Lagerartikel',
        'model': 'inventory.InventoryItem',
        'field': 'supplier',
        'owned': False,
        'blocker': True,
        'merge': None,
        'sample': 'inventory_number',
    },
    {
        'key': 'orders',
        'label': 'Bestellungen',
        'model': 'orders.Order',
        'field': 'supplier',
        'owned': False,
        'blocker': True,
        'merge': None,
        'sample': 'order_number',
    },
    {
        'key': 'loans',
        'label': 'Leihungen',
        'model': 'loans.Loan',
        'field': 'supplier',
        'owned': False,
        'blocker': True,
        'merge': None,
        'sample': 'loan_number',
    },
    {
        'key': 'incoming_goods',
        'label': 'Wareneingaenge',
        'model': 'inventory.IncomingGoods',
        'field': 'supplier',
        'owned': False,
        'blocker': True,
        'merge': None,
        'sample': 'article_number',
    },
    {
        'key': 'product_collections',
        'label': 'Warensammlungen',
        'model': 'procurement.ProductCollection',
        'field': 'supplier',
        'owned': False,
        'blocker': True,
        'merge': None,
        'sample': 'collection_number',
    },
    # --- fremde Daten (SET_NULL) ---
    {
        'key': 'customer_order_items',
        'label': 'Auftragspositionen (Kundenauftrag)',
        'model': 'customer_orders.CustomerOrderItem',
        'field': 'supplier',
        'owned': False,
        'blocker': False,
        'merge': None,
        'sample': 'article_number',
    },
    {
        'key': 'rma_manufacturer_cases',
        'label': 'RMA-Faelle (Hersteller)',
        'model': 'service.RMACase',
        'field': 'manufacturer',
        'owned': False,
        'blocker': False,
        'merge': None,
        'sample': 'rma_number',
    },
    {
        'key': 'sales_pricelists',
        'label': 'Verkaufs-Preislisten',
        'model': 'pricelists.SalesPriceList',
        'field': 'supplier',
        'owned': False,
        'blocker': False,
        'merge': None,
    },
    {
        'key': 'combined_pricelists',
        'label': 'Verkaufs-Preislisten (Combined)',
        'model': 'pricelists.SalesPriceList',
        'field': 'trading_supplier',
        'owned': False,
        'blocker': False,
        'merge': None,
    },
]

# Nur diese Gruppen brauchen im UI zwingend eine Zahl (Kachel / Liste).
HEADLINE_KEYS = ['inventory_items', 'orders']


def _model_for(spec):
    return apps.get_model(spec['model'])


# ---------------------------------------------------------------------------
# Bestandsaufnahme
# ---------------------------------------------------------------------------

def get_link_counts(supplier):
    """Zaehlt alle Verknuepfungen eines Lieferanten.

    Liefert ein Dict ``{key: {'label', 'count', 'owned', 'blocker'}}``.
    Wird fuer die Kachel-Anzeige und die Loeschvorschau benutzt.
    """
    counts = {}
    for spec in LINK_GROUPS:
        Model = _model_for(spec)
        counts[spec['key']] = {
            'label': spec['label'],
            'count': Model.objects.filter(**{spec['field']: supplier}).count(),
            'owned': spec['owned'],
            'blocker': spec['blocker'],
        }
    return counts


def get_headline_counts(supplier):
    """Nur die Kennzahlen fuer die Kachel: Lagerartikel + Bestellungen."""
    counts = get_link_counts(supplier)
    return {key: counts[key]['count'] for key in HEADLINE_KEYS}


def get_link_summary(supplier, sample_limit=5):
    """
    Vollstaendige Verknuepfungsuebersicht inkl. Beispiel-Eintraegen.

    Wird von der Loeschen-Bestaetigung im UI angezeigt, damit vor dem
    Loeschen klar ist, WAS genau betroffen ist.
    """
    summary = []
    for spec in LINK_GROUPS:
        Model = _model_for(spec)
        qs = Model.objects.filter(**{spec['field']: supplier})
        entry = {
            'key': spec['key'],
            'label': spec['label'],
            'count': qs.count(),
            'owned': spec['owned'],
            'blocker': spec['blocker'],
            'sample_field': spec.get('sample'),
            'samples': [],
        }
        if entry['count'] and spec.get('sample') and sample_limit:
            entry['samples'] = [
                str(getattr(obj, spec['sample']) or obj.pk)
                for obj in qs.only('pk', spec['sample'])[:sample_limit]
            ]
        summary.append(entry)
    return summary


def describe_supplier(supplier):
    """Einzeilige, eindeutige Beschreibung fuer Log- und Fehlermeldungen."""
    return f'{supplier.supplier_number or "?"} / ID {supplier.pk} / {supplier.company_name}'


def get_blocking_links(supplier):
    """
    Verknuepfungen, die ein Loeschen ohne Umhaengen verhindern bzw. still
    verloeren wuerden. Ist die Liste leer, ist der Lieferant gefahrlos loeschbar.
    """
    blocked = []
    for spec in LINK_GROUPS:
        if spec['owned']:
            continue  # CASCADE -> wird mitgeloescht
        Model = _model_for(spec)
        count = Model.objects.filter(**{spec['field']: supplier}).count()
        if count:
            blocked.append({
                'key': spec['key'],
                'label': spec['label'],
                'count': count,
                'protected': spec['blocker'],
            })
    return blocked


def find_duplicates(supplier):
    """
    Lieferanten, die nach normalisierter Firmenbezeichnung als gleich gelten.

    Hilft beim Aufraeumen: bevor man loescht, sieht man, dass z. B. "100 - X"
    neben "X" existiert. Nur ein Hinweis - es wird nichts automatisch getan.
    """
    from .models import Supplier

    def normalize(name):
        value = (name or '').lower()
        for prefix in ('100 - ', '100-'):
            if value.startswith(prefix):
                value = value[len(prefix):]
        return ' '.join(value.split())

    key = normalize(supplier.company_name)
    if not key:
        return []

    candidates = Supplier.objects.exclude(pk=supplier.pk)
    matches = []
    for other in candidates.only('id', 'supplier_number', 'company_name', 'is_active'):
        if normalize(other.company_name) == key:
            matches.append({
                'id': other.id,
                'supplier_number': other.supplier_number,
                'company_name': other.company_name,
                'is_active': other.is_active,
            })
    return matches


# ---------------------------------------------------------------------------
# Umhaengen
# ---------------------------------------------------------------------------

def _expected_prefix(kind, supplier):
    """Praefix, den `visitron_part_number` beim Ziel-Lieferanten bekommen soll."""
    if not supplier or not supplier.supplier_number:
        return None
    return f'{supplier.supplier_number}-M' if kind == 'material' else f'{supplier.supplier_number}-'


def _renumber_products(objs, kind, target):
    """
    Vergibt `visitron_part_number` neu, passend zum Ziel-Lieferanten.

    Hintergrund: Das Feld ist `unique` und wird aus der Lieferantennummer
    erzeugt (`229-00001` bzw. `229-M00001`). Beim Umhaengen aendert sich der
    Praefix - ohne Neunummerierung waere die Nummer inhaltlich falsch.

    Nur noetig, wenn die Nummer tatsaechlich vom falschen Lieferanten kommt.
    Sonst bleiben die Nummern unangetastet, weil Bestell- und Angebots-
    dokumente sie im Klartext referenzieren.
    """
    expected = _expected_prefix(kind, target)
    if not expected:
        return []

    changed = []
    for obj in objs:
        old_number = obj.visitron_part_number
        if old_number and old_number.startswith(expected):
            continue  # gehoert schon zum Zielbereich

        original = obj.visitron_part_number
        obj.visitron_part_number = ''
        try:
            # `save()` erzeugt die Nummer neu (Model.save ruft die Generator-Methode auf)
            obj.save(update_fields=['visitron_part_number'])
        except ValueError as exc:
            logger.warning(
                'visitron_part_number nicht neu vergeben (pk=%s): %s', obj.pk, exc,
            )
            obj.visitron_part_number = original
            try:
                obj.save(update_fields=['visitron_part_number'])
            except ValueError:
                pass
            continue

        if obj.visitron_part_number != old_number:
            changed.append({
                'id': obj.pk,
                'old': old_number,
                'new': obj.visitron_part_number,
            })
    return changed


def _reassign_group(spec, source, target, dry_run, renumber=False):
    """
    Haengt eine Verknuepfungsgruppe um.

    Returns: (moved_count, warnings)
    """
    field = spec['field']
    merge = spec.get('merge')
    warnings = []
    Model = _model_for(spec)

    objs = list(Model.objects.filter(**{field: source}))
    if not objs:
        return 0, warnings

    if dry_run:
        # Bei 'delete' pruefen, ob es beim Ziel gleichnamige/einmalige gibt.
        if merge == 'delete':
            collisions = _count_merge_collisions(spec, objs, target)
            if collisions:
                warnings.append(
                    f'{spec["label"]}: {collisions} Eintrag/Eintraege existieren beim '
                    f'Ziellieferanten bereits und werden beim Umhaengen entfernt '
                    f'(Dubletten-Merge).'
                )
        return len(objs), warnings

    if merge == 'delete':
        # Unique-Together-Kollisionen aufloesen, BEVOR die FK umgehaengt wird.
        removed = _merge_collisions(spec, objs, target)
        if removed:
            warnings.append(
                f'{spec["label"]}: {removed} Dublette(n) beim Ziellieferanten entfernt.'
            )
            objs = [o for o in objs if o.pk]

    for obj in objs:
        setattr(obj, field, target)

    if renumber and spec.get('renumber'):
        # Neunummerierung VOR dem FK-Update: `save()` braucht die neue FK,
        # um den korrekten Praefix zu berechnen.
        Model.objects.bulk_update(objs, [field])
        changed = _renumber_products(objs, spec['renumber'], target)
        if changed:
            warnings.append(
                f'{spec["label"]}: {len(changed)} Artikelnummer(n) neu vergeben '
                f'(Praefix des Ziellieferanten).'
            )
        return len(objs), warnings

    if objs:
        Model.objects.bulk_update(objs, [field])
    return len(objs), warnings


def _conflict_field(spec):
    """Feld, an dem `unique_together` haengt (ohne `supplier`)."""
    model = _model_for(spec)
    for constraint in model._meta.total_unique_constraints:
        field_names = [f.name for f in constraint.fields]
        if 'supplier' in field_names and len(field_names) == 2:
            return field_names[1] if field_names[0] == 'supplier' else field_names[0]
    for together in model._meta.unique_together:
        if len(together) == 2 and 'supplier' in together:
            other = [f for f in together if f != 'supplier']
            return other[0] if other else None
    return None


def _count_merge_collisions(spec, objs, target):
    other_field = _conflict_field(spec)
    if not other_field:
        return 0
    values = {getattr(o, other_field) for o in objs}
    Model = _model_for(spec)
    return Model.objects.filter(supplier=target, **{f'{other_field}__in': values}).count()


def _merge_collisions(spec, objs, target):
    """
    Loest `unique_together (supplier, X)`-Kollisionen auf.

    Strategie: der Eintrag des ZIELLieferanten bleibt, der des QUELL-Lieferanten
    wird entfernt. Beim Aufraeumen von Dubletten ist das gewuenscht - die beiden
    Eintraege beschreiben denselben Sachverhalt.
    """
    other_field = _conflict_field(spec)
    if not other_field:
        return 0
    Model = _model_for(spec)
    removed = 0
    for obj in objs:
        value = getattr(obj, other_field)
        exists = Model.objects.filter(supplier=target, **{other_field: value}).exists()
        if exists:
            obj.delete()
            removed += 1
    return removed


# ---------------------------------------------------------------------------
# Aktionen
# ---------------------------------------------------------------------------

def delete_supplier(supplier, reassign_to=None, renumber=False, dry_run=False,
                    confirm=False):
    """
    Loescht einen Lieferanten - optional mit Umhaengen aller Verknuepfungen.

    Args:
        supplier:        zu loeschender ``Supplier``
        reassign_to:    Ziel-``Supplier`` oder None. None = nur eigene Daten
                         (CASCADE) loeschen; externe Verknuepfungen blockieren.
        renumber:        True = `visitron_part_number` der umgehaengten Handelswaren
                         und M&S-Positionen neu vergeben. Default False, weil die
                         Nummern in Bestell-/Angebotsdokumenten zitiert werden.
        dry_run:         True = nur zaehlen und Konflikte melden, nichts aendern.
        confirm:         muss True sein, sonst wird nichts geloescht.

    Returns:
        dict mit ``ok``, ``moved``, ``warnings``, ``deleted`` und ``error``.
    """
    if not confirm:
        return {
            'ok': False,
            'error': 'Loeschen nicht bestaetigt (confirm=True erforderlich).',
            'moved': [],
            'warnings': [],
            'deleted': False,
        }

    if reassign_to is not None and reassign_to.pk == supplier.pk:
        return {
            'ok': False,
            'error': 'Quell- und Ziellieferant sind identisch.',
            'moved': [],
            'warnings': [],
            'deleted': False,
        }

    moved = []
    warnings = []

    def finish(error=None):
        return {
            'ok': error is None,
            'error': error,
            'moved': moved,
            'warnings': warnings,
            'deleted': error is None and not dry_run,
            'dry_run': dry_run,
            'supplier': describe_supplier(supplier),
            'reassigned_to': describe_supplier(reassign_to) if reassign_to else None,
        }

    # ---- Vorschau / Sperrpruefung ohne Umhaengen ----
    if reassign_to is None:
        blocked = get_blocking_links(supplier)
        if blocked and not dry_run:
            listed = ', '.join(f"{b['label']}: {b['count']}" for b in blocked)
            hint = ('Diese Verknuepfungen muessen zuerst umgehaengt werden. '
                    'Alternativ im Admin-Loeschmodul "Verknuepfungen auf anderen '
                    'Lieferanten legen" waehlen.')
            return finish(
                f'Lieferant kann nicht geloescht werden - {listed}. {hint}'
            )

    if dry_run:
        for spec in LINK_GROUPS:
            Model = _model_for(spec)
            count = Model.objects.filter(**{spec['field']: supplier}).count()
            if not count:
                continue
            _, group_warnings = _reassign_group(
                spec, supplier, reassign_to or supplier, dry_run=True,
                renumber=renumber,
            )
            entry = {
                'key': spec['key'],
                'label': spec['label'],
                'count': count,
                'action': 'verschieben' if reassign_to else ('loeschen' if spec['owned'] else 'blockiert'),
            }
            moved.append(entry)
            warnings.extend(group_warnings)
        return finish()

    # ---- Echter Lauf in einer Transaktion ----
    try:
        with transaction.atomic():
            if reassign_to is not None:
                for spec in LINK_GROUPS:
                    count, group_warnings = _reassign_group(
                        spec, supplier, reassign_to, dry_run=False,
                        renumber=renumber,
                    )
                    if count:
                        moved.append({
                            'key': spec['key'],
                            'label': spec['label'],
                            'count': count,
                            'action': 'verschieben',
                        })
                    warnings.extend(group_warnings)

            supplier_number = supplier.supplier_number
            supplier_name = supplier.company_name
            supplier.delete()

            logger.info(
                'Lieferant geloescht: %s (%s) -> %s',
                supplier_name,
                supplier_number,
                f'umgehaengt auf {describe_supplier(reassign_to)}' if reassign_to else 'nur eigene Daten entfernt',
            )
    except Exception as exc:  # ProtectedError u. a.
        logger.error('Loeschen von Lieferant %s fehlgeschlagen: %s',
                     describe_supplier(supplier), exc, exc_info=True)
        detail = getattr(exc, 'protected_objects', None)
        extra = ''
        if detail:
            names = ', '.join(sorted({obj._meta.verbose_name_plural for obj in detail}))
            extra = f' Blockiert durch: {names}.'
        return finish(f'Loeschen fehlgeschlagen: {exc}{extra}')

    return finish()
