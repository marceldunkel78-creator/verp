# ============================================================
# LIEFERANTEN AUFRAEUMEN (Dubletten aus dem Lagerimport)
# ============================================================
#
# Stand 2026-10-02.
#
# ---------------------------------------------------------------------------
# 1) WAS DAS PROBLEM WAR
# ---------------------------------------------------------------------------
#
# Der Lager-Sync hat Lieferanten angelegt. Gesucht wurde ueber
# company_name__icontains, und wenn das nichts fand, wurde neu angelegt.
# Die Lagerlisten schreiben denselben Lieferant aber unterschiedlich
# ("Excelitas-PCO", "100 - Excelitas-PCO", "PCO", "Excelitas PCO").
#
# Ergebnis in der Produktion: fuer dieselbe Firma mehrere Eintraege.
# Beispiele aus der Entwicklungsdatenbank:
#
#     Nr. 100  Excelitas-PCO                     (der richtige)
#     Nr. 229  100 - Excelitas-PCO               (Dubletten-Kandidat)
#     Nr. 204  RS-Photometrics
#     Nr. 214  RS-Photometrics/QImaging
#     Nr. 217  RS Photometrics
#     Nr. 216  Teledyne/RS-Photometrics
#     Nr. 213  QImaging
#
# ---------------------------------------------------------------------------
# 2) DIE IRREFUEHRENDE ID IM LOESCHMODUL
# ---------------------------------------------------------------------------
#
# Das war die eigentliche Ausgangsbeschwerde, und sie ist verstaendlich:
#
#     ID              = Datenbank-Primärschluessel (ein reiner Zaehler)
#     supplier_number = dreistellige Lieferantennummer, die auf der Kachel steht
#
# Beide sind Zahlen. Die Suche im Admin-Loeschmodul hat ZUERST die
# Datenbank-ID probiert. Die Lieferantennummer 229 zu eingeben traf daher
# unbemerkt den Lieferant mit der Datenbank-ID 229 - und im Ergebnis stand
# nur "Verknuepfungen vorhanden", kein Name. Man konnte nicht erkennen,
# OB der richtige geloescht wird.
#
# Behoben:
#     - die Vorschau zeigt jetzt den vollen Namen ("Nr. 229 / ID 132 / Name")
#     - die Vorschau nennt, ob ueber die ID oder die Nummer gesucht wurde
#     - wenn beides gleich aussieht, erscheint eine ausdrueckliche Warnbox
#
# ---------------------------------------------------------------------------
# 3) LOESCHEN MIT UMHAENGEN (Oberflaeche)
# ---------------------------------------------------------------------------
#
# Der Loesch-Boten auf der Lieferanten-Kachel ist NUR fuer Admins/Superuser
# sichtbar. Aufruf:
#
#     Admin -> Einkauf -> Lieferanten -> Kachel -> Muell-Eimer
#
# Der Dialog arbeitet in dieser Reihenfolge:
#
#     1. Er laedt die Verknuepfungen und zeigt sie JE ART an:
#            Lagerartikel      612
#            Bestellungen        4
#            Warengruppen       3
#            ...
#        Farblich getrennt:
#            weiss  = gehoert dem Lieferanten (wird mitgeloescht/umgehaengt)
#            gelb   = fremd und blockiert das Loeschen
#        Beispiel-Eintraege stehen dabei (z.B. "I-10665, I-10666, ...")
#
#     2. Ist ueberhaupt etwas verknuepft, fragt er:
#            "Sollen die Verknuepfungen auf einen anderen Lieferanten gelegt
#             werden?"
#        - Nein -> eigenes wird geloescht, der Rest blockiert mit Klartext
#        - Ja  -> Ziellieferant wird gesucht
#
#     3. Bei "Ja" werden gefundene Namensdubletten direkt als Klick-Option
#        angeboten ("Nr. 100 Excelitas-PCO  -> als Ziel waehlen").
#
#     4. "Probelauf" zeigt vorher, was genau passieren wuerde. Er aendert
#        NICHTS.
#
#     5. Bestaetigung durch Tippen:  LÖSCHEN 229
#
# Der Dialog bleibt nach dem Loeschen offen und zeigt, wie viele
# Verknuepfungen umgehaengt wurden. Erst "Schliessen" beendet ihn.
#
# Derselbe Weg geht auch ueber den generischen Admin-Loeschmodul
# (Admin -> Loeschmodul), dort gibt es jetzt die Checkbox
# "Verknuepfungen ... auf einen anderen Lieferanten legen".
#
# ---------------------------------------------------------------------------
# 4) WAS DAS UMHAENGEN ABDECKT
# ---------------------------------------------------------------------------
#
# Pruefung ergab 17 FK-Beziehungen auf Supplier. Die sind bewusst nicht
# gleich behandelt:
#
#   Eigene Daten (CASCADE) - werden beim Umhaengen mitgenommen:
#     Lieferanten-Kontakte, Warengruppen, Preislisten, Lieferanten-Anhaenge,
#     Lieferanten-Produkt-Verknuepfungen, Handelswaren, Material & Supplies
#
#   Fremd mit PROTECT - Loeschen bricht sonst hart ab:
#     Lagerartikel, Bestellungen, Leihungen, Wareneingaenge, Warensammlungen
#
#   Fremd mit SET_NULL - Loeschen wuerde die Verknuepfung still verschwinden:
#     Auftragspositionen (Kundenauftrag), RMA-Faelle (Hersteller),
#     Verkaufs-Preislisten (beide Richtungen)
#
# Die letzten beiden Gruppen sind der eigentliche Grund fuer das Umhaengen:
# ein still verschwundener RMA-Hersteller waere hinterher nicht mehr
# auffindbar.
#
# ---------------------------------------------------------------------------
# 5) ZWEI FALLEN, DIE BEIM UMHAENGEN ZUSCHLAGEN
# ---------------------------------------------------------------------------
#
# a) Artikelnummer
#    TradingProduct.visitron_part_number ist unique und wird aus der
#    Lieferantennummer ERZEUGT: 229-00001 bzw. 229-M00001 fuer M&S.
#    Beim Umhaengen aendert sich der Praefix.
#
#    Deshalb gibt es im Dialog die Checkbox
#    "Artikelnummern neu vergeben".
#    Sie ist bewusst NICHT voreingestellt: die Nummern stehen in
#    Bestell- und Angebotsdokumenten im Klartext. Beim Aufraeumen von
#    Dubletten sind beide Varianten vertretbar - deshalb entscheidet man
#    es pro Fall. Ohne das Umhaengen passiert hier gar nichts, die Nummer
#    zeigt dann eben weiter auf den alten (geloeschten) Lieferanten.
#
# b) unique_together
#    ProductGroup  -> unique (supplier, name)
#    SupplierProduct -> unique (supplier, product)
#
#    Liegen beim Ziel schon gleichnamige Eintraege, wuerde das Umhaengen mit
#    einem IntegrityError abbrechen. Stattdessen wird zusammengefuehrt: der
#    Eintrag des Ziellieferanten bleibt, der des Quell-Lieferanten wird
#    entfernt, und die Meldung sagt, wie viele Doppelten entfernt wurden.
#
# ---------------------------------------------------------------------------
# 6) URSACHE IM IMPORT BEHOBEN
# ---------------------------------------------------------------------------
#
# Sonst waeren beim naechsten Lauf wieder Dubletten entstanden.
#
# Der Lieferantenabgleich sucht jetzt in vier Stufen:
#
#     1. exakter Name
#     2. normalisierter Name - "100 - " als Praefix, Firmierungszusatz
#        (GmbH, AG, Inc, Ltd ...), Trennzeichen und Gross-/Kleinschreibung
#        werden ignoriert
#     3. Teilname - greift NUR, wenn es genau EINEN Treffer gibt
#     4. unscharfer Vergleich ab 92 % - ebenfalls nur bei eindeutigem Treffer
#
# Schritt 3 und 4 sind absichtlich zagernd: passt der Name auf zwei
# Lieferanten, wird nichts zugeordnet und die Meldung
#   ? "PCO" passt auf 2 Lieferanten ... nicht zugeordnet
# ausgegeben. Ein Fehlmatch wuerde sofort einen neuen Lieferanten erzeugen,
# also genau das, was wir vermeiden wollen.
#
# Neue Lieferanten bekommen jetzt zusaetzlich diesen Hinweis:
#     + Lieferant angelegt: 231 irgendwas
#       ! Neuer Lieferant. Bitte pruefen, ob nicht doch schon einer existiert
#
# ---------------------------------------------------------------------------
# 7) PRUEFEN
# ---------------------------------------------------------------------------
#
#    cd C:\VERP\backend
#    .\venv\Scripts\Activate
#
#    # 19 Logik-Tests (PROTECT, unique_together, visitron_part_number, Dubletten)
#    python tools\run_supplier_deletion_tests.py
#
#    # 20 End-to-End-Checks gegen die echte REST-API
#    python tools\check_supplier_delete_flow.py
#
# Beide Scripte rechnen in einer Transaktion, die am Ende zurueckgerollt
# wird, und legen deshalb KEINE Testdatenbank an. Beide duerfen nur gegen
# die Entwicklungsdatenbank laufen, nicht gegen die Produktion.
#
# Warum ueberhaupt eigene Scripte und nicht `manage.py test`:
# der TestRunner braucht CREATE DATABASE, und der Benutzer verp_user hat
# das Recht nicht. Details in /memories/repo/verp_test_runner_blocked.md
#
# Gegenprobe des Ausgangszustands (die Zahlen sollten unveraendert bleiben):
#    python manage.py shell -c "from suppliers.models import Supplier; print(Supplier.objects.count())"
#
# ---------------------------------------------------------------------------
# 8) REIHENFOLGE BEIM AUFRAEUMEN
# ---------------------------------------------------------------------------
#
#    1. Lieferantenliste oeffnen, nach der Firma suchen
#    2. Kacheln vergleichen: welcher hat Lagerartikel / Bestellungen?
#    3. Auf der Kachel mit 0 Verknuepfungen den Muell-Eimer klicken
#       -> "Ja, auf einen anderen Lieferanten umhaengen"
#       -> Ziel-Lieferant waehlen
#       -> Probelauf
#       -> Bestaetigung eintippen
#
#    Lieferanten OHNE jede Verknuepfung kann man ohne Umhaengen loeschen -
#    das ist genau der Fall, der beim Import am haeufigsten war.
