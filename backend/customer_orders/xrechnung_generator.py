"""
XRechnung Generator für VERP
============================

Generiert XRechnung-konforme XML-Dateien nach:
- EN 16931 (Europäische Norm für elektronische Rechnungen)
- XRechnung 3.0 (Deutsche Umsetzung)
- UBL 2.1 (Universal Business Language) Syntax

Pflichtfelder nach XRechnung:
- BT-1: Rechnungsnummer
- BT-2: Rechnungsdatum
- BT-3: Rechnungsart (380 = Handelsrechnung)
- BT-5: Währung
- BT-6: MwSt-Abrechnungsdatum (optional)
- BT-9: Fälligkeitsdatum
- BT-24: Spezifikationskennung
- BT-27-35: Verkäufer-Daten
- BT-44-63: Käufer-Daten
- BT-106-115: Summen
- BT-116-BT-117: MwSt-Beträge
- BT-126-BT-133: Positionsdaten
"""

import os
from datetime import date
from decimal import Decimal
from xml.etree import ElementTree as ET
from xml.dom import minidom
from django.conf import settings


# XML Namespaces für UBL 2.1
NAMESPACES = {
    'ubl': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    'cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    'cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'ccts': 'urn:un:unece:uncefact:documentation:2',
    'qdt': 'urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2',
    'udt': 'urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2',
    'ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
}


def format_decimal(value, decimals=2):
    """Formatiert Dezimalzahlen für XML (mit Punkt als Dezimaltrenner)"""
    if value is None:
        value = Decimal('0')
    return f"{Decimal(str(value)):.{decimals}f}"


def format_date(d):
    """Formatiert Datum für XML (YYYY-MM-DD)"""
    if isinstance(d, date):
        return d.strftime('%Y-%m-%d')
    return str(d) if d else date.today().strftime('%Y-%m-%d')


def create_element(tag, text=None, attribs=None, ns='cbc'):
    """Erstellt ein XML-Element mit Namespace"""
    if ns:
        full_tag = f"{{{NAMESPACES[ns]}}}{tag}"
    else:
        full_tag = tag
    
    elem = ET.Element(full_tag)
    if text is not None:
        elem.text = str(text)
    if attribs:
        for key, val in attribs.items():
            elem.set(key, str(val))
    return elem


def add_subelement(parent, tag, text=None, attribs=None, ns='cbc'):
    """Fügt ein Unterelement hinzu"""
    if ns:
        full_tag = f"{{{NAMESPACES[ns]}}}{tag}"
    else:
        full_tag = tag
    
    elem = ET.SubElement(parent, full_tag)
    if text is not None:
        elem.text = str(text)
    if attribs:
        for key, val in attribs.items():
            elem.set(key, str(val))
    return elem


def get_company_data():
    """Holt Firmendaten aus den Einstellungen"""
    from verp_settings.models import CompanySettings
    try:
        company = CompanySettings.objects.first()
        if company:
            return {
                'name': company.company_name or 'Firma',
                'street': f"{company.street or ''} {company.house_number or ''}".strip(),
                'city': company.city or '',
                'postal_code': company.postal_code or '',
                'country': company.country or 'DE',
                'vat_id': company.vat_id or '',
                'tax_number': company.tax_number or '',
                'email': company.email or '',
                'phone': company.phone or '',
                'iban': company.iban or '',
                'bic': company.bic or '',
                'bank_name': company.bank_name or '',
            }
    except Exception:
        pass
    
    return {
        'name': 'Firma',
        'street': '',
        'city': '',
        'postal_code': '',
        'country': 'DE',
        'vat_id': '',
        'tax_number': '',
        'email': '',
        'phone': '',
        'iban': '',
        'bic': '',
        'bank_name': '',
    }


