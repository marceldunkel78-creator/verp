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
from django.conf import settings
import os


class PriceListDocTemplate(BaseDocTemplate):
    """
    Custom DocTemplate für Preislisten mit Header und Footer auf jeder Seite
    """
    def __init__(self, filename, company=None, pricelist=None, **kwargs):
        self.company = company
        self.pricelist = pricelist
        BaseDocTemplate.__init__(self, filename, **kwargs)
        
        # Frame für den Hauptinhalt
        frame = Frame(
            self.leftMargin, 
            self.bottomMargin, 
            self.width, 
            self.height,
            id='normal'
        )
        
        # PageTemplate mit unseren Callbacks
        template = PageTemplate(
            id='pricelist',
            frames=frame,
            onPage=self._add_header_footer
        )
        self.addPageTemplates([template])
    
    def _add_header_footer(self, canvas, doc):
        """Fügt Header und Footer zu jeder Seite hinzu"""
        canvas.saveState()
        
        width, height = A4
        company = self.company
        pricelist = self.pricelist
        
        # === HEADER ===
        page_num = canvas.getPageNumber()
        
        # Logo (nur auf Seite 1, rechts oben)
        if page_num == 1 and company and company.document_header:
            try:
                logo_path = os.path.join(settings.MEDIA_ROOT, company.document_header.name)
                if os.path.exists(logo_path):
                    # Logo rechts oben, kleinere Größe: 5cm breit, 1.5cm hoch
                    logo_x = width - 7*cm
                    logo_y = height - 2.5*cm
                    try:
                        img = ImageReader(logo_path)
                        canvas.drawImage(img, logo_x, logo_y, width=5*cm, height=1.5*cm, 
                                        preserveAspectRatio=True, anchor='nw', mask='auto')
                    except Exception:
                        canvas.drawImage(logo_path, logo_x, logo_y, width=5*cm, height=1.5*cm, 
                                        preserveAspectRatio=True, anchor='nw')
            except Exception as e:
                print(f"Error loading header logo: {e}")
        
        # Seitenzahl (ab Seite 2)
        if page_num > 1:
            canvas.setFont('Helvetica', 8)
            canvas.setFillColor(colors.grey)
            header_text = f"Page {page_num} - Visitron Systems price list - {pricelist.get_subtitle()}"
            canvas.drawString(2*cm, height - 3.2*cm, header_text)
            # Unterstrich
            canvas.setStrokeColor(colors.grey)
            canvas.line(2*cm, height - 3.4*cm, width - 2*cm, height - 3.4*cm)
        
        # === FOOTER ===
        footer_y = 1.2*cm
        
        # Trennlinie über dem Footer
        canvas.setStrokeColor(colors.grey)
        canvas.line(2*cm, footer_y + 1.8*cm, width - 2*cm, footer_y + 1.8*cm)
        
        canvas.setFont('Helvetica', 6.5)
        canvas.setFillColor(colors.HexColor('#333333'))
        
        if company:
            # Block 1: Firmenadresse
            col1_x = 2*cm
            canvas.drawString(col1_x, footer_y + 1.4*cm, company.company_name or 'Visitron Systems GmbH')
            canvas.drawString(col1_x, footer_y + 0.9*cm, f"{company.street or ''} {company.house_number or ''}")
            canvas.drawString(col1_x, footer_y + 0.4*cm, f"D-{company.postal_code or ''} {company.city or ''}")
            
            # Block 2: Kontakt
            col2_x = 6.5*cm
            canvas.drawString(col2_x, footer_y + 1.4*cm, f"Tel. {company.phone or ''}")
            canvas.drawString(col2_x, footer_y + 0.9*cm, company.email or '')
            canvas.drawString(col2_x, footer_y + 0.4*cm, (company.website or '').replace('https://', '').replace('http://', ''))
            
            # Block 3: Handelsregister
            col3_x = 10.5*cm
            canvas.drawString(col3_x, footer_y + 1.4*cm, f"{company.register_court or ''}, {company.commercial_register or ''}")
            canvas.drawString(col3_x, footer_y + 0.9*cm, "Managing Director:")
            canvas.drawString(col3_x, footer_y + 0.4*cm, company.managing_director or '')
            
            # Block 4: Bank
            col4_x = 15*cm
            canvas.drawString(col4_x, footer_y + 1.4*cm, company.bank_name or '')
            canvas.drawString(col4_x, footer_y + 0.9*cm, f"BIC: {company.bic or ''}")
            canvas.drawString(col4_x, footer_y + 0.4*cm, f"IBAN: {company.iban or ''}")
        
        canvas.restoreState()


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
        topMargin=3.5*cm,
        bottomMargin=3.5*cm,
        leftMargin=2*cm, 
        rightMargin=2*cm,
        company=company,
        pricelist=pricelist
    )
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Styles definieren
    style_title = ParagraphStyle(
        'PriceListTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#0066cc'),
        spaceAfter=6,
        alignment=TA_CENTER
    )
    
    style_subtitle = ParagraphStyle(
        'PriceListSubtitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#333333'),
        spaceAfter=6,
        alignment=TA_CENTER
    )
    
    style_validity = ParagraphStyle(
        'Validity',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#666666'),
        spaceBefore=6,
        spaceAfter=20,
        alignment=TA_CENTER
    )
    
    style_section = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading3'],
        fontSize=12,
        textColor=colors.HexColor('#0066cc'),
        spaceBefore=15,
        spaceAfter=10,
        borderPadding=5,
        backColor=colors.HexColor('#f0f5ff')
    )
    
    style_normal = styles['Normal']
    style_description = ParagraphStyle(
        'Description',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#666666')
    )
    
    # === TITEL-BEREICH ===
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph("Visitron Systems price list", style_title))
    elements.append(Paragraph(pricelist.get_subtitle(), style_subtitle))
    elements.append(Paragraph(pricelist.get_validity_string(), style_validity))
    
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
        
        # Tabellen-Header
        table_data = [['Article No.', 'Product Name', 'Description', 'List Price (EUR)']]
        
        for product in products:
            # Beschreibung kürzen wenn nötig
            description = product.get('description', '')
            if len(description) > 150:
                description = description[:147] + '...'
            
            # Paragraphen für Name und Beschreibung
            name_para = Paragraph(product.get('name', ''), style_normal)
            desc_para = Paragraph(description, style_description)
            
            table_data.append([
                product.get('article_number', ''),
                name_para,
                desc_para,
                f"{product.get('list_price', 0):.2f}"
            ])
        
        # Tabelle erstellen
        table = Table(
            table_data, 
            colWidths=[2.5*cm, 4*cm, 8*cm, 2.5*cm]
        )
        
        table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0066cc')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            
            # Datenzeilen
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ALIGN', (0, 1), (0, -1), 'LEFT'),  # Article number left
            ('ALIGN', (3, 1), (3, -1), 'RIGHT'),  # Price right
            ('VALIGN', (0, 1), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            
            # Zebra-Streifen
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
            
            # Gitternetz
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#dddddd')),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#0066cc')),
        ]))
        
        elements.append(table)
        elements.append(Spacer(1, 0.5*cm))
    
    # Falls keine Produkte gefunden
    if not sections:
        elements.append(Paragraph("No products found for this price list.", style_normal))
    
    # Schlusstext
    elements.append(Spacer(1, 1*cm))
    style_footer_text = ParagraphStyle(
        'FooterText',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#666666'),
        alignment=TA_CENTER
    )
    elements.append(Paragraph(
        "All prices are list prices in EUR. Prices are subject to change without notice. "
        "Please contact us for current pricing and volume discounts.",
        style_footer_text
    ))
    
    # PDF erstellen
    doc.build(elements)
    
    return buffer.getvalue()
