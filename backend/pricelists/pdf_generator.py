"""
PDF Generator für Verkaufs-Preislisten
Professionelles DIN A4 Layout mit:
- Company Logo/Header
- Title "Visitron Systems price list"
- Subtitle (product type)
- Validity period
- Products grouped by category
- Article number, name, description, list price
"""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, 
    Image, PageBreak, KeepTogether, Frame, PageTemplate, BaseDocTemplate
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.lib.utils import ImageReader
from company.models import CompanySettings
from core.pdf_base import (
    VerpDocTemplate,
    build_positions_table,
    format_amount,
    get_company_styles,
)
import os


class PriceListDocTemplate(VerpDocTemplate):
    """
    Custom DocTemplate für Preislisten.

    Briefkopf, Fusszeile, Rand und Schriftgroessen kommen aus
    core.pdf_base und entsprechen damit der Corporate-Design-Vorlage.
    """
    def __init__(self, filename, company=None, pricelist=None, **kwargs):
        self.pricelist = pricelist
        subtitle = ''
        if pricelist is not None:
            try:
                subtitle = pricelist.get_subtitle()
            except Exception:
                subtitle = ''
        kwargs.setdefault('title', 'Visitron Systems price list')
        VerpDocTemplate.__init__(
            self, filename, company=company,
            continuation_text=(
                f'Visitron Systems price list - {subtitle}' if subtitle
                else 'Visitron Systems price list'),
            **kwargs)


def get_vs_hardware_products():
    """Holt alle aktiven VS-Hardware Produkte mit Preisen"""
    from manufacturing.models import VSHardware
    
    products = VSHardware.objects.filter(is_active=True).order_by('part_number')
    result = []
    
    for product in products:
        price = product.get_current_sales_price()
        if price is not None:
            result.append({
                'article_number': product.part_number or '',
                'name': product.name,
                'description': product.description_en or product.description or '',
                'list_price': price
            })
    
    return result


def get_visiview_products():
    """Holt alle aktiven VisiView Produkte mit Preisen"""
    from visiview.models import VisiViewProduct
    
    products = VisiViewProduct.objects.filter(is_active=True).order_by('article_number')
    result = []
    
    for product in products:
        price = product.get_current_sales_price()
        if price is not None:
            result.append({
                'article_number': product.article_number or '',
                'name': product.name,
                'description': product.description_en or product.description or '',
                'list_price': price
            })
    
    return result


def get_trading_products(supplier=None):
    """Holt alle aktiven Trading Products, optional gefiltert nach Lieferant"""
    from suppliers.models import TradingProduct
    
    products = TradingProduct.objects.filter(is_active=True)
    
    if supplier:
        products = products.filter(supplier=supplier)
    
    products = products.select_related('supplier').order_by('supplier__company_name', 'visitron_part_number')
    result = []
    
    for product in products:
        # TradingProduct uses price_history with list_price field
        price_entry = product.get_current_price()
        price = price_entry.list_price if price_entry else None
        
        # Fallback to calculate_visitron_list_price if no price history
        if price is None:
            try:
                price = product.calculate_visitron_list_price()
            except:
                price = None
        
        if price is not None:
            result.append({
                'article_number': product.visitron_part_number or '',
                'name': product.name,
                'description': product.description_en or product.description or '',
                'list_price': price,
                'supplier_name': product.supplier.company_name if product.supplier else ''
            })
    
    return result


def get_vs_service_products():
    """Holt alle aktiven VS-Service Produkte mit Preisen"""
    from service.models import VSService
    
    products = VSService.objects.filter(is_active=True).order_by('article_number')
    result = []
    
    for product in products:
        price = product.get_current_sales_price()
        if price is not None:
            result.append({
                'article_number': product.article_number or '',
                'name': product.name,
                'description': product.description_en or product.short_description_en or '',
                'list_price': price
            })
    
    return result