def generate_xrechnung_xml(invoice):
    """
    Generiert eine XRechnung-konforme XML-Datei für eine Rechnung.
    
    Args:
        invoice: Invoice-Objekt aus customer_orders.models
        
    Returns:
        str: Pfad zur generierten XML-Datei (relativ zu MEDIA_ROOT)
    """
    order = invoice.order
    customer = order.customer
    company = get_company_data()
    
    # Root-Element mit allen Namespaces
    root = ET.Element(f"{{{NAMESPACES['ubl']}}}Invoice")
    for prefix, uri in NAMESPACES.items():
        if prefix == 'ubl':
            root.set('xmlns', uri)
        else:
            root.set(f'xmlns:{prefix}', uri)
    
    # === BT-24: Spezifikationskennung (XRechnung 3.0) ===
    add_subelement(root, 'CustomizationID', 
                   'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0')
    
    # === BT-23: Geschäftsprozesskennung ===
    add_subelement(root, 'ProfileID', 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0')
    
    # === BT-1: Rechnungsnummer ===
    add_subelement(root, 'ID', invoice.invoice_number)
    
    # === BT-2: Rechnungsdatum ===
    add_subelement(root, 'IssueDate', format_date(invoice.invoice_date))
    
    # === BT-9: Fälligkeitsdatum ===
    if invoice.due_date:
        add_subelement(root, 'DueDate', format_date(invoice.due_date))
    
    # === BT-3: Rechnungsart (380 = Handelsrechnung) ===
    add_subelement(root, 'InvoiceTypeCode', '380')
    
    # === BT-22: Bemerkung ===
    if invoice.notes:
        add_subelement(root, 'Note', invoice.notes[:500])
    
    # === BT-5: Währung ===
    add_subelement(root, 'DocumentCurrencyCode', 'EUR')
    
    # === BT-10: Käuferreferenz (Bestellnummer) ===
    if order.customer_order_number:
        add_subelement(root, 'BuyerReference', order.customer_order_number)
    else:
        # XRechnung erfordert BuyerReference - notfalls Rechnungsnummer verwenden
        add_subelement(root, 'BuyerReference', invoice.invoice_number)
    
    # === BG-14: Rechnungszeitraum (optional) ===
    # invoice_period = add_subelement(root, 'InvoicePeriod', ns='cac')
    # add_subelement(invoice_period, 'StartDate', format_date(invoice.invoice_date))
    # add_subelement(invoice_period, 'EndDate', format_date(invoice.invoice_date))
    
    # === BG-1: Auftragsreferenz ===
    if order.order_number:
        order_ref = add_subelement(root, 'OrderReference', ns='cac')
        add_subelement(order_ref, 'ID', order.order_number)
    
    # === BG-4: Verkäufer (Supplier) ===
    supplier_party = add_subelement(root, 'AccountingSupplierParty', ns='cac')
    party = add_subelement(supplier_party, 'Party', ns='cac')
    
    # Elektronische Adresse (BT-34) - Pflicht für XRechnung
    endpoint = add_subelement(party, 'EndpointID', company['email'] or 'no-email@example.com')
    endpoint.set('schemeID', 'EM')  # EM = E-Mail
    
    # Firmenname
    party_name = add_subelement(party, 'PartyName', ns='cac')
    add_subelement(party_name, 'Name', company['name'])
    
    # Adresse
    postal_addr = add_subelement(party, 'PostalAddress', ns='cac')
    if company['street']:
        add_subelement(postal_addr, 'StreetName', company['street'])
    add_subelement(postal_addr, 'CityName', company['city'] or 'Stadt')
    add_subelement(postal_addr, 'PostalZone', company['postal_code'] or '00000')
    country = add_subelement(postal_addr, 'Country', ns='cac')
    add_subelement(country, 'IdentificationCode', company['country'] or 'DE')
    
    # USt-ID (BT-31)
    if company['vat_id']:
        tax_scheme = add_subelement(party, 'PartyTaxScheme', ns='cac')
        add_subelement(tax_scheme, 'CompanyID', company['vat_id'])
        scheme = add_subelement(tax_scheme, 'TaxScheme', ns='cac')
        add_subelement(scheme, 'ID', 'VAT')
    
    # Rechtliche Registrierung
    legal_entity = add_subelement(party, 'PartyLegalEntity', ns='cac')
    add_subelement(legal_entity, 'RegistrationName', company['name'])
    
    # Kontakt
    contact = add_subelement(party, 'Contact', ns='cac')
    if company['phone']:
        add_subelement(contact, 'Telephone', company['phone'])
    if company['email']:
        add_subelement(contact, 'ElectronicMail', company['email'])
    
    # === BG-7: Käufer (Customer) ===
    customer_party = add_subelement(root, 'AccountingCustomerParty', ns='cac')
    cust_party = add_subelement(customer_party, 'Party', ns='cac')
    
    # Elektronische Adresse des Käufers
    cust_email = order.billing_email or getattr(customer, 'primary_email', '') or 'kunde@example.com'
    cust_endpoint = add_subelement(cust_party, 'EndpointID', cust_email)
    cust_endpoint.set('schemeID', 'EM')
    
    # Kundenname
    cust_party_name = add_subelement(cust_party, 'PartyName', ns='cac')
    customer_name = getattr(customer, 'company_name', None)
    if not customer_name:
        customer_name = f"{getattr(customer, 'first_name', '')} {getattr(customer, 'last_name', '')}".strip()
    if not customer_name:
        customer_name = 'Kunde'
    add_subelement(cust_party_name, 'Name', customer_name)
    
    # Kundenadresse
    cust_postal = add_subelement(cust_party, 'PostalAddress', ns='cac')
    
    # Parse billing_address (kann JSON/String sein)
    billing_addr = invoice.billing_address or order.billing_address
    if isinstance(billing_addr, str) and billing_addr:
        lines = billing_addr.split('\n')
        if len(lines) >= 1:
            add_subelement(cust_postal, 'StreetName', lines[0])
        # Versuche PLZ und Stadt aus letzter Zeile zu extrahieren
        if len(lines) >= 2:
            last_line = lines[-1].strip()
            import re
            match = re.match(r'^(\d{4,5})\s+(.+)$', last_line)
            if match:
                add_subelement(cust_postal, 'PostalZone', match.group(1))
                add_subelement(cust_postal, 'CityName', match.group(2))
            else:
                add_subelement(cust_postal, 'CityName', last_line)
                add_subelement(cust_postal, 'PostalZone', '00000')
        else:
            add_subelement(cust_postal, 'CityName', 'Stadt')
            add_subelement(cust_postal, 'PostalZone', '00000')
    else:
        add_subelement(cust_postal, 'StreetName', 'Adresse')
        add_subelement(cust_postal, 'CityName', 'Stadt')
        add_subelement(cust_postal, 'PostalZone', '00000')
    
    cust_country = add_subelement(cust_postal, 'Country', ns='cac')
    add_subelement(cust_country, 'IdentificationCode', 'DE')
    
    # Kunden-USt-ID (falls vorhanden)
    cust_vat_id = order.customer_vat_id
    if cust_vat_id:
        cust_tax_scheme = add_subelement(cust_party, 'PartyTaxScheme', ns='cac')
        add_subelement(cust_tax_scheme, 'CompanyID', cust_vat_id)
        cust_scheme = add_subelement(cust_tax_scheme, 'TaxScheme', ns='cac')
        add_subelement(cust_scheme, 'ID', 'VAT')
    
    # Rechtliche Registrierung Käufer
    cust_legal = add_subelement(cust_party, 'PartyLegalEntity', ns='cac')
    add_subelement(cust_legal, 'RegistrationName', customer_name)
    
    # === BG-16: Zahlungsanweisungen ===
    payment_means = add_subelement(root, 'PaymentMeans', ns='cac')
    # 58 = SEPA-Überweisung, 30 = Überweisung
    add_subelement(payment_means, 'PaymentMeansCode', '58')
    
    if company['iban']:
        payee_account = add_subelement(payment_means, 'PayeeFinancialAccount', ns='cac')
        add_subelement(payee_account, 'ID', company['iban'])
        if company['bank_name']:
            add_subelement(payee_account, 'Name', company['bank_name'])
        if company['bic']:
            fin_inst = add_subelement(payee_account, 'FinancialInstitutionBranch', ns='cac')
            add_subelement(fin_inst, 'ID', company['bic'])
    
    # === BG-20-23: MwSt-Aufschlüsselung ===
    # Berechne Summen
    net_amount = invoice.net_amount or Decimal('0')
    tax_amount = invoice.tax_amount or Decimal('0')
    gross_amount = invoice.gross_amount or Decimal('0')
    tax_rate = order.tax_rate or Decimal('19')
    
    tax_total = add_subelement(root, 'TaxTotal', ns='cac')
    tax_amt_elem = add_subelement(tax_total, 'TaxAmount', format_decimal(tax_amount))
    tax_amt_elem.set('currencyID', 'EUR')
    
    tax_subtotal = add_subelement(tax_total, 'TaxSubtotal', ns='cac')
    taxable_amt = add_subelement(tax_subtotal, 'TaxableAmount', format_decimal(net_amount))
    taxable_amt.set('currencyID', 'EUR')
    subtotal_tax_amt = add_subelement(tax_subtotal, 'TaxAmount', format_decimal(tax_amount))
    subtotal_tax_amt.set('currencyID', 'EUR')
    
    tax_category = add_subelement(tax_subtotal, 'TaxCategory', ns='cac')
    add_subelement(tax_category, 'ID', 'S')  # S = Standard rate
    add_subelement(tax_category, 'Percent', format_decimal(tax_rate, 0))
    tax_scheme_elem = add_subelement(tax_category, 'TaxScheme', ns='cac')
    add_subelement(tax_scheme_elem, 'ID', 'VAT')
    
    # === BG-22: Gesamtbeträge ===
    legal_monetary = add_subelement(root, 'LegalMonetaryTotal', ns='cac')
    
    line_ext = add_subelement(legal_monetary, 'LineExtensionAmount', format_decimal(net_amount))
    line_ext.set('currencyID', 'EUR')
    
    tax_excl = add_subelement(legal_monetary, 'TaxExclusiveAmount', format_decimal(net_amount))
    tax_excl.set('currencyID', 'EUR')
    
    tax_incl = add_subelement(legal_monetary, 'TaxInclusiveAmount', format_decimal(gross_amount))
    tax_incl.set('currencyID', 'EUR')
    
    payable = add_subelement(legal_monetary, 'PayableAmount', format_decimal(gross_amount))
    payable.set('currencyID', 'EUR')
    
    # === BG-25: Rechnungspositionen ===
    items = order.items.filter(invoice_number=invoice.sequence_number).order_by('position')
    
    for idx, item in enumerate(items, start=1):
        invoice_line = add_subelement(root, 'InvoiceLine', ns='cac')
        
        # BT-126: Positionsnummer
        add_subelement(invoice_line, 'ID', str(item.position or idx))
        
        # BT-129: Menge
        qty = add_subelement(invoice_line, 'InvoicedQuantity', format_decimal(item.quantity or 1))
        qty.set('unitCode', get_unit_code(item.unit))
        
        # BT-131: Nettobetrag der Position
        line_total = (item.final_price or item.list_price or Decimal('0')) * (item.quantity or 1)
        line_amt = add_subelement(invoice_line, 'LineExtensionAmount', format_decimal(line_total))
        line_amt.set('currencyID', 'EUR')
        
        # BG-31: Artikelinformationen
        inv_item = add_subelement(invoice_line, 'Item', ns='cac')
        
        # BT-153: Artikelname
        add_subelement(inv_item, 'Name', (item.name or 'Artikel')[:200])
        
        # BT-154: Beschreibung (optional)
        if item.description:
            add_subelement(inv_item, 'Description', item.description[:1000])
        
        # BT-155: Verkäufer-Artikelnummer
        if item.article_number:
            sellers_item = add_subelement(inv_item, 'SellersItemIdentification', ns='cac')
            add_subelement(sellers_item, 'ID', item.article_number)
        
        # BG-30: Steuerinformationen der Position
        item_tax = add_subelement(inv_item, 'ClassifiedTaxCategory', ns='cac')
        add_subelement(item_tax, 'ID', 'S')
        add_subelement(item_tax, 'Percent', format_decimal(tax_rate, 0))
        item_tax_scheme = add_subelement(item_tax, 'TaxScheme', ns='cac')
        add_subelement(item_tax_scheme, 'ID', 'VAT')
        
        # BG-29: Preisinformationen
        price = add_subelement(invoice_line, 'Price', ns='cac')
        price_amt = add_subelement(price, 'PriceAmount', 
                                   format_decimal(item.final_price or item.list_price or 0))
        price_amt.set('currencyID', 'EUR')
    
    # XML als String formatieren
    xml_str = ET.tostring(root, encoding='unicode')
    
    # Pretty Print
    dom = minidom.parseString(xml_str)
    pretty_xml = dom.toprettyxml(indent='  ', encoding='UTF-8')
    
    # Datei speichern
    year = invoice.invoice_date.year if invoice.invoice_date else date.today().year
    order_num = order.order_number or f'draft_{order.id}'
    
    rel_dir = f'customer_orders/{year}/{order_num}'
    abs_dir = os.path.join(settings.MEDIA_ROOT, rel_dir)
    os.makedirs(abs_dir, exist_ok=True)
    
    filename = f'XRechnung_{invoice.invoice_number}.xml'
    rel_path = f'{rel_dir}/{filename}'
    abs_path = os.path.join(abs_dir, filename)
    
    with open(abs_path, 'wb') as f:
        f.write(pretty_xml)
    
    return rel_path


def get_unit_code(unit):
    """
    Konvertiert deutsche Einheiten in UN/ECE Recommendation 20 Codes.
    Siehe: https://unece.org/trade/cefact/UNLOCODE-Download
    """
    unit_mapping = {
        'Stk': 'C62',      # Stück (One)
        'Stück': 'C62',
        'St': 'C62',
        'Set': 'SET',      # Set
        'm': 'MTR',        # Meter
        'cm': 'CMT',       # Zentimeter
        'mm': 'MMT',       # Millimeter
        'kg': 'KGM',       # Kilogramm
        'g': 'GRM',        # Gramm
        'l': 'LTR',        # Liter
        'ml': 'MLT',       # Milliliter
        'Std': 'HUR',      # Stunde
        'Std.': 'HUR',
        'h': 'HUR',
        'Tag': 'DAY',      # Tag
        'Tage': 'DAY',
        'Psch': 'LS',      # Pauschal (Lump Sum)
        'Pauschal': 'LS',
        'psch': 'LS',
        '%': 'P1',         # Prozent
    }
    
    return unit_mapping.get(unit, 'C62')  # Default: Stück


def validate_xrechnung(xml_path):
    """
    Validiert eine XRechnung gegen das Schema.
    
    Hinweis: Für vollständige Validierung wird ein externer Validator empfohlen:
    - KoSIT Validator: https://github.com/itplr-kosit/validator
    - Online: https://erechnungsvalidator.service-bw.de/
    
    Args:
        xml_path: Pfad zur XML-Datei
        
    Returns:
        dict: Validierungsergebnis mit 'valid' und 'errors'
    """
    # Basis-Validierung: XML ist wohlgeformt
    try:
        abs_path = os.path.join(settings.MEDIA_ROOT, xml_path)
        tree = ET.parse(abs_path)
        root = tree.getroot()
        
        # Prüfe Pflichtfelder
        errors = []
        
        # Rechnungsnummer
        invoice_id = root.find(f".//{{{NAMESPACES['cbc']}}}ID")
        if invoice_id is None or not invoice_id.text:
            errors.append("BT-1: Rechnungsnummer fehlt")
        
        # Rechnungsdatum
        issue_date = root.find(f".//{{{NAMESPACES['cbc']}}}IssueDate")
        if issue_date is None or not issue_date.text:
            errors.append("BT-2: Rechnungsdatum fehlt")
        
        # Käuferreferenz
        buyer_ref = root.find(f".//{{{NAMESPACES['cbc']}}}BuyerReference")
        if buyer_ref is None or not buyer_ref.text:
            errors.append("BT-10: Käuferreferenz fehlt")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'message': 'Basis-Validierung bestanden' if len(errors) == 0 else 'Fehler gefunden'
        }
        
    except ET.ParseError as e:
        return {
            'valid': False,
            'errors': [f"XML Parse Error: {str(e)}"],
            'message': 'XML ist nicht wohlgeformt'
        }
    except Exception as e:
        return {
            'valid': False,
            'errors': [str(e)],
            'message': 'Validierungsfehler'
        }