def generate_pricelist_pdf(pricelist):
    """
    Generiert ein professionelles PDF für eine Preisliste
    """
    buffer = BytesIO()
    
    # Lade Firmendaten
    company = CompanySettings.get_settings()
    
    # Erstelle Dokument mit benutzerdefinierten Seiten-Callbacks
    doc = PriceListDocTemplate(
        buffer, 
        pagesize=A4,
        company=company,
        pricelist=pricelist
    )
    
    elements = []
    styles = getSampleStyleSheet()
    vs = get_company_styles()
    
    # Styles definieren
    style_title = vs['VerpTitle']
    style_subtitle = vs['VerpHeading']
    style_validity = vs['VerpSmall']
    style_section = vs['VerpHeading']
    style_normal = vs['VerpBody']
    style_description = vs['VerpSmall']
    
    # === TITEL-BEREICH ===
    elements.append(Spacer(1, 0.3*cm))
    elements.append(Paragraph("Visitron Systems price list", style_title))
    elements.append(Spacer(1, 0.2*cm))
    elements.append(Paragraph(pricelist.get_subtitle(), style_subtitle))
    elements.append(Spacer(1, 0.2*cm))
    elements.append(Paragraph(pricelist.get_validity_string(), style_validity))
    elements.append(Spacer(1, 0.5*cm))
    
    # Sammle alle Produkte
    sections = []
    
    if pricelist.pricelist_type == 'vs_hardware':
        products = get_vs_hardware_products()
        if products:
            sections.append(('VS-Hardware Products', products))
    
    elif pricelist.pricelist_type == 'visiview':
        products = get_visiview_products()
        if products:
            sections.append(('VisiView Software Products', products))
    
    elif pricelist.pricelist_type == 'trading':
        products = get_trading_products(pricelist.supplier)
        if products:
            # Gruppiere nach Lieferant
            suppliers = {}
            for p in products:
                supplier_name = p.get('supplier_name', 'Other')
                if supplier_name not in suppliers:
                    suppliers[supplier_name] = []
                suppliers[supplier_name].append(p)
            
            for supplier_name, supplier_products in sorted(suppliers.items()):
                sections.append((f'Trading Products - {supplier_name}', supplier_products))
    
    elif pricelist.pricelist_type == 'vs_service':
        products = get_vs_service_products()
        if products:
            sections.append(('VS-Service Products', products))
    
    elif pricelist.pricelist_type == 'combined':
        if pricelist.include_vs_hardware:
            products = get_vs_hardware_products()
            if products:
                sections.append(('VS-Hardware Products', products))
        
        if pricelist.include_visiview:
            products = get_visiview_products()
            if products:
                sections.append(('VisiView Software Products', products))
        
        if pricelist.include_trading:
            products = get_trading_products(pricelist.trading_supplier)
            if products:
                # Gruppiere nach Lieferant
                suppliers = {}
                for p in products:
                    supplier_name = p.get('supplier_name', 'Other')
                    if supplier_name not in suppliers:
                        suppliers[supplier_name] = []
                    suppliers[supplier_name].append(p)
                
                for supplier_name, supplier_products in sorted(suppliers.items()):
                    sections.append((f'Trading Products - {supplier_name}', supplier_products))
        
        if pricelist.include_vs_service:
            products = get_vs_service_products()
            if products:
                sections.append(('VS-Service Products', products))
    
    # Erstelle Tabellen für jede Sektion
    for section_title, products in sections:
        elements.append(Paragraph(section_title, style_section))
        elements.append(Spacer(1, 0.2*cm))
        
        headers = ['Article No.', 'Product Name', 'Description', 'List Price (EUR)']
        
        rows = []
        for product in products:
            # Beschreibung kürzen wenn nötig
            description = product.get('description', '')
            if len(description) > 150:
                description = description[:147] + '...'
            
            rows.append([
                Paragraph(product.get('article_number', ''), style_normal),
                Paragraph(product.get('name', ''), style_normal),
                Paragraph(description, style_description),
                Paragraph(format_amount(product.get('list_price', 0)), style_normal),
            ])
        
        col_widths = [2.5*cm, 4.0*cm, 6.0*cm, 3.5*cm]
        elements.extend(build_positions_table(
            headers, rows, col_widths=col_widths, align_right=[3]))
        elements.append(Spacer(1, 0.5*cm))
    
    # Falls keine Produkte gefunden
    if not sections:
        elements.append(Paragraph("No products found for this price list.", style_normal))
    
    # Schlusstext
    elements.append(Spacer(1, 1*cm))
    elements.append(Paragraph(
        "All prices are list prices in EUR. Prices are subject to change without notice. "
        "Please contact us for current pricing and volume discounts.",
        vs['VerpFootnote']
    ))
    
    # PDF erstellen
    doc.build(elements)
    
    return buffer.getvalue()
